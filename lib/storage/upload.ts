// ============================================================
// lib/storage/upload.ts — Server-only storage helper
//
// One entry point (`uploadFile`) used by every server action that
// needs to persist a user-uploaded file. Returns the canonical
// ActionResult discriminated union so callers can narrow on `.ok`.
//
// Why a single helper
// -------------------
// Every call site would otherwise repeat: service-role client,
// bucket-cap check, MIME allow-list, upload, getPublicUrl or
// createSignedUrl, error shaping. Centralized here so the pattern
// stays consistent and the size/MIME rules change in one place.
//
// Path builders
// -------------
// Each bucket has a specific path shape (see constants.ts). This
// module exports builder helpers (`brandAssetPath`, `documentMediaPath`)
// so call sites never concatenate paths by hand — typos in path
// conventions break the RLS policies silently, and centralizing is
// the only defense.
// ============================================================
import 'server-only';

import { nanoid } from 'nanoid';
import { createClient } from '@/lib/supabase/server';
import type { Mode } from '@/types';
import {
  BUCKETS,
  MAX_UPLOAD_BYTES,
  ALLOWED_MIME_TYPES,
  extensionFor,
  type BucketName,
} from './constants';

/**
 * Discriminated result shape returned by every storage operation.
 * Mirrors `ActionResult<T>` in the server actions — callers can
 * narrow on `.ok` identically.
 */
export type StorageResult<T> =
  | { ok: true;  data: T }
  | { ok: false; error: string };

export interface UploadedFile {
  /** Fully-qualified URL. Public for brand-assets; signed for document-media. */
  url:  string;
  /** Storage path inside the bucket (e.g. "ownerId/documentId/abc.webp"). */
  path: string;
  /** Size in bytes of what was actually written. */
  size: number;
}

/** Options accepted by the file uploader. */
export interface UploadOptions {
  /** Destination bucket. Picks the public/auth posture and size caps. */
  bucket: BucketName;
  /** Storage path inside the bucket. Use a path-builder helper. */
  path:   string;
  /** The file data. Accepts File, Blob, or raw bytes. */
  file:   Blob | ArrayBuffer | Uint8Array;
  /** Explicit content-type. Required for ArrayBuffer/Uint8Array; optional for Blob/File. */
  contentType?: string;
  /**
   * Overwrite an existing object at the same path. Default false —
   * we typically want a new unique path per upload so old and new
   * versions coexist for a moment (the caller deletes the old one
   * after the DB row points to the new URL).
   */
  upsert?: boolean;
  /**
   * If the bucket is private (document-media / bos-backups), the
   * returned `url` is a signed URL that expires after this many
   * seconds. Default 3600 (1 hour). Ignored for public buckets.
   */
  signedUrlExpirySeconds?: number;
}

/**
 * Upload a file to Supabase Storage and return its URL + path + size.
 *
 * Uses the service-role client, so callers have already authenticated
 * the request (via `requireSession()` in the server action that
 * invokes this helper). Size + MIME validation happen here before
 * the actual upload so a bad request never reaches Supabase.
 */
export async function uploadFile(opts: UploadOptions): Promise<StorageResult<UploadedFile>> {
  const { bucket, path, file, upsert = false, signedUrlExpirySeconds = 3600 } = opts;

  // ── Normalize to a Blob with a known content-type ────────────
  let blob:     Blob;
  let mimeType: string;

  if (file instanceof Blob) {
    blob     = file;
    mimeType = opts.contentType ?? file.type;
  } else {
    if (!opts.contentType) {
      return { ok: false, error: 'contentType is required for ArrayBuffer/Uint8Array uploads' };
    }
    blob     = new Blob([file as BlobPart], { type: opts.contentType });
    mimeType = opts.contentType;
  }

  // Empty or wrong content-type → refuse before touching storage.
  if (!mimeType) {
    return { ok: false, error: 'Could not determine content-type for upload' };
  }

  // ── Validate against bucket MIME allow-list ──────────────────
  const allowed = ALLOWED_MIME_TYPES[bucket];
  if (!allowed.includes(mimeType)) {
    return {
      ok:    false,
      error: `MIME type ${mimeType} is not allowed in bucket ${bucket}. Allowed: ${allowed.join(', ')}`,
    };
  }

  // ── Validate size against bucket hard cap ────────────────────
  const cap = MAX_UPLOAD_BYTES[bucket];
  if (blob.size > cap) {
    return {
      ok:    false,
      error: `File size ${blob.size} exceeds bucket cap ${cap} for ${bucket}`,
    };
  }

  // ── Upload ───────────────────────────────────────────────────
  const supabase = await createClient();
  const { error: uploadErr } = await supabase.storage
    .from(bucket)
    .upload(path, blob, { upsert, contentType: mimeType });

  if (uploadErr) {
    return { ok: false, error: `Storage upload failed: ${uploadErr.message}` };
  }

  // ── Resolve public or signed URL based on bucket visibility ──
  const url = await resolveUrlFor(bucket, path, signedUrlExpirySeconds);
  if (!url.ok) return url;

  return {
    ok:   true,
    data: { url: url.data, path, size: blob.size },
  };
}

/**
 * Delete a file at the given path. Used by:
 *   - removeBrandLogo (on explicit "remove logo" click)
 *   - brand logo replacement (delete old path after new one is saved)
 *   - document delete cleanup (remove all document-media for a doc)
 *
 * No-op if the file doesn't exist — Supabase returns success either
 * way. We return the paths that the storage API said it touched,
 * which is an empty array if nothing was there.
 */
export async function deleteFile(
  bucket: BucketName,
  path:   string,
): Promise<StorageResult<{ deletedPaths: string[] }>> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(bucket).remove([path]);
  if (error) return { ok: false, error: `Storage delete failed: ${error.message}` };
  return {
    ok:   true,
    data: { deletedPaths: (data ?? []).map((d) => d.name) },
  };
}

/**
 * Delete every file under a given prefix. Used for bulk cleanup:
 *   - Document deletion: delete everything under `{ownerId}/{documentId}/`
 *   - Account nuke:      delete everything under `{ownerId}/`
 *
 * Lists then deletes — Supabase's storage API has no "delete by
 * prefix" primitive. Safe to call on a missing prefix (returns 0).
 */
export async function deletePrefix(
  bucket: BucketName,
  prefix: string,
): Promise<StorageResult<{ deletedCount: number }>> {
  const supabase = await createClient();
  const { data: files, error: listErr } = await supabase.storage
    .from(bucket)
    .list(prefix, { limit: 1000 });

  if (listErr) return { ok: false, error: `Storage list failed: ${listErr.message}` };
  if (!files || files.length === 0) return { ok: true, data: { deletedCount: 0 } };

  const paths = files.map((f) => `${prefix}/${f.name}`);
  const { error: removeErr } = await supabase.storage.from(bucket).remove(paths);
  if (removeErr) return { ok: false, error: `Storage delete failed: ${removeErr.message}` };

  return { ok: true, data: { deletedCount: paths.length } };
}

// ─── PATH BUILDERS ─────────────────────────────────────────────
// Every call site that writes to storage goes through these helpers
// instead of string concatenation. The RLS policies check that the
// first path segment equals the owner's uid — a typo breaks writes
// silently. Centralizing here is the only defense.

/**
 * brand-assets path for a logo: {ownerId}/{mode}/logo-{timestamp}.{ext}
 *
 * Including the timestamp means each upload gets a unique path. The
 * caller is responsible for deleting the previous logo after the
 * brand_profiles row is updated to point at the new URL.
 */
export function brandAssetPath(ownerId: string, mode: Mode, mimeType: string): string {
  const ext       = extensionFor(mimeType);
  const timestamp = Date.now();
  return `${ownerId}/${mode}/logo-${timestamp}.${ext}`;
}

/**
 * brand-assets path for a saved signature: {ownerId}/{mode}/signature-{timestamp}.{ext}
 *
 * Parallels brandAssetPath() — same bucket, same owner-scoped layout,
 * same delete-after-save pattern. The `signature-` prefix keeps it
 * distinct from logos when listing the bucket by prefix.
 */
export function brandSignaturePath(ownerId: string, mode: Mode, mimeType: string): string {
  const ext       = extensionFor(mimeType);
  const timestamp = Date.now();
  return `${ownerId}/${mode}/signature-${timestamp}.${ext}`;
}

/**
 * document-media path for an embedded image: {ownerId}/{documentId}/{nanoid}.{ext}
 *
 * The documentId prefix makes cleanup-on-delete a single prefix
 * delete. The nanoid keeps multiple uploads to the same doc from
 * colliding.
 */
export function documentMediaPath(ownerId: string, documentId: string, mimeType: string): string {
  const ext = extensionFor(mimeType);
  const id  = nanoid(10);
  return `${ownerId}/${documentId}/${id}.${ext}`;
}

/**
 * document-media prefix for a whole document. Used by the document
 * delete cleanup path.
 */
export function documentMediaPrefix(ownerId: string, documentId: string): string {
  return `${ownerId}/${documentId}`;
}

/**
 * document-media path for a signature captured on the public
 * /doc/[token] page: {ownerId}/{documentId}/signatures/{role}-{nanoid}.{ext}
 *
 * The nested `signatures/` segment keeps signature blobs separate from
 * other in-doc media so cleanup / auditing can target them specifically.
 * `role` is 'client' or 'creator' — useful when inspecting storage.
 */
export function signaturePath(
  ownerId: string,
  documentId: string,
  role: 'client' | 'creator',
  mimeType: string,
): string {
  const ext = extensionFor(mimeType);
  const id  = nanoid(10);
  return `${ownerId}/${documentId}/signatures/${role}-${id}.${ext}`;
}

/**
 * Produce a fresh signed URL for an object in a private bucket. Used by
 * the public /doc/[token] server component to render signatures (which
 * live in document-media) without exposing them publicly. Signed URLs
 * are short-lived; each page render re-signs.
 */
export async function signedUrlFor(
  bucket:       BucketName,
  path:         string,
  expirySeconds = 3600,
): Promise<StorageResult<string>> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expirySeconds);
  if (error || !data?.signedUrl) {
    return { ok: false, error: `Could not create signed URL: ${error?.message ?? 'unknown'}` };
  }
  return { ok: true, data: data.signedUrl };
}

/**
 * Resolve the URL a caller should store against a DB row. Public
 * buckets get `getPublicUrl`; private ones get a signed URL with the
 * requested expiry. Separated out so `uploadFile` and any future
 * "refresh URL" helper share the same logic.
 */
async function resolveUrlFor(
  bucket:        BucketName,
  path:          string,
  signedExpiry:  number,
): Promise<StorageResult<string>> {
  const supabase = await createClient();

  if (bucket === BUCKETS.BRAND_ASSETS) {
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    if (!data?.publicUrl) return { ok: false, error: 'Could not resolve public URL' };
    return { ok: true, data: data.publicUrl };
  }

  // bos-backups isn't served via URL to the client — callers of that
  // bucket don't ask for a URL at all. But we still return one here
  // for symmetry and to support download routes that need it.
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, signedExpiry);
  if (error || !data?.signedUrl) {
    return { ok: false, error: `Could not create signed URL: ${error?.message ?? 'unknown'}` };
  }
  return { ok: true, data: data.signedUrl };
}

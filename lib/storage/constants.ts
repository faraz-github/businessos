// ============================================================
// lib/storage/constants.ts — Storage configuration
//
// Single source of truth for bucket names, size caps, dimension
// caps, and the compression targets. Consumed by:
//   - lib/storage/compress.ts  (client-side, picks maxSizeKB / maxWidth)
//   - lib/storage/upload.ts    (server-side, picks bucket name + path builders)
//   - supabase/migrations-consolidated/001_schema.sql (file_size_limit
//     on the bucket itself — must match or exceed the values here)
//
// This file is ISOMORPHIC (no `'server-only'` import) — it's consumed
// by the client-side compressor. No secrets or server-only APIs belong
// here.
//
// Bucket-level limits vs. compression targets — the difference
// -------------------------------------------------------------
// MAX_UPLOAD_BYTES is the HARD cap enforced by Supabase before
// storage writes the row. It's the ceiling a user could hit if
// compression failed or was bypassed.
//
// COMPRESSION_TARGET_KB is the SOFT target passed to
// browser-image-compression. Typical output lands close to this
// value, but the library won't blow past MAX_UPLOAD_BYTES because
// it re-encodes until under the target (and we fall through to
// the raw file only if compression threw).
// ============================================================

/** All the storage buckets this app writes to. */
export const BUCKETS = {
  /** Public-read CDN bucket for logos and brand graphics. */
  BRAND_ASSETS:   'brand-assets',
  /** Authenticated bucket for images embedded inside paperwork docs. */
  DOCUMENT_MEDIA: 'document-media',
  /** Service-role-only bucket for full-data backup JSON files. */
  BACKUPS:        'bos-backups',
} as const;

export type BucketName = typeof BUCKETS[keyof typeof BUCKETS];

/**
 * Maximum raw upload size per bucket. Matches the `file_size_limit`
 * column set in 001_schema.sql — if you change one, change the other.
 *
 * These are hard ceilings. Real uploads land well under them because
 * client-side compression happens first.
 */
export const MAX_UPLOAD_BYTES: Record<BucketName, number> = {
  [BUCKETS.BRAND_ASSETS]:   2 * 1024 * 1024,   // 2 MB
  [BUCKETS.DOCUMENT_MEDIA]: 5 * 1024 * 1024,   // 5 MB
  [BUCKETS.BACKUPS]:        50 * 1024 * 1024,  // 50 MB
};

/**
 * Compression profiles per asset kind. The client uses these to
 * downscale and re-encode before sending bytes over the wire.
 *
 * Kept as profiles (not per-bucket) because document-media handles
 * different sizing for different kinds of in-doc images if we add
 * them later (thumbnails vs. hero images, say). Today every
 * document-media upload uses the 'in-doc-image' profile.
 */
export const COMPRESSION_PROFILES = {
  logo: {
    /** Maximum output size in KB after compression. */
    maxSizeKB:   200,
    /** Longest-edge cap in pixels. */
    maxWidth:    512,
    /** Output MIME. PNG kept if the source had transparency. */
    preferType:  'image/webp' as const,
  },
  'in-doc-image': {
    maxSizeKB:   1024,
    maxWidth:    2048,
    preferType:  'image/webp' as const,
  },
} as const;

export type CompressionProfile = keyof typeof COMPRESSION_PROFILES;

/**
 * Accepted MIME types per bucket. Matches `allowed_mime_types` on
 * the Supabase bucket itself. Server-side validation uses this to
 * reject disallowed types before calling storage.
 */
export const ALLOWED_MIME_TYPES: Record<BucketName, readonly string[]> = {
  [BUCKETS.BRAND_ASSETS]: [
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/svg+xml',
  ],
  [BUCKETS.DOCUMENT_MEDIA]: [
    'image/png',
    'image/jpeg',
    'image/webp',
  ],
  [BUCKETS.BACKUPS]: ['application/json'],
};

/**
 * File extension for a given MIME type. Used when building paths
 * server-side from a blob that hasn't got a filename.
 */
export function extensionFor(mime: string): string {
  switch (mime) {
    case 'image/png':     return 'png';
    case 'image/jpeg':    return 'jpg';
    case 'image/webp':    return 'webp';
    case 'image/svg+xml': return 'svg';
    case 'application/json': return 'json';
    default: return 'bin';
  }
}

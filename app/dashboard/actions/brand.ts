'use server';
// ============================================================
// Business OS — Brand Server Actions
//
// Handles brand profile CRUD and brand logo upload/remove. Uses the
// canonical server action pattern (see subscriptions.ts for the full
// annotated reference):
//   1. requireSession() → throws if not authenticated
//   2. getOwnerId(session) → resolves to data-owning superadmin uuid
//   3. Zod validation on every input
//   4. Ownership check on every mutation
//   5. ActionResult<T> discriminated union return shape
//   6. revalidatePath() after every write
//
// Logo upload/remove delegates to lib/storage (upload.ts + constants.ts),
// so the bucket name, path convention, size caps, and MIME allow-list
// are centralized there.
// ============================================================

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireSession, getOwnerId } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import {
  uploadFile,
  deleteFile,
  brandAssetPath,
  brandSignaturePath,
} from '@/lib/storage/upload';
import { BUCKETS } from '@/lib/storage/constants';
import { brandProfileSchema, type BrandProfileFormData } from '@/types/schemas';
import type { BrandProfile, Mode } from '@/types';
import type { ActionResult } from './subscriptions';

// ActionResult comes from subscriptions.ts — single source of truth.
// Prior comment here claimed a circular dep would result if we imported
// it; that's false, subscriptions.ts never imports from brand.ts.
// Redeclaring it collided with the barrel re-export in index.ts.

const modeSchema = z.enum(['personal', 'agency']);

// ─── READ ──────────────────────────────────────────────────────

/**
 * List all brand profiles for the current owner. Returns an empty
 * array for an owner who hasn't set up either profile yet — callers
 * should handle the empty state, not expect this to throw.
 */
export async function getBrandProfiles(): Promise<BrandProfile[]> {
  const session  = await requireSession();
  const ownerId  = getOwnerId(session);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('brand_profiles')
    .select('*')
    .eq('user_id', ownerId);

  if (error) throw new Error(`Failed to load brand profiles: ${error.message}`);
  return (data ?? []) as unknown as BrandProfile[];
}

// ─── UPSERT ────────────────────────────────────────────────────

/**
 * Create or update the brand profile for the given mode. Never touches
 * `logo_url` — logo changes go through uploadBrandLogo/removeBrandLogo
 * below, which keep the DB row and the storage object in sync atomically.
 *
 * Accepts the form data (client-validated by react-hook-form + Zod) and
 * re-validates server-side — the client validation is UX, this is trust.
 */
export async function upsertBrandProfile(
  formData: BrandProfileFormData,
): Promise<ActionResult<BrandProfile>> {
  const parsed = brandProfileSchema.safeParse(formData);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
    return { ok: false, error: issues.join('; ') };
  }

  const session  = await requireSession();
  const ownerId  = getOwnerId(session);
  const supabase = await createClient();

  // Strip logo_url + signature_* from the payload — those columns are
  // owned by their dedicated upload/remove actions, which keep the DB
  // row and the storage object in sync atomically. Leaving them in
  // would let a stale form submit wipe a valid signature/logo.
  const {
    logo_url:       _logoIgnored,
    signature_url:  _sigUrlIgnored,
    signature_type: _sigTypeIgnored,
    ...profileData
  } = parsed.data;
  void _logoIgnored; void _sigUrlIgnored; void _sigTypeIgnored;

  // Check for existing row — we can't use .upsert() alone because
  // we want the ownership filter on the existence check.
  const { data: existing, error: selectErr } = await supabase
    .from('brand_profiles')
    .select('id')
    .eq('user_id', ownerId)
    .eq('mode', profileData.mode)
    .maybeSingle();

  if (selectErr) return { ok: false, error: `Failed to check existing profile: ${selectErr.message}` };

  if (existing) {
    const { data, error } = await supabase
      .from('brand_profiles')
      .update(profileData)
      .eq('id', existing.id)
      .eq('user_id', ownerId)
      .select()
      .single();
    if (error) return { ok: false, error: error.message };
    revalidatePath('/dashboard');
    return { ok: true, data: data as unknown as BrandProfile };
  }

  const { data, error } = await supabase
    .from('brand_profiles')
    .insert({ ...profileData, user_id: ownerId })
    .select()
    .single();

  if (error) return { ok: false, error: error.message };
  revalidatePath('/dashboard');
  return { ok: true, data: data as unknown as BrandProfile };
}

// ─── LOGO UPLOAD ───────────────────────────────────────────────

/**
 * Upload a new brand logo. The client should compress the image first
 * via lib/storage/compress.ts — this server action doesn't re-compress,
 * it just validates + stores. The old logo (if any) is deleted AFTER
 * the new URL is saved to the DB, so a mid-flight failure leaves the
 * profile pointing at valid storage either way.
 *
 * Returns the new logo URL on success.
 */
export async function uploadBrandLogo(
  mode: Mode,
  file: FormData,
): Promise<ActionResult<{ url: string }>> {
  const parsedMode = modeSchema.safeParse(mode);
  if (!parsedMode.success) return { ok: false, error: 'Invalid mode' };

  const imageFile = file.get('file');
  if (!(imageFile instanceof File)) {
    return { ok: false, error: 'No file provided' };
  }

  const session  = await requireSession();
  const ownerId  = getOwnerId(session);
  const supabase = await createClient();

  // Read the current logo path (if any) so we can delete it after the
  // new one is saved. We derive the path from the URL — the public URL
  // format is .../storage/v1/object/public/brand-assets/{path}.
  const { data: existingBrand } = await supabase
    .from('brand_profiles')
    .select('id, logo_url')
    .eq('user_id', ownerId)
    .eq('mode', parsedMode.data)
    .maybeSingle();

  const oldLogoPath = existingBrand?.logo_url
    ? pathFromBrandAssetUrl(existingBrand.logo_url)
    : null;

  // Upload the new file. Path includes a timestamp so it's distinct
  // from the old path — enabling the delete-after-save pattern.
  const path = brandAssetPath(ownerId, parsedMode.data, imageFile.type);
  const uploadResult = await uploadFile({
    bucket:      BUCKETS.BRAND_ASSETS,
    path,
    file:        imageFile,
    contentType: imageFile.type,
    upsert:      false,
  });

  if (!uploadResult.ok) return uploadResult;

  // Persist the new URL to brand_profiles. Using upsert + onConflict
  // handles the case where brand_profiles row doesn't exist yet.
  const { error: dbErr } = await supabase
    .from('brand_profiles')
    .upsert(
      {
        user_id:  ownerId,
        mode:     parsedMode.data,
        logo_url: uploadResult.data.url,
      },
      { onConflict: 'user_id,mode' },
    );

  if (dbErr) {
    // DB write failed — clean up the orphan we just uploaded so storage
    // doesn't accumulate dead files. Non-fatal if the delete fails.
    await deleteFile(BUCKETS.BRAND_ASSETS, path).catch(() => undefined);
    return { ok: false, error: `Failed to save logo URL: ${dbErr.message}` };
  }

  // DB is updated. Safe to delete the old file. Non-fatal if this fails.
  if (oldLogoPath && oldLogoPath !== path) {
    await deleteFile(BUCKETS.BRAND_ASSETS, oldLogoPath).catch(() => undefined);
  }

  revalidatePath('/dashboard');
  return { ok: true, data: { url: uploadResult.data.url } };
}

// ─── LOGO REMOVE ───────────────────────────────────────────────

/**
 * Remove the brand logo for the given mode. Clears `logo_url` on the
 * row AND deletes the storage object. Replaces the broken
 * `DELETE /api/brand/logo` call-site in settings/page.tsx (that route
 * never existed).
 */
export async function removeBrandLogo(mode: Mode): Promise<ActionResult<null>> {
  const parsedMode = modeSchema.safeParse(mode);
  if (!parsedMode.success) return { ok: false, error: 'Invalid mode' };

  const session  = await requireSession();
  const ownerId  = getOwnerId(session);
  const supabase = await createClient();

  const { data: existing, error: selectErr } = await supabase
    .from('brand_profiles')
    .select('id, logo_url')
    .eq('user_id', ownerId)
    .eq('mode', parsedMode.data)
    .maybeSingle();

  if (selectErr) return { ok: false, error: selectErr.message };
  if (!existing) return { ok: true, data: null };  // nothing to remove

  // Clear the URL on the row first. If this fails, bail before deleting
  // the storage object — otherwise the UI would show a broken image.
  const { error: dbErr } = await supabase
    .from('brand_profiles')
    .update({ logo_url: null })
    .eq('id', existing.id)
    .eq('user_id', ownerId);

  if (dbErr) return { ok: false, error: `Failed to clear logo: ${dbErr.message}` };

  // DB is clean. Best-effort storage cleanup.
  if (existing.logo_url) {
    const oldPath = pathFromBrandAssetUrl(existing.logo_url);
    if (oldPath) {
      await deleteFile(BUCKETS.BRAND_ASSETS, oldPath).catch(() => undefined);
    }
  }

  revalidatePath('/dashboard');
  return { ok: true, data: null };
}

// ─── SIGNATURE UPLOAD ──────────────────────────────────────────

/**
 * Signature file types accepted by uploadBrandSignature. A superset of
 * the `drawn` case (always PNG — produced by canvas.toDataURL on the
 * client) and the `uploaded` case (PNG / JPG / WebP). SVG is
 * intentionally excluded — signatures are pixel artefacts, not logos,
 * and SVG would add font-loading concerns to the public doc view
 * (which renders these inside an email-compatible-ish HTML sheet).
 */
const SIGNATURE_KIND_SCHEMA = z.enum(['drawn', 'uploaded']);

/**
 * Upload a saved signature to the brand profile. Behaves identically
 * to uploadBrandLogo — same bucket (brand-assets), same delete-after-
 * save pattern, same compression expectations on the client. The only
 * differences are the path prefix and the DB columns touched.
 *
 * `kind` is stored on brand_profiles.signature_type so the UI can
 * label ("Drawn in app" vs "Uploaded stamp"). Critical for Feature B:
 * this does NOT auto-fill creator_signature on any document. The
 * paperwork editor's SenderSignatureField renders a "Use saved"
 * option that the user chooses explicitly.
 *
 * Returns the signature URL on success.
 */
export async function uploadBrandSignature(
  mode: Mode,
  file: FormData,
  kind: 'drawn' | 'uploaded',
): Promise<ActionResult<{ url: string }>> {
  const parsedMode = modeSchema.safeParse(mode);
  if (!parsedMode.success) return { ok: false, error: 'Invalid mode' };

  const parsedKind = SIGNATURE_KIND_SCHEMA.safeParse(kind);
  if (!parsedKind.success) return { ok: false, error: 'Invalid signature kind' };

  const imageFile = file.get('file');
  if (!(imageFile instanceof File)) {
    return { ok: false, error: 'No file provided' };
  }

  const session  = await requireSession();
  const ownerId  = getOwnerId(session);
  const supabase = await createClient();

  // Fetch the current signature URL so we can delete the old file
  // after the new one is saved and committed.
  const { data: existingBrand } = await supabase
    .from('brand_profiles')
    .select('id, signature_url')
    .eq('user_id', ownerId)
    .eq('mode', parsedMode.data)
    .maybeSingle();

  const oldSignaturePath = existingBrand?.signature_url
    ? pathFromBrandAssetUrl(existingBrand.signature_url)
    : null;

  // Upload the new file. Timestamp in the path keeps it distinct from
  // the old one so we can delete after save, not before.
  const path = brandSignaturePath(ownerId, parsedMode.data, imageFile.type);
  const uploadResult = await uploadFile({
    bucket:      BUCKETS.BRAND_ASSETS,
    path,
    file:        imageFile,
    contentType: imageFile.type,
    upsert:      false,
  });

  if (!uploadResult.ok) return uploadResult;

  // Upsert the DB row. onConflict handles the case where brand_profiles
  // doesn't exist yet for this (user_id, mode).
  const { error: dbErr } = await supabase
    .from('brand_profiles')
    .upsert(
      {
        user_id:        ownerId,
        mode:           parsedMode.data,
        signature_url:  uploadResult.data.url,
        signature_type: parsedKind.data,
      },
      { onConflict: 'user_id,mode' },
    );

  if (dbErr) {
    // DB write failed — clean up the orphan in storage. Non-fatal.
    await deleteFile(BUCKETS.BRAND_ASSETS, path).catch(() => undefined);
    return { ok: false, error: `Failed to save signature URL: ${dbErr.message}` };
  }

  // DB committed. Safe to delete the old file. Non-fatal if it fails.
  if (oldSignaturePath && oldSignaturePath !== path) {
    await deleteFile(BUCKETS.BRAND_ASSETS, oldSignaturePath).catch(() => undefined);
  }

  revalidatePath('/dashboard');
  return { ok: true, data: { url: uploadResult.data.url } };
}

// ─── SIGNATURE REMOVE ──────────────────────────────────────────

/**
 * Clear the saved signature on the brand profile. Mirrors removeBrandLogo:
 * clear the DB column first, then best-effort delete the storage object.
 * Safe to call when no signature is saved — returns ok with null.
 */
export async function removeBrandSignature(mode: Mode): Promise<ActionResult<null>> {
  const parsedMode = modeSchema.safeParse(mode);
  if (!parsedMode.success) return { ok: false, error: 'Invalid mode' };

  const session  = await requireSession();
  const ownerId  = getOwnerId(session);
  const supabase = await createClient();

  const { data: existing, error: selectErr } = await supabase
    .from('brand_profiles')
    .select('id, signature_url')
    .eq('user_id', ownerId)
    .eq('mode', parsedMode.data)
    .maybeSingle();

  if (selectErr) return { ok: false, error: selectErr.message };
  if (!existing) return { ok: true, data: null };

  const { error: dbErr } = await supabase
    .from('brand_profiles')
    .update({ signature_url: null, signature_type: null })
    .eq('id', existing.id)
    .eq('user_id', ownerId);

  if (dbErr) return { ok: false, error: `Failed to clear signature: ${dbErr.message}` };

  if (existing.signature_url) {
    const oldPath = pathFromBrandAssetUrl(existing.signature_url);
    if (oldPath) {
      await deleteFile(BUCKETS.BRAND_ASSETS, oldPath).catch(() => undefined);
    }
  }

  revalidatePath('/dashboard');
  return { ok: true, data: null };
}

// ─── INTERNAL ──────────────────────────────────────────────────

/**
 * Extract the storage path from a public URL for the brand-assets bucket.
 * Returns null if the URL isn't a brand-assets public URL.
 *
 * Public URL shape: {supabaseUrl}/storage/v1/object/public/brand-assets/{path}
 *
 * Used by both the logo and signature flows — both store images in
 * brand-assets, so a single parser handles both.
 */
function pathFromBrandAssetUrl(url: string): string | null {
  const match = url.match(/\/brand-assets\/(.+?)(?:\?|$)/);
  return match?.[1] ?? null;
}

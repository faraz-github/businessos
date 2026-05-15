'use server';
// ============================================================
// Business OS — Social + Outreach Leads Server Actions
//
// Two tables that share the /social page:
//   1. social_posts    — content calendar (LinkedIn/GitHub/etc. posts)
//   2. outreach_leads  — DM tracking, light-touch lead capture
//
// Grouped in one file because they're edited from the same page and
// the UI flows are parallel (quick-add from idea parking lot,
// status toggle, delete). Each has its own exported actions.
//
// Canonical pattern — see subscriptions.ts for the long-form rationale.
// ============================================================

import { z } from 'zod';
import { requireSession, getOwnerId } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { socialPostSchema } from '@/types/schemas';
import { revalidatePath } from 'next/cache';
import type { SocialPost } from '@/types';
import type { DbOutreachChannel } from '@/types/database';
import type { ActionResult } from './subscriptions';
import { uploadFile, deletePrefix, postMediaPath } from '@/lib/storage/upload';
import { BUCKETS } from '@/lib/storage/constants';

function revalidateSocial(): void {
  revalidatePath('/dashboard/personal/social');
  revalidatePath('/dashboard/agency/social');
}

// ════════════════════════════════════════════════════════════════
// SOCIAL POSTS
// ════════════════════════════════════════════════════════════════

// ─── CREATE ────────────────────────────────────────────────────
// Most social-post creates come from the "idea parking lot" — just a
// title and status='idea'. The full schema requires everything,
// so we use a lenient create schema that accepts minimal input.

const socialPostCreateSchema = socialPostSchema.extend({
  // Override defaults so minimal-input creates work cleanly.
  title:   z.string().nullable().optional(),
  content: z.string().nullable().optional(),
});
export type SocialPostCreateInput = z.infer<typeof socialPostCreateSchema>;

export async function createSocialPost(
  input: SocialPostCreateInput,
): Promise<ActionResult<SocialPost>> {
  const parsed = socialPostCreateSchema.safeParse(input);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join('; ');
    return { ok: false, error: msg };
  }

  const session  = await requireSession();
  const ownerId  = getOwnerId(session);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('social_posts')
    .insert({
      ...parsed.data,
      user_id:     ownerId,
      image_paths: (parsed.data as { image_paths?: string[] }).image_paths ?? [],
    })
    .select()
    .single();

  if (error) return { ok: false, error: error.message };
  revalidateSocial();
  return { ok: true, data: data as unknown as SocialPost };
}

// ─── UPDATE (edit modal) ──────────────────────────────────────

const socialPostUpdateSchema = socialPostSchema.pick({
  title: true,
  content: true,
  planned_date: true,
  posted_at: true,
  status: true,
  platform: true,
  engagement_notes: true,
}).extend({
  image_paths: z.array(z.string()).optional(),
}).partial();
export type SocialPostUpdateInput = z.infer<typeof socialPostUpdateSchema>;

export async function updateSocialPost(
  id: string,
  input: SocialPostUpdateInput,
): Promise<ActionResult<SocialPost>> {
  if (!id) return { ok: false, error: 'Post id required' };

  const parsed = socialPostUpdateSchema.safeParse(input);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join('; ');
    return { ok: false, error: msg };
  }

  const session  = await requireSession();
  const ownerId  = getOwnerId(session);
  const supabase = await createClient();

  // If image_paths is being updated, delete any paths that were removed
  // from storage so we don't accumulate orphaned files in the bucket.
  if (parsed.data.image_paths !== undefined) {
    const { data: existing } = await supabase
      .from('social_posts')
      .select('image_paths')
      .eq('id', id)
      .eq('user_id', ownerId)
      .single();

    if (existing) {
      const oldPaths = (existing.image_paths ?? []) as string[];
      const newPaths = parsed.data.image_paths ?? [];
      const orphaned = oldPaths.filter((p: string) => !newPaths.includes(p));
      if (orphaned.length > 0) {
        // Non-fatal — DB update proceeds even if storage delete fails
        await supabase.storage.from(BUCKETS.POST_MEDIA).remove(orphaned);
      }
    }
  }

  const { data, error } = await supabase
    .from('social_posts')
    .update(parsed.data)
    .eq('id', id)
    .eq('user_id', ownerId)
    .select()
    .single();

  if (error) return { ok: false, error: error.message };
  revalidateSocial();
  return { ok: true, data: data as unknown as SocialPost };
}

// ─── STATUS TOGGLE ─────────────────────────────────────────────

const SOCIAL_STATUSES = ['idea', 'draft', 'scheduled', 'published'] as const;
export type SocialPostStatus = typeof SOCIAL_STATUSES[number];

export async function updateSocialPostStatus(
  id: string,
  status: SocialPostStatus,
): Promise<ActionResult<SocialPost>> {
  if (!id) return { ok: false, error: 'Post id required' };
  if (!SOCIAL_STATUSES.includes(status)) {
    return { ok: false, error: 'Invalid status' };
  }

  const session  = await requireSession();
  const ownerId  = getOwnerId(session);
  const supabase = await createClient();

  // When a post becomes "published" via the quick action, auto-stamp
  // posted_at with the current time. Users can still adjust it later
  // via the edit modal. We only set it if it's currently null —
  // re-promoting a post (e.g. accidentally moving back and forth)
  // shouldn't clobber a manually-edited timestamp.
  const update: { status: SocialPostStatus; posted_at?: string } = { status };
  if (status === 'published') {
    // Read current posted_at first to avoid overwriting an existing value.
    const existing = await supabase
      .from('social_posts')
      .select('posted_at')
      .eq('id', id)
      .eq('user_id', ownerId)
      .maybeSingle();
    if (!existing.data?.posted_at) {
      update.posted_at = new Date().toISOString();
    }
  }

  const { data, error } = await supabase
    .from('social_posts')
    .update(update)
    .eq('id', id)
    .eq('user_id', ownerId)
    .select()
    .single();

  if (error) return { ok: false, error: error.message };
  revalidateSocial();
  return { ok: true, data: data as unknown as SocialPost };
}

// ─── DELETE ────────────────────────────────────────────────────

export async function deleteSocialPost(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  if (!id) return { ok: false, error: 'Post id required' };

  const session  = await requireSession();
  const ownerId  = getOwnerId(session);
  const supabase = await createClient();

  // Clean up storage images before deleting the row so we don't
  // leave orphaned files. Non-fatal — DB delete proceeds regardless.
  await deletePrefix(BUCKETS.POST_MEDIA, `${ownerId}/${id}`);

  const { error } = await supabase
    .from('social_posts')
    .delete()
    .eq('id', id)
    .eq('user_id', ownerId);

  if (error) return { ok: false, error: error.message };
  revalidateSocial();
  return { ok: true, data: { id } };
}

// ════════════════════════════════════════════════════════════════
// OUTREACH LEADS
// ════════════════════════════════════════════════════════════════
// Separate table from `leads` — this one is a lighter capture flow for
// DM-style outreach (name + profile URL + one-line requirement).
// Kept intentionally minimal; richer pipeline work is in `leads.ts`.

const OUTREACH_CHANNELS = [
  'linkedin', 'email', 'whatsapp', 'phone', 'cold_call', 'instagram', 'other',
] as const satisfies readonly DbOutreachChannel[];

const OUTREACH_STATUSES = [
  'found', 'connected', 'intro_sent', 'replied',
  'call_scheduled', 'converted', 'not_interested',
] as const;
export type OutreachLeadStatus = typeof OUTREACH_STATUSES[number];

const outreachLeadCreateSchema = z.object({
  mode:        z.enum(['personal', 'agency']),
  name:        z.string().min(1, 'Name is required'),
  profile_url: z.string().nullable().optional(),
  company:     z.string().nullable().optional(),
  requirement: z.string().nullable().optional(),
  status:      z.enum(OUTREACH_STATUSES).default('found'),
  channel:     z.enum(OUTREACH_CHANNELS).default('linkedin'),
  notes:       z.string().nullable().optional(),
});
// Use z.input so defaulted fields (status, channel) are optional at the
// call site — the user may omit them and Zod fills the default during
// safeParse. z.infer would type them as required, which they aren't.
export type OutreachLeadCreateInput = z.input<typeof outreachLeadCreateSchema>;

export async function createOutreachLead(
  input: OutreachLeadCreateInput,
): Promise<ActionResult<Record<string, unknown>>> {
  const parsed = outreachLeadCreateSchema.safeParse(input);
  if (!parsed.success) {
    // Surface a clean sentence rather than concatenated Zod messages.
    // The first issue is almost always the useful one; secondary
    // issues tend to be downstream fallout.
    const first = parsed.error.issues[0];
    const field = first?.path?.[0];
    const friendly = field === 'name'        ? 'Please enter a name for this lead.'
                   : field === 'status'      ? 'Please pick a valid status from the dropdown.'
                   : field === 'channel'     ? 'Please pick a valid channel.'
                   :                           'Please check the form fields and try again.';
    return { ok: false, error: friendly };
  }

  const session  = await requireSession();
  const ownerId  = getOwnerId(session);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('outreach_leads')
    .insert({
      ...parsed.data,
      user_id: ownerId,
    })
    .select()
    .single();

  if (error) return { ok: false, error: error.message };
  revalidateSocial();
  return { ok: true, data: data as unknown as Record<string, unknown> };
}

const outreachLeadUpdateSchema = z.object({
  status: z.enum(OUTREACH_STATUSES).optional(),
  notes:  z.string().nullable().optional(),
});
export type OutreachLeadUpdateInput = z.infer<typeof outreachLeadUpdateSchema>;

export async function updateOutreachLead(
  id: string,
  input: OutreachLeadUpdateInput,
): Promise<ActionResult<Record<string, unknown>>> {
  if (!id) return { ok: false, error: 'Outreach lead id required' };

  const parsed = outreachLeadUpdateSchema.safeParse(input);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join('; ');
    return { ok: false, error: msg };
  }

  const session  = await requireSession();
  const ownerId  = getOwnerId(session);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('outreach_leads')
    .update(parsed.data)
    .eq('id', id)
    .eq('user_id', ownerId)
    .select()
    .single();

  if (error) return { ok: false, error: error.message };
  revalidateSocial();
  return { ok: true, data: data as unknown as Record<string, unknown> };
}

export async function deleteOutreachLead(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  if (!id) return { ok: false, error: 'Outreach lead id required' };

  const session  = await requireSession();
  const ownerId  = getOwnerId(session);
  const supabase = await createClient();

  const { error } = await supabase
    .from('outreach_leads')
    .delete()
    .eq('id', id)
    .eq('user_id', ownerId);

  if (error) return { ok: false, error: error.message };
  revalidateSocial();
  return { ok: true, data: { id } };
}

// ════════════════════════════════════════════════════════════════
// POST IMAGE UPLOAD / DELETE
// ════════════════════════════════════════════════════════════════

// ─── UPLOAD ─────────────────────────────────────────────────────
// Called client-side after browser-image-compression runs.
// Accepts a single file per call so progress can be tracked
// per-image. The client calls this N times for N images, collects
// the paths, then saves them all with updateSocialPost.
//
// Note: the file arrives via FormData — server actions can receive
// FormData natively when called from a client component.

export async function uploadPostImage(
  formData: FormData,
  postId: string,
): Promise<ActionResult<{ path: string; url: string }>> {
  const file = formData.get('file');
  if (!(file instanceof File)) return { ok: false, error: 'No file in FormData' };
  if (!postId) return { ok: false, error: 'postId required' };

  const session = await requireSession();
  const ownerId = getOwnerId(session);

  const path = postMediaPath(ownerId, postId, file.type);

  const res = await uploadFile({
    bucket:      BUCKETS.POST_MEDIA,
    path,
    file,
    contentType: file.type,
    upsert:      false,
  });

  if (!res.ok) return res;
  return { ok: true, data: { path: res.data.path, url: res.data.url } };
}

// ─── DELETE SINGLE IMAGE ─────────────────────────────────────────
// Removes one image from storage and patches image_paths on the
// post row atomically.

export async function deletePostImage(
  postId: string,
  imagePath: string,
): Promise<ActionResult<{ image_paths: string[] }>> {
  if (!postId || !imagePath) return { ok: false, error: 'postId and imagePath required' };

  const session  = await requireSession();
  const ownerId  = getOwnerId(session);
  const supabase = await createClient();

  // Ownership check — read the post first
  const { data: post, error: fetchErr } = await supabase
    .from('social_posts')
    .select('image_paths')
    .eq('id', postId)
    .eq('user_id', ownerId)
    .single();

  if (fetchErr || !post) return { ok: false, error: 'Post not found or access denied' };

  // Remove from storage (non-fatal — DB update still proceeds)
  const supabaseStorage = await createClient();
  await supabaseStorage.storage.from(BUCKETS.POST_MEDIA).remove([imagePath]);

  // Remove path from the array
  const updatedPaths = (post.image_paths ?? []).filter((p: string) => p !== imagePath);

  const { error: updateErr } = await supabase
    .from('social_posts')
    .update({ image_paths: updatedPaths })
    .eq('id', postId)
    .eq('user_id', ownerId);

  if (updateErr) return { ok: false, error: updateErr.message };

  revalidateSocial();
  return { ok: true, data: { image_paths: updatedPaths } };
}

// ─── DELETE ALL IMAGES FOR A POST ────────────────────────────────
// Called when a post itself is deleted (wired into deleteSocialPost
// above — see the updated deleteSocialPost below).
// Also exported so callers can clean up without deleting the post.

export async function deleteAllPostImages(
  postId: string,
  ownerId: string,
): Promise<void> {
  const prefix = `${ownerId}/${postId}`;
  await deletePrefix(BUCKETS.POST_MEDIA, prefix);
}

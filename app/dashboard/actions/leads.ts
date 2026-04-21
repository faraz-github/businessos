'use server';
// ============================================================
// Business OS — Leads Server Actions
//
// Covers the BD pipeline: create/update/stage-change/delete/add-note.
// Follows the canonical pattern from subscriptions.ts.
// ============================================================

import { z } from 'zod';
import { requireSession, getOwnerId } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { leadSchema } from '@/types/schemas';
import { revalidatePath } from 'next/cache';
import type { Lead, LeadStage, LeadNote } from '@/types';
import type { Json, DbOutreachChannel } from '@/types/database';
import type { ActionResult } from './subscriptions';

// The base leadSchema lacks channel/profile_url/context/notes — the
// BD-pipeline page uses all of these. Extending here (rather than in
// types/schemas.ts) keeps the global schema shape stable for other
// consumers that don't use these fields.
//
// `channel` is a DB-level enum (see DbOutreachChannel) — we validate the
// literal strings here so anything outside the enum is rejected before
// the DB gets a chance to throw.
const OUTREACH_CHANNELS = [
  'linkedin', 'email', 'whatsapp', 'phone', 'cold_call', 'instagram', 'other',
] as const satisfies readonly DbOutreachChannel[];

const leadCreateSchema = leadSchema.extend({
  channel:     z.enum(OUTREACH_CHANNELS).nullable().optional(),
  profile_url: z.string().nullable().optional(),
  context:     z.string().nullable().optional(),
});
export type LeadCreateInput = z.infer<typeof leadCreateSchema>;

const LEAD_STAGES = [
  'prospect', 'contacted', 'replied', 'meeting_scheduled',
  'proposal_sent', 'negotiating', 'closed_won', 'closed_lost',
] as const satisfies readonly LeadStage[];

function revalidateBoth(): void {
  // Leads is agency-only by feature, but the BD page exists under
  // /dashboard/agency/bd-pipeline specifically. Revalidating the home
  // too because agency home surfaces BD activity in its attention feed.
  revalidatePath('/dashboard/agency/bd-pipeline');
  revalidatePath('/dashboard/agency/home');
}

// ─── CREATE ────────────────────────────────────────────────────

export async function createLead(
  input: LeadCreateInput,
): Promise<ActionResult<Lead>> {
  const parsed = leadCreateSchema.safeParse(input);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join('; ');
    return { ok: false, error: msg };
  }

  const session  = await requireSession();
  const ownerId  = getOwnerId(session);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('leads')
    .insert({
      ...parsed.data,
      user_id: ownerId,
      notes: [] as unknown as Json,
      last_activity_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) return { ok: false, error: error.message };
  revalidateBoth();
  return { ok: true, data: data as unknown as Lead };
}

// ─── UPDATE (edit modal) ──────────────────────────────────────

const leadUpdateSchema = leadCreateSchema.pick({
  company: true,
  contact_name: true,
  contact_email: true,
  contact_phone: true,
  channel: true,
  profile_url: true,
  context: true,
  deal_value: true,
  next_action: true,
  next_action_date: true,
}).partial();
export type LeadUpdateInput = z.infer<typeof leadUpdateSchema>;

export async function updateLead(
  leadId: string,
  input: LeadUpdateInput,
): Promise<ActionResult<Lead>> {
  if (!leadId) return { ok: false, error: 'Lead id required' };

  const parsed = leadUpdateSchema.safeParse(input);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join('; ');
    return { ok: false, error: msg };
  }

  const session  = await requireSession();
  const ownerId  = getOwnerId(session);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('leads')
    .update(parsed.data)
    .eq('id', leadId)
    .eq('user_id', ownerId)
    .select()
    .single();

  if (error) return { ok: false, error: error.message };
  revalidateBoth();
  return { ok: true, data: data as unknown as Lead };
}

// ─── STAGE CHANGE ──────────────────────────────────────────────
// Simple update — leads (unlike clients) don't track stage_history,
// so we just write the new stage and bump last_activity_at.

export async function moveLeadStage(
  leadId: string,
  newStage: LeadStage,
): Promise<ActionResult<Lead>> {
  if (!leadId) return { ok: false, error: 'Lead id required' };
  if (!LEAD_STAGES.includes(newStage)) {
    return { ok: false, error: 'Invalid stage' };
  }

  const session  = await requireSession();
  const ownerId  = getOwnerId(session);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('leads')
    .update({
      stage: newStage,
      last_activity_at: new Date().toISOString(),
    })
    .eq('id', leadId)
    .eq('user_id', ownerId)
    .select()
    .single();

  if (error) return { ok: false, error: error.message };
  revalidateBoth();
  return { ok: true, data: data as unknown as Lead };
}

// ─── ADD NOTE ──────────────────────────────────────────────────
// Notes live in a JSONB array on the lead row. Reading the existing
// array and appending server-side keeps the array canonical — a client
// with stale state can't accidentally overwrite notes added by another
// session (e.g., the BD user while the owner is editing).

const leadNoteSchema = z.object({
  text: z.string().min(1, 'Note text required'),
  author: z.string().optional(),
});
export type LeadNoteInput = z.infer<typeof leadNoteSchema>;

export async function addLeadNote(
  leadId: string,
  input: LeadNoteInput,
): Promise<ActionResult<Lead>> {
  if (!leadId) return { ok: false, error: 'Lead id required' };

  const parsed = leadNoteSchema.safeParse(input);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join('; ');
    return { ok: false, error: msg };
  }

  const session  = await requireSession();
  const ownerId  = getOwnerId(session);
  const supabase = await createClient();

  // Read current notes first. A future optimization: do this in a single
  // SQL round-trip with a stored procedure using jsonb_insert — for now,
  // two queries is acceptable latency and keeps the action pure TS.
  const { data: existing, error: readErr } = await supabase
    .from('leads')
    .select('notes')
    .eq('id', leadId)
    .eq('user_id', ownerId)
    .maybeSingle();

  if (readErr) return { ok: false, error: readErr.message };
  if (!existing) return { ok: false, error: 'Lead not found' };

  const prior = (existing.notes as unknown as LeadNote[] | null) ?? [];
  const nextNotes: LeadNote[] = [
    ...prior,
    {
      text: parsed.data.text,
      author: parsed.data.author,
      created_at: new Date().toISOString(),
    },
  ];

  const { data, error } = await supabase
    .from('leads')
    .update({
      notes: nextNotes as unknown as Json,
      last_activity_at: new Date().toISOString(),
    })
    .eq('id', leadId)
    .eq('user_id', ownerId)
    .select()
    .single();

  if (error) return { ok: false, error: error.message };
  revalidateBoth();
  return { ok: true, data: data as unknown as Lead };
}

// ─── DELETE ────────────────────────────────────────────────────

export async function deleteLead(
  leadId: string,
): Promise<ActionResult<{ id: string }>> {
  if (!leadId) return { ok: false, error: 'Lead id required' };

  const session  = await requireSession();
  const ownerId  = getOwnerId(session);
  const supabase = await createClient();

  const { error } = await supabase
    .from('leads')
    .delete()
    .eq('id', leadId)
    .eq('user_id', ownerId);

  if (error) return { ok: false, error: error.message };
  revalidateBoth();
  return { ok: true, data: { id: leadId } };
}

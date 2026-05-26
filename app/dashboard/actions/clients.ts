'use server';
// ============================================================
// Business OS — Clients Server Actions
//
// Follows the canonical pattern established in subscriptions.ts:
//   requireSession → getOwnerId → zod.safeParse → mutation
//   with user_id ownership check → ActionResult<T> return.
//
// See subscriptions.ts for the long-form explanation.
// ============================================================

import { z } from 'zod';
import { requireSession, getOwnerId } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { clientSchema } from '@/types/schemas';
import { revalidatePath } from 'next/cache';
import type { Client, ClientStage } from '@/types';
import type { Json } from '@/types/database';
import type { ActionResult } from './subscriptions';

// Extend clientSchema with the two fields the Add modal collects that
// aren't in the base schema (it's shared with other contexts that don't
// need them). Keeps the base schema lean while this action is complete.
const clientCreateSchema = clientSchema.extend({
  service_type: z.string().default('other'),
});
export type ClientCreateInput = z.infer<typeof clientCreateSchema>;

// ─── READ ──────────────────────────────────────────────────────

export async function listClients(
  mode: 'personal' | 'agency',
): Promise<Client[]> {
  const session  = await requireSession();
  const ownerId  = getOwnerId(session);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('user_id', ownerId)
    .eq('mode', mode)
    .order('updated_at', { ascending: false });

  if (error) throw new Error(`Failed to load clients: ${error.message}`);
  return (data ?? []) as unknown as Client[];
}

// ─── CREATE ────────────────────────────────────────────────────

export async function createClientRecord(
  input: ClientCreateInput,
): Promise<ActionResult<Client>> {
  const parsed = clientCreateSchema.safeParse(input);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join('; ');
    return { ok: false, error: msg };
  }

  const session  = await requireSession();
  const ownerId  = getOwnerId(session);
  const supabase = await createClient();

  // Initial stage + history are set server-side — the client never picks
  // the starting stage, so it's not part of the validated input.
  const initialStage: ClientStage = 'lead';
  const stageHistory = [{ stage: initialStage, entered_at: new Date().toISOString() }];

  const { data, error } = await supabase
    .from('clients')
    .insert({
      ...parsed.data,
      user_id: ownerId,
      current_stage: initialStage,
      stage_history: stageHistory as unknown as Json,
      credentials: [] as unknown as Json,
    })
    .select()
    .single();

  if (error) return { ok: false, error: error.message };
  revalidatePath('/dashboard/personal/clients');
  revalidatePath('/dashboard/agency/clients');
  return { ok: true, data: data as unknown as Client };
}

// ─── STAGE CHANGE ──────────────────────────────────────────────
// Stage changes are high-frequency and have the side effect of appending
// to stage_history. A dedicated action keeps that invariant on the server
// rather than trusting the client to maintain it correctly.

// This list MUST stay in sync with:
//   1. the clients.current_stage CHECK constraint in
//      supabase/migrations-consolidated/001_schema.sql (the DB source of truth,
//      reflecting incremental migration 006), and
//   2. ALL_STAGES in app/dashboard/personal/clients/page.tsx (the UI).
// The previous list here was the pre-migration-006 set (initial_payment,
// requirements_gathering, lost) and was missing 6 valid stages — which made
// the very first advance (lead -> contacted) fail with "Invalid stage".
const STAGE_VALUES = [
  'lead', 'contacted', 'qualified',
  'proposal_sent', 'proposal_accepted',
  'contract_sent', 'contract_signed',
  'upfront_paid', 'requirements_sent', 'requirements_received', 'credentials_pending',
  'in_progress', 'milestone_review', 'revision',
  'final_review', 'final_payment_sent', 'final_payment_received',
  'handover', 'deployed',
  'support_active', 'feedback_sent', 'retention_sent', 'completed',
] as const;

export async function changeClientStage(
  clientId: string,
  newStage: ClientStage,
): Promise<ActionResult<Client>> {
  if (!clientId) return { ok: false, error: 'Client id required' };
  if (!STAGE_VALUES.includes(newStage as typeof STAGE_VALUES[number])) {
    return { ok: false, error: 'Invalid stage' };
  }

  const session  = await requireSession();
  const ownerId  = getOwnerId(session);
  const supabase = await createClient();

  // Read the current client to append history correctly — stage_history
  // has to stay consistent with current_stage, so we compute server-side.
  const { data: existing, error: readErr } = await supabase
    .from('clients')
    .select('stage_history')
    .eq('id', clientId)
    .eq('user_id', ownerId)
    .maybeSingle();

  if (readErr) return { ok: false, error: readErr.message };
  if (!existing) return { ok: false, error: 'Client not found' };

  const priorHistory = (existing.stage_history as unknown as { stage: string; entered_at: string }[] | null) ?? [];
  const newHistory = [...priorHistory, { stage: newStage, entered_at: new Date().toISOString() }];

  const { data, error } = await supabase
    .from('clients')
    .update({
      current_stage: newStage,
      stage_history: newHistory as unknown as Json,
    })
    .eq('id', clientId)
    .eq('user_id', ownerId)
    .select()
    .single();

  if (error) return { ok: false, error: error.message };
  revalidatePath('/dashboard/personal/clients');
  revalidatePath('/dashboard/agency/clients');
  return { ok: true, data: data as unknown as Client };
}

// ─── NOTES UPDATE ──────────────────────────────────────────────
// Notes are free-text and high-frequency (the "running notes" field is
// append-style in the UI). Separate action so optimistic saves don't
// block other updates.

export async function updateClientNotes(
  clientId: string,
  notes: string,
): Promise<ActionResult<{ id: string; notes: string }>> {
  if (!clientId) return { ok: false, error: 'Client id required' };
  if (typeof notes !== 'string') return { ok: false, error: 'Notes must be a string' };

  const session  = await requireSession();
  const ownerId  = getOwnerId(session);
  const supabase = await createClient();

  const { error } = await supabase
    .from('clients')
    .update({ notes })
    .eq('id', clientId)
    .eq('user_id', ownerId);

  if (error) return { ok: false, error: error.message };
  revalidatePath('/dashboard/personal/clients');
  revalidatePath('/dashboard/agency/clients');
  return { ok: true, data: { id: clientId, notes } };
}

// ─── CREDENTIALS UPDATE ────────────────────────────────────────
// Credentials are stored as a JSON array of {service, detail} entries
// (service = short label like "Hostinger", detail = free-text access
// info). Validated before hitting the DB so clients can't inject
// arbitrary JSON shapes.

const credentialEntrySchema = z.object({
  service: z.string(),
  detail: z.string(),
});
const credentialsSchema = z.array(credentialEntrySchema);

export async function updateClientCredentials(
  clientId: string,
  credentials: unknown,
): Promise<ActionResult<{ id: string }>> {
  if (!clientId) return { ok: false, error: 'Client id required' };

  const parsed = credentialsSchema.safeParse(credentials);
  if (!parsed.success) {
    return { ok: false, error: 'Invalid credentials shape' };
  }

  const session  = await requireSession();
  const ownerId  = getOwnerId(session);
  const supabase = await createClient();

  const { error } = await supabase
    .from('clients')
    .update({ credentials: parsed.data as unknown as Json })
    .eq('id', clientId)
    .eq('user_id', ownerId);

  if (error) return { ok: false, error: error.message };
  revalidatePath('/dashboard/personal/clients');
  revalidatePath('/dashboard/agency/clients');
  return { ok: true, data: { id: clientId } };
}

// ─── UPDATE (edit modal) ──────────────────────────────────────
// Partial update of editable identity fields. Stage and credentials
// have their own dedicated actions because they have per-site UX logic
// (stage appends history; credentials validates array shape).

const clientUpdateSchema = clientCreateSchema.pick({
  name: true,
  company: true,
  contact_name: true,
  contact_email: true,
  contact_phone: true,
  preferred_channel: true,
  service_type: true,
}).partial();
export type ClientUpdateInput = z.infer<typeof clientUpdateSchema>;

export async function updateClientRecord(
  clientId: string,
  input: ClientUpdateInput,
): Promise<ActionResult<Client>> {
  if (!clientId) return { ok: false, error: 'Client id required' };

  const parsed = clientUpdateSchema.safeParse(input);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join('; ');
    return { ok: false, error: msg };
  }

  const session  = await requireSession();
  const ownerId  = getOwnerId(session);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('clients')
    .update(parsed.data)
    .eq('id', clientId)
    .eq('user_id', ownerId)
    .select()
    .single();

  if (error) return { ok: false, error: error.message };
  revalidatePath('/dashboard/personal/clients');
  revalidatePath('/dashboard/agency/clients');
  return { ok: true, data: data as unknown as Client };
}

// ─── DELETE ────────────────────────────────────────────────────

export async function deleteClientRecord(
  clientId: string,
): Promise<ActionResult<{ id: string }>> {
  if (!clientId) return { ok: false, error: 'Client id required' };

  const session  = await requireSession();
  const ownerId  = getOwnerId(session);
  const supabase = await createClient();

  const { error } = await supabase
    .from('clients')
    .delete()
    .eq('id', clientId)
    .eq('user_id', ownerId);

  if (error) return { ok: false, error: error.message };
  revalidatePath('/dashboard/personal/clients');
  revalidatePath('/dashboard/agency/clients');
  return { ok: true, data: { id: clientId } };
}
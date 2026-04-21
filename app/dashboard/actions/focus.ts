'use server';
// ============================================================
// Business OS — Focus Server Actions
//
// Covers the "Today's Focus" widget on home:
//   1. priorities — daily 3-priorities list
//   2. time_blocks — schedule (deep / outreach / admin / personal)
//
// Both are day-scoped (by `date` column) and fully owner-private. The
// widget appears on both personal and agency home — the action file
// serves both, picking up `mode` at the call site.
//
// Canonical pattern — see subscriptions.ts for rationale.
// ============================================================

import { z } from 'zod';
import { requireSession, getOwnerId } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { prioritySchema, timeBlockSchema } from '@/types/schemas';
import { revalidatePath } from 'next/cache';
import type { Priority, TimeBlock } from '@/types';
import type { ActionResult } from './subscriptions';

function revalidateHome(): void {
  revalidatePath('/dashboard/personal/home');
  revalidatePath('/dashboard/agency/home');
}

// ════════════════════════════════════════════════════════════════
// PRIORITIES
// ════════════════════════════════════════════════════════════════

// Use z.input so the defaulted sort_order can be omitted at call sites.
export type PriorityCreateInput = z.input<typeof prioritySchema>;

export async function createPriority(
  input: PriorityCreateInput,
): Promise<ActionResult<Priority>> {
  const parsed = prioritySchema.safeParse(input);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join('; ');
    return { ok: false, error: msg };
  }

  const session  = await requireSession();
  const ownerId  = getOwnerId(session);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('priorities')
    .insert({
      ...parsed.data,
      user_id: ownerId,
    })
    .select()
    .single();

  if (error) return { ok: false, error: error.message };
  revalidateHome();
  return { ok: true, data: data as unknown as Priority };
}

// Toggle is a dedicated action instead of a general update because it's
// the only priority mutation the UI exposes, and keeping it as a single
// boolean flip removes any risk of a client overwriting other fields.

export async function togglePriority(
  id: string,
  completed: boolean,
): Promise<ActionResult<{ id: string; completed: boolean }>> {
  if (!id) return { ok: false, error: 'Priority id required' };

  const session  = await requireSession();
  const ownerId  = getOwnerId(session);
  const supabase = await createClient();

  const { error } = await supabase
    .from('priorities')
    .update({ completed })
    .eq('id', id)
    .eq('user_id', ownerId);

  if (error) return { ok: false, error: error.message };
  revalidateHome();
  return { ok: true, data: { id, completed } };
}

export async function deletePriority(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  if (!id) return { ok: false, error: 'Priority id required' };

  const session  = await requireSession();
  const ownerId  = getOwnerId(session);
  const supabase = await createClient();

  const { error } = await supabase
    .from('priorities')
    .delete()
    .eq('id', id)
    .eq('user_id', ownerId);

  if (error) return { ok: false, error: error.message };
  revalidateHome();
  return { ok: true, data: { id } };
}

// ════════════════════════════════════════════════════════════════
// TIME BLOCKS
// ════════════════════════════════════════════════════════════════

export type TimeBlockCreateInput = z.input<typeof timeBlockSchema>;

export async function createTimeBlock(
  input: TimeBlockCreateInput,
): Promise<ActionResult<TimeBlock>> {
  const parsed = timeBlockSchema.safeParse(input);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join('; ');
    return { ok: false, error: msg };
  }

  const session  = await requireSession();
  const ownerId  = getOwnerId(session);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('time_blocks')
    .insert({
      ...parsed.data,
      user_id: ownerId,
    })
    .select()
    .single();

  if (error) return { ok: false, error: error.message };
  revalidateHome();
  return { ok: true, data: data as unknown as TimeBlock };
}

export async function deleteTimeBlock(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  if (!id) return { ok: false, error: 'Time block id required' };

  const session  = await requireSession();
  const ownerId  = getOwnerId(session);
  const supabase = await createClient();

  const { error } = await supabase
    .from('time_blocks')
    .delete()
    .eq('id', id)
    .eq('user_id', ownerId);

  if (error) return { ok: false, error: error.message };
  revalidateHome();
  return { ok: true, data: { id } };
}

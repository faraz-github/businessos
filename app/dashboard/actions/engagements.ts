'use server';
// ============================================================
// Business OS — Engagements Server Actions
//
// Two tables that share the client-engagement theme:
//   1. support_periods — post-handover support tracking
//   2. testimonials    — client feedback + portfolio material
//
// Grouped in one file because neither has enough surface to warrant
// its own module and the schemas are parallel.
//
// Canonical pattern — see subscriptions.ts for the rationale.
// ============================================================

import { z } from 'zod';
import { requireSession, getOwnerId } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { supportPeriodSchema, testimonialSchema } from '@/types/schemas';
import { revalidatePath } from 'next/cache';
import type { ActionResult } from './subscriptions';

// ════════════════════════════════════════════════════════════════
// SUPPORT PERIODS
// ════════════════════════════════════════════════════════════════
// The returned row is shaped `SupportPeriod & { clients: {...} }` because
// the page always renders the client name alongside the period — the
// select(...) with embedded client data keeps the UI flow unchanged.

function revalidateSupport(): void {
  revalidatePath('/dashboard/personal/support');
  revalidatePath('/dashboard/agency/support');
}

export async function createSupportPeriod(
  input: z.infer<typeof supportPeriodSchema>,
): Promise<ActionResult<Record<string, unknown>>> {
  const parsed = supportPeriodSchema.safeParse(input);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join('; ');
    return { ok: false, error: msg };
  }

  const session  = await requireSession();
  const ownerId  = getOwnerId(session);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('support_periods')
    .insert({
      ...parsed.data,
      user_id: ownerId,
    })
    .select('*, clients(name, contact_email, contact_phone)')
    .single();

  if (error) return { ok: false, error: error.message };
  revalidateSupport();
  return { ok: true, data: data as unknown as Record<string, unknown> };
}

// The update omits mode + client_id — support periods shouldn't change
// clients or modes post-creation; those are part of the row's identity.
const supportPeriodUpdateSchema = supportPeriodSchema.pick({
  start_date: true,
  end_date: true,
  notes: true,
  client_id: true, // editable because the modal allows client re-assignment
}).partial();
export type SupportPeriodUpdateInput = z.infer<typeof supportPeriodUpdateSchema>;

export async function updateSupportPeriod(
  id: string,
  input: SupportPeriodUpdateInput,
): Promise<ActionResult<Record<string, unknown>>> {
  if (!id) return { ok: false, error: 'Support period id required' };

  const parsed = supportPeriodUpdateSchema.safeParse(input);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join('; ');
    return { ok: false, error: msg };
  }

  const session  = await requireSession();
  const ownerId  = getOwnerId(session);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('support_periods')
    .update(parsed.data)
    .eq('id', id)
    .eq('user_id', ownerId)
    .select('*, clients(name, contact_email, contact_phone)')
    .single();

  if (error) return { ok: false, error: error.message };
  revalidateSupport();
  return { ok: true, data: data as unknown as Record<string, unknown> };
}

export async function deleteSupportPeriod(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  if (!id) return { ok: false, error: 'Support period id required' };

  const session  = await requireSession();
  const ownerId  = getOwnerId(session);
  const supabase = await createClient();

  const { error } = await supabase
    .from('support_periods')
    .delete()
    .eq('id', id)
    .eq('user_id', ownerId);

  if (error) return { ok: false, error: error.message };
  revalidateSupport();
  return { ok: true, data: { id } };
}

// ════════════════════════════════════════════════════════════════
// TESTIMONIALS
// ════════════════════════════════════════════════════════════════

function revalidateFeedback(): void {
  revalidatePath('/dashboard/personal/feedback');
  revalidatePath('/dashboard/agency/feedback');
}

// Use z.input so the defaulted source + portfolio_usable + received_at
// can be omitted at the call site.
export type TestimonialCreateInput = z.input<typeof testimonialSchema>;

export async function createTestimonial(
  input: TestimonialCreateInput,
): Promise<ActionResult<Record<string, unknown>>> {
  const parsed = testimonialSchema.safeParse(input);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join('; ');
    return { ok: false, error: msg };
  }

  const session  = await requireSession();
  const ownerId  = getOwnerId(session);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('testimonials')
    .insert({
      ...parsed.data,
      user_id: ownerId,
    })
    .select('*, clients(name)')
    .single();

  if (error) return { ok: false, error: error.message };
  revalidateFeedback();
  return { ok: true, data: data as unknown as Record<string, unknown> };
}

const testimonialUpdateSchema = testimonialSchema.pick({
  client_id: true,
  content: true,
  source: true,
  portfolio_usable: true,
  received_at: true,
}).partial();
export type TestimonialUpdateInput = z.infer<typeof testimonialUpdateSchema>;

export async function updateTestimonial(
  id: string,
  input: TestimonialUpdateInput,
): Promise<ActionResult<Record<string, unknown>>> {
  if (!id) return { ok: false, error: 'Testimonial id required' };

  const parsed = testimonialUpdateSchema.safeParse(input);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join('; ');
    return { ok: false, error: msg };
  }

  const session  = await requireSession();
  const ownerId  = getOwnerId(session);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('testimonials')
    .update(parsed.data)
    .eq('id', id)
    .eq('user_id', ownerId)
    .select('*, clients(name)')
    .single();

  if (error) return { ok: false, error: error.message };
  revalidateFeedback();
  return { ok: true, data: data as unknown as Record<string, unknown> };
}

export async function deleteTestimonial(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  if (!id) return { ok: false, error: 'Testimonial id required' };

  const session  = await requireSession();
  const ownerId  = getOwnerId(session);
  const supabase = await createClient();

  const { error } = await supabase
    .from('testimonials')
    .delete()
    .eq('id', id)
    .eq('user_id', ownerId);

  if (error) return { ok: false, error: error.message };
  revalidateFeedback();
  return { ok: true, data: { id } };
}

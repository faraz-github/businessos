'use server';
// ============================================================
// Business OS — Subscriptions Server Actions
//
// This file is the canonical pattern for every server action file
// in /app/dashboard/actions/. Copy the shape when adding more.
//
// Pattern (why each piece exists)
// -------------------------------
// 1. `'use server'` pragma at the top — makes every export callable
//    from a client component via async function invocation. The
//    function body runs only on the server; the service-role key
//    never ships to the browser.
//
// 2. `requireSession()` — throws if not authenticated. Server Actions
//    don't get the proxy.ts middleware gating that route handlers do,
//    so we re-verify here. Every action must start with this.
//
// 3. `getOwnerId(session)` — resolves to the superadmin who owns the
//    data (for admin users, their boss; for superadmins, themselves).
//    NEVER use session.sub for data queries — an admin user would
//    then query with their own id and get empty results.
//
// 4. Zod validation with `.safeParse()` — every input from the client
//    passes through the schema before touching the database. Bad data
//    returns a typed error to the caller instead of a 500.
//
// 5. Ownership check on update/delete — `.eq('user_id', ownerId)` on
//    every mutation, even for actions that identify rows by `id`. A
//    compromised client can't update someone else's subscription by
//    guessing an id — the query returns 0 rows.
//
// 6. Typed return shape — every action returns either
//    `{ ok: true; data: T }` or `{ ok: false; error: string }`.
//    Callers get a discriminated union to narrow on.
//
// 7. `revalidatePath()` for any route that shows this data — after
//    mutations, the server-rendered version gets refreshed.
// ============================================================

import { z } from 'zod';
import { requireSession, getOwnerId } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { subscriptionSchema, type SubscriptionFormData } from '@/types/schemas';
import { revalidatePath } from 'next/cache';
import type { Subscription } from '@/types';

/**
 * Discriminated union returned by every mutation action. Clients narrow
 * on `.ok` to access either `.data` (success) or `.error` (failure).
 */
export type ActionResult<T> =
  | { ok: true;  data: T }
  | { ok: false; error: string };

// ─── READ ──────────────────────────────────────────────────────

export async function listSubscriptions(
  mode: 'personal' | 'agency',
): Promise<Subscription[]> {
  const session  = await requireSession();
  const ownerId  = getOwnerId(session);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', ownerId)
    .eq('mode', mode)
    .order('next_renewal_at');

  if (error) throw new Error(`Failed to load subscriptions: ${error.message}`);
  return (data ?? []) as unknown as Subscription[];
}

// ─── CREATE ────────────────────────────────────────────────────

export async function createSubscription(
  input: SubscriptionFormData,
): Promise<ActionResult<Subscription>> {
  const parsed = subscriptionSchema.safeParse(input);
  if (!parsed.success) {
    // Flatten the Zod issues into a single user-facing message — the UI
    // can show this in a toast without needing to know the schema shape.
    const msg = parsed.error.issues.map((i) => i.message).join('; ');
    return { ok: false, error: msg };
  }

  const session  = await requireSession();
  const ownerId  = getOwnerId(session);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('subscriptions')
    .insert({
      ...parsed.data,
      user_id: ownerId,
      last_reviewed_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) return { ok: false, error: error.message };
  revalidatePath('/dashboard/personal/finance');
  revalidatePath('/dashboard/agency/finance');
  return { ok: true, data: data as unknown as Subscription };
}

// ─── UPDATE ────────────────────────────────────────────────────

// Partial-update schema — only a subset of fields are editable post-creation.
// Excluded: user_id (immutable), status (use toggleSubscriptionStatus),
// auto_pay (separate action in future). Explicit > derived so the API
// surface is obvious at the call site.
const subscriptionUpdateSchema = subscriptionSchema.pick({
  name: true,
  category: true,
  cost: true,
  billing_cycle: true,
  next_renewal_at: true,
}).partial();
export type SubscriptionUpdateData = z.infer<typeof subscriptionUpdateSchema>;

export async function updateSubscription(
  id: string,
  input: SubscriptionUpdateData,
): Promise<ActionResult<Subscription>> {
  if (!id) return { ok: false, error: 'Subscription id required' };

  const parsed = subscriptionUpdateSchema.safeParse(input);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join('; ');
    return { ok: false, error: msg };
  }

  const session  = await requireSession();
  const ownerId  = getOwnerId(session);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('subscriptions')
    .update({
      ...parsed.data,
      last_reviewed_at: new Date().toISOString(),
    })
    // Ownership check — even though `id` uniquely identifies the row,
    // filtering by user_id means a compromised client can't pass another
    // owner's id and silently modify their data.
    .eq('id', id)
    .eq('user_id', ownerId)
    .select()
    .single();

  if (error) return { ok: false, error: error.message };
  revalidatePath('/dashboard/personal/finance');
  revalidatePath('/dashboard/agency/finance');
  return { ok: true, data: data as unknown as Subscription };
}

// ─── STATUS TOGGLE ─────────────────────────────────────────────
// Dedicated action because it's a frequent one-click operation. Splitting
// it from updateSubscription means the UI can show a loading spinner on
// just the toggle without re-rendering the entire edit form.

export async function toggleSubscriptionStatus(
  id: string,
  next: 'active' | 'paused' | 'cancelled',
): Promise<ActionResult<Subscription>> {
  if (!id) return { ok: false, error: 'Subscription id required' };
  if (!['active', 'paused', 'cancelled'].includes(next)) {
    return { ok: false, error: 'Invalid status' };
  }

  const session  = await requireSession();
  const ownerId  = getOwnerId(session);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('subscriptions')
    .update({ status: next })
    .eq('id', id)
    .eq('user_id', ownerId)
    .select()
    .single();

  if (error) return { ok: false, error: error.message };
  revalidatePath('/dashboard/personal/finance');
  revalidatePath('/dashboard/agency/finance');
  return { ok: true, data: data as unknown as Subscription };
}

// ─── MARK REVIEWED ─────────────────────────────────────────────
// Used by the "zombie subscription" flow — updates last_reviewed_at
// without changing any other field so the 90-day stale check resets.

export async function markSubscriptionReviewed(
  id: string,
): Promise<ActionResult<Subscription>> {
  if (!id) return { ok: false, error: 'Subscription id required' };

  const session  = await requireSession();
  const ownerId  = getOwnerId(session);
  const supabase = await createClient();

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('subscriptions')
    .update({ last_reviewed_at: now })
    .eq('id', id)
    .eq('user_id', ownerId)
    .select()
    .single();

  if (error) return { ok: false, error: error.message };
  revalidatePath('/dashboard/personal/finance');
  revalidatePath('/dashboard/agency/finance');
  return { ok: true, data: data as unknown as Subscription };
}

// ─── DELETE ────────────────────────────────────────────────────

export async function deleteSubscription(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  if (!id) return { ok: false, error: 'Subscription id required' };

  const session  = await requireSession();
  const ownerId  = getOwnerId(session);
  const supabase = await createClient();

  const { error } = await supabase
    .from('subscriptions')
    .delete()
    .eq('id', id)
    .eq('user_id', ownerId);

  if (error) return { ok: false, error: error.message };
  revalidatePath('/dashboard/personal/finance');
  revalidatePath('/dashboard/agency/finance');
  return { ok: true, data: { id } };
}

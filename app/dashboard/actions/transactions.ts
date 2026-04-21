'use server';
// ============================================================
// Business OS — Transactions + Invoice Status Server Actions
//
// Two adjacent concerns on the finance page:
//   1. Transactions — income/expense rows in the transactions table
//   2. Invoice status — invoices are stored as `documents` rows with
//      type='invoice'. Marking paid writes BOTH the document status
//      and a matching income transaction. That compound operation is
//      atomic-ish (two separate calls, but logical unit) so it lives
//      together as `markInvoicePaidAction`.
//
// Follows the canonical pattern from subscriptions.ts — see that file
// for the long-form pattern explanation.
// ============================================================

import { z } from 'zod';
import { requireSession, getOwnerId } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { transactionSchema, type TransactionFormData } from '@/types/schemas';
import { revalidatePath } from 'next/cache';
import type { Transaction } from '@/types';
import type { Json } from '@/types/database';
import type { ActionResult } from './subscriptions';

// ─── TRANSACTIONS: CREATE ──────────────────────────────────────

export async function createTransaction(
  input: TransactionFormData,
): Promise<ActionResult<Transaction>> {
  const parsed = transactionSchema.safeParse(input);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join('; ');
    return { ok: false, error: msg };
  }

  const session  = await requireSession();
  const ownerId  = getOwnerId(session);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('transactions')
    .insert({
      ...parsed.data,
      user_id: ownerId,
    })
    .select()
    .single();

  if (error) return { ok: false, error: error.message };
  revalidatePath('/dashboard/personal/finance');
  revalidatePath('/dashboard/agency/finance');
  return { ok: true, data: data as unknown as Transaction };
}

// ─── TRANSACTIONS: DELETE ──────────────────────────────────────

export async function deleteTransaction(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  if (!id) return { ok: false, error: 'Transaction id required' };

  const session  = await requireSession();
  const ownerId  = getOwnerId(session);
  const supabase = await createClient();

  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', id)
    .eq('user_id', ownerId);

  if (error) return { ok: false, error: error.message };
  revalidatePath('/dashboard/personal/finance');
  revalidatePath('/dashboard/agency/finance');
  return { ok: true, data: { id } };
}

// ─── INVOICE DOCUMENTS: DELETE ─────────────────────────────────
// Invoices are `documents` rows with type='invoice'. This action
// deletes one — scoped to user_id + type='invoice' to prevent a
// crafted request from deleting other document types by id.

export async function deleteInvoiceDocument(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  if (!id) return { ok: false, error: 'Invoice id required' };

  const session  = await requireSession();
  const ownerId  = getOwnerId(session);
  const supabase = await createClient();

  const { error } = await supabase
    .from('documents')
    .delete()
    .eq('id', id)
    .eq('user_id', ownerId)
    .eq('type', 'invoice');

  if (error) return { ok: false, error: error.message };
  revalidatePath('/dashboard/personal/finance');
  revalidatePath('/dashboard/agency/finance');
  return { ok: true, data: { id } };
}

// ─── INVOICE STATUS: MARK PAID ─────────────────────────────────
// Compound operation:
//   1. Update the document to status='paid' and record paid_at inside
//      the `fields` JSON blob (keeps backward compat with existing fields).
//   2. Insert a matching income transaction row so the revenue/sparkline
//      stats update automatically.
//
// Failure modes handled explicitly:
//   - doc update fails → return error, no transaction inserted
//   - doc update ok, transaction insert fails → return warning with the
//     transaction error so the user can retry logging it manually
// The sequence is NOT a real DB transaction (Supabase JS client can't
// span those), but the ordering means we never create a dangling income
// row without the document being marked paid.

const markInvoicePaidInputSchema = z.object({
  id: z.string().uuid(),
  mode: z.enum(['personal', 'agency']),
  amount: z.number().min(0),
  // Opaque fields JSON from the current invoice — we merge paid_at + paid_date
  // in and write back so we don't stomp other fields.
  fields: z.record(z.unknown()).default({}),
  // Optional display text used in the transaction's description.
  invoiceNumber: z.string().default(''),
  clientName: z.string().nullable().optional(),
  /**
   * Income category to bucket the auto-logged transaction into. Defaults
   * to 'project_payment' — matches the historical behaviour before this
   * parameter existed — but can be overridden per-invoice (e.g. a
   * final-payment invoice should log as 'final_payment', a retainer
   * invoice as 'retainer'). Kept as plain string because the category
   * list lives in the UI, not in a DB enum.
   */
  category: z.string().default('project_payment'),
  /**
   * Date the payment was actually received (YYYY-MM-DD). Step 4 wires
   * this up through a mark-paid modal; before step 4, it defaults to
   * today. When set, the auto-logged income transaction is dated
   * `paid_date` (not today) so backdated payments land in the correct
   * month's stats.
   */
  paid_date: z.string().optional(),
});
export type MarkInvoicePaidInput = z.infer<typeof markInvoicePaidInputSchema>;

export async function markInvoicePaidAction(
  input: MarkInvoicePaidInput,
): Promise<ActionResult<{ id: string; paid_at: string; paid_date: string }>> {
  const parsed = markInvoicePaidInputSchema.safeParse(input);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join('; ');
    return { ok: false, error: msg };
  }

  const session  = await requireSession();
  const ownerId  = getOwnerId(session);
  const supabase = await createClient();

  const now       = new Date().toISOString();
  const today     = now.split('T')[0];
  const paidDate  = parsed.data.paid_date ?? today;
  const updatedFields = {
    ...parsed.data.fields,
    paid_at:   now,       // server timestamp — when the button was clicked
    paid_date: paidDate,  // business fact — when payment was received
  };

  // 1. Update the invoice document
  const { error: docErr } = await supabase
    .from('documents')
    .update({
      status: 'paid',
      fields: updatedFields as unknown as Json,
    })
    .eq('id', parsed.data.id)
    .eq('user_id', ownerId)
    .eq('type', 'invoice');

  if (docErr) {
    return { ok: false, error: `Failed to mark invoice paid: ${docErr.message}` };
  }

  // 2. Insert matching income transaction. Non-fatal on failure — the
  //    invoice is already marked paid; we just couldn't log the income row.
  //
  //    - `invoice_id`: links the transaction back to the document so
  //      AddTransactionModal can warn about dupes when the user later
  //      tries to log the same payment manually.
  //    - `date`: paid_date, NOT today — keeps month-bucketed stats
  //      accurate for backdated payments.
  //    - `category`: caller's choice (default project_payment).
  const description = parsed.data.invoiceNumber
    ? `Invoice ${parsed.data.invoiceNumber}${parsed.data.clientName ? ` — ${parsed.data.clientName}` : ''}`
    : `Invoice payment${parsed.data.clientName ? ` — ${parsed.data.clientName}` : ''}`;

  const { error: txErr } = await supabase
    .from('transactions')
    .insert({
      user_id:     ownerId,
      mode:        parsed.data.mode,
      type:        'income',
      category:    parsed.data.category,
      amount:      parsed.data.amount,
      description,
      date:        paidDate,
      invoice_id:  parsed.data.id,
    });

  revalidatePath('/dashboard/personal/finance');
  revalidatePath('/dashboard/agency/finance');

  if (txErr) {
    return {
      ok:    false,
      error: `Invoice marked paid, but failed to log income transaction: ${txErr.message}`,
    };
  }

  return { ok: true, data: { id: parsed.data.id, paid_at: now, paid_date: paidDate } };
}

// ─── INVOICE: LOG ALREADY-PAID (backdated) ─────────────────────
// Creates an invoice document in `paid` status with a matching income
// transaction in one step. Use case: "I got paid last week for work
// I never formally invoiced through the system — let me log both at
// once." The invoice document gets minimal content (no line items,
// no payment terms) — it's a record-keeping row, not something the
// owner is going to send to the client.
//
// Differences from the flow of (createDocument → markInvoicePaidAction):
//   - Single server round-trip
//   - No draft state — goes straight to paid
//   - No share_token generated (the invoice isn't being sent)
//   - Caller doesn't have to orchestrate two calls and handle a
//     half-applied state on failure

const createPaidInvoiceSchema = z.object({
  mode:           z.enum(['personal', 'agency']),
  client_id:      z.string().uuid().nullable().optional(),
  client_name:    z.string().min(1, 'Client name required'),
  invoice_number: z.string().min(1, 'Invoice number required'),
  total:          z.number().min(0.01, 'Total must be greater than 0'),
  invoice_date:   z.string().min(1, 'Invoice date required'),
  paid_date:      z.string().min(1, 'Paid date required'),
  category:       z.string().default('project_payment'),
  description:    z.string().nullable().optional(),
});
export type CreatePaidInvoiceInput = z.infer<typeof createPaidInvoiceSchema>;

export async function createPaidInvoiceAction(
  input: CreatePaidInvoiceInput,
): Promise<ActionResult<{ id: string; paid_date: string }>> {
  const parsed = createPaidInvoiceSchema.safeParse(input);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join('; ');
    return { ok: false, error: msg };
  }

  const session  = await requireSession();
  const ownerId  = getOwnerId(session);
  const supabase = await createClient();

  const nowIso = new Date().toISOString();
  const fields = {
    invoice_number: parsed.data.invoice_number,
    client_name:    parsed.data.client_name,
    invoice_date:   parsed.data.invoice_date,
    // No due_date — if it was already paid on creation, the concept
    // of "due date" is retroactive. Leaving undefined keeps the
    // overdue-derivation check (due_date < today) from false-flagging.
    total:          parsed.data.total,
    paid_date:      parsed.data.paid_date,
    paid_at:        nowIso,
    // Marker so the UI can distinguish "logged after the fact"
    // invoices from real ones. Not used for anything consequential;
    // purely informational.
    logged_as_paid: true,
  };

  // 1. Create the invoice document in paid status
  const { data: doc, error: docErr } = await supabase
    .from('documents')
    .insert({
      user_id:   ownerId,
      mode:      parsed.data.mode,
      type:      'invoice',
      client_id: parsed.data.client_id ?? null,
      title:     parsed.data.invoice_number,
      fields:    fields as unknown as Json,
      status:    'paid',
    })
    .select('id')
    .single();

  if (docErr || !doc) {
    return { ok: false, error: `Failed to create invoice: ${docErr?.message ?? 'unknown error'}` };
  }

  // 2. Insert matching income transaction on paid_date
  const description = parsed.data.description?.trim()
    || `Invoice ${parsed.data.invoice_number} — ${parsed.data.client_name}`;

  const { error: txErr } = await supabase
    .from('transactions')
    .insert({
      user_id:     ownerId,
      mode:        parsed.data.mode,
      type:        'income',
      category:    parsed.data.category,
      amount:      parsed.data.total,
      description,
      date:        parsed.data.paid_date,
      invoice_id:  doc.id,
    });

  revalidatePath('/dashboard/personal/finance');
  revalidatePath('/dashboard/agency/finance');
  revalidatePath('/dashboard/personal/paperwork');
  revalidatePath('/dashboard/agency/paperwork');

  if (txErr) {
    // Partial success. The invoice exists and is marked paid; the
    // transaction log failed. Flag clearly — the user can retry by
    // deleting and re-creating, or manually log the transaction.
    return {
      ok:    false,
      error: `Invoice created as paid, but failed to log income transaction: ${txErr.message}`,
    };
  }

  return { ok: true, data: { id: doc.id, paid_date: parsed.data.paid_date } };
}

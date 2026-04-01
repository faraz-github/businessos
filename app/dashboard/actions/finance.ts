'use server';

import { getSession } from '@/lib/auth';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type { Mode, InvoiceStatus } from '@/types';
import type { InvoiceFormData, TransactionFormData, SubscriptionFormData } from '@/types/schemas';

// ─── INVOICES ───

export async function getInvoices(mode: Mode) {
  const supabase = await createClient();
  const session = await getSession(); const user = session ? { id: session.sub } : null;
  if (!user) return [];

  const { data, error } = await supabase
    .from('invoices')
    .select('*, clients(name, company)')
    .eq('user_id', user.id)
    .eq('mode', mode)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function createInvoice(formData: InvoiceFormData) {
  const supabase = await createClient();
  const session = await getSession(); const user = session ? { id: session.sub } : null;
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('invoices')
    .insert({ ...formData, user_id: user.id })
    .select()
    .single();

  if (error) throw error;
  revalidatePath('/dashboard');
  return data;
}

export async function updateInvoiceStatus(id: string, status: InvoiceStatus) {
  const supabase = await createClient();

  const updates: any = { status };
  if (status === 'paid') updates.paid_at = new Date().toISOString();

  const { error } = await supabase
    .from('invoices')
    .update(updates)
    .eq('id', id);

  if (error) throw error;
  revalidatePath('/dashboard');
}

// ─── TRANSACTIONS ───

export async function getTransactions(mode: Mode) {
  const supabase = await createClient();
  const session = await getSession(); const user = session ? { id: session.sub } : null;
  if (!user) return [];

  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', user.id)
    .eq('mode', mode)
    .order('date', { ascending: false });

  if (error) throw error;
  return data;
}

export async function createTransaction(formData: TransactionFormData) {
  const supabase = await createClient();
  const session = await getSession(); const user = session ? { id: session.sub } : null;
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('transactions')
    .insert({ ...formData, user_id: user.id })
    .select()
    .single();

  if (error) throw error;
  revalidatePath('/dashboard');
  return data;
}

// ─── SUBSCRIPTIONS ───

export async function getSubscriptions(mode: Mode) {
  const supabase = await createClient();
  const session = await getSession(); const user = session ? { id: session.sub } : null;
  if (!user) return [];

  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', user.id)
    .eq('mode', mode)
    .order('next_renewal_at');

  if (error) throw error;
  return data;
}

export async function createSubscription(formData: SubscriptionFormData) {
  const supabase = await createClient();
  const session = await getSession(); const user = session ? { id: session.sub } : null;
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('subscriptions')
    .insert({ ...formData, user_id: user.id })
    .select()
    .single();

  if (error) throw error;
  revalidatePath('/dashboard');
  return data;
}

export async function updateSubscription(id: string, data: Partial<SubscriptionFormData>) {
  const supabase = await createClient();

  const { error } = await supabase
    .from('subscriptions')
    .update(data)
    .eq('id', id);

  if (error) throw error;
  revalidatePath('/dashboard');
}

// ─── MONTHLY SUMMARY ───

export async function getFinanceSummary(mode: Mode) {
  const supabase = await createClient();
  const session = await getSession(); const user = session ? { id: session.sub } : null;
  if (!user) return null;

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

  const { data: monthTx } = await supabase
    .from('transactions')
    .select('type, amount')
    .eq('user_id', user.id)
    .eq('mode', mode)
    .gte('date', startOfMonth);

  const income = monthTx?.filter((t) => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0) || 0;
  const expense = monthTx?.filter((t) => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0) || 0;

  const { data: activeSubs } = await supabase
    .from('subscriptions')
    .select('cost, billing_cycle')
    .eq('user_id', user.id)
    .eq('mode', mode)
    .eq('status', 'active');

  const monthlyBurn = activeSubs?.reduce((s, sub) => {
    return s + (sub.billing_cycle === 'annual' ? Number(sub.cost) / 12 : Number(sub.cost));
  }, 0) || 0;

  return { income, expense, net: income - expense, monthlyBurn };
}

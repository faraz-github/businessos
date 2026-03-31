'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type { Mode, LeadStage } from '@/types';
import type { LeadFormData } from '@/types/schemas';

export async function getLeads(mode: Mode) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .eq('user_id', user.id)
    .eq('mode', mode)
    .order('last_activity_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function createLead(formData: LeadFormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('leads')
    .insert({
      ...formData,
      user_id: user.id,
      notes: [],
      last_activity_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  revalidatePath('/dashboard');
  return data;
}

export async function updateLeadStage(id: string, stage: LeadStage) {
  const supabase = await createClient();

  const { error } = await supabase
    .from('leads')
    .update({
      stage,
      last_activity_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) throw error;
  revalidatePath('/dashboard');
}

export async function addLeadNote(id: string, text: string) {
  const supabase = await createClient();

  const { data: lead } = await supabase
    .from('leads')
    .select('notes')
    .eq('id', id)
    .single();

  const notes = (lead?.notes as any[]) || [];
  notes.push({ text, created_at: new Date().toISOString() });

  const { error } = await supabase
    .from('leads')
    .update({
      notes,
      last_activity_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) throw error;
  revalidatePath('/dashboard');
}

export async function updateLead(id: string, data: Partial<LeadFormData>) {
  const supabase = await createClient();

  const { error } = await supabase
    .from('leads')
    .update({
      ...data,
      last_activity_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) throw error;
  revalidatePath('/dashboard');
}

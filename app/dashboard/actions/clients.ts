'use server';

import { getSession } from '@/lib/auth';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type { Mode, ClientStage } from '@/types';
import type { ClientFormData } from '@/types/schemas';

export async function getClients(mode: Mode) {
  const supabase = await createClient();
  const session = await getSession(); const user = session ? { id: session.sub } : null;
  if (!user) return [];

  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('user_id', user.id)
    .eq('mode', mode)
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function getClient(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function createClientAction(formData: ClientFormData) {
  const supabase = await createClient();
  const session = await getSession(); const user = session ? { id: session.sub } : null;
  if (!user) throw new Error('Not authenticated');

  const stageEntry = {
    stage: 'interested',
    entered_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('clients')
    .insert({
      ...formData,
      user_id: user.id,
      current_stage: 'interested',
      stage_history: [stageEntry],
    })
    .select()
    .single();

  if (error) throw error;
  revalidatePath('/dashboard');
  return data;
}

export async function updateClientAction(id: string, formData: Partial<ClientFormData>) {
  const supabase = await createClient();

  const { error } = await supabase
    .from('clients')
    .update(formData)
    .eq('id', id);

  if (error) throw error;
  revalidatePath('/dashboard');
}

export async function updateClientStage(id: string, newStage: ClientStage) {
  const supabase = await createClient();

  // Get current stage history
  const { data: client } = await supabase
    .from('clients')
    .select('stage_history')
    .eq('id', id)
    .single();

  const history = (client?.stage_history as any[]) || [];
  history.push({ stage: newStage, entered_at: new Date().toISOString() });

  const { error } = await supabase
    .from('clients')
    .update({
      current_stage: newStage,
      stage_history: history,
    })
    .eq('id', id);

  if (error) throw error;
  revalidatePath('/dashboard');
}

export async function updateClientNotes(id: string, notes: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from('clients')
    .update({ notes })
    .eq('id', id);

  if (error) throw error;
  revalidatePath('/dashboard');
}

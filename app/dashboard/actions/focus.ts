'use server';

import { getSession } from '@/lib/auth';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type { Mode } from '@/types';

// ─── PRIORITIES ───

export async function addPriority(mode: Mode, text: string) {
  const supabase = await createClient();
  const session = await getSession(); const user = session ? { id: session.sub } : null;
  if (!user) throw new Error('Not authenticated');

  const today = new Date().toISOString().split('T')[0];

  const { count } = await supabase
    .from('priorities')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('mode', mode)
    .eq('date', today);

  if ((count || 0) >= 3) throw new Error('Maximum 3 priorities per day');

  const { data, error } = await supabase
    .from('priorities')
    .insert({
      user_id: user.id,
      mode,
      date: today,
      text,
      sort_order: (count || 0),
    })
    .select()
    .single();

  if (error) throw error;
  revalidatePath('/dashboard');
  return data;
}

export async function togglePriority(id: string, completed: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('priorities')
    .update({ completed })
    .eq('id', id);
  if (error) throw error;
  revalidatePath('/dashboard');
}

export async function deletePriority(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('priorities').delete().eq('id', id);
  if (error) throw error;
  revalidatePath('/dashboard');
}

// ─── TIME BLOCKS ───

export async function addTimeBlock(
  mode: Mode,
  type: 'deep' | 'outreach' | 'admin' | 'personal',
  startTime: string,
  endTime: string,
  label?: string,
) {
  const supabase = await createClient();
  const session = await getSession(); const user = session ? { id: session.sub } : null;
  if (!user) throw new Error('Not authenticated');

  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('time_blocks')
    .insert({
      user_id: user.id,
      mode,
      date: today,
      type,
      start_time: startTime,
      end_time: endTime,
      label: label || null,
    })
    .select()
    .single();

  if (error) throw error;
  revalidatePath('/dashboard');
  return data;
}

export async function deleteTimeBlock(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('time_blocks').delete().eq('id', id);
  if (error) throw error;
  revalidatePath('/dashboard');
}

// ─── PERSONAL BLOCKERS ───

export async function addBlocker(mode: Mode, text: string) {
  const supabase = await createClient();
  const session = await getSession(); const user = session ? { id: session.sub } : null;
  if (!user) throw new Error('Not authenticated');

  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('personal_blockers')
    .insert({ user_id: user.id, mode, date: today, text })
    .select()
    .single();

  if (error) throw error;
  revalidatePath('/dashboard');
  return data;
}

export async function deleteBlocker(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('personal_blockers').delete().eq('id', id);
  if (error) throw error;
  revalidatePath('/dashboard');
}

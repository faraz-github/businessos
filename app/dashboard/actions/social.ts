'use server';

import { getSession } from '@/lib/auth';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type { Mode } from '@/types';
import type { SocialPostFormData } from '@/types/schemas';

export async function getSocialPosts(mode: Mode, platform?: string) {
  const supabase = await createClient();
  const session = await getSession(); const user = session ? { id: session.sub } : null;
  if (!user) return [];

  let query = supabase
    .from('social_posts')
    .select('*')
    .eq('user_id', user.id)
    .eq('mode', mode)
    .order('planned_date', { ascending: true });

  if (platform) query = query.eq('platform', platform);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function createSocialPost(formData: SocialPostFormData) {
  const supabase = await createClient();
  const session = await getSession(); const user = session ? { id: session.sub } : null;
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('social_posts')
    .insert({ ...formData, user_id: user.id })
    .select()
    .single();

  if (error) throw error;
  revalidatePath('/dashboard');
  return data;
}

export async function updateSocialPost(id: string, data: Partial<SocialPostFormData>) {
  const supabase = await createClient();

  const { error } = await supabase
    .from('social_posts')
    .update(data)
    .eq('id', id);

  if (error) throw error;
  revalidatePath('/dashboard');
}

export async function getProfileReviews(platform: string) {
  const supabase = await createClient();
  const session = await getSession(); const user = session ? { id: session.sub } : null;
  if (!user) return [];

  const { data, error } = await supabase
    .from('profile_reviews')
    .select('*')
    .eq('user_id', user.id)
    .eq('platform', platform)
    .order('section');

  if (error) throw error;
  return data;
}

export async function toggleProfileReview(id: string, completed: boolean) {
  const supabase = await createClient();

  const updates: any = { completed };
  if (completed) {
    updates.last_reviewed_at = new Date().toISOString();
    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + 90);
    updates.next_review_at = nextReview.toISOString();
  }

  const { error } = await supabase
    .from('profile_reviews')
    .update(updates)
    .eq('id', id);

  if (error) throw error;
  revalidatePath('/dashboard');
}

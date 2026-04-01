'use server';

import { getSession } from '@/lib/auth';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type { Mode } from '@/types';
import type { BrandProfileFormData } from '@/types/schemas';

export async function getBrandProfiles() {
  const supabase = await createClient();
  const session = await getSession(); const user = session ? { id: session.sub } : null;
  if (!user) return [];

  const { data, error } = await supabase
    .from('brand_profiles')
    .select('*')
    .eq('user_id', user.id);

  if (error) throw error;
  return data;
}

export async function upsertBrandProfile(formData: BrandProfileFormData) {
  const supabase = await createClient();
  const session = await getSession(); const user = session ? { id: session.sub } : null;
  if (!user) throw new Error('Not authenticated');

  // Check if profile exists
  const { data: existing } = await supabase
    .from('brand_profiles')
    .select('id')
    .eq('user_id', user.id)
    .eq('mode', formData.mode)
    .single();

  if (existing) {
    const { error } = await supabase
      .from('brand_profiles')
      .update({ ...formData, updated_at: new Date().toISOString() })
      .eq('id', existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('brand_profiles')
      .insert({ ...formData, user_id: user.id });
    if (error) throw error;
  }

  revalidatePath('/dashboard');
}

export async function uploadBrandLogo(mode: Mode, file: FormData) {
  const supabase = await createClient();
  const session = await getSession(); const user = session ? { id: session.sub } : null;
  if (!user) throw new Error('Not authenticated');

  const imageFile = file.get('file') as File;
  if (!imageFile) throw new Error('No file provided');

  const ext = imageFile.name.split('.').pop();
  const path = `${user.id}/${mode}-logo.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('brand-logos')
    .upload(path, imageFile, { upsert: true });

  if (uploadError) throw uploadError;

  const { data: { publicUrl } } = supabase.storage
    .from('brand-logos')
    .getPublicUrl(path);

  // Update brand profile with logo URL
  await supabase
    .from('brand_profiles')
    .update({ logo_url: publicUrl })
    .eq('user_id', user.id)
    .eq('mode', mode);

  revalidatePath('/dashboard');
  return publicUrl;
}

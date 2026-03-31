'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { generateShareToken } from '@/lib/utils';
import type { Mode, DocumentType, DocumentStatus } from '@/types';

export async function getDocuments(mode: Mode, type?: DocumentType) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  let query = supabase
    .from('documents')
    .select('*, clients(name, company)')
    .eq('user_id', user.id)
    .eq('mode', mode)
    .order('updated_at', { ascending: false });

  if (type) query = query.eq('type', type);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function getDocument(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('documents')
    .select('*, clients(name, company, contact_email)')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function getDocumentByToken(token: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('share_token', token)
    .single();

  if (error) throw error;
  return data;
}

export async function createDocument(
  mode: Mode,
  type: DocumentType,
  title: string,
  fields: Record<string, unknown>,
  clientId?: string,
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('documents')
    .insert({
      user_id: user.id,
      mode,
      type,
      title,
      fields,
      client_id: clientId || null,
      status: 'draft',
    })
    .select()
    .single();

  if (error) throw error;
  revalidatePath('/dashboard');
  return data;
}

export async function updateDocument(id: string, fields: Record<string, unknown>, title?: string) {
  const supabase = await createClient();

  const updates: any = { fields };
  if (title !== undefined) updates.title = title;

  const { error } = await supabase
    .from('documents')
    .update(updates)
    .eq('id', id);

  if (error) throw error;
  revalidatePath('/dashboard');
}

export async function updateDocumentStatus(id: string, status: DocumentStatus) {
  const supabase = await createClient();

  const updates: any = { status };

  // Generate share token when marking as sent
  if (status === 'sent') {
    const token = generateShareToken();
    updates.share_token = token;
  }

  const { data, error } = await supabase
    .from('documents')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  revalidatePath('/dashboard');
  return data;
}

export async function signDocument(documentId: string, signerName: string, ipAddress?: string) {
  const supabase = await createClient();

  // Insert signature
  const { error: sigError } = await supabase
    .from('signatures')
    .insert({
      document_id: documentId,
      signer_name: signerName,
      ip_address: ipAddress || null,
    });

  if (sigError) throw sigError;

  // Update document
  const { error: docError } = await supabase
    .from('documents')
    .update({
      status: 'signed',
      signed_at: new Date().toISOString(),
      signer_name: signerName,
    })
    .eq('id', documentId);

  if (docError) throw docError;
}

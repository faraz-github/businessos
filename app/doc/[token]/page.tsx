// app/doc/[token]/page.tsx
// Public document viewing route — no auth required.
// Fetches document + brand server-side, strips sensitive fields
// before passing to the client component.
import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { DocumentView } from './document-view';
import type { Document, BrandProfile } from '@/types';

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function PublicDocumentPage(props: PageProps) {
  const params   = await props.params;
  const supabase = await createClient();

  const { data: document, error } = await supabase
    .from('documents')
    .select('*')
    .eq('share_token', params.token)
    .single();

  if (error || !document) notFound();

  const { data: brand } = await supabase
    .from('brand_profiles')
    .select('*')
    .eq('user_id', document.user_id)
    .eq('mode', document.mode)
    .single();

  // Strip access_code + access_code_expires_at before sending to the browser.
  // Verification is handled server-side via POST /api/doc/verify-code.
  // We only send a boolean so the client knows whether to show the gate UI.
  const {
    access_code: _code,
    access_code_expires_at: _exp,
    ...safeDocument
  } = document as Document & { access_code?: string; access_code_expires_at?: string };

  const documentForClient = {
    ...safeDocument,
    has_access_code: Boolean(_code),
  };

  return (
    <DocumentView
      document={documentForClient}
      brand={brand as BrandProfile | null}
    />
  );
}

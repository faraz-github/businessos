import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { DocumentView } from './document-view';

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function PublicDocumentPage(props: PageProps) {
  const params = await props.params;
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

  // Pass document — access code check happens client-side
  // (we never mark viewed until code is verified)
  return <DocumentView document={document} brand={brand} />;
}

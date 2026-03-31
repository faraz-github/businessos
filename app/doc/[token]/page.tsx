import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { DocumentView } from './document-view';

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function PublicDocumentPage(props: PageProps) {
  const params = await props.params;
  const supabase = await createClient();

  // Fetch document by share token (public access via RLS policy)
  const { data: document, error } = await supabase
    .from('documents')
    .select('*')
    .eq('share_token', params.token)
    .single();

  if (error || !document) {
    notFound();
  }

  // Fetch brand profile for the document owner
  const { data: brand } = await supabase
    .from('brand_profiles')
    .select('*')
    .eq('user_id', document.user_id)
    .eq('mode', document.mode)
    .single();

  // Mark as viewed if status is 'sent'
  if (document.status === 'sent') {
    await supabase
      .from('documents')
      .update({ status: 'viewed' })
      .eq('id', document.id);
  }

  return <DocumentView document={document} brand={brand} />;
}

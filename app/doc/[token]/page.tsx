import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { DocumentView } from './document-view';
import { signedUrlFor } from '@/lib/storage/upload';
import { BUCKETS } from '@/lib/storage/constants';
import type { Document, BrandProfile } from '@/types';

interface PageProps {
  params: Promise<{ token: string }>;
}

/**
 * Distinguish a v3.5 storage path from legacy data URLs or public URLs.
 * v3.5 drawn signatures store a bare path inside document-media like
 * "userId/docId/signatures/client-abc.png". Older v3.4 data has the
 * base64 data URL directly. Future brand-assets (saved signatures) are
 * already HTTPS. Only the bare-path case needs signing.
 */
function isStoragePath(data: unknown): data is string {
  return typeof data === 'string'
    && data.length > 0
    && !data.startsWith('data:')
    && !data.startsWith('http://')
    && !data.startsWith('https://');
}

/**
 * Inside `fields`, signature entries live at `client_signature` and
 * `creator_signature`. Each is either null, a typed signature (data =
 * the typed string), or a drawn signature (data = storage path OR
 * legacy base64 data URL). For drawn + storage-path entries, mint a
 * fresh signed URL so the browser can render it without any bucket
 * read permission of its own.
 */
async function resolveSignatureUrls(
  fields: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const resolved = { ...fields };
  for (const key of ['client_signature', 'creator_signature'] as const) {
    const sig = resolved[key];
    if (!sig || typeof sig !== 'object') continue;
    const sigObj = sig as { type?: string; data?: unknown };
    if (sigObj.type !== 'drawn' && sigObj.type !== 'uploaded') continue;  // typed stays as-is
    if (!isStoragePath(sigObj.data)) continue;  // legacy data URLs + public URLs stay as-is
    const signed = await signedUrlFor(BUCKETS.DOCUMENT_MEDIA, sigObj.data);
    if (signed.ok) {
      resolved[key] = { ...sigObj, data: signed.data };
    }
    // If signing fails we leave the path in place — the <img> will
    // 404 visibly, which is the right failure mode (obvious, not
    // silent corruption).
  }
  return resolved;
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

  // Resolve signature storage paths → fresh signed URLs. This must
  // happen server-side because document-media is a private bucket.
  const fieldsWithSignedUrls = await resolveSignatureUrls(
    (document.fields ?? {}) as Record<string, unknown>,
  );

  // Strip access_code and access_code_expires_at before passing to the browser.
  // Verification happens via POST /api/doc/verify-code so the actual code
  // value is never visible in page source, DevTools, or the React tree.
  // The client receives only a `has_access_code` boolean — enough to know
  // whether to render the gate UI.
  const raw = { ...document, fields: fieldsWithSignedUrls } as Document & {
    access_code?: string | null;
    access_code_expires_at?: string | null;
  };
  const hasAccessCode = Boolean(raw.access_code);
  // Explicitly omit the sensitive fields. Don't rely on `delete` — we
  // construct a fresh object so hidden/non-enumerable props can't leak.
  const { access_code: _code, access_code_expires_at: _exp, ...safeDocument } = raw;
  void _code; void _exp; // satisfy no-unused-vars without eslint-disable

  const documentForClient: Document & { has_access_code: boolean } = {
    ...safeDocument,
    has_access_code: hasAccessCode,
  };

  return (
    <DocumentView
      document={documentForClient}
      brand={brand as unknown as BrandProfile | null}
    />
  );
}

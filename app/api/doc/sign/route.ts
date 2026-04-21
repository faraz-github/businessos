// ============================================================
// POST /api/doc/sign
//
// Public endpoint called by the /doc/[token] signing modal. The
// caller is unauthenticated (access-code-protected share link), so
// this route enforces its own auth gate mirroring /api/doc/verify-code:
//
//   1. Look up the document by share_token.
//   2. Re-verify the access_code submitted alongside the signature.
//   3. Refuse if the doc isn't in a sign-able status.
//   4. For drawn signatures: upload the PNG bytes to document-media
//      at {doc.user_id}/{doc.id}/signatures/client-{nanoid}.png and
//      store the STORAGE PATH (not a URL) in signatures.signature_data
//      + documents.fields.client_signature.data.
//      The public /doc/[token] page mints a fresh signed URL per render
//      via signedUrlFor(), so storage stays private.
//   5. For typed signatures: store the typed string as-is. No upload.
//
// Why upload here instead of straight from the browser
// ---------------------------------------------------
// The document-media bucket's RLS only allows authenticated inserts
// scoped to the authed user's folder. The signing caller is anonymous
// — so the upload goes through this server route, which uses the
// service-role client (same pattern as verify-code). The access_code
// check is what prevents random people from writing to that folder.
//
// Request body (JSON):
//   {
//     token:          string    // document.share_token
//     code:           string    // access code (if set)
//     signature_type: 'typed' | 'drawn'
//     signer_name:    string    // displayed on the signature block
//     signed_date:    string    // ISO date the signer selected
//     signature_data: string    // typed: plain text; drawn: base64 PNG data URL
//   }
//
// Response:
//   200  { ok: true, client_signature: { type, data, date, name } }
//   400  { error: 'Invalid request body' }
//   401  { error: 'Incorrect code...' }
//   409  { error: 'Document already signed' | 'Document is not sign-able' }
//
// Returns the `client_signature` shape so the client can update its
// `liveFields` state without re-fetching the document.
// ============================================================

import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  uploadFile,
  signaturePath,
} from '@/lib/storage/upload';
import { BUCKETS } from '@/lib/storage/constants';

/** Statuses from which a document can still be signed. */
const SIGNABLE_STATUSES = new Set(['sent', 'viewed']);

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  // ── Parse + shape-check ────────────────────────────────────────
  const token          = typeof body.token === 'string' ? body.token.trim() : '';
  const code           = typeof body.code  === 'string' ? body.code.trim()  : '';
  const signatureType  = body.signature_type;
  const signerName     = typeof body.signer_name === 'string' ? body.signer_name.trim() : '';
  const signedDate     = typeof body.signed_date === 'string' ? body.signed_date.trim() : '';
  const signatureData  = typeof body.signature_data === 'string' ? body.signature_data : '';

  if (!token)          return NextResponse.json({ error: 'token is required' },          { status: 400 });
  if (!signerName)     return NextResponse.json({ error: 'signer_name is required' },    { status: 400 });
  if (!signedDate)     return NextResponse.json({ error: 'signed_date is required' },    { status: 400 });
  if (!signatureData)  return NextResponse.json({ error: 'signature_data is required' }, { status: 400 });
  if (signatureType !== 'typed' && signatureType !== 'drawn') {
    return NextResponse.json({ error: 'signature_type must be "typed" or "drawn"' }, { status: 400 });
  }

  const supabase = await createClient();

  // ── Fetch the document by share_token ──────────────────────────
  const { data: doc, error: fetchError } = await supabase
    .from('documents')
    .select('id, user_id, type, status, access_code, access_code_expires_at, fields')
    .eq('share_token', token)
    .maybeSingle();

  const GENERIC_401 = { error: 'Incorrect code. Please check and try again.' } as const;

  if (fetchError || !doc) {
    return NextResponse.json(GENERIC_401, { status: 401 });
  }

  // ── Access-code gate (same logic as /api/doc/verify-code) ──────
  if (doc.access_code) {
    if (doc.access_code_expires_at && new Date(doc.access_code_expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'This access code has expired. Ask the sender to regenerate it.' },
        { status: 401 },
      );
    }
    if (!code) {
      return NextResponse.json(GENERIC_401, { status: 401 });
    }
    const submitted = code.toUpperCase();
    const stored    = doc.access_code.trim().toUpperCase();
    if (!constantTimeEqual(submitted, stored)) {
      return NextResponse.json(GENERIC_401, { status: 401 });
    }
  }

  // ── Status gate ────────────────────────────────────────────────
  if (doc.status === 'signed' || doc.status === 'paid') {
    return NextResponse.json(
      { error: 'This document has already been signed.' },
      { status: 409 },
    );
  }
  if (!SIGNABLE_STATUSES.has(doc.status)) {
    return NextResponse.json(
      { error: 'This document cannot be signed in its current state.' },
      { status: 409 },
    );
  }

  // ── Drawn: upload PNG bytes to document-media ─────────────────
  // For typed signatures, `data` stays as the plain text — no upload.
  // For drawn signatures, the client sent a base64 data URL ("data:image/png;base64,…").
  // We extract the bytes, push them to storage, and swap `data` for the storage path.
  let storedData = signatureData;

  if (signatureType === 'drawn') {
    const pngBytes = decodeDataUrlToBytes(signatureData);
    if (!pngBytes) {
      return NextResponse.json(
        { error: 'signature_data must be a valid PNG data URL for drawn signatures' },
        { status: 400 },
      );
    }
    const path = signaturePath(doc.user_id, doc.id, 'client', 'image/png');
    const upload = await uploadFile({
      bucket:      BUCKETS.DOCUMENT_MEDIA,
      path,
      file:        pngBytes,
      contentType: 'image/png',
      upsert:      false,
    });
    if (!upload.ok) {
      return NextResponse.json(
        { error: `Could not store signature: ${upload.error}` },
        { status: 500 },
      );
    }
    // We store the PATH not the URL — the public view signs a fresh
    // URL on each render so signatures don't leak via stale links.
    storedData = path;
  }

  // ── Insert signature row + update document ────────────────────
  const { error: sigInsertError } = await supabase.from('signatures').insert({
    document_id:    doc.id,
    signer_name:    signerName,
    signature_type: signatureType,
    signature_data: storedData,
    signed_date:    signedDate,
  });
  if (sigInsertError) {
    return NextResponse.json(
      { error: `Could not record signature: ${sigInsertError.message}` },
      { status: 500 },
    );
  }

  const clientSignature = {
    type: signatureType,
    data: storedData,
    date: signedDate,
    name: signerName,
  };

  const currentFields = (doc.fields ?? {}) as Record<string, unknown>;
  const updatedFields = { ...currentFields, client_signature: clientSignature };

  const { error: docUpdateError } = await supabase
    .from('documents')
    .update({
      status:      'signed',
      signed_at:   new Date().toISOString(),
      signer_name: signerName,
      fields:      updatedFields,
    })
    .eq('id', doc.id);

  if (docUpdateError) {
    return NextResponse.json(
      { error: `Could not finalize signing: ${docUpdateError.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, client_signature: clientSignature });
}

/**
 * Constant-time string comparison — avoids short-circuit timing leaks
 * on incorrect access codes. Copied from verify-code/route.ts.
 */
function constantTimeEqual(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length);
  let mismatch = a.length === b.length ? 0 : 1;
  for (let i = 0; i < len; i++) {
    mismatch |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return mismatch === 0;
}

/**
 * Decode a `data:image/png;base64,…` URL to raw bytes. Returns null if
 * the input isn't a valid PNG data URL. We restrict to PNG specifically
 * — the client-side canvas calls toDataURL('image/png'), so any other
 * MIME type means a mismatched/tampered payload.
 */
function decodeDataUrlToBytes(dataUrl: string): Uint8Array | null {
  const match = dataUrl.match(/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return null;
  try {
    const binary = Buffer.from(match[1], 'base64');
    return new Uint8Array(binary);
  } catch {
    return null;
  }
}

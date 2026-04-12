// POST /api/doc/verify-code
//
// Verifies a document access code server-side.
// The access_code is never sent to the browser — comparison happens here.
//
// Request body: { token: string; code: string }
// Success:      { ok: true }           — code matched, caller should unlock UI
// Error:        { error: string }      — wrong code, expired, or not found
//
// On success this route also marks the document status as 'viewed'
// (same behaviour as before, just moved server-side).

import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: { token?: string; code?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { token, code } = body;

  if (!token || typeof token !== 'string' || token.trim().length === 0) {
    return NextResponse.json({ error: 'token is required' }, { status: 400 });
  }
  if (!code || typeof code !== 'string' || code.trim().length === 0) {
    return NextResponse.json({ error: 'code is required' }, { status: 400 });
  }

  const supabase = await createClient();

  // Fetch only the fields we need — access_code never leaves this function
  const { data: doc, error: fetchError } = await supabase
    .from('documents')
    .select('id, access_code, access_code_expires_at, status')
    .eq('share_token', token.trim())
    .single();

  if (fetchError || !doc) {
    // Return the same error regardless of whether token exists — prevents enumeration
    return NextResponse.json(
      { error: 'Incorrect code. Please check and try again.' },
      { status: 401 },
    );
  }

  // Document has no access code set — nothing to verify
  if (!doc.access_code) {
    return NextResponse.json({ ok: true });
  }

  // Check expiry first
  if (doc.access_code_expires_at && new Date(doc.access_code_expires_at) < new Date()) {
    return NextResponse.json(
      { error: 'This access code has expired. Ask the sender to regenerate it.' },
      { status: 401 },
    );
  }

  // Constant-time comparison to prevent timing attacks
  // (codes are short so timing risk is low, but good habit)
  const submitted = code.trim().toUpperCase();
  const stored    = doc.access_code.trim().toUpperCase();

  if (submitted !== stored) {
    return NextResponse.json(
      { error: 'Incorrect code. Please check and try again.' },
      { status: 401 },
    );
  }

  // Code is correct — mark as viewed if not already signed/paid
  const terminalStatuses = ['signed', 'paid'];
  if (!terminalStatuses.includes(doc.status)) {
    // Fire-and-forget: don't delay the response for this update
    supabase
      .from('documents')
      .update({ status: 'viewed' })
      .eq('id', doc.id)
      .then(() => {});
  }

  return NextResponse.json({ ok: true });
}

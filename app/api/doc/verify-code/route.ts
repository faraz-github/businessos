// ============================================================
// POST /api/doc/verify-code
//
// Server-side verification of a document access code.
// The access_code value is never sent to the browser — comparison
// happens here, so inspecting page source can't reveal the code.
//
// Request body: { token: string; code: string }
// Success:      { ok: true }
// Error:        { error: string } with 401/400
//
// On success this route also marks the document status as 'viewed'
// (same behaviour as the prior client-side path, moved server-side).
//
// This route is public — document viewers don't authenticate.
// It must be listed in proxy.ts PUBLIC_PREFIXES or requests will 401.
// ============================================================

import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: { token?: unknown; code?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const token = typeof body.token === 'string' ? body.token.trim() : '';
  const code  = typeof body.code  === 'string' ? body.code.trim()  : '';

  if (!token) return NextResponse.json({ error: 'token is required' }, { status: 400 });
  if (!code)  return NextResponse.json({ error: 'code is required'  }, { status: 400 });

  const supabase = await createClient();

  // Fetch only the fields we need. access_code never escapes this function.
  const { data: doc, error: fetchError } = await supabase
    .from('documents')
    .select('id, access_code, access_code_expires_at, status')
    .eq('share_token', token)
    .maybeSingle();

  // Return the same 401 whether the token doesn't exist or the code is wrong.
  // Distinguishing would leak "this token is valid, keep guessing codes".
  const GENERIC_401 = { error: 'Incorrect code. Please check and try again.' } as const;

  if (fetchError || !doc) {
    return NextResponse.json(GENERIC_401, { status: 401 });
  }

  // Document has no access code set — nothing to verify. Still mark viewed.
  if (!doc.access_code) {
    await markViewed(supabase, doc.id, doc.status);
    return NextResponse.json({ ok: true });
  }

  // Expiry check — before comparing, so an expired code returns a specific
  // error rather than a generic "incorrect code". This leak is fine; the
  // recipient is a legitimate holder of the code.
  if (doc.access_code_expires_at && new Date(doc.access_code_expires_at) < new Date()) {
    return NextResponse.json(
      { error: 'This access code has expired. Ask the sender to regenerate it.' },
      { status: 401 },
    );
  }

  // Constant-time comparison. Codes are short (typically 6 chars), so the
  // timing window is tiny, but the alternative `!==` would short-circuit
  // on the first mismatched char — free lunch to close.
  const submitted = code.toUpperCase();
  const stored    = doc.access_code.trim().toUpperCase();

  if (!constantTimeEqual(submitted, stored)) {
    return NextResponse.json(GENERIC_401, { status: 401 });
  }

  await markViewed(supabase, doc.id, doc.status);
  return NextResponse.json({ ok: true });
}

function constantTimeEqual(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length);
  let mismatch = a.length === b.length ? 0 : 1;
  for (let i = 0; i < len; i++) {
    mismatch |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return mismatch === 0;
}

/**
 * Mark a document as viewed if it's not in a terminal status.
 * Fire-and-forget — we don't block the verify response on this.
 */
async function markViewed(
  supabase: Awaited<ReturnType<typeof createClient>>,
  docId: string,
  currentStatus: string,
): Promise<void> {
  const terminalStatuses = ['signed', 'paid'];
  if (terminalStatuses.includes(currentStatus)) return;

  // Non-awaited on purpose — any failure here is non-critical and already
  // logged server-side; the client shouldn't wait for it.
  void supabase
    .from('documents')
    .update({ status: 'viewed' })
    .eq('id', docId)
    .then(({ error }) => {
      if (error) console.warn('[verify-code] markViewed failed:', error.message);
    });
}

import { NextResponse, type NextRequest } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { getSession } from '@/lib/auth/session';

// Service role client — bypasses RLS entirely.
// Auth is already enforced by getSession() above; we filter by user_id manually.
function getAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json([], { status: 401 });

  const mode = new URL(request.url).searchParams.get('mode') || 'personal';

  const { data } = await getAdminClient()
    .from('quick_logs')
    .select('id, content, created_at')
    .eq('user_id', session.sub)
    .eq('mode', mode)
    .order('created_at', { ascending: false })
    .limit(8);

  return NextResponse.json(data || []);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { mode, content } = await request.json();
  if (!content?.trim()) return NextResponse.json({ error: 'Content required' }, { status: 400 });

  const { data, error } = await getAdminClient()
    .from('quick_logs')
    .insert({ user_id: session.sub, mode, type: 'other', content: content.trim() })
    .select('id, content, created_at')
    .single();

  if (error) {
    console.error('[/api/logs POST] Supabase error:', error.code, error.message, error.details);
    return NextResponse.json({ error: error.message, code: error.code }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

  await getAdminClient()
    .from('quick_logs')
    .delete()
    .eq('id', id)
    .eq('user_id', session.sub); // safety: can only delete own logs

  return NextResponse.json({ ok: true });
}

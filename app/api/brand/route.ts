// Authenticated endpoint — returns the current user's brand profiles.
// Used by BrandProvider instead of direct browser Supabase client.
import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { getSession } from '@/lib/auth/session';

function getAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json([], { status: 401 });

  const { data } = await getAdminClient()
    .from('brand_profiles')
    .select('*')
    .eq('user_id', session.sub);

  return NextResponse.json(data || []);
}

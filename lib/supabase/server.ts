// ============================================================
// Business OS — Supabase Server Client (Service Role)
//
// Uses the service role key which BYPASSES RLS entirely.
// Auth is enforced at two levels:
//   1. proxy.ts middleware — JWT verification before every request
//   2. Manual .eq('user_id', session.sub) filters in every query
// ============================================================
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';

export async function createClient() {
  return createSupabaseClient(env.supabaseUrl, env.supabaseServiceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

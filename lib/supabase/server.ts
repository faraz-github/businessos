// ============================================================
// Business OS — Supabase Server Client (Service Role)
//
// Uses the service role key which BYPASSES RLS entirely.
// Auth is enforced at two levels:
//   1. proxy.ts middleware — JWT verification before every request
//   2. Manual .eq('user_id', session.sub) filters in every query
//
// Typed with <Database>: every .insert() / .update() / .select()
// is statically checked against the generated schema types.
// ============================================================
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';
import type { Database } from '@/types/database';

export type TypedSupabaseServerClient = SupabaseClient<Database>;

export async function createClient(): Promise<TypedSupabaseServerClient> {
  return createSupabaseClient<Database>(env.supabaseUrl, env.supabaseServiceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

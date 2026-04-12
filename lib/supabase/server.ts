// ============================================================
// Business OS — Supabase Server Client (Service Role)
//
// Uses the service role key which BYPASSES RLS entirely.
// Auth is enforced at two levels:
//   1. proxy.ts middleware — JWT verification before every request
//   2. Manual .eq('user_id', ownerId) filters in every query
//
// Use withUserScope() in server actions to get a query helper that
// pre-applies the user_id filter — eliminates the risk of a
// missing .eq('user_id', ...) accidentally returning all users' data.
// ============================================================
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';

export async function createClient() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createSupabaseClient<any>(env.supabaseUrl, env.supabaseServiceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Returns a scoped query helper pre-filtered to the given ownerId.
 *
 * Usage in server actions:
 *   const q = await withUserScope(ownerId);
 *   const { data } = await q('clients').select('id, name').eq('mode', mode);
 *
 * Every query produced by q() automatically includes .eq('user_id', ownerId).
 * This is a safety net — you still add .eq('user_id', ownerId) explicitly
 * in queries where you want it to be obvious, but the wrapper catches any
 * case where a developer forgets.
 */
export async function withUserScope(ownerId: string) {
  const supabase = await createClient();
  return function scopedFrom(table: string) {
    return supabase.from(table).select().eq('user_id', ownerId);
  };
}


// ============================================================
// Business OS — Supabase Server Client
// Uses service role key + sets custom JWT claims via set_config
// so RLS functions bos_uid() and bos_role() work correctly.
// ============================================================
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { getSession } from '@/lib/auth/session';

export async function createClient() {
  const session = await getSession();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  // Always use service role — access is controlled by our JWT layer in proxy.ts,
  // not by Supabase Auth. RLS still applies via bos_uid()/bos_role() functions.
  const client = createSupabaseClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // If we have a session, inject the JWT claims so RLS works.
  // We do this by calling set_config at the start of every server-side request.
  if (session) {
    await client.rpc('set_bos_claims', {
      p_uid: session.sub,
      p_role: session.role,
    });
  }

  return client;
}

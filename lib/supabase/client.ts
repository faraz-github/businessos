// ============================================================
// Business OS — Supabase Browser Client
// Used in Client Components for real-time and direct DB reads.
// Auth is handled server-side via JWT — this client uses anon key.
// The server verifies access before the page renders, so client-side
// reads are safe for data that was already gated server-side.
// ============================================================
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

let client: ReturnType<typeof createSupabaseClient> | null = null;

export function createClient() {
  if (!client) {
    client = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
  }
  return client;
}

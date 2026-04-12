// ============================================================
// Business OS — Supabase Browser Client
//
// Single module-level instance shared across all client components.
// This is the correct pattern — GoTrueClient warns when multiple
// instances share the same storage key, which happens if you call
// createClient() more than once per browser tab.
//
// Realtime channel isolation is achieved by using unique channel
// names (e.g. `bd-leads-${mode}`) — not separate client instances.
//
// Components hold a stable reference via: useRef(createClient())
// ============================================================
import 'client-only'; // prevents accidental server-side import of this singleton
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = ReturnType<typeof createSupabaseClient<any>>;

let _client: SupabaseClient | null = null;

export function createClient(): SupabaseClient {
  if (!_client) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _client = createSupabaseClient<any>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
  }
  return _client!;
}

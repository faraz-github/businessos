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
// Typed with <Database>: every .insert() / .update() / .select()
// is statically checked against the generated schema types.
//
// Return type is SupabaseClient<Database> (non-null). The returned
// client is cached; a second call returns the same instance.
// Callers can safely do `useRef(createClient()).current` without
// dealing with `| null`.
// ============================================================
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

let _client: SupabaseClient<Database> | null = null;

export type TypedSupabaseClient = SupabaseClient<Database>;

export function createClient(): TypedSupabaseClient {
  if (!_client) {
    _client = createSupabaseClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
  }
  return _client;
}

import 'server-only';
// ============================================================
// Business OS — Supabase Admin Client (service role)
// Used ONLY in server-side API routes and Server Components.
// Never import this in client components.
//
// We use createClient<any> because bos_users is a custom auth
// table not present in Supabase's generated types. Without this,
// TypeScript infers every mutation on bos_users as type 'never'.
// ============================================================
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let adminClient: ReturnType<typeof createSupabaseClient<any>> | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getSupabaseAdmin(): ReturnType<typeof createSupabaseClient<any>> {
  if (!adminClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    adminClient = createSupabaseClient<any>(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return adminClient;
}

export interface BosUserRow {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  role: 'superadmin' | 'admin';
  allowed_personal: string[] | null;
  allowed_agency: string[] | null;
  is_active: boolean;
  created_by: string | null;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

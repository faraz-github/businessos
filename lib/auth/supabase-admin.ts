import 'server-only';
// ============================================================
// Business OS — Supabase Admin Client (service role)
// Used ONLY in server-side API routes and Server Components.
// Never import this in client components.
// ============================================================
import { createClient } from '@supabase/supabase-js';

let adminClient: ReturnType<typeof createClient> | null = null;

export function getSupabaseAdmin() {
  if (!adminClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
    }
    adminClient = createClient(url, key, {
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

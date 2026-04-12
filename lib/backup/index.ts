// ============================================================
// lib/backup/index.ts — Shared backup/restore utilities
// Server-side only. Never import from client components.
// ============================================================
import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/auth/supabase-admin';
import { verifyPassword } from '@/lib/auth/password';

export const BACKUP_BUCKET = 'bos-backups';
export const BACKUP_VERSION = 1;

// All user-data tables in safe restore order (children after parents)
export const BACKUP_TABLES = [
  'brand_profiles',
  'clients',
  'documents',
  'document_versions',
  'signatures',
  'leads',
  'transactions',
  'subscriptions',
  'social_posts',
  'time_blocks',
  'priorities',
  'personal_blockers',
  'support_periods',
  'testimonials',
  'quick_logs',
  'outreach_leads',
  'lab_projects',
  'lab_tools',
  'lab_skills',
] as const;

// Tables that are safe to truncate in restore (reverse order for FK safety)
export const TRUNCATE_ORDER = [...BACKUP_TABLES].reverse();

export type BackupTableName = typeof BACKUP_TABLES[number];

export interface BackupManifest {
  version:        number;        // BACKUP_VERSION constant
  created_at:     string;        // ISO timestamp
  schema_version: number;        // highest migration number applied
  user_id:        string;        // owner's superadmin uuid
  tables:         Record<BackupTableName, { count: number }>;
  logos:          LogoEntry[];   // brand logo files embedded as base64
}

export interface LogoEntry {
  mode:      'personal' | 'agency';
  filename:  string;
  mime_type: string;
  data:      string;             // base64-encoded file bytes
}

export interface BackupFile {
  manifest: BackupManifest;
  data:     Record<BackupTableName, Record<string, unknown>[]>;
}

/** Highest migration number — update when new migrations are added */
export const CURRENT_SCHEMA_VERSION = 18;

/**
 * Verify superadmin password. Returns true if password is correct.
 * Uses the same bcrypt verification as the login route.
 */
export async function verifySuperadminPassword(userId: string, password: string): Promise<boolean> {
  const admin = getSupabaseAdmin();
  const { data: user } = await admin
    .from('bos_users')
    .select('password_hash')
    .eq('id', userId)
    .eq('role', 'superadmin')
    .single();
  if (!user?.password_hash) return false;
  return verifyPassword(password, user.password_hash);
}

/**
 * Ensure the bos-backups bucket exists. Creates it if not.
 * Private bucket — no public access.
 */
export async function ensureBackupBucket(): Promise<void> {
  const supabase = await createClient();
  const { data: buckets } = await supabase.storage.listBuckets();
  const exists = buckets?.some(b => b.id === BACKUP_BUCKET);
  if (!exists) {
    await supabase.storage.createBucket(BACKUP_BUCKET, {
      public: false,
      fileSizeLimit: 52428800, // 50MB per backup file
    });
  }
}

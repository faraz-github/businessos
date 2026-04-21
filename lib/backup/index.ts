// ============================================================
// lib/backup/index.ts — Shared backup / restore utilities
//
// Server-side only. Import from 'server-only' to guarantee that.
// Consumed by the four routes under app/api/backup/*.
//
// Design notes
// ------------
// A "backup" is a single JSON file with a manifest (metadata) and
// a data section (rows grouped by table). Logos are embedded as
// base64 so a restore is cross-project portable — no external
// references to the original Supabase project's storage URLs.
//
// Table ordering
// --------------
// RESTORE_ORDER below is parents first, children last. TRUNCATE_ORDER
// is its reverse (children first) — required for FK-safe deletes.
// Update BOTH when adding a new user-scoped table.
// ============================================================
import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/auth/supabase-admin';
import { verifyPassword } from '@/lib/auth/password';
import type { Database } from '@/types/database';

export const BACKUP_BUCKET  = 'bos-backups';
export const BACKUP_VERSION = 1;

/**
 * Highest migration number applied. Bump when adding new migrations.
 *
 * 20 = v3.5.0 baseline. The consolidated files collapse 001–019; the
 * only schema-level delta vs. v3.4.0 production is the `brand-logos`
 * bucket rename to `brand-assets` and the new `document-media` bucket.
 * Neither changes the data-table contract, so backups exported under
 * schema_version 18 (v3.4) still restore cleanly — the logo upload
 * target changes, but that's handled at restore time (see
 * app/api/backup/restore/route.ts).
 */
export const CURRENT_SCHEMA_VERSION = 20;

// All user-data tables owned by a superadmin, in FK-safe restore order
// (parents first). Typed as a readonly tuple of actual Database keys so
// TypeScript catches typos at build time, not runtime.
//
// NOTE: the `invoices` table was dropped by migration 012 — invoices now
// live in the `documents` table with `type = 'invoice'`. The
// `transactions.invoice_id` column still exists but is no longer
// constrained (it's just data we preserve on round-trip).
export const RESTORE_ORDER = [
  'brand_profiles',
  'clients',
  'documents',
  'signatures',         // FK → documents
  'document_versions',  // FK → documents (append-only snapshots)
  'transactions',       // nominally FK → invoices, but invoices table gone (migration 012)
  'support_periods',    // FK → clients
  'testimonials',       // FK → clients
  'leads',
  'subscriptions',
  'social_posts',
  'time_blocks',
  'priorities',
  'personal_blockers',
  'quick_logs',
  'profile_reviews',
  'outreach_leads',
  'lab_projects',
  'lab_tools',
  'lab_skills',
] as const satisfies readonly (keyof Database['public']['Tables'])[];

export type BackupTableName = typeof RESTORE_ORDER[number];

/**
 * Reverse of RESTORE_ORDER — for FK-safe deletes. Children first so
 * `delete from clients` doesn't fail on rows still referenced by documents.
 */
export const TRUNCATE_ORDER: readonly BackupTableName[] = [...RESTORE_ORDER].reverse();

/**
 * Tables that don't have a `user_id` column — scoped indirectly through
 * a FK to a user-owned parent. These must be filtered via their parent
 * table when we fetch or truncate (can't just `.eq('user_id', ownerId)`).
 */
export const TABLES_WITHOUT_USER_ID: readonly BackupTableName[] = ['signatures'];

/**
 * Structural type for tables that DO have user_id. Lets us pass a
 * table name variable to `.eq('user_id', ...)` without TypeScript
 * narrowing the allowed columns to the intersection across all tables.
 */
export type UserScopedTable = Exclude<BackupTableName, 'signatures'>;

export interface LogoEntry {
  mode:      'personal' | 'agency';
  /**
   * Storage path relative to the brand-assets bucket. Under v3.5.0 this
   * takes the shape `{ownerId}/{mode}/logo-{timestamp}.{ext}`. For backups
   * written under v3.4.0 (when the bucket was `brand-logos`) the path was
   * `{ownerId}/{mode}-logo.{ext}` — the restore path handles both shapes
   * transparently by uploading to whichever path the manifest records.
   */
  filename:  string;
  mime_type: string;
  /** Base64-encoded file bytes. */
  data:      string;
}

export interface BackupManifest {
  version:        number;                // BACKUP_VERSION at time of export
  created_at:     string;                // ISO timestamp
  schema_version: number;                // CURRENT_SCHEMA_VERSION at export time
  user_id:        string;                // owner's superadmin uuid
  tables:         Record<BackupTableName, { count: number }>;
  logos:          LogoEntry[];
}

export interface BackupFile {
  manifest: BackupManifest;
  data:     Record<BackupTableName, Record<string, unknown>[]>;
}

/**
 * Verify a superadmin's password against their bos_users.password_hash.
 * Returns true only if the user exists, is superadmin, and the password
 * matches. Used to gate every destructive backup operation (create,
 * restore, nuke) so a hijacked session alone can't wipe data.
 */
export async function verifySuperadminPassword(
  userId: string,
  password: string,
): Promise<boolean> {
  const admin = getSupabaseAdmin();
  const { data: user } = await admin
    .from('bos_users')
    .select('password_hash')
    .eq('id', userId)
    .eq('role', 'superadmin')
    .maybeSingle();
  if (!user?.password_hash) return false;
  return verifyPassword(password, user.password_hash);
}

/**
 * Ensure the bos-backups storage bucket exists. Idempotent.
 * Runs migrations 019 already should have created it — this is a safety
 * net for local dev setups where the migration wasn't applied.
 */
export async function ensureBackupBucket(): Promise<void> {
  const supabase = await createClient();
  const { data: buckets } = await supabase.storage.listBuckets();
  if (buckets?.some((b) => b.id === BACKUP_BUCKET)) return;
  await supabase.storage.createBucket(BACKUP_BUCKET, {
    public: false,
    fileSizeLimit: 52428800, // 50MB
    allowedMimeTypes: ['application/json'],
  });
}

/**
 * Build a storage filename for a new backup. Format:
 *   {ownerId}/{YYYY-MM-DD_HH-mm-ss}.json
 * Putting ownerId as the path prefix means .list(ownerId) naturally
 * scopes to one owner's backups — no cross-tenant leakage.
 */
export function buildBackupFilename(ownerId: string, isoTimestamp: string): string {
  const safe = isoTimestamp.replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
  return `${ownerId}/${safe}.json`;
}

/**
 * Why these casts exist
 * ---------------------
 * When you do `admin.from(table)` with `table: BackupTableName` (a union of
 * 19 literals), supabase-js narrows `.eq()` column argument to the
 * INTERSECTION of valid columns across all tables — just `'id'`. Valid
 * typing, wrong ergonomics for our loops.
 *
 * These helpers encapsulate the narrowing so the routes stay readable:
 * one `as never` in a named helper is auditable; 20 casts spread through
 * three files is not.
 *
 * The runtime behaviour is identical to a plain `.eq('user_id', ownerId)`
 * call — the cast only relaxes the typechecker.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

type AnyAdminClient = SupabaseClient<Database>;

/** Fetch all rows of `table` where user_id = ownerId. Returns [] on error. */
export async function fetchUserScopedRows(
  admin: AnyAdminClient,
  table: UserScopedTable,
  ownerId: string,
): Promise<Record<string, unknown>[]> {
  const { data, error } = await admin
    .from(table)
    .select('*')
    .eq('user_id' as never, ownerId);
  if (error) {
    console.error(`[backup] fetch ${table} failed:`, error.message);
    return [];
  }
  return (data ?? []) as Record<string, unknown>[];
}

/** Delete all rows of `table` where user_id = ownerId. Returns count. */
export async function deleteUserScopedRows(
  admin: AnyAdminClient,
  table: UserScopedTable,
  ownerId: string,
): Promise<number> {
  const { error, count } = await admin
    .from(table)
    .delete({ count: 'exact' })
    .eq('user_id' as never, ownerId);
  if (error) {
    console.error(`[backup] delete ${table} failed:`, error.message);
    return 0;
  }
  return count ?? 0;
}

/** Fetch existing ids for merge-restore skip logic. */
export async function fetchExistingIds(
  admin: AnyAdminClient,
  table: UserScopedTable,
  ownerId: string,
): Promise<Set<string>> {
  const { data } = await admin
    .from(table)
    .select('id')
    .eq('user_id' as never, ownerId);
  return new Set(
    (data ?? []).map((r) => (r as { id: string }).id),
  );
}

/** Batch-insert rows into a table. Returns inserted count and any error. */
export async function batchInsertRows(
  admin: AnyAdminClient,
  table: BackupTableName,
  rows: Record<string, unknown>[],
  batchSize = 500,
): Promise<{ inserted: number; errors: string[] }> {
  const errors: string[] = [];
  let inserted = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await admin.from(table).insert(batch as never);
    if (error) {
      console.error(`[backup] insert ${table} failed:`, error.message);
      errors.push(`${table}: ${error.message}`);
    } else {
      inserted += batch.length;
    }
  }
  return { inserted, errors };
}

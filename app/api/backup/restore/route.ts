// ============================================================
// POST /api/backup/restore
//
// Restores user data from a backup JSON. Accepts multipart/form-data:
//   - file:     .json backup (uploaded), OR
//   - filename: path in bos-backups bucket (for existing backups)
//   - mode:     'replace' | 'merge'   (default 'replace')
//   - password: superadmin password   (required)
//
// replace: truncates every user-owned row, then inserts backup rows
// merge:   inserts only rows whose IDs don't already exist
//
// Superadmin only. Password-gated because it's destructive when
// mode=replace.
//
// FK ordering
// -----------
// Inserts follow RESTORE_ORDER (parents first).
// Deletes (during replace) follow TRUNCATE_ORDER (children first).
// ============================================================
import { NextResponse, type NextRequest } from 'next/server';
import { getSession, getOwnerId } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/auth/supabase-admin';
import { createClient } from '@/lib/supabase/server';
import {
  RESTORE_ORDER,
  TRUNCATE_ORDER,
  TABLES_WITHOUT_USER_ID,
  BACKUP_BUCKET,
  BACKUP_VERSION,
  verifySuperadminPassword,
  deleteUserScopedRows,
  fetchExistingIds,
  batchInsertRows,
  type BackupFile,
  type BackupTableName,
  type UserScopedTable,
} from '@/lib/backup';

const INSERT_BATCH_SIZE = 500;

type RestoreMode = 'replace' | 'merge';

function isRestoreMode(v: unknown): v is RestoreMode {
  return v === 'replace' || v === 'merge';
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  if (session.role !== 'superadmin') {
    return NextResponse.json({ error: 'Superadmin only' }, { status: 403 });
  }

  const ownerId = getOwnerId(session);

  // ── Parse multipart form ───────────────────────────────────────
  let backupJson: string;
  let restoreMode: RestoreMode = 'replace';
  let password = '';

  try {
    const form = await request.formData();

    const rawPassword = form.get('password');
    password = typeof rawPassword === 'string' ? rawPassword : '';

    const rawMode = form.get('mode');
    restoreMode = isRestoreMode(rawMode) ? rawMode : 'replace';

    const file     = form.get('file');
    const filename = form.get('filename');

    if (file instanceof File) {
      backupJson = await file.text();
    } else if (typeof filename === 'string' && filename.length > 0) {
      // Guard against path traversal / cross-owner reads by requiring the
      // filename to start with the current owner's id prefix.
      if (!filename.startsWith(`${ownerId}/`)) {
        return NextResponse.json(
          { error: 'Backup file does not belong to this account' },
          { status: 403 },
        );
      }
      const supabase = await createClient();
      const { data: fileData, error: dlErr } = await supabase.storage
        .from(BACKUP_BUCKET)
        .download(filename);
      if (dlErr || !fileData) {
        return NextResponse.json(
          { error: 'Could not load backup from storage' },
          { status: 404 },
        );
      }
      backupJson = await fileData.text();
    } else {
      return NextResponse.json(
        { error: 'Provide either a file upload or a filename' },
        { status: 400 },
      );
    }
  } catch (err) {
    console.error('[backup/restore] Failed to parse request:', err);
    return NextResponse.json({ error: 'Failed to parse request' }, { status: 400 });
  }

  if (!password) {
    return NextResponse.json({ error: 'Password required' }, { status: 400 });
  }

  const validPwd = await verifySuperadminPassword(session.sub, password);
  if (!validPwd) {
    return NextResponse.json({ error: 'Incorrect password' }, { status: 401 });
  }

  // ── Parse & validate backup file ───────────────────────────────
  let backup: BackupFile;
  try {
    backup = JSON.parse(backupJson) as BackupFile;
  } catch {
    return NextResponse.json(
      { error: 'Invalid backup file — could not parse JSON' },
      { status: 400 },
    );
  }

  if (!backup?.manifest || !backup.data) {
    return NextResponse.json(
      { error: 'Invalid backup format — missing manifest or data' },
      { status: 400 },
    );
  }
  if (backup.manifest.version !== BACKUP_VERSION) {
    return NextResponse.json(
      { error: `Unsupported backup version: ${backup.manifest.version}` },
      { status: 400 },
    );
  }

  const admin    = getSupabaseAdmin();
  const supabase = await createClient();
  const restored: Partial<Record<BackupTableName, number>> = {};
  const errors:   string[] = [];

  try {
    // ── REPLACE: clear existing rows first ────────────────────────
    if (restoreMode === 'replace') {
      for (const table of TRUNCATE_ORDER) {
        if (TABLES_WITHOUT_USER_ID.includes(table)) continue;
        await deleteUserScopedRows(admin, table as UserScopedTable, ownerId);
      }
      // Signatures cascade via ON DELETE CASCADE when documents were
      // deleted above — no explicit signatures-delete needed.
    }

    // ── INSERT backup rows in parent-first order ──────────────────
    for (const table of RESTORE_ORDER) {
      const rows = (backup.data[table] ?? []) as Record<string, unknown>[];
      if (rows.length === 0) {
        restored[table] = 0;
        continue;
      }

      let rowsToInsert = rows;
      if (restoreMode === 'merge' && !TABLES_WITHOUT_USER_ID.includes(table)) {
        // Skip rows whose id already exists. Signatures (no user_id) can't
        // be merge-filtered this way — insert all and accept PK-conflict
        // errors as "already present" noise.
        const existingIds = await fetchExistingIds(admin, table as UserScopedTable, ownerId);
        rowsToInsert = rowsToInsert.filter((r) => {
          const id = (r as { id?: unknown }).id;
          return typeof id === 'string' && !existingIds.has(id);
        });
      }

      if (rowsToInsert.length === 0) {
        restored[table] = 0;
        continue;
      }

      const { inserted, errors: batchErrors } = await batchInsertRows(
        admin,
        table,
        rowsToInsert,
        INSERT_BATCH_SIZE,
      );
      restored[table] = inserted;
      errors.push(...batchErrors);
    }

    // ── Restore brand logos from embedded base64 ─────────────────
    let logosRestored = 0;
    for (const logo of backup.manifest.logos ?? []) {
      try {
        const bytes = Buffer.from(logo.data, 'base64');
        // Deliberately overwrite — the brand_profiles row already points
        // at the original logo_url, so reuploading to the same path
        // preserves the reference without needing to update the row.
        const blob = new Blob([bytes as unknown as BlobPart], { type: logo.mime_type });
        const storagePath = logo.filename;
        const { error: uploadErr } = await supabase.storage
          .from('brand-assets')
          .upload(storagePath, blob, {
            contentType: logo.mime_type,
            upsert:      true,
          });
        if (uploadErr) {
          console.warn('[backup/restore] Logo upload failed:', uploadErr.message);
          continue;
        }

        // Refresh the logo_url on the brand_profiles row in case the project
        // URL changed (cross-project restore). Fetching publicUrl is cheap.
        const { data: urlData } = supabase.storage
          .from('brand-assets')
          .getPublicUrl(storagePath);
        if (urlData?.publicUrl) {
          await admin
            .from('brand_profiles')
            .update({ logo_url: urlData.publicUrl })
            .eq('user_id', ownerId)
            .eq('mode', logo.mode);
        }
        logosRestored++;
      } catch (logoErr) {
        console.warn('[backup/restore] Logo restore failed:', logoErr);
      }
    }

    // ── Audit trail in quick_logs ────────────────────────────────
    await admin.from('quick_logs').insert({
      user_id: ownerId,
      mode:    'personal',
      type:    'other',
      content: `Data restored from backup (${restoreMode} mode). ` +
               `Source: ${backup.manifest.created_at}. ` +
               `Tables: ${Object.entries(restored).map(([t, c]) => `${t}=${c}`).join(', ')}`,
    });

    return NextResponse.json({
      ok:             true,
      mode:           restoreMode,
      restored,
      logos_restored: logosRestored,
      errors:         errors.length > 0 ? errors : undefined,
      source_date:    backup.manifest.created_at,
    });
  } catch (err) {
    console.error('[backup/restore] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Restore failed. Check server logs.' },
      { status: 500 },
    );
  }
}

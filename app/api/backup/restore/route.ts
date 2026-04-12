// POST /api/backup/restore
// Restores user data from a backup JSON.
// Body: multipart/form-data with:
//   - file: the .json backup file (from upload), OR
//   - filename: storage path to restore from bucket
//   - mode: 'replace' | 'merge'
//   - password: superadmin password (required)
//
// replace: truncates all tables then inserts backup data
// merge:   inserts only rows whose IDs don't already exist
//
// Superadmin only.
import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { getSupabaseAdmin } from '@/lib/auth/supabase-admin';
import { createClient } from '@/lib/supabase/server';
import {
  BACKUP_TABLES, BACKUP_BUCKET, TRUNCATE_ORDER,
  verifySuperadminPassword,
  type BackupFile, type BackupTableName,
} from '@/lib/backup';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (session.role !== 'superadmin') return NextResponse.json({ error: 'Superadmin only' }, { status: 403 });

  const ownerId = session.ownerId ?? session.sub;

  let backupJson: string;
  let restoreMode: 'replace' | 'merge' = 'replace';
  let password: string | null = null;

  // Parse multipart form data
  try {
    const form = await request.formData();
    password    = form.get('password') as string | null;
    restoreMode = (form.get('mode') as 'replace' | 'merge') || 'replace';

    const file     = form.get('file') as File | null;
    const filename = form.get('filename') as string | null;

    if (file) {
      backupJson = await file.text();
    } else if (filename) {
      // Load from storage bucket
      const supabase = await createClient();
      const { data: fileData, error: dlErr } = await supabase.storage
        .from(BACKUP_BUCKET)
        .download(filename);
      if (dlErr || !fileData) {
        return NextResponse.json({ error: 'Could not load backup from storage' }, { status: 404 });
      }
      backupJson = await fileData.text();
    } else {
      return NextResponse.json({ error: 'Provide either a file upload or a filename' }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json({ error: 'Failed to parse request' }, { status: 400 });
  }

  // Require and verify password
  if (!password) return NextResponse.json({ error: 'Password required' }, { status: 400 });
  const validPwd = await verifySuperadminPassword(session.sub, password);
  if (!validPwd) return NextResponse.json({ error: 'Incorrect password' }, { status: 401 });

  // Parse backup file
  let backup: BackupFile;
  try {
    backup = JSON.parse(backupJson) as BackupFile;
  } catch {
    return NextResponse.json({ error: 'Invalid backup file — could not parse JSON' }, { status: 400 });
  }

  if (!backup.manifest || !backup.data) {
    return NextResponse.json({ error: 'Invalid backup format — missing manifest or data' }, { status: 400 });
  }

  if (backup.manifest.version !== 1) {
    return NextResponse.json({ error: `Unsupported backup version: ${backup.manifest.version}` }, { status: 400 });
  }

  const admin    = getSupabaseAdmin();
  const supabase = await createClient();
  const restored: Record<string, number> = {};
  const errors:   string[] = [];

  try {
    // ── REPLACE: truncate all tables then insert ─────────────
    if (restoreMode === 'replace') {
      // Truncate in reverse dependency order
      for (const table of TRUNCATE_ORDER) {
        if (table === 'signatures') continue; // handled via CASCADE
        try {
          await admin.from(table).delete().eq('user_id', ownerId);
        } catch (e) {
          console.warn(`[restore] Could not clear ${table}:`, e);
        }
      }
      // Clear signatures separately (no user_id column)
      const docIds = (backup.data['documents'] || []).map((d: any) => d.id as string);
      if (docIds.length > 0) {
        await admin.from('signatures').delete().in('document_id', docIds);
      }
    }

    // ── INSERT backup rows ───────────────────────────────────
    for (const table of BACKUP_TABLES) {
      const rows = backup.data[table as BackupTableName] || [];
      if (rows.length === 0) { restored[table] = 0; continue; }

      let rowsToInsert = rows as Record<string, unknown>[];

      if (restoreMode === 'merge') {
        // Fetch existing IDs to skip
        const { data: existing } = await admin
          .from(table)
          .select('id')
          .eq('user_id', ownerId);
        const existingIds = new Set((existing || []).map((r: any) => r.id));
        rowsToInsert = rowsToInsert.filter((r: any) => !existingIds.has(r.id));
      }

      if (rowsToInsert.length === 0) { restored[table] = 0; continue; }

      // Insert in batches of 500 to stay within Supabase limits
      let count = 0;
      for (let i = 0; i < rowsToInsert.length; i += 500) {
        const batch = rowsToInsert.slice(i, i + 500);
        const { error: insErr } = await admin.from(table).insert(batch);
        if (insErr) {
          console.error(`[restore] Insert error on ${table}:`, insErr.message);
          errors.push(`${table}: ${insErr.message}`);
        } else {
          count += batch.length;
        }
      }
      restored[table] = count;
    }

    // Handle signatures separately (no user_id)
    const sigRows = backup.data['signatures' as BackupTableName] || [];
    if (sigRows.length > 0) {
      let sigCount = 0;
      for (let i = 0; i < sigRows.length; i += 500) {
        const batch = sigRows.slice(i, i + 500);
        const { error: sigErr } = await admin.from('signatures').insert(batch);
        if (!sigErr) sigCount += batch.length;
      }
      restored['signatures'] = sigCount;
    }

    // ── Restore brand logos from base64 ──────────────────────
    let logosRestored = 0;
    for (const logo of backup.manifest.logos || []) {
      try {
        const bytes = Buffer.from(logo.data, 'base64');
        const blob  = new Blob([bytes], { type: logo.mime_type });
        // Upload to brand-logos bucket under a path keyed to ownerId + mode
        const storagePath = `${ownerId}/${logo.mode}-logo`;
        const { error: uploadErr } = await supabase.storage
          .from('brand-logos')
          .upload(storagePath, blob, {
            contentType: logo.mime_type,
            upsert:      true,
          });
        if (!uploadErr) {
          // Update the brand_profiles row with the new URL
          const { data: urlData } = supabase.storage
            .from('brand-logos')
            .getPublicUrl(storagePath);
          if (urlData?.publicUrl) {
            await admin.from('brand_profiles')
              .update({ logo_url: urlData.publicUrl })
              .eq('user_id', ownerId)
              .eq('mode', logo.mode);
          }
          logosRestored++;
        }
      } catch (logoErr) {
        console.warn('[restore] Logo restore failed:', logoErr);
      }
    }

    // ── Log to quick_logs for audit trail ────────────────────
    await admin.from('quick_logs').insert({
      user_id: ownerId,
      mode:    'personal',
      type:    'other',
      content: `Data restored from backup (${restoreMode} mode). Source: ${backup.manifest.created_at}. Tables: ${Object.entries(restored).map(([t, c]) => `${t}=${c}`).join(', ')}`,
    });

    return NextResponse.json({
      ok:            true,
      mode:          restoreMode,
      restored,
      logos_restored: logosRestored,
      errors:        errors.length > 0 ? errors : undefined,
      source_date:   backup.manifest.created_at,
    });

  } catch (err) {
    console.error('[backup/restore] Unexpected error:', err);
    return NextResponse.json({ error: 'Restore failed. Check server logs.' }, { status: 500 });
  }
}

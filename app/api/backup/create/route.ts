// ============================================================
// POST /api/backup/create
//
// Creates a full JSON backup of all user data for the authenticated
// superadmin (owner). Flow:
//   1. Verify superadmin + password (prevents hijacked session abuse)
//   2. Fetch all tables listed in RESTORE_ORDER, scoped to ownerId
//   3. Download brand logos from the brand-assets bucket, embed as base64
//      (makes the backup cross-project portable)
//   4. Upload the assembled JSON to bos-backups bucket
//   5. Stream the same JSON back as a download response
//
// Superadmin only.
// ============================================================
import { NextResponse, type NextRequest } from 'next/server';
import { getSession, getOwnerId } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/auth/supabase-admin';
import { createClient } from '@/lib/supabase/server';
import {
  RESTORE_ORDER,
  TABLES_WITHOUT_USER_ID,
  BACKUP_BUCKET,
  BACKUP_VERSION,
  CURRENT_SCHEMA_VERSION,
  ensureBackupBucket,
  verifySuperadminPassword,
  buildBackupFilename,
  fetchUserScopedRows,
  type BackupFile,
  type BackupManifest,
  type LogoEntry,
  type BackupTableName,
  type UserScopedTable,
} from '@/lib/backup';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  if (session.role !== 'superadmin') {
    return NextResponse.json({ error: 'Superadmin only' }, { status: 403 });
  }

  let body: { password?: unknown };
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const password = typeof body.password === 'string' ? body.password : '';
  if (!password) {
    return NextResponse.json({ error: 'Password required' }, { status: 400 });
  }

  const valid = await verifySuperadminPassword(session.sub, password);
  if (!valid) {
    return NextResponse.json({ error: 'Incorrect password' }, { status: 401 });
  }

  const ownerId  = getOwnerId(session);
  const admin    = getSupabaseAdmin();
  const supabase = await createClient();

  try {
    // ── 1. Fetch table data ──────────────────────────────────────
    // Partial<> because we assemble it table-by-table; fully-populated
    // before we construct BackupFile below.
    const tableData: Partial<Record<BackupTableName, Record<string, unknown>[]>> = {};
    const tableCounts: Partial<Record<BackupTableName, { count: number }>> = {};

    for (const table of RESTORE_ORDER) {
      // Tables without user_id are handled after we have the parent rows.
      if (TABLES_WITHOUT_USER_ID.includes(table)) {
        tableData[table] = [];
        tableCounts[table] = { count: 0 };
        continue;
      }
      const rows = await fetchUserScopedRows(admin, table as UserScopedTable, ownerId);
      tableData[table] = rows;
      tableCounts[table] = { count: rows.length };
    }

    // Signatures are scoped via document_id — fetch after documents.
    const docRows = tableData.documents ?? [];
    const docIds = docRows
      .map((d) => d.id)
      .filter((id): id is string => typeof id === 'string');
    if (docIds.length > 0) {
      const { data: sigs } = await admin.from('signatures').select('*').in('document_id', docIds);
      tableData.signatures = (sigs ?? []) as Record<string, unknown>[];
      tableCounts.signatures = { count: tableData.signatures.length };
    }

    // ── 2. Embed brand logos as base64 ───────────────────────────
    const logos: LogoEntry[] = [];
    const { data: brands } = await admin
      .from('brand_profiles')
      .select('mode, logo_url')
      .eq('user_id', ownerId);

    for (const brand of brands ?? []) {
      if (!brand.logo_url) continue;
      try {
        // Public URL format: .../storage/v1/object/public/brand-assets/{path}
        // Grab the path after the bucket name.
        const match = brand.logo_url.match(/\/brand-assets\/(.+)$/);
        const urlPath = match?.[1];
        if (!urlPath) continue;

        const { data: fileData } = await supabase.storage
          .from('brand-assets')
          .download(urlPath);
        if (!fileData) continue;

        const arrayBuffer = await fileData.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');
        const mimeType = fileData.type || 'image/png';

        logos.push({
          mode:      brand.mode as 'personal' | 'agency',
          filename:  urlPath,
          mime_type: mimeType,
          data:      base64,
        });
      } catch (logoErr) {
        console.warn(`[backup/create] Could not embed logo for ${brand.mode}:`, logoErr);
      }
    }

    // ── 3. Assemble backup file ──────────────────────────────────
    const now = new Date().toISOString();
    const manifest: BackupManifest = {
      version:        BACKUP_VERSION,
      created_at:     now,
      schema_version: CURRENT_SCHEMA_VERSION,
      user_id:        ownerId,
      tables:         tableCounts as BackupManifest['tables'],
      logos,
    };
    const backupFile: BackupFile = {
      manifest,
      data: tableData as BackupFile['data'],
    };

    const json  = JSON.stringify(backupFile, null, 2);
    const bytes = Buffer.from(json, 'utf-8');

    // ── 4. Upload to bos-backups bucket (non-fatal on failure) ──
    await ensureBackupBucket();
    const filename = buildBackupFilename(ownerId, now);
    const { error: uploadError } = await supabase.storage
      .from(BACKUP_BUCKET)
      .upload(filename, bytes, {
        contentType:  'application/json',
        cacheControl: '3600',
        upsert:       false,
      });
    if (uploadError) {
      // Upload failure shouldn't stop the download — user still gets the file.
      // They just won't see it in the backup list.
      console.error('[backup/create] Storage upload failed:', uploadError.message);
    }

    // ── 5. Stream as download response ───────────────────────────
    const downloadName = `bos-backup-${now.slice(0, 10)}.json`;
    const tablesHeader = Object.entries(tableCounts)
      .map(([t, v]) => `${t}:${v?.count ?? 0}`)
      .join(',');

    return new NextResponse(bytes as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type':        'application/json',
        'Content-Disposition': `attachment; filename="${downloadName}"`,
        'Content-Length':      String(bytes.length),
        'X-Backup-Tables':     tablesHeader,
      },
    });
  } catch (err) {
    console.error('[backup/create] Unexpected error:', err);
    return NextResponse.json({ error: 'Backup failed. Check server logs.' }, { status: 500 });
  }
}

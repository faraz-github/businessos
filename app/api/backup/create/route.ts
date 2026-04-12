// POST /api/backup/create
// Creates a full JSON backup of all user data.
// - Fetches all 19 tables for the authenticated owner
// - Downloads brand logos and embeds as base64 (cross-project portable)
// - Uploads to bos-backups storage bucket
// - Returns the JSON file as a download simultaneously
// Superadmin only. Requires password confirmation.
import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { getSupabaseAdmin } from '@/lib/auth/supabase-admin';
import { createClient } from '@/lib/supabase/server';
import {
  BACKUP_TABLES, BACKUP_BUCKET, BACKUP_VERSION, CURRENT_SCHEMA_VERSION,
  ensureBackupBucket, verifySuperadminPassword,
  type BackupFile, type BackupManifest, type LogoEntry, type BackupTableName,
} from '@/lib/backup';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (session.role !== 'superadmin') return NextResponse.json({ error: 'Superadmin only' }, { status: 403 });

  let body: { password?: string };
  try { body = await request.json(); } catch { body = {}; }
  if (!body.password) return NextResponse.json({ error: 'Password required' }, { status: 400 });

  // Verify superadmin password
  const valid = await verifySuperadminPassword(session.sub, body.password);
  if (!valid) return NextResponse.json({ error: 'Incorrect password' }, { status: 401 });

  const ownerId = session.ownerId ?? session.sub;
  const admin   = getSupabaseAdmin();
  const supabase = await createClient();

  try {
    // ── 1. Fetch all table data ──────────────────────────────
    const tableData: Record<string, Record<string, unknown>[]> = {};
    const tableCounts: Record<string, { count: number }> = {};

    for (const table of BACKUP_TABLES) {
      const { data, error } = await admin
        .from(table)
        .select('*')
        .eq('user_id', ownerId);
      if (error) {
        console.error(`[backup] Failed to fetch ${table}:`, error.message);
        tableData[table] = [];
      } else {
        tableData[table] = (data as Record<string, unknown>[]) || [];
      }
      tableCounts[table] = { count: tableData[table].length };
    }

    // signatures don't have user_id — fetch via document_ids
    const docIds = (tableData['documents'] || []).map((d: any) => d.id as string);
    if (docIds.length > 0) {
      const { data: sigs } = await admin
        .from('signatures')
        .select('*')
        .in('document_id', docIds);
      tableData['signatures'] = (sigs as Record<string, unknown>[]) || [];
      tableCounts['signatures'] = { count: tableData['signatures'].length };
    } else {
      tableData['signatures'] = [];
      tableCounts['signatures'] = { count: 0 };
    }

    // ── 2. Fetch and embed brand logos as base64 ─────────────
    const logos: LogoEntry[] = [];
    const { data: brands } = await admin
      .from('brand_profiles')
      .select('mode, logo_url')
      .eq('user_id', ownerId);

    for (const brand of brands || []) {
      if (!brand.logo_url) continue;
      try {
        // Extract storage path from the public URL
        // URL format: .../storage/v1/object/public/brand-logos/{path}
        const urlPath = brand.logo_url.split('/storage/v1/object/public/brand-logos/')[1];
        if (!urlPath) continue;

        const { data: fileData } = await supabase.storage
          .from('brand-logos')
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
        console.warn(`[backup] Could not embed logo for ${brand.mode}:`, logoErr);
      }
    }

    // ── 3. Assemble backup file ──────────────────────────────
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

    const json = JSON.stringify(backupFile, null, 2);
    const bytes = Buffer.from(json, 'utf-8');

    // ── 4. Upload to storage bucket ──────────────────────────
    await ensureBackupBucket();
    const filename = `${ownerId}/${now.replace(/[:.]/g, '-').replace('T', '_').slice(0, 19)}.json`;
    const { error: uploadError } = await supabase.storage
      .from(BACKUP_BUCKET)
      .upload(filename, bytes, {
        contentType:  'application/json',
        cacheControl: '3600',
        upsert:       false,
      });

    if (uploadError) {
      console.error('[backup] Storage upload failed:', uploadError.message);
      // Still return the download even if storage upload fails
    }

    // ── 5. Return as file download ───────────────────────────
    const downloadName = `bos-backup-${now.slice(0, 10)}.json`;
    return new NextResponse(bytes, {
      status: 200,
      headers: {
        'Content-Type':        'application/json',
        'Content-Disposition': `attachment; filename="${downloadName}"`,
        'Content-Length':      String(bytes.length),
        'X-Backup-Tables':     Object.entries(tableCounts)
                                 .map(([t, v]) => `${t}:${v.count}`)
                                 .join(','),
      },
    });

  } catch (err) {
    console.error('[backup/create] Unexpected error:', err);
    return NextResponse.json({ error: 'Backup failed. Check server logs.' }, { status: 500 });
  }
}

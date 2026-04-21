// ============================================================
// POST /api/backup/nuke
//
// Destructively deletes ALL user data for the current owner.
// Used for testing restores (nuke → restore reset), or to start
// completely fresh. Preserves bos_users row so the account itself
// remains — user can sign in again and create a new brand profile.
//
// Requires superadmin + password. Irreversible.
// ============================================================
import { NextResponse, type NextRequest } from 'next/server';
import { getSession, getOwnerId } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/auth/supabase-admin';
import { createClient } from '@/lib/supabase/server';
import {
  TRUNCATE_ORDER,
  TABLES_WITHOUT_USER_ID,
  verifySuperadminPassword,
  deleteUserScopedRows,
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

  const validPwd = await verifySuperadminPassword(session.sub, password);
  if (!validPwd) {
    return NextResponse.json({ error: 'Incorrect password' }, { status: 401 });
  }

  const ownerId = getOwnerId(session);
  const admin   = getSupabaseAdmin();
  const deleted: Partial<Record<BackupTableName, number>> = {};

  try {
    // Delete user-scoped tables in FK-safe order (children first).
    // Signatures cascade from documents, so we don't touch them directly.
    for (const table of TRUNCATE_ORDER) {
      if (TABLES_WITHOUT_USER_ID.includes(table)) continue;
      deleted[table] = await deleteUserScopedRows(admin, table as UserScopedTable, ownerId);
    }

    // ── Clear brand assets + document media from storage ────────
    // Non-fatal — data is already gone by this point. We walk both
    // storage buckets and delete any objects whose first path segment
    // is the owner's uid.
    try {
      const supabase = await createClient();

      // brand-assets: paths like {ownerId}/{mode}/logo-*.ext
      // We list + delete recursively because the Supabase storage API
      // doesn't offer "delete by prefix."
      const { data: brandModeFolders } = await supabase.storage
        .from('brand-assets')
        .list(ownerId);
      for (const folder of brandModeFolders ?? []) {
        const { data: files } = await supabase.storage
          .from('brand-assets')
          .list(`${ownerId}/${folder.name}`);
        if (files && files.length > 0) {
          const paths = files.map((f) => `${ownerId}/${folder.name}/${f.name}`);
          await supabase.storage.from('brand-assets').remove(paths);
        }
      }

      // document-media: paths like {ownerId}/{documentId}/*.ext
      const { data: docFolders } = await supabase.storage
        .from('document-media')
        .list(ownerId);
      for (const folder of docFolders ?? []) {
        const { data: files } = await supabase.storage
          .from('document-media')
          .list(`${ownerId}/${folder.name}`);
        if (files && files.length > 0) {
          const paths = files.map((f) => `${ownerId}/${folder.name}/${f.name}`);
          await supabase.storage.from('document-media').remove(paths);
        }
      }
    } catch (storageErr) {
      console.warn('[backup/nuke] Storage cleanup failed (non-fatal):', storageErr);
    }

    return NextResponse.json({
      ok:      true,
      deleted,
      message:
        'All data deleted. Your account (bos_users) is preserved — sign in again to start fresh.',
    });
  } catch (err) {
    console.error('[backup/nuke] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Nuke failed. Check server logs.' },
      { status: 500 },
    );
  }
}

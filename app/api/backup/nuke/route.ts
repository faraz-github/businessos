// POST /api/backup/nuke
// Deletes ALL user data for the current owner.
// Equivalent to running 000_reset_for_fresh_start.sql via API.
// Requires superadmin password confirmation.
// Does NOT touch bos_users — your account is preserved.
// Superadmin only.
import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { getSupabaseAdmin } from '@/lib/auth/supabase-admin';
import { TRUNCATE_ORDER, verifySuperadminPassword } from '@/lib/backup';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (session.role !== 'superadmin') return NextResponse.json({ error: 'Superadmin only' }, { status: 403 });

  let body: { password?: string };
  try { body = await request.json(); } catch { body = {}; }
  if (!body.password) return NextResponse.json({ error: 'Password required' }, { status: 400 });

  const validPwd = await verifySuperadminPassword(session.sub, body.password);
  if (!validPwd) return NextResponse.json({ error: 'Incorrect password' }, { status: 401 });

  const ownerId = session.ownerId ?? session.sub;
  const admin   = getSupabaseAdmin();
  const deleted: Record<string, number> = {};

  try {
    // Delete in reverse dependency order
    for (const table of TRUNCATE_ORDER) {
      if (table === 'signatures') continue; // no user_id — handled via document cascade

      const { error, count } = await admin
        .from(table)
        .delete({ count: 'exact' })
        .eq('user_id', ownerId);

      if (error) {
        console.error(`[nuke] Delete error on ${table}:`, error.message);
        deleted[table] = 0;
      } else {
        deleted[table] = count ?? 0;
      }
    }

    // Signatures: delete where document_id is no longer in documents
    // (documents are already deleted above, so all orphaned sigs can go)
    await admin.from('signatures').delete().not('document_id', 'in', '(select id from public.documents)');

    // Clear brand logos from storage
    try {
      const { createClient } = await import('@/lib/supabase/server');
      const supabase = await createClient();
      const { data: files } = await supabase.storage
        .from('brand-logos')
        .list(ownerId);
      for (const file of files || []) {
        await supabase.storage.from('brand-logos').remove([`${ownerId}/${file.name}`]);
      }
      // Also try root-level files with ownerId prefix
      await supabase.storage.from('brand-logos').remove([
        `${ownerId}/personal-logo`,
        `${ownerId}/agency-logo`,
      ]);
    } catch (storageErr) {
      console.warn('[nuke] Storage cleanup failed (non-fatal):', storageErr);
    }

    return NextResponse.json({
      ok:      true,
      deleted,
      message: 'All data deleted. Your account (bos_users) is preserved — sign in again to start fresh.',
    });

  } catch (err) {
    console.error('[backup/nuke] Unexpected error:', err);
    return NextResponse.json({ error: 'Nuke failed. Check server logs.' }, { status: 500 });
  }
}

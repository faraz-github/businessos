// ============================================================
// DELETE /api/backup/delete
// Body: { filename: string }
//
// Removes a single backup file from the bos-backups bucket.
// Used by the Settings → Backup tab to clean up old backups.
//
// Superadmin only. Filename must belong to the current owner
// (prefix check) to prevent cross-tenant deletes.
//
// Note: we don't require password re-entry here because deleting
// a backup is reversible in the sense that the user still has any
// local copy they downloaded. Compare to /nuke which wipes live
// data and DOES require the password.
// ============================================================
import { NextResponse, type NextRequest } from 'next/server';
import { getSession, getOwnerId } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { BACKUP_BUCKET } from '@/lib/backup';

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  if (session.role !== 'superadmin') {
    return NextResponse.json({ error: 'Superadmin only' }, { status: 403 });
  }

  let body: { filename?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const filename = typeof body.filename === 'string' ? body.filename : '';
  if (!filename) {
    return NextResponse.json({ error: 'filename is required' }, { status: 400 });
  }

  const ownerId = getOwnerId(session);
  if (!filename.startsWith(`${ownerId}/`) || filename.includes('..')) {
    return NextResponse.json(
      { error: 'Backup file does not belong to this account' },
      { status: 403 },
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.storage
    .from(BACKUP_BUCKET)
    .remove([filename]);

  if (error) {
    console.error('[backup/delete] Storage remove failed:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, deleted: filename });
}

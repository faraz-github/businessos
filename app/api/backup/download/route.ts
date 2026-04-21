// ============================================================
// GET /api/backup/download?filename={ownerId}/{timestamp}.json
//
// Streams a stored backup file from the bos-backups bucket as a
// JSON download. Used by the Settings → Backup tab "Download"
// button for existing stored backups. The bucket is private, so
// we can't serve a signed URL directly without either exposing
// the service role key or minting a signed URL per click — this
// route handles it server-side with the session already verified.
//
// Superadmin only. Filename must belong to the current owner
// (guarded by prefix check) to prevent cross-tenant reads.
// ============================================================
import { NextResponse, type NextRequest } from 'next/server';
import { getSession, getOwnerId } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { BACKUP_BUCKET } from '@/lib/backup';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  if (session.role !== 'superadmin') {
    return NextResponse.json({ error: 'Superadmin only' }, { status: 403 });
  }

  const filename = request.nextUrl.searchParams.get('filename');
  if (!filename) {
    return NextResponse.json({ error: 'filename is required' }, { status: 400 });
  }

  const ownerId = getOwnerId(session);

  // Path-traversal / cross-tenant guard — storage paths here are always
  // `{ownerId}/{timestamp}.json`. A filename that doesn't start with the
  // current owner's id prefix is either a bug or an attack; reject.
  if (!filename.startsWith(`${ownerId}/`) || filename.includes('..')) {
    return NextResponse.json(
      { error: 'Backup file does not belong to this account' },
      { status: 403 },
    );
  }

  const supabase = await createClient();
  const { data: fileData, error } = await supabase.storage
    .from(BACKUP_BUCKET)
    .download(filename);

  if (error || !fileData) {
    return NextResponse.json(
      { error: 'Backup not found' },
      { status: 404 },
    );
  }

  const arrayBuffer = await fileData.arrayBuffer();
  // Preserve the timestamp portion in the download name so a user with
  // multiple backups can tell them apart on disk.
  const basename = filename.split('/').pop() ?? 'bos-backup.json';
  const downloadName = `bos-backup-${basename}`;

  return new NextResponse(arrayBuffer as BodyInit, {
    status: 200,
    headers: {
      'Content-Type':        'application/json',
      'Content-Disposition': `attachment; filename="${downloadName}"`,
      'Content-Length':      String(arrayBuffer.byteLength),
      'Cache-Control':       'no-store',
    },
  });
}

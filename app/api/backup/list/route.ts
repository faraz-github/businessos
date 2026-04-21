// ============================================================
// GET /api/backup/list
//
// Lists every backup file in the bos-backups bucket that belongs
// to the current owner. Backups are stored under `{ownerId}/` so
// listing that path is naturally scoped — no need to filter after.
//
// Response: BackupListItem[] sorted newest-first by filename
// (filenames are ISO timestamps, so lexicographic sort === date sort).
//
// Superadmin only.
// ============================================================
import { NextResponse } from 'next/server';
import { getSession, getOwnerId } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { BACKUP_BUCKET, ensureBackupBucket } from '@/lib/backup';

export interface BackupListItem {
  /** Full storage path (ownerId/filename). Use this for download / delete. */
  filename:   string;
  /** Human-readable display name — just the timestamp part. */
  name:       string;
  size_bytes: number;
  /** ISO timestamp of when the file was uploaded to storage. */
  created_at: string;
}

export async function GET(): Promise<NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  if (session.role !== 'superadmin') {
    return NextResponse.json({ error: 'Superadmin only' }, { status: 403 });
  }

  const ownerId  = getOwnerId(session);
  const supabase = await createClient();

  try {
    await ensureBackupBucket();

    const { data: files, error } = await supabase.storage
      .from(BACKUP_BUCKET)
      .list(ownerId, {
        limit:  100,
        offset: 0,
        sortBy: { column: 'created_at', order: 'desc' },
      });

    if (error) {
      console.error('[backup/list] Storage list error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const items: BackupListItem[] = (files ?? [])
      .filter((f) => f.name.endsWith('.json'))
      .map((f) => ({
        filename:   `${ownerId}/${f.name}`,
        // Strip .json and swap underscore back to space for display.
        name:       f.name.replace(/\.json$/, '').replace(/_/g, ' '),
        size_bytes: (f.metadata as { size?: number } | null)?.size ?? 0,
        created_at: f.created_at ?? f.updated_at ?? new Date().toISOString(),
      }));

    return NextResponse.json(items);
  } catch (err) {
    console.error('[backup/list] Unexpected error:', err);
    return NextResponse.json({ error: 'Could not list backups' }, { status: 500 });
  }
}

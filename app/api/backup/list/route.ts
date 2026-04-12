// GET /api/backup/list
// Lists all backup files stored for the current owner.
// Returns filename, size, created_at for each.
// Superadmin only.
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { BACKUP_BUCKET, ensureBackupBucket } from '@/lib/backup';

export interface BackupListItem {
  filename:   string;       // storage path, used for download/delete
  name:       string;       // display name (just the timestamp part)
  size_bytes: number;
  created_at: string;       // ISO timestamp
}

export async function GET(): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (session.role !== 'superadmin') return NextResponse.json({ error: 'Superadmin only' }, { status: 403 });

  const ownerId = session.ownerId ?? session.sub;
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

    const items: BackupListItem[] = (files || [])
      .filter(f => f.name.endsWith('.json'))
      .map(f => ({
        filename:   `${ownerId}/${f.name}`,
        name:       f.name.replace('.json', '').replace(/_/g, ' '),
        size_bytes: f.metadata?.size ?? 0,
        created_at: f.created_at ?? f.updated_at ?? new Date().toISOString(),
      }));

    return NextResponse.json(items);
  } catch (err) {
    console.error('[backup/list] Unexpected error:', err);
    return NextResponse.json({ error: 'Could not list backups' }, { status: 500 });
  }
}

'use client';
// ============================================================
// Business OS — useSupabaseRealtime
//
// Generic wrapper around Supabase Realtime postgres_changes with:
//   - typed row payload (TRow generic, constrained to object)
//   - automatic channel cleanup on unmount
//   - callback refs so the effect doesn't restart on every render
//     when parents pass fresh callback references each render
//
// Callers still have to memoize the `filter` string; that's the only
// value that genuinely needs to trigger a resubscription when changed.
//
// Usage:
//   useSupabaseRealtime<Lead>({
//     table: 'leads',
//     filter: `user_id=eq.${ownerId}`,
//     onInsert: row => setLeads(prev => [row, ...prev]),
//     onUpdate: row => setLeads(prev => prev.map(l => l.id === row.id ? row : l)),
//     onDelete: old => setLeads(prev => prev.filter(l => l.id !== old.id)),
//   });
// ============================================================

import { useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import type {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
} from '@supabase/supabase-js';

export type RealtimeEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

// Supabase's RealtimePostgresChangesPayload requires T to be an index-signature
// object — we constrain the generic the same way so callers can pass domain
// types like `Lead` directly without wrapping them.
type AnyRow = { [key: string]: unknown };

export interface UseRealtimeOptions<TRow extends AnyRow> {
  /** Postgres table name (must have realtime enabled in Supabase). */
  table: string;
  /** Event to listen for. Default: '*' (all events). */
  event?: RealtimeEvent;
  /**
   * Postgres row-filter string (e.g. `user_id=eq.${ownerId}`).
   * CRITICAL for security — without it, the subscription receives
   * changes from every row in the table, not just the caller's rows.
   */
  filter?: string;
  /** Unique channel name. If omitted, one is derived from table+filter. */
  channelName?: string;
  onInsert?: (row: TRow) => void;
  onUpdate?: (row: TRow) => void;
  /** DELETE payloads only include the primary key(s) — typed Partial. */
  onDelete?: (oldRow: Partial<TRow>) => void;
  /** When false, no subscription is created. Default: true. */
  enabled?: boolean;
}

export function useSupabaseRealtime<TRow extends AnyRow>({
  table,
  event = '*',
  filter,
  channelName,
  onInsert,
  onUpdate,
  onDelete,
  enabled = true,
}: UseRealtimeOptions<TRow>): void {
  // Latest callbacks in refs — parents can pass fresh closures every render
  // without causing resubscribes (which would drop events during the gap).
  const onInsertRef = useRef(onInsert);
  const onUpdateRef = useRef(onUpdate);
  const onDeleteRef = useRef(onDelete);

  useEffect(() => { onInsertRef.current = onInsert; }, [onInsert]);
  useEffect(() => { onUpdateRef.current = onUpdate; }, [onUpdate]);
  useEffect(() => { onDeleteRef.current = onDelete; }, [onDelete]);

  // Stable supabase client ref — not recreated on render.
  const supabaseRef = useRef(createClient());

  useEffect(() => {
    if (!enabled) return;

    const supabase = supabaseRef.current;
    const name = channelName ?? `realtime:${table}:${event}:${filter ?? 'all'}`;

    const channel: RealtimeChannel = supabase
      .channel(name)
      .on<TRow>(
        'postgres_changes',
        { event, schema: 'public', table, filter },
        (payload: RealtimePostgresChangesPayload<TRow>) => {
          // Narrowing by eventType — supabase types `new` and `old` as {} when
          // not present for that event, which is why we check per-branch.
          if (payload.eventType === 'INSERT') {
            onInsertRef.current?.(payload.new);
          } else if (payload.eventType === 'UPDATE') {
            onUpdateRef.current?.(payload.new);
          } else if (payload.eventType === 'DELETE') {
            onDeleteRef.current?.(payload.old);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, event, filter, channelName, enabled]);
}

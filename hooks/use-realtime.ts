'use client';

import { useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface UseRealtimeOptions {
  table: string;
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  filter?: string;
  onInsert?: (record: Record<string, unknown>) => void;
  onUpdate?: (record: Record<string, unknown>) => void;
  onDelete?: (oldRecord: Record<string, unknown>) => void;
  enabled?: boolean;
}

export function useSupabaseRealtime({
  table,
  event = '*',
  filter,
  onInsert,
  onUpdate,
  onDelete,
  enabled = true,
}: UseRealtimeOptions) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  // Stable client ref — created once, never recreated on render
  const supabaseRef = useRef(createClient());

  useEffect(() => {
    if (!enabled) return;

    const supabase = supabaseRef.current;
    const channelName = `realtime-${table}-${Date.now()}`;

    const channelConfig: {
      event: string;
      schema: string;
      table: string;
      filter?: string;
    } = {
      event,
      schema: 'public',
      table,
    };

    if (filter) channelConfig.filter = filter;

    channelRef.current = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        channelConfig,
        (payload) => {
          if (payload.eventType === 'INSERT' && onInsert)
            onInsert(payload.new as Record<string, unknown>);
          if (payload.eventType === 'UPDATE' && onUpdate)
            onUpdate(payload.new as Record<string, unknown>);
          if (payload.eventType === 'DELETE' && onDelete)
            onDelete(payload.old as Record<string, unknown>);
        },
      )
      .subscribe();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
    // onInsert/onUpdate/onDelete intentionally excluded — callers should memoize callbacks
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, event, filter, enabled]);
}

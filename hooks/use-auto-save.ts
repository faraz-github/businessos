'use client';
// ============================================================
// Business OS — useAutoSave
//
// Debounced auto-save for forms. Saves at a fixed interval AND
// on window blur. Skips the save when the serialized data hasn't
// changed since the last successful save (avoids spamming the
// server with identical writes).
//
// Usage:
//   const { save } = useAutoSave({
//     data: formValues,
//     onSave: async v => { await saveDraftAction(v); },
//     interval: 30000,
//   });
//
// The onSave callback should be stable (wrapped in useCallback)
// or memoized — the hook reads the latest callback via a ref, so
// a changing reference won't cause the timer to restart.
// ============================================================

import { useEffect, useRef, useCallback } from 'react';

export interface UseAutoSaveOptions<T> {
  /** The value to watch and save. Serialized with JSON.stringify for equality. */
  data: T;
  /** Called with the latest data when a save fires. Must be async. */
  onSave: (data: T) => Promise<void>;
  /** Interval between auto-saves in ms. Default: 30000 (30s). */
  interval?: number;
  /** When false, the hook is a no-op. Default: true. */
  enabled?: boolean;
}

export interface UseAutoSaveResult {
  /** Manually trigger a save. Respects the "unchanged since last save" check. */
  save: () => Promise<void>;
}

export function useAutoSave<T>({
  data,
  onSave,
  interval = 30000,
  enabled = true,
}: UseAutoSaveOptions<T>): UseAutoSaveResult {
  // Serialized snapshot of the last successfully saved value — lets us
  // skip no-op writes. Deliberately stored as a string so we don't hold
  // a reference to the user's old data object.
  const savedDataRef = useRef<string>('');
  // Latest data + callback in refs so the save closure always sees
  // current values without restarting the interval on every keystroke.
  const dataRef = useRef<T>(data);
  const onSaveRef = useRef<(data: T) => Promise<void>>(onSave);

  useEffect(() => { dataRef.current = data; }, [data]);
  useEffect(() => { onSaveRef.current = onSave; }, [onSave]);

  const save = useCallback(async (): Promise<void> => {
    const serialized = JSON.stringify(dataRef.current);
    if (serialized === savedDataRef.current) return;
    try {
      await onSaveRef.current(dataRef.current);
      savedDataRef.current = serialized;
    } catch (error) {
      console.error('[useAutoSave] Save failed:', error);
    }
  }, []);

  // Interval save
  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(() => { void save(); }, interval);
    return () => clearInterval(timer);
  }, [save, interval, enabled]);

  // Blur save — catches the user tabbing away before the interval fires
  useEffect(() => {
    if (!enabled) return;
    const handleBlur = (): void => { void save(); };
    window.addEventListener('blur', handleBlur);
    return () => window.removeEventListener('blur', handleBlur);
  }, [save, enabled]);

  return { save };
}

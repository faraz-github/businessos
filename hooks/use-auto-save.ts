'use client';

import { useEffect, useRef, useCallback } from 'react';

interface UseAutoSaveOptions {
  data: unknown;
  onSave: (data: unknown) => Promise<void>;
  interval?: number; // ms, default 30000 (30 seconds)
  enabled?: boolean;
}

export function useAutoSave({ data, onSave, interval = 30000, enabled = true }: UseAutoSaveOptions) {
  const savedDataRef = useRef<string>('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const save = useCallback(async () => {
    const serialized = JSON.stringify(data);
    if (serialized !== savedDataRef.current) {
      try {
        await onSave(data);
        savedDataRef.current = serialized;
      } catch (error) {
        console.error('Auto-save failed:', error);
      }
    }
  }, [data, onSave]);

  // Interval-based save
  useEffect(() => {
    if (!enabled) return;

    timerRef.current = setInterval(save, interval);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [save, interval, enabled]);

  // Save on blur
  useEffect(() => {
    if (!enabled) return;

    const handleBlur = () => save();
    window.addEventListener('blur', handleBlur);
    return () => window.removeEventListener('blur', handleBlur);
  }, [save, enabled]);

  return { save };
}

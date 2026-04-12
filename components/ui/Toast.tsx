'use client';
// ============================================================
// Business OS — Toast Notification System
// Lightweight, zero-dependency, design-system-consistent.
// Usage:
//   import { toast } from '@/components/ui/Toast';
//   toast.success('Lead saved');
//   toast.error('Failed to save — try again');
//   toast.info('Link copied');
// ============================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { Check, X, AlertCircle, Info } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
}

// ── Singleton event bus ──
const listeners = new Set<(item: ToastItem) => void>();

function emit(item: ToastItem) {
  listeners.forEach(fn => fn(item));
}

export const toast = {
  success: (message: string) => emit({ id: crypto.randomUUID(), type: 'success', message }),
  error:   (message: string) => emit({ id: crypto.randomUUID(), type: 'error',   message }),
  info:    (message: string) => emit({ id: crypto.randomUUID(), type: 'info',     message }),
};

// ── Config per type ──
const TOAST_CONFIG: Record<ToastType, { icon: React.ReactNode; bg: string; border: string; color: string }> = {
  success: {
    icon: <Check size={13} />,
    bg:     'var(--bg-elevated)',
    border: 'var(--accent-green)',
    color:  'var(--accent-green)',
  },
  error: {
    icon: <AlertCircle size={13} />,
    bg:     'var(--bg-elevated)',
    border: 'var(--accent-red)',
    color:  'var(--accent-red)',
  },
  info: {
    icon: <Info size={13} />,
    bg:     'var(--bg-elevated)',
    border: 'var(--accent-blue)',
    color:  'var(--accent-blue)',
  },
};

const AUTO_DISMISS_MS = 3500;

// ── Container component (rendered once in layout) ──
export function ToastContainer() {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setItems(prev => prev.filter(t => t.id !== id));
  }, []);

  useEffect(() => {
    function handler(item: ToastItem) {
      setItems(prev => [...prev.slice(-4), item]); // max 5 toasts
      const t = setTimeout(() => dismiss(item.id), AUTO_DISMISS_MS);
      timers.current.set(item.id, t);
    }
    listeners.add(handler);
    return () => {
      listeners.delete(handler);
      timers.current.forEach(t => clearTimeout(t));
    };
  }, [dismiss]);

  if (items.length === 0) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
      display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end',
      pointerEvents: 'none',
    }}>
      {items.map(item => {
        const cfg = TOAST_CONFIG[item.type];
        return (
          <div key={item.id}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 14px',
              background: cfg.bg,
              border: `1px solid ${cfg.border}`,
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-elevated)',
              maxWidth: 340, minWidth: 200,
              pointerEvents: 'auto',
              animation: 'toast-in 200ms cubic-bezier(0,0,0.2,1)',
            }}>
            <span style={{ color: cfg.color, flexShrink: 0, display: 'flex' }}>{cfg.icon}</span>
            <span style={{ fontSize: 12, fontFamily: 'var(--font-body)', color: 'var(--text-primary)', flex: 1, lineHeight: 1.4 }}>
              {item.message}
            </span>
            <button
              onClick={() => dismiss(item.id)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex', padding: 0, flexShrink: 0, transition: 'color 150ms' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; }}>
              <X size={11} />
            </button>
          </div>
        );
      })}
      <style>{`
        @keyframes toast-in {
          from { opacity: 0; transform: translateY(8px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}

'use client';

import { useBrand } from '@/lib/brand';
import { User, Building2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';

export function ModeSwitch()): JSX.Element {
  const { mode, setMode } = useBrand();
  const router = useRouter();

  function handleModeChange(newMode: 'personal' | 'agency') {
    setMode(newMode);
    router.push(newMode === 'personal' ? '/dashboard/personal/home' : '/dashboard/agency/home');
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      background: 'var(--bg-hover)',
      borderRadius: 'var(--radius-md)',
      padding: 3,
      gap: 2,
      width: '100%',
    }}>
      {(['personal', 'agency'] as const).map(m => {
        const isActive = mode === m;
        return (
          <button
            key={m}
            onClick={() => handleModeChange(m)}
            style={{
              position: 'relative',
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 5,
              padding: '6px 8px',   /* compact — not dominating the sidebar */
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              cursor: 'pointer',
              background: 'transparent',
              fontSize: 12,
              fontFamily: 'var(--font-body)',
              fontWeight: 500,
              color: isActive ? 'var(--text-primary)' : 'var(--text-tertiary)',
              transition: 'color 150ms',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; }}
            onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; }}
          >
            {isActive && (
              <motion.div
                layoutId="mode-indicator"
                style={{
                  position: 'absolute', inset: 0,
                  background: 'var(--bg-surface)',
                  borderRadius: 'var(--radius-sm)',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.12), 0 0 0 1px var(--border-subtle)',
                }}
                transition={{ duration: 0.18, ease: [0, 0, 0.2, 1] }}
              />
            )}
            <span style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 5 }}>
              {m === 'personal' ? <User size={12} /> : <Building2 size={12} />}
              <span style={{ textTransform: 'capitalize' }}>{m}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

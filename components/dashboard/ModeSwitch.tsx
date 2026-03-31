'use client';

import { useBrand } from '@/lib/brand';
import { cn } from '@/lib/utils';
import { User, Building2 } from 'lucide-react';
import { motion } from 'framer-motion';

export function ModeSwitch() {
  const { mode, setMode } = useBrand();

  return (
    <div className="flex items-center bg-[var(--bg-hover)] rounded-[var(--radius-md)] p-[3px] w-full">
      <button
        onClick={() => setMode('personal')}
        className={cn(
          'flex-1 flex items-center justify-center gap-1.5 py-[6px] rounded-[7px] text-[11px] font-medium transition-all duration-[var(--duration-fast)] relative',
          mode === 'personal'
            ? 'text-[var(--text-primary)]'
            : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]',
        )}
      >
        {mode === 'personal' && (
          <motion.div
            layoutId="mode-indicator"
            className="absolute inset-0 bg-[var(--bg-surface)] rounded-[7px] shadow-[0_1px_3px_rgba(0,0,0,0.2)]"
            transition={{ duration: 0.2, ease: [0, 0, 0.2, 1] }}
          />
        )}
        <span className="relative z-10 flex items-center gap-1.5">
          <User size={12} />
          Personal
        </span>
      </button>
      <button
        onClick={() => setMode('agency')}
        className={cn(
          'flex-1 flex items-center justify-center gap-1.5 py-[6px] rounded-[7px] text-[11px] font-medium transition-all duration-[var(--duration-fast)] relative',
          mode === 'agency'
            ? 'text-[var(--text-primary)]'
            : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]',
        )}
      >
        {mode === 'agency' && (
          <motion.div
            layoutId="mode-indicator"
            className="absolute inset-0 bg-[var(--bg-surface)] rounded-[7px] shadow-[0_1px_3px_rgba(0,0,0,0.2)]"
            transition={{ duration: 0.2, ease: [0, 0, 0.2, 1] }}
          />
        )}
        <span className="relative z-10 flex items-center gap-1.5">
          <Building2 size={12} />
          Agency
        </span>
      </button>
    </div>
  );
}

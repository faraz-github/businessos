'use client';

import { useBrand } from '@/lib/brand';
import { User, Building2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';

export function ModeSwitch() {
  const { mode, setMode } = useBrand();
  const router = useRouter();

  function handleModeChange(newMode: 'personal' | 'agency') {
    setMode(newMode);
    router.push(newMode === 'personal' ? '/dashboard/personal/home' : '/dashboard/agency/home');
  }

  return (
    <div className="flex items-center bg-hover radius-md p-[3px] w-full mb-0.5">
      {(['personal', 'agency'] as const).map(m => {
        const isActive = mode === m;
        return (
          <button
            key={m}
            onClick={() => handleModeChange(m)}
            className={`relative flex-1 flex items-center justify-center gap-1.5 py-2 radius-sm t-xs font-medium interactive ${
              isActive ? 'text-primary' : 'text-tertiary hover-text-secondary'
            }`}
            style={{ border: 'none', cursor: 'pointer', background: 'transparent' }}
          >
            {isActive && (
              <motion.div
                layoutId="mode-indicator"
                className="absolute inset-0 bg-surface radius-sm shadow-[0_1px_4px_rgba(0,0,0,0.25)]"
                transition={{ duration: 0.2, ease: [0, 0, 0.2, 1] }}
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5">
              {m === 'personal' ? <User size={13} /> : <Building2 size={13} />}
              {m === 'personal' ? 'Personal' : 'Agency'}
            </span>
          </button>
        );
      })}
    </div>
  );
}

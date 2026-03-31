'use client';

import { cn } from '@/lib/utils';

interface Tab {
  value: string;
  label: string;
}

interface TabsProps {
  tabs: Tab[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function Tabs({ tabs, value, onChange, className }: TabsProps) {
  return (
    <div
      className={cn(
        'flex gap-0.5 bg-[var(--bg-hover)] p-[3px] rounded-[var(--radius-md)] w-fit',
        className,
      )}
    >
      {tabs.map((tab) => (
        <button
          key={tab.value}
          onClick={() => onChange(tab.value)}
          className={cn(
            'px-3 py-[5px] rounded-[7px] text-xs font-medium cursor-pointer transition-all duration-[var(--duration-fast)]',
            tab.value === value
              ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-[0_1px_3px_rgba(0,0,0,0.2)]'
              : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]',
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

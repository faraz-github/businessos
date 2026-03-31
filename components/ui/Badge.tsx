import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

type BadgeVariant = 'blue' | 'green' | 'amber' | 'red' | 'violet' | 'outline';

interface BadgeProps {
  variant?: BadgeVariant;
  dot?: boolean;
  children: ReactNode;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  blue: 'bg-[var(--accent-blue-dim)] text-[var(--accent-blue)]',
  green: 'bg-[var(--accent-green-dim)] text-[var(--accent-green)]',
  amber: 'bg-[var(--accent-amber-dim)] text-[var(--accent-amber)]',
  red: 'bg-[var(--accent-red-dim)] text-[var(--accent-red)]',
  violet: 'bg-[var(--accent-violet-dim)] text-[var(--accent-violet)]',
  outline: 'border border-[var(--border-default)] text-[var(--text-secondary)]',
};

export function Badge({ variant = 'blue', dot = false, children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2.5 py-[3px] rounded-full text-[11px] font-medium leading-none',
        variantStyles[variant],
        className,
      )}
    >
      {dot && (
        <span className="w-[5px] h-[5px] rounded-full bg-current shrink-0" />
      )}
      {children}
    </span>
  );
}

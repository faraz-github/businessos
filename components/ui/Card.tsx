import { cn } from '@/lib/utils';
import type { ReactNode, HTMLAttributes } from 'react';

type CardVariant = 'base' | 'elevated' | 'metric';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  children: ReactNode;
}

const variantStyles: Record<CardVariant, string> = {
  base: 'bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-[var(--radius-lg)] p-5 shadow-[var(--shadow-card)]',
  elevated:
    'bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-[var(--radius-xl)] p-6 shadow-[var(--shadow-elevated)]',
  metric:
    'bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-[var(--radius-lg)] px-5 py-4 shadow-[var(--shadow-card)]',
};

export function Card({ variant = 'base', children, className, ...props }: CardProps) {
  return (
    <div className={cn(variantStyles[variant], className)} {...props}>
      {children}
    </div>
  );
}

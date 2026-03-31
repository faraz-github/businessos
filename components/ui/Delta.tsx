import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DeltaProps {
  value: number; // percentage change
  suffix?: string;
  className?: string;
}

export function Delta({ value, suffix = '%', className }: DeltaProps) {
  const isUp = value > 0;
  const isDown = value < 0;
  const Icon = isUp ? TrendingUp : isDown ? TrendingDown : Minus;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-[11px] font-medium',
        isUp && 'text-[var(--accent-green)]',
        isDown && 'text-[var(--accent-red)]',
        !isUp && !isDown && 'text-[var(--text-tertiary)]',
        className,
      )}
    >
      <Icon size={12} />
      {isUp && '+'}
      {value}
      {suffix}
    </span>
  );
}

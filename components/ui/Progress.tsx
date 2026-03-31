import { cn } from '@/lib/utils';

interface ProgressProps {
  value: number; // 0-100
  color?: string;
  className?: string;
  label?: string;
}

export function Progress({ value, color = 'var(--accent-blue)', className, label }: ProgressProps) {
  const clampedValue = Math.min(100, Math.max(0, value));

  return (
    <div className={className}>
      {label && (
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] text-[var(--text-tertiary)]">{label}</span>
          <span className="text-[11px] font-medium text-[var(--text-secondary)] font-[family-name:var(--font-mono)]">
            {Math.round(clampedValue)}%
          </span>
        </div>
      )}
      <div className="h-1 bg-[var(--bg-hover)] rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-[width] duration-600 ease-[var(--ease-out)]')}
          style={{ width: `${clampedValue}%`, background: color }}
        />
      </div>
    </div>
  );
}

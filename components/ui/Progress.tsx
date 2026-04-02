interface ProgressProps {
  value: number;
  color?: string;
  className?: string;
  label?: string;
}

export function Progress({ value, color = 'var(--accent-blue)', className = '', label }: ProgressProps) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div className={className}>
      {label && (
        <div className="flex items-center justify-between mb-1.5">
          <span className="t-label">{label}</span>
          <span className="t-mono-sm">{Math.round(clamped)}%</span>
        </div>
      )}
      <div className="h-1 bg-hover rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${clamped}%`, background: color }}
        />
      </div>
    </div>
  );
}

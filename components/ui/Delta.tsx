import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface DeltaProps {
  value: number;
  suffix?: string;
  className?: string;
}

export function Delta({ value, suffix = '%', className = '' }: DeltaProps) {
  const isUp = value > 0;
  const isDown = value < 0;
  const Icon = isUp ? TrendingUp : isDown ? TrendingDown : Minus;
  const colorClass = isUp ? 'text-accent-green' : isDown ? 'text-accent-red' : 'text-tertiary';

  return (
    <span className={`inline-flex items-center gap-1 t-2xs ${colorClass} ${className}`}>
      <Icon size={12} />
      {isUp && '+'}{value}{suffix}
    </span>
  );
}

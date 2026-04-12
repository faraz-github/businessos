import type { ReactNode } from 'react';

type BadgeVariant = 'blue' | 'green' | 'amber' | 'red' | 'violet' | 'outline';

interface BadgeProps {
  variant?: BadgeVariant;
  dot?: boolean;
  children: ReactNode;
  className?: string;
}

const variantClass: Record<BadgeVariant, string> = {
  blue:    'badge badge-blue',
  green:   'badge badge-green',
  amber:   'badge badge-amber',
  red:     'badge badge-red',
  violet:  'badge badge-violet',
  outline: 'badge border-default text-secondary',
};

export function Badge({ variant = 'blue', dot = false, children, className }: BadgeProps) {
  return (
    <span className={`${variantClass[variant]}${className ? ' ' + className : ''}`}>
      {dot && <span className="block w-[5px] h-[5px] rounded-full bg-current shrink-0 mr-1" />}
      {children}
    </span>
  );
}

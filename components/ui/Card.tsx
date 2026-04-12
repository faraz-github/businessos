import type { ReactNode, HTMLAttributes } from 'react';

type CardVariant = 'base' | 'elevated' | 'metric';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  children: ReactNode;
}

// CSS classes .card, .card-elevated, .card-metric already include padding
const variantClass: Record<CardVariant, string> = {
  base:     'card',
  elevated: 'card-elevated',
  metric:   'card-metric',
};

export function Card({ variant = 'base', children, className = '', ...props }: CardProps)): JSX.Element {
  return (
    <div className={`${variantClass[variant]} ${className}`} {...props}>
      {children}
    </div>
  );
}

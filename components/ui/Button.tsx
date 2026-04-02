'use client';

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  iconRight?: ReactNode;
  loading?: boolean;
  children: ReactNode;
}

// Height targets: sm=30px, md=38px (matches input), lg=44px
const sizes: Record<ButtonSize, React.CSSProperties> = {
  sm: { padding: '5px 10px', fontSize: 11, borderRadius: 'var(--radius-sm)', gap: 4 },
  md: { padding: '9px 16px', fontSize: 13, borderRadius: 'var(--radius-md)', gap: 6 },
  lg: { padding: '11px 22px', fontSize: 14, borderRadius: 'var(--radius-lg)', gap: 8 },
};

const variants: Record<ButtonVariant, React.CSSProperties & { hoverStyle?: React.CSSProperties }> = {
  primary:   { background: 'var(--accent-blue)', color: '#fff' },
  secondary: { background: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border-default)' },
  ghost:     { background: 'transparent', color: 'var(--text-secondary)' },
  danger:    { background: 'var(--accent-red-dim)', color: 'var(--accent-red)', border: '1px solid var(--accent-red-dim)' },
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', icon, iconRight, loading, children, className, disabled, style, ...props }, ref) => {
    const sizeStyle = sizes[size];
    const variantStyle = variants[variant];

    const baseStyle: React.CSSProperties = {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'var(--font-body)',
      fontWeight: 600,
      lineHeight: 1,
      border: 'none',
      cursor: disabled || loading ? 'not-allowed' : 'pointer',
      opacity: disabled || loading ? 0.5 : 1,
      transition: 'opacity 150ms, transform 150ms, background 150ms, border-color 150ms',
      whiteSpace: 'nowrap',
      flexShrink: 0,
      ...sizeStyle,
      ...variantStyle,
      ...style,
    };

    function handleMouseEnter(e: React.MouseEvent<HTMLButtonElement>) {
      if (disabled || loading) return;
      const el = e.currentTarget;
      if (variant === 'primary') el.style.opacity = '0.88';
      if (variant === 'secondary') { el.style.borderColor = 'var(--border-strong)'; el.style.background = 'var(--bg-hover)'; }
      if (variant === 'ghost') { el.style.background = 'var(--bg-hover)'; el.style.color = 'var(--text-primary)'; }
      if (variant === 'danger') el.style.opacity = '0.88';
    }

    function handleMouseLeave(e: React.MouseEvent<HTMLButtonElement>) {
      const el = e.currentTarget;
      el.style.opacity = disabled || loading ? '0.5' : '1';
      if (variant === 'secondary') { el.style.borderColor = 'var(--border-default)'; el.style.background = 'var(--bg-elevated)'; }
      if (variant === 'ghost') { el.style.background = 'transparent'; el.style.color = 'var(--text-secondary)'; }
    }

    return (
      <button
        ref={ref}
        style={baseStyle}
        className={className}
        disabled={disabled || loading}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        {...props}
      >
        {loading ? (
          <svg style={{ animation: 'spin 0.8s linear infinite', width: 14, height: 14 }} viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32" strokeLinecap="round" opacity="0.3" />
            <path fill="currentColor" d="M12 2a10 10 0 0 1 10 10h-3a7 7 0 0 0-7-7V2z" />
          </svg>
        ) : icon ? (
          <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>{icon}</span>
        ) : null}
        {children}
        {iconRight && (
          <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>{iconRight}</span>
        )}
      </button>
    );
  },
);
Button.displayName = 'Button';

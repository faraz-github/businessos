'use client';

import { forwardRef, type InputHTMLAttributes, type CSSProperties } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

const inputBase: CSSProperties = {
  width: '100%',
  background: 'var(--bg-input)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-md)',
  padding: '9px 12px',
  fontSize: 13,
  fontFamily: 'var(--font-body)',
  color: 'var(--text-primary)',
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 150ms, box-shadow 150ms',
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className, id, style, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="t-label">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          style={{
            ...inputBase,
            borderColor: error ? 'var(--accent-red)' : undefined,
            ...style,
          }}
          className={className}
          onFocus={e => {
            e.target.style.borderColor = error ? 'var(--accent-red)' : 'var(--accent-blue)';
            e.target.style.boxShadow = error
              ? '0 0 0 3px var(--accent-red-dim)'
              : '0 0 0 3px var(--accent-blue-glow)';
          }}
          onBlur={e => {
            e.target.style.borderColor = error ? 'var(--accent-red)' : 'var(--border-default)';
            e.target.style.boxShadow = 'none';
          }}
          {...props}
        />
        {error && <p className="t-2xs text-accent-red mt-0.5">{error}</p>}
        {hint && !error && <p className="t-2xs text-tertiary mt-0.5">{hint}</p>}
      </div>
    );
  },
);
Input.displayName = 'Input';

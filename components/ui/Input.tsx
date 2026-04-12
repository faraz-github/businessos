'use client';

import { forwardRef, type InputHTMLAttributes, type CSSProperties, type FocusEvent } from 'react';

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
  ({ label, error, hint, className, id, style, onFocus, onBlur, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

    function handleFocus(e: FocusEvent<HTMLInputElement>) {
      e.target.style.borderColor = error ? 'var(--accent-red)' : 'var(--accent-blue)';
      e.target.style.boxShadow  = error
        ? '0 0 0 3px var(--accent-red-dim)'
        : '0 0 0 3px var(--accent-blue-glow)';
      onFocus?.(e);  // call any onFocus passed in (e.g. from react-hook-form)
    }

    function handleBlur(e: FocusEvent<HTMLInputElement>) {
      e.target.style.borderColor = error ? 'var(--accent-red)' : 'var(--border-default)';
      e.target.style.boxShadow   = 'none';
      onBlur?.(e);   // call any onBlur passed in (e.g. from react-hook-form validation)
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
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
          onFocus={handleFocus}
          onBlur={handleBlur}
          {...props}
        />
        {error && <p className="t-2xs text-accent-red">{error}</p>}
        {hint && !error && <p className="t-2xs text-tertiary">{hint}</p>}
      </div>
    );
  },
);
Input.displayName = 'Input';

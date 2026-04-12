'use client';

import { forwardRef, type SelectHTMLAttributes, type CSSProperties, type FocusEvent } from 'react';

interface Option { value: string; label: string; }

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: Option[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, placeholder, className, id, style, onFocus, onBlur, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

    function handleFocus(e: FocusEvent<HTMLSelectElement>) {
      e.target.style.borderColor = error ? 'var(--accent-red)' : 'var(--accent-blue)';
      e.target.style.boxShadow   = error ? '0 0 0 3px var(--accent-red-dim)' : '0 0 0 3px var(--accent-blue-glow)';
      onFocus?.(e);
    }

    function handleBlur(e: FocusEvent<HTMLSelectElement>) {
      e.target.style.borderColor = error ? 'var(--accent-red)' : 'var(--border-default)';
      e.target.style.boxShadow   = 'none';
      onBlur?.(e);
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {label && <label htmlFor={inputId} className="t-label">{label}</label>}
        <select
          ref={ref}
          id={inputId}
          style={{
            width: '100%',
            background: 'var(--bg-input)',
            border: `1px solid ${error ? 'var(--accent-red)' : 'var(--border-default)'}`,
            borderRadius: 'var(--radius-md)',
            padding: '9px 12px',
            fontSize: 13,
            fontFamily: 'var(--font-body)',
            color: 'var(--text-primary)',
            outline: 'none',
            cursor: 'pointer',
            boxSizing: 'border-box',
            appearance: 'none',
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238892A4' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 12px center',
            paddingRight: 36,
            transition: 'border-color 150ms, box-shadow 150ms',
            ...style,
          }}
          className={className}
          onFocus={handleFocus}
          onBlur={handleBlur}
          {...props}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        {error && <p className="t-2xs text-accent-red">{error}</p>}
      </div>
    );
  },
);
Select.displayName = 'Select';

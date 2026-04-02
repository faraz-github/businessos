'use client';

import { forwardRef, type SelectHTMLAttributes, type CSSProperties } from 'react';

interface SelectOption { value: string; label: string; }
interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: SelectOption[];
  placeholder?: string;
}

const CHEVRON = `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%238892A4' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`;

const selectBase: CSSProperties = {
  width: '100%',
  background: 'var(--bg-input)',
  backgroundImage: CHEVRON,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 12px center',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-md)',
  padding: '9px 36px 9px 12px',
  fontSize: 13,
  fontFamily: 'var(--font-body)',
  color: 'var(--text-primary)',
  outline: 'none',
  appearance: 'none',
  cursor: 'pointer',
  boxSizing: 'border-box',
  transition: 'border-color 150ms, box-shadow 150ms',
};

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, placeholder, className, id, style, ...props }, ref) => {
    const selectId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={selectId} className="t-label">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          style={{
            ...selectBase,
            borderColor: error ? 'var(--accent-red)' : undefined,
            ...style,
          }}
          className={className}
          onFocus={e => {
            e.target.style.borderColor = 'var(--accent-blue)';
            e.target.style.boxShadow = '0 0 0 3px var(--accent-blue-glow)';
          }}
          onBlur={e => {
            e.target.style.borderColor = error ? 'var(--accent-red)' : 'var(--border-default)';
            e.target.style.boxShadow = 'none';
          }}
          {...props}
        >
          {placeholder && <option value="" disabled>{placeholder}</option>}
          {options.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        {error && <p className="t-2xs text-accent-red mt-0.5">{error}</p>}
      </div>
    );
  },
);
Select.displayName = 'Select';

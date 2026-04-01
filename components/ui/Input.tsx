'use client';

import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--text-tertiary)] font-body"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[var(--radius-md)]',
            'px-3 py-2 text-[13px] text-[var(--text-primary)] font-body',
            'outline-none transition-all duration-[var(--duration-fast)]',
            'placeholder:text-[var(--text-tertiary)]',
            'focus:border-[var(--accent-blue)] focus:shadow-[0_0_0_3px_var(--accent-blue-glow)]',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'w-full',
            error && 'border-[var(--accent-red)] focus:border-[var(--accent-red)] focus:shadow-[0_0_0_3px_var(--accent-red-dim)]',
            className,
          )}
          {...props}
        />
        {error && (
          <p className="text-[11px] text-[var(--accent-red)] font-medium">{error}</p>
        )}
        {hint && !error && (
          <p className="text-[11px] text-[var(--text-tertiary)]">{hint}</p>
        )}
      </div>
    );
  },
);
Input.displayName = 'Input';

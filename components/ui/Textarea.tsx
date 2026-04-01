'use client';

import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className, id, ...props }, ref) => {
    const textareaId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={textareaId}
            className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--text-tertiary)] font-body"
          >
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          className={cn(
            'bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[var(--radius-md)]',
            'px-3 py-2 text-[13px] text-[var(--text-primary)] font-body',
            'outline-none transition-all duration-[var(--duration-fast)]',
            'placeholder:text-[var(--text-tertiary)]',
            'focus:border-[var(--accent-blue)] focus:shadow-[0_0_0_3px_var(--accent-blue-glow)]',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'w-full min-h-[80px] resize-y',
            error && 'border-[var(--accent-red)]',
            className,
          )}
          {...props}
        />
        {error && <p className="text-[11px] text-[var(--accent-red)] font-medium">{error}</p>}
      </div>
    );
  },
);
Textarea.displayName = 'Textarea';

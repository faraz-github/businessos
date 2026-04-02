'use client';

import { forwardRef, type TextareaHTMLAttributes, type CSSProperties } from 'react';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

const textareaBase: CSSProperties = {
  width: '100%',
  minHeight: 84,
  resize: 'vertical',
  background: 'var(--bg-input)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-md)',
  padding: '9px 12px',
  fontSize: 13,
  fontFamily: 'var(--font-body)',
  color: 'var(--text-primary)',
  outline: 'none',
  lineHeight: 1.6,
  boxSizing: 'border-box',
  transition: 'border-color 150ms, box-shadow 150ms',
};

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className, id, style, ...props }, ref) => {
    const textareaId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={textareaId} className="t-label">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          style={{
            ...textareaBase,
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
        />
        {error && <p className="t-2xs text-accent-red mt-0.5">{error}</p>}
      </div>
    );
  },
);
Textarea.displayName = 'Textarea';

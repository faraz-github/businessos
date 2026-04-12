'use client';

import { forwardRef, type TextareaHTMLAttributes, type CSSProperties, type FocusEvent } from 'react';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className, id, style, onFocus, onBlur, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

    function handleFocus(e: FocusEvent<HTMLTextAreaElement>) {
      e.target.style.borderColor = error ? 'var(--accent-red)' : 'var(--accent-blue)';
      e.target.style.boxShadow   = error ? '0 0 0 3px var(--accent-red-dim)' : '0 0 0 3px var(--accent-blue-glow)';
      onFocus?.(e);
    }

    function handleBlur(e: FocusEvent<HTMLTextAreaElement>) {
      e.target.style.borderColor = error ? 'var(--accent-red)' : 'var(--border-default)';
      e.target.style.boxShadow   = 'none';
      onBlur?.(e);
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {label && <label htmlFor={inputId} className="t-label">{label}</label>}
        <textarea
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
            resize: 'vertical',
            boxSizing: 'border-box',
            transition: 'border-color 150ms, box-shadow 150ms',
            lineHeight: 1.6,
            ...style,
          }}
          className={className}
          onFocus={handleFocus}
          onBlur={handleBlur}
          {...props}
        />
        {error && <p className="t-2xs text-accent-red">{error}</p>}
      </div>
    );
  },
);
Textarea.displayName = 'Textarea';

'use client';
// ============================================================
// Business OS — Error card (shared presentational component)
//
// Used by both DashboardErrorBoundary (client render errors) and
// app/dashboard/error.tsx (server errors + async throws). Pure
// presentation — no logic — so both entry points can focus on
// wiring errors in and rendering the same UI.
// ============================================================

import { AlertTriangle, RotateCcw } from 'lucide-react';

export interface ErrorCardProps {
  /** Short technical message to show in monospace — usually `error.message`. Omit to hide. */
  errorMessage?: string;
  /** Called when the user clicks "Try again". Typically resets React error state. */
  onReset: () => void;
  /** Headline — override if the default "Something went wrong" doesn't fit. */
  heading?: string;
  /** Body copy under the heading. */
  description?: string;
}

export function ErrorCard({
  errorMessage,
  onReset,
  heading = 'Something went wrong',
  description = 'This page ran into an unexpected error. Your data is safe — try reloading or navigating to another section.',
}: ErrorCardProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        padding: '40px 24px',
      }}
    >
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-xl)',
          padding: '40px 36px',
          maxWidth: 440,
          width: '100%',
          textAlign: 'center',
          boxShadow: 'var(--shadow-elevated)',
        }}
      >
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: '50%',
            background: 'var(--accent-red-dim)',
            color: 'var(--accent-red)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
          }}
        >
          <AlertTriangle size={22} />
        </div>

        <p
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 18,
            fontWeight: 800,
            color: 'var(--text-primary)',
            marginBottom: 10,
          }}
        >
          {heading}
        </p>

        <p
          style={{
            fontSize: 13,
            color: 'var(--text-secondary)',
            fontFamily: 'var(--font-body)',
            lineHeight: 1.6,
            marginBottom: 28,
          }}
        >
          {description}
        </p>

        {errorMessage && (
          <p
            style={{
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-tertiary)',
              background: 'var(--bg-hover)',
              borderRadius: 'var(--radius-sm)',
              padding: '8px 12px',
              marginBottom: 24,
              textAlign: 'left',
              wordBreak: 'break-word',
            }}
          >
            {errorMessage}
          </p>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              padding: '8px 16px',
              background: 'var(--accent-blue)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontSize: 13,
              fontWeight: 500,
              fontFamily: 'var(--font-body)',
              cursor: 'pointer',
            }}
          >
            <RotateCcw size={13} />
            Reload page
          </button>
          <button
            type="button"
            onClick={onReset}
            style={{
              flex: 1,
              padding: '8px 16px',
              background: 'var(--bg-elevated)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)',
              fontSize: 13,
              fontWeight: 500,
              fontFamily: 'var(--font-body)',
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}

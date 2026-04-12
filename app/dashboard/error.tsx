'use client';

// ============================================================
// app/dashboard/error.tsx
//
// Next.js route-level error boundary for the /dashboard segment.
// Catches errors thrown during server rendering and async RSC
// data fetching (e.g. a Server Action throwing unexpectedly).
//
// This is separate from DashboardErrorBoundary (which catches
// client-side render errors). Together they cover both paths:
//   - Server errors  → this file
//   - Client errors  → DashboardErrorBoundary in layout.tsx
// ============================================================

import { useEffect } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function DashboardError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error('[Dashboard error boundary]', error);
  }, [error]);

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
          Something went wrong
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
          This section failed to load. Your data is safe — try again or
          navigate to another section.
        </p>

        {error.message && (
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
            {error.message}
          </p>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button
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
            Reload
          </button>
          <button
            onClick={reset}
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

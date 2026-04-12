'use client';

// ============================================================
// Business OS — Dashboard Error Boundary
//
// React class component — the only way to catch render errors.
// Wraps the <main> content area in app/dashboard/layout.tsx so
// a crash in any dashboard page shows a recovery card instead
// of a blank screen.
// ============================================================

import { Component, type ReactNode, type ErrorInfo } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class DashboardErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error?.message || 'An unexpected error occurred.',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Log to console in dev; in production you'd send to an error tracker
    console.error('[DashboardErrorBoundary] Caught error:', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, errorMessage: '' });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

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
          {/* Icon */}
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

          {/* Heading */}
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

          {/* Message */}
          <p
            style={{
              fontSize: 13,
              color: 'var(--text-secondary)',
              fontFamily: 'var(--font-body)',
              lineHeight: 1.6,
              marginBottom: 28,
            }}
          >
            This page ran into an unexpected error. Your data is safe — try
            reloading or navigating to another section.
          </p>

          {/* Error detail — subtle, for debugging */}
          {this.state.errorMessage && (
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
              {this.state.errorMessage}
            </p>
          )}

          {/* Actions */}
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
              Reload page
            </button>
            <button
              onClick={this.handleReset}
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
}

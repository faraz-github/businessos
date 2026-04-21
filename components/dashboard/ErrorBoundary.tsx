'use client';
// ============================================================
// Business OS — Dashboard Error Boundary
//
// React class component — the only way to catch render errors
// in React 19 (no hook equivalent). Wraps the <main> content
// area in app/dashboard/layout.tsx so a crash in any dashboard
// page shows a recovery card instead of a blank screen.
//
// Pairs with app/dashboard/error.tsx which catches server-side
// errors (RSC throws, Server Action throws). Together they cover
// both paths.
// ============================================================

import { Component, type ReactNode, type ErrorInfo } from 'react';
import { ErrorCard } from './ErrorCard';

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

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // In production you'd forward this to a tracker (Sentry, etc.).
    console.error('[DashboardErrorBoundary] Caught error:', error, info.componentStack);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, errorMessage: '' });
  };

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;
    return (
      <ErrorCard
        errorMessage={this.state.errorMessage}
        onReset={this.handleReset}
      />
    );
  }
}

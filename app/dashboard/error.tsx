'use client';
// ============================================================
// app/dashboard/error.tsx
//
// Next.js route-level error boundary for the /dashboard segment.
// Catches errors thrown during server rendering and async RSC
// data fetching (e.g. a Server Action throwing unexpectedly).
//
// This is separate from DashboardErrorBoundary (which catches
// client-side render errors in components/dashboard/ErrorBoundary).
// Together they cover both paths:
//   - Server errors  → this file
//   - Client errors  → DashboardErrorBoundary in layout.tsx
// ============================================================

import { useEffect } from 'react';
import { ErrorCard } from '@/components/dashboard/ErrorCard';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function DashboardError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error('[Dashboard error boundary]', error);
  }, [error]);

  return (
    <ErrorCard
      errorMessage={error.message}
      onReset={reset}
      description="This section failed to load. Your data is safe — try again or navigate to another section."
    />
  );
}

// ============================================================
// Business OS — EmptyState
//
// Consistent "no data yet" placeholder for empty lists. Use this
// instead of ad-hoc "No results" paragraphs so every empty state
// in the app has the same shape — icon + title + description + CTA.
//
// Server-safe (no hooks, no event handlers beyond what the caller
// passes through `action`). Can be rendered from Server Components.
//
// Usage:
//   <EmptyState
//     icon={<Users />}
//     title="No clients yet"
//     description="Add your first client to start tracking projects."
//     action={<Button onClick={openAddModal}>Add client</Button>}
//   />
// ============================================================

import type { ReactNode } from 'react';

export interface EmptyStateProps {
  /** Optional icon — lucide-react recommended, sized to ~40px inside the wrapper. */
  icon?: ReactNode;
  title: string;
  description?: string;
  /** Optional CTA below the text. Typically a Button. */
  action?: ReactNode;
  /** Additional classes — appended to the default centering/padding. */
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center py-12 text-center ${className}`}
    >
      {icon && (
        // The arbitrary-value selector sizes any SVG child to 40px so callers
        // can pass a bare <Users /> without specifying size={40} themselves.
        <div className="mb-4 text-tertiary [&>svg]:w-10 [&>svg]:h-10">{icon}</div>
      )}
      <p className="t-sm-semibold mb-1">{title}</p>
      {description && <p className="t-xs max-w-xs">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

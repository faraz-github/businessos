// ============================================================
// Business OS — Shared access control logic
//
// Pure TypeScript — no Node.js, no browser, no server imports.
// Safe to import in:
//   - proxy.ts  (Next.js Edge middleware)
//   - lib/auth/use-auth.ts  (client components)
//   - any server utility
//
// Previously this logic was duplicated between proxy.ts and
// use-auth.ts with a comment warning not to let them drift.
// Single source of truth now.
// ============================================================

export interface AccessSession {
  role: string;
  allowedPersonal: string[] | null;
  allowedAgency: string[] | null;
}

/**
 * Returns true if the session has access to the given mode + section.
 * Superadmin always returns true.
 */
export function canAccessSection(
  session: AccessSession,
  mode: 'personal' | 'agency',
  section: string,
): boolean {
  if (session.role === 'superadmin') return true;
  const allowed = mode === 'personal' ? session.allowedPersonal : session.allowedAgency;
  if (!allowed) return false;
  return allowed.includes(section);
}

/**
 * Returns the first accessible route for a non-superadmin session,
 * or '/auth/login' if no sections are accessible.
 */
export function getDefaultRoute(session: AccessSession): string {
  if (session.allowedPersonal?.length) {
    return `/dashboard/personal/${session.allowedPersonal[0]}`;
  }
  if (session.allowedAgency?.length) {
    return `/dashboard/agency/${session.allowedAgency[0]}`;
  }
  return '/auth/login';
}

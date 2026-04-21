// ============================================================
// Business OS — Shared access control logic
//
// Pure TypeScript — no Node.js, no browser, no server imports.
// Safe to import in:
//   - proxy.ts                 (Next.js Edge middleware)
//   - lib/auth/use-auth.ts     (client components)
//   - lib/auth/session.ts      (server components / route handlers)
//   - any utility file
//
// Previously the section-access check was duplicated between proxy.ts
// (Edge) and use-auth.ts (browser) with a "if you change this, change
// the other one too" comment — exactly the kind of drift that bites
// six months later. Single source of truth now.
// ============================================================

/**
 * The minimal session shape needed to make access decisions.
 * Both BosSession (JWT payload) and CurrentUser (browser cache)
 * structurally satisfy this — no adapter needed at the call site.
 */
export interface AccessSession {
  role: string;
  allowedPersonal: string[] | null;
  allowedAgency: string[] | null;
}

/**
 * Returns true if the session has access to the given mode + section.
 * Superadmin always returns true.
 *
 * Note: `null` allowed lists mean "no access to this mode at all".
 * An empty array (`[]`) is currently treated the same as null, but
 * reserved for future use (e.g. "explicit zero sections allowed").
 */
export function canAccessSection(
  session: AccessSession,
  mode: 'personal' | 'agency',
  section: string,
): boolean {
  if (session.role === 'superadmin') return true;
  const allowed = mode === 'personal' ? session.allowedPersonal : session.allowedAgency;
  if (!allowed || allowed.length === 0) return false;
  return allowed.includes(section);
}

/**
 * Returns the first accessible route for a session, or '/auth/login' if
 * no sections are accessible at all. Used by the proxy to redirect users
 * whose default landing page they shouldn't be on (e.g. an admin user
 * hitting / when they don't have personal/home access).
 *
 * Superadmin always lands on personal home.
 */
export function getDefaultRoute(session: AccessSession): string {
  if (session.role === 'superadmin') return '/dashboard/personal/home';
  if (session.allowedPersonal?.length) {
    return `/dashboard/personal/${session.allowedPersonal[0]}`;
  }
  if (session.allowedAgency?.length) {
    return `/dashboard/agency/${session.allowedAgency[0]}`;
  }
  return '/auth/login';
}

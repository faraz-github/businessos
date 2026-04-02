import 'server-only';
// ============================================================
// Business OS — Session helpers (server-side only)
// ============================================================
import { cookies } from 'next/headers';
import { verifyToken, COOKIE_NAME, type BosSession } from './jwt';

/**
 * Get the current session from cookies. Returns null if not authenticated
 * or if the token is expired / invalid.
 * Server Components and Route Handlers only.
 */
export async function getSession(): Promise<BosSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

/**
 * Get session and throw a redirect-style error if not authenticated.
 * Use in Server Components that require auth.
 */
export async function requireSession(): Promise<BosSession> {
  const session = await getSession();
  if (!session) {
    throw new Error('UNAUTHENTICATED');
  }
  return session;
}

/**
 * Check whether the current user can access a given mode + section.
 * superadmin always returns true.
 */
export function canAccess(
  session: BosSession,
  mode: 'personal' | 'agency',
  section: string,
): boolean {
  if (session.role === 'superadmin') return true;
  const allowed = mode === 'personal' ? session.allowedPersonal : session.allowedAgency;
  if (!allowed) return false;
  return allowed.includes(section);
}

/**
 * List of all sections per mode — used for access control UI and checks.
 * Add new sections here as the app grows.
 */

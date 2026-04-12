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
 * Get the owner's user_id from a session.
 *
 * For superadmin: ownerId === session.sub (they own their own data).
 * For admin: ownerId === the superadmin who created them.
 *
 * The silent `session.ownerId ?? session.sub` fallback masked broken
 * sessions — old JWTs minted before ownerId was added to the schema
 * would silently query with the wrong ID and return no data.
 * This function surfaces that clearly instead of swallowing it.
 */
export function getOwnerId(session: BosSession): string {
  if (session.ownerId) return session.ownerId;
  // ownerId missing — JWT was minted before migration 004 added it.
  // Log a warning so it's visible in server logs, then fall back to sub.
  // This only affects sessions older than the migration date; they will
  // expire within 24h and re-issue correctly on next login.
  console.warn(
    `[auth] Session for user ${session.sub} (${session.email}) is missing ownerId. ` +
    `This JWT predates migration 004. Falling back to sub — data may not load correctly. ` +
    `Will resolve on next login.`,
  );
  return session.sub;
}


import 'server-only';
// ============================================================
// Business OS — Session helpers (server-side only)
// ============================================================
import { cookies } from 'next/headers';
import { verifyToken, COOKIE_NAME, type BosSession } from './jwt';
import { canAccessSection } from './access';

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
 * Delegates to the shared access utility so this stays in sync with
 * the client-side check in use-auth.ts and the Edge check in proxy.ts.
 */
export function canAccess(
  session: BosSession,
  mode: 'personal' | 'agency',
  section: string,
): boolean {
  return canAccessSection(session, mode, section);
}

/**
 * Get the owner's user_id from a session.
 *
 * For superadmin: ownerId === session.sub (they own their own data).
 * For admin:      ownerId === the superadmin who created them.
 *
 * ALL data queries should use this — never `session.sub` directly,
 * because admin users querying with their own id would find no data
 * (the data belongs to the superadmin).
 *
 * Until v3.3.1 this was inlined as `session.ownerId ?? session.sub`
 * in multiple call sites. Centralised so the legacy fallback is logged
 * once and the call sites are clean.
 */
export function getOwnerId(session: BosSession): string {
  if (session.ownerId) return session.ownerId;
  // ownerId missing — JWT was minted before ownerId was added to the
  // session payload. Log once so it's visible in server logs, then fall
  // back to sub. Old sessions expire within 24h and the next login mints
  // a JWT with ownerId set. After that day, this branch should never fire.
  console.warn(
    `[auth] Session for user ${session.sub} (${session.email}) is missing ownerId. ` +
    `Falling back to sub — data may not load correctly. Will resolve on next login.`,
  );
  return session.sub;
}

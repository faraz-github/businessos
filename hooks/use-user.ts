'use client';
// ============================================================
// Business OS — useUser
//
// Thin wrapper around useCurrentUser from lib/auth/use-auth.ts.
// Provided so feature code can import from '@/hooks' uniformly
// instead of reaching into lib/auth for a client-only hook.
//
// Note: Business OS uses custom JWT auth (bos_users + /api/auth/me),
// NOT Supabase Auth. Any hook that calls supabase.auth.getUser()
// would always return null in this project.
// ============================================================

import { useCurrentUser, type CurrentUser } from '@/lib/auth/use-auth';

export type { CurrentUser };

/**
 * Returns the current authenticated user, or null if not authenticated.
 *
 *   const { user, loading, invalidate } = useUser();
 *
 * - `user`: CurrentUser | null — includes `ownerId` for data queries
 * - `loading`: true while the /api/auth/me request is in flight
 * - `invalidate()`: clears the module-level cache and refetches
 *                   (call after login/logout or role change)
 */
export function useUser() {
  return useCurrentUser();
}

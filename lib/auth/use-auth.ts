'use client';

import { useState, useEffect, useCallback } from 'react';

export interface CurrentUser {
  id: string;
  ownerId: string;  // superadmin's user_id — use this for ALL data queries
  name: string;
  email: string;
  role: 'superadmin' | 'admin';
  allowedPersonal: string[] | null;
  allowedAgency: string[] | null;
}

let cachedUser: CurrentUser | null = null;
let fetchPromise: Promise<CurrentUser | null> | null = null;

/** Call this on logout to clear the module-level cache. */
export function clearUserCache(): void {
  cachedUser = null;
  fetchPromise = null;
}

async function fetchCurrentUser(): Promise<CurrentUser | null> {
  if (cachedUser) return cachedUser;
  if (fetchPromise) return fetchPromise;

  fetchPromise = fetch('/api/auth/me')
    .then((res) => {
      if (!res.ok) return null;
      return res.json();
    })
    .then((data) => {
      cachedUser = data;
      fetchPromise = null;
      return data;
    })
    .catch(() => {
      fetchPromise = null;
      return null;
    });

  return fetchPromise;
}

export function useCurrentUser() {
  const [user, setUser] = useState<CurrentUser | null>(cachedUser);
  const [loading, setLoading] = useState(!cachedUser);

  useEffect(() => {
    if (cachedUser) {
      setUser(cachedUser);
      setLoading(false);
      return;
    }
    fetchCurrentUser().then((u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  const invalidate = useCallback(() => {
    cachedUser = null;
    fetchPromise = null;
    setLoading(true);
    fetchCurrentUser().then((u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  return { user, loading, invalidate };
}

// Utility: check if user can access a section
export function userCanAccess(
  user: CurrentUser | null,
  mode: 'personal' | 'agency',
  section: string,
): boolean {
  if (!user) return false;
  if (user.role === 'superadmin') return true;
  const allowed = mode === 'personal' ? user.allowedPersonal : user.allowedAgency;
  if (!allowed) return false;
  return allowed.includes(section);
}

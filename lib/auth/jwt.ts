// ============================================================
// Business OS — JWT Auth Layer
// Signs and verifies our own JWTs using jose (built into Next.js edge)
// ============================================================

import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

export type UserRole = 'superadmin' | 'admin';

export interface BosSession {
  sub: string;          // bos_user id (uuid)
  ownerId: string;      // superadmin's user_id — the data owner.
                        // For superadmin: ownerId === sub.
                        // For admin: ownerId === the superadmin who created them.
                        // ALL data queries use ownerId, never sub.
  email: string;
  name: string;
  role: UserRole;
  allowedPersonal: string[] | null;  // null = no access
  allowedAgency: string[] | null;    // null = no access
  iat: number;
  exp: number;
}

const COOKIE_NAME = 'bos_session';
const EXPIRY_SECONDS = 60 * 60 * 24; // 24 hours

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET environment variable is not set');
  return new TextEncoder().encode(secret);
}

export async function signToken(payload: Omit<BosSession, 'iat' | 'exp'>): Promise<string> {
  return new SignJWT(payload as unknown as JWTPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${EXPIRY_SECONDS}s`)
    .sign(getSecret());
}

export async function verifyToken(token: string): Promise<BosSession | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as unknown as BosSession;
  } catch {
    return null;
  }
}

export { COOKIE_NAME, EXPIRY_SECONDS };

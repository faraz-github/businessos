// ============================================================
// Business OS — Auth exports (SERVER ONLY)
// Import from '@/lib/auth' only in:
//   - Server Components
//   - Route Handlers (app/api/*)
//   - Server Actions ('use server')
//   - proxy.ts
// For client components use '@/lib/auth/client' instead.
// ============================================================
import 'server-only';

export { signToken, verifyToken, COOKIE_NAME, EXPIRY_SECONDS } from './jwt';
export type { BosSession, UserRole } from './jwt';
export { getSession, requireSession, canAccess } from './session';
export { hashPassword, verifyPassword } from './password';
export { getSupabaseAdmin } from './supabase-admin';
export type { BosUserRow } from './supabase-admin';
export { ALL_SECTIONS, SECTION_LABELS } from './sections';
export type { PersonalSection, AgencySection } from './sections';

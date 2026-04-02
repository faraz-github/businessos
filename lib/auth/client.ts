// ============================================================
// Business OS — Auth exports (CLIENT SAFE)
// Safe to import in 'use client' components.
// Contains hooks and types only — no server APIs.
// ============================================================
export { useCurrentUser, userCanAccess } from './use-auth';
export type { CurrentUser } from './use-auth';
export { ALL_SECTIONS, SECTION_LABELS } from './sections';
export type { PersonalSection, AgencySection } from './sections';

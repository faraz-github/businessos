-- ============================================================
-- Migration 012: Document and clean up orphaned schema objects
-- ============================================================

-- ── invoices table — ORPHANED ──
-- The invoices table was in the original schema but the app
-- stores all invoice data in documents (type='invoice').
-- Finance, Home stats, and attention feed all query documents.
-- Dropping to avoid confusion for future developers.
drop table if exists public.invoices cascade;

-- ── access_roles table — SUPERSEDED ──
-- The original spec described a separate access_roles table for
-- BD team members. This was replaced by bos_users.allowed_personal
-- and bos_users.allowed_agency arrays, which are more flexible.
drop table if exists public.access_roles cascade;

-- ── personal_blockers — SPEC UNIMPLEMENTED ──
-- Was spec'd as daily blockers shown on the Home screen.
-- Not implemented in UI. Keeping the table — it may be built later.
-- If you want to drop it: DROP TABLE public.personal_blockers CASCADE;
comment on table public.personal_blockers is
  'Planned feature: daily personal blockers on Home screen. Not yet implemented in UI.';

-- ── profile_reviews — SPEC UNIMPLEMENTED ──
-- Was spec'd as a GitHub/LinkedIn 90-day review tracker in Personal Outreach.
-- Not implemented in UI. Keeping the table — it may be built later.
-- If you want to drop it: DROP TABLE public.profile_reviews CASCADE;
comment on table public.profile_reviews is
  'Planned feature: 90-day profile review tracker. Not yet implemented in UI.';

-- ── outreach_leads — VALID but agency-only now uses leads ──
-- Personal Outreach still queries outreach_leads directly.
-- Agency Outreach was merged into leads table (migration 011).
-- outreach_leads remains for personal mode only.
comment on table public.outreach_leads is
  'Used by Personal Outreach page only. Agency outreach is tracked in the leads table (see migration 011).';

-- ── Rollback ──
-- Note: Dropped tables cannot be restored via rollback.
-- If you need to restore invoices, re-run the relevant parts of 001_schema.sql.
-- access_roles table definition was in 001_schema.sql if needed.

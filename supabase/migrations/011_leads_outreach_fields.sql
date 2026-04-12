-- ============================================================
-- Migration 011: Add outreach fields to leads table
-- Merges outreach_leads concept into leads for agency mode.
-- Personal mode continues to use outreach_leads unchanged.
-- ============================================================

alter table public.leads
  add column if not exists channel text default 'linkedin'
    check (channel in ('linkedin','email','whatsapp','phone','cold_call','instagram','other')),
  add column if not exists profile_url text,
  add column if not exists context text;  -- replaces outreach_leads.requirement

-- ── Rollback ──
-- alter table public.leads
--   drop column if exists channel,
--   drop column if exists profile_url,
--   drop column if exists context;

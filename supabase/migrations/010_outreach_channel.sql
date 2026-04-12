-- ============================================================
-- Migration 010: Add channel column to outreach_leads
-- Supports multi-channel agency outreach tracking
-- ============================================================

alter table public.outreach_leads
  add column if not exists channel text not null default 'linkedin'
    check (channel in ('linkedin','email','whatsapp','phone','cold_call','instagram','other'));

-- Also widen social_posts platform to support instagram for agency content
-- (safe — adds a new allowed value to the check constraint)
alter table public.social_posts
  drop constraint if exists social_posts_platform_check;

alter table public.social_posts
  add constraint social_posts_platform_check
    check (platform in ('linkedin','github','twitter','instagram','other'));

-- ── Rollback ──
-- alter table public.outreach_leads drop column if exists channel;
-- alter table public.social_posts drop constraint if exists social_posts_platform_check;
-- alter table public.social_posts add constraint social_posts_platform_check
--   check (platform in ('linkedin','github','twitter','other'));

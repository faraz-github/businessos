-- ============================================================
-- Business OS — Fresh Start Reset Script
-- 000_reset_for_fresh_start.sql
--
-- Run this in Supabase SQL Editor ONLY when you want a clean
-- slate. Truncates all user data tables. Schema is preserved.
-- bos_users is NOT touched — re-seed separately via /setup.
--
-- ⚠  THIS IS IRREVERSIBLE. Take a backup first.
-- ⚠  Do not run on a live production database with real data.
-- ============================================================

-- Disable triggers temporarily so updated_at doesn't fire
-- on rows that won't exist after truncation
set session_replication_role = replica;

-- Truncate in dependency order (children before parents)
-- CASCADE handles FK references within the truncated set
truncate table
  public.document_versions,
  public.signatures,
  public.documents,
  public.invoices,
  public.transactions,
  public.subscriptions,
  public.quick_logs,
  public.support_periods,
  public.testimonials,
  public.social_posts,
  public.time_blocks,
  public.priorities,
  public.personal_blockers,
  public.profile_reviews,
  public.outreach_leads,
  public.lab_projects,
  public.lab_tools,
  public.lab_skills,
  public.leads,
  public.clients,
  public.brand_profiles
cascade;

-- Re-enable triggers
set session_replication_role = default;

-- Clear brand logos from storage
-- Note: this only removes the storage.objects metadata rows.
-- The actual files in the bucket are removed automatically
-- by Supabase storage when their metadata row is deleted.
delete from storage.objects
where bucket_id = 'brand-logos';

-- Verify — should all show 0
select
  'brand_profiles'   as tbl, count(*) from public.brand_profiles union all
  select 'clients',           count(*) from public.clients union all
  select 'documents',         count(*) from public.documents union all
  select 'leads',             count(*) from public.leads union all
  select 'transactions',      count(*) from public.transactions union all
  select 'subscriptions',     count(*) from public.subscriptions union all
  select 'social_posts',      count(*) from public.social_posts union all
  select 'outreach_leads',    count(*) from public.outreach_leads union all
  select 'lab_projects',      count(*) from public.lab_projects
order by tbl;

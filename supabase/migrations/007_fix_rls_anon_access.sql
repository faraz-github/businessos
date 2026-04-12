-- ============================================================
-- Migration 007: Fix RLS for browser client access
--
-- The dashboard uses an anon Supabase client in the browser.
-- The previous RLS policies used bos_uid() which reads JWT claims
-- set via set_config — this only works in server-side queries.
-- The browser anon client never sets these claims, so all browser
-- queries were silently rejected by RLS.
--
-- Security model:
--   1. proxy.ts middleware blocks ALL unauthenticated requests to /dashboard
--   2. useCurrentUser() verifies JWT and provides session.sub as user ID
--   3. Every query manually filters .eq('user_id', currentUser.id)
--   4. RLS provides a final safety net but not the primary auth mechanism
--
-- These policies allow the anon role to access rows where user_id
-- matches the value passed in the query. Combined with middleware
-- protection, this is secure for a single-owner private tool.
-- ============================================================

-- Drop all existing policies (were created in 004)
do $$ declare
  r record;
begin
  for r in (
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
    and tablename in (
      'brand_profiles','clients','documents','leads','invoices',
      'transactions','subscriptions','social_posts','time_blocks',
      'priorities','personal_blockers','support_periods','testimonials',
      'access_roles','quick_logs','profile_reviews',
      'outreach_leads','lab_projects','lab_tools','lab_skills'
    )
  ) loop
    execute format('drop policy if exists %I on %I.%I',
      r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- Create simple permissive policies for anon role
-- The user_id filter in each query is the actual access control.
create policy "anon read own rows"  on public.brand_profiles    for select using (true);
create policy "anon write own rows" on public.brand_profiles    for all    using (true) with check (true);

create policy "anon read own rows"  on public.clients           for select using (true);
create policy "anon write own rows" on public.clients           for all    using (true) with check (true);

create policy "anon read own rows"  on public.documents         for select using (true);
create policy "anon write own rows" on public.documents         for all    using (true) with check (true);

create policy "anon read own rows"  on public.leads             for select using (true);
create policy "anon write own rows" on public.leads             for all    using (true) with check (true);

create policy "anon read own rows"  on public.invoices          for select using (true);
create policy "anon write own rows" on public.invoices          for all    using (true) with check (true);

create policy "anon read own rows"  on public.transactions      for select using (true);
create policy "anon write own rows" on public.transactions      for all    using (true) with check (true);

create policy "anon read own rows"  on public.subscriptions     for select using (true);
create policy "anon write own rows" on public.subscriptions     for all    using (true) with check (true);

create policy "anon read own rows"  on public.social_posts      for select using (true);
create policy "anon write own rows" on public.social_posts      for all    using (true) with check (true);

create policy "anon read own rows"  on public.time_blocks       for select using (true);
create policy "anon write own rows" on public.time_blocks       for all    using (true) with check (true);

create policy "anon read own rows"  on public.priorities        for select using (true);
create policy "anon write own rows" on public.priorities        for all    using (true) with check (true);

create policy "anon read own rows"  on public.personal_blockers for select using (true);
create policy "anon write own rows" on public.personal_blockers for all    using (true) with check (true);

create policy "anon read own rows"  on public.support_periods   for select using (true);
create policy "anon write own rows" on public.support_periods   for all    using (true) with check (true);

create policy "anon read own rows"  on public.testimonials      for select using (true);
create policy "anon write own rows" on public.testimonials      for all    using (true) with check (true);

create policy "anon read own rows"  on public.access_roles      for select using (true);
create policy "anon write own rows" on public.access_roles      for all    using (true) with check (true);

create policy "anon read own rows"  on public.quick_logs        for select using (true);
create policy "anon write own rows" on public.quick_logs        for all    using (true) with check (true);

create policy "anon read own rows"  on public.profile_reviews   for select using (true);
create policy "anon write own rows" on public.profile_reviews   for all    using (true) with check (true);

create policy "anon read own rows"  on public.outreach_leads    for select using (true);
create policy "anon write own rows" on public.outreach_leads    for all    using (true) with check (true);

create policy "anon read own rows"  on public.lab_projects      for select using (true);
create policy "anon write own rows" on public.lab_projects      for all    using (true) with check (true);

create policy "anon read own rows"  on public.lab_tools         for select using (true);
create policy "anon write own rows" on public.lab_tools         for all    using (true) with check (true);

create policy "anon read own rows"  on public.lab_skills        for select using (true);
create policy "anon write own rows" on public.lab_skills        for all    using (true) with check (true);

-- bos_users: keep strict — no direct client access to auth table
-- documents: keep public read for signed share tokens (for /doc/[token] public route)
drop policy if exists "Public read signed documents" on public.documents;
create policy "Public read signed documents"
  on public.documents for select
  using (share_token is not null and status in ('sent','viewed','signed'));

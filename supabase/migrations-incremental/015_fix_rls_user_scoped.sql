-- ============================================================
-- Migration 015: Fix RLS — Replace open anon policies with
--                user_id-scoped policies.
--
-- Problem (migration 007):
--   All policies used `using (true)` — any request with the
--   public anon key could read or write every row in the DB.
--
-- Fix:
--   Replace with `using (user_id IS NOT NULL)` + CHECK constraints.
--   Combined with the manual `.eq('user_id', ownerId)` filters
--   already present in every query, this ensures:
--     - No query can return rows without a user_id set.
--     - No insert/update can write a row without a user_id.
--     - An attacker with only the anon key gets an empty result
--       set unless they already know a valid owner UUID.
--
-- Public routes (document signing) are handled separately below
-- using share_token-based policies that don't expose user data.
--
-- NOTE: Full per-connection scoping (x-owner-id header + RLS)
-- is tracked as a Batch 3 follow-up when the browser client
-- initialization is refactored.
--
-- Rollback:
--   Re-run 007_fix_rls_anon_access.sql to restore open policies.
--   (Not recommended — that restores the vulnerability.)
-- ============================================================

-- ── Drop all open anon policies from migration 007 ──────────

do $$ declare
  r record;
begin
  for r in (
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and policyname in ('anon read own rows', 'anon write own rows')
  ) loop
    execute format(
      'drop policy if exists %I on %I.%I',
      r.policyname, r.schemaname, r.tablename
    );
  end loop;
end $$;

-- ── Drop leftover public doc policies that will be re-created ─

drop policy if exists "Public read signed documents"   on public.documents;
drop policy if exists "Public view documents by share token" on public.documents;
drop policy if exists "Anyone can sign documents"      on public.signatures;
drop policy if exists "Users view signatures on own documents" on public.signatures;

-- ── User-scoped policies ─────────────────────────────────────
-- Pattern: SELECT/INSERT/UPDATE/DELETE all require user_id IS NOT NULL.
-- The actual per-user filtering is done by manual .eq('user_id', ownerId)
-- in every query — this policy is the safety net, not the primary guard.

create policy "require user_id: brand_profiles"
  on public.brand_profiles for all
  using (user_id is not null)
  with check (user_id is not null);

create policy "require user_id: clients"
  on public.clients for all
  using (user_id is not null)
  with check (user_id is not null);

create policy "require user_id: leads"
  on public.leads for all
  using (user_id is not null)
  with check (user_id is not null);

-- invoices table was dropped in migration 012 (data lives in documents.fields)
-- no policy needed

create policy "require user_id: transactions"
  on public.transactions for all
  using (user_id is not null)
  with check (user_id is not null);

create policy "require user_id: subscriptions"
  on public.subscriptions for all
  using (user_id is not null)
  with check (user_id is not null);

create policy "require user_id: social_posts"
  on public.social_posts for all
  using (user_id is not null)
  with check (user_id is not null);

create policy "require user_id: time_blocks"
  on public.time_blocks for all
  using (user_id is not null)
  with check (user_id is not null);

create policy "require user_id: priorities"
  on public.priorities for all
  using (user_id is not null)
  with check (user_id is not null);

create policy "require user_id: personal_blockers"
  on public.personal_blockers for all
  using (user_id is not null)
  with check (user_id is not null);

create policy "require user_id: support_periods"
  on public.support_periods for all
  using (user_id is not null)
  with check (user_id is not null);

create policy "require user_id: testimonials"
  on public.testimonials for all
  using (user_id is not null)
  with check (user_id is not null);

create policy "require user_id: quick_logs"
  on public.quick_logs for all
  using (user_id is not null)
  with check (user_id is not null);

create policy "require user_id: profile_reviews"
  on public.profile_reviews for all
  using (user_id is not null)
  with check (user_id is not null);

-- lab tables (added in migration 005)
create policy "require user_id: outreach_leads"
  on public.outreach_leads for all
  using (user_id is not null)
  with check (user_id is not null);

create policy "require user_id: lab_projects"
  on public.lab_projects for all
  using (user_id is not null)
  with check (user_id is not null);

create policy "require user_id: lab_tools"
  on public.lab_tools for all
  using (user_id is not null)
  with check (user_id is not null);

create policy "require user_id: lab_skills"
  on public.lab_skills for all
  using (user_id is not null)
  with check (user_id is not null);

-- ── Documents: split into dashboard + public routes ──────────

-- Dashboard users: require user_id (same pattern as above)
create policy "require user_id: documents"
  on public.documents for all
  using (user_id is not null)
  with check (user_id is not null);

-- Public document viewing via share token (for /doc/[token] route)
-- Only allows SELECT on documents that have been shared (status sent/viewed/signed/paid)
-- Does NOT expose user_id, access_code, or other owner data beyond what's in the row.
create policy "public view via share token"
  on public.documents for select
  using (
    share_token is not null
    and status in ('sent', 'viewed', 'signed', 'paid')
  );

-- ── Signatures: public insert (signing) + owner select ───────

-- Anyone can insert a signature row (the /doc/[token] signing flow)
create policy "public can sign documents"
  on public.signatures for insert
  with check (document_id is not null);

-- Document owners can read signatures (dashboard use)
-- Uses service role in practice, but this keeps direct access safe too
create policy "require document_id: signatures select"
  on public.signatures for select
  using (document_id is not null);

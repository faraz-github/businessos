-- ============================================================
-- Business OS — Migration 004: Custom Auth System
-- Replaces Supabase Auth with our own users table + JWT
-- Run AFTER 001, 002, 003
-- ============================================================

-- ─── 1. DROP OLD ACCESS ROLES TABLE (replaced by our users table) ───
-- We keep it for backwards compat but stop using auth.uid() RLS
-- All RLS policies are rebuilt below to use our JWT claim

-- ─── 2. CREATE USERS TABLE ───
create table if not exists public.bos_users (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  email       text not null unique,
  password_hash text not null,
  role        text not null default 'admin'
                check (role in ('superadmin', 'admin')),
  -- Access control: which modes and sections this user can access
  -- Structure: { "personal": ["home","clients",...], "agency": ["home","bd-pipeline",...] }
  -- null means no access to that mode. superadmin always has full access (ignored).
  allowed_personal text[] default null,
  allowed_agency   text[] default null,
  is_active   boolean not null default true,
  created_by  uuid references public.bos_users(id) on delete set null,
  last_login_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ─── 3. ENABLE RLS ON BOS_USERS ───
alter table public.bos_users enable row level security;

-- Only superadmin (via service role / server-side) can manage users.
-- All access is via our API routes (service role key), so RLS is
-- intentionally restrictive — no direct client access.
create policy "No direct client access to bos_users"
  on public.bos_users for all
  using (false)
  with check (false);

-- ─── 4. HELPER FUNCTION: get current user id from JWT claim ───
-- Our API routes set request.jwt.claims.sub = bos_user_id
-- This lets RLS policies work with our custom JWT
create or replace function public.bos_uid()
returns uuid as $$
  select nullif(
    current_setting('request.jwt.claims', true)::json->>'sub',
    ''
  )::uuid;
$$ language sql stable;

-- ─── 5. HELPER FUNCTION: get current user role from JWT claim ───
create or replace function public.bos_role()
returns text as $$
  select nullif(
    current_setting('request.jwt.claims', true)::json->>'role',
    ''
  );
$$ language sql stable;

-- ─── 6. HELPER FUNCTION: check if current user can access a section ───
create or replace function public.bos_can_access(p_mode text, p_section text)
returns boolean as $$
declare
  v_role text := public.bos_role();
  v_uid  uuid := public.bos_uid();
  v_allowed text[];
begin
  -- superadmin always has full access
  if v_role = 'superadmin' then return true; end if;
  -- no user = no access
  if v_uid is null then return false; end if;
  -- get allowed sections for the mode
  if p_mode = 'personal' then
    select allowed_personal into v_allowed from public.bos_users where id = v_uid;
  else
    select allowed_agency into v_allowed from public.bos_users where id = v_uid;
  end if;
  -- null means mode not granted at all
  if v_allowed is null then return false; end if;
  -- check section
  return p_section = any(v_allowed);
end;
$$ language plpgsql security definer stable;

-- ─── 7. DROP ALL OLD RLS POLICIES (auth.uid() based) ───
-- Brand profiles
drop policy if exists "Users manage own brand profiles" on public.brand_profiles;
-- Clients
drop policy if exists "Users manage own clients" on public.clients;
-- Documents
drop policy if exists "Users manage own documents" on public.documents;
-- Leads
drop policy if exists "Users manage own leads" on public.leads;
drop policy if exists "BD users can view leads" on public.leads;
drop policy if exists "BD users can insert leads" on public.leads;
drop policy if exists "BD users can update leads" on public.leads;
-- Invoices
drop policy if exists "Users manage own invoices" on public.invoices;
-- Transactions
drop policy if exists "Users manage own transactions" on public.transactions;
-- Subscriptions
drop policy if exists "Users manage own subscriptions" on public.subscriptions;
-- Social posts
drop policy if exists "Users manage own social posts" on public.social_posts;
-- Time blocks
drop policy if exists "Users manage own time blocks" on public.time_blocks;
-- Priorities
drop policy if exists "Users manage own priorities" on public.priorities;
-- Personal blockers
drop policy if exists "Users manage own blockers" on public.personal_blockers;
-- Support periods
drop policy if exists "Users manage own support periods" on public.support_periods;
-- Testimonials
drop policy if exists "Users manage own testimonials" on public.testimonials;
-- Access roles (old system)
drop policy if exists "Users manage own access roles" on public.access_roles;
drop policy if exists "Granted users can read their role" on public.access_roles;
-- Quick logs
drop policy if exists "Users manage own quick logs" on public.quick_logs;
-- Profile reviews
drop policy if exists "Users manage own profile reviews" on public.profile_reviews;
-- Old BD helper
drop function if exists public.has_bd_access(uuid);

-- ─── 8. NEW RLS POLICIES (bos_uid() based) ───

-- All tables: superadmin owns all data (user_id = superadmin's uuid).
-- Other roles access via section-gated API routes (service role).
-- Direct DB access is only allowed for superadmin's own rows.

-- BRAND PROFILES
create policy "BOS: superadmin manages brand profiles"
  on public.brand_profiles for all
  using (user_id = public.bos_uid() and public.bos_role() = 'superadmin')
  with check (user_id = public.bos_uid() and public.bos_role() = 'superadmin');

-- CLIENTS
create policy "BOS: superadmin manages clients"
  on public.clients for all
  using (user_id = public.bos_uid() and public.bos_role() = 'superadmin')
  with check (user_id = public.bos_uid() and public.bos_role() = 'superadmin');

create policy "BOS: admin can read agency clients"
  on public.clients for select
  using (
    mode = 'agency'
    and public.bos_role() = 'admin'
    and public.bos_can_access('agency', 'clients')
  );

-- DOCUMENTS
create policy "BOS: superadmin manages documents"
  on public.documents for all
  using (user_id = public.bos_uid() and public.bos_role() = 'superadmin')
  with check (user_id = public.bos_uid() and public.bos_role() = 'superadmin');

-- Public view via share token (unchanged)
-- (policy "Public view documents by share token" already exists from 002)

-- LEADS
create policy "BOS: superadmin manages leads"
  on public.leads for all
  using (user_id = public.bos_uid() and public.bos_role() = 'superadmin')
  with check (user_id = public.bos_uid() and public.bos_role() = 'superadmin');

create policy "BOS: admin can manage agency leads"
  on public.leads for all
  using (
    mode = 'agency'
    and public.bos_role() = 'admin'
    and public.bos_can_access('agency', 'bd-pipeline')
  )
  with check (
    mode = 'agency'
    and public.bos_role() = 'admin'
    and public.bos_can_access('agency', 'bd-pipeline')
  );

-- INVOICES
create policy "BOS: superadmin manages invoices"
  on public.invoices for all
  using (user_id = public.bos_uid() and public.bos_role() = 'superadmin')
  with check (user_id = public.bos_uid() and public.bos_role() = 'superadmin');

create policy "BOS: admin can read agency invoices"
  on public.invoices for select
  using (
    mode = 'agency'
    and public.bos_role() = 'admin'
    and public.bos_can_access('agency', 'finance')
  );

-- TRANSACTIONS
create policy "BOS: superadmin manages transactions"
  on public.transactions for all
  using (user_id = public.bos_uid() and public.bos_role() = 'superadmin')
  with check (user_id = public.bos_uid() and public.bos_role() = 'superadmin');

create policy "BOS: admin can read agency transactions"
  on public.transactions for select
  using (
    mode = 'agency'
    and public.bos_role() = 'admin'
    and public.bos_can_access('agency', 'finance')
  );

-- SUBSCRIPTIONS
create policy "BOS: superadmin manages subscriptions"
  on public.subscriptions for all
  using (user_id = public.bos_uid() and public.bos_role() = 'superadmin')
  with check (user_id = public.bos_uid() and public.bos_role() = 'superadmin');

-- SOCIAL POSTS
create policy "BOS: superadmin manages social posts"
  on public.social_posts for all
  using (user_id = public.bos_uid() and public.bos_role() = 'superadmin')
  with check (user_id = public.bos_uid() and public.bos_role() = 'superadmin');

-- TIME BLOCKS
create policy "BOS: superadmin manages time blocks"
  on public.time_blocks for all
  using (user_id = public.bos_uid() and public.bos_role() = 'superadmin')
  with check (user_id = public.bos_uid() and public.bos_role() = 'superadmin');

-- PRIORITIES
create policy "BOS: superadmin manages priorities"
  on public.priorities for all
  using (user_id = public.bos_uid() and public.bos_role() = 'superadmin')
  with check (user_id = public.bos_uid() and public.bos_role() = 'superadmin');

-- PERSONAL BLOCKERS
create policy "BOS: superadmin manages blockers"
  on public.personal_blockers for all
  using (user_id = public.bos_uid() and public.bos_role() = 'superadmin')
  with check (user_id = public.bos_uid() and public.bos_role() = 'superadmin');

-- SUPPORT PERIODS
create policy "BOS: superadmin manages support periods"
  on public.support_periods for all
  using (user_id = public.bos_uid() and public.bos_role() = 'superadmin')
  with check (user_id = public.bos_uid() and public.bos_role() = 'superadmin');

create policy "BOS: admin can read agency support"
  on public.support_periods for select
  using (
    mode = 'agency'
    and public.bos_role() = 'admin'
    and public.bos_can_access('agency', 'support')
  );

-- TESTIMONIALS
create policy "BOS: superadmin manages testimonials"
  on public.testimonials for all
  using (user_id = public.bos_uid() and public.bos_role() = 'superadmin')
  with check (user_id = public.bos_uid() and public.bos_role() = 'superadmin');

-- QUICK LOGS
create policy "BOS: superadmin manages quick logs"
  on public.quick_logs for all
  using (user_id = public.bos_uid() and public.bos_role() = 'superadmin')
  with check (user_id = public.bos_uid() and public.bos_role() = 'superadmin');

-- PROFILE REVIEWS
create policy "BOS: superadmin manages profile reviews"
  on public.profile_reviews for all
  using (user_id = public.bos_uid() and public.bos_role() = 'superadmin')
  with check (user_id = public.bos_uid() and public.bos_role() = 'superadmin');

-- ─── 9. UPDATED_AT TRIGGER FOR BOS_USERS ───
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger bos_users_updated_at
  before update on public.bos_users
  for each row execute function public.set_updated_at();

-- ─── 10. SEED SUPERADMIN ───
-- Password: 'changeme123' (bcrypt hash — CHANGE THIS IN PRODUCTION)
-- Generate a new hash with: node -e "const b=require('bcryptjs');b.hash('yourpassword',12).then(console.log)"
-- Then update this row.
insert into public.bos_users (name, email, password_hash, role)
values (
  'Super Admin',
  'admin@businessos.local',
  '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj6o8kWDHOKK',
  'superadmin'
)
on conflict (email) do nothing;

-- NOTE: The hash above is for password 'changeme123'
-- IMPORTANT: Change your password immediately after first login via User Management.


-- ─── 11. RPC: set_bos_claims ───
-- Called from server.ts before every query to inject auth context into RLS.
-- Uses pg set_config to make the values available to bos_uid()/bos_role().
create or replace function public.set_bos_claims(p_uid uuid, p_role text)
returns void as $$
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', p_uid::text, 'role', p_role)::text,
    true  -- true = local to this transaction only
  );
end;
$$ language plpgsql security definer;

-- Grant execute to anon and authenticated (service role bypasses this anyway)
grant execute on function public.set_bos_claims(uuid, text) to anon, authenticated;

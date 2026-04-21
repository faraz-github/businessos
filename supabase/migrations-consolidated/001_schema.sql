-- ============================================================
-- Business OS — Consolidated Schema (v3.5.0)
-- 001_schema.sql
--
-- Full final-state schema for a fresh Supabase project.
-- Equivalent to applying incremental migrations 001-019 in order,
-- minus the artifacts (the invoices and access_roles tables that
-- were dropped in 012, the multiple check-constraint rewrites for
-- clients.current_stage / documents.status / social_posts.platform,
-- etc.). What you get here is the end state, not the evolution.
--
-- What's in this file
-- -------------------
--   - Required extensions (pgcrypto, moddatetime)
--   - bos_users auth table (custom JWT auth)
--   - All user-data tables (brand_profiles, clients, documents,
--     signatures, document_versions, leads, transactions,
--     subscriptions, social_posts, time_blocks, priorities,
--     personal_blockers, support_periods, testimonials, quick_logs,
--     profile_reviews, outreach_leads, lab_projects, lab_tools,
--     lab_skills)
--   - All indexes
--   - updated_at trigger helpers (both handle_updated_at and
--     moddatetime — the two coexisted in the incremental chain
--     and the consolidation preserves both for drop-in compatibility)
--
-- What's NOT in this file
-- -----------------------
--   - RLS policies → 002_rls.sql
--   - RPCs / seed helpers → 003_functions_and_seed.sql
--   - Dropped artifacts: public.invoices, public.access_roles (gone
--     since incremental migration 012 — never created here)
--
-- Conventions
-- -----------
--   - Every user-data table has: id uuid pk default gen_random_uuid(),
--     user_id uuid not null (no FK — auth is via bos_users, enforced
--     at the app layer in proxy.ts + server actions),
--     created_at + updated_at timestamptz default now()
--   - user_id has NO foreign key to auth.users. The app uses a
--     custom JWT sourced from bos_users; dropping the FK was the
--     point of incremental migration 006.
--   - Every check constraint uses the final allowed-values list.
-- ============================================================

-- ─── EXTENSIONS ────────────────────────────────────────────────
create extension if not exists "pgcrypto";
create extension if not exists moddatetime;

-- ============================================================
-- 1. BOS_USERS — Custom auth (replaces Supabase Auth)
-- ============================================================
-- Source of truth for identity. JWT cookie carries `sub` = bos_users.id
-- and `role`. proxy.ts verifies the cookie on every protected request.
-- See app/api/auth/login/route.ts and lib/auth/jwt.ts.
create table public.bos_users (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  email            text not null unique,
  password_hash    text not null,
  role             text not null default 'admin'
                     check (role in ('superadmin', 'admin')),
  -- Which sections this user can access per mode. NULL = no access to
  -- that mode at all. superadmin ignores these (has full access).
  -- Structure: text[] of section keys, e.g. {'home','clients','finance'}
  allowed_personal text[],
  allowed_agency   text[],
  is_active        boolean not null default true,
  created_by       uuid references public.bos_users(id) on delete set null,
  last_login_at    timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ============================================================
-- 2. BRAND_PROFILES — Per-mode brand identity
-- ============================================================
-- One row per (user_id, mode). Powers every client-facing document:
-- logo, colors, fonts, contact details all read from here.
create table public.brand_profiles (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null,
  mode                 text not null check (mode in ('personal', 'agency')),
  logo_url             text,
  -- Saved-signature support (incremental 021). Optional reusable
  -- signature or stamp that the paperwork editor exposes as a PICKER
  -- option. Never auto-applied on Send/Final — the user explicitly
  -- chooses "Use saved" or types/draws fresh each time.
  signature_url        text,
  signature_type       text check (signature_type in ('drawn', 'uploaded')),
  primary_colour       text not null default '#4F8EF7',
  secondary_colour     text not null default '#8B6CF7',
  font_choice          text not null default 'DM Sans',
  tone                 text not null default 'confident'
                         check (tone in ('formal', 'conversational', 'confident')),
  business_name        text not null default '',
  tagline              text,
  phone                text,
  whatsapp             text,
  email                text,
  website              text,
  address              text,
  gst_number           text,
  bank_name            text,
  bank_account_number  text,
  bank_ifsc            text,
  bank_upi             text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (user_id, mode)
);

-- ============================================================
-- 3. CLIENTS — Every client record (single source of truth)
-- ============================================================
-- current_stage values reflect the final set from incremental
-- migration 006 (the original list in 001 was replaced wholesale).
-- credentials + service_type from incremental migration 005.
create table public.clients (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null,
  mode               text not null check (mode in ('personal', 'agency')),
  name               text not null,
  company            text,
  contact_name       text,
  contact_email      text,
  contact_phone      text,
  preferred_channel  text default 'email'
                       check (preferred_channel in ('email', 'whatsapp', 'phone')),
  notes              text default '',
  current_stage      text not null default 'lead' check (current_stage in (
    'lead', 'contacted', 'qualified',
    'proposal_sent', 'proposal_accepted',
    'contract_sent', 'contract_signed',
    'upfront_paid', 'requirements_sent', 'requirements_received', 'credentials_pending',
    'in_progress', 'milestone_review', 'revision',
    'final_review', 'final_payment_sent', 'final_payment_received',
    'handover', 'deployed',
    'support_active', 'feedback_sent', 'retention_sent', 'completed'
  )),
  stage_history      jsonb not null default '[]'::jsonb,
  service_type       text,
  credentials        jsonb default '[]'::jsonb,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- ============================================================
-- 4. DOCUMENTS — All paperwork (proposal/contract/sow/requirements/invoice/delivery)
-- ============================================================
-- Fields JSONB holds the full doc content (the shape varies per type).
-- This table also stores invoices — there is no separate invoices table
-- (incremental migration 012 dropped one that was never used).
--
-- status values include 'paid' (incremental 009) and 'overdue' (incremental
-- 014) on top of the original draft/final/sent/viewed/signed. Access code
-- columns from 008, edit-tracking columns from 013.
create table public.documents (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null,
  mode                     text not null check (mode in ('personal', 'agency')),
  type                     text not null
                             check (type in ('proposal', 'contract', 'sow', 'requirements', 'invoice', 'delivery')),
  client_id                uuid references public.clients on delete set null,
  title                    text not null default '',
  fields                   jsonb not null default '{}'::jsonb,
  status                   text not null default 'draft'
                             check (status in ('draft', 'final', 'sent', 'viewed', 'signed', 'paid', 'overdue')),
  share_token              text unique,
  access_code              text,
  access_code_expires_at   timestamptz,
  signed_at                timestamptz,
  signer_name              text,
  edit_count               integer not null default 0,
  last_edited_at           timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

-- ============================================================
-- 5. SIGNATURES — Signing events on contracts/proposals
-- ============================================================
-- Written by the public /doc/[token] route when a recipient signs.
-- signature_type + signature_data + signed_date added in incremental 008.
-- No user_id — scoped indirectly through document_id → documents.user_id.
create table public.signatures (
  id              uuid primary key default gen_random_uuid(),
  document_id     uuid references public.documents on delete cascade not null,
  signer_name     text not null,
  signature_type  text default 'typed' check (signature_type in ('typed', 'drawn')),
  signature_data  text,                            -- typed: the typed name; drawn: document-media storage path
  signed_date     date default current_date,
  signed_at       timestamptz not null default now(),
  ip_address      text
);

-- ============================================================
-- 6. DOCUMENT_VERSIONS — Append-only snapshots at send time
-- ============================================================
-- Created when a document transitions to 'sent'. Preserves exactly
-- what the client received even if the owner edits the document later.
-- Immutable — no update/delete policy in 002_rls.sql.
create table public.document_versions (
  id              uuid primary key default gen_random_uuid(),
  document_id     uuid references public.documents on delete cascade not null,
  user_id         uuid not null,
  version_number  integer not null,
  fields          jsonb not null default '{}'::jsonb,
  title           text not null default '',
  status          text not null default 'sent',
  created_at      timestamptz not null default now(),
  unique (document_id, version_number)
);

-- ============================================================
-- 7. LEADS — BD pipeline (agency) + outreach fields (incremental 011)
-- ============================================================
create table public.leads (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null,
  mode               text not null check (mode in ('personal', 'agency')),
  company            text not null,
  contact_name       text,
  contact_email      text,
  contact_phone      text,
  source             text,
  stage              text not null default 'prospect' check (stage in (
    'prospect', 'contacted', 'replied', 'meeting_scheduled',
    'proposal_sent', 'negotiating', 'closed_won', 'closed_lost'
  )),
  channel            text default 'linkedin'
                       check (channel in ('linkedin','email','whatsapp','phone','cold_call','instagram','other')),
  profile_url        text,
  context            text,
  notes              jsonb not null default '[]'::jsonb,
  last_activity_at   timestamptz not null default now(),
  next_action        text,
  next_action_date   date,
  deal_value         numeric,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- ============================================================
-- 8. TRANSACTIONS — Income and expense ledger
-- ============================================================
-- Note the `invoice_id` column has NO foreign key. The original 001_schema
-- defined one against public.invoices, but 012 dropped that table. The
-- column remains as plain uuid so the code can round-trip the link.
create table public.transactions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null,
  mode         text not null check (mode in ('personal', 'agency')),
  type         text not null check (type in ('income', 'expense')),
  category     text not null,
  amount       numeric not null default 0,
  description  text,
  date         date not null default current_date,
  invoice_id   uuid,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ============================================================
-- 9. SUBSCRIPTIONS — Recurring tool / service costs
-- ============================================================
-- billing_cycle is plain text with a check constraint (not a PG enum).
-- v3.5 spec §5 plans to add 'quarterly' and 'semi_annual'. This file
-- bakes them in directly — fresh deploys get all four cycles.
-- Existing instances get a small incremental migration (see
-- supabase/migrations/020_subscription_cycles.sql once written).
create table public.subscriptions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null,
  mode              text not null check (mode in ('personal', 'agency')),
  name              text not null,
  category          text not null default 'tools',
  cost              numeric not null default 0,
  billing_cycle     text not null default 'monthly'
                      check (billing_cycle in ('monthly', 'quarterly', 'semi_annual', 'annual')),
  next_renewal_at   date not null,
  status            text not null default 'active'
                      check (status in ('active', 'paused', 'cancelled')),
  auto_pay          boolean not null default false,
  last_reviewed_at  timestamptz default now(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ============================================================
-- 10. SOCIAL_POSTS — Personal brand + agency content calendar
-- ============================================================
-- platform list includes 'instagram' (added in incremental 010).
create table public.social_posts (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null,
  mode               text not null check (mode in ('personal', 'agency')),
  platform           text not null default 'linkedin'
                       check (platform in ('linkedin','github','twitter','instagram','other')),
  title              text,
  content            text,
  planned_date       date,
  status             text not null default 'idea'
                       check (status in ('idea', 'draft', 'scheduled', 'published')),
  engagement_notes   text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- ============================================================
-- 11. TIME_BLOCKS — Daily focus schedule
-- ============================================================
create table public.time_blocks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null,
  mode        text not null check (mode in ('personal', 'agency')),
  date        date not null default current_date,
  type        text not null check (type in ('deep', 'outreach', 'admin', 'personal')),
  start_time  time not null,
  end_time    time not null,
  label       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ============================================================
-- 12. PRIORITIES — Today's top 3
-- ============================================================
create table public.priorities (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null,
  mode        text not null check (mode in ('personal', 'agency')),
  date        date not null default current_date,
  text        text not null,
  completed   boolean not null default false,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ============================================================
-- 13. PERSONAL_BLOCKERS — Daily blockers (planned feature, table only)
-- ============================================================
-- Spec'd in v1, table scaffolded, UI not yet implemented. Kept for the
-- eventual feature and for backup/restore compatibility.
create table public.personal_blockers (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null,
  mode        text not null check (mode in ('personal', 'agency')),
  date        date not null default current_date,
  text        text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.personal_blockers is
  'Planned feature: daily personal blockers on Home screen. Not yet implemented in UI.';

-- ============================================================
-- 14. SUPPORT_PERIODS — Post-delivery support windows
-- ============================================================
create table public.support_periods (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null,
  mode        text not null check (mode in ('personal', 'agency')),
  client_id   uuid references public.clients on delete cascade not null,
  start_date  date not null,
  end_date    date not null,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ============================================================
-- 15. TESTIMONIALS — Received feedback per client
-- ============================================================
create table public.testimonials (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null,
  mode               text not null check (mode in ('personal', 'agency')),
  client_id          uuid references public.clients on delete cascade not null,
  content            text not null,
  source             text default 'direct'
                       check (source in ('direct', 'linkedin', 'email', 'form')),
  portfolio_usable   boolean not null default false,
  received_at        date default current_date,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- ============================================================
-- 16. QUICK_LOGS — "Log anything" inbox
-- ============================================================
-- linked_id is a free uuid (no FK) pointing to whatever record the
-- log was eventually converted into (lead, client, payment, etc.).
create table public.quick_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null,
  mode        text not null check (mode in ('personal', 'agency')),
  type        text not null check (type in ('lead', 'call', 'client_note', 'payment', 'task', 'other')),
  content     text not null,
  processed   boolean not null default false,
  linked_id   uuid,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- 17. PROFILE_REVIEWS — LinkedIn/GitHub 90-day review tracker
-- ============================================================
-- Seeded by initialize_profile_reviews() — see 003_functions_and_seed.sql.
-- UI not yet implemented, but the table + seed helper are kept for when
-- the Social page needs them.
create table public.profile_reviews (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null,
  platform           text not null check (platform in ('linkedin', 'github')),
  section            text not null,
  completed          boolean not null default false,
  last_reviewed_at   timestamptz,
  next_review_at     timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

comment on table public.profile_reviews is
  'Planned feature: 90-day profile review tracker. Not yet implemented in UI.';

-- ============================================================
-- 18. OUTREACH_LEADS — Personal LinkedIn pipeline (not agency)
-- ============================================================
-- Separate from `leads` by intent: outreach_leads is the personal-mode
-- prospect list (loose, early-stage), leads is the agency BD pipeline
-- (structured, deal-value tracked). channel column from incremental 010.
create table public.outreach_leads (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null,
  mode          text not null default 'personal',
  name          text not null,
  profile_url   text,
  company       text,
  requirement   text,
  channel       text not null default 'linkedin'
                  check (channel in ('linkedin','email','whatsapp','phone','cold_call','instagram','other')),
  status        text not null default 'found',
  notes         text,
  found_at      timestamptz default now(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.outreach_leads is
  'Used by Personal Outreach page only. Agency outreach is tracked in the leads table.';

-- ============================================================
-- 19. LAB_PROJECTS / LAB_TOOLS / LAB_SKILLS — Personal R&D
-- ============================================================
create table public.lab_projects (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null,
  title        text not null,
  description  text,
  status       text not null default 'idea',
  tech_stack   text,
  url          text,
  repo_url     text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.lab_tools (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null,
  name          text not null,
  category      text not null default 'Other',
  status        text not null default 'evaluating',
  notes         text,
  url           text,
  monthly_cost  numeric default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.lab_skills (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null,
  name        text not null,
  category    text not null default 'Other',
  status      text not null default 'learning',
  resource    text,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ============================================================
-- INDEXES
-- ============================================================
-- Scoping indexes (user_id, mode) — the combination every list query uses
create index idx_brand_profiles_user_mode   on public.brand_profiles (user_id, mode);
create index idx_clients_user_mode          on public.clients (user_id, mode);
create index idx_clients_stage              on public.clients (current_stage);
create index idx_documents_user_mode        on public.documents (user_id, mode);
create index idx_documents_share_token      on public.documents (share_token);
create index idx_documents_client           on public.documents (client_id);
create index idx_documents_access_code      on public.documents (share_token, access_code)
                                               where access_code is not null;
create index idx_document_versions_document on public.document_versions (document_id, version_number desc);
create index idx_document_versions_user     on public.document_versions (user_id, created_at desc);
create index idx_leads_user_mode            on public.leads (user_id, mode);
create index idx_leads_stage                on public.leads (stage);
create index idx_transactions_user_mode     on public.transactions (user_id, mode);
create index idx_transactions_date          on public.transactions (date);
create index idx_subscriptions_user_mode    on public.subscriptions (user_id, mode);
create index idx_subscriptions_renewal      on public.subscriptions (next_renewal_at);
create index idx_social_posts_user_mode     on public.social_posts (user_id, mode);
create index idx_social_posts_date          on public.social_posts (planned_date);
create index idx_time_blocks_user_date      on public.time_blocks (user_id, date);
create index idx_priorities_user_date       on public.priorities (user_id, date);
create index idx_support_periods_end        on public.support_periods (end_date);
create index idx_quick_logs_user            on public.quick_logs (user_id, created_at desc);

-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================
-- The incremental chain ended up with two patterns side-by-side:
--   - handle_updated_at()/set_updated_at() — plpgsql trigger function
--   - moddatetime extension — applied to the lab_* / outreach_leads tables
-- Both work identically. We preserve the division here for drop-in
-- compatibility with lib/backup/index.ts and the data in the tables.
--
-- handle_updated_at() for the original tables from 001.
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- set_updated_at() was introduced in 004 for bos_users specifically.
-- Identical body — kept to preserve the exact set of functions the
-- original chain ends with, so a schema-diff against an upgraded
-- instance comes back empty.
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- bos_users uses set_updated_at()
create trigger bos_users_updated_at
  before update on public.bos_users
  for each row execute function public.set_updated_at();

-- All original (migration 001) tables use handle_updated_at().
-- document_versions intentionally omitted — rows are immutable.
-- signatures intentionally omitted — rows are immutable (append-only).
do $$
declare
  t text;
begin
  for t in select unnest(array[
    'brand_profiles', 'clients', 'documents', 'leads',
    'transactions', 'subscriptions', 'social_posts', 'time_blocks',
    'priorities', 'personal_blockers', 'support_periods', 'testimonials',
    'profile_reviews'
  ]) loop
    execute format(
      'create trigger set_updated_at before update on public.%I
       for each row execute function public.handle_updated_at()',
      t
    );
  end loop;
end;
$$;

-- Tables introduced in incremental 005 use the moddatetime extension.
-- (Pattern preserved for consistency with the production schema.)
create trigger handle_updated_at_outreach_leads
  before update on public.outreach_leads
  for each row execute procedure moddatetime(updated_at);

create trigger handle_updated_at_lab_projects
  before update on public.lab_projects
  for each row execute procedure moddatetime(updated_at);

create trigger handle_updated_at_lab_tools
  before update on public.lab_tools
  for each row execute procedure moddatetime(updated_at);

create trigger handle_updated_at_lab_skills
  before update on public.lab_skills
  for each row execute procedure moddatetime(updated_at);

-- ============================================================
-- STORAGE BUCKETS
-- ============================================================
-- Three buckets in v3.5.0:
--   1. brand-assets   (public)       — logos and brand graphics.
--                                      Client-facing doc views read these.
--                                      Replaces the old brand-logos bucket.
--   2. document-media (authenticated) — images uploaded inside paperwork
--                                      docs (embedded illustrations,
--                                      signatures-as-image, etc).
--   3. bos-backups    (private)      — backup JSON. Service-role only.
--
-- Path conventions (enforced by RLS in 002_rls.sql):
--   brand-assets   → {ownerId}/{mode}/logo-{timestamp}.{ext}
--   document-media → {ownerId}/{documentId}/{nanoid}.{ext}
--   bos-backups    → backup-{timestamp}.json (no per-user scoping; service-role only)
--
-- Size caps (enforced both client-side by compression and here at bucket level):
--   brand-assets   → 2 MB raw upload cap (compressed targets ~200 KB)
--   document-media → 5 MB raw upload cap (compressed targets ~1 MB)
--   bos-backups    → 50 MB cap

-- Public bucket for brand logos and graphics — accessible by CDN without auth
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'brand-assets',
  'brand-assets',
  true,
  2097152,                                -- 2 MB per file
  array[
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/svg+xml'
  ]
)
on conflict (id) do nothing;

-- Authenticated bucket for images embedded inside documents
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'document-media',
  'document-media',
  false,
  5242880,                                -- 5 MB per file
  array[
    'image/png',
    'image/jpeg',
    'image/webp'
  ]
)
on conflict (id) do nothing;

-- Private service-role bucket for backups
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'bos-backups',
  'bos-backups',
  false,
  52428800,                               -- 50 MB per file
  array['application/json']
)
on conflict (id) do nothing;

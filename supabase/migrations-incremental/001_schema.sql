-- ============================================================
-- Business OS — Schema Migration 001
-- Complete database schema
-- ============================================================

-- Enable required extensions
create extension if not exists "pgcrypto";

-- ─── BRAND PROFILES ───
create table public.brand_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  mode text not null check (mode in ('personal', 'agency')),
  logo_url text,
  primary_colour text not null default '#4F8EF7',
  secondary_colour text not null default '#8B6CF7',
  font_choice text not null default 'DM Sans',
  tone text not null default 'confident' check (tone in ('formal', 'conversational', 'confident')),
  business_name text not null default '',
  tagline text,
  phone text,
  whatsapp text,
  email text,
  website text,
  address text,
  gst_number text,
  bank_name text,
  bank_account_number text,
  bank_ifsc text,
  bank_upi text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, mode)
);

-- ─── CLIENTS ───
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  mode text not null check (mode in ('personal', 'agency')),
  name text not null,
  company text,
  contact_name text,
  contact_email text,
  contact_phone text,
  preferred_channel text default 'email' check (preferred_channel in ('email', 'whatsapp', 'phone')),
  notes text default '',
  current_stage text not null default 'interested' check (current_stage in (
    'interested', 'proposal_sent', 'contract_sent', 'contract_signed',
    'requirements_sent', 'requirements_received', 'initial_payment_received',
    'work_in_progress', 'phase_1_complete', 'phase_2_complete',
    'review_and_feedback', 'revisions_complete', 'final_payment_received',
    'delivered', 'deployed', 'support_period_active', 'completed'
  )),
  stage_history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── DOCUMENTS ───
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  mode text not null check (mode in ('personal', 'agency')),
  type text not null check (type in ('proposal', 'contract', 'sow', 'requirements', 'invoice', 'delivery')),
  client_id uuid references public.clients on delete set null,
  title text not null default '',
  fields jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'final', 'sent', 'viewed', 'signed')),
  share_token text unique,
  signed_at timestamptz,
  signer_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── SIGNATURES ───
create table public.signatures (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references public.documents on delete cascade not null,
  signer_name text not null,
  signed_at timestamptz not null default now(),
  ip_address text
);

-- ─── LEADS (BD Pipeline) ───
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  mode text not null check (mode in ('personal', 'agency')),
  company text not null,
  contact_name text,
  contact_email text,
  contact_phone text,
  source text,
  stage text not null default 'prospect' check (stage in (
    'prospect', 'contacted', 'replied', 'meeting_scheduled',
    'proposal_sent', 'negotiating', 'closed_won', 'closed_lost'
  )),
  notes jsonb not null default '[]'::jsonb,
  last_activity_at timestamptz not null default now(),
  next_action text,
  next_action_date date,
  deal_value numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── INVOICES ───
create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  mode text not null check (mode in ('personal', 'agency')),
  client_id uuid references public.clients on delete set null,
  document_id uuid references public.documents on delete set null,
  number text not null,
  amount numeric not null default 0,
  gst_rate numeric not null default 18,
  gst_amount numeric not null default 0,
  total numeric not null default 0,
  status text not null default 'draft' check (status in ('draft', 'sent', 'viewed', 'overdue', 'paid')),
  due_date date not null,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── TRANSACTIONS ───
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  mode text not null check (mode in ('personal', 'agency')),
  type text not null check (type in ('income', 'expense')),
  category text not null,
  amount numeric not null default 0,
  description text,
  date date not null default current_date,
  invoice_id uuid references public.invoices on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── SUBSCRIPTIONS ───
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  mode text not null check (mode in ('personal', 'agency')),
  name text not null,
  category text not null default 'tools',
  cost numeric not null default 0,
  billing_cycle text not null default 'monthly' check (billing_cycle in ('monthly', 'annual')),
  next_renewal_at date not null,
  status text not null default 'active' check (status in ('active', 'paused', 'cancelled')),
  auto_pay boolean not null default false,
  last_reviewed_at timestamptz default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── SOCIAL POSTS ───
create table public.social_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  mode text not null check (mode in ('personal', 'agency')),
  platform text not null default 'linkedin' check (platform in ('linkedin', 'github', 'twitter', 'other')),
  title text,
  content text,
  planned_date date,
  status text not null default 'idea' check (status in ('idea', 'draft', 'scheduled', 'published')),
  engagement_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── TIME BLOCKS ───
create table public.time_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  mode text not null check (mode in ('personal', 'agency')),
  date date not null default current_date,
  type text not null check (type in ('deep', 'outreach', 'admin', 'personal')),
  start_time time not null,
  end_time time not null,
  label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── PRIORITIES ───
create table public.priorities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  mode text not null check (mode in ('personal', 'agency')),
  date date not null default current_date,
  text text not null,
  completed boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── PERSONAL BLOCKERS ───
create table public.personal_blockers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  mode text not null check (mode in ('personal', 'agency')),
  date date not null default current_date,
  text text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── SUPPORT PERIODS ───
create table public.support_periods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  mode text not null check (mode in ('personal', 'agency')),
  client_id uuid references public.clients on delete cascade not null,
  start_date date not null,
  end_date date not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── FEEDBACK / TESTIMONIALS ───
create table public.testimonials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  mode text not null check (mode in ('personal', 'agency')),
  client_id uuid references public.clients on delete cascade not null,
  content text not null,
  source text default 'direct' check (source in ('direct', 'linkedin', 'email', 'form')),
  portfolio_usable boolean not null default false,
  received_at date default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── ACCESS ROLES (Agency BD) ───
create table public.access_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  granted_user_id uuid references auth.users not null,
  role text not null check (role in ('bd', 'viewer')),
  allowed_sections jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, granted_user_id)
);

-- ─── QUICK LOG ───
create table public.quick_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  mode text not null check (mode in ('personal', 'agency')),
  type text not null check (type in ('lead', 'call', 'client_note', 'payment', 'task', 'other')),
  content text not null,
  processed boolean not null default false,
  linked_id uuid,
  created_at timestamptz not null default now()
);

-- ─── PROFILE REVIEW TRACKERS ───
create table public.profile_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  platform text not null check (platform in ('linkedin', 'github')),
  section text not null,
  completed boolean not null default false,
  last_reviewed_at timestamptz,
  next_review_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── INDEXES ───
create index idx_brand_profiles_user_mode on public.brand_profiles (user_id, mode);
create index idx_clients_user_mode on public.clients (user_id, mode);
create index idx_clients_stage on public.clients (current_stage);
create index idx_documents_user_mode on public.documents (user_id, mode);
create index idx_documents_share_token on public.documents (share_token);
create index idx_documents_client on public.documents (client_id);
create index idx_leads_user_mode on public.leads (user_id, mode);
create index idx_leads_stage on public.leads (stage);
create index idx_invoices_user_mode on public.invoices (user_id, mode);
create index idx_invoices_status on public.invoices (status);
create index idx_invoices_due_date on public.invoices (due_date);
create index idx_transactions_user_mode on public.transactions (user_id, mode);
create index idx_transactions_date on public.transactions (date);
create index idx_subscriptions_user_mode on public.subscriptions (user_id, mode);
create index idx_subscriptions_renewal on public.subscriptions (next_renewal_at);
create index idx_social_posts_user_mode on public.social_posts (user_id, mode);
create index idx_social_posts_date on public.social_posts (planned_date);
create index idx_time_blocks_user_date on public.time_blocks (user_id, date);
create index idx_priorities_user_date on public.priorities (user_id, date);
create index idx_support_periods_end on public.support_periods (end_date);
create index idx_quick_logs_user on public.quick_logs (user_id, created_at desc);

-- ─── UPDATED_AT TRIGGER ───
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Apply updated_at trigger to all tables
do $$
declare
  t text;
begin
  for t in select unnest(array[
    'brand_profiles', 'clients', 'documents', 'leads', 'invoices',
    'transactions', 'subscriptions', 'social_posts', 'time_blocks',
    'priorities', 'personal_blockers', 'support_periods', 'testimonials',
    'access_roles', 'profile_reviews'
  ]) loop
    execute format(
      'create trigger set_updated_at before update on public.%I
       for each row execute function public.handle_updated_at()',
      t
    );
  end loop;
end;
$$;

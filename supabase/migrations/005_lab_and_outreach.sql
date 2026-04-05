-- ============================================================
-- Migration 005: Lab tables + Outreach leads + Client credentials
-- ============================================================

-- ── Outreach leads (personal LinkedIn pipeline) ──
create table if not exists public.outreach_leads (
  id           uuid default gen_random_uuid() primary key,
  user_id      uuid not null,
  mode         text not null default 'personal',
  name         text not null,
  profile_url  text,
  company      text,
  requirement  text,
  status       text not null default 'found',
  notes        text,
  found_at     timestamptz default now(),
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

alter table public.outreach_leads enable row level security;
create policy "Users own outreach leads"
  on public.outreach_leads for all
  using (user_id::text = current_setting('app.bos_uid', true));

-- ── Lab projects ──
create table if not exists public.lab_projects (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid not null,
  title       text not null,
  description text,
  status      text not null default 'idea',
  tech_stack  text,
  url         text,
  repo_url    text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

alter table public.lab_projects enable row level security;
create policy "Users own lab projects"
  on public.lab_projects for all
  using (user_id::text = current_setting('app.bos_uid', true));

-- ── Lab tools ──
create table if not exists public.lab_tools (
  id           uuid default gen_random_uuid() primary key,
  user_id      uuid not null,
  name         text not null,
  category     text not null default 'Other',
  status       text not null default 'evaluating',
  notes        text,
  url          text,
  monthly_cost numeric default 0,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

alter table public.lab_tools enable row level security;
create policy "Users own lab tools"
  on public.lab_tools for all
  using (user_id::text = current_setting('app.bos_uid', true));

-- ── Lab skills ──
create table if not exists public.lab_skills (
  id         uuid default gen_random_uuid() primary key,
  user_id    uuid not null,
  name       text not null,
  category   text not null default 'Other',
  status     text not null default 'learning',
  resource   text,
  notes      text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.lab_skills enable row level security;
create policy "Users own lab skills"
  on public.lab_skills for all
  using (user_id::text = current_setting('app.bos_uid', true));

-- ── Add credentials + service_type columns to clients ──
alter table public.clients
  add column if not exists service_type  text,
  add column if not exists credentials   jsonb default '[]'::jsonb;

-- ── moddatetime triggers ──
create extension if not exists moddatetime;

do $$ begin
  create trigger handle_updated_at_outreach_leads
    before update on public.outreach_leads
    for each row execute procedure moddatetime(updated_at);
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger handle_updated_at_lab_projects
    before update on public.lab_projects
    for each row execute procedure moddatetime(updated_at);
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger handle_updated_at_lab_tools
    before update on public.lab_tools
    for each row execute procedure moddatetime(updated_at);
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger handle_updated_at_lab_skills
    before update on public.lab_skills
    for each row execute procedure moddatetime(updated_at);
exception when duplicate_object then null; end $$;

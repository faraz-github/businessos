-- ============================================================
-- Business OS — RLS Policies Migration 002
-- All Row Level Security policies
-- ============================================================

-- Enable RLS on all tables
alter table public.brand_profiles enable row level security;
alter table public.clients enable row level security;
alter table public.documents enable row level security;
alter table public.signatures enable row level security;
alter table public.leads enable row level security;
alter table public.invoices enable row level security;
alter table public.transactions enable row level security;
alter table public.subscriptions enable row level security;
alter table public.social_posts enable row level security;
alter table public.time_blocks enable row level security;
alter table public.priorities enable row level security;
alter table public.personal_blockers enable row level security;
alter table public.support_periods enable row level security;
alter table public.testimonials enable row level security;
alter table public.access_roles enable row level security;
alter table public.quick_logs enable row level security;
alter table public.profile_reviews enable row level security;

-- ─── HELPER: Check if user has BD access to an owner's data ───
create or replace function public.has_bd_access(owner_uid uuid)
returns boolean as $$
begin
  return exists (
    select 1 from public.access_roles
    where user_id = owner_uid
      and granted_user_id = auth.uid()
      and role = 'bd'
  );
end;
$$ language plpgsql security definer;

-- ─── BRAND PROFILES ───
create policy "Users manage own brand profiles"
  on public.brand_profiles for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ─── CLIENTS ───
create policy "Users manage own clients"
  on public.clients for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ─── DOCUMENTS ───
-- Owner full access
create policy "Users manage own documents"
  on public.documents for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Public view via share token (for unauthenticated doc viewing)
create policy "Public view documents by share token"
  on public.documents for select
  using (share_token is not null);

-- ─── SIGNATURES ───
-- Anyone can insert a signature (public signing)
create policy "Anyone can sign documents"
  on public.signatures for insert
  with check (true);

-- Owner can view signatures on their documents
create policy "Users view signatures on own documents"
  on public.signatures for select
  using (
    exists (
      select 1 from public.documents
      where documents.id = signatures.document_id
        and documents.user_id = auth.uid()
    )
  );

-- ─── LEADS ───
-- Owner full access
create policy "Users manage own leads"
  on public.leads for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- BD role: select and insert on agency leads
create policy "BD users can view leads"
  on public.leads for select
  using (
    mode = 'agency'
    and public.has_bd_access(user_id)
  );

create policy "BD users can insert leads"
  on public.leads for insert
  with check (
    mode = 'agency'
    and public.has_bd_access(user_id)
  );

create policy "BD users can update leads"
  on public.leads for update
  using (
    mode = 'agency'
    and public.has_bd_access(user_id)
  )
  with check (
    mode = 'agency'
    and public.has_bd_access(user_id)
  );

-- ─── INVOICES ───
create policy "Users manage own invoices"
  on public.invoices for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ─── TRANSACTIONS ───
create policy "Users manage own transactions"
  on public.transactions for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ─── SUBSCRIPTIONS ───
create policy "Users manage own subscriptions"
  on public.subscriptions for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ─── SOCIAL POSTS ───
create policy "Users manage own social posts"
  on public.social_posts for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ─── TIME BLOCKS ───
create policy "Users manage own time blocks"
  on public.time_blocks for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ─── PRIORITIES ───
create policy "Users manage own priorities"
  on public.priorities for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ─── PERSONAL BLOCKERS ───
create policy "Users manage own blockers"
  on public.personal_blockers for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ─── SUPPORT PERIODS ───
create policy "Users manage own support periods"
  on public.support_periods for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ─── TESTIMONIALS ───
create policy "Users manage own testimonials"
  on public.testimonials for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ─── ACCESS ROLES ───
-- Only the owner can manage access roles
create policy "Users manage own access roles"
  on public.access_roles for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Granted users can read their own role
create policy "Granted users can read their role"
  on public.access_roles for select
  using (granted_user_id = auth.uid());

-- ─── QUICK LOGS ───
create policy "Users manage own quick logs"
  on public.quick_logs for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ─── PROFILE REVIEWS ───
create policy "Users manage own profile reviews"
  on public.profile_reviews for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ─── STORAGE: Brand logos bucket ───
insert into storage.buckets (id, name, public)
values ('brand-logos', 'brand-logos', true)
on conflict (id) do nothing;

create policy "Users can upload brand logos"
  on storage.objects for insert
  with check (
    bucket_id = 'brand-logos'
    and auth.uid() is not null
  );

create policy "Users can update their brand logos"
  on storage.objects for update
  using (
    bucket_id = 'brand-logos'
    and auth.uid() is not null
  );

create policy "Anyone can view brand logos"
  on storage.objects for select
  using (bucket_id = 'brand-logos');

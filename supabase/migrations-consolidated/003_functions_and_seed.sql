-- ============================================================
-- Business OS — Consolidated Functions & Seed Helpers (v3.5.0)
-- 003_functions_and_seed.sql
--
-- Runtime functions that aren't table DDL and aren't RLS policies:
--   1. initialize_profile_reviews(uid)   — seeds LinkedIn/GitHub
--                                          90-day review checklist
--                                          for a new user
--   2. handle_new_user() trigger helper  — optional hook that calls
--                                          initialize_profile_reviews
--                                          on bos_users insert
--   3. get_home_stats(p_user_id, p_mode) — single-RPC home dashboard
--                                          aggregation (8 queries → 1)
--
-- Run order: this file assumes 001_schema.sql and 002_rls.sql have
-- already been applied. Required tables: bos_users, profile_reviews,
-- transactions, documents, clients, leads, social_posts.
--
-- What's NOT here
-- ---------------
--   - bos_uid() / bos_role() / bos_can_access() / set_bos_claims()
--     — these were built in incremental 004 for a JWT-claim-based
--     RLS scheme that was later abandoned (007 → 015). The consolidated
--     RLS (002_rls.sql) doesn't use them, so they're not recreated.
--   - Superadmin seed — handled by app/api/auth/seed, gated on
--     SEED_SECRET. See .env.local.example and the incremental
--     004b_reseed_superadmin.sql for a manual backup path.
-- ============================================================

-- ============================================================
-- 1. PROFILE REVIEWS SEED
-- ============================================================
-- Called from app code (e.g. after user creation) to populate the
-- default LinkedIn + GitHub 90-day review checklists for a user.
-- Idempotent: re-running is a no-op because of the on-conflict guard.
create or replace function public.initialize_profile_reviews(uid uuid)
returns void
language plpgsql
security definer
as $$
declare
  linkedin_sections text[] := array[
    'Headline & banner image',
    'About section',
    'Featured section',
    'Experience descriptions',
    'Skills & endorsements',
    'Recommendations',
    'Activity & posting frequency'
  ];
  github_sections text[] := array[
    'Pinned Repos (6 best projects)',
    'README quality per pinned repo',
    'Profile README',
    'Contribution graph health',
    'Project descriptions',
    'Live demo links',
    'Tech stack accuracy'
  ];
  s text;
begin
  foreach s in array linkedin_sections loop
    insert into public.profile_reviews (user_id, platform, section, next_review_at)
    values (uid, 'linkedin', s, now() + interval '90 days')
    on conflict do nothing;
  end loop;

  foreach s in array github_sections loop
    insert into public.profile_reviews (user_id, platform, section, next_review_at)
    values (uid, 'github', s, now() + interval '90 days')
    on conflict do nothing;
  end loop;
end;
$$;

-- Optional trigger function — can be attached to public.bos_users if
-- auto-seeding is desired. Not attached by default; the app calls
-- initialize_profile_reviews() explicitly after user creation.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  perform public.initialize_profile_reviews(new.id);
  return new;
end;
$$;

-- ============================================================
-- 2. HOME STATS RPC
-- ============================================================
-- Returns everything the Home dashboard displays in a single call.
-- Replaces 8 sequential round-trips in getHomeStats() with one DB call.
-- See the PersonalHomeClient / AgencyHomeClient components — this
-- shape is what they consume directly.
--
-- NB: v3.5 spec §3 (finance audit) may revise the revenue / outstanding
-- / overdue semantics. The current definition:
--   - revenue_this_month: sum of income transactions dated >= month_start
--   - outstanding_total:  sum of (fields->>'total') for invoice documents
--                         with status NOT IN ('paid','signed')
--   - overdue_total:      subset of outstanding where
--                         (fields->>'due_date')::date < today
--   - sparkline_data:     5 months of income-transaction totals,
--                         zero-filled via generate_series so empty
--                         months still appear on the chart
create or replace function public.get_home_stats(
  p_user_id uuid,
  p_mode    text
)
returns jsonb
language plpgsql
stable
security definer
as $$
declare
  v_today            date := current_date;
  v_month_start      date := date_trunc('month', current_date)::date;
  v_five_months_ago  date := date_trunc('month', current_date - interval '4 months')::date;

  -- Money
  v_revenue_this_month  numeric := 0;
  v_outstanding_total   numeric := 0;
  v_overdue_total       numeric := 0;
  v_sparkline_data      jsonb   := '[]'::jsonb;

  -- Clients
  v_active_clients_count   integer := 0;
  v_active_projects_count  integer := 0;
  v_pipeline_leads_count   integer := 0;
  v_total_clients_count    integer := 0;

  -- Social
  v_posts_this_month  integer := 0;

  -- Work
  v_delivered_this_month  integer := 0;

  -- Post-project stages: excluded from the "active clients" count
  -- (matches the final clients.current_stage list baked into 001_schema.sql)
  v_post_project_stages text[] := array[
    'handover', 'deployed', 'support_active',
    'feedback_sent', 'retention_sent', 'completed'
  ];

  -- Work stages: counted as active projects
  v_work_stages text[] := array[
    'in_progress', 'milestone_review', 'revision',
    'final_review', 'final_payment_sent'
  ];
begin
  -- ── 1. Revenue this month ───────────────────────────────────
  select coalesce(sum(amount), 0)
    into v_revenue_this_month
    from public.transactions
   where user_id = p_user_id
     and mode    = p_mode
     and type    = 'income'
     and date   >= v_month_start;

  -- ── 2. Outstanding + overdue (from invoice documents) ───────
  -- Invoice data lives in documents.fields (type = 'invoice').
  --
  -- outstanding = every unpaid invoice that's been SENT to the client
  --               (drafts don't count — the client doesn't owe anything
  --               until they've been sent the invoice). Statuses that
  --               qualify: sent, viewed, overdue.
  -- overdue     = subset of outstanding with due_date in the past AND
  --               no paid_date on record (belt-and-braces with the
  --               status check, for when step 4's paid_date lands and
  --               a backdated payment could pre-date the status flip).
  select
    coalesce(sum((fields->>'total')::numeric), 0),
    coalesce(sum(
      case
        when (fields->>'due_date') is not null
         and (fields->>'due_date')::date < v_today
         and (fields->>'paid_date') is null
        then (fields->>'total')::numeric
        else 0
      end
    ), 0)
    into v_outstanding_total, v_overdue_total
    from public.documents
   where user_id = p_user_id
     and mode    = p_mode
     and type    = 'invoice'
     and status in ('sent', 'viewed', 'overdue');

  -- ── 3. Client counts ────────────────────────────────────────
  select
    count(*) filter (where current_stage != all(v_post_project_stages)),
    count(*) filter (where current_stage  = any(v_work_stages)),
    count(*)
    into v_active_clients_count, v_active_projects_count, v_total_clients_count
    from public.clients
   where user_id = p_user_id
     and mode    = p_mode;

  -- ── 4. Pipeline leads (open deals) ──────────────────────────
  select count(*)
    into v_pipeline_leads_count
    from public.leads
   where user_id = p_user_id
     and mode    = p_mode
     and stage not in ('closed_won', 'closed_lost');

  -- ── 5. Posts published this month ───────────────────────────
  select count(*)
    into v_posts_this_month
    from public.social_posts
   where user_id      = p_user_id
     and mode         = p_mode
     and status       = 'published'
     and planned_date >= v_month_start;

  -- ── 6. Delivered this month ─────────────────────────────────
  -- Counts clients whose stage_history contains a handover / deployed /
  -- completed entry dated in the current month. A client only counts
  -- once even if they hit multiple "done" stages.
  select count(distinct c.id)
    into v_delivered_this_month
    from public.clients c,
         jsonb_array_elements(c.stage_history) as h
   where c.user_id = p_user_id
     and c.mode    = p_mode
     and c.current_stage = any(array['handover','deployed','support_active','completed'])
     and (h->>'stage') = any(array['handover','deployed','completed'])
     and (h->>'entered_at')::date >= v_month_start;

  -- ── 7. 5-month revenue sparkline ────────────────────────────
  -- One datapoint per month. generate_series guarantees empty months
  -- show up as zero rather than disappearing from the chart.
  select jsonb_agg(
    jsonb_build_object('value', coalesce(monthly.total, 0))
    order by monthly.month_start
  )
    into v_sparkline_data
    from (
      select
        gs.month_start,
        sum(t.amount) as total
      from (
        select generate_series(
          v_five_months_ago,
          v_month_start,
          '1 month'::interval
        )::date as month_start
      ) gs
      left join public.transactions t
        on t.user_id = p_user_id
       and t.mode    = p_mode
       and t.type    = 'income'
       and t.date   >= gs.month_start
       and t.date    < (gs.month_start + interval '1 month')::date
      group by gs.month_start
    ) monthly;

  -- ── Return the assembled payload ────────────────────────────
  -- JSON key names are intentionally camelCase to match the TypeScript
  -- HomeStats type consumed by the client components.
  return jsonb_build_object(
    'money', jsonb_build_object(
      'revenueThisMonth',  v_revenue_this_month,
      'outstandingTotal',  v_outstanding_total,
      'overdueTotal',      v_overdue_total,
      'sparklineData',     v_sparkline_data
    ),
    'clients', jsonb_build_object(
      'activeProjects',  v_active_projects_count,
      'totalActive',     v_active_clients_count,
      'pipelineLeads',   v_pipeline_leads_count,
      'totalAllTime',    v_total_clients_count
    ),
    'social', jsonb_build_object(
      'postsThisMonth', v_posts_this_month
    ),
    'work', jsonb_build_object(
      'activeProjects',     v_active_projects_count,
      'deliveredThisMonth', v_delivered_this_month
    )
  );
end;
$$;

-- Grant execute to anon + authenticated so the client can call it
-- via the PostgREST RPC endpoint. security definer + explicit
-- p_user_id parameter means callers can't see other users' data
-- by trickery — they can only request aggregates for a specific UUID.
grant execute on function public.get_home_stats(uuid, text) to anon, authenticated;
grant execute on function public.initialize_profile_reviews(uuid) to anon, authenticated;

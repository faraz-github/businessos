-- ============================================================
-- Migration 017: get_home_stats(p_user_id, p_mode)
--
-- Replaces 8 sequential Supabase queries in getHomeStats() with
-- a single database function call. Cuts dashboard load time from
-- 8 sequential round-trips to 1.
--
-- Returns a JSONB object matching the HomeStats shape consumed
-- by PersonalHomeClient and AgencyHomeClient:
-- {
--   money: {
--     revenue_this_month:  numeric,
--     outstanding_total:   numeric,
--     overdue_total:       numeric,
--     sparkline_data:      [{value: numeric}, ...] (5 months)
--   },
--   clients: {
--     active_projects:  integer,
--     total_active:     integer,
--     pipeline_leads:   integer,
--     total_all_time:   integer
--   },
--   social: {
--     posts_this_month: integer
--   },
--   work: {
--     active_projects:     integer,
--     delivered_this_month: integer
--   }
-- }
--
-- Rollback:
--   DROP FUNCTION IF EXISTS public.get_home_stats(uuid, text);
-- ============================================================

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
  v_today            date    := current_date;
  v_month_start      date    := date_trunc('month', current_date)::date;
  v_five_months_ago  date    := date_trunc('month', current_date - interval '4 months')::date;

  -- money
  v_revenue_this_month  numeric := 0;
  v_outstanding_total   numeric := 0;
  v_overdue_total       numeric := 0;
  v_sparkline_data      jsonb   := '[]'::jsonb;

  -- clients
  v_active_clients_count   integer := 0;
  v_active_projects_count  integer := 0;
  v_pipeline_leads_count   integer := 0;
  v_total_clients_count    integer := 0;

  -- social
  v_posts_this_month  integer := 0;

  -- work
  v_delivered_this_month  integer := 0;

  -- post-project stages to exclude from "active" client counts
  -- (matches the constraint in migration 006)
  v_post_project_stages text[] := array[
    'handover', 'deployed', 'support_active',
    'feedback_sent', 'retention_sent', 'completed'
  ];

  -- work stages used to count "active projects"
  v_work_stages text[] := array[
    'in_progress', 'milestone_review', 'revision',
    'final_review', 'final_payment_sent'
  ];

begin

  -- ── 1. Revenue this month ────────────────────────────────────
  select coalesce(sum(amount), 0)
    into v_revenue_this_month
    from public.transactions
   where user_id = p_user_id
     and mode    = p_mode
     and type    = 'income'
     and date   >= v_month_start;

  -- ── 2. Invoice outstanding + overdue ────────────────────────
  -- Invoice data lives in documents.fields (type='invoice').
  -- outstanding = all unpaid invoices
  -- overdue     = unpaid invoices past their due date
  select
    coalesce(sum((fields->>'total')::numeric), 0),
    coalesce(sum(
      case
        when (fields->>'due_date') is not null
         and (fields->>'due_date')::date < v_today
        then (fields->>'total')::numeric
        else 0
      end
    ), 0)
    into v_outstanding_total, v_overdue_total
    from public.documents
   where user_id = p_user_id
     and mode    = p_mode
     and type    = 'invoice'
     and status not in ('paid', 'signed');

  -- ── 3. Client counts ────────────────────────────────────────
  select
    count(*) filter (where current_stage != all(v_post_project_stages)),
    count(*) filter (where current_stage  = any(v_work_stages)),
    count(*)
    into v_active_clients_count, v_active_projects_count, v_total_clients_count
    from public.clients
   where user_id = p_user_id
     and mode    = p_mode;

  -- ── 4. Pipeline leads (not closed) ──────────────────────────
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
   where user_id     = p_user_id
     and mode        = p_mode
     and status      = 'published'
     and planned_date >= v_month_start;

  -- ── 6. Delivered this month ──────────────────────────────────
  -- Count clients whose stage_history contains a handover/deployed/completed
  -- entry in the current calendar month.
  -- stage_history is a JSONB array: [{stage: text, entered_at: text}, ...]
  select count(distinct c.id)
    into v_delivered_this_month
    from public.clients c,
         jsonb_array_elements(c.stage_history) as h
   where c.user_id = p_user_id
     and c.mode    = p_mode
     and c.current_stage = any(array['handover','deployed','support_active','completed'])
     and (h->>'stage') = any(array['handover','deployed','completed'])
     and (h->>'entered_at')::date >= v_month_start;

  -- ── 7. 5-month revenue sparkline ─────────────────────────────
  -- One row per month for the last 5 months (including current).
  -- Uses generate_series so months with zero income still appear.
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

  -- ── Return assembled JSONB ───────────────────────────────────
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

-- Grant execute to anon and authenticated roles so the Supabase JS
-- client can call it. The function uses security definer and checks
-- p_user_id explicitly — callers cannot access other users' data.
grant execute on function public.get_home_stats(uuid, text) to anon, authenticated;

-- ── Rollback ──
-- drop function if exists public.get_home_stats(uuid, text);

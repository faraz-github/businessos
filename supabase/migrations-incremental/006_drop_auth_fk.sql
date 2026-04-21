-- ============================================================
-- Migration 006: Drop auth.users foreign key constraints
-- 
-- All tables were created with user_id references auth.users,
-- but this app uses bos_users for authentication (custom JWT).
-- No bos_users UUID exists in auth.users, so every insert
-- fails with a FK violation. Remove the constraint while keeping
-- user_id as a required uuid column.
-- ============================================================

alter table public.brand_profiles    drop constraint if exists brand_profiles_user_id_fkey;
alter table public.clients           drop constraint if exists clients_user_id_fkey;
alter table public.documents         drop constraint if exists documents_user_id_fkey;
alter table public.leads             drop constraint if exists leads_user_id_fkey;
alter table public.invoices          drop constraint if exists invoices_user_id_fkey;
alter table public.transactions      drop constraint if exists transactions_user_id_fkey;
alter table public.subscriptions     drop constraint if exists subscriptions_user_id_fkey;
alter table public.social_posts      drop constraint if exists social_posts_user_id_fkey;
alter table public.time_blocks       drop constraint if exists time_blocks_user_id_fkey;
alter table public.priorities        drop constraint if exists priorities_user_id_fkey;
alter table public.personal_blockers drop constraint if exists personal_blockers_user_id_fkey;
alter table public.support_periods   drop constraint if exists support_periods_user_id_fkey;
alter table public.testimonials      drop constraint if exists testimonials_user_id_fkey;
alter table public.access_roles      drop constraint if exists access_roles_user_id_fkey;
alter table public.access_roles      drop constraint if exists access_roles_granted_user_id_fkey;
alter table public.quick_logs        drop constraint if exists quick_logs_user_id_fkey;
alter table public.profile_reviews   drop constraint if exists profile_reviews_user_id_fkey;

-- Also drop for the new tables added in migration 005
alter table public.outreach_leads    drop constraint if exists outreach_leads_user_id_fkey;
alter table public.lab_projects      drop constraint if exists lab_projects_user_id_fkey;
alter table public.lab_tools         drop constraint if exists lab_tools_user_id_fkey;
alter table public.lab_skills        drop constraint if exists lab_skills_user_id_fkey;

-- user_id columns remain NOT NULL uuid — just without the FK reference to auth.users.
-- Access control is enforced by our JWT layer (proxy.ts) and RLS (bos_uid()).

-- ─── Fix clients.current_stage check constraint ───
-- The original constraint used old stage names. The app uses new ones.
-- Drop and recreate with the correct values.
alter table public.clients drop constraint if exists clients_current_stage_check;

alter table public.clients add constraint clients_current_stage_check
  check (current_stage in (
    'lead', 'contacted', 'qualified',
    'proposal_sent', 'proposal_accepted',
    'contract_sent', 'contract_signed',
    'upfront_paid', 'requirements_sent', 'requirements_received', 'credentials_pending',
    'in_progress', 'milestone_review', 'revision',
    'final_review', 'final_payment_sent', 'final_payment_received',
    'handover', 'deployed',
    'support_active', 'feedback_sent', 'retention_sent', 'completed'
  ));

-- Also fix the default value
alter table public.clients alter column current_stage set default 'lead';

-- Fix preferred_channel to include all values the app uses
alter table public.clients drop constraint if exists clients_preferred_channel_check;
alter table public.clients add constraint clients_preferred_channel_check
  check (preferred_channel in ('email', 'whatsapp', 'phone'));

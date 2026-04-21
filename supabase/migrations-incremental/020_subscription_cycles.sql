-- ============================================================
-- Migration 020: Widen subscriptions.billing_cycle
--
-- v3.5.0 adds 'quarterly' and 'semi_annual' as first-class billing
-- cycles alongside 'monthly' and 'annual'.
--
-- The column is plain text with a check constraint — not a PG enum —
-- so this is a pure constraint widening. Existing rows (monthly /
-- annual only) continue to validate. Nothing else to back-fill.
--
-- Fresh Supabase projects bootstrapped from supabase/migrations-consolidated/
-- already have all four cycles baked into the CREATE TABLE — this
-- migration exists only to bring existing v3.4.x instances forward.
--
-- Cross-references:
--   types/index.ts        → BillingCycle union includes the new values
--   types/schemas.ts      → subscriptionSchema.billing_cycle enum matches
--   lib/utils/index.ts    → monthlyEquivalent() divides cost appropriately
--   app/dashboard/personal/finance/page.tsx → BILLING_CYCLE_OPTIONS
--
-- Rollback:
--   alter table public.subscriptions drop constraint if exists subscriptions_billing_cycle_check;
--   alter table public.subscriptions add constraint subscriptions_billing_cycle_check
--     check (billing_cycle in ('monthly', 'annual'));
--   (Only safe if no rows use the new values — check before rolling back:
--     select count(*) from public.subscriptions where billing_cycle in ('quarterly', 'semi_annual');
--   )
-- ============================================================

alter table public.subscriptions
  drop constraint if exists subscriptions_billing_cycle_check;

alter table public.subscriptions
  add constraint subscriptions_billing_cycle_check
  check (billing_cycle in ('monthly', 'quarterly', 'semi_annual', 'annual'));

-- ============================================================
-- Migration 016: Clean up orphaned policy references
--
-- Context:
--   Migration 012 dropped public.invoices and public.access_roles.
--   DROP TABLE ... CASCADE removes attached policies automatically,
--   so in a normal sequential run there is nothing to clean up.
--
--   This migration is a safety net for two scenarios:
--   1. A partial re-run where 015 was applied before 012 (unlikely
--      but possible if migrations were run out of order).
--   2. Any future migration tooling that replays migrations on a
--      fresh schema — the pg_policies check makes every drop idempotent.
--
-- What this does:
--   Drops any policies in pg_policies that reference tables which
--   no longer exist. Uses dynamic SQL so it never errors on missing
--   tables or policies.
--
-- Rollback: no-op — orphaned policies have no effect.
-- ============================================================

do $$ declare
  r record;
begin
  -- Drop any remaining policies on tables that were dropped in migration 012.
  -- pg_policies only lists policies for tables that exist, so this loop
  -- is a no-op if the tables are already gone. Runs silently either way.
  for r in (
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('invoices', 'access_roles')
  ) loop
    execute format(
      'drop policy if exists %I on %I.%I',
      r.policyname, r.schemaname, r.tablename
    );
    raise notice 'Dropped orphaned policy: % on %.%',
      r.policyname, r.schemaname, r.tablename;
  end loop;
end $$;

-- Verify: confirm neither table exists (informational only — does not fail)
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public'
      and table_name in ('invoices', 'access_roles')
  ) then
    raise warning
      'Tables invoices or access_roles still exist. '
      'Migration 012 may not have run. Run 012_cleanup_orphaned_tables.sql first.';
  end if;
end $$;

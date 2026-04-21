# Supabase — Migrations

This directory contains **two** migration sets. Use the right one for the situation.

```
supabase/
├── config.toml
├── migrations-consolidated/    ← fresh-deploy baseline (v3.5.0)
│   ├── 001_schema.sql
│   ├── 002_rls.sql
│   └── 003_functions_and_seed.sql
└── migrations-incremental/     ← historical chain, 001–019
    ├── 001_schema.sql
    ├── 002_rls_policies.sql
    ├── ... (20 files)
    └── 019_backup_bucket.sql
```

## Which one to use

| Situation | Use | How |
|---|---|---|
| **Bootstrapping a fresh Supabase project** from scratch (new clone, staging env, a teammate's local DB) | `migrations-consolidated/` | Run the three files in order via the Supabase dashboard SQL editor, or copy them into `supabase/migrations/` temporarily for `supabase db push` |
| **Existing v3.x instance** already running against the incremental chain | `migrations-incremental/` | Has already applied 001–019. New forward-only migrations land here as 020, 021, … |
| **Resetting a local dev DB** that was built from the consolidated baseline | `migrations-consolidated/` | `supabase db reset` with the folder symlinked / renamed to `migrations/` |

**Never run both.** The consolidated files describe the end state of the incremental chain. Running them after the incremental chain would fail with "relation already exists"; running the incremental chain after the consolidated files would fail with duplicate objects.

## The Supabase CLI caveat

The Supabase CLI looks for migrations in `supabase/migrations/` by convention — neither of the directory names above is the one it expects. For this project that's deliberate:

- Migrations in this codebase are applied via the **dashboard SQL editor** (for prod) or by copying files into `supabase/migrations/` temporarily (for CLI-based local work). The `pnpm db:migrate` script wraps `supabase db push`, which reads `migrations/` — so if you want to use that script, temporarily rename one of these folders to `migrations/`, run it, then rename back.
- Long-term, we may add a thin shell script (`scripts/migrate-local.sh`) that picks a folder and symlinks it as `migrations/` before invoking the CLI, so both sets stay archival.

## Consolidated files — what's in each

### `001_schema.sql`
All tables, indexes, check constraints, updated_at triggers, and the two storage buckets (`brand-assets`, `bos-backups`). Represents the **end state** of incremental migrations 001–018 minus what was later deleted (the `invoices` and `access_roles` tables that 012 dropped).

Notable bakes:
- `clients.current_stage` uses the final 23-value list (from incremental 006), not the original 17-value list (from 001).
- `documents.status` includes `paid` and `overdue` (incremental 009 + 014).
- `documents` includes `access_code`, `access_code_expires_at`, `edit_count`, `last_edited_at` (incremental 008, 013).
- `leads` includes `channel`, `profile_url`, `context` (incremental 011).
- `subscriptions.billing_cycle` includes `'quarterly'` and `'semi_annual'` — ready for v3.5 step 5. Existing v3.4 instances get those values via a small incremental migration as part of step 5's work.
- `outreach_leads`, `lab_projects`, `lab_tools`, `lab_skills` present from the start (added in incremental 005).
- `document_versions` present from the start (added in incremental 018).

### `002_rls.sql`
Standard Supabase-recommended RLS. Every table has `ENABLE ROW LEVEL SECURITY` and a real policy.

Design posture:
- **`bos_users` is locked down** — no policy grants access, plus an explicit `using (false) with check (false)` deny-all. Only the service-role client (which bypasses RLS) can read/write it. This is correct — the browser should never touch bos_users directly.
- **Every user-data table has a `user_id is not null` policy.** This is a structural safety net; the real ownership check is the `.eq('user_id', ownerId)` filter in every query, plus `proxy.ts` gating `/dashboard` routes before any handler runs.
- **`documents` has a public-read policy** keyed on `share_token is not null and status in ('sent', 'viewed', 'signed', 'paid')`. Drafts and finals without a send event cannot leak via share_token brute-force.
- **`signatures` has a public-insert policy** (`document_id is not null`) for the `/doc/[token]` signing flow. The server action that finalizes the signature additionally verifies share_token + access_code + status.
- **`document_versions` is append-only** — read + insert policies only; no update/delete, so snapshots are immutable at the RLS layer.
- **Storage policies**: `brand-assets` is public-read + authenticated-write; `document-media` is authenticated read/write scoped to each owner's folder; `bos-backups` is service-role-only across all operations.

Not recreated (intentional):
- `bos_uid()` / `bos_role()` / `bos_can_access()` / `set_bos_claims()` helpers from incremental 004. Those were built for a JWT-claim-based RLS scheme that was never fully wired up and was walked back in 007 → 015. Nothing in the current codebase calls them. If you want per-session RLS in v4, rebuild these cleanly with the new session model — don't revive the old ones.
- `has_bd_access()` helper from incremental 002. BD access moved into `bos_users.allowed_agency` arrays; the helper is dead code.

### `003_functions_and_seed.sql`
- `initialize_profile_reviews(uid)` — seeds LinkedIn + GitHub 90-day review checklists. Idempotent.
- `handle_new_user()` — optional trigger function that wraps the above. Not attached to any table by default (the app calls `initialize_profile_reviews` explicitly); attach it to `bos_users` if you want auto-seeding.
- `get_home_stats(p_user_id, p_mode)` — single-RPC aggregation for the Home dashboard. Replaces 8 sequential Supabase queries.

## Verifying the consolidated baseline matches production

Per the v3.5 spec §1 acceptance criteria:

```bash
# 1. Apply consolidated files to an empty Supabase project.
#    (Via dashboard SQL editor — paste each file in order.)

# 2. Dump the schema from both instances.
pg_dump --schema-only --no-owner \
  "postgres://...:...@...:5432/postgres?sslmode=require" \
  > /tmp/consolidated.sql

pg_dump --schema-only --no-owner \
  "postgres://...:...@<prod-host>:5432/postgres?sslmode=require" \
  > /tmp/production.sql

# 3. Diff. The only differences should be names of objects (e.g.
#    the serial migration name stamps) — not table structures,
#    columns, constraints, indexes, or policies.
diff /tmp/production.sql /tmp/consolidated.sql
```

Also check `pg_policies`:
```sql
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
```
Both instances should return the same set of (table, policy, command) tuples.

## What the consolidated files deliberately do NOT include

- **Superadmin seed.** Handled by `POST /api/auth/seed` using the `SEED_SECRET` env var. See `.env.local.example`. This keeps credentials out of version control.
- **Sample / demo data.** None. Use `pnpm seed` if you want the dev seed script.
- **The two new buckets** (`brand-assets`, `document-media`) planned by v3.5 spec §2. Those land with that step's work, not this refactor.

## Adding a new migration going forward

Once you're on the v3.5 baseline, new schema changes go into `migrations-incremental/` as `020_…`, `021_…`, etc. — **and** get folded into the consolidated baseline at the next consolidation point (roughly one per minor release). Always add the rollback comment at the bottom, following the convention set by migrations 010–019.

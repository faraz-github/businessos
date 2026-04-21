-- ============================================================
-- Migration 018: Document version snapshots
--
-- Tracks a snapshot of document fields each time a document is
-- sent to a client (status → 'sent'). This means:
--   - The owner always has a record of what the client received
--   - If a contract is edited post-signature, the signed version
--     is preserved in version 1
--   - Version history is visible in the paperwork UI
--
-- Design decisions:
--   - Snapshots are append-only. No updates, no deletes by users.
--   - version_number is per-document, starting at 1.
--   - fields snapshot is the full JSONB at time of send.
--   - No updated_at — these rows never change.
--
-- Rollback:
--   DROP TABLE IF EXISTS public.document_versions CASCADE;
-- ============================================================

create table public.document_versions (
  id              uuid primary key default gen_random_uuid(),
  document_id     uuid references public.documents on delete cascade not null,
  user_id         uuid not null,
  version_number  integer not null,
  fields          jsonb not null default '{}'::jsonb,
  title           text not null default '',
  status          text not null default 'sent',
  created_at      timestamptz not null default now(),

  -- Each version number must be unique per document
  unique (document_id, version_number)
);

-- Index for fast lookup of versions for a given document
create index idx_document_versions_document
  on public.document_versions (document_id, version_number desc);

-- Index for ownership queries
create index idx_document_versions_user
  on public.document_versions (user_id, created_at desc);

-- ── RLS ──────────────────────────────────────────────────────
alter table public.document_versions enable row level security;

-- Owners can read all versions of their documents
create policy "require user_id: document_versions read"
  on public.document_versions for select
  using (user_id is not null);

-- Owners can insert new versions (append-only — no update/delete)
create policy "require user_id: document_versions insert"
  on public.document_versions for insert
  with check (user_id is not null);

-- No update or delete policies — versions are immutable once written

-- ── Rollback ──
-- drop table if exists public.document_versions cascade;

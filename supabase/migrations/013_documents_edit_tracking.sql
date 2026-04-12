-- ============================================================
-- Migration 013: Add edit tracking to documents
-- Tracks how many times a document has been edited and when.
-- Stored on the table (not in fields JSONB) so it can be
-- queried and displayed without parsing JSON.
-- ============================================================

alter table public.documents
  add column if not exists edit_count    integer not null default 0,
  add column if not exists last_edited_at timestamptz;

-- ── Rollback ──
-- alter table public.documents
--   drop column if exists edit_count,
--   drop column if exists last_edited_at;

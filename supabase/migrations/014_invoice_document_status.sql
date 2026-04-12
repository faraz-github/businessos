-- ============================================================
-- Migration 014: Allow paid/overdue status on documents table
-- The documents table check constraint only had draft/final/sent/viewed/signed.
-- Invoices need paid and overdue to be valid document statuses.
-- ============================================================

alter table public.documents
  drop constraint if exists documents_status_check;

alter table public.documents
  add constraint documents_status_check
  check (status in ('draft', 'final', 'sent', 'viewed', 'signed', 'paid', 'overdue'));

-- ── Rollback ──
-- alter table public.documents drop constraint if exists documents_status_check;
-- alter table public.documents add constraint documents_status_check
--   check (status in ('draft', 'final', 'sent', 'viewed', 'signed'));

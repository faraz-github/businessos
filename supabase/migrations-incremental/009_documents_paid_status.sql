-- Migration 009: Add 'paid' status to documents for invoice tracking
-- The documents table needs 'paid' as a valid status so invoice documents
-- can be marked paid from Finance without a separate invoices table.

alter table public.documents
  drop constraint if exists documents_status_check;

alter table public.documents
  add constraint documents_status_check
  check (status in ('draft', 'final', 'sent', 'viewed', 'signed', 'paid'));

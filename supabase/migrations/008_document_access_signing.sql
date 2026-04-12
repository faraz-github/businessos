-- ============================================================
-- Migration 008: Document access codes + rich signing
-- ============================================================

-- Add access code fields to documents
alter table public.documents
  add column if not exists access_code          text,
  add column if not exists access_code_expires_at timestamptz;

-- Enrich signatures with signing method and data
alter table public.signatures
  add column if not exists signature_type  text default 'typed'
    check (signature_type in ('typed', 'drawn')),
  add column if not exists signature_data  text,   -- base64 canvas for drawn
  add column if not exists signed_date     date default current_date;

-- Index for access code lookup
create index if not exists idx_documents_access_code
  on public.documents (share_token, access_code)
  where access_code is not null;

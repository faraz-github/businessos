-- ============================================================
-- Migration 019: bos-backups storage bucket
--
-- Creates a private storage bucket for backup files.
-- Only server-side (service role) can read/write.
-- No direct client access — all backup ops go through API routes.
--
-- Rollback:
--   delete from storage.buckets where id = 'bos-backups';
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'bos-backups',
  'bos-backups',
  false,                              -- private bucket
  52428800,                           -- 50MB max per file
  array['application/json']          -- only JSON backup files
)
on conflict (id) do nothing;

-- Only authenticated users (via service role in API routes) can access backups.
-- The API routes enforce superadmin-only access at the application level.
-- These storage policies are a safety net.

create policy "Service role only: bos-backups insert"
  on storage.objects for insert
  with check (bucket_id = 'bos-backups' and auth.role() = 'service_role');

create policy "Service role only: bos-backups select"
  on storage.objects for select
  using (bucket_id = 'bos-backups' and auth.role() = 'service_role');

create policy "Service role only: bos-backups delete"
  on storage.objects for delete
  using (bucket_id = 'bos-backups' and auth.role() = 'service_role');

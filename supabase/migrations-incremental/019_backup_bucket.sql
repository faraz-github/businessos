-- ============================================================
-- Migration 019: bos-backups storage bucket
--
-- Creates a private storage bucket for backup files.
-- Only server-side (service role) can read/write.
-- No direct client access — all backup ops go through API routes
-- (app/api/backup/{create,list,restore,nuke}) which enforce
-- superadmin + password at the application level.
--
-- Apply this BEFORE deploying the backup feature code. Without
-- the bucket, create/list/restore all fail at the storage call.
--
-- Rollback:
--   delete from storage.buckets where id = 'bos-backups';
--   drop policy if exists "Service role only: bos-backups insert" on storage.objects;
--   drop policy if exists "Service role only: bos-backups select" on storage.objects;
--   drop policy if exists "Service role only: bos-backups delete" on storage.objects;
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'bos-backups',
  'bos-backups',
  false,                              -- private bucket
  52428800,                           -- 50MB max per file
  array['application/json']           -- only JSON backup files
)
on conflict (id) do nothing;

-- Safety net: storage policies that only allow service_role.
-- The API routes already gate by superadmin + password; these policies
-- protect against a misconfigured anon client accidentally reaching the
-- bucket. Belt-and-braces.

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'Service role only: bos-backups insert'
  ) then
    create policy "Service role only: bos-backups insert"
      on storage.objects for insert
      with check (bucket_id = 'bos-backups' and auth.role() = 'service_role');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'Service role only: bos-backups select'
  ) then
    create policy "Service role only: bos-backups select"
      on storage.objects for select
      using (bucket_id = 'bos-backups' and auth.role() = 'service_role');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'Service role only: bos-backups delete'
  ) then
    create policy "Service role only: bos-backups delete"
      on storage.objects for delete
      using (bucket_id = 'bos-backups' and auth.role() = 'service_role');
  end if;
end $$;

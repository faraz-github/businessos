-- migration: 021_post_media
-- Adds image support to social posts.
--
-- Two changes:
--   1. `image_paths text[]` column on social_posts — stores storage
--      paths (not URLs). Public URLs are derived at render time from
--      the bucket's public CDN base. Not storing full URLs avoids
--      stale links if the project URL ever changes.
--
--   2. `post-media` Supabase Storage bucket — public-read CDN bucket.
--      Public (not authenticated) so images render without signed URL
--      expiry issues. RLS policies restrict writes to the owning user.
--      Path convention: {ownerId}/{postId}/{nanoid}.webp
--      Size cap: 3 MB raw (compressed target is ~800 KB — see constants.ts)
--
-- ── Rollback ────────────────────────────────────────────────────
-- alter table public.social_posts drop column if exists image_paths;
-- delete from storage.buckets where id = 'post-media';

-- 1. Column
alter table public.social_posts
  add column if not exists image_paths text[] not null default '{}';

-- 2. Bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'post-media',
  'post-media',
  true,                          -- public CDN, no signed URLs needed
  3145728,                       -- 3 MB hard cap (compressed output is ~800 KB)
  array['image/png','image/jpeg','image/webp']
)
on conflict (id) do nothing;

-- 3. Storage RLS — authenticated users can upload to their own prefix;
--    public read is handled by the bucket's `public = true` flag.
create policy "post-media: owner insert"
  on storage.objects for insert
  with check (
    bucket_id = 'post-media'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "post-media: owner update"
  on storage.objects for update
  using (
    bucket_id = 'post-media'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "post-media: owner delete"
  on storage.objects for delete
  using (
    bucket_id = 'post-media'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "post-media: public read"
  on storage.objects for select
  using (bucket_id = 'post-media');

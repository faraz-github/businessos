-- ===================================================================
-- 022_social_posts_posted_at.sql
-- Add `posted_at` column to social_posts to record when a post was
-- actually published, distinct from `planned_date` (the scheduled date).
--
-- Use cases:
--   * Sort published posts by recency-of-publication (chronological feed)
--   * Show "Posted [datetime]" instead of "Planned [date]" once live
--   * Analytics on planned-vs-actual lag
--
-- Backfill: for any post already in 'published' state we copy
-- planned_date into posted_at as a best-effort initial value, so the
-- UI doesn't immediately blank out for existing data. Users can edit
-- it from the post form afterwards.
-- ===================================================================

ALTER TABLE social_posts
  ADD COLUMN IF NOT EXISTS posted_at TIMESTAMPTZ NULL;

-- Backfill existing published posts using their planned_date so the
-- UI shows a sensible value immediately. Leave nulls where there's
-- no planned_date.
UPDATE social_posts
   SET posted_at = (planned_date::timestamptz)
 WHERE status = 'published'
   AND posted_at IS NULL
   AND planned_date IS NOT NULL;

-- Index for queries that sort published posts by publication time
-- (e.g. "show me my last 5 published posts" on the dashboard).
CREATE INDEX IF NOT EXISTS social_posts_posted_at_idx
  ON social_posts (user_id, posted_at DESC NULLS LAST)
  WHERE status = 'published';

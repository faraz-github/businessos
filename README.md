# Business OS v3.5.6

Two new features on top of v3.5.5.1:

1. **Load More across every long list** — Home, Social, Finance, Clients, Lab, Feedback, Support, BD Pipeline. Default page size 20 (or 10 for slower-growing lists). Includes a search/filter-aware reset so the page counter doesn't go stale after filtering.
2. **"Posted Date and Time" on Content Calendar posts** — appears conditionally when status is set to Published; auto-fills to current time on first transition; quick-publish (✓ icon) auto-stamps server-side.

See `RELEASE-NOTES-v3.5.6.md` for full details, file list, design rationale, and verification steps.

## Applying

```
unzip business-os-v3.5.6.zip -d /path/to/business-os/
```

**Important: run the database migration first.**

`supabase/migrations-incremental/022_social_posts_posted_at.sql` adds the `posted_at` column to `social_posts`, backfills existing published posts from `planned_date`, and adds an index for sorting by publication time. It's idempotent (`IF NOT EXISTS` guards).

If you use the Supabase CLI:
```
supabase db push
```

Or paste it into the Supabase SQL editor and run.

After the migration is applied, the new code reads/writes `posted_at` automatically. Existing posts will show a sensible "Posted" date thanks to the backfill.

## Total scope

32 files (3 new, 29 modified). Includes all carry-over content from v3.5.4, v3.5.5, and v3.5.5.1, so this is a self-contained drop-in replacement on any v3.5.x base.

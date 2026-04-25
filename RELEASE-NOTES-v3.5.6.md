# Business OS v3.5.6 — Release Notes

**Release date:** April 2026
**Base version:** v3.5.3
**Supersedes:** v3.5.5.1
**Scope:** Two product additions — "Load More" pagination across every long-list view in the dashboard, and a new "Posted Date and Time" field on Content Calendar posts that appears conditionally when the status is set to Published.

This bundle is the **complete delta from v3.5.3**. It works whether you're applying it on top of v3.5.3, v3.5.4, v3.5.5, or v3.5.5.1.

---

## Part A — Load More across all long lists

### The problem

On `/dashboard/personal/home`, "Needs Attention" rendered every overdue invoice, ending support period, and expiring document — sometimes 30+ items — forcing users to scroll past the entire list to reach Business Health below. Same anti-pattern across most dashboard surfaces: full lists rendered eagerly with no progressive disclosure.

### The fix

Every long list in the dashboard now uses the same Load More pattern that was already established in Paperwork:

| Page | List | Page size |
|---|---|---|
| `personal/home`, `agency/home` | Needs Attention | 20 |
| `personal/home`, `agency/home` | Recent Logs | 20 |
| `personal/social`, `agency/social` | Scheduled & Published posts | 20 |
| `personal/social`, `agency/social` | Ideas Parking Lot | 10 |
| `personal/social` | LinkedIn pipeline (per stage) | 20 each |
| `personal/social` | Converted leads | 10 |
| `personal/finance` | Transactions | 20 |
| `personal/finance` | Invoices | 20 |
| `personal/finance` | Subscriptions | 20 |
| `personal/clients` | Active clients | 20 |
| `personal/clients` | Past clients | 10 |
| `personal/lab` | Projects (sorted by status) | 20 |
| `personal/lab` | Tools | 20 |
| `personal/lab` | Skills | 20 |
| `personal/feedback` | Testimonials | 20 |
| `personal/feedback` | Eligible clients | 10 |
| `personal/support` | Active periods | 20 |
| `personal/support` | Ended periods | 10 |
| `agency/bd-pipeline` | Contacts | 20 |
| `agency/bd-pipeline` | Deals | 20 |
| `agency/bd-pipeline` | Won (Closed tab) | 10 |
| `agency/bd-pipeline` | Lost (Closed tab) | 10 |

### Smarter UX for grouped lists

Lists with natural sub-groups (Lab projects by status, Finance transactions by month) **paginate the flat ordered list**, then re-group the paginated slice for display. This means:

- One Load More button at the bottom of the tab, not one per group
- The user walks down through items in a consistent priority order (active → idea → paused → shipped → archived for projects; recent → older for transactions)
- Status-grouped headers still show, so the visual structure is unchanged from before

### New shared component

`components/ui/LoadMore.tsx` — a tiny `useLoadMore` hook plus a `<LoadMore>` button that renders nothing if the source is empty. The hook auto-resets to page 0 when the source array reference changes, which fixes a latent bug where applying a search filter in Paperwork could leave the page counter on a stale offset.

API:
```tsx
const { paginated, hasMore, loadMore, shown, total } = useLoadMore(items, { pageSize: 20 });
{paginated.map(item => …)}
<LoadMore hasMore={hasMore} onLoadMore={loadMore} shown={shown} total={total} />
```

For grouped lists with their own per-group state (LinkedIn pipeline stages), an extracted `<StageColumn>` sub-component owns its own `useLoadMore` so each stage paginates independently.

---

## Part B — "Posted Date and Time" on Content Calendar posts

### What changed

A new `posted_at` field on social posts records when a post **actually went live**, distinct from `planned_date` (when it was *intended* to go live).

### How it shows up in the UI

- **In the New/Edit Post modal**: a `Posted Date and Time` field appears **only when the status dropdown is set to "Published"**. The first time the user selects Published, the field auto-fills with the current local date+time so they don't have to type it manually. They can edit it before saving.
- **On the post row in the calendar**: when `posted_at` is set, the row shows `Posted [datetime]` instead of `Planned [date]`. Falls back to the planned date if `posted_at` is empty.
- **From the quick action**: clicking the inline ✓ Publish button on a post row now auto-stamps `posted_at` with the current time on the server side (only if it isn't already set — won't clobber a manually-edited value).

### Schema migration

`supabase/migrations-incremental/022_social_posts_posted_at.sql`:

- Adds `posted_at TIMESTAMPTZ NULL` column
- Backfills existing published posts: `posted_at = planned_date` so existing data shows a sensible value immediately on first render
- Indexes `(user_id, posted_at DESC NULLS LAST) WHERE status = 'published'` for any future "show me my last 5 published posts" queries

### Type + server action updates

- `types/index.ts` — `SocialPost.posted_at: string | null`
- `types/database.ts` — Row, Insert, Update all carry `posted_at`
- `types/schemas.ts` — zod schema includes `posted_at`
- `app/dashboard/actions/social.ts`:
  - `socialPostUpdateSchema` accepts `posted_at`
  - `updateSocialPostStatus` reads existing `posted_at` first; only stamps a new value when transitioning to Published *and* the field was previously null
- AddPostForm in both `personal/social/page.tsx` and `agency/social/page.tsx` — converts datetime-local ↔ ISO with timezone-safe local formatting; `handleStatusChange` triggers the auto-fill on first transition

---

## Files changed

**Total: 32 files** (3 new, 29 modified)

### New files in v3.5.6
- `components/ui/LoadMore.tsx` — pagination hook + button
- `supabase/migrations-incremental/022_social_posts_posted_at.sql` — schema migration

### Carried forward (new in v3.5.4 / v3.5.5)
- `components/dashboard/MobileNavContext.tsx`
- `components/ui/OverflowMenu.tsx`

### New code touched in v3.5.6
- `app/dashboard/actions/social.ts` — `posted_at` in update schema + auto-stamp on quick publish
- `app/dashboard/personal/social/page.tsx` — pagination hooks + `<StageColumn>` extraction + AddPostForm posted_at + row display
- `app/dashboard/agency/social/page.tsx` — pagination hooks + AddPostForm posted_at + row display
- `app/dashboard/personal/home/client.tsx` — pagination
- `app/dashboard/agency/home/client.tsx` — pagination
- `app/dashboard/personal/finance/page.tsx` — pagination + smarter group-then-paginate for transactions
- `app/dashboard/personal/clients/page.tsx` — pagination
- `app/dashboard/personal/feedback/page.tsx` — pagination
- `app/dashboard/personal/support/page.tsx` — pagination
- `app/dashboard/personal/lab/page.tsx` — pagination + ordered-then-grouped display
- `app/dashboard/agency/bd-pipeline/page.tsx` — pagination
- `components/ui/index.ts` — export LoadMore
- `types/index.ts`, `types/database.ts`, `types/schemas.ts` — posted_at field

### Other v3.5.4 / v3.5.5 / v3.5.5.1 files (unchanged from previous bundles, included for completeness)
- All responsive-shell files
- All dense-row + tabs-scroll changes
- Modal padding fixes
- Settings signature row stacking

---

## Applying this bundle

If you've applied any prior v3.5.x bundle, this is a clean superset — extract over your project root and the older files are byte-identical to what you have. The new files are `LoadMore.tsx` and the migration SQL.

If you're starting from a clean v3.5.3:
```
unzip business-os-v3.5.6.zip -d /path/to/business-os/
```

### Migration step

The `022_social_posts_posted_at.sql` migration must be applied to your Supabase database **before** the new code can write `posted_at` values. Run it through your usual migration flow (Supabase SQL editor, `supabase db push`, or your CI pipeline). The migration is idempotent (`IF NOT EXISTS` guards) and includes a one-time backfill from `planned_date` for posts already in Published state.

If you're using `supabase migration` for incremental migrations:
```
supabase db push
```

If you're applying via the Supabase dashboard, paste the contents of `supabase/migrations-incremental/022_social_posts_posted_at.sql` into the SQL editor and run.

### Verifying it works

1. **Load More**: open any list-heavy page (`/dashboard/personal/home`, `/dashboard/personal/social` Pipeline tab). Add 25+ items via the relevant flows; you should see the first 20 (or 10), then a "Load more (5 remaining)" button + "Showing 20 of 25" footer. Click the button → next batch appears.
2. **Posted at**: open New Post modal in either `/dashboard/personal/social` Content Calendar or `/dashboard/agency/social`. Change Status to "Published" — a "Posted Date and Time" field appears, auto-filled with right-now. Save. The post row should display "Posted [datetime]" instead of "Planned [date]".
3. **Quick publish**: open an unpublished post row in the calendar, click the ✓ Publish icon. The post should switch to Published and the row label should change to "Posted [right now]".

---

## Next: v3.5.7 PWA phase

The dashboard is now fully responsive (v3.5.5), tightened with patches (v3.5.5.1), and ergonomic for long-list users (v3.5.6). The PWA phase remains as planned.

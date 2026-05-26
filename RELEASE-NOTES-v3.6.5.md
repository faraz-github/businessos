# Business OS v3.6.5 — Release Notes

**Release date:** May 2026
**Base version:** v3.6.4
**Scope:** Single bug fix — "Load more" pagination not advancing past the first page.

This is a full drop-in replacement for the v3.6.4 codebase. Only 5 files changed; everything else is byte-identical to v3.6.4.

---

## The bug

On any list using "Load more" (most visibly the Outreach → Content Calendar once a month crossed 20+ posts), clicking "Load more" did nothing — the list stayed at "Showing 20 of N" no matter how many times you clicked.

### Root cause

The `useLoadMore` hook reset its page counter on every render where the source array changed reference:

```js
useEffect(() => { setPage(0); }, [items, ...resetOn]);   // ← the bug
```

Clicking "Load more" calls `setPage(p => p + 1)`, which triggers a re-render. On that re-render the source list (e.g. `scheduledPosts = useMemo(() => posts.filter(...), [posts, contentTimeRange])`) could arrive as a fresh array reference — which made the effect fire and immediately snap `page` back to 0. The slice never grew.

This is fragile by design: resetting on array *identity* breaks whenever any upstream state change (a `posted_at` write, a status toggle, a parent re-render) hands the hook a new-but-equivalent array.

## The fix

`components/ui/LoadMore.tsx` — the hook no longer resets on array reference. Instead:

1. **Reset only on explicit filter signals.** Callers pass `resetOn: [filterValue, ...]`; the hook serializes it with `JSON.stringify` so the reset effect fires only on an actual value change, never on a new-array-each-render identity.
2. **Clamp instead of reset when data shrinks.** If items are deleted and the current page would show an empty tail, the page is clamped to a valid maximum (length-based, never reference-based), so deletions don't blow away the user's scroll position and never fire spuriously.

The hook's public API is unchanged — `paginated`, `hasMore`, `loadMore`, `reset`, `total`, `shown`. No caller signature changed except adding `resetOn` where interactive filters exist (below).

### Callers updated with `resetOn`

The hook previously got its filter-reset behavior "for free" from the array-reference reset. With that removed, the four surfaces that have **interactive filters** now declare their reset triggers explicitly:

| File | List | resetOn |
|---|---|---|
| `personal/social` | Content Calendar (scheduled) | `[contentTimeRange]` |
| `personal/feedback` | Testimonials | `[filterMode]` |
| `personal/finance` | Transactions | `[txFilter, txSearch]` |
| `personal/finance` | Invoices | `[invFilter]` |
| `agency/bd-pipeline` | Contacts + Deals | `[search, stageFilter, sortKey, sortDir]` |

All other paginated lists (home attention/logs, ideas, converted leads, clients, lab, support, won/lost) derive from fixed criteria and don't need a reset trigger — the clamp handles data changes gracefully.

---

## Behavior after the fix

- **Load more accumulates correctly** even when the underlying array gets a fresh reference on re-render (verified by simulation: 22-item list, click reveals all 22, survives subsequent spurious re-renders).
- **Changing a filter resets to page 0** (e.g. switching the Content Calendar from May to April shows April's first page, not a stale offset).
- **Deleting items clamps** rather than jumping the user back to the top.

---

## Files changed

5 files (0 new, 5 modified):

- `components/ui/LoadMore.tsx` — the hook rewrite
- `app/dashboard/personal/social/page.tsx` — `resetOn: [contentTimeRange]` on scheduled posts
- `app/dashboard/personal/feedback/page.tsx` — `resetOn: [filterMode]`
- `app/dashboard/personal/finance/page.tsx` — `resetOn` on tx + invoice pagination
- `app/dashboard/agency/bd-pipeline/page.tsx` — `resetOn` on contacts + deals

No schema changes, no new dependencies, no config changes. Nothing outside these 5 files was touched.

---

## Applying

Extract over your project root (full project included, so it's a clean replacement):

```
unzip business-os-v3.6.5.zip -d /path/to/business-os/
```

Redeploy. No migration needed.

### Verifying

1. Go to Outreach → Content Calendar in a month with 20+ posts.
2. You should see the first 20 and a "Load more (N remaining)" button.
3. Click it → the remaining posts appear, footer updates to "Showing N of N", button disappears.
4. Switch the time range → list resets to the first page of the new range.

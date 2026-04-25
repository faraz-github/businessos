'use client';
// ============================================================
// Pagination — useLoadMore + LoadMore button
//
// Shared "Load More" pattern used across every long-list view in
// the dashboard. Keeps the visible slice in component state and
// auto-resets to page 0 when the source list reference changes
// (which is what we want when a search/filter narrows the input,
// otherwise the page counter would be stale and clamp to a tiny
// or empty slice).
//
// Usage:
//   const { paginated, hasMore, loadMore, total } = useLoadMore(
//     filteredItems,
//     { pageSize: 20 }
//   );
//   {paginated.map(item => …)}
//   <LoadMore hasMore={hasMore} onLoadMore={loadMore}
//             shown={paginated.length} total={total} />
// ============================================================

import { useState, useEffect, useMemo } from 'react';

export interface UseLoadMoreOptions {
  /** Initial page size + the increment per "Load More" tap. Default 20. */
  pageSize?: number;
  /** Optional dependency list. When any value changes, reset to page 0.
   *  Use this for search strings, filter selections, etc. that don't
   *  change the array reference but do narrow what should be shown. */
  resetOn?: unknown[];
}

export function useLoadMore<T>(items: T[], opts: UseLoadMoreOptions = {}) {
  const { pageSize = 20, resetOn = [] } = opts;
  const [page, setPage] = useState(0);

  // Reset to page 0 when:
  //   a) the source array reference changes (filter narrows the data)
  //   b) any item in `resetOn` changes (search string, type filter, etc.)
  // Without this, applying a search would slice into a stale offset.
  // We use a single concatenated dep list so consumers don't have to
  // think about deps — pass everything that affects filtering.
  useEffect(() => {
    setPage(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, ...resetOn]);

  const visible = (page + 1) * pageSize;
  const paginated = useMemo(() => items.slice(0, visible), [items, visible]);
  const hasMore   = items.length > paginated.length;

  return {
    paginated,
    hasMore,
    loadMore: () => setPage(p => p + 1),
    /** Reset back to first page. Useful for "collapse to top" controls. */
    reset: () => setPage(0),
    total: items.length,
    shown: paginated.length,
  };
}

// ─── BUTTON ──────────────────────────────────────────────────

interface LoadMoreProps {
  hasMore: boolean;
  onLoadMore: () => void;
  shown: number;
  total: number;
  /** Optional label override. Default: "Load more". */
  label?: string;
  /** Hide the "Showing X of Y" footer when nothing to show. Default true. */
  showFooter?: boolean;
  /** Hide the entire control when there's nothing in the list. Default true. */
  hideWhenEmpty?: boolean;
}

export function LoadMore({
  hasMore,
  onLoadMore,
  shown,
  total,
  label = 'Load more',
  showFooter = true,
  hideWhenEmpty = true,
}: LoadMoreProps) {
  if (hideWhenEmpty && total === 0) return null;
  if (!hasMore && !showFooter) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
      {hasMore && (
        <button
          onClick={onLoadMore}
          type="button"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '10px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-default)',
            background: 'transparent',
            color: 'var(--text-secondary)',
            fontSize: 12,
            fontFamily: 'var(--font-body)',
            cursor: 'pointer',
            transition: 'all 150ms',
            width: '100%',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-strong)';
            (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)';
            (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
          }}
        >
          {label} ({total - shown} remaining)
        </button>
      )}
      {showFooter && total > 0 && (
        <p
          className="t-2xs text-tertiary"
          style={{ textAlign: 'center', margin: 0 }}
        >
          Showing {shown} of {total}
        </p>
      )}
    </div>
  );
}

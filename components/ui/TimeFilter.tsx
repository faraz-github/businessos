'use client';
// components/ui/TimeFilter.tsx
//
// Time granularity filter: All Time → Yearly → Monthly → Today
//
// Renders a pill-style granularity selector and, where applicable,
// a ← label → navigator for moving between periods.
//
// State lives in URL search params (?granularity=monthly&date=2025-05)
// so it's bookmarkable and survives page refreshes.
//
// Props:
//   allowFuture   — allow navigating to future months/years (Social calendar
//                   needs this; Finance does not). Default: false.
//   defaultGran   — granularity to use when no param is present. Default: 'monthly'.
//   paramPrefix   — optional prefix for param names, for pages that host
//                   multiple independent time filters. Default: '' → uses
//                   'granularity' and 'date' directly.
// ─────────────────────────────────────────────────────────────────────────

import { useCallback } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { TimeGranularity } from '@/lib/utils/time-range';
import {
  currentDateKey,
  prevDateKey,
  nextDateKey,
  dateKeyLabel,
  isFutureMonth,
  isFutureYear,
} from '@/lib/utils/time-range';

// ── Props ─────────────────────────────────────────────────────────────────

export interface TimeFilterProps {
  /** Allow navigating forward into future months/years. Default false. */
  allowFuture?: boolean;
  /** Which granularity is active when no URL param is present. Default 'monthly'. */
  defaultGranularity?: TimeGranularity;
  /**
   * Optional prefix for param names.
   * '' (default) → params are 'granularity' and 'date'
   * 'tx'         → params are 'tx_granularity' and 'tx_date'
   */
  paramPrefix?: string;
  /** Which granularity levels to show. Default: all four. */
  levels?: TimeGranularity[];
}

// ── Helpers ───────────────────────────────────────────────────────────────

const LEVEL_LABELS: Record<TimeGranularity, string> = {
  all:     'All Time',
  yearly:  'Yearly',
  monthly: 'Monthly',
  today:   'Today',
};

const DEFAULT_LEVELS: TimeGranularity[] = ['all', 'yearly', 'monthly', 'today'];

// ── Component ─────────────────────────────────────────────────────────────

export function TimeFilter({
  allowFuture    = false,
  defaultGranularity = 'monthly',
  paramPrefix    = '',
  levels         = DEFAULT_LEVELS,
}: TimeFilterProps) {
  const router      = useRouter();
  const pathname    = usePathname();
  const searchParams = useSearchParams();

  const gParam = paramPrefix ? `${paramPrefix}_granularity` : 'granularity';
  const dParam = paramPrefix ? `${paramPrefix}_date`        : 'date';

  const activeGran = (searchParams.get(gParam) ?? defaultGranularity) as TimeGranularity;
  const activeDateKey = searchParams.get(dParam) ?? currentDateKey(activeGran);

  // Merge new params into the existing query string without clobbering
  // other params (type filter, status filter, etc. that may co-exist).
  const navigate = useCallback(
    (gran: TimeGranularity, dateKey: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set(gParam, gran);
      if (dateKey) {
        params.set(dParam, dateKey);
      } else {
        params.delete(dParam);
      }
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams, gParam, dParam],
  );

  function handleGranChange(gran: TimeGranularity) {
    const dateKey = gran === 'all' || gran === 'today' ? '' : currentDateKey(gran);
    navigate(gran, dateKey);
  }

  function handlePrev() {
    if (activeGran !== 'yearly' && activeGran !== 'monthly') return;
    navigate(activeGran, prevDateKey(activeGran, activeDateKey));
  }

  function handleNext() {
    if (activeGran !== 'yearly' && activeGran !== 'monthly') return;
    const nextKey = nextDateKey(activeGran, activeDateKey);
    // Block future navigation unless explicitly allowed
    if (!allowFuture) {
      if (activeGran === 'monthly' && isFutureMonth(nextKey)) return;
      if (activeGran === 'yearly'  && isFutureYear(nextKey))  return;
    }
    navigate(activeGran, nextKey);
  }

  const hasNavigator = activeGran === 'monthly' || activeGran === 'yearly';

  const isNextDisabled =
    !allowFuture && (
      (activeGran === 'monthly' && isFutureMonth(nextDateKey('monthly', activeDateKey))) ||
      (activeGran === 'yearly'  && isFutureYear(nextDateKey('yearly',  activeDateKey)))
    );

  return (
    <div className="time-filter" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>

      {/* Granularity pill selector */}
      <div
        className="tabs-scroll"
        style={{
          display:      'flex',
          background:   'var(--bg-hover)',
          padding:      3,
          borderRadius: 'var(--radius-md)',
          gap:          2,
          flexShrink:   0,
        }}
      >
        {levels.map(level => (
          <button
            key={level}
            onClick={() => handleGranChange(level)}
            style={{
              padding:      '5px 11px',
              borderRadius: 'calc(var(--radius-md) - 3px)',
              border:       'none',
              background:   activeGran === level ? 'var(--bg-surface)' : 'transparent',
              color:        activeGran === level ? 'var(--text-primary)' : 'var(--text-tertiary)',
              fontSize:     11,
              fontFamily:   'var(--font-body)',
              fontWeight:   activeGran === level ? 500 : 400,
              cursor:       'pointer',
              boxShadow:    activeGran === level ? 'var(--shadow-card)' : 'none',
              transition:   'all 150ms',
              whiteSpace:   'nowrap',
            }}
          >
            {LEVEL_LABELS[level]}
          </button>
        ))}
      </div>

      {/* Period navigator — only shown for yearly / monthly */}
      {hasNavigator && (
        <div
          style={{
            display:      'flex',
            alignItems:   'center',
            gap:          2,
            background:   'var(--bg-hover)',
            borderRadius: 'var(--radius-md)',
            padding:      '2px 3px',
            flexShrink:   0,
          }}
        >
          <button
            onClick={handlePrev}
            aria-label="Previous period"
            style={{
              display:      'flex',
              alignItems:   'center',
              justifyContent: 'center',
              width:        26,
              height:       26,
              borderRadius: 'calc(var(--radius-md) - 4px)',
              border:       'none',
              background:   'transparent',
              color:        'var(--text-tertiary)',
              cursor:       'pointer',
              transition:   'color 150ms, background 150ms',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = 'var(--bg-surface)';
              (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = 'transparent';
              (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)';
            }}
          >
            <ChevronLeft size={13} />
          </button>

          <span
            style={{
              fontSize:   12,
              fontFamily: 'var(--font-body)',
              fontWeight: 500,
              color:      'var(--text-primary)',
              minWidth:   activeGran === 'monthly' ? 76 : 36,
              textAlign:  'center',
              padding:    '0 4px',
              whiteSpace: 'nowrap',
            }}
          >
            {dateKeyLabel(activeGran, activeDateKey)}
          </span>

          <button
            onClick={handleNext}
            disabled={isNextDisabled}
            aria-label="Next period"
            style={{
              display:      'flex',
              alignItems:   'center',
              justifyContent: 'center',
              width:        26,
              height:       26,
              borderRadius: 'calc(var(--radius-md) - 4px)',
              border:       'none',
              background:   'transparent',
              color:        isNextDisabled ? 'var(--text-tertiary)' : 'var(--text-tertiary)',
              cursor:       isNextDisabled ? 'default' : 'pointer',
              opacity:      isNextDisabled ? 0.35 : 1,
              transition:   'color 150ms, background 150ms, opacity 150ms',
            }}
            onMouseEnter={e => {
              if (isNextDisabled) return;
              (e.currentTarget as HTMLElement).style.background = 'var(--bg-surface)';
              (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = 'transparent';
              (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)';
            }}
          >
            <ChevronRight size={13} />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Hook: read active range from URL params ───────────────────────────────
//
// Usage in a page component:
//   const range = useTimeRange();
//   const filtered = items.filter(item => inTimeRange(item.date, range));
//
// Must be used inside a component tree wrapped in <Suspense> because it
// calls useSearchParams().

import { parseTimeRange } from '@/lib/utils/time-range';
import type { TimeRange } from '@/lib/utils/time-range';

export function useTimeRange(
  defaultGranularity: TimeGranularity = 'monthly',
  paramPrefix = '',
): TimeRange {
  const searchParams = useSearchParams();
  const gParam = paramPrefix ? `${paramPrefix}_granularity` : 'granularity';
  const dParam = paramPrefix ? `${paramPrefix}_date`        : 'date';

  const gran    = (searchParams.get(gParam) ?? defaultGranularity) as TimeGranularity;
  const dateKey = searchParams.get(dParam) ?? currentDateKey(gran);

  return parseTimeRange(gran, dateKey);
}

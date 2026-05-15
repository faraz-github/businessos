// lib/utils/time-range.ts
//
// Time range utilities for the TimeFilter component.
//
// All "today / month / year" boundaries are computed in IST (Asia/Kolkata)
// because the app stores UTC but displays IST — a naive UTC midnight for
// "today" would be wrong by 5h30m for this user.
//
// Pure functions only. No React, no side-effects.
// ─────────────────────────────────────────────────────────────────────────

import { toZonedTime } from 'date-fns-tz';

const IST = 'Asia/Kolkata';

// ── Types ────────────────────────────────────────────────────────────────

export type TimeGranularity = 'all' | 'yearly' | 'monthly' | 'today';

/**
 * Parsed state from a TimeFilter URL param pair.
 * `{ from, to }` — both are ISO date strings (YYYY-MM-DD), inclusive.
 * `null` means "no filter — show all time".
 */
export type TimeRange = { from: string; to: string } | null;

// ── Helpers ──────────────────────────────────────────────────────────────

/** Returns the current date in IST as a plain { year, month, day } object. */
function nowIST(): { year: number; month: number; day: number } {
  const d = toZonedTime(new Date(), IST);
  return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() };
}

/** Zero-pads a number to 2 digits. */
function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Formats a { year, month, day } into YYYY-MM-DD. month is 0-indexed. */
function toISO(year: number, month: number, day: number): string {
  return `${year}-${pad2(month + 1)}-${pad2(day)}`;
}

/** Last day of a given month (0-indexed month). */
function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

// ── Core: granularity + dateKey → TimeRange ───────────────────────────────

/**
 * Convert a granularity + dateKey string into a { from, to } range.
 *
 * dateKey formats:
 *   yearly  → "2025"
 *   monthly → "2025-05"
 *   today   → "2025-05-05"  (or any truthy string — we always use today IST)
 *   all     → anything / undefined
 */
export function parseTimeRange(
  granularity: TimeGranularity | string | undefined,
  dateKey: string | undefined,
): TimeRange {
  const g = (granularity ?? 'all') as TimeGranularity;

  if (g === 'all' || !g) return null;

  const ist = nowIST();

  if (g === 'today') {
    const today = toISO(ist.year, ist.month, ist.day);
    return { from: today, to: today };
  }

  if (g === 'yearly') {
    const year = dateKey ? parseInt(dateKey, 10) : ist.year;
    if (isNaN(year)) return null;
    return {
      from: `${year}-01-01`,
      to:   `${year}-12-31`,
    };
  }

  if (g === 'monthly') {
    // dateKey: "YYYY-MM"
    let year  = ist.year;
    let month = ist.month; // 0-indexed
    if (dateKey && /^\d{4}-\d{2}$/.test(dateKey)) {
      const [y, m] = dateKey.split('-').map(Number);
      year  = y;
      month = m - 1; // convert to 0-indexed
    }
    return {
      from: toISO(year, month, 1),
      to:   toISO(year, month, lastDayOfMonth(year, month)),
    };
  }

  return null;
}

// ── Navigation helpers ────────────────────────────────────────────────────

/** Returns the dateKey for the current period at the given granularity. */
export function currentDateKey(granularity: TimeGranularity): string {
  const ist = nowIST();
  if (granularity === 'yearly')  return String(ist.year);
  if (granularity === 'monthly') return `${ist.year}-${pad2(ist.month + 1)}`;
  if (granularity === 'today')   return toISO(ist.year, ist.month, ist.day);
  return '';
}

/** Returns the previous dateKey for yearly/monthly navigation. */
export function prevDateKey(granularity: 'yearly' | 'monthly', dateKey: string): string {
  if (granularity === 'yearly') {
    return String(parseInt(dateKey, 10) - 1);
  }
  // monthly: "YYYY-MM"
  const [y, m] = dateKey.split('-').map(Number);
  const d = new Date(y, m - 1 - 1, 1); // m-1 converts to 0-idx, then -1 for prev
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

/** Returns the next dateKey for yearly/monthly navigation. */
export function nextDateKey(granularity: 'yearly' | 'monthly', dateKey: string): string {
  if (granularity === 'yearly') {
    return String(parseInt(dateKey, 10) + 1);
  }
  const [y, m] = dateKey.split('-').map(Number);
  const d = new Date(y, m - 1 + 1, 1); // +1 for next month
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

// ── Display label ─────────────────────────────────────────────────────────

/** Human-readable label for the current navigator position. */
export function dateKeyLabel(granularity: TimeGranularity, dateKey: string): string {
  if (granularity === 'today')   return 'Today';
  if (granularity === 'all')     return 'All Time';
  if (granularity === 'yearly')  return dateKey; // "2025"
  if (granularity === 'monthly') {
    const [y, m] = dateKey.split('-').map(Number);
    const d = new Date(y, m - 1, 1);
    return d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
  }
  return dateKey;
}

// ── Filter predicate ──────────────────────────────────────────────────────

/**
 * Returns true if a date string (YYYY-MM-DD or ISO timestamp) falls
 * within the given TimeRange. Always returns true when range is null.
 *
 * Usage:
 *   const filtered = items.filter(item => inTimeRange(item.date, range));
 */
export function inTimeRange(dateStr: string | null | undefined, range: TimeRange): boolean {
  if (!range) return true;
  if (!dateStr) return false;
  // Normalise to YYYY-MM-DD for string comparison (works because ISO dates
  // sort lexicographically the same as chronologically).
  const d = dateStr.slice(0, 10);
  return d >= range.from && d <= range.to;
}

// ── "Is future" guard ─────────────────────────────────────────────────────

/**
 * Returns true if a monthly dateKey ("YYYY-MM") is in the future
 * relative to the current IST month.
 */
export function isFutureMonth(dateKey: string): boolean {
  const ist = nowIST();
  const current = `${ist.year}-${pad2(ist.month + 1)}`;
  return dateKey > current;
}

/**
 * Returns true if a yearly dateKey ("YYYY") is in the future
 * relative to the current IST year.
 */
export function isFutureYear(dateKey: string): boolean {
  const ist = nowIST();
  return parseInt(dateKey, 10) > ist.year;
}

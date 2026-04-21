import { format, formatDistanceToNow, isAfter, isBefore, addDays, differenceInDays } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { clsx, type ClassValue } from 'clsx';
import type { BillingCycle } from '@/types';

// ─── CLASSNAMES ───
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

// ─── TIMEZONE ───
const IST = 'Asia/Kolkata';

export function toIST(date: Date | string): Date {
  return toZonedTime(new Date(date), IST);
}

export function fromIST(date: Date): Date {
  return fromZonedTime(date, IST);
}

// ─── DATE FORMATTING ───
export function formatDate(date: Date | string, fmt: string = 'dd MMM yyyy'): string {
  return format(toIST(date), fmt);
}

export function formatDateTime(date: Date | string): string {
  return format(toIST(date), 'dd MMM yyyy, hh:mm a');
}

export function formatRelative(date: Date | string): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

export function formatTime(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const h = hours % 12 || 12;
  return `${h}:${String(minutes).padStart(2, '0')} ${period}`;
}

export function isOverdue(dateStr: string): boolean {
  return isBefore(new Date(dateStr), new Date());
}

export function isDueSoon(dateStr: string, days: number = 7): boolean {
  const target = new Date(dateStr);
  const now = new Date();
  return isAfter(target, now) && isBefore(target, addDays(now, days));
}

export function daysUntil(dateStr: string): number {
  return differenceInDays(new Date(dateStr), new Date());
}

export function daysAgo(dateStr: string): number {
  return differenceInDays(new Date(), new Date(dateStr));
}

// ─── CURRENCY ───
const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const inrFormatterDecimal = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatINR(amount: number, decimals: boolean = false): string {
  return decimals ? inrFormatterDecimal.format(amount) : inrFormatter.format(amount);
}

export function formatCompactINR(amount: number): string {
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(1)}Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}K`;
  return `₹${amount}`;
}

// ─── GST ───
export function calculateGST(amount: number, rate: number = 18): { gst: number; total: number } {
  const gst = Math.round((amount * rate) / 100);
  return { gst, total: amount + gst };
}

// ─── SUBSCRIPTIONS ───
/**
 * Normalise a subscription cost to its monthly equivalent.
 *
 * Using a Record<BillingCycle, number> means adding a new cycle to the
 * BillingCycle type fails to compile here until the divisor is filled
 * in — catching the "new cycle, forgot to update burn math" bug at
 * build time instead of as silently-wrong dashboards.
 *
 * Used wherever the finance page renders a "monthly burn" stat: if that
 * list grows, centralising here means the rule is defined once.
 */
export function monthlyEquivalent(cost: number, cycle: BillingCycle): number {
  const divisor: Record<BillingCycle, number> = {
    monthly:     1,
    quarterly:   3,
    semi_annual: 6,
    annual:      12,
  };
  return cost / divisor[cycle];
}

// ─── STRING HELPERS ───
export function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function truncate(text: string, length: number): string {
  if (text.length <= length) return text;
  return text.slice(0, length).trim() + '…';
}

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function stageLabel(stage: string): string {
  return stage
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// ─── INVOICE NUMBER ───
export function generateInvoiceNumber(mode: 'personal' | 'agency', count: number): string {
  const prefix = mode === 'personal' ? 'INV' : 'AGN';
  const year = new Date().getFullYear().toString().slice(-2);
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  const num = String(count + 1).padStart(4, '0');
  return `${prefix}-${year}${month}-${num}`;
}

// ─── DEEP LINK BUILDERS ───
export function buildMailtoLink(email: string, subject: string, body: string): string {
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function buildWhatsAppLink(phone: string, message: string): string {
  const cleanPhone = phone.replace(/[^0-9+]/g, '');
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}

// ─── NOTE ───
// The previous versions of this file exported `generateShareToken()` and
// `generateAccessCode()` helpers. Both were dead code (no imports) and
// both violated the project's "no eslint-disable, no require()" contract.
// The live versions live next to the only call sites that need them:
//   - app/dashboard/actions/documents.ts::generateShareToken()
//   - app/dashboard/actions/documents.ts::generateAccessCode()
// If a future caller needs either, lift it back out into this file
// cleanly (no eslint-disable, using globalThis.crypto.getRandomValues).

'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useBrand } from '@/lib/brand';
import { useCurrentUser } from '@/lib/auth/use-auth';
import { createClient } from '@/lib/supabase/client';
import { PageTransition } from '@/components/dashboard/PageTransition';
import { Button, Modal, Input, Select, OverflowMenu, LoadMore, useLoadMore, TimeFilter, useTimeRange } from '@/components/ui';
import { toast } from '@/components/ui/Toast';
import { RevenueChart } from '@/components/charts/RevenueChart';
import { formatINR, formatDate, isDueSoon, monthlyEquivalent } from '@/lib/utils';
import { inTimeRange } from '@/lib/utils/time-range';
import {
  Plus, IndianRupee, TrendingUp, TrendingDown, RotateCw, RotateCcw,
  CheckCircle2, Trash2, Pause, Play, Receipt, CreditCard,
  Search, ExternalLink, Pencil, AlertTriangle,
} from 'lucide-react';
import type { Transaction, Subscription, BillingCycle, DocumentStatus } from '@/types';
import {
  createSubscription,
  updateSubscription,
  toggleSubscriptionStatus,
  markSubscriptionReviewed,
  deleteSubscription,
} from '@/app/dashboard/actions/subscriptions';
import {
  createTransaction,
  deleteTransaction,
  deleteInvoiceDocument,
  markInvoicePaidAction,
  createPaidInvoiceAction,
  undoMarkInvoicePaidAction,
} from '@/app/dashboard/actions/transactions';

/* ── constants ─────────────────────────────────────────────── */
const INCOME_CATS = [
  { value: 'project_payment', label: 'Project Payment' },
  { value: 'initial_payment', label: 'Initial Payment' },
  { value: 'final_payment',   label: 'Final Payment' },
  { value: 'retainer',        label: 'Retainer' },
  { value: 'other_income',    label: 'Other' },
];
const EXPENSE_CATS = [
  { value: 'tools_and_subscriptions', label: 'Tools & Subscriptions' },
  { value: 'contractor',              label: 'Contractor' },
  { value: 'marketing',               label: 'Marketing' },
  { value: 'miscellaneous',           label: 'Miscellaneous' },
];
const SUB_CATS = [
  { value: 'tools',     label: 'Tools & Software' },
  { value: 'hosting',   label: 'Hosting' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'services',  label: 'Services' },
  { value: 'other',     label: 'Other' },
];
// Billing cycle dropdown options — defined once so the Add and Edit
// modals can't drift. Ordering is shortest → longest.
const BILLING_CYCLE_OPTIONS: { value: BillingCycle; label: string }[] = [
  { value: 'monthly',     label: 'Monthly' },
  { value: 'quarterly',   label: 'Quarterly (every 3 months)' },
  { value: 'semi_annual', label: 'Semi-annual (every 6 months)' },
  { value: 'annual',      label: 'Annual' },
];
const INVOICE_STATUS: Record<string, { label: string; color: string }> = {
  draft:   { label: 'Draft',   color: 'var(--text-tertiary)' },
  sent:    { label: 'Sent',    color: 'var(--accent-blue)' },
  viewed:  { label: 'Viewed',  color: 'var(--accent-violet)' },
  overdue: { label: 'Overdue', color: 'var(--accent-red)' },
  paid:    { label: 'Paid',    color: 'var(--accent-green)' },
};

/**
 * Normalised invoice row shape used by the finance page. Derived from
 * the `documents` table (type='invoice') — the invoice fields lift out
 * of the JSON blob and sit at the top level for easier rendering.
 */
interface InvoiceListRow {
  id:          string;
  number:      string;
  total:       number;
  due_date:    string;
  paid_date:   string | null;
  paid_at:     string | null;
  /**
   * The computed-at-read-time status. May differ from the DB row's
   * status column for overdue detection: we derive "overdue" locally
   * from due_date < today rather than trusting the physical column
   * (which can drift — the previous writeback was only triggered from
   * this page, so anyone who didn't visit Finance had stale statuses).
   */
  status:      DocumentStatus;
  share_token: string | null;
  clients:     { name: string } | null;
  client_id:   string | null;
  fields:      Record<string, unknown>;
  _source:     'document';
}

function catLabel(cat: string) {
  return cat.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/** Human-readable cycle label. "Quarterly", "Semi-annual", etc. */
function formatCycleLabel(cycle: BillingCycle): string {
  const labels: Record<BillingCycle, string> = {
    monthly:     'Monthly',
    quarterly:   'Quarterly',
    semi_annual: 'Semi-annual',
    annual:      'Annual',
  };
  return labels[cycle];
}

/** Short suffix used in "/mo", "/qtr", "/6mo", "/yr" price displays. */
function formatCycleSuffix(cycle: BillingCycle): string {
  const suffixes: Record<BillingCycle, string> = {
    monthly:     'mo',
    quarterly:   'qtr',
    semi_annual: '6mo',
    annual:      'yr',
  };
  return suffixes[cycle];
}

function StatusPill({ status, color }: { status: string; color: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 100, fontSize: 11, fontWeight: 500, background: `${color}1A`, color, flexShrink: 0 }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', flexShrink: 0 }} />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
      <p className="t-label">{title}</p>
      {action}
    </div>
  );
}

/* ── MAIN PAGE ─────────────────────────────────────────────── */
export default function PersonalFinancePage() {
  const { mode } = useBrand();
  const { user: currentUser } = useCurrentUser();
  const supabaseRef = useRef(createClient());
  const supabase    = supabaseRef.current;

  const [activeTab, setActiveTab] = useState<'overview' | 'invoices' | 'transactions' | 'subscriptions'>('overview');
  const [invoices, setInvoices]           = useState<InvoiceListRow[]>([]);
  const [transactions, setTransactions]   = useState<Transaction[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading]             = useState(true);
  const [showAddTx, setShowAddTx]         = useState(false);
  const [showAddSub, setShowAddSub]       = useState(false);
  const [editingSub, setEditingSub]       = useState<Subscription | null>(null);
  const [txSearch, setTxSearch]           = useState('');
  const [txFilter, setTxFilter]           = useState<'all' | 'income' | 'expense'>('all');
  const [invFilter, setInvFilter]         = useState<'all' | 'unpaid' | 'overdue' | 'paid'>('all');
  // Step 4: mark-paid modal (asks for paid_date + category before
  // confirming) + log-paid modal (create a backdated already-paid invoice).
  const [markingPaid, setMarkingPaid]     = useState<InvoiceListRow | null>(null);
  const [showLogPaid, setShowLogPaid]     = useState(false);

  const loadData = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    const [invDocs, tx, subs] = await Promise.all([
      // Invoice documents created in Paperwork (type='invoice')
      supabase.from('documents')
        .select('id, title, status, fields, share_token, client_id, created_at, updated_at, clients(name)')
        .eq('user_id', currentUser.ownerId).eq('mode', mode).eq('type', 'invoice')
        .order('created_at', { ascending: false }),
      supabase.from('transactions').select('*').eq('user_id', currentUser.ownerId).eq('mode', mode).order('date', { ascending: false }),
      supabase.from('subscriptions').select('*').eq('user_id', currentUser.ownerId).eq('mode', mode).order('next_renewal_at'),
    ]);
    const today = new Date().toISOString().split('T')[0];

    // Shape row returned by the documents-with-clients join. Inlined
    // rather than hoisted since it's only used in this mapper.
    type InvoiceDocRow = {
      id:          string;
      title:       string | null;
      status:      DocumentStatus;
      fields:      Record<string, unknown> | null;
      share_token: string | null;
      client_id:   string | null;
      clients:     { name: string } | null;
    };

    // Normalise documents into invoice shape. The status we display is
    // DERIVED: compute overdue locally from due_date + paid_date rather
    // than trusting the physical `status` column. Why derived: the
    // overdue state is a function of (due_date, paid_date, today), and
    // every call site that cares about it (home attention feed, home
    // stats RPC, this page) computes it the same way. The physical
    // column is best-effort cache — useful if set, never authoritative.
    const rawInvoices: InvoiceListRow[] = (invDocs.data as InvoiceDocRow[] | null ?? []).map((doc) => {
      const f = doc.fields ?? {};
      const dueDate  = (f.due_date  as string | undefined) ?? '';
      const paidDate = (f.paid_date as string | undefined) ?? null;
      const paidAt   = (f.paid_at   as string | undefined) ?? null;
      let status: DocumentStatus = doc.status;
      if (
        status !== 'paid' && status !== 'signed' &&
        !paidDate &&                 // step 4 belt-and-braces
        dueDate && dueDate < today
      ) {
        status = 'overdue';
      }
      return {
        id:          doc.id,
        number:      (f.invoice_number as string | undefined) ?? doc.title ?? '—',
        total:       Number(f.total ?? 0),
        due_date:    dueDate,
        paid_date:   paidDate,
        paid_at:     paidAt,
        status,
        share_token: doc.share_token,
        clients:     doc.clients,
        client_id:   doc.client_id,
        fields:      f,
        _source:     'document',
      };
    });
    setInvoices(rawInvoices);
    setTransactions((tx.data as Transaction[]) ?? []);
    setSubscriptions((subs.data as Subscription[]) ?? []);
    setLoading(false);

    // Overdue writeback was removed in v3.5 step 3.
    //
    // Previously this page computed overdue locally AND wrote the
    // correction back to documents.status. The writeback caused three
    // problems:
    //   1. Drift — anyone who didn't open this page never triggered
    //      the writeback, so DB state lagged UI state everywhere else.
    //   2. Correctness — every other overdue-detection site in the
    //      codebase (home.ts, the get_home_stats RPC) already derived
    //      overdue from (due_date, paid_date, today) at read time. The
    //      writeback was redundant with those derivations.
    //   3. Locality — it embedded a server-state mutation in a browser
    //      data-load callback, which is the wrong layer.
    //
    // Derivation is now the source of truth. The physical `overdue`
    // status value on documents.status is treated as best-effort cache:
    // honoured when set by the user or a future batch job, overridden
    // by the derivation when the derivation says it should be something
    // else. See docs/v3.5-finance-audit.md Critical-3 for the long form.
  }, [currentUser, mode, supabase]);

  useEffect(() => { loadData(); }, [loadData]);

  /* ── derived stats ── */
  const now           = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];

  const thisMonthTx  = transactions.filter(t => t.date >= thisMonthStart);
  const lastMonthTx  = transactions.filter(t => t.date >= lastMonthStart && t.date < thisMonthStart);

  const monthIncome  = thisMonthTx.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
  const monthExpense = thisMonthTx.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
  const monthNet     = monthIncome - monthExpense;
  const lastIncome   = lastMonthTx.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
  const lastExpense  = lastMonthTx.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);

  // Monthly burn — normalise every active subscription's cost to its
  // monthly equivalent. Before v3.5, this branched only on 'annual vs
  // not-annual' which was fine when the type was `monthly | annual`
  // but treats quarterly and semi-annual incorrectly. The helper in
  // lib/utils keeps the rule in one place.
  const monthlyBurn = subscriptions
    .filter((s) => s.status === 'active')
    .reduce((sum, s) => sum + monthlyEquivalent(Number(s.cost), s.billing_cycle), 0);
  const overdueTotal = invoices.filter(i => i.status === 'overdue').reduce((s, i) => s + Number(i.total), 0);
  const outstandingTotal = invoices.filter(i => ['sent','viewed','overdue'].includes(i.status)).reduce((s, i) => s + Number(i.total), 0);

  // Delta helper: percentage change vs last month
  function delta(curr: number, prev: number) {
    if (prev === 0) return null;
    const pct = ((curr - prev) / prev) * 100;
    return { pct: Math.abs(Math.round(pct)), up: pct >= 0 };
  }

  const chartData = Array.from({ length: 6 }, (_, i) => {
    const d  = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    const ms = d.toISOString().split('T')[0];
    const me = new Date(d.getFullYear(), d.getMonth() + 1, 1).toISOString().split('T')[0];
    const mTx = transactions.filter(t => t.date >= ms && t.date < me);
    return {
      month:   d.toLocaleDateString('en-IN', { month: 'short' }),
      income:  mTx.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0),
      expense: mTx.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0),
    };
  });

  /* ── actions ── */

  /**
   * Mark-paid is now a two-step flow: clicking the row's "Mark Paid"
   * button opens a modal where the user picks paid_date + category.
   * The confirm handler below is what the modal calls on submit.
   */
  async function confirmMarkPaid(
    inv: InvoiceListRow,
    opts: { paidDate: string; category: string },
  ) {
    const res = await markInvoicePaidAction({
      id:            inv.id,
      mode,
      amount:        Number(inv.total) || 0,
      fields:        inv.fields,
      invoiceNumber: inv.number,
      clientName:    inv.clients?.name ?? null,
      paid_date:     opts.paidDate,
      category:      opts.category,
    });
    if (!res.ok) {
      toast.error(res.error || 'Failed to mark invoice as paid');
      return;
    }
    setInvoices(prev => prev.map(i =>
      i.id === inv.id
        ? { ...i, status: 'paid', paid_at: res.data.paid_at, paid_date: res.data.paid_date }
        : i,
    ));
    setMarkingPaid(null);
    toast.success(`Invoice marked as paid on ${formatDate(res.data.paid_date)}`);
    loadData();
  }

  async function handleUndoMarkPaid(inv: InvoiceListRow) {
    const prev = invoices;
    setInvoices(p => p.map(i =>
      i.id === inv.id ? { ...i, status: 'overdue', paid_at: null, paid_date: null } : i,
    ));
    const res = await undoMarkInvoicePaidAction({
      id:              inv.id,
      mode,
      previous_status: 'overdue',
      fields:          inv.fields as Record<string, unknown>,
    });
    if (!res.ok) {
      setInvoices(prev);
      toast.error(res.error || 'Could not undo — try again');
      return;
    }
    toast.success('Payment undone. Invoice is overdue again.');
    loadData();
  }

  async function deleteInvoice(id: string) {
    const prev = invoices;
    setInvoices(p => p.filter(i => i.id !== id));
    const res = await deleteInvoiceDocument(id);
    if (!res.ok) {
      setInvoices(prev);
      toast.error(res.error || 'Could not delete invoice');
    }
  }

  async function deleteTx(id: string) {
    const prev = transactions;
    setTransactions(p => p.filter(t => t.id !== id));
    const res = await deleteTransaction(id);
    if (!res.ok) {
      setTransactions(prev);
      toast.error(res.error || 'Could not delete transaction');
    }
  }

  async function markSubReviewed(sub: Subscription) {
    // Optimistic update — reflect the change immediately, rollback if the
    // server rejects. Consistent with the performance contract (no round-
    // trip wait for UI feedback).
    const now = new Date().toISOString();
    const prev = subscriptions;
    setSubscriptions(p => p.map(s => s.id === sub.id ? { ...s, last_reviewed_at: now } : s));
    const res = await markSubscriptionReviewed(sub.id);
    if (!res.ok) {
      setSubscriptions(prev);
      toast.error(res.error || 'Could not mark as reviewed');
      return;
    }
    toast.success(`${sub.name} marked as reviewed`);
  }

  async function toggleSubStatus(sub: Subscription) {
    const next = sub.status === 'active' ? 'paused' : 'active';
    const prev = subscriptions;
    setSubscriptions(p => p.map(s => s.id === sub.id ? { ...s, status: next } : s));
    const res = await toggleSubscriptionStatus(sub.id, next);
    if (!res.ok) {
      setSubscriptions(prev);
      toast.error(res.error || 'Could not update status');
    }
  }

  async function deleteSub(id: string) {
    const prev = subscriptions;
    setSubscriptions(p => p.filter(s => s.id !== id));
    const res = await deleteSubscription(id);
    if (!res.ok) {
      setSubscriptions(prev);
      toast.error(res.error || 'Could not delete subscription');
    }
  }

  /* ── filtered data ── */
  // Time ranges from URL params.
  // Invoices: time filter only applies to paid rows — overdue/unpaid
  // always show regardless of date so nothing critical is ever hidden.
  const txTimeRange  = useTimeRange('monthly', 'tx');
  const invTimeRange = useTimeRange('monthly', 'inv');

  const filteredTx = useMemo(() => transactions.filter(t => {
    if (txFilter !== 'all' && t.type !== txFilter) return false;
    if (!inTimeRange(t.date, txTimeRange)) return false;
    if (txSearch) {
      const q = txSearch.toLowerCase();
      return (t.description || '').toLowerCase().includes(q) || t.category.toLowerCase().includes(q);
    }
    return true;
  }), [transactions, txFilter, txSearch, txTimeRange]);

  const filteredInvoices = useMemo(() => invoices.filter(i => {
    // Status filter
    if (invFilter === 'unpaid')       { if (!['draft','sent','viewed','overdue'].includes(i.status)) return false; }
    else if (invFilter === 'overdue') { if (i.status !== 'overdue') return false; }
    else if (invFilter === 'paid')    { if (i.status !== 'paid') return false; }

    // Time filter only on paid rows — never hide unpaid/overdue by date
    const isPaid = i.status === 'paid';
    if (isPaid) {
      const dateToFilter = i.paid_date ?? i.due_date;
      if (!inTimeRange(dateToFilter, invTimeRange)) return false;
    }

    return true;
  }), [invoices, invFilter, invTimeRange]);

  // Pagination — apply to the flat filtered lists so Load More
  // advances through the data in order without per-group buttons.
  // Filtered lists are memoized above, so changing a filter value
  // changes the array reference and the hook auto-resets to page 0.
  const txPage  = useLoadMore(filteredTx,       { pageSize: 20 });
  const invPage = useLoadMore(filteredInvoices, { pageSize: 20 });
  const subPage = useLoadMore(subscriptions,    { pageSize: 20 });

  // Group paginated transactions by month for display
  type TxGroup = { label: string; items: Transaction[] };
  const txGroups: TxGroup[] = [];
  txPage.paginated.forEach(tx => {
    const d = new Date(tx.date);
    const label = d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    const group = txGroups.find(g => g.label === label);
    if (group) group.items.push(tx);
    else txGroups.push({ label, items: [tx] });
  });

  const TABS = ['overview', 'invoices', 'transactions', 'subscriptions'] as const;
  const overdueCount = invoices.filter(i => i.status === 'overdue').length;
  const renewingSoon = subscriptions.filter(s => s.status === 'active' && isDueSoon(s.next_renewal_at, 7)).length;

  return (
    <PageTransition>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <h1 className="t-h1">Finance</h1>
            <p className="t-xs mt-1">Track money in, money out, and subscriptions.</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="secondary" icon={<Plus size={14} />} onClick={() => setShowAddSub(true)}>Subscription</Button>
            <Button icon={<Plus size={14} />} onClick={() => setShowAddTx(true)}>Transaction</Button>
          </div>
        </div>

        {/* Summary cards */}
        <div className="rgrid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {([
            { label: 'Income',       value: monthIncome,  prev: lastIncome,   color: 'var(--accent-green)',  icon: <TrendingUp size={13} /> },
            { label: 'Expenses',     value: monthExpense, prev: lastExpense,   color: 'var(--accent-red)',    icon: <TrendingDown size={13} /> },
            { label: 'Net',          value: monthNet,     prev: null,          color: monthNet >= 0 ? 'var(--accent-green)' : 'var(--accent-red)', icon: <IndianRupee size={13} /> },
            { label: 'Monthly Burn', value: Math.round(monthlyBurn), prev: null, color: 'var(--accent-amber)', icon: <RotateCw size={13} /> },
          ] as { label: string; value: number; prev: number | null; color: string; icon: React.ReactNode }[]).map(({ label, value, prev, color, icon }) => {
            const d = prev !== null ? delta(value, prev) : null;
            return (
              <div key={label} className="card" style={{ padding: '14px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <span style={{ color }}>{icon}</span>
                  <span className="t-label">{label}</span>
                  <span className="t-2xs text-tertiary" style={{ marginLeft: 'auto' }}>this month</span>
                </div>
                <p style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800, letterSpacing: '-0.5px', color, lineHeight: 1, marginBottom: d ? 4 : 0 }}>{formatINR(value)}</p>
                {d && (
                  <p style={{ fontSize: 10, fontWeight: 500, color: d.up ? 'var(--accent-green)' : 'var(--accent-red)', marginTop: 2 }}>
                    {d.up ? '▲' : '▼'} {d.pct}% vs last month
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {/* Alert banners */}
        {overdueTotal > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: 'var(--accent-red-dim)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(240,82,82,0.2)' }}>
            <Receipt size={14} style={{ color: 'var(--accent-red)', flexShrink: 0 }} />
            <p className="t-xs" style={{ color: 'var(--accent-red)' }}>
              {overdueCount} overdue invoice{overdueCount > 1 ? 's' : ''} — {formatINR(overdueTotal)} pending
            </p>
            <button onClick={() => { setActiveTab('invoices'); setInvFilter('overdue'); }}
              style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--accent-red)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 600, textDecoration: 'underline' }}>
              View →
            </button>
          </div>
        )}
        {renewingSoon > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: 'var(--accent-amber-dim)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(245,166,35,0.2)', marginTop: overdueTotal > 0 ? -12 : 0 }}>
            <AlertTriangle size={14} style={{ color: 'var(--accent-amber)', flexShrink: 0 }} />
            <p className="t-xs" style={{ color: 'var(--accent-amber)' }}>
              {renewingSoon} subscription{renewingSoon > 1 ? 's' : ''} renewing within 7 days
            </p>
            <button onClick={() => setActiveTab('subscriptions')}
              style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--accent-amber)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 600, textDecoration: 'underline' }}>
              Review →
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="tabs-scroll" style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)' }}>
          {TABS.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              style={{
                padding: '8px 16px', border: 'none', background: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: 500, fontFamily: 'var(--font-body)',
                color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-tertiary)',
                borderBottom: `2px solid ${activeTab === tab ? 'var(--accent-blue)' : 'transparent'}`,
                marginBottom: -1, transition: 'color 150ms, border-color 150ms', textTransform: 'capitalize',
              }}>
              {tab}
              {tab === 'invoices' && overdueCount > 0 && (
                <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 100, background: 'var(--accent-red)', color: '#fff' }}>{overdueCount}</span>
              )}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW ── */}
        {activeTab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Outstanding + collected quick stat */}
            <div className="rgrid-3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div className="card" style={{ padding: '14px 18px' }}>
                <p className="t-label" style={{ marginBottom: 6 }}>Outstanding</p>
                <p style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800, color: outstandingTotal > 0 ? 'var(--accent-amber)' : 'var(--text-secondary)' }}>{formatINR(outstandingTotal)}</p>
                <p className="t-2xs text-tertiary" style={{ marginTop: 4 }}>{invoices.filter(i => ['sent','viewed','overdue'].includes(i.status)).length} unpaid invoice{invoices.filter(i => ['sent','viewed','overdue'].includes(i.status)).length !== 1 ? 's' : ''}</p>
              </div>
              <div className="card" style={{ padding: '14px 18px' }}>
                <p className="t-label" style={{ marginBottom: 6 }}>Collected (All Time)</p>
                <p style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800, color: 'var(--accent-green)' }}>
                  {formatINR(transactions.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0))}
                </p>
                <p className="t-2xs text-tertiary" style={{ marginTop: 4 }}>{transactions.filter(t => t.type === 'income').length} income entries</p>
              </div>
              <div className="card" style={{ padding: '14px 18px' }}>
                <p className="t-label" style={{ marginBottom: 6 }}>Subscriptions</p>
                <p style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800, color: 'var(--accent-amber)' }}>{formatINR(Math.round(monthlyBurn))}<span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-tertiary)' }}>/mo</span></p>
                <p className="t-2xs text-tertiary" style={{ marginTop: 4 }}>{subscriptions.filter(s => s.status === 'active').length} active</p>
              </div>
            </div>

            {/* Chart */}
            <div className="card">
              <SectionHeader title="Revenue vs Expenses — 6 Months" />
              <RevenueChart data={chartData} height={220} />
            </div>

            {/* Recent transactions + upcoming renewals */}
            <div className="rgrid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="card">
                <SectionHeader title="Recent Transactions"
                  action={<button onClick={() => setActiveTab('transactions')} style={{ fontSize: 11, color: 'var(--accent-blue)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>See all →</button>} />
                {transactions.length === 0 ? (
                  <p className="t-xs text-tertiary" style={{ fontStyle: 'italic' }}>No transactions yet. Add your first income or expense.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {transactions.slice(0, 6).map(tx => (
                      <div key={tx.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: tx.type === 'income' ? 'var(--accent-green-dim)' : 'var(--accent-red-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {tx.type === 'income'
                            ? <TrendingUp size={12} style={{ color: 'var(--accent-green)' }} />
                            : <TrendingDown size={12} style={{ color: 'var(--accent-red)' }} />}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p className="t-xs-medium" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.description || catLabel(tx.category)}</p>
                          <p className="t-2xs text-tertiary">{formatDate(tx.date)}</p>
                        </div>
                        <span className="t-xs-medium" style={{ color: tx.type === 'income' ? 'var(--accent-green)' : 'var(--accent-red)', flexShrink: 0 }}>
                          {tx.type === 'income' ? '+' : '−'}{formatINR(Number(tx.amount))}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="card">
                <SectionHeader title="Upcoming Renewals"
                  action={<button onClick={() => setActiveTab('subscriptions')} style={{ fontSize: 11, color: 'var(--accent-blue)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>See all →</button>} />
                {subscriptions.filter(s => s.status === 'active').length === 0 ? (
                  <p className="t-xs text-tertiary" style={{ fontStyle: 'italic' }}>No active subscriptions.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {subscriptions.filter(s => s.status === 'active').slice(0, 6).map(sub => {
                      const soon = isDueSoon(sub.next_renewal_at, 7);
                      return (
                        <div key={sub.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 28, height: 28, borderRadius: 'var(--radius-sm)', background: soon ? 'var(--accent-amber-dim)' : 'var(--bg-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <RotateCw size={12} style={{ color: soon ? 'var(--accent-amber)' : 'var(--text-tertiary)' }} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p className="t-xs-medium" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub.name}</p>
                            <p className="t-2xs text-tertiary">{formatDate(sub.next_renewal_at)}</p>
                          </div>
                          <span className="t-xs-medium" style={{ color: soon ? 'var(--accent-amber)' : 'var(--text-secondary)', flexShrink: 0 }}>{formatINR(Number(sub.cost))}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── INVOICES ── */}
        {activeTab === 'invoices' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Filter bar */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Row 1: status pills + right-side actions */}
              <div className="filter-bar" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div className="tabs-scroll" style={{ display: 'flex', background: 'var(--bg-hover)', padding: 3, borderRadius: 'var(--radius-md)', gap: 2 }}>
                  {(['all', 'unpaid', 'overdue', 'paid'] as const).map(f => (
                    <button key={f} onClick={() => setInvFilter(f)}
                      style={{ padding: '5px 12px', borderRadius: 'calc(var(--radius-md) - 3px)', border: 'none', background: invFilter === f ? 'var(--bg-surface)' : 'transparent', color: invFilter === f ? 'var(--text-primary)' : 'var(--text-tertiary)', fontSize: 11, fontFamily: 'var(--font-body)', fontWeight: invFilter === f ? 500 : 400, cursor: 'pointer', boxShadow: invFilter === f ? 'var(--shadow-card)' : 'none', transition: 'all 150ms', textTransform: 'capitalize', whiteSpace: 'nowrap' }}>
                      {f}
                      {f === 'overdue' && overdueCount > 0 && <span style={{ marginLeft: 5, fontSize: 9, padding: '1px 4px', borderRadius: 100, background: 'var(--accent-red)', color: '#fff' }}>{overdueCount}</span>}
                    </button>
                  ))}
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button onClick={() => setShowLogPaid(true)}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 11, fontFamily: 'var(--font-body)', fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' }}
                    title="Record an invoice that's already been paid, without going through the full paperwork flow">
                    <CheckCircle2 size={11} /> Log paid invoice
                  </button>
                  <a href={`/dashboard/${mode}/paperwork`} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-body)', textDecoration: 'none' }}>
                    <ExternalLink size={11} /> Create in Paperwork
                  </a>
                </div>
              </div>
              {/* Row 2: time filter (scoped to paid rows in filteredInvoices — unpaid/overdue always show) */}
              <TimeFilter paramPrefix="inv" defaultGranularity="monthly" allowFuture={false} />
            </div>

            {loading ? (
              [1,2,3].map(i => <div key={i} className="card" style={{ height: 64, background: 'var(--bg-hover)', animation: 'ds-pulse 1.5s ease-in-out infinite' }} />)
            ) : filteredInvoices.length === 0 ? (
              <div className="card" style={{ padding: '40px 24px', textAlign: 'center' }}>
                <Receipt size={28} style={{ color: 'var(--text-tertiary)', margin: '0 auto 12px' }} />
                <p className="t-sm-semibold" style={{ marginBottom: 4 }}>
                  {invFilter !== 'all' ? `No ${invFilter} invoices` : 'No invoices yet'}
                </p>
                <p className="t-xs text-tertiary">
                  {invFilter !== 'all' ? 'Try changing the filter above.' : 'Create invoices in Paperwork and link them to clients.'}
                </p>
              </div>
            ) : invPage.paginated.map(inv => {
              const cfg = INVOICE_STATUS[inv.status] || INVOICE_STATUS.draft;
              return (
                <div key={inv.id} className="card dense-row" style={{ padding: '12px 18px' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; }}>
                  {/* Invoice icon */}
                  <div className="dense-row__lead" style={{ width: 34, height: 34, borderRadius: 'var(--radius-md)', background: 'var(--bg-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Receipt size={14} style={{ color: 'var(--text-tertiary)' }} />
                  </div>
                  <div className="dense-row__body">
                    <div className="dense-row__title">
                      <span className="dense-row__name" style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--accent-blue)', fontWeight: 500 }}>{inv.number}</span>
                      <StatusPill status={cfg.label} color={cfg.color} />
                    </div>
                    <div className="dense-row__meta">
                      {inv.clients?.name && <span className="t-xs text-secondary">{inv.clients.name}</span>}
                      <span className="t-2xs text-tertiary">
                        {inv.status === 'paid' && inv.paid_date
                          ? `Paid ${formatDate(inv.paid_date)}`
                          : `Due ${inv.due_date ? formatDate(inv.due_date) : '—'}`}
                      </span>
                    </div>
                  </div>
                  <div className="dense-row__actions">
                    <span className="chip-opt-out" style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{formatINR(Number(inv.total))}</span>
                    {inv.status !== 'paid' && (
                      <button onClick={() => setMarkingPaid(inv)}
                        className="row-btn-primary"
                        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--accent-green)', background: 'var(--accent-green-dim)', color: 'var(--accent-green)', fontSize: 11, fontFamily: 'var(--font-body)', fontWeight: 500, cursor: 'pointer', transition: 'all 150ms' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--accent-green)'; (e.currentTarget as HTMLElement).style.color = '#fff'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--accent-green-dim)'; (e.currentTarget as HTMLElement).style.color = 'var(--accent-green)'; }}>
                        <CheckCircle2 size={11} /> <span className="row-btn-label">Mark Paid</span>
                      </button>
                    )}
                    {inv.status === 'paid' && (
                      <button onClick={() => handleUndoMarkPaid(inv)}
                        className="row-btn hide-on-mobile-row"
                        title="Undo — revert to overdue and remove the income transaction"
                        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)', background: 'transparent', color: 'var(--text-tertiary)', fontSize: 11, fontFamily: 'var(--font-body)', fontWeight: 500, cursor: 'pointer', transition: 'all 150ms' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent-amber)'; (e.currentTarget as HTMLElement).style.color = 'var(--accent-amber)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; }}>
                        <RotateCcw size={11} /> <span className="row-btn-label">Undo Paid</span>
                      </button>
                    )}
                    {inv.share_token && (
                      <button onClick={() => window.open(`/doc/${inv.share_token}`, '_blank')}
                        aria-label="Preview"
                        className="hide-on-mobile-row"
                        style={{ display: 'flex', padding: '5px 7px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)', background: 'transparent', color: 'var(--text-tertiary)', cursor: 'pointer', transition: 'color 150ms' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent-blue)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; }}>
                        <ExternalLink size={12} />
                      </button>
                    )}
                    <button onClick={() => deleteInvoice(inv.id)}
                      aria-label="Delete invoice"
                      className="hide-on-mobile-row"
                      style={{ display: 'flex', padding: '5px 7px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'transparent', color: 'var(--text-tertiary)', cursor: 'pointer', transition: 'color 150ms' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent-red)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; }}>
                      <Trash2 size={13} />
                    </button>
                    <OverflowMenu
                      items={[
                        ...(inv.share_token ? [{ label: 'Preview link', icon: <ExternalLink size={14} />, onClick: () => window.open(`/doc/${inv.share_token}`, '_blank') }] : []),
                        { label: 'Delete invoice', icon: <Trash2 size={14} />, onClick: () => deleteInvoice(inv.id), destructive: true },
                      ]}
                    />
                  </div>
                </div>
              );
            })}
            {filteredInvoices.length > 0 && (
              <LoadMore hasMore={invPage.hasMore} onLoadMore={invPage.loadMore}
                shown={invPage.shown} total={invPage.total} />
            )}
          </div>
        )}

        {/* ── TRANSACTIONS ── */}
        {activeTab === 'transactions' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Filter bar */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Row 1: search + type pills + add */}
              <div className="filter-bar" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ position: 'relative', flex: 1, maxWidth: 300 }}>
                  <Search size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none' }} />
                  <input value={txSearch} onChange={e => setTxSearch(e.target.value)} placeholder="Search..."
                    style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: '7px 10px 7px 30px', fontSize: 12, fontFamily: 'var(--font-body)', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box', transition: 'border-color 150ms' }}
                    onFocus={e => { e.target.style.borderColor = 'var(--accent-blue)'; }}
                    onBlur={e => { e.target.style.borderColor = 'var(--border-default)'; }} />
                </div>
                <div style={{ display: 'flex', background: 'var(--bg-hover)', padding: 3, borderRadius: 'var(--radius-md)', gap: 2 }}>
                  {(['all', 'income', 'expense'] as const).map(f => (
                    <button key={f} onClick={() => setTxFilter(f)}
                      style={{ padding: '5px 12px', borderRadius: 'calc(var(--radius-md) - 3px)', border: 'none', background: txFilter === f ? 'var(--bg-surface)' : 'transparent', color: txFilter === f ? 'var(--text-primary)' : 'var(--text-tertiary)', fontSize: 11, fontFamily: 'var(--font-body)', fontWeight: txFilter === f ? 500 : 400, cursor: 'pointer', boxShadow: txFilter === f ? 'var(--shadow-card)' : 'none', transition: 'all 150ms', textTransform: 'capitalize' }}>
                      {f}
                    </button>
                  ))}
                </div>
                <button onClick={() => setShowAddTx(true)}
                  style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--accent-blue)', color: '#fff', fontSize: 12, fontFamily: 'var(--font-body)', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  <Plus size={13} /> Add
                </button>
              </div>
              {/* Row 2: time filter */}
              <TimeFilter paramPrefix="tx" defaultGranularity="monthly" allowFuture={false} />
            </div>

            {/* Month-grouped list */}
            {filteredTx.length === 0 ? (
              <div className="card" style={{ padding: '40px 24px', textAlign: 'center' }}>
                <IndianRupee size={28} style={{ color: 'var(--text-tertiary)', margin: '0 auto 12px' }} />
                <p className="t-sm-semibold" style={{ marginBottom: 4 }}>{txSearch || txFilter !== 'all' ? 'No matching transactions' : 'No transactions yet'}</p>
                <p className="t-xs text-tertiary">Log your income and expenses to track your cash flow.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {txGroups.map(group => {
                  const groupIncome  = group.items.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
                  const groupExpense = group.items.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
                  return (
                    <div key={group.label}>
                      {/* Month header */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px', marginBottom: 8 }}>
                        <span className="t-label">{group.label}</span>
                        <div style={{ display: 'flex', gap: 12 }}>
                          {groupIncome > 0 && <span style={{ fontSize: 11, color: 'var(--accent-green)', fontWeight: 600 }}>+{formatINR(groupIncome)}</span>}
                          {groupExpense > 0 && <span style={{ fontSize: 11, color: 'var(--accent-red)', fontWeight: 600 }}>−{formatINR(groupExpense)}</span>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {group.items.map(tx => (
                          <div key={tx.id} className="card dense-row" style={{ padding: '10px 16px' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; }}>
                            <div className="dense-row__lead" style={{ width: 30, height: 30, borderRadius: '50%', background: tx.type === 'income' ? 'var(--accent-green-dim)' : 'var(--accent-red-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {tx.type === 'income'
                                ? <TrendingUp size={13} style={{ color: 'var(--accent-green)' }} />
                                : <TrendingDown size={13} style={{ color: 'var(--accent-red)' }} />}
                            </div>
                            <div className="dense-row__body">
                              <div className="dense-row__title">
                                <span className="t-xs-medium dense-row__name">{tx.description || catLabel(tx.category)}</span>
                              </div>
                              <div className="dense-row__meta">
                                <span className="t-2xs text-tertiary">{formatDate(tx.date)}</span>
                                <span className="t-2xs text-tertiary">{catLabel(tx.category)}</span>
                              </div>
                            </div>
                            <div className="dense-row__actions">
                              <span className="chip-opt-out" style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: tx.type === 'income' ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                                {tx.type === 'income' ? '+' : '−'}{formatINR(Number(tx.amount))}
                              </span>
                              <button onClick={() => deleteTx(tx.id)}
                                aria-label="Delete transaction"
                                className="hide-on-mobile-row"
                                style={{ display: 'flex', padding: '4px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'transparent', color: 'var(--text-tertiary)', cursor: 'pointer', transition: 'color 150ms' }}
                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent-red)'; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; }}>
                                <Trash2 size={13} />
                              </button>
                              <OverflowMenu
                                items={[
                                  { label: 'Delete transaction', icon: <Trash2 size={14} />, onClick: () => deleteTx(tx.id), destructive: true },
                                ]}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {filteredTx.length > 0 && (
              <LoadMore hasMore={txPage.hasMore} onLoadMore={txPage.loadMore}
                shown={txPage.shown} total={txPage.total} />
            )}
          </div>
        )}

        {/* ── SUBSCRIPTIONS ── */}
        {activeTab === 'subscriptions' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Burn summary bar */}
            {subscriptions.filter(s => s.status === 'active').length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
                <RotateCw size={14} style={{ color: 'var(--accent-amber)', flexShrink: 0 }} />
                <span className="t-xs text-secondary">
                  Monthly burn: <strong style={{ color: 'var(--accent-amber)' }}>{formatINR(Math.round(monthlyBurn))}</strong>
                  {' '}· {subscriptions.filter(s => s.status === 'active').length} active subscription{subscriptions.filter(s => s.status === 'active').length > 1 ? 's' : ''}
                </span>
                <button onClick={() => setShowAddSub(true)}
                  style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 11, fontFamily: 'var(--font-body)', cursor: 'pointer' }}>
                  <Plus size={12} /> Add
                </button>
              </div>
            )}

            {subscriptions.length === 0 ? (
              <div className="card" style={{ padding: '40px 24px', textAlign: 'center' }}>
                <CreditCard size={28} style={{ color: 'var(--text-tertiary)', margin: '0 auto 12px' }} />
                <p className="t-sm-semibold" style={{ marginBottom: 4 }}>No subscriptions yet</p>
                <p className="t-xs text-tertiary" style={{ marginBottom: 16 }}>Track your recurring tools and services.</p>
                <Button icon={<Plus size={14} />} onClick={() => setShowAddSub(true)}>Add Subscription</Button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {subPage.paginated.map(sub => {
                  const soon   = isDueSoon(sub.next_renewal_at, 7);
                  const zombie = sub.last_reviewed_at
                    ? Math.floor((Date.now() - new Date(sub.last_reviewed_at).getTime()) / 86400000) > 90
                    : false;
                  const isActive = sub.status === 'active';
                  const statusColor = isActive ? 'var(--accent-green)' : sub.status === 'paused' ? 'var(--accent-amber)' : 'var(--text-tertiary)';

                  return (
                    <div key={sub.id} className="card dense-row" style={{ padding: '12px 16px', opacity: isActive ? 1 : 0.65 }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; }}>
                      {/* Icon */}
                      <div className="dense-row__lead" style={{ width: 32, height: 32, borderRadius: 'var(--radius-sm)', background: isActive ? 'var(--accent-green-dim)' : 'var(--bg-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <RotateCw size={14} style={{ color: isActive ? 'var(--accent-green)' : 'var(--text-tertiary)' }} />
                      </div>
                      <div className="dense-row__body">
                        <div className="dense-row__title">
                          <span className="t-xs-medium dense-row__name">{sub.name}</span>
                          <StatusPill status={sub.status} color={statusColor} />
                          {soon && isActive && <span className="chip-opt-out" style={{ fontSize: 10, fontWeight: 600, color: 'var(--accent-amber)', background: 'var(--accent-amber-dim)', padding: '2px 7px', borderRadius: 100, flexShrink: 0 }}>Renews soon</span>}
                          {zombie && (
                            <button onClick={() => markSubReviewed(sub)} className="chip-opt-out" style={{ fontSize: 10, fontWeight: 600, color: 'var(--accent-amber)', background: 'var(--accent-amber-dim)', padding: '2px 8px', borderRadius: 100, border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)', transition: 'opacity 150ms', flexShrink: 0 }} title="Click to mark as reviewed">
                              ⚠ Not reviewed in 90d
                            </button>
                          )}
                        </div>
                        <div className="dense-row__meta">
                          <span className="t-2xs text-tertiary">{formatCycleLabel(sub.billing_cycle)}</span>
                          <span className="t-2xs text-tertiary">{catLabel(sub.category)}</span>
                          <span className="t-2xs text-tertiary">Renews {formatDate(sub.next_renewal_at)}</span>
                        </div>
                      </div>
                      <div className="dense-row__actions">
                        <div className="chip-opt-out" style={{ textAlign: 'right' }}>
                          <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                            {formatINR(Number(sub.cost))}
                          </span>
                          <span className="t-2xs text-tertiary">/{formatCycleSuffix(sub.billing_cycle)}</span>
                          {sub.billing_cycle !== 'monthly' && (
                            <p className="t-2xs text-tertiary">{formatINR(Math.round(monthlyEquivalent(Number(sub.cost), sub.billing_cycle)))}/mo</p>
                          )}
                        </div>
                        <button onClick={() => setEditingSub(sub)} title="Edit" aria-label="Edit"
                          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)', background: 'transparent', color: 'var(--text-tertiary)', cursor: 'pointer', transition: 'all 150ms', fontSize: 11, fontFamily: 'var(--font-body)' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent-blue)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent-blue)'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)'; }}>
                          <Pencil size={12} /><span className="row-btn-label">Edit</span>
                        </button>
                        <button onClick={() => toggleSubStatus(sub)} title={isActive ? 'Pause' : 'Resume'} aria-label={isActive ? 'Pause' : 'Resume'}
                          className="hide-on-mobile-row"
                          style={{ display: 'flex', padding: '5px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)', background: 'transparent', color: 'var(--text-tertiary)', cursor: 'pointer', transition: 'all 150ms' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = isActive ? 'var(--accent-amber)' : 'var(--accent-green)'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; }}>
                          {isActive ? <Pause size={12} /> : <Play size={12} />}
                        </button>
                        <button onClick={() => deleteSub(sub.id)}
                          aria-label="Delete subscription"
                          className="hide-on-mobile-row"
                          style={{ display: 'flex', padding: '5px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'transparent', color: 'var(--text-tertiary)', cursor: 'pointer', transition: 'color 150ms' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent-red)'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; }}>
                          <Trash2 size={12} />
                        </button>
                        <OverflowMenu
                          items={[
                            { label: isActive ? 'Pause subscription' : 'Resume subscription', icon: isActive ? <Pause size={14} /> : <Play size={14} />, onClick: () => toggleSubStatus(sub) },
                            { label: 'Delete subscription', icon: <Trash2 size={14} />, onClick: () => deleteSub(sub.id), destructive: true },
                          ]}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {subscriptions.length > 0 && (
              <LoadMore hasMore={subPage.hasMore} onLoadMore={subPage.loadMore}
                shown={subPage.shown} total={subPage.total} />
            )}
          </div>
        )}

        {/* Modals */}
        <AddTransactionModal open={showAddTx} onClose={() => setShowAddTx(false)}
          mode={mode} currentUser={currentUser}
          onCreated={(tx: Transaction) => { setTransactions(prev => [tx, ...prev]); setShowAddTx(false); }} />
        <AddSubscriptionModal open={showAddSub} onClose={() => setShowAddSub(false)}
          mode={mode} currentUser={currentUser}
          onCreated={(sub: Subscription) => {
            setSubscriptions(prev => [...prev, sub].sort((a, b) => a.next_renewal_at.localeCompare(b.next_renewal_at)));
            setShowAddSub(false);
          }} />
        {editingSub && (
          <EditSubscriptionModal sub={editingSub} onClose={() => setEditingSub(null)}
            onSaved={updated => {
              setSubscriptions(prev => prev.map(s => s.id === updated.id ? updated : s));
              setEditingSub(null);
            }} />
        )}
        {markingPaid && (
          <MarkInvoicePaidModal inv={markingPaid}
            onClose={() => setMarkingPaid(null)}
            onConfirm={(opts) => confirmMarkPaid(markingPaid, opts)} />
        )}
        <LogPaidInvoiceModal open={showLogPaid} onClose={() => setShowLogPaid(false)}
          mode={mode}
          onCreated={() => { setShowLogPaid(false); loadData(); }} />
      </div>
    </PageTransition>
  );
}

/* ── ADD TRANSACTION MODAL ──────────────────────────────────── */
function AddTransactionModal({ open, onClose, mode, currentUser, onCreated }: { open: boolean; onClose: () => void; mode: 'personal' | 'agency'; currentUser: { ownerId: string } | null | undefined; onCreated: (tx: Transaction) => void }) {
  const [type, setType]               = useState<'income' | 'expense'>('income');
  const [category, setCategory]       = useState('project_payment');
  const [amount, setAmount]           = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate]               = useState(new Date().toISOString().split('T')[0]);
  const [saving, setSaving]           = useState(false);

  useEffect(() => {
    if (!open) { setAmount(''); setDescription(''); setDate(new Date().toISOString().split('T')[0]); setType('income'); }
  }, [open]);

  async function handleSave() {
    if (!amount || !currentUser) return;
    setSaving(true);
    const res = await createTransaction({
      mode,
      type,
      category,
      amount: parseFloat(amount),
      description: description || null,
      date,
    });
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error || 'Could not add transaction');
      return;
    }
    onCreated(res.data);
  }

  const cats = type === 'income' ? INCOME_CATS : EXPENSE_CATS;

  return (
    <Modal open={open} onClose={onClose} title="Add Transaction" size="sm">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Type toggle */}
        <div style={{ display: 'flex', background: 'var(--bg-hover)', padding: 3, borderRadius: 'var(--radius-md)', gap: 2 }}>
          {(['income', 'expense'] as const).map(t => (
            <button key={t} onClick={() => { setType(t); setCategory(t === 'income' ? 'project_payment' : 'tools_and_subscriptions'); }}
              style={{ flex: 1, padding: '8px', borderRadius: 'calc(var(--radius-md) - 3px)', border: 'none', background: type === t ? 'var(--bg-surface)' : 'transparent', color: type === t ? (t === 'income' ? 'var(--accent-green)' : 'var(--accent-red)') : 'var(--text-tertiary)', fontSize: 12, fontFamily: 'var(--font-body)', fontWeight: type === t ? 600 : 400, cursor: 'pointer', boxShadow: type === t ? 'var(--shadow-card)' : 'none', transition: 'all 150ms' }}>
              {t === 'income' ? '↑ Income' : '↓ Expense'}
            </button>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Input label="Amount (₹)" type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" autoFocus />
          <Input label="Date" type="date" value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <Select label="Category" options={cats} value={category} onChange={e => setCategory(e.target.value)} />
        <Input label="Description" value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional note (e.g., client name, project)" />
        <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
          <Button variant="secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</Button>
          <Button onClick={handleSave} loading={saving} disabled={!amount} style={{ flex: 1 }}>Add</Button>
        </div>
      </div>
    </Modal>
  );
}

/* ── ADD SUBSCRIPTION MODAL ─────────────────────────────────── */
function AddSubscriptionModal({ open, onClose, mode, currentUser, onCreated }: { open: boolean; onClose: () => void; mode: 'personal' | 'agency'; currentUser: { ownerId: string } | null | undefined; onCreated: (sub: Subscription) => void }) {
  const [name, setName]             = useState('');
  const [cost, setCost]             = useState('');
  const [cycle, setCycle]           = useState<BillingCycle>('monthly');
  const [category, setCategory]     = useState('tools');
  const [renewalDate, setRenewalDate] = useState('');
  const [saving, setSaving]         = useState(false);

  useEffect(() => { if (!open) { setName(''); setCost(''); setRenewalDate(''); } }, [open]);

  async function handleSave() {
    if (!name || !cost || !renewalDate || !currentUser) return;
    setSaving(true);
    // Server action does Zod validation + ownership scoping + insert.
    // user_id and last_reviewed_at are set server-side.
    const res = await createSubscription({
      mode,
      name,
      category,
      cost: parseFloat(cost),
      billing_cycle: cycle,
      next_renewal_at: renewalDate,
      status: 'active',
      auto_pay: false,
    });
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error || 'Could not add subscription');
      return;
    }
    onCreated(res.data);
  }

  return (
    <Modal open={open} onClose={onClose} title="Add Subscription" size="sm">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Input label="Service Name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Figma, Vercel, ChatGPT Plus" autoFocus />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Input label="Cost (₹)" type="number" value={cost} onChange={e => setCost(e.target.value)} placeholder="0" />
          <Select label="Billing Cycle" options={BILLING_CYCLE_OPTIONS} value={cycle} onChange={e => setCycle(e.target.value as BillingCycle)} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Select label="Category" options={SUB_CATS} value={category} onChange={e => setCategory(e.target.value)} />
          <Input label="Next Renewal" type="date" value={renewalDate} onChange={e => setRenewalDate(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
          <Button variant="secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</Button>
          <Button onClick={handleSave} loading={saving} disabled={!name || !cost || !renewalDate} style={{ flex: 1 }}>Add</Button>
        </div>
      </div>
    </Modal>
  );
}

/* ── EDIT SUBSCRIPTION MODAL ────────────────────────────────── */
function EditSubscriptionModal({ sub, onClose, onSaved }: { sub: Subscription; onClose: () => void; onSaved: (s: Subscription) => void }) {
  const [name, setName]             = useState(sub.name);
  const [cost, setCost]             = useState(String(sub.cost));
  const [cycle, setCycle]           = useState(sub.billing_cycle);
  const [category, setCategory]     = useState(sub.category);
  const [renewalDate, setRenewalDate] = useState(sub.next_renewal_at?.split('T')[0] || '');
  const [saving, setSaving]         = useState(false);

  async function handleSave() {
    setSaving(true);
    const res = await updateSubscription(sub.id, {
      name,
      cost: parseFloat(cost),
      billing_cycle: cycle,
      category,
      next_renewal_at: renewalDate,
    });
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error || 'Could not save subscription');
      return;
    }
    onSaved(res.data);
  }

  return (
    <Modal open={true} onClose={onClose} title="Edit Subscription" size="sm">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Input label="Service Name" value={name} onChange={e => setName(e.target.value)} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Input label="Cost (₹)" type="number" value={cost} onChange={e => setCost(e.target.value)} />
          <Select label="Billing Cycle" options={BILLING_CYCLE_OPTIONS} value={cycle} onChange={e => setCycle(e.target.value as BillingCycle)} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Select label="Category" options={SUB_CATS} value={category} onChange={e => setCategory(e.target.value)} />
          <Input label="Next Renewal" type="date" value={renewalDate} onChange={e => setRenewalDate(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
          <Button variant="secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</Button>
          <Button onClick={handleSave} loading={saving} disabled={!name || !cost} style={{ flex: 1 }}>Save</Button>
        </div>
      </div>
    </Modal>
  );
}

/* ── MARK INVOICE PAID MODAL (step 4) ───────────────────────────
 * Lets the user pick paid_date (defaults today, editable) and the
 * income category before firing markInvoicePaidAction. Replaces the
 * previous one-click flow — necessary so backdated payments land in
 * the correct month's revenue stats and so the auto-logged income
 * transaction gets the right category bucket.
 */
function MarkInvoicePaidModal({
  inv, onClose, onConfirm,
}: {
  inv: InvoiceListRow;
  onClose: () => void;
  onConfirm: (opts: { paidDate: string; category: string }) => Promise<void>;
}) {
  const today = new Date().toISOString().split('T')[0];
  const [paidDate, setPaidDate] = useState(today);
  const [category, setCategory] = useState('project_payment');
  const [saving, setSaving]     = useState(false);

  async function handleSubmit() {
    if (!paidDate) return;
    setSaving(true);
    try {
      await onConfirm({ paidDate, category });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={true} onClose={onClose} title="Mark Invoice Paid" size="sm">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ padding: 12, background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
          <p className="t-2xs text-tertiary" style={{ marginBottom: 2 }}>Invoice</p>
          <p className="t-xs-medium">{inv.number}</p>
          <p className="t-2xs text-tertiary">
            {inv.clients?.name ? `${inv.clients.name} · ` : ''}{formatINR(Number(inv.total))}
          </p>
        </div>

        <Input
          label="Payment received on"
          type="date"
          value={paidDate}
          max={today}
          onChange={e => setPaidDate(e.target.value)}
        />
        <p className="t-2xs text-tertiary" style={{ marginTop: -8 }}>
          Use a past date if the payment was received earlier — revenue stats
          will land in the correct month.
        </p>

        <Select
          label="Income Category"
          options={INCOME_CATS}
          value={category}
          onChange={e => setCategory(e.target.value)}
        />

        <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
          <Button variant="secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</Button>
          <Button onClick={handleSubmit} loading={saving} disabled={!paidDate} style={{ flex: 1 }}>
            Mark as Paid
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* ── LOG PAID INVOICE MODAL (step 4) ────────────────────────────
 * "Record an invoice that's already been paid." Creates the invoice
 * document in `paid` status with a linked income transaction in one
 * server round-trip via createPaidInvoiceAction.
 *
 * Keeps the form minimal — no line items, no GST breakdown, no
 * payment terms. This flow is for record-keeping ("I got paid ₹X
 * last week, let me log it properly"), not for the full paperwork
 * authoring experience.
 */
function LogPaidInvoiceModal({
  open, onClose, mode, onCreated,
}: {
  open: boolean;
  onClose: () => void;
  mode: 'personal' | 'agency';
  onCreated: () => void;
}) {
  const today = new Date().toISOString().split('T')[0];
  const [clientName, setClientName]       = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [total, setTotal]                 = useState('');
  const [invoiceDate, setInvoiceDate]     = useState(today);
  const [paidDate, setPaidDate]           = useState(today);
  const [category, setCategory]           = useState('project_payment');
  const [description, setDescription]     = useState('');
  const [saving, setSaving]               = useState(false);

  useEffect(() => {
    if (!open) {
      setClientName(''); setInvoiceNumber(''); setTotal('');
      setInvoiceDate(today); setPaidDate(today);
      setCategory('project_payment'); setDescription('');
    }
  }, [open, today]);

  async function handleSave() {
    const amount = parseFloat(total);
    if (!clientName || !invoiceNumber || !amount || amount <= 0) return;
    setSaving(true);
    const res = await createPaidInvoiceAction({
      mode,
      client_name:    clientName,
      invoice_number: invoiceNumber,
      total:          amount,
      invoice_date:   invoiceDate,
      paid_date:      paidDate,
      category,
      description:    description.trim() || null,
    });
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error || 'Could not log invoice');
      return;
    }
    toast.success(`Invoice ${invoiceNumber} logged as paid on ${formatDate(res.data.paid_date)}`);
    onCreated();
  }

  const amount = parseFloat(total);
  const validAmount = Number.isFinite(amount) && amount > 0;

  return (
    <Modal open={open} onClose={onClose} title="Log Paid Invoice" size="sm">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <p className="t-xs text-secondary" style={{ marginBottom: 2 }}>
          Record an invoice that&apos;s already been paid. Creates the
          invoice + income transaction in one step — skip this if you
          want the full paperwork flow instead.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Input label="Client Name" value={clientName} onChange={e => setClientName(e.target.value)}
            placeholder="e.g., ACME Corp" autoFocus />
          <Input label="Invoice Number" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)}
            placeholder="INV-2026-001" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Input label="Total (₹)" type="number" value={total}
            onChange={e => setTotal(e.target.value)} placeholder="0" />
          <Select label="Income Category" options={INCOME_CATS}
            value={category} onChange={e => setCategory(e.target.value)} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Input label="Invoice Date" type="date" value={invoiceDate}
            max={today} onChange={e => setInvoiceDate(e.target.value)} />
          <Input label="Paid Date" type="date" value={paidDate}
            max={today} min={invoiceDate} onChange={e => setPaidDate(e.target.value)} />
        </div>

        <Input label="Description (optional)" value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="e.g., 50% upfront — website design" />

        <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
          <Button variant="secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</Button>
          <Button onClick={handleSave} loading={saving}
            disabled={!clientName || !invoiceNumber || !validAmount}
            style={{ flex: 1 }}>
            Log Invoice
          </Button>
        </div>
      </div>
    </Modal>
  );
}

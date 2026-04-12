'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useBrand } from '@/lib/brand';
import { useCurrentUser } from '@/lib/auth/use-auth';
import { createClient } from '@/lib/supabase/client';
import { PageTransition } from '@/components/dashboard/PageTransition';
import { Button, Modal, Input, Select } from '@/components/ui';
import { toast } from '@/components/ui/Toast';
import { RevenueChart } from '@/components/charts/RevenueChart';
import { formatINR, formatDate, isDueSoon } from '@/lib/utils';
import {
  Plus, IndianRupee, TrendingUp, TrendingDown, RotateCw,
  CheckCircle2, Trash2, Pause, Play, Receipt, CreditCard,
  Search, ExternalLink, Pencil, AlertTriangle,
} from 'lucide-react';
import type { Transaction, Subscription, NormalizedInvoice } from '@/types';

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
const INVOICE_STATUS: Record<string, { label: string; color: string }> = {
  draft:   { label: 'Draft',   color: 'var(--text-tertiary)' },
  sent:    { label: 'Sent',    color: 'var(--accent-blue)' },
  viewed:  { label: 'Viewed',  color: 'var(--accent-violet)' },
  overdue: { label: 'Overdue', color: 'var(--accent-red)' },
  paid:    { label: 'Paid',    color: 'var(--accent-green)' },
};

function catLabel(cat: string) {
  return cat.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
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
  const [invoices, setInvoices]           = useState<NormalizedInvoice[]>([]);
  const [transactions, setTransactions]   = useState<Transaction[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading]             = useState(true);
  const [showAddTx, setShowAddTx]         = useState(false);
  const [showAddSub, setShowAddSub]       = useState(false);
  const [editingSub, setEditingSub]       = useState<Subscription | null>(null);
  const [txSearch, setTxSearch]           = useState('');
  const [txFilter, setTxFilter]           = useState<'all' | 'income' | 'expense'>('all');
  const [invFilter, setInvFilter]         = useState<'all' | 'unpaid' | 'overdue' | 'paid'>('all');

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
    // Normalise documents into invoice shape
    const nowOverdueIds: string[] = [];
    const rawInvoices = (invDocs.data || []).map((doc: any) => {
      const f = doc.fields || {};
      const dueDate = f.due_date || '';
      let status = doc.status;
      // Compute overdue: not paid/signed and past due date
      if (status !== 'paid' && status !== 'signed' && dueDate && dueDate < today) {
        // Track IDs that need their DB status updated from sent/viewed → overdue
        if (status !== 'overdue') nowOverdueIds.push(doc.id);
        status = 'overdue';
      }
      return {
        id:          doc.id,
        number:      f.invoice_number || doc.title || '—',
        total:       f.total || 0,
        due_date:    dueDate,
        paid_at:     f.paid_at || null,
        status,
        share_token: doc.share_token,
        clients:     doc.clients,
        client_id:   doc.client_id,
        fields:      f,
        _source:     'document', // for markInvoicePaid to know which table
      };
    });
    setInvoices(rawInvoices);
    setTransactions((tx.data as Transaction[]) || []);
    setSubscriptions((subs.data as Subscription[]) || []);
    setLoading(false);

    // Persist overdue status to DB for any invoices that just became overdue.
    // Fire-and-forget — UI is already correct, this just keeps the DB consistent
    // so the attention feed and server-side queries return accurate statuses.
    if (nowOverdueIds.length > 0) {
      supabase.from('documents')
        .update({ status: 'overdue' })
        .in('id', nowOverdueIds)
        .then(() => {});
    }
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

  const monthlyBurn  = subscriptions.filter(s => s.status === 'active')
    .reduce((sum, s) => sum + (s.billing_cycle === 'annual' ? Number(s.cost) / 12 : Number(s.cost)), 0);
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
  async function markInvoicePaid(inv: any) {
    const now = new Date().toISOString();
    const today = now.split('T')[0];
    const updatedFields = { ...inv.fields, paid_at: now };
    const { error: docErr } = await supabase.from('documents')
      .update({ status: 'paid', fields: updatedFields, updated_at: now })
      .eq('id', inv.id);
    if (docErr) { toast.error('Failed to mark invoice as paid'); return; }
    await supabase.from('transactions').insert({
      user_id: currentUser!.ownerId, mode, type: 'income',
      category: 'project_payment',
      amount: Number(inv.total),
      description: `Invoice ${inv.number}${inv.clients?.name ? ` — ${inv.clients.name}` : ''}`,
      date: today,
    });
    setInvoices(prev => prev.map(i => i.id === inv.id ? { ...i, status: 'paid', paid_at: now } : i));
    toast.success('Invoice marked as paid');
    loadData();
  }

  async function deleteInvoice(id: string) {
    await supabase.from('documents').delete().eq('id', id);
    setInvoices(prev => prev.filter(i => i.id !== id));
  }

  async function deleteTx(id: string) {
    await supabase.from('transactions').delete().eq('id', id);
    setTransactions(prev => prev.filter(t => t.id !== id));
  }

  async function markSubReviewed(sub: Subscription) {
    const now = new Date().toISOString();
    await supabase.from('subscriptions')
      .update({ last_reviewed_at: now, updated_at: now })
      .eq('id', sub.id);
    setSubscriptions(prev => prev.map(s => s.id === sub.id ? { ...s, last_reviewed_at: now } : s));
    toast.success(`${sub.name} marked as reviewed`);
  }

  async function toggleSubStatus(sub: Subscription) {
    const next = sub.status === 'active' ? 'paused' : 'active';
    await supabase.from('subscriptions').update({ status: next }).eq('id', sub.id);
    setSubscriptions(prev => prev.map(s => s.id === sub.id ? { ...s, status: next as any } : s));
  }

  async function deleteSub(id: string) {
    await supabase.from('subscriptions').delete().eq('id', id);
    setSubscriptions(prev => prev.filter(s => s.id !== id));
  }

  /* ── filtered data ── */
  const filteredTx = transactions.filter(t => {
    if (txFilter !== 'all' && t.type !== txFilter) return false;
    if (txSearch) {
      const q = txSearch.toLowerCase();
      return (t.description || '').toLowerCase().includes(q) || t.category.toLowerCase().includes(q);
    }
    return true;
  });

  const filteredInvoices = invoices.filter(i => {
    if (invFilter === 'unpaid') return ['draft','sent','viewed'].includes(i.status);
    if (invFilter === 'overdue') return i.status === 'overdue';
    if (invFilter === 'paid') return i.status === 'paid';
    return true;
  });

  // Group transactions by month
  type TxGroup = { label: string; items: Transaction[] };
  const txGroups: TxGroup[] = [];
  filteredTx.forEach(tx => {
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
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
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)' }}>
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
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
                            <p className="t-xs-medium">{sub.name}</p>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ display: 'flex', background: 'var(--bg-hover)', padding: 3, borderRadius: 'var(--radius-md)', gap: 2 }}>
                {(['all', 'unpaid', 'overdue', 'paid'] as const).map(f => (
                  <button key={f} onClick={() => setInvFilter(f)}
                    style={{ padding: '5px 12px', borderRadius: 'calc(var(--radius-md) - 3px)', border: 'none', background: invFilter === f ? 'var(--bg-surface)' : 'transparent', color: invFilter === f ? 'var(--text-primary)' : 'var(--text-tertiary)', fontSize: 11, fontFamily: 'var(--font-body)', fontWeight: invFilter === f ? 500 : 400, cursor: 'pointer', boxShadow: invFilter === f ? 'var(--shadow-card)' : 'none', transition: 'all 150ms', textTransform: 'capitalize' }}>
                    {f}
                    {f === 'overdue' && overdueCount > 0 && <span style={{ marginLeft: 5, fontSize: 9, padding: '1px 4px', borderRadius: 100, background: 'var(--accent-red)', color: '#fff' }}>{overdueCount}</span>}
                  </button>
                ))}
              </div>
              <a href={`/dashboard/${mode}/paperwork`} style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-body)', textDecoration: 'none' }}>
                <ExternalLink size={11} /> Create in Paperwork
              </a>
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
            ) : filteredInvoices.map(inv => {
              const cfg = INVOICE_STATUS[inv.status] || INVOICE_STATUS.draft;
              return (
                <div key={inv.id} className="card" style={{ padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 14, transition: 'background 150ms' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; }}>
                  {/* Invoice icon */}
                  <div style={{ width: 34, height: 34, borderRadius: 'var(--radius-md)', background: 'var(--bg-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Receipt size={14} style={{ color: 'var(--text-tertiary)' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--accent-blue)', fontWeight: 500 }}>{inv.number}</span>
                      {inv.clients?.name && <span className="t-xs text-secondary">{inv.clients.name}</span>}
                      <StatusPill status={cfg.label} color={cfg.color} />
                    </div>
                    <p className="t-2xs text-tertiary">
                      Due {inv.due_date ? formatDate(inv.due_date) : '—'}
                      {inv.paid_at ? ` · Paid ${formatDate(inv.paid_at)}` : ''}
                    </p>
                  </div>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', flexShrink: 0 }}>{formatINR(Number(inv.total))}</span>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    {inv.status !== 'paid' && (
                      <button onClick={() => markInvoicePaid(inv)}
                        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--accent-green)', background: 'var(--accent-green-dim)', color: 'var(--accent-green)', fontSize: 11, fontFamily: 'var(--font-body)', fontWeight: 500, cursor: 'pointer', transition: 'all 150ms', whiteSpace: 'nowrap' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--accent-green)'; (e.currentTarget as HTMLElement).style.color = '#fff'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--accent-green-dim)'; (e.currentTarget as HTMLElement).style.color = 'var(--accent-green)'; }}>
                        <CheckCircle2 size={11} /> Mark Paid
                      </button>
                    )}
                    {inv.share_token && (
                      <button onClick={() => window.open(`/doc/${inv.share_token}`, '_blank')}
                        title="Preview"
                        style={{ display: 'flex', padding: '5px 7px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)', background: 'transparent', color: 'var(--text-tertiary)', cursor: 'pointer', transition: 'color 150ms' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent-blue)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; }}>
                        <ExternalLink size={12} />
                      </button>
                    )}
                    <button onClick={() => deleteInvoice(inv.id)}
                      style={{ display: 'flex', padding: '5px 7px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'transparent', color: 'var(--text-tertiary)', cursor: 'pointer', transition: 'color 150ms' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent-red)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── TRANSACTIONS ── */}
        {activeTab === 'transactions' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Filter bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
                          <div key={tx.id} className="card" style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12, transition: 'background 150ms' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; }}>
                            <div style={{ width: 30, height: 30, borderRadius: '50%', background: tx.type === 'income' ? 'var(--accent-green-dim)' : 'var(--accent-red-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              {tx.type === 'income'
                                ? <TrendingUp size={13} style={{ color: 'var(--accent-green)' }} />
                                : <TrendingDown size={13} style={{ color: 'var(--accent-red)' }} />}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p className="t-xs-medium" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.description || catLabel(tx.category)}</p>
                              <p className="t-2xs text-tertiary">{formatDate(tx.date)} · {catLabel(tx.category)}</p>
                            </div>
                            <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: tx.type === 'income' ? 'var(--accent-green)' : 'var(--accent-red)', flexShrink: 0 }}>
                              {tx.type === 'income' ? '+' : '−'}{formatINR(Number(tx.amount))}
                            </span>
                            <button onClick={() => deleteTx(tx.id)}
                              style={{ display: 'flex', padding: '4px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'transparent', color: 'var(--text-tertiary)', cursor: 'pointer', transition: 'color 150ms', flexShrink: 0 }}
                              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent-red)'; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; }}>
                              <Trash2 size={13} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
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
                {subscriptions.map(sub => {
                  const soon   = isDueSoon(sub.next_renewal_at, 7);
                  const zombie = sub.last_reviewed_at
                    ? Math.floor((Date.now() - new Date(sub.last_reviewed_at).getTime()) / 86400000) > 90
                    : false;
                  const isActive = sub.status === 'active';
                  const statusColor = isActive ? 'var(--accent-green)' : sub.status === 'paused' ? 'var(--accent-amber)' : 'var(--text-tertiary)';

                  return (
                    <div key={sub.id} className="card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, transition: 'background 150ms', opacity: isActive ? 1 : 0.65 }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; }}>
                      {/* Icon */}
                      <div style={{ width: 32, height: 32, borderRadius: 'var(--radius-sm)', background: isActive ? 'var(--accent-green-dim)' : 'var(--bg-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <RotateCw size={14} style={{ color: isActive ? 'var(--accent-green)' : 'var(--text-tertiary)' }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3, flexWrap: 'wrap' }}>
                          <p className="t-xs-medium">{sub.name}</p>
                          <StatusPill status={sub.status} color={statusColor} />
                          {soon && isActive && <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--accent-amber)', background: 'var(--accent-amber-dim)', padding: '2px 7px', borderRadius: 100 }}>Renews soon</span>}
                          {zombie && (
                            <button onClick={() => markSubReviewed(sub)} style={{ fontSize: 10, fontWeight: 600, color: 'var(--accent-amber)', background: 'var(--accent-amber-dim)', padding: '2px 8px', borderRadius: 100, border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)', transition: 'opacity 150ms' }} title="Click to mark as reviewed">
                              ⚠ Not reviewed in 90d — click to dismiss
                            </button>
                          )}
                        </div>
                        <p className="t-2xs text-tertiary">
                          {sub.billing_cycle === 'monthly' ? 'Monthly' : 'Annual'} · {catLabel(sub.category)} · Renews {formatDate(sub.next_renewal_at)}
                        </p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                            {formatINR(Number(sub.cost))}
                          </span>
                          <span className="t-2xs text-tertiary">/{sub.billing_cycle === 'monthly' ? 'mo' : 'yr'}</span>
                          {sub.billing_cycle === 'annual' && (
                            <p className="t-2xs text-tertiary">{formatINR(Math.round(Number(sub.cost) / 12))}/mo</p>
                          )}
                        </div>
                        <button onClick={() => setEditingSub(sub)} title="Edit"
                          style={{ display: 'flex', padding: '5px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)', background: 'transparent', color: 'var(--text-tertiary)', cursor: 'pointer', transition: 'all 150ms' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent-blue)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent-blue)'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)'; }}>
                          <Pencil size={12} />
                        </button>
                        <button onClick={() => toggleSubStatus(sub)} title={isActive ? 'Pause' : 'Resume'}
                          style={{ display: 'flex', padding: '5px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)', background: 'transparent', color: 'var(--text-tertiary)', cursor: 'pointer', transition: 'all 150ms' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = isActive ? 'var(--accent-amber)' : 'var(--accent-green)'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; }}>
                          {isActive ? <Pause size={12} /> : <Play size={12} />}
                        </button>
                        <button onClick={() => deleteSub(sub.id)}
                          style={{ display: 'flex', padding: '5px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'transparent', color: 'var(--text-tertiary)', cursor: 'pointer', transition: 'color 150ms' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent-red)'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; }}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Modals */}
        <AddTransactionModal open={showAddTx} onClose={() => setShowAddTx(false)}
          mode={mode} currentUser={currentUser}
          onCreated={tx => { setTransactions(prev => [tx, ...prev]); setShowAddTx(false); }} />
        <AddSubscriptionModal open={showAddSub} onClose={() => setShowAddSub(false)}
          mode={mode} currentUser={currentUser}
          onCreated={sub => {
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
      </div>
    </PageTransition>
  );
}

/* ── ADD TRANSACTION MODAL ──────────────────────────────────── */
function AddTransactionModal({ open, onClose, mode, currentUser, onCreated }: any) {
  const supabase = useRef(createClient()).current;
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
    const { data, error } = await supabase.from('transactions')
      .insert({ user_id: currentUser.ownerId, mode, type, category, amount: parseFloat(amount), description: description || null, date })
      .select().single();
    if (!error && data) onCreated(data);
    setSaving(false);
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
function AddSubscriptionModal({ open, onClose, mode, currentUser, onCreated }: any) {
  const supabase = useRef(createClient()).current;
  const [name, setName]             = useState('');
  const [cost, setCost]             = useState('');
  const [cycle, setCycle]           = useState('monthly');
  const [category, setCategory]     = useState('tools');
  const [renewalDate, setRenewalDate] = useState('');
  const [saving, setSaving]         = useState(false);

  useEffect(() => { if (!open) { setName(''); setCost(''); setRenewalDate(''); } }, [open]);

  async function handleSave() {
    if (!name || !cost || !renewalDate || !currentUser) return;
    setSaving(true);
    const { data, error } = await supabase.from('subscriptions')
      .insert({
        user_id: currentUser.ownerId, mode, name, cost: parseFloat(cost),
        billing_cycle: cycle, category, next_renewal_at: renewalDate,
        status: 'active', auto_pay: false,
        last_reviewed_at: new Date().toISOString(),
      })
      .select().single();
    if (!error && data) onCreated(data);
    setSaving(false);
  }

  return (
    <Modal open={open} onClose={onClose} title="Add Subscription" size="sm">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Input label="Service Name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Figma, Vercel, ChatGPT Plus" autoFocus />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Input label="Cost (₹)" type="number" value={cost} onChange={e => setCost(e.target.value)} placeholder="0" />
          <Select label="Billing Cycle" options={[{ value: 'monthly', label: 'Monthly' }, { value: 'annual', label: 'Annual' }]} value={cycle} onChange={e => setCycle(e.target.value)} />
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
  const supabase = useRef(createClient()).current;
  const [name, setName]             = useState(sub.name);
  const [cost, setCost]             = useState(String(sub.cost));
  const [cycle, setCycle]           = useState(sub.billing_cycle);
  const [category, setCategory]     = useState(sub.category);
  const [renewalDate, setRenewalDate] = useState(sub.next_renewal_at?.split('T')[0] || '');
  const [saving, setSaving]         = useState(false);

  async function handleSave() {
    setSaving(true);
    const { data } = await supabase.from('subscriptions')
      .update({ name, cost: parseFloat(cost), billing_cycle: cycle, category, next_renewal_at: renewalDate, last_reviewed_at: new Date().toISOString() })
      .eq('id', sub.id).select().single();
    if (data) onSaved(data as Subscription);
    setSaving(false);
  }

  return (
    <Modal open={true} onClose={onClose} title="Edit Subscription" size="sm">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Input label="Service Name" value={name} onChange={e => setName(e.target.value)} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Input label="Cost (₹)" type="number" value={cost} onChange={e => setCost(e.target.value)} />
          <Select label="Billing Cycle" options={[{ value: 'monthly', label: 'Monthly' }, { value: 'annual', label: 'Annual' }]} value={cycle} onChange={e => setCycle(e.target.value)} />
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

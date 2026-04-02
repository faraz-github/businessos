'use client';

import { useState, useEffect } from 'react';
import { useBrand } from '@/lib/brand';
import { useCurrentUser } from '@/lib/auth/use-auth';
import { createClient } from '@/lib/supabase/client';
import { PageTransition } from '@/components/dashboard/PageTransition';
import { Card, Badge, Button, Tabs, Modal, Input, Select, EmptyState } from '@/components/ui';
import { RevenueChart } from '@/components/charts/RevenueChart';
import { formatINR, formatCompactINR, formatDate, isOverdue, isDueSoon, cn } from '@/lib/utils';
import {
  Plus, IndianRupee, Receipt, CreditCard, TrendingUp, TrendingDown,
  CheckCircle2, Clock, AlertCircle, RotateCw,
} from 'lucide-react';
import type { Invoice, Transaction, Subscription } from '@/types';

const invoiceStatusConfig: Record<string, { variant: any; icon: any }> = {
  draft: { variant: 'outline', icon: <Clock size={12} /> },
  sent: { variant: 'blue', icon: <Clock size={12} /> },
  viewed: { variant: 'violet', icon: <Clock size={12} /> },
  overdue: { variant: 'red', icon: <AlertCircle size={12} /> },
  paid: { variant: 'green', icon: <CheckCircle2 size={12} /> },
};

const incomeCategories = [
  { value: 'project_payment', label: 'Project Payment' },
  { value: 'initial_payment', label: 'Initial Payment' },
  { value: 'final_payment', label: 'Final Payment' },
  { value: 'retainer', label: 'Retainer' },
];

const expenseCategories = [
  { value: 'tools_and_subscriptions', label: 'Tools & Subscriptions' },
  { value: 'contractor', label: 'Contractor' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'miscellaneous', label: 'Miscellaneous' },
];

export default function PersonalFinancePage() {
  const { mode } = useBrand();
  const { user: currentUser } = useCurrentUser();
  const [activeTab, setActiveTab] = useState('overview');
  const [invoices, setInvoices] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [showAddTx, setShowAddTx] = useState(false);
  const [showAddSub, setShowAddSub] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    async function fetch() {
      const user = currentUser;
      if (!user) return;

      const [inv, tx, subs] = await Promise.all([
        supabase.from('invoices').select('*, clients(name)').eq('user_id', user.id).eq('mode', mode).order('created_at', { ascending: false }),
        supabase.from('transactions').select('*').eq('user_id', user.id).eq('mode', mode).order('date', { ascending: false }),
        supabase.from('subscriptions').select('*').eq('user_id', user.id).eq('mode', mode).order('next_renewal_at'),
      ]);

      setInvoices(inv.data || []);
      setTransactions((tx.data as Transaction[]) || []);
      setSubscriptions((subs.data as Subscription[]) || []);
    }
    fetch();
  }, [mode, supabase]);

  // Monthly summary
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const monthTx = transactions.filter((t) => t.date >= startOfMonth);
  const monthIncome = monthTx.filter((t) => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
  const monthExpense = monthTx.filter((t) => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
  const monthlyBurn = subscriptions.filter((s) => s.status === 'active').reduce((sum, s) => sum + (s.billing_cycle === 'annual' ? Number(s.cost) / 12 : Number(s.cost)), 0);

  // Chart data (last 6 months)
  const chartData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    const ms = d.toISOString().split('T')[0];
    const me = new Date(d.getFullYear(), d.getMonth() + 1, 1).toISOString().split('T')[0];
    const mTx = transactions.filter((t) => t.date >= ms && t.date < me);
    return {
      month: d.toLocaleDateString('en-IN', { month: 'short' }),
      income: mTx.filter((t) => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0),
      expense: mTx.filter((t) => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0),
    };
  });

  async function markInvoicePaid(id: string) {
    await supabase.from('invoices').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', id);
    setInvoices((prev) => prev.map((inv) => inv.id === id ? { ...inv, status: 'paid', paid_at: new Date().toISOString() } : inv));
  }

  return (
    <PageTransition>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="t-h1">Finance</h1>
            <p className="text-[13px] text-[var(--text-secondary)] mt-1">Track money in, money out, and subscriptions.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" icon={<Plus size={14} />} onClick={() => setShowAddTx(true)}>Transaction</Button>
            <Button variant="secondary" icon={<Plus size={14} />} onClick={() => setShowAddSub(true)}>Subscription</Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-3">
          <Card variant="metric">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingUp size={12} className="text-[var(--accent-green)]" />
              <span className="text-[11px] text-[var(--text-tertiary)] uppercase tracking-wide font-semibold">Income</span>
            </div>
            <p style={{ fontFamily: "Space Grotesk, sans-serif", fontSize: 20, fontWeight: 800, letterSpacing: "-0.2px", color: "var(--accent-green)" }}>{formatINR(monthIncome)}</p>
          </Card>
          <Card variant="metric">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingDown size={12} className="text-[var(--accent-red)]" />
              <span className="text-[11px] text-[var(--text-tertiary)] uppercase tracking-wide font-semibold">Expenses</span>
            </div>
            <p style={{ fontFamily: "Space Grotesk, sans-serif", fontSize: 20, fontWeight: 800, letterSpacing: "-0.2px", color: "var(--accent-red)" }}>{formatINR(monthExpense)}</p>
          </Card>
          <Card variant="metric">
            <div className="flex items-center gap-1.5 mb-1">
              <IndianRupee size={12} className="text-[var(--accent-blue)]" />
              <span className="text-[11px] text-[var(--text-tertiary)] uppercase tracking-wide font-semibold">Net</span>
            </div>
            <p style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 20, fontWeight: 800, letterSpacing: '-0.2px', color: monthIncome - monthExpense >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
              {formatINR(monthIncome - monthExpense)}
            </p>
          </Card>
          <Card variant="metric">
            <div className="flex items-center gap-1.5 mb-1">
              <RotateCw size={12} className="text-[var(--accent-amber)]" />
              <span className="text-[11px] text-[var(--text-tertiary)] uppercase tracking-wide font-semibold">Monthly Burn</span>
            </div>
            <p style={{ fontFamily: "Space Grotesk, sans-serif", fontSize: 20, fontWeight: 800, letterSpacing: "-0.2px", color: "var(--accent-amber)" }}>{formatINR(Math.round(monthlyBurn))}</p>
          </Card>
        </div>

        <Tabs
          tabs={[
            { value: 'overview', label: 'Overview' },
            { value: 'invoices', label: 'Invoices' },
            { value: 'transactions', label: 'Transactions' },
            { value: 'subscriptions', label: 'Subscriptions' },
          ]}
          value={activeTab}
          onChange={setActiveTab}
        />

        {activeTab === 'overview' && (
          <Card variant="base">
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-tertiary)] mb-3">Revenue vs Expenses (6 Months)</p>
            <RevenueChart data={chartData} />
          </Card>
        )}

        {activeTab === 'invoices' && (
          <div className="flex flex-col gap-2">
            {invoices.length === 0 ? (
              <Card><EmptyState icon={<Receipt />} title="No invoices" description="Create invoices in Paperwork." /></Card>
            ) : (
              invoices.map((inv) => {
                const config = invoiceStatusConfig[inv.status] || invoiceStatusConfig.draft;
                return (
                  <Card key={inv.id} variant="base" className="flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-medium font-mono text-[var(--accent-blue)]">{inv.number}</span>
                        {inv.clients?.name && <span className="text-[12px] text-[var(--text-secondary)]">{inv.clients.name}</span>}
                      </div>
                      <p className="text-[11px] text-[var(--text-tertiary)]">Due {formatDate(inv.due_date)}</p>
                    </div>
                    <span style={{ fontFamily: "Space Grotesk, sans-serif", fontSize: 16, fontWeight: 800, letterSpacing: "0px", color: "var(--text-primary)" }}>{formatINR(inv.total)}</span>
                    <Badge variant={config.variant}>{inv.status}</Badge>
                    {inv.status !== 'paid' && (
                      <Button variant="ghost" size="sm" onClick={() => markInvoicePaid(inv.id)}>
                        <CheckCircle2 size={12} /> Mark Paid
                      </Button>
                    )}
                  </Card>
                );
              })
            )}
          </div>
        )}

        {activeTab === 'transactions' && (
          <div className="flex flex-col gap-2">
            {transactions.length === 0 ? (
              <Card><EmptyState icon={<IndianRupee />} title="No transactions" description="Log your first income or expense." action={<Button icon={<Plus size={14} />} onClick={() => setShowAddTx(true)}>Add Transaction</Button>} /></Card>
            ) : (
              transactions.map((tx) => (
                <Card key={tx.id} variant="base" className="flex items-center gap-4">
                  <div className={cn('w-8 h-8 rounded-full flex items-center justify-center shrink-0',
                    tx.type === 'income' ? 'bg-[var(--accent-green-dim)]' : 'bg-[var(--accent-red-dim)]')}>
                    {tx.type === 'income' ? <TrendingUp size={14} className="text-[var(--accent-green)]" /> : <TrendingDown size={14} className="text-[var(--accent-red)]" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-[var(--text-primary)] truncate">{tx.description || tx.category}</p>
                    <p className="text-[11px] text-[var(--text-tertiary)]">{formatDate(tx.date)} · {tx.category.replace(/_/g, ' ')}</p>
                  </div>
                  <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 16, fontWeight: 800, letterSpacing: '0px', color: 'var(--text-primary)' }}>
                    {tx.type === 'income' ? '+' : '-'}{formatINR(tx.amount)}
                  </span>
                </Card>
              ))
            )}
          </div>
        )}

        {activeTab === 'subscriptions' && (
          <div className="flex flex-col gap-2">
            {subscriptions.length === 0 ? (
              <Card><EmptyState icon={<CreditCard />} title="No subscriptions" description="Track your recurring expenses." action={<Button icon={<Plus size={14} />} onClick={() => setShowAddSub(true)}>Add Subscription</Button>} /></Card>
            ) : (
              subscriptions.map((sub) => {
                const renewingSoon = isDueSoon(sub.next_renewal_at, 7);
                const daysSinceReview = sub.last_reviewed_at ? Math.floor((Date.now() - new Date(sub.last_reviewed_at).getTime()) / 86400000) : 999;
                const isZombie = daysSinceReview > 90;

                return (
                  <Card key={sub.id} variant="base" className="flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-[13px] font-medium text-[var(--text-primary)]">{sub.name}</p>
                        {renewingSoon && <Badge variant="amber" dot className="text-[9px]">Renewing soon</Badge>}
                        {isZombie && <Badge variant="red" className="text-[9px]">Review needed</Badge>}
                        <Badge variant="outline" className="text-[9px] capitalize">{sub.billing_cycle}</Badge>
                      </div>
                      <p className="text-[11px] text-[var(--text-tertiary)]">
                        Next: {formatDate(sub.next_renewal_at)} · {sub.category}
                      </p>
                    </div>
                    <span style={{ fontFamily: "Space Grotesk, sans-serif", fontSize: 16, fontWeight: 800, letterSpacing: "0px", color: "var(--text-primary)" }}>{formatINR(sub.cost)}</span>
                    <Badge variant={sub.status === 'active' ? 'green' : sub.status === 'paused' ? 'amber' : 'outline'}>{sub.status}</Badge>
                  </Card>
                );
              })
            )}
          </div>
        )}

        {/* Add Transaction Modal */}
        <AddTransactionModal open={showAddTx} onClose={() => setShowAddTx(false)} mode={mode} onCreated={(tx) => { setTransactions((prev) => [tx, ...prev]); setShowAddTx(false); }} />
        <AddSubscriptionModal open={showAddSub} onClose={() => setShowAddSub(false)} mode={mode} onCreated={(sub) => { setSubscriptions((prev) => [...prev, sub]); setShowAddSub(false); }} />
      </div>
    </PageTransition>
  );
}

function AddTransactionModal({ open, onClose, mode, onCreated }: any) {
  const [type, setType] = useState<'income' | 'expense'>('income');
  const [category, setCategory] = useState('project_payment');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!amount) return;
    setSaving(true);
    const supabase = createClient();
    const user = currentUser;
    if (!user) return;
    const { data, error } = await supabase.from('transactions')
      .insert({ user_id: user.id, mode, type, category, amount: parseFloat(amount), description: description || null, date })
      .select().single();
    if (!error && data) onCreated(data);
    setSaving(false);
  }

  const categories = type === 'income' ? incomeCategories : expenseCategories;

  return (
    <Modal open={open} onClose={onClose} title="Add Transaction" size="sm">
      <div className="flex flex-col gap-4">
        <Tabs tabs={[{ value: 'income', label: 'Income' }, { value: 'expense', label: 'Expense' }]} value={type} onChange={(v) => { setType(v as any); setCategory(v === 'income' ? 'project_payment' : 'tools_and_subscriptions'); }} />
        <Select label="Category" options={categories} value={category} onChange={(e) => setCategory(e.target.value)} />
        <Input label="Amount (₹)" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
        <Input label="Description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" />
        <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <div className="flex gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</Button>
          <Button onClick={handleSave} loading={saving} style={{ flex: 1 }}>Add</Button>
        </div>
      </div>
    </Modal>
  );
}

function AddSubscriptionModal({ open, onClose, mode, onCreated }: any) {
  const [name, setName] = useState('');
  const [cost, setCost] = useState('');
  const [cycle, setCycle] = useState('monthly');
  const [renewalDate, setRenewalDate] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name || !cost || !renewalDate) return;
    setSaving(true);
    const supabase = createClient();
    const user = currentUser;
    if (!user) return;
    const { data, error } = await supabase.from('subscriptions')
      .insert({ user_id: user.id, mode, name, cost: parseFloat(cost), billing_cycle: cycle, next_renewal_at: renewalDate, category: 'tools', status: 'active', auto_pay: false })
      .select().single();
    if (!error && data) onCreated(data);
    setSaving(false);
  }

  return (
    <Modal open={open} onClose={onClose} title="Add Subscription" size="sm">
      <div className="flex flex-col gap-4">
        <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Figma" />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Cost (₹)" type="number" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0" />
          <Select label="Billing Cycle" options={[{ value: 'monthly', label: 'Monthly' }, { value: 'annual', label: 'Annual' }]} value={cycle} onChange={(e) => setCycle(e.target.value)} />
        </div>
        <Input label="Next Renewal" type="date" value={renewalDate} onChange={(e) => setRenewalDate(e.target.value)} />
        <div className="flex gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</Button>
          <Button onClick={handleSave} loading={saving} style={{ flex: 1 }}>Add</Button>
        </div>
      </div>
    </Modal>
  );
}

'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Sparkline } from '@/components/charts/Sparkline';
import { PageTransition } from '@/components/dashboard/PageTransition';
import { createClient } from '@/lib/supabase/client';
import { useBrand } from '@/lib/brand';
import { useCurrentUser } from '@/lib/auth/use-auth';
import { formatINR, formatCompactINR, formatTime } from '@/lib/utils';
import {
  AlertCircle, CheckCircle2, Info, Plus, X,
  IndianRupee, Users, Share2, Briefcase, Clock,
} from 'lucide-react';
import type { AttentionItem, Priority, TimeBlock } from '@/types';

interface HomeStats {
  money: { revenueThisMonth: number; outstandingTotal: number; overdueTotal: number; sparklineData: { value: number }[] };
  clients: { activeProjects: number; totalActive: number; pipelineLeads: number; totalAllTime: number };
  social: { postsThisMonth: number };
  work: { activeProjects: number; deliveredThisMonth: number };
}

const blockTypeColors: Record<string, string> = {
  deep: 'var(--accent-blue)', outreach: 'var(--accent-green)',
  admin: 'var(--accent-amber)', personal: 'var(--accent-violet)',
};

function stagger(index: number) {
  return {
    initial: { opacity: 0, y: 6 }, animate: { opacity: 1, y: 0 },
    transition: { delay: index * 0.06, duration: 0.32, ease: [0, 0, 0.2, 1] },
  };
}

/* ── Section label: "NEEDS ATTENTION", "BUSINESS HEALTH" ── */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="t-label section-gap">{children}</p>;
}

/* ── MetricCard: icon+label row → 10px → big number → 4px → subtitle ── */
function MetricCard({ icon, iconColor, label, value, sub, children }: {
  icon: React.ReactNode; iconColor: string; label: string;
  value: string | number; sub?: string; children?: React.ReactNode;
}) {
  return (
    <div className="card">
      {/* Icon + label row — metric-header-gap before value */}
      <div className="flex items-center gap-2 metric-header-gap">
        <div className="flex items-center justify-center radius-sm shrink-0"
          style={{ width: 28, height: 28, background: `${iconColor}1A`, color: iconColor }}>
          {icon}
        </div>
        <span className="t-label">{label}</span>
      </div>
      {/* Metric value */}
      <p className="t-metric" style={{ lineHeight: 1 }}>{value}</p>
      {/* Subtitle — 4px below value */}
      {sub && <p className="t-2xs" style={{ marginTop: 4 }}>{sub}</p>}
      {children}
    </div>
  );
}

/* ── Attention item card ── */
function AttentionCard({ item, index }: { item: AttentionItem; index: number }) {
  const cfgs = {
    critical:  { color: 'var(--accent-red)',   bg: 'var(--accent-red-dim)',   icon: <AlertCircle size={14} /> },
    important: { color: 'var(--accent-amber)', bg: 'var(--accent-amber-dim)', icon: <Clock size={14} /> },
    info:      { color: 'var(--accent-blue)',  bg: 'var(--accent-blue-dim)',  icon: <Info size={14} /> },
  };
  const cfg = cfgs[item.severity];

  return (
    <motion.div key={item.id} {...stagger(index)}>
      <Link href={item.link} style={{ textDecoration: 'none', display: 'block' }}>
        <div className="card interactive hover-bg-hover cursor-pointer"
          style={{ padding: '14px 18px', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
          <div className="flex items-center justify-center rounded-full shrink-0"
            style={{ width: 32, height: 32, background: cfg.bg, color: cfg.color, marginTop: 1 }}>
            {cfg.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2" style={{ marginBottom: 3 }}>
              <span className="t-sm-semibold">{item.title}</span>
              <span className="badge" style={{ background: cfg.bg, color: cfg.color }}>{item.severity}</span>
            </div>
            <p className="t-xs truncate">{item.description}</p>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

/* ── Card subgrid row: OUTSTANDING / OVERDUE ── */
function SubMetric({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <p className="t-label sub-label-gap">{label}</p>
      <p className="t-xs-medium" style={{ color: color || 'var(--text-primary)' }}>{value}</p>
    </div>
  );
}

export function PersonalHomeClient({ attentionItems, stats, priorities: initialPriorities, timeBlocks: initialTimeBlocks }: {
  attentionItems: AttentionItem[]; stats: HomeStats | null;
  priorities: Priority[]; timeBlocks: TimeBlock[];
}) {
  const { mode } = useBrand();
  const { user: currentUser } = useCurrentUser();
  const supabase = createClient();
  const [priorities, setPriorities] = useState(initialPriorities);
  const [timeBlocks, setTimeBlocks] = useState(initialTimeBlocks);
  const [newPriority, setNewPriority] = useState('');
  const [addingPriority, setAddingPriority] = useState(false);
  const [showAddBlock, setShowAddBlock] = useState(false);

  async function handleAddPriority() {
    if (!newPriority.trim() || priorities.length >= 3 || !currentUser) return;
    setAddingPriority(true);
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase.from('priorities')
      .insert({ user_id: currentUser.id, mode, date: today, text: newPriority, sort_order: priorities.length })
      .select().single();
    if (data) setPriorities(prev => [...prev, data as Priority]);
    setNewPriority('');
    setAddingPriority(false);
  }

  async function handleTogglePriority(id: string, completed: boolean) {
    await supabase.from('priorities').update({ completed: !completed }).eq('id', id);
    setPriorities(prev => prev.map(p => p.id === id ? { ...p, completed: !completed } : p));
  }

  async function handleAddTimeBlock(type: string, startTime: string, endTime: string, label: string) {
    if (!currentUser) return;
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase.from('time_blocks')
      .insert({ user_id: currentUser.id, mode, date: today, type, start_time: startTime, end_time: endTime, label: label || null })
      .select().single();
    if (data) setTimeBlocks(prev => [...prev, data as TimeBlock].sort((a, b) => a.start_time.localeCompare(b.start_time)));
    setShowAddBlock(false);
  }

  async function handleDeleteBlock(id: string) {
    await supabase.from('time_blocks').delete().eq('id', id);
    setTimeBlocks(prev => prev.filter(b => b.id !== id));
  }

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';

  return (
    <PageTransition>
      <div className="flex flex-col gap-9">

        {/* ── Page header ── */}
        <div>
          <h1 className="t-display">Good {greeting}</h1>
          <p className="t-xs" style={{ marginTop: 6 }}>Here&apos;s what needs your attention today.</p>
        </div>

        {/* ── Two-column layout ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 32, alignItems: 'start' }}>

          {/* ── LEFT COLUMN ── */}
          <div className="flex flex-col gap-9">

            {/* NEEDS ATTENTION */}
            <div>
              <SectionLabel>Needs Attention</SectionLabel>
              {attentionItems.length === 0 ? (
                <div className="card" style={{ padding: '40px 24px', textAlign: 'center' }}>
                  <div className="flex items-center justify-center rounded-full mx-auto"
                    style={{ width: 44, height: 44, background: 'var(--accent-green-dim)', color: 'var(--accent-green)', marginBottom: 14 }}>
                    <CheckCircle2 size={20} />
                  </div>
                  <p className="t-sm-semibold" style={{ marginBottom: 4 }}>All clear</p>
                  <p className="t-xs">Nothing needs your attention right now. Nice work.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {attentionItems.map((item, i) => <AttentionCard key={item.id} item={item} index={i} />)}
                </div>
              )}
            </div>

            {/* BUSINESS HEALTH */}
            <div>
              <SectionLabel>Business Health</SectionLabel>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

                {/* Money */}
                <MetricCard icon={<IndianRupee size={15} />} iconColor="var(--accent-green)"
                  label="Money" value={formatINR(stats?.money?.revenueThisMonth || 0)} sub="Revenue this month">
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border-subtle)' }}>
                    <SubMetric label="Outstanding" value={formatCompactINR(stats?.money?.outstandingTotal || 0)} color="var(--accent-amber)" />
                    <SubMetric label="Overdue" value={formatCompactINR(stats?.money?.overdueTotal || 0)} color="var(--accent-red)" />
                  </div>
                  {stats?.money?.sparklineData && (
                    <div style={{ marginTop: 12 }}>
                      <Sparkline data={stats.money.sparklineData} color="var(--accent-green)" height={36} />
                    </div>
                  )}
                </MetricCard>

                {/* Clients */}
                <MetricCard icon={<Users size={15} />} iconColor="var(--accent-blue)"
                  label="Clients" value={stats?.clients?.totalActive || 0} sub="Active clients">
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border-subtle)' }}>
                    <SubMetric label="LinkedIn leads" value={String(stats?.clients?.pipelineLeads || 0)} />
                    <SubMetric label="All time" value={String(stats?.clients?.totalAllTime || 0)} />
                  </div>
                </MetricCard>

                {/* Brand */}
                <MetricCard icon={<Share2 size={15} />} iconColor="var(--accent-violet)"
                  label="Outreach" value={stats?.social?.postsThisMonth || 0} sub="Posts this month" />

                {/* Work */}
                <MetricCard icon={<Briefcase size={15} />} iconColor="var(--accent-amber)"
                  label="Work" value={stats?.work?.activeProjects || 0} sub="Active projects" />
              </div>
            </div>
          </div>

          {/* ── RIGHT COLUMN — Today's Focus ── */}
          {/* paddingTop = label(14px) + section-gap(10px) = 24px — aligns first card with left column first card */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 24 }}>
            {/* TOP 3 PRIORITIES */}
            <div className="card">
              {/* Card-internal heading: card-heading-gap */}
              <p className="t-label card-heading-gap">Top 3 Priorities</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {priorities.slice(0, 3).map(p => (
                  <div key={p.id} className="flex items-start gap-2.5">
                    <button
                      onClick={() => handleTogglePriority(p.id, p.completed)}
                      style={{
                        width: 18, height: 18, borderRadius: '50%', flexShrink: 0, marginTop: 2,
                        border: `2px solid ${p.completed ? 'var(--accent-green)' : 'var(--border-strong)'}`,
                        background: p.completed ? 'var(--accent-green)' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', transition: 'all 150ms',
                      }}
                    >
                      {p.completed && <CheckCircle2 size={11} color="white" />}
                    </button>
                    <span className="t-xs"
                      style={{ color: p.completed ? 'var(--text-tertiary)' : 'var(--text-primary)', textDecoration: p.completed ? 'line-through' : 'none', lineHeight: 1.5 }}>
                      {p.text}
                    </span>
                  </div>
                ))}
              </div>
              {priorities.length < 3 && (
                <div className="flex items-center gap-2" style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
                  <input value={newPriority} onChange={e => setNewPriority(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddPriority()}
                    placeholder="Add a priority..."
                    style={{ flex: 1, background: 'transparent', border: 'none', fontSize: 12, color: 'var(--text-primary)', fontFamily: 'var(--font-body)', outline: 'none' }} />
                  <button onClick={handleAddPriority} disabled={!newPriority.trim() || addingPriority}
                    style={{ color: 'var(--accent-blue)', background: 'none', border: 'none', cursor: 'pointer', opacity: !newPriority.trim() ? 0.3 : 1, display: 'flex' }}>
                    <Plus size={15} />
                  </button>
                </div>
              )}
              {priorities.length === 0 && (
                <p className="t-2xs text-tertiary" style={{ marginTop: 8, fontStyle: 'italic' }}>Set up to 3 priorities for today.</p>
              )}
            </div>

            {/* TIME BLOCKS */}
            <div className="card">
              <div className="flex items-center justify-between card-heading-gap">
                <p className="t-label">Time Blocks</p>
                <button onClick={() => setShowAddBlock(true)}
                  style={{ color: 'var(--accent-blue)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 2 }}>
                  <Plus size={15} />
                </button>
              </div>
              {timeBlocks.length === 0 ? (
                <p className="t-xs text-tertiary" style={{ fontStyle: 'italic' }}>No blocks scheduled.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {timeBlocks.map(block => {
                    const color = blockTypeColors[block.type] || 'var(--text-tertiary)';
                    const now = new Date();
                    const [startH] = block.start_time.split(':').map(Number);
                    const [endH] = block.end_time.split(':').map(Number);
                    const isCurrent = now.getHours() >= startH && now.getHours() < endH;
                    return (
                      <div key={block.id}
                        className="flex items-center gap-2.5 radius-sm interactive"
                        style={{ padding: '9px 10px', borderLeft: `3px solid ${color}`, background: isCurrent ? 'var(--bg-hover)' : 'transparent' }}
                        onMouseEnter={e => (e.currentTarget.querySelector('.del-btn') as HTMLElement | null)?.style.setProperty('opacity', '1')}
                        onMouseLeave={e => (e.currentTarget.querySelector('.del-btn') as HTMLElement | null)?.style.setProperty('opacity', '0')}>
                        <div className="flex-1 min-w-0">
                          <p className="t-xs-medium text-primary truncate">{block.label || block.type}</p>
                          <p className="t-mono-sm" style={{ marginTop: 2 }}>{formatTime(block.start_time)} — {formatTime(block.end_time)}</p>
                        </div>
                        {isCurrent && <span className="badge badge-green">Now</span>}
                        <button className="del-btn" onClick={() => handleDeleteBlock(block.id)}
                          style={{ color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', opacity: 0, transition: 'opacity 150ms' }}>
                          <X size={12} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        <AddTimeBlockModal open={showAddBlock} onClose={() => setShowAddBlock(false)} onAdd={handleAddTimeBlock} />
      </div>
    </PageTransition>
  );
}

function AddTimeBlockModal({ open, onClose, onAdd }: {
  open: boolean; onClose: () => void; onAdd: (type: string, start: string, end: string, label: string) => void;
}) {
  const [type, setType] = useState('deep');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('11:00');
  const [label, setLabel] = useState('');

  return (
    <Modal open={open} onClose={onClose} title="Add Time Block" size="sm">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Select label="Block Type" options={[
          { value: 'deep', label: 'Deep Work' }, { value: 'outreach', label: 'Outreach' },
          { value: 'admin', label: 'Admin' }, { value: 'personal', label: 'Personal' },
        ]} value={type} onChange={e => setType(e.target.value)} />
        <Input label="Label (Optional)" value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g., Client project sprint" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Input label="Start Time" type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
          <Input label="End Time" type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
        </div>
        <div className="flex gap-2.5 border-t-subtle" style={{ paddingTop: 16 }}>
          <Button variant="secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</Button>
          <Button onClick={() => { onAdd(type, startTime, endTime, label); onClose(); }} style={{ flex: 1 }}>Add Block</Button>
        </div>
      </div>
    </Modal>
  );
}

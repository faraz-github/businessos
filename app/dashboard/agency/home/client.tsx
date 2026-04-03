'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Sparkline } from '@/components/charts/Sparkline';
import { PageTransition } from '@/components/dashboard/PageTransition';
import { useBrand } from '@/lib/brand';
import { useCurrentUser } from '@/lib/auth/use-auth';
import { createClient } from '@/lib/supabase/client';
import { formatINR, formatCompactINR, formatTime } from '@/lib/utils';
import {
  AlertCircle, CheckCircle2, Info, Plus, X,
  IndianRupee, Users, Share2, Briefcase, Clock, Kanban, TrendingUp,
} from 'lucide-react';
import type { AttentionItem, Priority, TimeBlock } from '@/types';

interface AgencyHomeClientProps {
  attentionItems: AttentionItem[];
  stats: {
    money: { revenueThisMonth: number; outstandingTotal: number; overdueTotal: number; sparklineData: { value: number }[] };
    clients: { activeProjects: number; totalActive: number; pipelineLeads: number; totalAllTime: number };
    social: { postsThisMonth: number };
    work: { activeProjects: number; deliveredThisMonth: number };
  } | null;
  priorities: Priority[];
  timeBlocks: TimeBlock[];
  bdStats: { leadsThisWeek: number; movedForward: number };
}

const blockTypeColors: Record<string, string> = {
  deep: 'var(--accent-blue)', outreach: 'var(--accent-green)',
  admin: 'var(--accent-amber)', personal: 'var(--accent-violet)',
};

function stagger(index: number) {
  return {
    initial: { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0 },
    transition: { delay: index * 0.06, duration: 0.35, ease: [0, 0, 0.2, 1] },
  };
}

function MetricCard({ icon, iconColor, label, value, sub, children }: {
  icon: React.ReactNode; iconColor: string; label: string; value: string | number; sub?: string; children?: React.ReactNode;
}) {
  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 radius-sm flex items-center justify-center shrink-0"
          style={{ background: `${iconColor}20`, color: iconColor }}>
          {icon}
        </div>
        <span className="t-label">{label}</span>
      </div>
      <p className="t-metric">{value}</p>
      {sub && <p className="t-2xs mt-1">{sub}</p>}
      {children}
    </div>
  );
}

export function AgencyHomeClient({ attentionItems, stats, priorities, timeBlocks, bdStats }: AgencyHomeClientProps) {
  const { mode } = useBrand();
  const { user: currentUser } = useCurrentUser();
  const supabase = createClient();
  const [prios, setPrios] = useState(priorities);
  const [blocks, setBlocks] = useState(timeBlocks);
  const [newPriority, setNewPriority] = useState('');
  const [addingPriority, setAddingPriority] = useState(false);
  const [showAddBlock, setShowAddBlock] = useState(false);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';

  async function handleAddPriority() {
    if (!newPriority.trim() || prios.length >= 3 || !currentUser) return;
    setAddingPriority(true);
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase.from('priorities')
      .insert({ user_id: currentUser.id, mode, date: today, text: newPriority, sort_order: prios.length })
      .select().single();
    if (data) setPrios((prev) => [...prev, data as Priority]);
    setNewPriority('');
    setAddingPriority(false);
  }

  async function handleTogglePriority(id: string, completed: boolean) {
    await supabase.from('priorities').update({ completed: !completed }).eq('id', id);
    setPrios((prev) => prev.map((p) => p.id === id ? { ...p, completed: !completed } : p));
  }

  async function handleAddTimeBlock(type: string, startTime: string, endTime: string, label: string) {
    if (!currentUser) return;
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase.from('time_blocks')
      .insert({ user_id: currentUser.id, mode, date: today, type, start_time: startTime, end_time: endTime, label: label || null })
      .select().single();
    if (data) setBlocks((prev) => [...prev, data as TimeBlock].sort((a, b) => a.start_time.localeCompare(b.start_time)));
  }

  async function handleDeleteBlock(id: string) {
    await supabase.from('time_blocks').delete().eq('id', id);
    setBlocks((prev) => prev.filter((b) => b.id !== id));
  }

  return (
    <PageTransition>
      <div className="flex flex-col gap-9">
        {/* Agency header */}
        <div>
          <h1 className="t-display">Good {greeting}</h1>
          <p className="t-xs mt-1">Agency overview — here&apos;s what needs your attention.</p>
        </div>

        {/* BD Activity */}
        <div>
          <p className="t-label section-gap">BD Activity This Week</p>
          <div className="grid grid-cols-2 gap-4">
            <Card variant="metric">
              <div className="flex items-center gap-2 mb-2">
                <Kanban size={14} style={{ color: 'var(--accent-violet)' }} />
                <span className="t-label">New Leads</span>
              </div>
              <p className="t-metric">{bdStats.leadsThisWeek}</p>
            </Card>
            <Card variant="metric">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp size={14} style={{ color: 'var(--accent-green)' }} />
                <span className="t-label">Moved Forward</span>
              </div>
              <p className="t-metric">{bdStats.movedForward}</p>
            </Card>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 28 }}>
          {/* Left */}
          <div className="flex flex-col gap-6">
            {/* Attention Feed */}
            <div>
              <p className="t-label section-gap">Needs Attention</p>
              {attentionItems.length === 0 ? (
                <div className="card" style={{ padding: "40px 24px", textAlign: "center" }}>
                  <div className="w-11 h-11 rounded-full bg-accent-green-dim flex items-center justify-center mx-auto mb-3"
                    style={{ color: 'var(--accent-green)' }}>
                    <CheckCircle2 size={20} />
                  </div>
                  <p className="t-sm-semibold">All clear</p>
                  <p className="t-xs mt-1">Nothing needs your attention right now.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {attentionItems.map((item, i) => {
                    const cfgs = {
                      critical: { color: 'var(--accent-red)', bg: 'var(--accent-red-dim)', icon: <AlertCircle size={13} /> },
                      important: { color: 'var(--accent-amber)', bg: 'var(--accent-amber-dim)', icon: <Clock size={13} /> },
                      info: { color: 'var(--accent-blue)', bg: 'var(--accent-blue-dim)', icon: <Info size={13} /> },
                    };
                    const cfg = cfgs[item.severity];
                    return (
                      <motion.div key={item.id} {...stagger(i)}>
                        <Link href={item.link} style={{ textDecoration: 'none' }}>
                          <div className="card flex items-start gap-3 cursor-pointer interactive hover-bg-hover" style={{ padding: "14px 18px" }}>
                            <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                              style={{ background: cfg.bg, color: cfg.color }}>{cfg.icon}</div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="t-sm-medium">{item.title}</span>
                                <span className="badge" style={{ background: cfg.bg, color: cfg.color }}>{item.severity}</span>
                              </div>
                              <p className="t-xs text-secondary truncate mt-0.5">{item.description}</p>
                            </div>
                          </div>
                        </Link>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Stats */}
            <div>
              <p className="t-label section-gap">Business Health</p>
              <div className="grid grid-cols-2 gap-4">
                <MetricCard icon={<IndianRupee size={14} />} iconColor="var(--accent-green)" label="Money"
                  value={formatINR(stats?.money?.revenueThisMonth || 0)} sub="Revenue this month">
                  <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t-subtle">
                    <div><p className="t-label sub-label-gap">Outstanding</p><p className="t-xs-medium" style={{ color: 'var(--accent-amber)' }}>{formatCompactINR(stats?.money?.outstandingTotal || 0)}</p></div>
                    <div><p className="t-label sub-label-gap">Overdue</p><p className="t-xs-medium" style={{ color: 'var(--accent-red)' }}>{formatCompactINR(stats?.money?.overdueTotal || 0)}</p></div>
                  </div>
                  {stats?.money?.sparklineData && <div className="mt-2"><Sparkline data={stats.money.sparklineData} color="var(--accent-green)" height={36} /></div>}
                </MetricCard>
                <MetricCard icon={<Users size={14} />} iconColor="var(--accent-blue)" label="Clients"
                  value={stats?.clients?.totalActive || 0} sub="Active clients">
                  <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t-subtle">
                    <div><p className="t-label sub-label-gap">Pipeline</p><p className="t-sm-semibold">{stats?.clients?.pipelineLeads || 0}</p></div>
                    <div><p className="t-label sub-label-gap">All time</p><p className="t-sm-semibold">{stats?.clients?.totalAllTime || 0}</p></div>
                  </div>
                </MetricCard>
                <MetricCard icon={<Share2 size={14} />} iconColor="var(--accent-violet)" label="Brand" value={stats?.social?.postsThisMonth || 0} sub="Posts this month" />
                <MetricCard icon={<Briefcase size={14} />} iconColor="var(--accent-amber)" label="Work" value={stats?.work?.activeProjects || 0} sub="Active projects" />
              </div>
            </div>
          </div>

          {/* Right — Focus */}
          <div className="flex flex-col gap-5">
            {/* Priorities — paddingTop matches left col label+gap offset */}
            <div className="card">
              <p className="t-label section-gap">Top 3 Priorities</p>
              <div className="flex flex-col gap-3">
                {prios.slice(0, 3).map((p) => (
                  <div key={p.id} className="flex items-start gap-2.5">
                    <button onClick={() => handleTogglePriority(p.id, p.completed)} style={{
                      width: 18, height: 18, borderRadius: '50%', flexShrink: 0, marginTop: 2,
                      border: `2px solid ${p.completed ? 'var(--accent-green)' : 'var(--border-strong)'}`,
                      background: p.completed ? 'var(--accent-green)' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', transition: 'all 150ms',
                    }}>
                      {p.completed && <CheckCircle2 size={11} color="white" />}
                    </button>
                    <span className="t-xs" style={{ color: p.completed ? 'var(--text-tertiary)' : 'var(--text-primary)', textDecoration: p.completed ? 'line-through' : 'none', lineHeight: 1.5 }}>
                      {p.text}
                    </span>
                  </div>
                ))}
              </div>
              {prios.length < 3 && (
                <div className="flex items-center gap-2 mt-3">
                  <input value={newPriority} onChange={(e) => setNewPriority(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddPriority()}
                    placeholder="Add a priority..." style={{
                      flex: 1, background: 'transparent', border: 'none',
                      borderBottom: '1px solid var(--border-subtle)', fontSize: 12,
                      color: 'var(--text-primary)', fontFamily: 'var(--font-body)', outline: 'none', paddingBottom: 4,
                    }} />
                  <button onClick={handleAddPriority} disabled={!newPriority.trim() || addingPriority}
                    style={{ color: 'var(--accent-blue)', background: 'none', border: 'none', cursor: 'pointer', opacity: !newPriority.trim() ? 0.3 : 1, display: 'flex' }}>
                    <Plus size={14} />
                  </button>
                </div>
              )}
              {prios.length === 0 && <p className="t-2xs text-tertiary mt-1" style={{ fontStyle: 'italic' }}>Set up to 3 priorities for today.</p>}
            </div>

            {/* Time Blocks */}
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <p className="t-label">Time Blocks</p>
                <button onClick={() => setShowAddBlock(true)} style={{ color: 'var(--accent-blue)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}>
                  <Plus size={14} />
                </button>
              </div>
              {blocks.length === 0 ? (
                <p className="t-xs text-tertiary" style={{ fontStyle: 'italic' }}>No blocks scheduled.</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {blocks.map((block) => {
                    const color = blockTypeColors[block.type] || 'var(--text-tertiary)';
                    const now = new Date();
                    const [startH] = block.start_time.split(':').map(Number);
                    const [endH] = block.end_time.split(':').map(Number);
                    const isCurrent = now.getHours() >= startH && now.getHours() < endH;
                    return (
                      <div key={block.id} className="flex items-center gap-2.5 px-2.5 py-2 radius-sm interactive"
                        style={{ borderLeft: `3px solid ${color}`, background: isCurrent ? 'var(--bg-hover)' : 'transparent' }}
                        onMouseEnter={(e) => (e.currentTarget.querySelector('.del-btn') as HTMLElement | null)?.style.setProperty('opacity','1')}
                        onMouseLeave={(e) => (e.currentTarget.querySelector('.del-btn') as HTMLElement | null)?.style.setProperty('opacity','0')}>
                        <div className="flex-1 min-w-0">
                          <p className="t-xs-medium text-primary truncate">{block.label || block.type}</p>
                          <p className="t-mono-sm">{formatTime(block.start_time)} — {formatTime(block.end_time)}</p>
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

        {/* Add Time Block Modal */}
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
      <div className="flex flex-col gap-5">
        <Select label="Block Type" options={[
          { value: 'deep', label: 'Deep Work' }, { value: 'outreach', label: 'Outreach' },
          { value: 'admin', label: 'Admin' }, { value: 'personal', label: 'Personal' },
        ]} value={type} onChange={(e) => setType(e.target.value)} />
        <Input label="Label (Optional)" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g., Client project sprint" />
        <div className="grid grid-cols-2 gap-4">
          <Input label="Start Time" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          <Input label="End Time" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
        </div>
        <div className="flex gap-2 pt-2 border-t-subtle">
          <Button variant="secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</Button>
          <Button onClick={() => { onAdd(type, startTime, endTime, label); onClose(); }} style={{ flex: 1 }}>Add Block</Button>
        </div>
      </div>
    </Modal>
  );
}

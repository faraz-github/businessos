'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Progress } from '@/components/ui/Progress';
import { EmptyState } from '@/components/ui/EmptyState';
import { Sparkline } from '@/components/charts/Sparkline';
import { PageTransition } from '@/components/dashboard/PageTransition';
import { createClient } from '@/lib/supabase/client';
import { useBrand } from '@/lib/brand';
import { formatINR, formatCompactINR, formatTime, cn } from '@/lib/utils';
import {
  AlertCircle, CheckCircle2, Info, Plus, Circle, X,
  IndianRupee, Users, Share2, Briefcase, Clock,
} from 'lucide-react';
import type { AttentionItem, Priority, TimeBlock } from '@/types';

interface PersonalHomeClientProps {
  attentionItems: AttentionItem[];
  stats: any;
  priorities: Priority[];
  timeBlocks: TimeBlock[];
}

const severityConfig = {
  critical: { icon: <AlertCircle size={14} />, badge: 'red' as const, bg: 'var(--accent-red-dim)' },
  important: { icon: <Clock size={14} />, badge: 'amber' as const, bg: 'var(--accent-amber-dim)' },
  info: { icon: <Info size={14} />, badge: 'blue' as const, bg: 'var(--accent-blue-dim)' },
};

const blockTypeColors: Record<string, string> = {
  deep: 'var(--accent-blue)',
  outreach: 'var(--accent-green)',
  admin: 'var(--accent-amber)',
  personal: 'var(--accent-violet)',
};

function stagger(index: number) {
  return { initial: { opacity: 0, y: 6 }, animate: { opacity: 1, y: 0 }, transition: { delay: index * 0.06, duration: 0.35 } };
}

export function PersonalHomeClient({ attentionItems, stats, priorities: initialPriorities, timeBlocks: initialTimeBlocks }: PersonalHomeClientProps) {
  const { mode } = useBrand();
  const supabase = createClient();
  const [priorities, setPriorities] = useState(initialPriorities);
  const [timeBlocks, setTimeBlocks] = useState(initialTimeBlocks);
  const [newPriority, setNewPriority] = useState('');
  const [addingPriority, setAddingPriority] = useState(false);
  const [showAddBlock, setShowAddBlock] = useState(false);

  async function handleAddPriority() {
    if (!newPriority.trim() || priorities.length >= 3) return;
    setAddingPriority(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase.from('priorities')
      .insert({ user_id: user.id, mode, date: today, text: newPriority, sort_order: priorities.length })
      .select().single();
    if (data) setPriorities((prev) => [...prev, data as Priority]);
    setNewPriority('');
    setAddingPriority(false);
  }

  async function handleTogglePriority(id: string, completed: boolean) {
    await supabase.from('priorities').update({ completed: !completed }).eq('id', id);
    setPriorities((prev) => prev.map((p) => p.id === id ? { ...p, completed: !completed } : p));
  }

  async function handleAddTimeBlock(type: string, startTime: string, endTime: string, label: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase.from('time_blocks')
      .insert({ user_id: user.id, mode, date: today, type, start_time: startTime, end_time: endTime, label: label || null })
      .select().single();
    if (data) setTimeBlocks((prev) => [...prev, data as TimeBlock].sort((a, b) => a.start_time.localeCompare(b.start_time)));
    setShowAddBlock(false);
  }

  async function handleDeleteBlock(id: string) {
    await supabase.from('time_blocks').delete().eq('id', id);
    setTimeBlocks((prev) => prev.filter((b) => b.id !== id));
  }
  return (
    <PageTransition>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-extrabold tracking-tight text-[var(--text-primary)]">
            Good {getGreeting()}
          </h1>
          <p className="text-[13px] text-[var(--text-secondary)] mt-1">
            Here&apos;s what needs your attention today.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {/* ─── ZONE 1: Attention Feed ─── */}
          <div className="col-span-2 space-y-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
              Needs Attention
            </h2>
            {attentionItems.length === 0 ? (
              <Card variant="base">
                <EmptyState
                  icon={<CheckCircle2 />}
                  title="All clear"
                  description="Nothing needs your attention right now. Nice work."
                  className="py-8"
                />
              </Card>
            ) : (
              <div className="space-y-2">
                {attentionItems.map((item, i) => {
                  const config = severityConfig[item.severity];
                  return (
                    <motion.div key={item.id} {...stagger(i)}>
                      <Link href={item.link} className="no-underline">
                        <Card variant="base" className="flex items-start gap-3 hover:bg-[var(--bg-hover)] transition-colors cursor-pointer group">
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                            style={{ background: config.bg }}
                          >
                            <span className={`text-[var(--accent-${item.severity === 'critical' ? 'red' : item.severity === 'important' ? 'amber' : 'blue'})]`}>
                              {config.icon}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[13px] font-medium text-[var(--text-primary)] group-hover:text-[var(--accent-blue)] transition-colors">
                                {item.title}
                              </span>
                              <Badge variant={config.badge} className="text-[9px]">
                                {item.severity}
                              </Badge>
                            </div>
                            <p className="text-[12px] text-[var(--text-secondary)] mt-0.5 truncate">
                              {item.description}
                            </p>
                          </div>
                        </Card>
                      </Link>
                    </motion.div>
                  );
                })}
              </div>
            )}

            {/* ─── ZONE 3: Stats Grid ─── */}
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-tertiary)] mt-6">
              Business Health
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {/* Money */}
              <Card variant="metric">
                <div className="flex items-center gap-2 mb-3">
                  <IndianRupee size={14} className="text-[var(--accent-green)]" />
                  <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-tertiary)]">Money</span>
                </div>
                <p className="font-[family-name:var(--font-display)] text-2xl font-extrabold tracking-tight">
                  {formatINR(stats?.money?.revenueThisMonth || 0)}
                </p>
                <p className="text-[11px] text-[var(--text-secondary)] mt-1">Revenue this month</p>
                <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-[var(--border-subtle)]">
                  <div>
                    <p className="text-[11px] text-[var(--text-tertiary)]">Outstanding</p>
                    <p className="text-sm font-semibold text-[var(--accent-amber)]">
                      {formatCompactINR(stats?.money?.outstandingTotal || 0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-[var(--text-tertiary)]">Overdue</p>
                    <p className="text-sm font-semibold text-[var(--accent-red)]">
                      {formatCompactINR(stats?.money?.overdueTotal || 0)}
                    </p>
                  </div>
                </div>
                {stats?.money?.sparklineData && (
                  <div className="mt-3">
                    <Sparkline data={stats.money.sparklineData} color="var(--accent-green)" height={36} />
                  </div>
                )}
              </Card>

              {/* Clients */}
              <Card variant="metric">
                <div className="flex items-center gap-2 mb-3">
                  <Users size={14} className="text-[var(--accent-blue)]" />
                  <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-tertiary)]">Clients</span>
                </div>
                <p className="font-[family-name:var(--font-display)] text-2xl font-extrabold tracking-tight">
                  {stats?.clients?.totalActive || 0}
                </p>
                <p className="text-[11px] text-[var(--text-secondary)] mt-1">Active clients</p>
                <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-[var(--border-subtle)]">
                  <div>
                    <p className="text-[11px] text-[var(--text-tertiary)]">Pipeline</p>
                    <p className="text-sm font-semibold">{stats?.clients?.pipelineLeads || 0}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-[var(--text-tertiary)]">All time</p>
                    <p className="text-sm font-semibold">{stats?.clients?.totalAllTime || 0}</p>
                  </div>
                </div>
              </Card>

              {/* Social */}
              <Card variant="metric">
                <div className="flex items-center gap-2 mb-3">
                  <Share2 size={14} className="text-[var(--accent-violet)]" />
                  <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-tertiary)]">Brand</span>
                </div>
                <p className="font-[family-name:var(--font-display)] text-2xl font-extrabold tracking-tight">
                  {stats?.social?.postsThisMonth || 0}
                </p>
                <p className="text-[11px] text-[var(--text-secondary)] mt-1">Posts this month</p>
              </Card>

              {/* Work */}
              <Card variant="metric">
                <div className="flex items-center gap-2 mb-3">
                  <Briefcase size={14} className="text-[var(--accent-amber)]" />
                  <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-tertiary)]">Work</span>
                </div>
                <p className="font-[family-name:var(--font-display)] text-2xl font-extrabold tracking-tight">
                  {stats?.work?.activeProjects || 0}
                </p>
                <p className="text-[11px] text-[var(--text-secondary)] mt-1">Active projects</p>
              </Card>
            </div>
          </div>

          {/* ─── ZONE 2: Today's Focus ─── */}
          <div className="space-y-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
              Today&apos;s Focus
            </h2>

            {/* Priorities */}
            <Card variant="base">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
                  Top 3 Priorities
                </p>
              </div>
              <div className="space-y-2">
                {priorities.slice(0, 3).map((p) => (
                  <div key={p.id} className="flex items-start gap-2">
                    <button
                      onClick={() => handleTogglePriority(p.id, p.completed)}
                      className={cn(
                        'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 cursor-pointer transition-colors',
                        p.completed
                          ? 'bg-[var(--accent-green)] border-[var(--accent-green)]'
                          : 'border-[var(--border-strong)] hover:border-[var(--accent-blue)]',
                      )}
                    >
                      {p.completed && <CheckCircle2 size={12} className="text-white" />}
                    </button>
                    <span className={cn(
                      'text-[13px]',
                      p.completed ? 'line-through text-[var(--text-tertiary)]' : 'text-[var(--text-primary)]',
                    )}>
                      {p.text}
                    </span>
                  </div>
                ))}
              </div>
              {priorities.length < 3 && (
                <div className="flex items-center gap-2 mt-3">
                  <input
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddPriority()}
                    placeholder="Add a priority..."
                    className="flex-1 bg-transparent border-b border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none py-1 focus:border-[var(--accent-blue)]"
                  />
                  <button
                    onClick={handleAddPriority}
                    disabled={!newPriority.trim() || addingPriority}
                    className="text-[var(--accent-blue)] disabled:opacity-30"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              )}
              {priorities.length === 0 && (
                <p className="text-[12px] text-[var(--text-tertiary)] italic mt-1">Set up to 3 priorities for today.</p>
              )}
            </Card>

            {/* Time Blocks */}
            <Card variant="base">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
                  Time Blocks
                </p>
                <button onClick={() => setShowAddBlock(true)} className="text-[var(--accent-blue)]"><Plus size={14} /></button>
              </div>
              {timeBlocks.length === 0 ? (
                <p className="text-[12px] text-[var(--text-tertiary)] italic">No blocks scheduled.</p>
              ) : (
                <div className="space-y-1.5">
                  {timeBlocks.map((block) => {
                    const color = blockTypeColors[block.type] || 'var(--text-tertiary)';
                    const now = new Date();
                    const [startH] = block.start_time.split(':').map(Number);
                    const [endH] = block.end_time.split(':').map(Number);
                    const isCurrent = now.getHours() >= startH && now.getHours() < endH;

                    return (
                      <div
                        key={block.id}
                        className={cn(
                          'flex items-center gap-2.5 px-2.5 py-2 rounded-[var(--radius-sm)] border-l-[3px] transition-colors group',
                          isCurrent ? 'bg-[var(--bg-hover)]' : '',
                        )}
                        style={{ borderLeftColor: color }}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-medium text-[var(--text-primary)] truncate">
                            {block.label || block.type}
                          </p>
                          <p className="text-[10px] text-[var(--text-tertiary)] font-[family-name:var(--font-mono)]">
                            {formatTime(block.start_time)} — {formatTime(block.end_time)}
                          </p>
                        </div>
                        {isCurrent && (
                          <Badge variant="green" dot className="text-[9px]">Now</Badge>
                        )}
                        <button
                          onClick={() => handleDeleteBlock(block.id)}
                          className="opacity-0 group-hover:opacity-100 text-[var(--text-tertiary)] hover:text-[var(--accent-red)] transition-all"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            {/* Add Time Block Modal */}
            <AddTimeBlockModal
              open={showAddBlock}
              onClose={() => setShowAddBlock(false)}
              onAdd={handleAddTimeBlock}
            />
          </div>
        </div>
      </div>
    </PageTransition>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

function AddTimeBlockModal({ open, onClose, onAdd }: {
  open: boolean; onClose: () => void;
  onAdd: (type: string, start: string, end: string, label: string) => void;
}) {
  const [type, setType] = useState('deep');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('11:00');
  const [label, setLabel] = useState('');

  return (
    <Modal open={open} onClose={onClose} title="Add Time Block" size="sm">
      <div className="space-y-4">
        <Select
          label="Block Type"
          options={[
            { value: 'deep', label: 'Deep Work' },
            { value: 'outreach', label: 'Outreach' },
            { value: 'admin', label: 'Admin' },
            { value: 'personal', label: 'Personal' },
          ]}
          value={type}
          onChange={(e) => setType(e.target.value)}
        />
        <Input label="Label (Optional)" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g., Client project sprint" />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Start Time" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          <Input label="End Time" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
        </div>
        <div className="flex gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} className="flex-1">Cancel</Button>
          <Button onClick={() => onAdd(type, startTime, endTime, label)} className="flex-1">Add Block</Button>
        </div>
      </div>
    </Modal>
  );
}

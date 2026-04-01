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
import { formatINR, formatCompactINR, formatTime, cn } from '@/lib/utils';
import {
  AlertCircle, CheckCircle2, Info, Plus, X,
  IndianRupee, Users, Share2, Briefcase, Clock,
} from 'lucide-react';
import type { AttentionItem, Priority, TimeBlock } from '@/types';

interface HomeStats {
  money: {
    revenueThisMonth: number;
    outstandingTotal: number;
    overdueTotal: number;
    sparklineData: { value: number }[];
  };
  clients: {
    activeProjects: number;
    totalActive: number;
    pipelineLeads: number;
    totalAllTime: number;
  };
  social: { postsThisMonth: number };
  work: { activeProjects: number; deliveredThisMonth: number };
}

interface PersonalHomeClientProps {
  attentionItems: AttentionItem[];
  stats: HomeStats | null;
  priorities: Priority[];
  timeBlocks: TimeBlock[];
}

const blockTypeColors: Record<string, string> = {
  deep: 'var(--accent-blue)',
  outreach: 'var(--accent-green)',
  admin: 'var(--accent-amber)',
  personal: 'var(--accent-violet)',
};

function stagger(index: number) {
  return {
    initial: { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0 },
    transition: { delay: index * 0.06, duration: 0.35, ease: [0, 0, 0.2, 1] },
  };
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      fontSize: 10,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      color: 'var(--text-tertiary)',
      fontFamily: 'var(--font-body)',
      marginBottom: 10,
    }}>
      {children}
    </p>
  );
}

function MetricCard({
  icon, iconColor, label, value, sub, children,
}: {
  icon: React.ReactNode;
  iconColor: string;
  label: string;
  value: string | number;
  sub?: string;
  children?: React.ReactNode;
}) {
  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-lg)',
      padding: '16px 20px',
      boxShadow: 'var(--shadow-card)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8,
          background: `${iconColor}20`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: iconColor,
        }}>
          {icon}
        </div>
        <span style={{
          fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.08em', color: 'var(--text-tertiary)',
          fontFamily: 'var(--font-body)',
        }}>
          {label}
        </span>
      </div>
      <p style={{
        fontFamily: 'var(--font-display)',
        fontSize: 28,
        fontWeight: 800,
        letterSpacing: '-0.5px',
        lineHeight: 1,
        color: 'var(--text-primary)',
      }}>
        {value}
      </p>
      {sub && (
        <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4, fontFamily: 'var(--font-body)' }}>
          {sub}
        </p>
      )}
      {children}
    </div>
  );
}

function AttentionCard({ item, index }: { item: AttentionItem; index: number }) {
  const configs = {
    critical: { color: 'var(--accent-red)', bg: 'var(--accent-red-dim)', icon: <AlertCircle size={13} /> },
    important: { color: 'var(--accent-amber)', bg: 'var(--accent-amber-dim)', icon: <Clock size={13} /> },
    info: { color: 'var(--accent-blue)', bg: 'var(--accent-blue-dim)', icon: <Info size={13} /> },
  };
  const cfg = configs[item.severity];

  return (
    <motion.div key={item.id} {...stagger(index)}>
      <Link href={item.link} style={{ textDecoration: 'none' }}>
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 14px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
            cursor: 'pointer',
            transition: 'background 150ms, border-color 150ms',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)';
            (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'var(--bg-card)';
            (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)';
          }}
        >
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            background: cfg.bg,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: cfg.color, flexShrink: 0, marginTop: 1,
          }}>
            {cfg.icon}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'var(--font-body)' }}>
                {item.title}
              </span>
              <span style={{
                fontSize: 9, fontWeight: 600, textTransform: 'uppercase',
                letterSpacing: '0.06em', padding: '2px 7px',
                borderRadius: 100, background: cfg.bg, color: cfg.color,
              }}>
                {item.severity}
              </span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2, fontFamily: 'var(--font-body)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item.description}
            </p>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

export function PersonalHomeClient({
  attentionItems,
  stats,
  priorities: initialPriorities,
  timeBlocks: initialTimeBlocks,
}: PersonalHomeClientProps) {
  const { mode } = useBrand();
  const { user: currentUser } = useCurrentUser();
  const supabase = createClient();
  const [priorities, setPriorities] = useState(initialPriorities);
  const [timeBlocks, setTimeBlocks] = useState(initialTimeBlocks);
  const [newPriority, setNewPriority] = useState('');
  const [addingPriority, setAddingPriority] = useState(false);
  const [showAddBlock, setShowAddBlock] = useState(false);

  async function handleAddPriority() {
    if (!newPriority.trim() || priorities.length >= 3) return;
    setAddingPriority(true);
    if (!currentUser) return;
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase.from('priorities')
      .insert({ user_id: currentUser.id, mode, date: today, text: newPriority, sort_order: priorities.length })
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
    if (!currentUser) return;
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase.from('time_blocks')
      .insert({ user_id: currentUser.id, mode, date: today, type, start_time: startTime, end_time: endTime, label: label || null })
      .select().single();
    if (data) setTimeBlocks((prev) => [...prev, data as TimeBlock].sort((a, b) => a.start_time.localeCompare(b.start_time)));
    setShowAddBlock(false);
  }

  async function handleDeleteBlock(id: string) {
    await supabase.from('time_blocks').delete().eq('id', id);
    setTimeBlocks((prev) => prev.filter((b) => b.id !== id));
  }

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';

  return (
    <PageTransition>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* Header */}
        <div>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 26,
            fontWeight: 800,
            letterSpacing: '-0.5px',
            color: 'var(--text-primary)',
            lineHeight: 1.1,
          }}>
            Good {greeting}
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6, fontFamily: 'var(--font-body)' }}>
            Here&apos;s what needs your attention today.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 20 }}>

          {/* LEFT COLUMN */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Attention Feed */}
            <div>
              <SectionLabel>Needs Attention</SectionLabel>
              {attentionItems.length === 0 ? (
                <div style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '32px 20px',
                  textAlign: 'center',
                }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: '50%',
                    background: 'var(--accent-green-dim)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 12px',
                    color: 'var(--accent-green)',
                  }}>
                    <CheckCircle2 size={20} />
                  </div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-body)' }}>All clear</p>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, fontFamily: 'var(--font-body)' }}>
                    Nothing needs your attention right now. Nice work.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {attentionItems.map((item, i) => (
                    <AttentionCard key={item.id} item={item} index={i} />
                  ))}
                </div>
              )}
            </div>

            {/* Stats Grid */}
            <div>
              <SectionLabel>Business Health</SectionLabel>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

                {/* Money */}
                <MetricCard
                  icon={<IndianRupee size={14} />}
                  iconColor="var(--accent-green)"
                  label="Money"
                  value={formatINR(stats?.money?.revenueThisMonth || 0)}
                  sub="Revenue this month"
                >
                  <div style={{
                    display: 'grid', gridTemplateColumns: '1fr 1fr',
                    gap: 12, marginTop: 12, paddingTop: 12,
                    borderTop: '1px solid var(--border-subtle)',
                  }}>
                    <div>
                      <p style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-body)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Outstanding</p>
                      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-amber)', fontFamily: 'var(--font-body)' }}>
                        {formatCompactINR(stats?.money?.outstandingTotal || 0)}
                      </p>
                    </div>
                    <div>
                      <p style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-body)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Overdue</p>
                      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-red)', fontFamily: 'var(--font-body)' }}>
                        {formatCompactINR(stats?.money?.overdueTotal || 0)}
                      </p>
                    </div>
                  </div>
                  {stats?.money?.sparklineData && (
                    <div style={{ marginTop: 10 }}>
                      <Sparkline data={stats.money.sparklineData} color="var(--accent-green)" height={36} />
                    </div>
                  )}
                </MetricCard>

                {/* Clients */}
                <MetricCard
                  icon={<Users size={14} />}
                  iconColor="var(--accent-blue)"
                  label="Clients"
                  value={stats?.clients?.totalActive || 0}
                  sub="Active clients"
                >
                  <div style={{
                    display: 'grid', gridTemplateColumns: '1fr 1fr',
                    gap: 12, marginTop: 12, paddingTop: 12,
                    borderTop: '1px solid var(--border-subtle)',
                  }}>
                    <div>
                      <p style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-body)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Pipeline</p>
                      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-body)' }}>
                        {stats?.clients?.pipelineLeads || 0}
                      </p>
                    </div>
                    <div>
                      <p style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-body)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>All time</p>
                      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-body)' }}>
                        {stats?.clients?.totalAllTime || 0}
                      </p>
                    </div>
                  </div>
                </MetricCard>

                {/* Brand */}
                <MetricCard
                  icon={<Share2 size={14} />}
                  iconColor="var(--accent-violet)"
                  label="Brand"
                  value={stats?.social?.postsThisMonth || 0}
                  sub="Posts this month"
                />

                {/* Work */}
                <MetricCard
                  icon={<Briefcase size={14} />}
                  iconColor="var(--accent-amber)"
                  label="Work"
                  value={stats?.work?.activeProjects || 0}
                  sub="Active projects"
                />
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN — Today's Focus */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <SectionLabel>Today&apos;s Focus</SectionLabel>

            {/* Priorities */}
            <div style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-lg)',
              padding: '16px',
              boxShadow: 'var(--shadow-card)',
            }}>
              <p style={{
                fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.08em', color: 'var(--text-tertiary)',
                fontFamily: 'var(--font-body)', marginBottom: 12,
              }}>
                Top 3 Priorities
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {priorities.slice(0, 3).map((p) => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <button
                      onClick={() => handleTogglePriority(p.id, p.completed)}
                      style={{
                        width: 18, height: 18, borderRadius: '50%',
                        border: `2px solid ${p.completed ? 'var(--accent-green)' : 'var(--border-strong)'}`,
                        background: p.completed ? 'var(--accent-green)' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', flexShrink: 0, marginTop: 2,
                        transition: 'all 150ms',
                      }}
                    >
                      {p.completed && <CheckCircle2 size={11} color="white" />}
                    </button>
                    <span style={{
                      fontSize: 13, fontFamily: 'var(--font-body)',
                      color: p.completed ? 'var(--text-tertiary)' : 'var(--text-primary)',
                      textDecoration: p.completed ? 'line-through' : 'none',
                      lineHeight: 1.4,
                    }}>
                      {p.text}
                    </span>
                  </div>
                ))}
              </div>
              {priorities.length < 3 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
                  <input
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddPriority()}
                    placeholder="Add a priority..."
                    style={{
                      flex: 1,
                      background: 'transparent',
                      border: 'none',
                      borderBottom: '1px solid var(--border-subtle)',
                      fontSize: 12,
                      color: 'var(--text-primary)',
                      fontFamily: 'var(--font-body)',
                      outline: 'none',
                      paddingBottom: 4,
                    }}
                  />
                  <button
                    onClick={handleAddPriority}
                    disabled={!newPriority.trim() || addingPriority}
                    style={{
                      color: 'var(--accent-blue)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      opacity: !newPriority.trim() ? 0.3 : 1,
                      display: 'flex', alignItems: 'center',
                    }}
                  >
                    <Plus size={14} />
                  </button>
                </div>
              )}
              {priorities.length === 0 && (
                <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4, fontFamily: 'var(--font-body)', fontStyle: 'italic' }}>
                  Set up to 3 priorities for today.
                </p>
              )}
            </div>

            {/* Time Blocks */}
            <div style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-lg)',
              padding: '16px',
              boxShadow: 'var(--shadow-card)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <p style={{
                  fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: '0.08em', color: 'var(--text-tertiary)',
                  fontFamily: 'var(--font-body)',
                }}>
                  Time Blocks
                </p>
                <button
                  onClick={() => setShowAddBlock(true)}
                  style={{ color: 'var(--accent-blue)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}
                >
                  <Plus size={14} />
                </button>
              </div>
              {timeBlocks.length === 0 ? (
                <p style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'var(--font-body)', fontStyle: 'italic' }}>
                  No blocks scheduled.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {timeBlocks.map((block) => {
                    const color = blockTypeColors[block.type] || 'var(--text-tertiary)';
                    const now = new Date();
                    const [startH] = block.start_time.split(':').map(Number);
                    const [endH] = block.end_time.split(':').map(Number);
                    const isCurrent = now.getHours() >= startH && now.getHours() < endH;
                    return (
                      <div
                        key={block.id}
                        className="group"
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '8px 10px',
                          borderRadius: 'var(--radius-sm)',
                          borderLeft: `3px solid ${color}`,
                          background: isCurrent ? 'var(--bg-hover)' : 'transparent',
                          transition: 'background 150ms',
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'var(--font-body)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {block.label || block.type}
                          </p>
                          <p style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                            {formatTime(block.start_time)} — {formatTime(block.end_time)}
                          </p>
                        </div>
                        {isCurrent && (
                          <span style={{
                            fontSize: 9, fontWeight: 600, padding: '2px 6px',
                            borderRadius: 100, background: 'var(--accent-green-dim)',
                            color: 'var(--accent-green)', textTransform: 'uppercase', letterSpacing: '0.06em',
                          }}>
                            Now
                          </span>
                        )}
                        <button
                          onClick={() => handleDeleteBlock(block.id)}
                          style={{
                            color: 'var(--text-tertiary)', background: 'none', border: 'none',
                            cursor: 'pointer', display: 'flex', opacity: 0,
                            transition: 'opacity 150ms',
                          }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1'; (e.currentTarget as HTMLElement).style.color = 'var(--accent-red)'; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0'; (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; }}
                        >
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
        <AddTimeBlockModal
          open={showAddBlock}
          onClose={() => setShowAddBlock(false)}
          onAdd={handleAddTimeBlock}
        />
      </div>
    </PageTransition>
  );
}

function AddTimeBlockModal({ open, onClose, onAdd }: {
  open: boolean;
  onClose: () => void;
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
          <Button onClick={() => { onAdd(type, startTime, endTime, label); onClose(); }} className="flex-1">Add Block</Button>
        </div>
      </div>
    </Modal>
  );
}

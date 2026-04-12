'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Sparkline } from '@/components/charts/Sparkline';
import { PageTransition } from '@/components/dashboard/PageTransition';
import { useBrand } from '@/lib/brand';
import { useCurrentUser } from '@/lib/auth/use-auth';
import { createClient } from '@/lib/supabase/client';
import { formatINR, formatCompactINR, formatTime, formatRelative } from '@/lib/utils';
import {
  AlertCircle, CheckCircle2, Info, Plus, X,
  IndianRupee, Users, Share2, Briefcase, Clock,
  Kanban, TrendingUp,
} from 'lucide-react';
import type { AttentionItem, Priority, TimeBlock } from '@/types';

interface RecentLog { id: string; content: string; created_at: string; }

interface AgencyHomeClientProps {
  attentionItems: AttentionItem[];
  recentLogs: RecentLog[];
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

const BLOCK_COLORS: Record<string, string> = {
  deep: 'var(--accent-blue)', outreach: 'var(--accent-green)',
  admin: 'var(--accent-amber)', personal: 'var(--accent-violet)',
};

function stagger(index: number) {
  return {
    initial: { opacity: 0, y: 6 }, animate: { opacity: 1, y: 0 },
    transition: { delay: index * 0.06, duration: 0.35, ease: [0, 0, 0.2, 1] as any },
  };
}

// ── Attention card ─────────────────────────────────────────────
function AttentionCard({ item, index }: { item: AttentionItem; index: number }) {
  const cfgs = {
    critical:  { color: 'var(--accent-red)',   bg: 'var(--accent-red-dim)',   icon: <AlertCircle size={14} /> },
    important: { color: 'var(--accent-amber)', bg: 'var(--accent-amber-dim)', icon: <Clock size={14} /> },
    info:      { color: 'var(--accent-blue)',  bg: 'var(--accent-blue-dim)',  icon: <Info size={14} /> },
  };
  const cfg = cfgs[item.severity];
  return (
    <motion.div {...stagger(index)}>
      <Link href={item.link} style={{ textDecoration: 'none', display: 'block' }}>
        <div className="card"
          style={{ padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer', transition: 'background 150ms' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; }}>
          <div style={{ width: 30, height: 30, borderRadius: '50%', background: cfg.bg, color: cfg.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
            {cfg.icon}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
              <span className="t-sm-semibold">{item.title}</span>
              <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 100, background: cfg.bg, color: cfg.color, textTransform: 'capitalize' }}>{item.severity}</span>
            </div>
            <p className="t-xs text-secondary" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.description}</p>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

// ── Business Health metric card ────────────────────────────────
function MetricCard({ icon, iconColor, label, value, sub, children }: {
  icon: React.ReactNode; iconColor: string; label: string;
  value: string | number; sub?: string; children?: React.ReactNode;
}) {
  return (
    <div className="card" style={{ padding: '16px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <div style={{ width: 28, height: 28, borderRadius: 'var(--radius-sm)', background: `${iconColor}1A`, color: iconColor, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {icon}
        </div>
        <span className="t-label">{label}</span>
      </div>
      <p style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 800, color: iconColor, lineHeight: 1, marginBottom: sub ? 4 : 0 }}>{value}</p>
      {sub && <p className="t-2xs text-secondary">{sub}</p>}
      {children}
    </div>
  );
}

function SubMetric({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <p className="t-label" style={{ marginBottom: 3 }}>{label}</p>
      <p className="t-xs-medium" style={{ color: color || 'var(--text-primary)' }}>{value}</p>
    </div>
  );
}

// ── MAIN COMPONENT ─────────────────────────────────────────────
export function AgencyHomeClient({
  attentionItems, recentLogs: initialLogs, stats, priorities: initialPrios,
  timeBlocks: initialBlocks, bdStats,
}: AgencyHomeClientProps) {
  const { mode } = useBrand();
  const { user: currentUser } = useCurrentUser();
  const supabaseRef = useRef(createClient());
  const supabase    = supabaseRef.current!;

  const [prios, setPrios]     = useState(initialPrios);
  const [blocks, setBlocks]   = useState(initialBlocks);
  const [logs, setLogs]       = useState<RecentLog[]>(initialLogs);
  const [newPriority, setNewPriority]     = useState('');
  const [addingPriority, setAddingPriority] = useState(false);
  const [showAddBlock, setShowAddBlock]   = useState(false);
  const [currentTime, setCurrentTime]     = useState(new Date());

  // Update every minute for accurate "Now" block highlighting
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  const refreshLogs = useCallback(async () => {
    const res = await fetch(`/api/logs?mode=${mode}`);
    if (!res.ok) return;
    setLogs(await res.json());
  }, [mode]);

  useEffect(() => {
    function onSaved(e: Event) {
      if ((e as CustomEvent).detail?.mode === mode) refreshLogs();
    }
    window.addEventListener('quicklog:saved', onSaved);
    return () => window.removeEventListener('quicklog:saved', onSaved);
  }, [mode, refreshLogs]);

  async function handleDeleteLog(id: string) {
    setLogs(prev => prev.filter(l => l.id !== id));
    await fetch(`/api/logs?id=${id}`, { method: 'DELETE' });
  }

  async function handleAddPriority() {
    if (!newPriority.trim() || prios.length >= 3 || !currentUser) return;
    setAddingPriority(true);
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase.from('priorities')
      .insert({ user_id: currentUser.ownerId, mode, date: today, text: newPriority.trim(), sort_order: prios.length })
      .select().single();
    if (data) setPrios(prev => [...prev, data as Priority]);
    setNewPriority('');
    setAddingPriority(false);
  }

  async function handleTogglePriority(id: string, completed: boolean) {
    await supabase.from('priorities').update({ completed: !completed }).eq('id', id);
    setPrios(prev => prev.map(p => p.id === id ? { ...p, completed: !completed } : p));
  }

  async function handleDeletePriority(id: string) {
    await supabase.from('priorities').delete().eq('id', id);
    setPrios(prev => prev.filter(p => p.id !== id));
  }

  async function handleAddTimeBlock(type: string, startTime: string, endTime: string, label: string) {
    if (!currentUser) return;
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase.from('time_blocks')
      .insert({ user_id: currentUser.ownerId, mode, date: today, type, start_time: startTime, end_time: endTime, label: label || null })
      .select().single();
    if (data) setBlocks(prev => [...prev, data as TimeBlock].sort((a, b) => a.start_time.localeCompare(b.start_time)));
  }

  async function handleDeleteBlock(id: string) {
    await supabase.from('time_blocks').delete().eq('id', id);
    setBlocks(prev => prev.filter(b => b.id !== id));
  }

  // Precise minute-based current block detection
  function isCurrentBlock(block: TimeBlock): boolean {
    const [sh, sm] = block.start_time.split(':').map(Number);
    const [eh, em] = block.end_time.split(':').map(Number);
    const now   = currentTime.getHours() * 60 + currentTime.getMinutes();
    const start = sh * 60 + sm;
    const end   = eh * 60 + em;
    return now >= start && now < end;
  }

  const hour     = new Date().getHours();
  const greeting = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';

  return (
    <PageTransition>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

        {/* Header */}
        <div>
          <h1 className="t-display">Good {greeting}</h1>
          <p className="t-xs text-secondary" style={{ marginTop: 6 }}>Agency overview — here&apos;s what needs your attention.</p>
        </div>

        {/* BD Activity This Week */}
        <div>
          <p className="t-label" style={{ marginBottom: 12 }}>BD Activity This Week</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="card" style={{ padding: '16px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <Kanban size={14} style={{ color: 'var(--accent-violet)' }} />
                <span className="t-label">New Leads</span>
              </div>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 800, color: 'var(--accent-violet)', lineHeight: 1 }}>{bdStats.leadsThisWeek}</p>
            </div>
            <div className="card" style={{ padding: '16px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <TrendingUp size={14} style={{ color: 'var(--accent-green)' }} />
                <span className="t-label">Moved Forward</span>
              </div>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 800, color: 'var(--accent-green)', lineHeight: 1 }}>{bdStats.movedForward}</p>
            </div>
          </div>
        </div>

        {/* Two-column layout */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 296px', gap: 28, alignItems: 'start' }}>

          {/* ── LEFT ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>

            {/* Attention Feed */}
            <div>
              <p className="t-label" style={{ marginBottom: 12 }}>Needs Attention</p>
              {attentionItems.length === 0 ? (
                <div className="card" style={{ padding: '28px 24px', textAlign: 'center' }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--accent-green-dim)', color: 'var(--accent-green)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                    <CheckCircle2 size={20} />
                  </div>
                  <p className="t-sm-semibold" style={{ marginBottom: 4 }}>All clear</p>
                  <p className="t-xs text-secondary">Nothing needs your attention right now.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {attentionItems.map((item, i) => <AttentionCard key={item.id} item={item} index={i} />)}
                </div>
              )}
            </div>

            {/* Business Health */}
            <div>
              <p className="t-label" style={{ marginBottom: 12 }}>Business Health</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

                {/* Money */}
                <MetricCard icon={<IndianRupee size={15} />} iconColor="var(--accent-green)"
                  label="Money" value={formatINR(stats?.money?.revenueThisMonth || 0)} sub="Revenue this month">
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border-subtle)' }}>
                    <SubMetric label="Outstanding" value={formatCompactINR(stats?.money?.outstandingTotal || 0)}
                      color={(stats?.money?.outstandingTotal || 0) > 0 ? 'var(--accent-amber)' : undefined} />
                    <SubMetric label="Overdue" value={formatCompactINR(stats?.money?.overdueTotal || 0)}
                      color={(stats?.money?.overdueTotal || 0) > 0 ? 'var(--accent-red)' : undefined} />
                  </div>
                  {stats?.money?.sparklineData?.some(d => d.value > 0) && (
                    <div style={{ marginTop: 12 }}>
                      <Sparkline data={stats.money.sparklineData} color="var(--accent-green)" height={36} />
                    </div>
                  )}
                </MetricCard>

                {/* Clients */}
                <MetricCard icon={<Users size={15} />} iconColor="var(--accent-blue)"
                  label="Clients" value={stats?.clients?.totalActive || 0} sub="Active clients">
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border-subtle)' }}>
                    <SubMetric label="Pipeline" value={String(stats?.clients?.pipelineLeads || 0)} />
                    <SubMetric label="All time" value={String(stats?.clients?.totalAllTime || 0)} />
                  </div>
                </MetricCard>

                {/* Brand */}
                <MetricCard icon={<Share2 size={15} />} iconColor="var(--accent-violet)"
                  label="Brand" value={stats?.social?.postsThisMonth || 0} sub="Posts this month" />

                {/* Work */}
                <MetricCard icon={<Briefcase size={15} />} iconColor="var(--accent-amber)"
                  label="Work" value={stats?.work?.activeProjects || 0} sub="Active projects" />
              </div>
            </div>
          </div>

          {/* ── RIGHT — Focus panel ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Priorities */}
            <div className="card" style={{ padding: '16px 18px' }}>
              <p className="t-label" style={{ marginBottom: 12 }}>Top 3 Priorities</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {prios.slice(0, 3).map(p => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}
                    onMouseEnter={e => { (e.currentTarget.querySelector('.p-del') as HTMLElement | null)?.style.setProperty('opacity', '1'); }}
                    onMouseLeave={e => { (e.currentTarget.querySelector('.p-del') as HTMLElement | null)?.style.setProperty('opacity', '0'); }}>
                    <button onClick={() => handleTogglePriority(p.id, p.completed)}
                      style={{ width: 18, height: 18, borderRadius: '50%', flexShrink: 0, marginTop: 1, border: `2px solid ${p.completed ? 'var(--accent-green)' : 'var(--border-strong)'}`, background: p.completed ? 'var(--accent-green)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 150ms' }}>
                      {p.completed && <CheckCircle2 size={11} color="white" />}
                    </button>
                    <span className="t-xs" style={{ flex: 1, color: p.completed ? 'var(--text-tertiary)' : 'var(--text-primary)', textDecoration: p.completed ? 'line-through' : 'none', lineHeight: 1.5 }}>
                      {p.text}
                    </span>
                    <button className="p-del" onClick={() => handleDeletePriority(p.id)}
                      style={{ display: 'flex', flexShrink: 0, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', opacity: 0, transition: 'opacity 150ms, color 150ms', padding: '1px' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent-red)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; }}>
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
              {prios.length < 3 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border-subtle)' }}>
                  <input value={newPriority} onChange={e => setNewPriority(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddPriority()}
                    placeholder="Add a priority..."
                    style={{ flex: 1, background: 'transparent', border: 'none', fontSize: 12, color: 'var(--text-primary)', fontFamily: 'var(--font-body)', outline: 'none' }} />
                  <button onClick={handleAddPriority} disabled={!newPriority.trim() || addingPriority}
                    style={{ color: 'var(--accent-blue)', background: 'none', border: 'none', cursor: newPriority.trim() ? 'pointer' : 'default', opacity: newPriority.trim() ? 1 : 0.3, display: 'flex', transition: 'opacity 150ms' }}>
                    <Plus size={15} />
                  </button>
                </div>
              )}
              {prios.length === 0 && (
                <p className="t-2xs text-tertiary" style={{ marginTop: 8, fontStyle: 'italic' }}>Set up to 3 priorities for today.</p>
              )}
            </div>

            {/* Time Blocks */}
            <div className="card" style={{ padding: '16px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <p className="t-label">Time Blocks</p>
                <button onClick={() => setShowAddBlock(true)}
                  style={{ color: 'var(--accent-blue)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 2, transition: 'opacity 150ms' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '0.7'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}>
                  <Plus size={15} />
                </button>
              </div>
              {blocks.length === 0 ? (
                <p className="t-xs text-tertiary" style={{ fontStyle: 'italic' }}>No blocks scheduled.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {blocks.map(block => {
                    const color   = BLOCK_COLORS[block.type] || 'var(--text-tertiary)';
                    const current = isCurrentBlock(block);
                    return (
                      <div key={block.id}
                        style={{ padding: '8px 10px', borderLeft: `3px solid ${color}`, background: current ? 'var(--bg-hover)' : 'transparent', borderRadius: '0 var(--radius-sm) var(--radius-sm) 0', display: 'flex', alignItems: 'center', gap: 8, transition: 'background 150ms' }}
                        onMouseEnter={e => { (e.currentTarget.querySelector('.blk-del') as HTMLElement | null)?.style.setProperty('opacity', '1'); }}
                        onMouseLeave={e => { (e.currentTarget.querySelector('.blk-del') as HTMLElement | null)?.style.setProperty('opacity', '0'); }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p className="t-xs-medium" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textTransform: 'capitalize' }}>
                            {block.label || block.type}
                          </p>
                          <p className="t-mono-sm" style={{ marginTop: 1 }}>{formatTime(block.start_time)} — {formatTime(block.end_time)}</p>
                        </div>
                        {current && (
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 100, background: 'var(--accent-green-dim)', color: 'var(--accent-green)', flexShrink: 0 }}>Now</span>
                        )}
                        <button className="blk-del" onClick={() => handleDeleteBlock(block.id)}
                          style={{ color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', opacity: 0, transition: 'opacity 150ms, color 150ms', flexShrink: 0 }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent-red)'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; }}>
                          <X size={12} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Recent Logs */}
            <div className="card" style={{ padding: '16px 18px' }}>
              <p className="t-label" style={{ marginBottom: 12 }}>Recent Logs</p>
              {logs.length === 0 ? (
                <p className="t-xs text-tertiary" style={{ fontStyle: 'italic' }}>Nothing logged yet. Hit Quick Log to capture something fast.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {logs.map((log, i) => (
                    <div key={log.id}
                      style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0', borderBottom: i < logs.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}
                      onMouseEnter={e => { (e.currentTarget.querySelector('.log-del') as HTMLElement | null)?.style.setProperty('opacity', '1'); }}
                      onMouseLeave={e => { (e.currentTarget.querySelector('.log-del') as HTMLElement | null)?.style.setProperty('opacity', '0'); }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p className="t-xs text-primary" style={{ lineHeight: 1.5 }}>{log.content}</p>
                        <p className="t-mono-sm" style={{ marginTop: 2 }}>{formatRelative(log.created_at)}</p>
                      </div>
                      <button className="log-del" onClick={() => handleDeleteLog(log.id)}
                        style={{ color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', opacity: 0, transition: 'opacity 150ms, color 150ms', flexShrink: 0, marginTop: 2 }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent-red)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; }}>
                        <X size={11} />
                      </button>
                    </div>
                  ))}
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

// ── ADD TIME BLOCK MODAL ───────────────────────────────────────
function AddTimeBlockModal({ open, onClose, onAdd }: {
  open: boolean; onClose: () => void;
  onAdd: (type: string, start: string, end: string, label: string) => void;
}) {
  const [type, setType]           = useState('deep');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime]     = useState('11:00');
  const [label, setLabel]         = useState('');

  useEffect(() => { if (!open) { setLabel(''); setType('deep'); } }, [open]);

  function handleAdd() { onAdd(type, startTime, endTime, label); onClose(); }

  const typeColor = BLOCK_COLORS[type] || 'var(--text-tertiary)';

  return (
    <Modal open={open} onClose={onClose} title="Add Time Block" size="sm">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Type picker */}
        <div>
          <label className="t-label" style={{ display: 'block', marginBottom: 8 }}>Block Type</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
            {[
              { value: 'deep',     label: 'Deep Work',  color: 'var(--accent-blue)' },
              { value: 'outreach', label: 'Outreach',   color: 'var(--accent-green)' },
              { value: 'admin',    label: 'Admin',      color: 'var(--accent-amber)' },
              { value: 'personal', label: 'Personal',   color: 'var(--accent-violet)' },
            ].map(t => (
              <button key={t.value} type="button" onClick={() => setType(t.value)}
                style={{ padding: '8px 4px', borderRadius: 'var(--radius-sm)', border: `1px solid ${type === t.value ? t.color : 'var(--border-default)'}`, background: type === t.value ? `${t.color}18` : 'transparent', cursor: 'pointer', transition: 'all 150ms', textAlign: 'center' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: t.color, margin: '0 auto 5px' }} />
                <span style={{ fontSize: 10, fontWeight: 600, color: type === t.value ? t.color : 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}>{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        <Input label="Label (Optional)" value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g., Client calls sprint" />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Input label="Start Time" type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
          <Input label="End Time" type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
        </div>

        {/* Preview */}
        {startTime && endTime && (
          <div style={{ padding: '8px 12px', borderLeft: `3px solid ${typeColor}`, background: 'var(--bg-hover)', borderRadius: '0 var(--radius-sm) var(--radius-sm) 0' }}>
            <p className="t-xs-medium" style={{ color: typeColor, textTransform: 'capitalize' }}>{label || type}</p>
            <p className="t-mono-sm" style={{ marginTop: 1 }}>{formatTime(startTime)} — {formatTime(endTime)}</p>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
          <Button variant="secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</Button>
          <Button onClick={handleAdd} style={{ flex: 1 }}>Add Block</Button>
        </div>
      </div>
    </Modal>
  );
}

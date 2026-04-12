'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useBrand } from '@/lib/brand';
import { useCurrentUser } from '@/lib/auth/use-auth';
import { createClient } from '@/lib/supabase/client';
import { PageTransition } from '@/components/dashboard/PageTransition';
import { Button, Input, Textarea, Select, Modal } from '@/components/ui';
import { formatDate, formatRelative } from '@/lib/utils';
import {
  Plus, Linkedin, Calendar, Lightbulb, ExternalLink,
  ChevronRight, Check, Pencil, Trash2, ArrowRight,
  MessageSquare, Phone, UserCheck, Eye,
} from 'lucide-react';
import type { SocialPost } from '@/types';

interface OutreachLead {
  id: string; name: string; profile_url: string | null;
  company: string | null; requirement: string | null;
  status: 'found' | 'connected' | 'intro_sent' | 'replied' | 'call_scheduled' | 'converted' | 'not_interested';
  notes: string | null; found_at: string; updated_at: string;
}

const STATUSES: { value: OutreachLead['status']; label: string; color: string; badge: string }[] = [
  { value: 'found',          label: 'Found',             color: 'var(--text-tertiary)',  badge: 'outline' },
  { value: 'connected',      label: 'Connected',         color: 'var(--accent-blue)',    badge: 'blue' },
  { value: 'intro_sent',     label: 'Intro Sent',        color: 'var(--accent-violet)',  badge: 'violet' },
  { value: 'replied',        label: 'Replied',           color: 'var(--accent-amber)',   badge: 'amber' },
  { value: 'call_scheduled', label: 'Call Scheduled',    color: 'var(--accent-amber)',   badge: 'amber' },
  { value: 'converted',      label: 'Converted → Client',color: 'var(--accent-green)',   badge: 'green' },
  { value: 'not_interested', label: 'Not Interested',    color: 'var(--text-tertiary)',  badge: 'outline' },
];

const ACTIVE_STAGES = STATUSES.filter(s => !['converted', 'not_interested'].includes(s.value));
const STATUS_MAP = Object.fromEntries(STATUSES.map(s => [s.value, s]));

// Next logical status for quick-advance
const NEXT_STATUS: Partial<Record<OutreachLead['status'], OutreachLead['status']>> = {
  found: 'connected', connected: 'intro_sent', intro_sent: 'replied',
  replied: 'call_scheduled', call_scheduled: 'converted',
};

// ─── STAT CARD ───
function StatCard({ label, value, color, icon }: { label: string; value: number; color: string; icon: React.ReactNode }) {
  return (
    <div className="card">
      <div className="flex items-center gap-2 metric-header-gap">
        <div style={{ width: 28, height: 28, borderRadius: 'var(--radius-sm)', background: `${color}1A`, color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {icon}
        </div>
        <p className="t-label">{label}</p>
      </div>
      <p className="t-metric" style={{ color }}>{value}</p>
    </div>
  );
}

// ─── STATUS PILL ───
function StatusPill({ status }: { status: OutreachLead['status'] }) {
  const s = STATUS_MAP[status];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 9px', borderRadius: 100, fontSize: 11, fontWeight: 500,
      background: `${s.color}1A`, color: s.color,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', flexShrink: 0 }} />
      {s.label}
    </span>
  );
}

export default function OutreachPage() {
  const { mode } = useBrand();
  const { user: currentUser } = useCurrentUser();
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current!;

  const [activeTab, setActiveTab] = useState<'pipeline' | 'content'>('pipeline');
  const [leads, setLeads] = useState<OutreachLead[]>([]);
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddLead, setShowAddLead] = useState(false);
  const [showAddPost, setShowAddPost] = useState(false);
  const [selectedLead, setSelectedLead] = useState<OutreachLead | null>(null);
  const [editingPost, setEditingPost] = useState<SocialPost | null>(null);

  const load = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    const [{ data: leadsData }, { data: postsData }] = await Promise.all([
      supabase.from('outreach_leads').select('*')
        .eq('user_id', currentUser.id).eq('mode', mode)
        .order('updated_at', { ascending: false }),
      supabase.from('social_posts').select('*')
        .eq('user_id', currentUser.id).eq('mode', mode).eq('platform', 'linkedin')
        .order('planned_date', { ascending: true }),
    ]);
    setLeads((leadsData as OutreachLead[]) || []);
    setPosts((postsData as SocialPost[]) || []);
    setLoading(false);
  }, [currentUser, mode, supabase]);

  useEffect(() => { load(); }, [load]);

  // Advance a lead to the next status in one click
  async function advanceStatus(lead: OutreachLead, e: React.MouseEvent) {
    e.stopPropagation();
    const next = NEXT_STATUS[lead.status];
    if (!next) return;
    const { data } = await supabase.from('outreach_leads')
      .update({ status: next, updated_at: new Date().toISOString() })
      .eq('id', lead.id).select().single();
    if (data) setLeads(prev => prev.map(l => l.id === lead.id ? data as OutreachLead : l));
  }

  async function deleteLead(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    await supabase.from('outreach_leads').delete().eq('id', id);
    setLeads(prev => prev.filter(l => l.id !== id));
  }

  async function deletePost(id: string) {
    await supabase.from('social_posts').delete().eq('id', id);
    setPosts(prev => prev.filter(p => p.id !== id));
  }

  async function updatePostStatus(id: string, status: string) {
    const { data } = await supabase.from('social_posts')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id).select().single();
    if (data) setPosts(prev => prev.map(p => p.id === id ? data as SocialPost : p));
  }

  // Stats
  const active    = leads.filter(l => !['converted', 'not_interested'].includes(l.status)).length;
  const replied   = leads.filter(l => ['replied', 'call_scheduled'].includes(l.status)).length;
  const converted = leads.filter(l => l.status === 'converted').length;
  const now = new Date();
  const thisMonth = posts.filter(p => {
    if (p.status !== 'published' || !p.planned_date) return false;
    const d = new Date(p.planned_date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  return (
    <PageTransition>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>

        {/* Page header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <h1 className="t-h1">Outreach</h1>
            <p className="t-xs mt-1">LinkedIn pipeline and personal brand content.</p>
          </div>
          {activeTab === 'pipeline'
            ? <Button icon={<Plus size={14} />} onClick={() => setShowAddLead(true)}>Add Lead</Button>
            : <Button icon={<Plus size={14} />} onClick={() => setShowAddPost(true)}>New Post</Button>
          }
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          <StatCard label="Active in pipeline"    value={active}    color="var(--accent-blue)"   icon={<Linkedin size={14} />} />
          <StatCard label="Replied / In convo"    value={replied}   color="var(--accent-amber)"  icon={<MessageSquare size={14} />} />
          <StatCard label="Converted to clients"  value={converted} color="var(--accent-green)"  icon={<UserCheck size={14} />} />
          <StatCard label="Posts this month"      value={thisMonth} color="var(--accent-violet)"  icon={<Calendar size={14} />} />
        </div>

        {/* Tab bar — underline style */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', gap: 0 }}>
          {(['pipeline', 'content'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              padding: '9px 18px', border: 'none', background: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 500, fontFamily: 'var(--font-body)',
              color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-tertiary)',
              borderBottom: `2px solid ${activeTab === tab ? 'var(--accent-blue)' : 'transparent'}`,
              marginBottom: -1, transition: 'color 150ms, border-color 150ms',
            }}>
              {tab === 'pipeline' ? 'LinkedIn Pipeline' : 'Content Calendar'}
            </button>
          ))}
        </div>

        {/* ── PIPELINE TAB ── */}
        {activeTab === 'pipeline' && (
          <div>
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[1,2,3].map(i => (
                  <div key={i} className="card" style={{ height: 72, background: 'var(--bg-hover)', animation: 'ds-pulse 1.5s ease-in-out infinite' }} />
                ))}
              </div>
            ) : leads.length === 0 ? (
              <div className="card" style={{ padding: '48px 24px', textAlign: 'center' }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--accent-blue-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: 'var(--accent-blue)' }}>
                  <Linkedin size={20} />
                </div>
                <p className="t-sm-semibold" style={{ marginBottom: 6 }}>No leads tracked yet</p>
                <p className="t-xs" style={{ marginBottom: 18 }}>When you find someone on LinkedIn, add them here to track the conversation.</p>
                <Button icon={<Plus size={14} />} onClick={() => setShowAddLead(true)}>Add Lead</Button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Active stages */}
                {ACTIVE_STAGES.map(stage => {
                  const stageLeads = leads.filter(l => l.status === stage.value);
                  if (stageLeads.length === 0) return null;
                  return (
                    <div key={stage.value}>
                      {/* Stage header */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: stage.color, flexShrink: 0 }} />
                        <span className="t-label">{stage.label}</span>
                        <span className="t-mono-sm">{stageLeads.length}</span>
                      </div>
                      {/* Lead cards */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {stageLeads.map(lead => (
                          <div key={lead.id} className="card"
                            style={{ padding: '14px 18px', cursor: 'pointer', transition: 'background 150ms' }}
                            onClick={() => setSelectedLead(lead)}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                              {/* Avatar */}
                              <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--accent-blue-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--accent-blue)' }}>
                                {lead.name[0].toUpperCase()}
                              </div>
                              {/* Info */}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                                  <span className="t-sm-semibold">{lead.name}</span>
                                  {lead.company && <span className="t-2xs text-tertiary">· {lead.company}</span>}
                                </div>
                                {lead.requirement && (
                                  <p className="t-xs text-secondary" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {lead.requirement}
                                  </p>
                                )}
                              </div>
                              {/* Actions */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                                <span className="t-mono-sm">{formatRelative(lead.updated_at)}</span>
                                {NEXT_STATUS[lead.status] && (
                                  <button
                                    onClick={e => advanceStatus(lead, e)}
                                    title={`Move to ${STATUS_MAP[NEXT_STATUS[lead.status]!]?.label}`}
                                    style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 11, fontFamily: 'var(--font-body)', cursor: 'pointer', transition: 'all 150ms' }}
                                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent-blue)'; (e.currentTarget as HTMLElement).style.color = 'var(--accent-blue)'; }}
                                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; }}
                                  >
                                    <ArrowRight size={11} />
                                    {STATUS_MAP[NEXT_STATUS[lead.status]!]?.label}
                                  </button>
                                )}
                                <button
                                  onClick={e => deleteLead(lead.id, e)}
                                  style={{ display: 'flex', padding: 4, borderRadius: 'var(--radius-sm)', border: 'none', background: 'transparent', color: 'var(--text-tertiary)', cursor: 'pointer', transition: 'color 150ms' }}
                                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent-red)'; }}
                                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; }}
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}

                {/* Converted — condensed */}
                {converted > 0 && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-green)', flexShrink: 0 }} />
                      <span className="t-label">Converted → Client</span>
                      <span className="t-mono-sm">{converted}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {leads.filter(l => l.status === 'converted').map(lead => (
                        <div key={lead.id} className="card" style={{ padding: '10px 18px', opacity: 0.65, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Check size={13} style={{ color: 'var(--accent-green)' }} />
                            <span className="t-sm-medium">{lead.name}</span>
                            {lead.company && <span className="t-2xs text-tertiary">· {lead.company}</span>}
                          </div>
                          <span className="t-mono-sm">{formatRelative(lead.updated_at)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── CONTENT TAB ── */}
        {activeTab === 'content' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 24, alignItems: 'start' }}>

            {/* Content Calendar — left */}
            <div>
              <p className="t-label section-gap">Scheduled &amp; Published</p>
              {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {[1,2].map(i => <div key={i} className="card" style={{ height: 60, background: 'var(--bg-hover)', animation: 'ds-pulse 1.5s ease-in-out infinite' }} />)}
                </div>
              ) : posts.filter(p => p.status !== 'idea').length === 0 ? (
                <div className="card" style={{ padding: '40px 24px', textAlign: 'center' }}>
                  <Calendar size={28} style={{ color: 'var(--text-tertiary)', margin: '0 auto 12px' }} />
                  <p className="t-sm-semibold" style={{ marginBottom: 4 }}>No posts scheduled</p>
                  <p className="t-xs" style={{ marginBottom: 16 }}>Plan your LinkedIn content to stay visible.</p>
                  <Button variant="secondary" icon={<Plus size={13} />} onClick={() => setShowAddPost(true)}>Add a post</Button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {posts.filter(p => p.status !== 'idea').map(post => {
                    const statusColor = post.status === 'published' ? 'var(--accent-green)'
                      : post.status === 'scheduled' ? 'var(--accent-blue)'
                      : 'var(--accent-amber)';
                    return (
                      <div key={post.id} className="card"
                        style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
                        {/* Status stripe */}
                        <div style={{ width: 3, alignSelf: 'stretch', borderRadius: 2, background: statusColor, flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p className="t-sm-medium" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {post.title || 'Untitled'}
                          </p>
                          <p className="t-2xs text-tertiary" style={{ marginTop: 2 }}>
                            {post.planned_date ? formatDate(post.planned_date) : 'No date set'}
                          </p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                          <span style={{ padding: '3px 9px', borderRadius: 100, fontSize: 11, fontWeight: 500, background: `${statusColor}1A`, color: statusColor }}>
                            {post.status}
                          </span>
                          {/* Quick actions */}
                          {post.status !== 'published' && (
                            <button onClick={() => updatePostStatus(post.id, 'published')}
                              title="Mark published"
                              style={{ display: 'flex', padding: 4, borderRadius: 'var(--radius-sm)', border: 'none', background: 'transparent', color: 'var(--text-tertiary)', cursor: 'pointer', transition: 'color 150ms' }}
                              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent-green)'; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; }}>
                              <Check size={13} />
                            </button>
                          )}
                          <button onClick={() => setEditingPost(post)}
                            style={{ display: 'flex', padding: 4, borderRadius: 'var(--radius-sm)', border: 'none', background: 'transparent', color: 'var(--text-tertiary)', cursor: 'pointer', transition: 'color 150ms' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent-blue)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; }}>
                            <Pencil size={13} />
                          </button>
                          <button onClick={() => deletePost(post.id)}
                            style={{ display: 'flex', padding: 4, borderRadius: 'var(--radius-sm)', border: 'none', background: 'transparent', color: 'var(--text-tertiary)', cursor: 'pointer', transition: 'color 150ms' }}
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
            </div>

            {/* Ideas Parking Lot — right */}
            <div>
              <p className="t-label section-gap">Ideas Parking Lot</p>
              <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {posts.filter(p => p.status === 'idea').length === 0 ? (
                  <p className="t-xs text-tertiary" style={{ fontStyle: 'italic' }}>Jot down post ideas here.</p>
                ) : (
                  posts.filter(p => p.status === 'idea').map((idea, i, arr) => (
                    <div key={idea.id} style={{
                      display: 'flex', alignItems: 'flex-start', gap: 10,
                      padding: '10px 0',
                      borderBottom: i < arr.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                    }}>
                      <Lightbulb size={13} style={{ color: 'var(--accent-amber)', flexShrink: 0, marginTop: 2 }} />
                      <span className="t-xs text-primary" style={{ flex: 1 }}>{idea.title || idea.content || 'Untitled idea'}</span>
                      <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                        {/* Promote to draft */}
                        <button onClick={() => updatePostStatus(idea.id, 'draft')}
                          title="Move to draft"
                          style={{ display: 'flex', padding: 3, border: 'none', background: 'transparent', color: 'var(--text-tertiary)', cursor: 'pointer', transition: 'color 150ms' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent-blue)'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; }}>
                          <ArrowRight size={12} />
                        </button>
                        <button onClick={() => deletePost(idea.id)}
                          style={{ display: 'flex', padding: 3, border: 'none', background: 'transparent', color: 'var(--text-tertiary)', cursor: 'pointer', transition: 'color 150ms' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent-red)'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; }}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
                {/* Add idea inline */}
                <AddIdeaInline onAdd={async (title) => {
                  if (!currentUser) return;
                  const { data } = await supabase.from('social_posts')
                    .insert({ user_id: currentUser.id, mode, platform: 'linkedin', title, status: 'idea' })
                    .select().single();
                  if (data) setPosts(prev => [...prev, data as SocialPost]);
                }} />
              </div>
            </div>

          </div>
        )}
      </div>

      {/* ── MODALS ── */}
      <Modal open={showAddLead} onClose={() => setShowAddLead(false)} title="Add Outreach Lead" size="md">
        <AddLeadForm currentUser={currentUser} mode={mode}
          onClose={() => setShowAddLead(false)}
          onCreated={lead => { setLeads(prev => [lead, ...prev]); setShowAddLead(false); }} />
      </Modal>

      <Modal open={showAddPost} onClose={() => setShowAddPost(false)} title="New Post" size="md">
        <AddPostForm currentUser={currentUser} mode={mode}
          onClose={() => setShowAddPost(false)}
          onCreated={post => { setPosts(prev => [...prev, post].sort((a, b) => (a.planned_date || '').localeCompare(b.planned_date || ''))); setShowAddPost(false); }} />
      </Modal>

      {editingPost && (
        <Modal open={true} onClose={() => setEditingPost(null)} title="Edit Post" size="md">
          <AddPostForm currentUser={currentUser} mode={mode} existing={editingPost}
            onClose={() => setEditingPost(null)}
            onCreated={post => { setPosts(prev => prev.map(p => p.id === post.id ? post : p)); setEditingPost(null); }} />
        </Modal>
      )}

      {selectedLead && (
        <Modal open={true} onClose={() => setSelectedLead(null)} title={selectedLead.name}
          description={selectedLead.company || undefined} size="md">
          <LeadDetailView lead={selectedLead}
            onClose={() => setSelectedLead(null)}
            onUpdate={updated => { setLeads(prev => prev.map(l => l.id === updated.id ? updated : l)); setSelectedLead(updated); }}
            onDelete={() => { setLeads(prev => prev.filter(l => l.id !== selectedLead.id)); setSelectedLead(null); }} />
        </Modal>
      )}
    </PageTransition>
  );
}

// ─── ADD IDEA INLINE ───
function AddIdeaInline({ onAdd }: { onAdd: (title: string) => Promise<void> }) {
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleAdd() {
    if (!text.trim()) return;
    setSaving(true);
    await onAdd(text.trim());
    setText('');
    setSaving(false);
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border-subtle)' }}>
      <input value={text} onChange={e => setText(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleAdd()}
        placeholder="Add an idea..."
        style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 12, color: 'var(--text-primary)', fontFamily: 'var(--font-body)' }} />
      <button onClick={handleAdd} disabled={!text.trim() || saving}
        style={{ display: 'flex', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--accent-blue)', opacity: !text.trim() ? 0.3 : 1, transition: 'opacity 150ms' }}>
        <Plus size={14} />
      </button>
    </div>
  );
}

// ─── ADD/EDIT LEAD FORM ───
function AddLeadForm({ currentUser, mode, onClose, onCreated }: {
  currentUser: any; mode: string;
  onClose: () => void; onCreated: (lead: OutreachLead) => void;
}) {
  const supabase = useRef(createClient()).current!;
  const [name, setName] = useState('');
  const [profileUrl, setProfileUrl] = useState('');
  const [company, setCompany] = useState('');
  const [requirement, setRequirement] = useState('');
  const [status, setStatus] = useState<OutreachLead['status']>('found');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    if (!name.trim()) { setError('Name is required'); return; }
    if (!currentUser) return;
    setSaving(true);
    const { data, error: dbErr } = await supabase.from('outreach_leads')
      .insert({ user_id: currentUser.id, mode, name: name.trim(), profile_url: profileUrl || null, company: company || null, requirement: requirement || null, status })
      .select().single();
    if (dbErr) { setError(dbErr.message); setSaving(false); return; }
    if (data) onCreated(data as OutreachLead);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Input label="Name *" value={name} onChange={e => setName(e.target.value)} placeholder="John Smith" autoFocus />
        <Input label="Company / Role" value={company} onChange={e => setCompany(e.target.value)} placeholder="Acme Corp" />
      </div>
      <Input label="LinkedIn Profile URL" value={profileUrl} onChange={e => setProfileUrl(e.target.value)} placeholder="https://linkedin.com/in/..." />
      <Textarea label="Requirement / Context" value={requirement} onChange={e => setRequirement(e.target.value)}
        placeholder="What are they looking for? Any context from their post..." style={{ minHeight: 80 }} />
      <Select label="Current Status" value={status} onChange={e => setStatus(e.target.value as any)}
        options={STATUSES.map(s => ({ value: s.value, label: s.label }))} />
      {error && <p style={{ fontSize: 12, color: 'var(--accent-red)', fontFamily: 'var(--font-body)' }}>{error}</p>}
      <div style={{ display: 'flex', gap: 10, paddingTop: 16 }}>
        <Button variant="secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</Button>
        <Button onClick={handleSave} loading={saving} disabled={!name.trim()} style={{ flex: 1 }}>Add Lead</Button>
      </div>
    </div>
  );
}

// ─── LEAD DETAIL VIEW ───
function LeadDetailView({ lead, onClose, onUpdate, onDelete }: {
  lead: OutreachLead; onClose: () => void;
  onUpdate: (l: OutreachLead) => void; onDelete: () => void;
}) {
  const supabase = useRef(createClient()).current!;
  const [status, setStatus] = useState(lead.status);
  const [notes, setNotes] = useState(lead.notes || '');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    const { data } = await supabase.from('outreach_leads')
      .update({ status, notes: notes || null, updated_at: new Date().toISOString() })
      .eq('id', lead.id).select().single();
    if (data) onUpdate(data as OutreachLead);
    setSaving(false);
  }

  async function handleDelete() {
    await supabase.from('outreach_leads').delete().eq('id', lead.id);
    onDelete();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Meta */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <StatusPill status={lead.status} />
        {lead.profile_url && (
          <a href={lead.profile_url} target="_blank" rel="noopener noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--accent-blue)', textDecoration: 'none', fontFamily: 'var(--font-body)' }}>
            <ExternalLink size={12} /> View profile
          </a>
        )}
      </div>
      {lead.requirement && (
        <div style={{ padding: '10px 14px', background: 'var(--bg-hover)', borderRadius: 'var(--radius-md)', borderLeft: '3px solid var(--accent-blue)' }}>
          <p className="t-label sub-label-gap">Requirement</p>
          <p className="t-xs">{lead.requirement}</p>
        </div>
      )}
      <Select label="Update Status" value={status} onChange={e => setStatus(e.target.value as any)}
        options={STATUSES.map(s => ({ value: s.value, label: s.label }))} />
      <Textarea label="Notes" value={notes} onChange={e => setNotes(e.target.value)}
        placeholder="Conversation notes, what they said, next steps..." style={{ minHeight: 100 }} />
      <div style={{ display: 'flex', gap: 10, paddingTop: 16 }}>
        <button onClick={handleDelete}
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--accent-red-dim)', background: 'var(--accent-red-dim)', color: 'var(--accent-red)', fontSize: 12, fontFamily: 'var(--font-body)', cursor: 'pointer' }}>
          <Trash2 size={12} /> Delete
        </button>
        <div style={{ flex: 1 }} />
        <Button variant="secondary" onClick={onClose}>Close</Button>
        <Button onClick={handleSave} loading={saving}>Save</Button>
      </div>
    </div>
  );
}

// ─── ADD/EDIT POST FORM ───
function AddPostForm({ currentUser, mode, existing, onClose, onCreated }: {
  currentUser: any; mode: string; existing?: SocialPost;
  onClose: () => void; onCreated: (post: SocialPost) => void;
}) {
  const supabase = useRef(createClient()).current!;
  const [title, setTitle] = useState(existing?.title || '');
  const [content, setContent] = useState(existing?.content || '');
  const [date, setDate] = useState(existing?.planned_date || '');
  const [status, setStatus] = useState(existing?.status || 'idea');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!currentUser) return;
    setSaving(true);
    if (existing) {
      const { data } = await supabase.from('social_posts')
        .update({ title, content, planned_date: date || null, status, updated_at: new Date().toISOString() })
        .eq('id', existing.id).select().single();
      if (data) onCreated(data as SocialPost);
    } else {
      const { data } = await supabase.from('social_posts')
        .insert({ user_id: currentUser.id, mode, platform: 'linkedin', title, content, planned_date: date || null, status })
        .select().single();
      if (data) onCreated(data as SocialPost);
    }
    setSaving(false);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Input label="Title / Topic" value={title} onChange={e => setTitle(e.target.value)}
        placeholder="What's the post about?" autoFocus />
      <Textarea label="Content" value={content} onChange={e => setContent(e.target.value)}
        placeholder="Write the post or notes..." style={{ minHeight: 120 }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Input label="Planned Date" type="date" value={date} onChange={e => setDate(e.target.value)} />
        <Select label="Status" value={status} onChange={e => setStatus(e.target.value)}
          options={[
            { value: 'idea', label: 'Idea' }, { value: 'draft', label: 'Draft' },
            { value: 'scheduled', label: 'Scheduled' }, { value: 'published', label: 'Published' },
          ]} />
      </div>
      <div style={{ display: 'flex', gap: 10, paddingTop: 16 }}>
        <Button variant="secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</Button>
        <Button onClick={handleSave} loading={saving} style={{ flex: 1 }}>{existing ? 'Save Changes' : 'Save'}</Button>
      </div>
    </div>
  );
}

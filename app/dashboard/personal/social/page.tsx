'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useBrand } from '@/lib/brand';
import { useCurrentUser } from '@/lib/auth/use-auth';
import { createClient } from '@/lib/supabase/client';
import { PageTransition } from '@/components/dashboard/PageTransition';
import { Button, Input, Textarea, Select, Modal, OverflowMenu, LoadMore, useLoadMore } from '@/components/ui';
import { toast } from '@/components/ui/Toast';
import { formatDate, formatDateTime, formatRelative } from '@/lib/utils';
import {
  Plus, Linkedin, Calendar, Lightbulb, ExternalLink,
  ChevronRight, Check, Pencil, Trash2, ArrowRight,
  MessageSquare, Phone, UserCheck, Eye,
} from 'lucide-react';
import type { SocialPost, SocialPostStatus } from '@/types';
import {
  createSocialPost,
  updateSocialPost,
  updateSocialPostStatus,
  deleteSocialPost,
  createOutreachLead,
  updateOutreachLead,
  deleteOutreachLead,
  type OutreachLeadStatus,
} from '@/app/dashboard/actions/social';

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
  const supabase = supabaseRef.current;

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
    const prev = leads;
    setLeads(p => p.map(l => l.id === lead.id ? { ...l, status: next } : l));
    const res = await updateOutreachLead(lead.id, { status: next as OutreachLeadStatus });
    if (!res.ok) {
      setLeads(prev);
      toast.error(res.error || 'Could not advance status');
      return;
    }
    setLeads(p => p.map(l => l.id === lead.id ? res.data as unknown as OutreachLead : l));
  }

  async function deleteLead(id: string, e: Pick<React.MouseEvent, 'stopPropagation'>) {
    e.stopPropagation();
    const prev = leads;
    setLeads(p => p.filter(l => l.id !== id));
    const res = await deleteOutreachLead(id);
    if (!res.ok) {
      setLeads(prev);
      toast.error(res.error || 'Could not delete outreach');
    }
  }

  async function deletePost(id: string) {
    const prev = posts;
    setPosts(p => p.filter(post => post.id !== id));
    const res = await deleteSocialPost(id);
    if (!res.ok) {
      setPosts(prev);
      toast.error(res.error || 'Could not delete post');
    }
  }

  async function updatePostStatus(id: string, status: SocialPostStatus) {
    const prev = posts;
    setPosts(p => p.map(post => post.id === id ? { ...post, status } : post));
    const res = await updateSocialPostStatus(id, status);
    if (!res.ok) {
      setPosts(prev);
      toast.error(res.error || 'Could not update status');
      return;
    }
    setPosts(p => p.map(post => post.id === id ? res.data : post));
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

  // Memoized derived lists for pagination — keep array references
  // stable across renders so useLoadMore doesn't reset on every render.
  const scheduledPosts = useMemo(() => posts.filter(p => p.status !== 'idea'), [posts]);
  const ideaPosts      = useMemo(() => posts.filter(p => p.status === 'idea'), [posts]);
  const convertedLeads = useMemo(() => leads.filter(l => l.status === 'converted'), [leads]);

  // Pagination
  const scheduledPage = useLoadMore(scheduledPosts, { pageSize: 20 });
  const ideaPage      = useLoadMore(ideaPosts,      { pageSize: 10 });
  const convertedPage = useLoadMore(convertedLeads, { pageSize: 10 });

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
        <div className="rgrid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          <StatCard label="Active in pipeline"    value={active}    color="var(--accent-blue)"   icon={<Linkedin size={14} />} />
          <StatCard label="Replied / In convo"    value={replied}   color="var(--accent-amber)"  icon={<MessageSquare size={14} />} />
          <StatCard label="Converted to clients"  value={converted} color="var(--accent-green)"  icon={<UserCheck size={14} />} />
          <StatCard label="Posts this month"      value={thisMonth} color="var(--accent-violet)"  icon={<Calendar size={14} />} />
        </div>

        {/* Tab bar — underline style */}
        <div className="tabs-scroll" style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', gap: 0 }}>
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
                    <StageColumn
                      key={stage.value}
                      stage={stage}
                      leads={stageLeads}
                      onSelect={setSelectedLead}
                      onAdvance={advanceStatus}
                      onDelete={deleteLead}
                    />
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
                      {convertedPage.paginated.map(lead => (
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
                    <LoadMore hasMore={convertedPage.hasMore} onLoadMore={convertedPage.loadMore}
                      shown={convertedPage.shown} total={convertedPage.total} />
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── CONTENT TAB ── */}
        {activeTab === 'content' && (
          <div className="rgrid-main-aside" style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 24, alignItems: 'start' }}>

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
                  {scheduledPage.paginated.map(post => {
                    const statusColor = post.status === 'published' ? 'var(--accent-green)'
                      : post.status === 'scheduled' ? 'var(--accent-blue)'
                      : 'var(--accent-amber)';
                    return (
                      <div key={post.id} className="card dense-row"
                        style={{ padding: '14px 18px' }}>
                        {/* Status stripe */}
                        <div className="dense-row__lead" style={{ width: 3, alignSelf: 'stretch', borderRadius: 2, background: statusColor }} />
                        <div className="dense-row__body">
                          <div className="dense-row__title">
                            <span className="t-sm-medium dense-row__name">
                              {post.title || 'Untitled'}
                            </span>
                            <span className="chip-opt-out" style={{ padding: '3px 9px', borderRadius: 100, fontSize: 11, fontWeight: 500, background: `${statusColor}1A`, color: statusColor, flexShrink: 0 }}>
                              {post.status}
                            </span>
                          </div>
                          <div className="dense-row__meta">
                            <span className="t-2xs text-tertiary">
                              {post.status === 'published' && post.posted_at
                                ? `Posted ${formatDateTime(post.posted_at)}`
                                : post.planned_date ? `Planned ${formatDate(post.planned_date)}` : 'No date set'}
                            </span>
                          </div>
                        </div>
                        <div className="dense-row__actions">
                          {post.status !== 'published' && (
                            <button onClick={() => updatePostStatus(post.id, 'published')}
                              title="Mark published"
                              aria-label="Mark published"
                              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: 4, borderRadius: 'var(--radius-sm)', border: 'none', background: 'transparent', color: 'var(--text-tertiary)', cursor: 'pointer', transition: 'color 150ms' }}
                              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent-green)'; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; }}>
                              <Check size={13} />
                              <span className="row-btn-label">Publish</span>
                            </button>
                          )}
                          <button onClick={() => setEditingPost(post)}
                            aria-label="Edit post"
                            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: 4, borderRadius: 'var(--radius-sm)', border: 'none', background: 'transparent', color: 'var(--text-tertiary)', cursor: 'pointer', transition: 'color 150ms' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent-blue)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; }}>
                            <Pencil size={13} />
                            <span className="row-btn-label">Edit</span>
                          </button>
                          <button onClick={() => deletePost(post.id)}
                            aria-label="Delete post"
                            className="hide-on-mobile-row"
                            style={{ display: 'flex', padding: 4, borderRadius: 'var(--radius-sm)', border: 'none', background: 'transparent', color: 'var(--text-tertiary)', cursor: 'pointer', transition: 'color 150ms' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent-red)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; }}>
                            <Trash2 size={13} />
                          </button>
                          <OverflowMenu
                            items={[
                              { label: 'Delete post', icon: <Trash2 size={14} />, onClick: () => deletePost(post.id), destructive: true },
                            ]}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {scheduledPosts.length > 0 && (
                <LoadMore hasMore={scheduledPage.hasMore} onLoadMore={scheduledPage.loadMore}
                  shown={scheduledPage.shown} total={scheduledPage.total} />
              )}
            </div>

            {/* Ideas Parking Lot — right */}
            <div>
              <p className="t-label section-gap">Ideas Parking Lot</p>
              <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {ideaPosts.length === 0 ? (
                  <p className="t-xs text-tertiary" style={{ fontStyle: 'italic' }}>Jot down post ideas here.</p>
                ) : (
                  ideaPage.paginated.map((idea, i, arr) => (
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
                {ideaPosts.length > 0 && (
                  <LoadMore hasMore={ideaPage.hasMore} onLoadMore={ideaPage.loadMore}
                    shown={ideaPage.shown} total={ideaPage.total} />
                )}
                {/* Add idea inline */}
                <AddIdeaInline onAdd={async (title) => {
                  if (!currentUser) return;
                  const res = await createSocialPost({
                    mode,
                    platform: 'linkedin',
                    title,
                    status: 'idea',
                  });
                  if (!res.ok) {
                    toast.error(res.error || 'Could not save idea');
                    return;
                  }
                  setPosts(prev => [...prev, res.data]);
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
  currentUser: { id: string; ownerId: string } | null; mode: 'personal' | 'agency';
  onClose: () => void; onCreated: (lead: OutreachLead) => void;
}) {
  const supabase = useRef(createClient()).current;
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
    const res = await createOutreachLead({
      mode,
      name: name.trim(),
      profile_url: profileUrl || null,
      company: company || null,
      requirement: requirement || null,
      status: status as OutreachLeadStatus,
    });
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    onCreated(res.data as unknown as OutreachLead);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="rgrid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
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
  const supabase = useRef(createClient()).current;
  const [status, setStatus] = useState(lead.status);
  const [notes, setNotes] = useState(lead.notes || '');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    const res = await updateOutreachLead(lead.id, {
      status: status as OutreachLeadStatus,
      notes: notes || null,
    });
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error || 'Could not save outreach');
      return;
    }
    onUpdate(res.data as unknown as OutreachLead);
  }

  async function handleDelete() {
    const res = await deleteOutreachLead(lead.id);
    if (!res.ok) {
      toast.error(res.error || 'Could not delete outreach');
      return;
    }
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

// ─── STAGE COLUMN ───
// One column in the LinkedIn pipeline (e.g. Found, Intro Sent, Replied).
// Owns its own Load More state so paging through one stage doesn't
// expand others.
function StageColumn({ stage, leads, onSelect, onAdvance, onDelete }: {
  // Match the shape produced by STATUSES (defined at the top of this
  // file): adds `badge` alongside the value/label/color we actually use.
  stage: { value: OutreachLeadStatus; label: string; color: string; badge: string };
  leads: OutreachLead[];
  onSelect: (lead: OutreachLead) => void;
  onAdvance: (lead: OutreachLead, e: React.MouseEvent) => void;
  // Accepts either a real MouseEvent (when called from the inline
  // delete button) or a minimal shape with just stopPropagation
  // (when called from the OverflowMenu, which has no event to forward).
  // The handler itself only uses stopPropagation, so the wider type
  // is sound — and necessary to satisfy TS when passing the parent's
  // deleteLead(id, e: React.MouseEvent) into both callsites.
  onDelete: (id: string, e: Pick<React.MouseEvent, 'stopPropagation'>) => void;
}) {
  const { paginated, hasMore, loadMore, shown, total } = useLoadMore(leads, { pageSize: 20 });
  return (
    <div>
      {/* Stage header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: stage.color, flexShrink: 0 }} />
        <span className="t-label">{stage.label}</span>
        <span className="t-mono-sm">{leads.length}</span>
      </div>
      {/* Lead cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {paginated.map(lead => (
          <div key={lead.id} className="card dense-row"
            style={{ padding: '14px 18px', cursor: 'pointer' }}
            onClick={() => onSelect(lead)}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; }}>
            <div className="dense-row__lead-body" style={{ display: 'contents' }}>
              <div className="dense-row__lead" style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--accent-blue-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--accent-blue)' }}>
                {lead.name[0].toUpperCase()}
              </div>
              <div className="dense-row__body">
                <div className="dense-row__title">
                  <span className="t-sm-semibold dense-row__name">{lead.name}</span>
                </div>
                <div className="dense-row__meta">
                  {lead.company && <span className="t-2xs text-tertiary">{lead.company}</span>}
                  {lead.company && <span className="dense-row__meta-sep t-2xs">·</span>}
                  <span className="t-2xs text-tertiary">{formatRelative(lead.updated_at)}</span>
                  {lead.requirement && (
                    <>
                      <span className="dense-row__meta-sep t-2xs">·</span>
                      <span className="t-2xs text-tertiary hide-mobile" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}>{lead.requirement}</span>
                      <span className="t-2xs text-tertiary show-mobile" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.requirement.length > 40 ? lead.requirement.slice(0, 40) + '…' : lead.requirement}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="dense-row__actions" onClick={e => e.stopPropagation()}>
              {NEXT_STATUS[lead.status] && (
                <button
                  onClick={e => onAdvance(lead, e)}
                  title={`Move to ${STATUS_MAP[NEXT_STATUS[lead.status]!]?.label}`}
                  className="row-btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 11, fontFamily: 'var(--font-body)', cursor: 'pointer', transition: 'all 150ms' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent-blue)'; (e.currentTarget as HTMLElement).style.color = 'var(--accent-blue)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; }}
                >
                  <ArrowRight size={11} />
                  <span className="row-btn-label">{STATUS_MAP[NEXT_STATUS[lead.status]!]?.label}</span>
                </button>
              )}
              <button
                onClick={e => onDelete(lead.id, e)}
                aria-label="Delete lead"
                className="hide-on-mobile-row"
                style={{ display: 'flex', padding: 4, borderRadius: 'var(--radius-sm)', border: 'none', background: 'transparent', color: 'var(--text-tertiary)', cursor: 'pointer', transition: 'color 150ms' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent-red)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; }}
              >
                <Trash2 size={13} />
              </button>
              <OverflowMenu
                stopPropagation
                items={[
                  { label: 'Delete lead', icon: <Trash2 size={14} />, onClick: () => onDelete(lead.id, { stopPropagation: () => {} }), destructive: true },
                ]}
              />
            </div>
          </div>
        ))}
      </div>
      <LoadMore hasMore={hasMore} onLoadMore={loadMore} shown={shown} total={total} showFooter={false} />
    </div>
  );
}

// ─── ADD/EDIT POST FORM ───
function AddPostForm({ currentUser, mode, existing, onClose, onCreated }: {
  currentUser: { id: string; ownerId: string } | null; mode: 'personal' | 'agency'; existing?: SocialPost;
  onClose: () => void; onCreated: (post: SocialPost) => void;
}) {
  const supabase = useRef(createClient()).current;
  const [title, setTitle] = useState(existing?.title || '');
  const [content, setContent] = useState(existing?.content || '');
  const [date, setDate] = useState(existing?.planned_date || '');
  const [status, setStatus] = useState<SocialPostStatus>(existing?.status || 'idea');
  // datetime-local needs `YYYY-MM-DDTHH:mm` (local time, no Z).
  // Convert any incoming ISO timestamp to that shape; emit ISO on save.
  const [postedAt, setPostedAt] = useState<string>(() => {
    if (!existing?.posted_at) return '';
    const d = new Date(existing.posted_at);
    if (isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });
  const [saving, setSaving] = useState(false);

  // Auto-fill posted_at the first time the user picks "published" so
  // they aren't forced to type the timestamp manually. They can still
  // edit the resulting value before saving.
  function handleStatusChange(next: SocialPostStatus) {
    if (next === 'published' && !postedAt) {
      const d = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      setPostedAt(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`);
    }
    setStatus(next);
  }

  async function handleSave() {
    if (!currentUser) return;
    setSaving(true);
    // Convert datetime-local back to ISO. If the user cleared the
    // field or the post is no longer published, send null.
    const postedAtIso = (status === 'published' && postedAt)
      ? new Date(postedAt).toISOString()
      : null;
    const res = existing
      ? await updateSocialPost(existing.id, {
          title,
          content,
          planned_date: date || null,
          posted_at: postedAtIso,
          status,
        })
      : await createSocialPost({
          mode,
          platform: 'linkedin',
          title,
          content,
          planned_date: date || null,
          posted_at: postedAtIso,
          status,
        });
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error || 'Could not save post');
      return;
    }
    onCreated(res.data);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Input label="Title / Topic" value={title} onChange={e => setTitle(e.target.value)}
        placeholder="What's the post about?" autoFocus />
      <Textarea label="Content" value={content} onChange={e => setContent(e.target.value)}
        placeholder="Write the post or notes..." style={{ minHeight: 120 }} />
      <div className="rgrid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Input label="Planned Date" type="date" value={date} onChange={e => setDate(e.target.value)} />
        <Select label="Status" value={status} onChange={e => handleStatusChange(e.target.value as SocialPostStatus)}
          options={[
            { value: 'idea', label: 'Idea' }, { value: 'draft', label: 'Draft' },
            { value: 'scheduled', label: 'Scheduled' }, { value: 'published', label: 'Published' },
          ]} />
      </div>
      {/* Posted At — only meaningful for published posts. Auto-fills
          on first transition to "Published" so users don't have to
          type a timestamp; they can adjust before saving. */}
      {status === 'published' && (
        <Input label="Posted Date and Time" type="datetime-local"
          value={postedAt} onChange={e => setPostedAt(e.target.value)} />
      )}
      <div style={{ display: 'flex', gap: 10, paddingTop: 16 }}>
        <Button variant="secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</Button>
        <Button onClick={handleSave} loading={saving} style={{ flex: 1 }}>{existing ? 'Save Changes' : 'Save'}</Button>
      </div>
    </div>
  );
}

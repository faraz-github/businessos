// Agency Content page — standalone, content calendar only.
// Contacts pipeline is handled inside BD Pipeline (Contacts tab).
'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useBrand } from '@/lib/brand';
import { useCurrentUser } from '@/lib/auth/use-auth';
import { createClient } from '@/lib/supabase/client';
import { PageTransition } from '@/components/dashboard/PageTransition';
import { Button, Input, Textarea, Select, Modal, OverflowMenu, LoadMore, useLoadMore } from '@/components/ui';
import { toast } from '@/components/ui/Toast';
import { formatDate, formatDateTime } from '@/lib/utils';
import {
  Plus, Calendar, Lightbulb, Check, Pencil, Trash2, ArrowRight,
  Linkedin, Instagram, Share2,
} from 'lucide-react';
import type { SocialPost, SocialPlatform, SocialPostStatus } from '@/types';
import {
  createSocialPost,
  updateSocialPost,
  updateSocialPostStatus,
  deleteSocialPost,
} from '@/app/dashboard/actions/social';

const CONTENT_PLATFORMS: { value: string; label: string; color: string; icon: React.ReactNode }[] = [
  { value: 'linkedin',  label: 'LinkedIn',  color: 'var(--accent-blue)',   icon: <Linkedin size={12} /> },
  { value: 'instagram', label: 'Instagram', color: 'var(--accent-violet)', icon: <Instagram size={12} /> },
  { value: 'other',     label: 'Other',     color: 'var(--text-tertiary)', icon: <Share2 size={12} /> },
];
const PLATFORM_MAP = Object.fromEntries(CONTENT_PLATFORMS.map(p => [p.value, p]));

export default function AgencyContentPage() {
  const { mode } = useBrand();
  const { user: currentUser } = useCurrentUser();
  const supabaseRef = useRef(createClient());
  const supabase    = supabaseRef.current;

  const [posts, setPosts]           = useState<SocialPost[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showAdd, setShowAdd]       = useState(false);
  const [editingPost, setEditingPost] = useState<SocialPost | null>(null);

  const load = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    const { data } = await supabase.from('social_posts').select('*')
      .eq('user_id', currentUser.ownerId).eq('mode', mode)
      .order('planned_date', { ascending: true });
    setPosts((data as SocialPost[]) || []);
    setLoading(false);
  }, [currentUser, mode, supabase]);

  useEffect(() => { load(); }, [load]);

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

  const now       = new Date();
  const thisMonth = posts.filter(p => {
    if (p.status !== 'published' || !p.planned_date) return false;
    const d = new Date(p.planned_date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;
  const scheduled = posts.filter(p => p.status === 'scheduled').length;
  const drafts    = posts.filter(p => p.status === 'draft').length;
  const ideas     = posts.filter(p => p.status === 'idea').length;

  // Memoized lists + pagination
  const scheduledPosts = useMemo(() => posts.filter(p => p.status !== 'idea'), [posts]);
  const ideaPosts      = useMemo(() => posts.filter(p => p.status === 'idea'), [posts]);
  const scheduledPage  = useLoadMore(scheduledPosts, { pageSize: 20 });
  const ideaPage       = useLoadMore(ideaPosts,      { pageSize: 10 });

  return (
    <PageTransition>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <h1 className="t-h1">Content</h1>
            <p className="t-xs text-secondary" style={{ marginTop: 4 }}>Plan and publish agency brand content across channels.</p>
          </div>
          <Button icon={<Plus size={14} />} onClick={() => setShowAdd(true)}>New Post</Button>
        </div>

        {/* Stats */}
        <div className="rgrid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          {([
            { label: 'Published this month', value: thisMonth, color: 'var(--accent-green)' },
            { label: 'Scheduled',            value: scheduled, color: 'var(--accent-blue)' },
            { label: 'Drafts',               value: drafts,    color: 'var(--accent-amber)' },
            { label: 'Ideas',                value: ideas,     color: 'var(--accent-violet)' },
          ] as { label: string; value: number; color: string }[]).map(({ label, value, color }) => (
            <div key={label} className="card" style={{ padding: '13px 16px' }}>
              <p className="t-label" style={{ marginBottom: 6 }}>{label}</p>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800, color, lineHeight: 1 }}>{value}</p>
            </div>
          ))}
        </div>

        {/* Calendar + Ideas layout */}
        <div className="rgrid-main-aside" style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 24, alignItems: 'start' }}>

          {/* Scheduled & Published — left */}
          <div>
            <p className="t-label" style={{ marginBottom: 12 }}>Scheduled &amp; Published</p>
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[1, 2, 3].map(i => <div key={i} className="card" style={{ height: 58, background: 'var(--bg-hover)', animation: 'ds-pulse 1.5s ease-in-out infinite' }} />)}
              </div>
            ) : posts.filter(p => p.status !== 'idea').length === 0 ? (
              <div className="card" style={{ padding: '40px 24px', textAlign: 'center' }}>
                <Calendar size={28} style={{ color: 'var(--text-tertiary)', margin: '0 auto 12px' }} />
                <p className="t-sm-semibold" style={{ marginBottom: 4 }}>No posts scheduled</p>
                <p className="t-xs text-secondary" style={{ marginBottom: 16 }}>Plan your agency brand content across LinkedIn and Instagram.</p>
                <Button variant="secondary" icon={<Plus size={13} />} onClick={() => setShowAdd(true)}>Add a post</Button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {scheduledPage.paginated.map(post => {
                  const statusColor = post.status === 'published' ? 'var(--accent-green)'
                    : post.status === 'scheduled' ? 'var(--accent-blue)' : 'var(--accent-amber)';
                  const platCfg = PLATFORM_MAP[post.platform] || PLATFORM_MAP.other;
                  return (
                    <div key={post.id} className="card dense-row"
                      style={{ padding: '13px 18px' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; }}>
                      <div className="dense-row__lead" style={{ width: 3, alignSelf: 'stretch', borderRadius: 2, background: statusColor }} />
                      <div className="dense-row__body">
                        <div className="dense-row__title">
                          <span className="t-xs-medium dense-row__name">
                            {post.title || 'Untitled'}
                          </span>
                          <span className="chip-opt-out" style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 600, color: platCfg.color, background: `${platCfg.color}14`, padding: '1px 7px', borderRadius: 100, flexShrink: 0 }}>
                            {platCfg.icon} {platCfg.label}
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
                        <span className="chip-opt-out" style={{ padding: '2px 8px', borderRadius: 100, fontSize: 10, fontWeight: 600, textTransform: 'capitalize' as const, background: `${statusColor}14`, color: statusColor }}>
                          {post.status}
                        </span>
                        {post.status !== 'published' && (
                          <button onClick={() => updatePostStatus(post.id, 'published')} aria-label="Mark published"
                            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: 4, borderRadius: 'var(--radius-sm)', border: 'none', background: 'transparent', color: 'var(--text-tertiary)', cursor: 'pointer', transition: 'color 150ms' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent-green)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; }}>
                            <Check size={13} /><span className="row-btn-label">Publish</span>
                          </button>
                        )}
                        <button onClick={() => setEditingPost(post)} aria-label="Edit"
                          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: 4, borderRadius: 'var(--radius-sm)', border: 'none', background: 'transparent', color: 'var(--text-tertiary)', cursor: 'pointer', transition: 'color 150ms' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent-blue)'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; }}>
                          <Pencil size={13} /><span className="row-btn-label">Edit</span>
                        </button>
                        <button onClick={() => deletePost(post.id)} aria-label="Delete"
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
            <p className="t-label" style={{ marginBottom: 12 }}>Ideas Parking Lot</p>
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {ideaPosts.length === 0 ? (
                <p className="t-xs text-tertiary" style={{ fontStyle: 'italic' }}>Jot down content ideas here.</p>
              ) : (
                ideaPage.paginated.map((idea, i, arr) => (
                  <div key={idea.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 0', borderBottom: i < arr.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                    <Lightbulb size={13} style={{ color: 'var(--accent-amber)', flexShrink: 0, marginTop: 2 }} />
                    <span className="t-xs text-primary" style={{ flex: 1 }}>{idea.title || idea.content || 'Untitled idea'}</span>
                    <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                      <button onClick={() => updatePostStatus(idea.id, 'draft')} title="Move to draft"
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
      </div>

      {/* Modals */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="New Post" size="md">
        <PostForm currentUser={currentUser} mode={mode}
          onClose={() => setShowAdd(false)}
          onSaved={post => { setPosts(prev => [...prev, post].sort((a, b) => (a.planned_date || '').localeCompare(b.planned_date || ''))); setShowAdd(false); }} />
      </Modal>

      {editingPost && (
        <Modal open={true} onClose={() => setEditingPost(null)} title="Edit Post" size="md">
          <PostForm currentUser={currentUser} mode={mode} existing={editingPost}
            onClose={() => setEditingPost(null)}
            onSaved={post => { setPosts(prev => prev.map(p => p.id === post.id ? post : p)); setEditingPost(null); }} />
        </Modal>
      )}
    </PageTransition>
  );
}

function AddIdeaInline({ onAdd }: { onAdd: (title: string) => Promise<void> }) {
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  async function handleAdd() {
    if (!text.trim()) return;
    setSaving(true);
    await onAdd(text.trim());
    setText(''); setSaving(false);
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border-subtle)' }}>
      <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAdd()}
        placeholder="Add an idea..."
        style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 12, color: 'var(--text-primary)', fontFamily: 'var(--font-body)' }} />
      <button onClick={handleAdd} disabled={!text.trim() || saving}
        style={{ display: 'flex', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--accent-blue)', opacity: !text.trim() ? 0.3 : 1, transition: 'opacity 150ms' }}>
        <Plus size={14} />
      </button>
    </div>
  );
}

function PostForm({ currentUser, mode, existing, onClose, onSaved }: {
  currentUser: { ownerId: string } | null; mode: 'personal' | 'agency'; existing?: SocialPost;
  onClose: () => void; onSaved: (post: SocialPost) => void;
}) {
  const [title, setTitle]       = useState(existing?.title || '');
  const [content, setContent]   = useState(existing?.content || '');
  const [date, setDate]         = useState(existing?.planned_date || '');
  const [status, setStatus]     = useState<SocialPostStatus>(existing?.status || 'idea');
  const [platform, setPlatform] = useState<SocialPlatform>(existing?.platform || 'linkedin');
  const [postedAt, setPostedAt] = useState<string>(() => {
    if (!existing?.posted_at) return '';
    const d = new Date(existing.posted_at);
    if (isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });
  const [saving, setSaving]     = useState(false);

  // Auto-fill posted_at the first time the user picks "published".
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
          platform,
        })
      : await createSocialPost({
          mode,
          platform,
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
    onSaved(res.data);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Input label="Title / Topic" value={title} onChange={e => setTitle(e.target.value)} placeholder="What's the post about?" autoFocus />
      <Textarea label="Content" value={content} onChange={e => setContent(e.target.value)} placeholder="Write the post or notes..." style={{ minHeight: 110 }} />
      <div>
        <label className="t-label" style={{ display: 'block', marginBottom: 7 }}>Platform</label>
        <div style={{ display: 'flex', gap: 6 }}>
          {CONTENT_PLATFORMS.map(p => (
            <button key={p.value} type="button" onClick={() => setPlatform(p.value as SocialPlatform)}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 'var(--radius-sm)', border: `1px solid ${platform === p.value ? p.color : 'var(--border-default)'}`, background: platform === p.value ? `${p.color}14` : 'transparent', color: platform === p.value ? p.color : 'var(--text-secondary)', fontSize: 11, fontWeight: platform === p.value ? 600 : 400, fontFamily: 'var(--font-body)', cursor: 'pointer', transition: 'all 150ms' }}>
              {p.icon} {p.label}
            </button>
          ))}
        </div>
      </div>
      <div className="rgrid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Input label="Planned Date" type="date" value={date} onChange={e => setDate(e.target.value)} />
        <Select label="Status" value={status} onChange={e => handleStatusChange(e.target.value as SocialPostStatus)}
          options={[
            { value: 'idea', label: 'Idea' }, { value: 'draft', label: 'Draft' },
            { value: 'scheduled', label: 'Scheduled' }, { value: 'published', label: 'Published' },
          ]} />
      </div>
      {status === 'published' && (
        <Input label="Posted Date and Time" type="datetime-local"
          value={postedAt} onChange={e => setPostedAt(e.target.value)} />
      )}
      <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
        <Button variant="secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</Button>
        <Button onClick={handleSave} loading={saving} style={{ flex: 1 }}>{existing ? 'Save Changes' : 'Save'}</Button>
      </div>
    </div>
  );
}

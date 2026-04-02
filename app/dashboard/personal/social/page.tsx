'use client';

import { useState, useEffect } from 'react';
import { useBrand } from '@/lib/brand';
import { useCurrentUser } from '@/lib/auth/use-auth';
import { createClient } from '@/lib/supabase/client';
import { PageTransition } from '@/components/dashboard/PageTransition';
import { Card, Badge, Button, Tabs, Input, Textarea, Modal, EmptyState } from '@/components/ui';
import { cn, formatDate } from '@/lib/utils';
import { Plus, Calendar, Lightbulb, CheckCircle, Circle, ExternalLink } from 'lucide-react';
import type { SocialPost, ProfileReview } from '@/types';

export default function PersonalSocialPage() {
  const { mode } = useBrand();
  const { user: currentUser } = useCurrentUser();
  const [activeTab, setActiveTab] = useState('linkedin');
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [reviews, setReviews] = useState<ProfileReview[]>([]);
  const [showNewPost, setShowNewPost] = useState(false);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const user = currentUser;
      if (!user) return;

      const { data: postsData } = await supabase
        .from('social_posts')
        .select('*')
        .eq('user_id', user.id)
        .eq('mode', mode)
        .eq('platform', activeTab)
        .order('planned_date', { ascending: true });

      setPosts((postsData as SocialPost[]) || []);

      const { data: reviewData } = await supabase
        .from('profile_reviews')
        .select('*')
        .eq('user_id', user.id)
        .eq('platform', activeTab);

      setReviews((reviewData as ProfileReview[]) || []);
      setLoading(false);
    }
    fetchData();
  }, [mode, activeTab, supabase]);

  const statusColors: Record<string, string> = {
    idea: 'outline',
    draft: 'amber',
    scheduled: 'blue',
    published: 'green',
  };

  const calendarPosts = posts.filter((p) => p.status !== 'idea');
  const ideaPosts = posts.filter((p) => p.status === 'idea');
  const publishedCount = posts.filter((p) => p.status === 'published').length;

  return (
    <PageTransition>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="t-h1">Social & Brand</h1>
            <p className="text-[13px] text-[var(--text-secondary)] mt-1">Manage your personal brand across platforms.</p>
          </div>
          <Button icon={<Plus size={14} />} onClick={() => setShowNewPost(true)}>New Post</Button>
        </div>

        <Tabs
          tabs={[
            { value: 'linkedin', label: 'LinkedIn' },
            { value: 'github', label: 'GitHub' },
          ]}
          value={activeTab}
          onChange={setActiveTab}
        />

        <div className="grid grid-cols-3 gap-4">
          {/* Calendar */}
          <div className="col-span-2 space-y-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
              {activeTab === 'linkedin' ? 'Content Calendar' : 'Review Checklist'}
            </h2>

            {activeTab === 'linkedin' ? (
              calendarPosts.length === 0 ? (
                <Card><EmptyState icon={<Calendar />} title="No posts scheduled" description="Add your first post to start tracking." /></Card>
              ) : (
                <div className="flex flex-col gap-2">
                  {calendarPosts.map((post) => (
                    <Card key={post.id} variant="base" className="flex items-center gap-3">
                      <div className="w-1 h-10 rounded-full" style={{ background: post.status === 'published' ? 'var(--accent-green)' : 'var(--accent-blue)' }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-[var(--text-primary)] truncate">{post.title || 'Untitled'}</p>
                        <p className="text-[11px] text-[var(--text-tertiary)]">{post.planned_date ? formatDate(post.planned_date) : 'No date'}</p>
                      </div>
                      <Badge variant={statusColors[post.status] as any}>{post.status}</Badge>
                    </Card>
                  ))}
                </div>
              )
            ) : (
              <div className="flex flex-col gap-2">
                {reviews.length === 0 ? (
                  <Card><EmptyState icon={<CheckCircle />} title="No review items" description="Set up your GitHub profile review checklist." /></Card>
                ) : (
                  reviews.map((review) => (
                    <Card key={review.id} variant="base" className="flex items-center gap-3">
                      {review.completed ? (
                        <CheckCircle size={16} className="text-[var(--accent-green)] shrink-0" />
                      ) : (
                        <Circle size={16} className="text-[var(--text-tertiary)] shrink-0" />
                      )}
                      <div className="flex-1">
                        <p className="text-[13px] text-[var(--text-primary)]">{review.section}</p>
                        {review.next_review_at && (
                          <p className="text-[10px] text-[var(--text-tertiary)]">Next review: {formatDate(review.next_review_at)}</p>
                        )}
                      </div>
                    </Card>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Sidebar: Stats + Ideas */}
          <div className="flex flex-col gap-3">
            <Card variant="metric">
              <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-tertiary)] mb-2">
                {activeTab === 'linkedin' ? 'Post Streak' : 'Review Status'}
              </p>
              <p style={{ fontFamily: "Space Grotesk, sans-serif", fontSize: 30, fontWeight: 800, letterSpacing: "-0.5px", color: "var(--text-primary)" }}>{publishedCount}</p>
              <p className="text-[11px] text-[var(--text-secondary)]">published this month</p>
            </Card>

            <Card variant="base">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
                  Ideas Parking Lot
                </p>
                <button className="text-[var(--accent-blue)]"><Plus size={14} /></button>
              </div>
              {ideaPosts.length === 0 ? (
                <p className="text-[12px] text-[var(--text-tertiary)] italic">No ideas yet. Jot something down.</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {ideaPosts.map((idea) => (
                    <div key={idea.id} className="flex items-center gap-2 py-1.5 px-2 rounded-[var(--radius-sm)] hover:bg-[var(--bg-hover)] cursor-pointer transition-colors">
                      <Lightbulb size={12} className="text-[var(--accent-amber)] shrink-0" />
                      <span className="text-[12px] text-[var(--text-primary)] truncate">{idea.title || idea.content || 'Untitled idea'}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>

      {/* New Post Modal */}
      <Modal open={showNewPost} onClose={() => setShowNewPost(false)} title="New Post" size="md">
        <NewPostForm
          mode={mode}
          platform={activeTab}
          onClose={() => setShowNewPost(false)}
          onCreated={(post) => { setPosts((prev) => [...prev, post]); setShowNewPost(false); }}
        />
      </Modal>
    </PageTransition>
  );
}

function NewPostForm({ mode, platform, onClose, onCreated }: { mode: string; platform: string; onClose: () => void; onCreated: (post: SocialPost) => void }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [date, setDate] = useState('');
  const [status, setStatus] = useState<string>('idea');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    const supabase = createClient();
    const user = currentUser;
    if (!user) return;

    const { data, error } = await supabase
      .from('social_posts')
      .insert({
        user_id: user.id,
        mode,
        platform,
        title,
        content,
        planned_date: date || null,
        status,
      })
      .select()
      .single();

    if (!error && data) onCreated(data as SocialPost);
    setSaving(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Post title or topic" />
      <Textarea label="Content" value={content} onChange={(e) => setContent(e.target.value)} placeholder="Write your post or notes..." />
      <div className="grid grid-cols-2 gap-3">
        <Input label="Planned Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--text-tertiary)]">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[var(--radius-md)] px-3 py-2 text-[13px] text-[var(--text-primary)] outline-none"
          >
            <option value="idea">Idea</option>
            <option value="draft">Draft</option>
            <option value="scheduled">Scheduled</option>
            <option value="published">Published</option>
          </select>
        </div>
      </div>
      <div className="flex gap-2 pt-2">
        <Button variant="secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</Button>
        <Button onClick={handleSave} loading={saving} style={{ flex: 1 }}>Save Post</Button>
      </div>
    </div>
  );
}

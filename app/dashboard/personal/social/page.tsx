'use client';

import { useState, useEffect } from 'react';
import { useBrand } from '@/lib/brand';
import { useCurrentUser } from '@/lib/auth/use-auth';
import { createClient } from '@/lib/supabase/client';
import { PageTransition } from '@/components/dashboard/PageTransition';
import { Card, Badge, Button, Tabs, Input, Textarea, Modal, Select, EmptyState } from '@/components/ui';
import { formatDate } from '@/lib/utils';
import { Plus, Calendar, Lightbulb, CheckCircle, Circle } from 'lucide-react';
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
      if (!currentUser) return;
      const { data: postsData } = await supabase
        .from('social_posts').select('*')
        .eq('user_id', currentUser.id).eq('mode', mode).eq('platform', activeTab)
        .order('planned_date', { ascending: true });
      setPosts((postsData as SocialPost[]) || []);
      const { data: reviewData } = await supabase
        .from('profile_reviews').select('*')
        .eq('user_id', currentUser.id).eq('platform', activeTab);
      setReviews((reviewData as ProfileReview[]) || []);
      setLoading(false);
    }
    fetchData();
  }, [mode, activeTab, currentUser]);

  const statusColors: Record<string, string> = {
    idea: 'outline', draft: 'amber', scheduled: 'blue', published: 'green',
  };

  const calendarPosts = posts.filter((p) => p.status !== 'idea');
  const ideaPosts = posts.filter((p) => p.status === 'idea');
  const publishedCount = posts.filter((p) => p.status === 'published').length;

  return (
    <PageTransition>
      <div className="flex flex-col gap-9">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="t-h1">Social & Brand</h1>
            <p className="t-xs mt-1">Manage your personal brand across platforms.</p>
          </div>
          <Button icon={<Plus size={14} />} onClick={() => setShowNewPost(true)}>New Post</Button>
        </div>

        <Tabs
          tabs={[{ value: 'linkedin', label: 'LinkedIn' }, { value: 'github', label: 'GitHub' }]}
          value={activeTab}
          onChange={setActiveTab}
        />

        <div className="grid grid-cols-3 gap-4">
          {/* Calendar / Checklist */}
          <div className="col-span-2 flex flex-col gap-3">
            <h2 className="t-label">
              {activeTab === 'linkedin' ? 'Content Calendar' : 'Review Checklist'}
            </h2>
            {activeTab === 'linkedin' ? (
              calendarPosts.length === 0 ? (
                <Card><EmptyState icon={<Calendar />} title="No posts scheduled" description="Add your first post to start tracking." /></Card>
              ) : (
                <div className="flex flex-col gap-3">
                  {calendarPosts.map((post) => (
                    <Card key={post.id} variant="base" className="flex items-center gap-3">
                      <div className="w-1 h-10 rounded-full shrink-0"
                        style={{ background: post.status === 'published' ? 'var(--accent-green)' : 'var(--accent-blue)' }} />
                      <div className="flex-1 min-w-0">
                        <p className="t-sm-medium truncate">{post.title || 'Untitled'}</p>
                        <p className="t-2xs text-tertiary">{post.planned_date ? formatDate(post.planned_date) : 'No date'}</p>
                      </div>
                      <Badge variant={statusColors[post.status] as any}>{post.status}</Badge>
                    </Card>
                  ))}
                </div>
              )
            ) : (
              <div className="flex flex-col gap-3">
                {reviews.length === 0 ? (
                  <Card><EmptyState icon={<CheckCircle />} title="No review items" description="Set up your GitHub profile review checklist." /></Card>
                ) : (
                  reviews.map((review) => (
                    <Card key={review.id} variant="base" className="flex items-center gap-3">
                      {review.completed
                        ? <CheckCircle size={16} style={{ color: 'var(--accent-green)' }} className="shrink-0" />
                        : <Circle size={16} className="text-tertiary shrink-0" />}
                      <div className="flex-1">
                        <p className="t-sm">{review.section}</p>
                        {review.next_review_at && (
                          <p className="t-2xs text-tertiary">Next review: {formatDate(review.next_review_at)}</p>
                        )}
                      </div>
                    </Card>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Stats + Ideas */}
          <div className="flex flex-col gap-4">
            <Card variant="metric">
              <p className="t-label section-gap">{activeTab === 'linkedin' ? 'Post Streak' : 'Review Status'}</p>
              <p className="t-metric">{publishedCount}</p>
              <p className="t-2xs mt-1">published this month</p>
            </Card>
            <Card variant="base">
              <div className="flex items-center justify-between mb-3">
                <p className="t-label">Ideas Parking Lot</p>
                <button style={{ color: 'var(--accent-blue)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}>
                  <Plus size={14} />
                </button>
              </div>
              {ideaPosts.length === 0 ? (
                <p className="t-xs text-tertiary" style={{ fontStyle: 'italic' }}>No ideas yet. Jot something down.</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {ideaPosts.map((idea) => (
                    <div key={idea.id} className="flex items-center gap-2 py-1.5 px-2 radius-sm hover-bg-hover cursor-pointer interactive">
                      <Lightbulb size={12} style={{ color: 'var(--accent-amber)', flexShrink: 0 }} />
                      <span className="t-xs text-primary truncate">{idea.title || idea.content || 'Untitled idea'}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>

      <Modal open={showNewPost} onClose={() => setShowNewPost(false)} title="New Post" size="md">
        <NewPostForm
          mode={mode}
          platform={activeTab}
          currentUser={currentUser}
          onClose={() => setShowNewPost(false)}
          onCreated={(post) => { setPosts((prev) => [...prev, post]); setShowNewPost(false); }}
        />
      </Modal>
    </PageTransition>
  );
}

/* Fix #2 + #4 + #5: currentUser passed as prop, raw <select> replaced with <Select> */
function NewPostForm({ mode, platform, currentUser, onClose, onCreated }: {
  mode: string; platform: string; currentUser: any;
  onClose: () => void; onCreated: (post: SocialPost) => void;
}) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [date, setDate] = useState('');
  const [status, setStatus] = useState('idea');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!currentUser) return;
    setSaving(true);
    const supabase = createClient();
    const { data, error } = await supabase.from('social_posts')
      .insert({ user_id: currentUser.id, mode, platform, title, content, planned_date: date || null, status })
      .select().single();
    if (!error && data) onCreated(data as SocialPost);
    setSaving(false);
  }

  return (
    <div className="flex flex-col gap-5">
      <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Post title or topic" />
      <Textarea label="Content" value={content} onChange={(e) => setContent(e.target.value)} placeholder="Write your post or notes..." />
      <div className="grid grid-cols-2 gap-4">
        <Input label="Planned Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <Select
          label="Status"
          options={[
            { value: 'idea', label: 'Idea' },
            { value: 'draft', label: 'Draft' },
            { value: 'scheduled', label: 'Scheduled' },
            { value: 'published', label: 'Published' },
          ]}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        />
      </div>
      <div className="flex gap-2 pt-2 border-t-subtle">
        <Button variant="secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</Button>
        <Button onClick={handleSave} loading={saving} style={{ flex: 1 }}>Save Post</Button>
      </div>
    </div>
  );
}

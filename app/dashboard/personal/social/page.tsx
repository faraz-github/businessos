'use client';

import { useState, useEffect } from 'react';
import { useBrand } from '@/lib/brand';
import { useCurrentUser } from '@/lib/auth/use-auth';
import { createClient } from '@/lib/supabase/client';
import { PageTransition } from '@/components/dashboard/PageTransition';
import { Card, Badge, Button, Tabs, Input, Textarea, Select, Modal, EmptyState } from '@/components/ui';
import { formatDate, formatRelative } from '@/lib/utils';
import {
  Plus, Linkedin, FileText, Calendar, Lightbulb,
  CheckCircle, Circle, MessageCircle, UserCheck, Clock,
} from 'lucide-react';
import type { SocialPost } from '@/types';

/* ── LinkedIn outreach lead (not the same as agency BD lead) ──
   These are individuals found on LinkedIn for freelance work. */
interface OutreachLead {
  id: string;
  name: string;
  profile_url: string | null;
  company: string | null;
  requirement: string | null;
  status: 'found' | 'connected' | 'intro_sent' | 'replied' | 'call_scheduled' | 'converted' | 'not_interested';
  notes: string | null;
  found_at: string;
  updated_at: string;
}

const OUTREACH_STATUSES: { value: OutreachLead['status']; label: string; color: string }[] = [
  { value: 'found',           label: 'Found',            color: 'var(--text-tertiary)' },
  { value: 'connected',       label: 'Connected',        color: 'var(--accent-blue)' },
  { value: 'intro_sent',      label: 'Intro Sent',       color: 'var(--accent-violet)' },
  { value: 'replied',         label: 'Replied',          color: 'var(--accent-amber)' },
  { value: 'call_scheduled',  label: 'Call Scheduled',   color: 'var(--accent-amber)' },
  { value: 'converted',       label: 'Converted → Client', color: 'var(--accent-green)' },
  { value: 'not_interested',  label: 'Not Interested',   color: 'var(--text-tertiary)' },
];

const STATUS_BADGE: Record<OutreachLead['status'], string> = {
  found: 'outline', connected: 'blue', intro_sent: 'violet',
  replied: 'amber', call_scheduled: 'amber', converted: 'green', not_interested: 'outline',
};

export default function OutreachPage() {
  const { mode } = useBrand();
  const { user: currentUser } = useCurrentUser();
  const supabase = createClient();

  const [activeTab, setActiveTab] = useState<'pipeline' | 'content'>('pipeline');
  const [leads, setLeads] = useState<OutreachLead[]>([]);
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [showAddLead, setShowAddLead] = useState(false);
  const [showAddPost, setShowAddPost] = useState(false);
  const [selectedLead, setSelectedLead] = useState<OutreachLead | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!currentUser) return;
      setLoading(true);

      const [{ data: leadsData }, { data: postsData }] = await Promise.all([
        supabase.from('outreach_leads').select('*').eq('user_id', currentUser.id)
          .eq('mode', mode).order('found_at', { ascending: false }),
        supabase.from('social_posts').select('*').eq('user_id', currentUser.id)
          .eq('mode', mode).eq('platform', 'linkedin').order('planned_date', { ascending: true }),
      ]);

      setLeads((leadsData as OutreachLead[]) || []);
      setPosts((postsData as SocialPost[]) || []);
      setLoading(false);
    }
    load();
  }, [currentUser, mode]);

  /* Pipeline stats */
  const active = leads.filter(l => !['converted', 'not_interested'].includes(l.status));
  const converted = leads.filter(l => l.status === 'converted').length;
  const replied = leads.filter(l => ['replied', 'call_scheduled'].includes(l.status)).length;

  /* Group pipeline by status for a lightweight kanban-style view */
  const PIPELINE_STAGES = OUTREACH_STATUSES.filter(s => !['converted', 'not_interested'].includes(s.value));

  return (
    <PageTransition>
      <div className="flex flex-col gap-9">

        {/* Page header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="t-h1">Outreach</h1>
            <p className="t-xs mt-1">LinkedIn pipeline and personal brand content.</p>
          </div>
          <div className="flex gap-2">
            {activeTab === 'pipeline'
              ? <Button icon={<Plus size={14} />} onClick={() => setShowAddLead(true)}>Add Lead</Button>
              : <Button icon={<Plus size={14} />} onClick={() => setShowAddPost(true)}>New Post</Button>
            }
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Active in pipeline', value: active.length, color: 'var(--accent-blue)' },
            { label: 'Replied / In convo', value: replied, color: 'var(--accent-amber)' },
            { label: 'Converted to clients', value: converted, color: 'var(--accent-green)' },
            { label: 'Posts this month', value: posts.filter(p => p.status === 'published').length, color: 'var(--accent-violet)' },
          ].map(({ label, value, color }) => (
            <div key={label} className="card">
              <p className="t-label sub-label-gap">{label}</p>
              <p className="t-metric" style={{ color }}>{value}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <Tabs
          tabs={[
            { value: 'pipeline', label: 'LinkedIn Pipeline' },
            { value: 'content',  label: 'Content Calendar' },
          ]}
          value={activeTab}
          onChange={v => setActiveTab(v as any)}
        />

        {/* ── PIPELINE TAB ── */}
        {activeTab === 'pipeline' && (
          <div>
            {leads.length === 0 ? (
              <Card>
                <EmptyState
                  icon={<Linkedin />}
                  title="No leads tracked yet"
                  description="When you find someone on LinkedIn, add them here to track the conversation."
                  action={<Button icon={<Plus size={14} />} onClick={() => setShowAddLead(true)}>Add Lead</Button>}
                />
              </Card>
            ) : (
              <div className="flex flex-col gap-3">
                {/* Active leads grouped by status */}
                {PIPELINE_STAGES.map(stage => {
                  const stageLeads = leads.filter(l => l.status === stage.value);
                  if (stageLeads.length === 0) return null;
                  return (
                    <div key={stage.value}>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: stage.color }} />
                        <p className="t-label">{stage.label}</p>
                        <span className="t-mono-sm">{stageLeads.length}</span>
                      </div>
                      <div className="flex flex-col gap-2">
                        {stageLeads.map(lead => (
                          <div key={lead.id} className="card interactive hover-bg-hover cursor-pointer"
                            style={{ padding: '14px 18px' }}
                            onClick={() => setSelectedLead(lead)}>
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="t-sm-semibold">{lead.name}</span>
                                  {lead.company && <span className="t-2xs text-tertiary">· {lead.company}</span>}
                                </div>
                                {lead.requirement && (
                                  <p className="t-xs truncate" style={{ color: 'var(--text-secondary)' }}>{lead.requirement}</p>
                                )}
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="t-mono-sm">{formatRelative(lead.updated_at)}</span>
                                <Badge variant={STATUS_BADGE[lead.status] as any}>{stage.label}</Badge>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}

                {/* Converted / Not interested — collapsed */}
                {leads.filter(l => l.status === 'converted').length > 0 && (
                  <div>
                    <p className="t-label mb-2" style={{ color: 'var(--accent-green)' }}>
                      Converted ({leads.filter(l => l.status === 'converted').length})
                    </p>
                    <div className="flex flex-col gap-2">
                      {leads.filter(l => l.status === 'converted').map(lead => (
                        <div key={lead.id} className="card" style={{ padding: '12px 18px', opacity: 0.7 }}>
                          <div className="flex items-center justify-between">
                            <span className="t-sm-medium">{lead.name}</span>
                            <Badge variant="green">Converted</Badge>
                          </div>
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
          <div className="grid grid-cols-3 gap-6">
            {/* Calendar */}
            <div className="col-span-2 flex flex-col gap-3">
              <p className="t-label section-gap">Content Calendar</p>
              {posts.filter(p => p.status !== 'idea').length === 0 ? (
                <Card>
                  <EmptyState icon={<Calendar />} title="No posts scheduled"
                    description="Plan your LinkedIn content to stay visible." />
                </Card>
              ) : (
                <div className="flex flex-col gap-2">
                  {posts.filter(p => p.status !== 'idea').map(post => (
                    <div key={post.id} className="card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div className="w-1 self-stretch rounded-full shrink-0"
                        style={{ background: post.status === 'published' ? 'var(--accent-green)' : post.status === 'scheduled' ? 'var(--accent-blue)' : 'var(--border-default)' }} />
                      <div className="flex-1 min-w-0">
                        <p className="t-sm-medium truncate">{post.title || 'Untitled'}</p>
                        <p className="t-2xs text-tertiary">{post.planned_date ? formatDate(post.planned_date) : 'No date set'}</p>
                      </div>
                      <Badge variant={post.status === 'published' ? 'green' : post.status === 'scheduled' ? 'blue' : post.status === 'draft' ? 'amber' : 'outline'}>
                        {post.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Ideas sidebar */}
            <div className="flex flex-col gap-3">
              <p className="t-label section-gap">Ideas Parking Lot</p>
              <div className="card flex flex-col gap-3">
                {posts.filter(p => p.status === 'idea').length === 0 ? (
                  <p className="t-xs text-tertiary" style={{ fontStyle: 'italic' }}>Jot down post ideas here.</p>
                ) : (
                  posts.filter(p => p.status === 'idea').map(idea => (
                    <div key={idea.id} className="flex items-start gap-2">
                      <Lightbulb size={13} style={{ color: 'var(--accent-amber)', flexShrink: 0, marginTop: 2 }} />
                      <span className="t-xs text-primary">{idea.title || idea.content || 'Untitled idea'}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add Lead Modal */}
      <Modal open={showAddLead} onClose={() => setShowAddLead(false)} title="Add Outreach Lead" size="md">
        <AddLeadForm currentUser={currentUser} mode={mode}
          onClose={() => setShowAddLead(false)}
          onCreated={lead => { setLeads(prev => [lead, ...prev]); setShowAddLead(false); }} />
      </Modal>

      {/* Add Post Modal */}
      <Modal open={showAddPost} onClose={() => setShowAddPost(false)} title="New Post" size="md">
        <AddPostForm currentUser={currentUser} mode={mode}
          onClose={() => setShowAddPost(false)}
          onCreated={post => { setPosts(prev => [...prev, post]); setShowAddPost(false); }} />
      </Modal>

      {/* Lead Detail Modal */}
      {selectedLead && (
        <Modal open={true} onClose={() => setSelectedLead(null)} title={selectedLead.name}
          description={selectedLead.company || undefined} size="md">
          <LeadDetailView
            lead={selectedLead}
            onClose={() => setSelectedLead(null)}
            onUpdate={updated => {
              setLeads(prev => prev.map(l => l.id === updated.id ? updated : l));
              setSelectedLead(updated);
            }}
          />
        </Modal>
      )}
    </PageTransition>
  );
}

function AddLeadForm({ currentUser, mode, onClose, onCreated }: {
  currentUser: any; mode: string;
  onClose: () => void; onCreated: (lead: OutreachLead) => void;
}) {
  const supabase = createClient();
  const [name, setName] = useState('');
  const [profileUrl, setProfileUrl] = useState('');
  const [company, setCompany] = useState('');
  const [requirement, setRequirement] = useState('');
  const [status, setStatus] = useState<OutreachLead['status']>('found');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name || !currentUser) return;
    setSaving(true);
    const { data, error } = await supabase.from('outreach_leads')
      .insert({ user_id: currentUser.id, mode, name, profile_url: profileUrl || null, company: company || null, requirement: requirement || null, status })
      .select().single();
    if (!error && data) onCreated(data as OutreachLead);
    setSaving(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <Input label="Name" value={name} onChange={e => setName(e.target.value)} placeholder="John Smith" required />
        <Input label="Company / Role" value={company} onChange={e => setCompany(e.target.value)} placeholder="Acme Corp" />
      </div>
      <Input label="LinkedIn Profile URL" value={profileUrl} onChange={e => setProfileUrl(e.target.value)} placeholder="https://linkedin.com/in/..." />
      <Textarea label="Requirement / Context" value={requirement} onChange={e => setRequirement(e.target.value)} placeholder="What are they looking for? Any context from the post..." />
      <Select label="Current Status" value={status} onChange={e => setStatus(e.target.value as any)}
        options={OUTREACH_STATUSES.map(s => ({ value: s.value, label: s.label }))} />
      <div className="flex gap-2 border-t-subtle" style={{ paddingTop: 16 }}>
        <Button variant="secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</Button>
        <Button onClick={handleSave} loading={saving} style={{ flex: 1 }} disabled={!name}>Add Lead</Button>
      </div>
    </div>
  );
}

function LeadDetailView({ lead, onClose, onUpdate }: {
  lead: OutreachLead; onClose: () => void;
  onUpdate: (l: OutreachLead) => void;
}) {
  const supabase = createClient();
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

  return (
    <div className="flex flex-col gap-4">
      {lead.profile_url && (
        <a href={lead.profile_url} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-2 t-xs text-accent-blue" style={{ textDecoration: 'none' }}>
          <Linkedin size={13} /> View LinkedIn Profile
        </a>
      )}
      {lead.requirement && (
        <div>
          <p className="t-label sub-label-gap">Requirement</p>
          <p className="t-xs">{lead.requirement}</p>
        </div>
      )}
      <Select label="Status" value={status} onChange={e => setStatus(e.target.value as any)}
        options={OUTREACH_STATUSES.map(s => ({ value: s.value, label: s.label }))} />
      <Textarea label="Notes" value={notes} onChange={e => setNotes(e.target.value)}
        placeholder="Conversation notes, what they said, next steps..." style={{ minHeight: 100 }} />
      <div className="flex gap-2 border-t-subtle" style={{ paddingTop: 16 }}>
        <Button variant="secondary" onClick={onClose} style={{ flex: 1 }}>Close</Button>
        <Button onClick={handleSave} loading={saving} style={{ flex: 1 }}>Save</Button>
      </div>
    </div>
  );
}

function AddPostForm({ currentUser, mode, onClose, onCreated }: {
  currentUser: any; mode: string;
  onClose: () => void; onCreated: (post: SocialPost) => void;
}) {
  const supabase = createClient();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [date, setDate] = useState('');
  const [status, setStatus] = useState('idea');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!currentUser) return;
    setSaving(true);
    const { data, error } = await supabase.from('social_posts')
      .insert({ user_id: currentUser.id, mode, platform: 'linkedin', title, content, planned_date: date || null, status })
      .select().single();
    if (!error && data) onCreated(data as SocialPost);
    setSaving(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <Input label="Title / Topic" value={title} onChange={e => setTitle(e.target.value)} placeholder="What's the post about?" />
      <Textarea label="Content" value={content} onChange={e => setContent(e.target.value)} placeholder="Write the post or notes..." style={{ minHeight: 120 }} />
      <div className="grid grid-cols-2 gap-3">
        <Input label="Planned Date" type="date" value={date} onChange={e => setDate(e.target.value)} />
        <Select label="Status" value={status} onChange={e => setStatus(e.target.value)}
          options={[
            { value: 'idea', label: 'Idea' }, { value: 'draft', label: 'Draft' },
            { value: 'scheduled', label: 'Scheduled' }, { value: 'published', label: 'Published' },
          ]} />
      </div>
      <div className="flex gap-2 border-t-subtle" style={{ paddingTop: 16 }}>
        <Button variant="secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</Button>
        <Button onClick={handleSave} loading={saving} style={{ flex: 1 }}>Save</Button>
      </div>
    </div>
  );
}

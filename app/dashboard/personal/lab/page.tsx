'use client';

import { useState, useEffect } from 'react';
import { useBrand } from '@/lib/brand';
import { useCurrentUser } from '@/lib/auth/use-auth';
import { createClient } from '@/lib/supabase/client';
import { PageTransition } from '@/components/dashboard/PageTransition';
import { Card, Badge, Button, Tabs, Input, Textarea, Select, Modal, EmptyState } from '@/components/ui';
import { formatDate, formatRelative } from '@/lib/utils';
import {
  Plus, FlaskConical, Lightbulb, Wrench, BookOpen,
  CheckCircle2, Circle, ExternalLink, Archive, Zap,
} from 'lucide-react';

type ProjectStatus = 'idea' | 'active' | 'paused' | 'shipped' | 'archived';
type ToolStatus = 'evaluating' | 'using' | 'dropped';
type SkillStatus = 'learning' | 'practicing' | 'solid';

interface LabProject {
  id: string; title: string; description: string | null;
  status: ProjectStatus; tech_stack: string | null;
  url: string | null; repo_url: string | null;
  created_at: string; updated_at: string;
}

interface LabTool {
  id: string; name: string; category: string;
  status: ToolStatus; notes: string | null;
  url: string | null; monthly_cost: number | null;
  created_at: string;
}

interface SkillItem {
  id: string; name: string; category: string;
  status: SkillStatus; resource: string | null;
  notes: string | null; created_at: string;
}

const PROJECT_STATUS_CONFIG: Record<ProjectStatus, { label: string; variant: any; color: string }> = {
  idea:     { label: 'Idea',     variant: 'outline',  color: 'var(--text-tertiary)' },
  active:   { label: 'Active',   variant: 'green',    color: 'var(--accent-green)' },
  paused:   { label: 'Paused',   variant: 'amber',    color: 'var(--accent-amber)' },
  shipped:  { label: 'Shipped',  variant: 'blue',     color: 'var(--accent-blue)' },
  archived: { label: 'Archived', variant: 'outline',  color: 'var(--text-tertiary)' },
};

const TOOL_CATEGORIES = ['AI / LLM', 'Dev Tools', 'Design', 'Productivity', 'Marketing', 'Analytics', 'Infrastructure', 'Other'];
const SKILL_CATEGORIES = ['Frontend', 'Backend', 'Mobile', 'DevOps', 'Design', 'Marketing', 'Business', 'Other'];

export default function LabPage() {
  const { mode } = useBrand();
  const { user: currentUser } = useCurrentUser();
  const supabase = createClient();

  const [activeTab, setActiveTab] = useState<'projects' | 'tools' | 'skills'>('projects');
  const [projects, setProjects] = useState<LabProject[]>([]);
  const [tools, setTools] = useState<LabTool[]>([]);
  const [skills, setSkills] = useState<SkillItem[]>([]);
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    async function load() {
      if (!currentUser) return;
      const [{ data: p }, { data: t }, { data: s }] = await Promise.all([
        supabase.from('lab_projects').select('*').eq('user_id', currentUser.id).order('updated_at', { ascending: false }),
        supabase.from('lab_tools').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: false }),
        supabase.from('lab_skills').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: false }),
      ]);
      setProjects((p as LabProject[]) || []);
      setTools((t as LabTool[]) || []);
      setSkills((s as SkillItem[]) || []);
    }
    load();
  }, [currentUser]);

  const activeProjects = projects.filter(p => p.status === 'active').length;
  const usingTools    = tools.filter(t => t.status === 'using').length;
  const toolBurn      = tools.filter(t => t.status === 'using' && t.monthly_cost).reduce((s, t) => s + (t.monthly_cost || 0), 0);

  return (
    <PageTransition>
      <div className="flex flex-col gap-9">

        <div className="flex items-center justify-between">
          <div>
            <h1 className="t-h1">Lab</h1>
            <p className="t-xs mt-1">Side projects, tools, and skills. Your personal R&D.</p>
          </div>
          <Button icon={<Plus size={14} />} onClick={() => setShowAdd(true)}>Add</Button>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Active Projects', value: activeProjects, color: 'var(--accent-green)', icon: <FlaskConical size={14} /> },
            { label: 'Ideas in backlog', value: projects.filter(p => p.status === 'idea').length, color: 'var(--accent-violet)', icon: <Lightbulb size={14} /> },
            { label: 'Tools in use', value: usingTools, color: 'var(--accent-blue)', icon: <Wrench size={14} /> },
            { label: 'Tool burn / mo', value: toolBurn > 0 ? `₹${toolBurn.toLocaleString('en-IN')}` : '—', color: 'var(--accent-amber)', icon: <Zap size={14} /> },
          ].map(({ label, value, color, icon }) => (
            <div key={label} className="card">
              <div className="flex items-center gap-2 metric-header-gap" style={{ color }}>
                {icon}
                <p className="t-label">{label}</p>
              </div>
              <p className="t-metric" style={{ color }}>{value}</p>
            </div>
          ))}
        </div>

        <Tabs
          tabs={[
            { value: 'projects', label: 'Projects' },
            { value: 'tools',    label: 'Tools & AI' },
            { value: 'skills',   label: 'Skills' },
          ]}
          value={activeTab}
          onChange={v => setActiveTab(v as any)}
        />

        {/* ── PROJECTS ── */}
        {activeTab === 'projects' && (
          <div className="flex flex-col gap-3">
            {projects.length === 0 ? (
              <Card>
                <EmptyState icon={<FlaskConical />} title="No lab projects yet"
                  description="Track side projects, experiments, and things you're building for yourself."
                  action={<Button icon={<Plus size={14} />} onClick={() => setShowAdd(true)}>Add Project</Button>} />
              </Card>
            ) : (
              ['active', 'idea', 'paused', 'shipped', 'archived'].flatMap(status => {
                const group = projects.filter(p => p.status === status);
                if (group.length === 0) return [];
                const cfg = PROJECT_STATUS_CONFIG[status as ProjectStatus];
                return [
                  <div key={status}>
                    <p className="t-label section-gap" style={{ color: cfg.color }}>{cfg.label} ({group.length})</p>
                    <div className="flex flex-col gap-2">
                      {group.map(project => (
                        <div key={project.id} className="card"
                          style={{ display: 'flex', alignItems: 'flex-start', gap: 14, opacity: status === 'archived' ? 0.55 : 1 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="t-sm-semibold">{project.title}</span>
                              {project.tech_stack && (
                                <span className="t-2xs text-tertiary">{project.tech_stack}</span>
                              )}
                            </div>
                            {project.description && <p className="t-xs text-secondary">{project.description}</p>}
                            <p className="t-2xs text-tertiary" style={{ marginTop: 4 }}>Updated {formatRelative(project.updated_at)}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant={cfg.variant}>{cfg.label}</Badge>
                            {project.url && (
                              <a href={project.url} target="_blank" rel="noopener noreferrer">
                                <Button variant="ghost" size="sm" icon={<ExternalLink size={12} />}>Live</Button>
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ];
              })
            )}
          </div>
        )}

        {/* ── TOOLS ── */}
        {activeTab === 'tools' && (
          <div className="flex flex-col gap-3">
            {tools.length === 0 ? (
              <Card>
                <EmptyState icon={<Wrench />} title="No tools tracked yet"
                  description="Log AI tools, dev tools, and anything you're evaluating or using."
                  action={<Button icon={<Plus size={14} />} onClick={() => setShowAdd(true)}>Add Tool</Button>} />
              </Card>
            ) : (
              ['using', 'evaluating', 'dropped'].flatMap(status => {
                const group = tools.filter(t => t.status === status);
                if (group.length === 0) return [];
                const colors = { using: 'var(--accent-green)', evaluating: 'var(--accent-amber)', dropped: 'var(--text-tertiary)' };
                const color = colors[status as ToolStatus];
                return [
                  <div key={status}>
                    <p className="t-label section-gap" style={{ color }}>
                      {status.charAt(0).toUpperCase() + status.slice(1)} ({group.length})
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                      {group.map(tool => (
                        <div key={tool.id} className="card" style={{ opacity: status === 'dropped' ? 0.55 : 1 }}>
                          <div className="flex items-start justify-between gap-2">
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p className="t-sm-semibold">{tool.name}</p>
                              <p className="t-2xs text-tertiary">{tool.category}</p>
                              {tool.notes && <p className="t-xs text-secondary" style={{ marginTop: 6 }}>{tool.notes}</p>}
                            </div>
                            <div className="flex flex-col items-end gap-1 shrink-0">
                              {tool.monthly_cost != null && tool.monthly_cost > 0 && (
                                <span className="t-mono-sm" style={{ color: 'var(--accent-amber)' }}>₹{tool.monthly_cost}/mo</span>
                              )}
                              {tool.monthly_cost === 0 && <span className="t-2xs" style={{ color: 'var(--accent-green)' }}>Free</span>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ];
              })
            )}
          </div>
        )}

        {/* ── SKILLS ── */}
        {activeTab === 'skills' && (
          <div className="flex flex-col gap-3">
            {skills.length === 0 ? (
              <Card>
                <EmptyState icon={<BookOpen />} title="No skills tracked yet"
                  description="Track what you're learning, practicing, and have nailed."
                  action={<Button icon={<Plus size={14} />} onClick={() => setShowAdd(true)}>Add Skill</Button>} />
              </Card>
            ) : (
              ['learning', 'practicing', 'solid'].flatMap(status => {
                const group = skills.filter(s => s.status === status);
                if (group.length === 0) return [];
                const colors = { learning: 'var(--accent-amber)', practicing: 'var(--accent-blue)', solid: 'var(--accent-green)' };
                const color = colors[status as SkillStatus];
                return [
                  <div key={status}>
                    <p className="t-label section-gap" style={{ color }}>
                      {status.charAt(0).toUpperCase() + status.slice(1)} ({group.length})
                    </p>
                    <div className="flex flex-col gap-2">
                      {group.map(skill => (
                        <div key={skill.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div className="flex items-center gap-2">
                              <span className="t-sm-semibold">{skill.name}</span>
                              <span className="t-2xs text-tertiary">{skill.category}</span>
                            </div>
                            {skill.notes && <p className="t-xs text-secondary" style={{ marginTop: 2 }}>{skill.notes}</p>}
                            {skill.resource && (
                              <p className="t-2xs" style={{ marginTop: 2, color: 'var(--accent-blue)' }}>📚 {skill.resource}</p>
                            )}
                          </div>
                          <Badge variant={status === 'solid' ? 'green' : status === 'practicing' ? 'blue' : 'amber'}>
                            {status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                ];
              })
            )}
          </div>
        )}
      </div>

      {/* Add Modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)}
        title={activeTab === 'projects' ? 'Add Project' : activeTab === 'tools' ? 'Add Tool' : 'Add Skill'}
        size="md">
        {activeTab === 'projects' && (
          <AddProjectForm currentUser={currentUser} onClose={() => setShowAdd(false)}
            onCreated={p => { setProjects(prev => [p, ...prev]); setShowAdd(false); }} />
        )}
        {activeTab === 'tools' && (
          <AddToolForm currentUser={currentUser} onClose={() => setShowAdd(false)}
            onCreated={t => { setTools(prev => [t, ...prev]); setShowAdd(false); }} />
        )}
        {activeTab === 'skills' && (
          <AddSkillForm currentUser={currentUser} onClose={() => setShowAdd(false)}
            onCreated={s => { setSkills(prev => [s, ...prev]); setShowAdd(false); }} />
        )}
      </Modal>
    </PageTransition>
  );
}

function AddProjectForm({ currentUser, onClose, onCreated }: any) {
  const supabase = createClient();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<ProjectStatus>('idea');
  const [techStack, setTechStack] = useState('');
  const [url, setUrl] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!title || !currentUser) return;
    setSaving(true);
    const { data } = await supabase.from('lab_projects').insert({
      user_id: currentUser.id, title, description: description || null, status,
      tech_stack: techStack || null, url: url || null,
    }).select().single();
    if (data) onCreated(data);
    setSaving(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <Input label="Project Name" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g., CLI tool for deployment" required />
      <Textarea label="Description" value={description} onChange={e => setDescription(e.target.value)} placeholder="What is it, why are you building it..." />
      <div className="grid grid-cols-2 gap-3">
        <Select label="Status" value={status} onChange={e => setStatus(e.target.value as ProjectStatus)}
          options={Object.entries(PROJECT_STATUS_CONFIG).map(([v, c]) => ({ value: v, label: c.label }))} />
        <Input label="Tech Stack" value={techStack} onChange={e => setTechStack(e.target.value)} placeholder="React, Node, etc." />
      </div>
      <Input label="URL (if live)" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..." />
      <div className="flex gap-2 border-t-subtle" style={{ paddingTop: 16 }}>
        <Button variant="secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</Button>
        <Button onClick={handleSave} loading={saving} style={{ flex: 1 }} disabled={!title}>Add Project</Button>
      </div>
    </div>
  );
}

function AddToolForm({ currentUser, onClose, onCreated }: any) {
  const supabase = createClient();
  const [name, setName] = useState('');
  const [category, setCategory] = useState('AI / LLM');
  const [status, setStatus] = useState<ToolStatus>('evaluating');
  const [notes, setNotes] = useState('');
  const [monthlyCost, setMonthlyCost] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name || !currentUser) return;
    setSaving(true);
    const { data } = await supabase.from('lab_tools').insert({
      user_id: currentUser.id, name, category, status, notes: notes || null,
      monthly_cost: monthlyCost ? parseFloat(monthlyCost) : 0,
    }).select().single();
    if (data) onCreated(data);
    setSaving(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <Input label="Tool Name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Cursor, Claude, Vercel" required />
        <Select label="Category" value={category} onChange={e => setCategory(e.target.value)}
          options={TOOL_CATEGORIES.map(c => ({ value: c, label: c }))} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Select label="Status" value={status} onChange={e => setStatus(e.target.value as ToolStatus)}
          options={[{ value: 'evaluating', label: 'Evaluating' }, { value: 'using', label: 'Using' }, { value: 'dropped', label: 'Dropped' }]} />
        <Input label="Monthly Cost (₹)" type="number" value={monthlyCost} onChange={e => setMonthlyCost(e.target.value)} placeholder="0 = free" />
      </div>
      <Textarea label="Notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="What it does, how you use it, pros/cons..." />
      <div className="flex gap-2 border-t-subtle" style={{ paddingTop: 16 }}>
        <Button variant="secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</Button>
        <Button onClick={handleSave} loading={saving} style={{ flex: 1 }} disabled={!name}>Add Tool</Button>
      </div>
    </div>
  );
}

function AddSkillForm({ currentUser, onClose, onCreated }: any) {
  const supabase = createClient();
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Frontend');
  const [status, setStatus] = useState<SkillStatus>('learning');
  const [resource, setResource] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name || !currentUser) return;
    setSaving(true);
    const { data } = await supabase.from('lab_skills').insert({
      user_id: currentUser.id, name, category, status, resource: resource || null, notes: notes || null,
    }).select().single();
    if (data) onCreated(data);
    setSaving(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <Input label="Skill / Topic" value={name} onChange={e => setName(e.target.value)} placeholder="e.g., React Server Components" required />
        <Select label="Category" value={category} onChange={e => setCategory(e.target.value)}
          options={SKILL_CATEGORIES.map(c => ({ value: c, label: c }))} />
      </div>
      <Select label="Status" value={status} onChange={e => setStatus(e.target.value as SkillStatus)}
        options={[{ value: 'learning', label: 'Learning' }, { value: 'practicing', label: 'Practicing' }, { value: 'solid', label: 'Solid' }]} />
      <Input label="Resource / Course" value={resource} onChange={e => setResource(e.target.value)} placeholder="e.g., Next.js docs, Udemy course..." />
      <Textarea label="Notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="What you know, what's next..." />
      <div className="flex gap-2 border-t-subtle" style={{ paddingTop: 16 }}>
        <Button variant="secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</Button>
        <Button onClick={handleSave} loading={saving} style={{ flex: 1 }} disabled={!name}>Add Skill</Button>
      </div>
    </div>
  );
}

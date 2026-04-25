'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useBrand } from '@/lib/brand';
import { useCurrentUser } from '@/lib/auth/use-auth';
import { createClient } from '@/lib/supabase/client';
import { PageTransition } from '@/components/dashboard/PageTransition';
import { Button, Modal, Input, Textarea, Select, OverflowMenu, LoadMore, useLoadMore } from '@/components/ui';
import { toast } from '@/components/ui/Toast';
import {
  createLabProject,
  updateLabProject,
  updateLabProjectStatus,
  deleteLabProject,
  createLabTool,
  updateLabTool,
  deleteLabTool,
  createLabSkill,
  updateLabSkill,
  deleteLabSkill,
} from '@/app/dashboard/actions/lab';
import { formatDate, formatRelative } from '@/lib/utils';
import {
  Plus, FlaskConical, Lightbulb, Wrench, BookOpen,
  ExternalLink, Zap, Pencil, Trash2, Github, Globe,
  CheckCircle2,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────
type ProjectStatus = 'idea' | 'active' | 'paused' | 'shipped' | 'archived';
type ToolStatus    = 'evaluating' | 'using' | 'dropped';
type SkillStatus   = 'learning' | 'practicing' | 'solid';

interface LabProject {
  id: string; title: string; description: string | null;
  status: ProjectStatus; tech_stack: string | null;
  url: string | null; repo_url: string | null;
  created_at: string; updated_at: string;
}
interface LabTool {
  id: string; name: string; category: string; status: ToolStatus;
  notes: string | null; url: string | null; monthly_cost: number | null;
  created_at: string; updated_at: string;
}
interface SkillItem {
  id: string; name: string; category: string; status: SkillStatus;
  resource: string | null; notes: string | null; created_at: string; updated_at: string;
}

// ── Config ─────────────────────────────────────────────────────
const PROJECT_STATUS: Record<ProjectStatus, { label: string; color: string; bg: string }> = {
  idea:     { label: 'Idea',     color: 'var(--text-tertiary)',  bg: 'var(--bg-hover)' },
  active:   { label: 'Active',   color: 'var(--accent-green)',   bg: 'var(--accent-green-dim)' },
  paused:   { label: 'Paused',   color: 'var(--accent-amber)',   bg: 'var(--accent-amber-dim)' },
  shipped:  { label: 'Shipped',  color: 'var(--accent-blue)',    bg: 'var(--accent-blue-dim)' },
  archived: { label: 'Archived', color: 'var(--text-tertiary)',  bg: 'var(--bg-hover)' },
};
const TOOL_STATUS: Record<ToolStatus, { label: string; color: string }> = {
  using:      { label: 'Using',      color: 'var(--accent-green)' },
  evaluating: { label: 'Evaluating', color: 'var(--accent-amber)' },
  dropped:    { label: 'Dropped',    color: 'var(--text-tertiary)' },
};
const SKILL_STATUS: Record<SkillStatus, { label: string; color: string; bg: string }> = {
  learning:   { label: 'Learning',   color: 'var(--accent-amber)',  bg: 'var(--accent-amber-dim)' },
  practicing: { label: 'Practicing', color: 'var(--accent-blue)',   bg: 'var(--accent-blue-dim)' },
  solid:      { label: 'Solid',      color: 'var(--accent-green)',  bg: 'var(--accent-green-dim)' },
};
const TOOL_CATEGORIES = ['AI / LLM', 'Dev Tools', 'Design', 'Productivity', 'Marketing', 'Analytics', 'Infrastructure', 'Other'];
const SKILL_CATEGORIES = ['Frontend', 'Backend', 'Mobile', 'DevOps', 'Design', 'Marketing', 'Business', 'Other'];

function StatusPill({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 100, fontSize: 11, fontWeight: 500, background: bg, color, flexShrink: 0 }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor' }} />
      {label}
    </span>
  );
}

// ── MAIN PAGE ──────────────────────────────────────────────────
export default function LabPage() {
  const { user: currentUser } = useCurrentUser();
  const supabaseRef = useRef(createClient());
  const supabase    = supabaseRef.current;

  const [activeTab, setActiveTab]   = useState<'projects' | 'tools' | 'skills'>('projects');
  const [projects, setProjects]     = useState<LabProject[]>([]);
  const [tools, setTools]           = useState<LabTool[]>([]);
  const [skills, setSkills]         = useState<SkillItem[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showAdd, setShowAdd]       = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);

  const loadData = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    const [{ data: p }, { data: t }, { data: s }] = await Promise.all([
      supabase.from('lab_projects').select('*').eq('user_id', currentUser.id).order('updated_at', { ascending: false }),
      supabase.from('lab_tools').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: false }),
      supabase.from('lab_skills').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: false }),
    ]);
    setProjects((p as LabProject[]) || []);
    setTools((t as LabTool[]) || []);
    setSkills((s as SkillItem[]) || []);
    setLoading(false);
  }, [currentUser, supabase]);

  useEffect(() => { loadData(); }, [loadData]);

  // Quick status update helpers
  async function updateProjectStatus(id: string, status: ProjectStatus) {
    const prev = projects;
    setProjects(p => p.map(project => project.id === id ? { ...project, status } : project));
    const res = await updateLabProjectStatus(id, status);
    if (!res.ok) {
      setProjects(prev);
      toast.error(res.error || 'Could not update status');
    }
  }
  async function deleteProject(id: string) {
    const prev = projects;
    setProjects(p => p.filter(project => project.id !== id));
    const res = await deleteLabProject(id);
    if (!res.ok) {
      setProjects(prev);
      toast.error(res.error || 'Could not delete project');
    }
  }
  async function deleteTool(id: string) {
    const prev = tools;
    setTools(p => p.filter(t => t.id !== id));
    const res = await deleteLabTool(id);
    if (!res.ok) {
      setTools(prev);
      toast.error(res.error || 'Could not delete tool');
    }
  }
  async function deleteSkill(id: string) {
    const prev = skills;
    setSkills(p => p.filter(s => s.id !== id));
    const res = await deleteLabSkill(id);
    if (!res.ok) {
      setSkills(prev);
      toast.error(res.error || 'Could not delete skill');
    }
  }

  // Stats
  const activeProjects = projects.filter(p => p.status === 'active').length;
  const ideasBacklog   = projects.filter(p => p.status === 'idea').length;
  const usingTools     = tools.filter(t => t.status === 'using').length;
  const toolBurn       = tools.filter(t => t.status === 'using')
    .reduce((s, t) => s + Number(t.monthly_cost || 0), 0);

  // Pagination — sort each list by status priority, then paginate flat.
  // Display still groups by status; LoadMore advances through the
  // full ordered list so users walk down naturally from active items
  // to idle ones.
  const PROJECT_ORDER: ProjectStatus[] = ['active', 'idea', 'paused', 'shipped', 'archived'];
  const TOOL_ORDER:    ToolStatus[]    = ['using', 'evaluating', 'dropped'];
  const SKILL_ORDER                    = ['learning', 'proficient', 'mastered'];

  const orderedProjects = useMemo(() =>
    PROJECT_ORDER.flatMap(st => projects.filter(p => p.status === st))
  , [projects]);
  const orderedTools = useMemo(() =>
    TOOL_ORDER.flatMap(st => tools.filter(t => t.status === st))
  , [tools]);
  const orderedSkills = useMemo(() =>
    SKILL_ORDER.flatMap(st => skills.filter(s => s.status === st))
  , [skills]);

  const projectsPage = useLoadMore(orderedProjects, { pageSize: 20 });
  const toolsPage    = useLoadMore(orderedTools,    { pageSize: 20 });
  const skillsPage   = useLoadMore(orderedSkills,   { pageSize: 20 });

  const addLabel = { projects: 'Add Project', tools: 'Add Tool', skills: 'Add Skill' }[activeTab];

  const TABS = [
    { value: 'projects', label: 'Projects' },
    { value: 'tools',    label: 'Tools & AI' },
    { value: 'skills',   label: 'Skills' },
  ] as const;

  return (
    <PageTransition>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <h1 className="t-h1">Lab</h1>
            <p className="t-xs mt-1">Side projects, tools, and skills. Your personal R&D.</p>
          </div>
          <Button icon={<Plus size={14} />} onClick={() => setShowAdd(true)}>{addLabel}</Button>
        </div>

        {/* Stats */}
        <div className="rgrid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {([
            { label: 'Active Projects',  value: activeProjects, color: 'var(--accent-green)',  icon: <FlaskConical size={14} /> },
            { label: 'Ideas in Backlog', value: ideasBacklog,   color: 'var(--accent-violet)', icon: <Lightbulb size={14} /> },
            { label: 'Tools in Use',     value: usingTools,     color: 'var(--accent-blue)',   icon: <Wrench size={14} /> },
            { label: 'Tool Burn / mo',   value: toolBurn > 0 ? `₹${toolBurn.toLocaleString('en-IN')}` : '₹0', color: 'var(--accent-amber)', icon: <Zap size={14} /> },
          ] as { label: string; value: number | string; color: string; icon: React.ReactNode }[]).map(({ label, value, color, icon }) => (
            <div key={label} className="card" style={{ padding: '14px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <span style={{ color }}>{icon}</span>
                <span className="t-label">{label}</span>
              </div>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 800, color, lineHeight: 1 }}>{value}</p>
            </div>
          ))}
        </div>

        {/* Underline tabs */}
        <div className="tabs-scroll" style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)' }}>
          {TABS.map(tab => (
            <button key={tab.value} onClick={() => setActiveTab(tab.value)}
              style={{
                padding: '8px 16px', border: 'none', background: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: 500, fontFamily: 'var(--font-body)',
                color: activeTab === tab.value ? 'var(--text-primary)' : 'var(--text-tertiary)',
                borderBottom: `2px solid ${activeTab === tab.value ? 'var(--accent-blue)' : 'transparent'}`,
                marginBottom: -1, transition: 'color 150ms, border-color 150ms',
              }}>
              {tab.label}
              {tab.value === 'projects' && projects.length > 0 && (
                <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--text-tertiary)' }}>({projects.length})</span>
              )}
              {tab.value === 'tools' && tools.length > 0 && (
                <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--text-tertiary)' }}>({tools.length})</span>
              )}
              {tab.value === 'skills' && skills.length > 0 && (
                <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--text-tertiary)' }}>({skills.length})</span>
              )}
            </button>
          ))}
        </div>

        {/* ── PROJECTS TAB ── */}
        {activeTab === 'projects' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {projects.length === 0 ? (
              <div className="card" style={{ padding: '48px 24px', textAlign: 'center' }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--accent-green-dim)', color: 'var(--accent-green)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                  <FlaskConical size={20} />
                </div>
                <p className="t-sm-semibold" style={{ marginBottom: 6 }}>No lab projects yet</p>
                <p className="t-xs text-tertiary" style={{ marginBottom: 20 }}>Track side projects, experiments, and things you're building for yourself.</p>
                <Button icon={<Plus size={14} />} onClick={() => setShowAdd(true)}>Add Project</Button>
              </div>
            ) : (
              (['active', 'idea', 'paused', 'shipped', 'archived'] as ProjectStatus[]).flatMap(status => {
                const group = projectsPage.paginated.filter(p => p.status === status);
                if (group.length === 0) return [];
                const cfg = PROJECT_STATUS[status];
                return [(
                  <div key={status} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="t-label" style={{ color: cfg.color }}>{cfg.label}</span>
                      <span className="t-2xs text-tertiary">({group.length})</span>
                    </div>
                    {group.map(project => (
                      <div key={project.id} className="card dense-row"
                        style={{ padding: '14px 18px', opacity: status === 'archived' ? 0.55 : 1 }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; }}>
                        {/* Status dot */}
                        <div className="dense-row__lead" style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.color, marginTop: 6 }} />
                        <div className="dense-row__body">
                          <div className="dense-row__title">
                            <span className="t-sm-semibold dense-row__name">{project.title}</span>
                            {project.tech_stack && (
                              <span className="chip-opt-out" style={{ fontSize: 10, color: 'var(--text-tertiary)', background: 'var(--bg-hover)', padding: '2px 7px', borderRadius: 100, fontFamily: 'var(--font-mono)', flexShrink: 0 }}>{project.tech_stack}</span>
                            )}
                          </div>
                          {project.description && (
                            <p className="t-xs text-secondary chip-opt-out" style={{ marginBottom: 6 }}>{project.description}</p>
                          )}
                          <div className="dense-row__meta">
                            <span className="t-2xs text-tertiary">Updated {formatRelative(project.updated_at)}</span>
                          </div>
                        </div>
                        {/* Actions */}
                        <div className="dense-row__actions">
                          {project.url && (
                            <a href={project.url} target="_blank" rel="noopener noreferrer"
                              aria-label="Project website"
                              className="hide-on-mobile-row"
                              style={{ display: 'flex', padding: '5px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)', color: 'var(--text-tertiary)', transition: 'color 150ms' }}
                              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent-blue)'; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; }}>
                              <Globe size={13} />
                            </a>
                          )}
                          {project.repo_url && (
                            <a href={project.repo_url} target="_blank" rel="noopener noreferrer"
                              aria-label="GitHub repo"
                              className="hide-on-mobile-row"
                              style={{ display: 'flex', padding: '5px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)', color: 'var(--text-tertiary)', transition: 'color 150ms' }}
                              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; }}>
                              <Github size={13} />
                            </a>
                          )}
                          {/* Quick promote: idea → active */}
                          {status === 'idea' && (
                            <button onClick={() => updateProjectStatus(project.id, 'active')}
                              title="Move to Active"
                              className="row-btn-primary"
                              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 9px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--accent-green)', background: 'var(--accent-green-dim)', color: 'var(--accent-green)', fontSize: 10, fontWeight: 600, fontFamily: 'var(--font-body)', cursor: 'pointer', transition: 'all 150ms' }}
                              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--accent-green)'; (e.currentTarget as HTMLElement).style.color = '#fff'; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--accent-green-dim)'; (e.currentTarget as HTMLElement).style.color = 'var(--accent-green)'; }}>
                              <span className="row-btn-label">→ Activate</span>
                              <span className="hide-tablet" style={{ display: 'none' }}>→</span>
                            </button>
                          )}
                          {status === 'active' && (
                            <button onClick={() => updateProjectStatus(project.id, 'shipped')}
                              title="Mark as Shipped"
                              className="row-btn-primary"
                              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 9px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--accent-blue)', background: 'var(--accent-blue-dim)', color: 'var(--accent-blue)', fontSize: 10, fontWeight: 600, fontFamily: 'var(--font-body)', cursor: 'pointer', transition: 'all 150ms' }}
                              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--accent-blue)'; (e.currentTarget as HTMLElement).style.color = '#fff'; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--accent-blue-dim)'; (e.currentTarget as HTMLElement).style.color = 'var(--accent-blue)'; }}>
                              <span className="row-btn-label">✓ Ship</span>
                              <span className="hide-tablet" style={{ display: 'none' }}>✓</span>
                            </button>
                          )}
                          <button onClick={() => setEditingItem({ type: 'project', data: project })}
                            aria-label="Edit project"
                            style={{ display: 'flex', padding: '5px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)', background: 'transparent', color: 'var(--text-tertiary)', cursor: 'pointer', transition: 'all 150ms' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent-blue)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent-blue)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)'; }}>
                            <Pencil size={12} />
                          </button>
                          <button onClick={() => deleteProject(project.id)}
                            aria-label="Delete project"
                            className="hide-on-mobile-row"
                            style={{ display: 'flex', padding: '5px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'transparent', color: 'var(--text-tertiary)', cursor: 'pointer', transition: 'color 150ms' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent-red)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; }}>
                            <Trash2 size={12} />
                          </button>
                          <OverflowMenu
                            items={[
                              ...(project.url ? [{ label: 'Open website', icon: <Globe size={14} />, onClick: () => window.open(project.url!, '_blank', 'noopener,noreferrer') }] : []),
                              ...(project.repo_url ? [{ label: 'Open repo', icon: <Github size={14} />, onClick: () => window.open(project.repo_url!, '_blank', 'noopener,noreferrer') }] : []),
                              { label: 'Delete project', icon: <Trash2 size={14} />, onClick: () => deleteProject(project.id), destructive: true },
                            ]}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )];
              })
            )}
            {projects.length > 0 && (
              <LoadMore hasMore={projectsPage.hasMore} onLoadMore={projectsPage.loadMore}
                shown={projectsPage.shown} total={projectsPage.total} />
            )}
          </div>
        )}

        {/* ── TOOLS TAB ── */}
        {activeTab === 'tools' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {tools.length === 0 ? (
              <div className="card" style={{ padding: '48px 24px', textAlign: 'center' }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--accent-blue-dim)', color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                  <Wrench size={20} />
                </div>
                <p className="t-sm-semibold" style={{ marginBottom: 6 }}>No tools tracked yet</p>
                <p className="t-xs text-tertiary" style={{ marginBottom: 20 }}>Log AI tools, dev tools, and anything you're evaluating or currently using.</p>
                <Button icon={<Plus size={14} />} onClick={() => setShowAdd(true)}>Add Tool</Button>
              </div>
            ) : (
              (['using', 'evaluating', 'dropped'] as ToolStatus[]).flatMap(status => {
                const group = toolsPage.paginated.filter(t => t.status === status);
                if (group.length === 0) return [];
                const cfg = TOOL_STATUS[status];
                return [(
                  <div key={status} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="t-label" style={{ color: cfg.color }}>{cfg.label}</span>
                      <span className="t-2xs text-tertiary">({group.length})</span>
                    </div>
                    <div className="rgrid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      {group.map(tool => (
                        <div key={tool.id} className="card dense-row"
                          style={{ padding: '14px 16px', opacity: status === 'dropped' ? 0.55 : 1 }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; }}>
                          <div className="dense-row__body">
                            <div className="dense-row__title">
                              <span className="t-sm-semibold dense-row__name">{tool.name}</span>
                              {tool.monthly_cost === 0 && (
                                <span className="chip-opt-out" style={{ fontSize: 9, fontWeight: 700, color: 'var(--accent-green)', background: 'var(--accent-green-dim)', padding: '1px 6px', borderRadius: 100, flexShrink: 0 }}>FREE</span>
                              )}
                            </div>
                            <div className="dense-row__meta">
                              <span className="t-2xs text-tertiary">{tool.category}</span>
                            </div>
                            {tool.notes && <p className="t-xs text-secondary chip-opt-out" style={{ lineHeight: 1.5, marginTop: 6 }}>{tool.notes}</p>}
                          </div>
                          <div className="dense-row__actions">
                            {tool.monthly_cost != null && tool.monthly_cost > 0 && (
                              <span className="chip-opt-out" style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--accent-amber)', fontWeight: 600 }}>₹{tool.monthly_cost}/mo</span>
                            )}
                            {tool.url && (
                              <a href={tool.url} target="_blank" rel="noopener noreferrer"
                                aria-label="Open tool website"
                                className="hide-on-mobile-row"
                                style={{ display: 'flex', padding: '4px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)', color: 'var(--text-tertiary)', transition: 'color 150ms' }}
                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent-blue)'; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; }}>
                                <ExternalLink size={11} />
                              </a>
                            )}
                            <button onClick={() => setEditingItem({ type: 'tool', data: tool })}
                              aria-label="Edit tool"
                              style={{ display: 'flex', padding: '4px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)', background: 'transparent', color: 'var(--text-tertiary)', cursor: 'pointer', transition: 'all 150ms' }}
                              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent-blue)'; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; }}>
                              <Pencil size={11} />
                            </button>
                            <button onClick={() => deleteTool(tool.id)}
                              aria-label="Delete tool"
                              className="hide-on-mobile-row"
                              style={{ display: 'flex', padding: '4px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'transparent', color: 'var(--text-tertiary)', cursor: 'pointer', transition: 'color 150ms' }}
                              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent-red)'; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; }}>
                              <Trash2 size={11} />
                            </button>
                            <OverflowMenu
                              items={[
                                ...(tool.url ? [{ label: 'Open website', icon: <ExternalLink size={14} />, onClick: () => window.open(tool.url!, '_blank', 'noopener,noreferrer') }] : []),
                                { label: 'Delete tool', icon: <Trash2 size={14} />, onClick: () => deleteTool(tool.id), destructive: true },
                              ]}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )];
              })
            )}
            {tools.length > 0 && (
              <LoadMore hasMore={toolsPage.hasMore} onLoadMore={toolsPage.loadMore}
                shown={toolsPage.shown} total={toolsPage.total} />
            )}
          </div>
        )}

        {/* ── SKILLS TAB ── */}
        {activeTab === 'skills' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {skills.length === 0 ? (
              <div className="card" style={{ padding: '48px 24px', textAlign: 'center' }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--accent-violet-dim)', color: 'var(--accent-violet)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                  <BookOpen size={20} />
                </div>
                <p className="t-sm-semibold" style={{ marginBottom: 6 }}>No skills tracked yet</p>
                <p className="t-xs text-tertiary" style={{ marginBottom: 20 }}>Track what you're learning, practicing, and have nailed.</p>
                <Button icon={<Plus size={14} />} onClick={() => setShowAdd(true)}>Add Skill</Button>
              </div>
            ) : (
              (['learning', 'practicing', 'solid'] as SkillStatus[]).flatMap(status => {
                const group = skillsPage.paginated.filter(s => s.status === status);
                if (group.length === 0) return [];
                const cfg = SKILL_STATUS[status];
                return [(
                  <div key={status} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="t-label" style={{ color: cfg.color }}>{cfg.label}</span>
                      <span className="t-2xs text-tertiary">({group.length})</span>
                    </div>
                    {group.map(skill => (
                      <div key={skill.id} className="card dense-row"
                        style={{ padding: '12px 16px' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; }}>
                        {/* Status indicator */}
                        <div className="dense-row__lead" style={{ width: 32, height: 32, borderRadius: 'var(--radius-sm)', background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <CheckCircle2 size={14} style={{ color: cfg.color }} />
                        </div>
                        <div className="dense-row__body">
                          <div className="dense-row__title">
                            <span className="t-sm-semibold dense-row__name">{skill.name}</span>
                            <span className="chip-opt-out" style={{ fontSize: 10, color: 'var(--text-tertiary)', background: 'var(--bg-hover)', padding: '1px 7px', borderRadius: 100, flexShrink: 0 }}>{skill.category}</span>
                          </div>
                          {skill.resource && (
                            <p className="t-2xs chip-opt-out" style={{ color: 'var(--accent-blue)', marginTop: 2 }}>📚 {skill.resource}</p>
                          )}
                          {skill.notes && <p className="t-2xs text-tertiary chip-opt-out" style={{ marginTop: 2 }}>{skill.notes}</p>}
                        </div>
                        <div className="dense-row__actions">
                          <StatusPill label={cfg.label} color={cfg.color} bg={cfg.bg} />
                          <button onClick={() => setEditingItem({ type: 'skill', data: skill })}
                            aria-label="Edit skill"
                            style={{ display: 'flex', padding: '5px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)', background: 'transparent', color: 'var(--text-tertiary)', cursor: 'pointer', transition: 'all 150ms' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent-blue)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent-blue)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)'; }}>
                            <Pencil size={12} />
                          </button>
                          <button onClick={() => deleteSkill(skill.id)}
                            aria-label="Delete skill"
                            className="hide-on-mobile-row"
                            style={{ display: 'flex', padding: '5px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'transparent', color: 'var(--text-tertiary)', cursor: 'pointer', transition: 'color 150ms' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent-red)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; }}>
                            <Trash2 size={12} />
                          </button>
                          <OverflowMenu
                            items={[
                              { label: 'Delete skill', icon: <Trash2 size={14} />, onClick: () => deleteSkill(skill.id), destructive: true },
                            ]}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )];
              })
            )}
            {skills.length > 0 && (
              <LoadMore hasMore={skillsPage.hasMore} onLoadMore={skillsPage.loadMore}
                shown={skillsPage.shown} total={skillsPage.total} />
            )}
          </div>
        )}

        {/* Add modal */}
        {showAdd && (
          <Modal open={true} onClose={() => setShowAdd(false)}
            title={addLabel} size="md">
            {activeTab === 'projects' && (
              <ProjectForm currentUser={currentUser}
                onClose={() => setShowAdd(false)}
                onSaved={(p: LabProject) => { setProjects(prev => [p, ...prev]); setShowAdd(false); }} />
            )}
            {activeTab === 'tools' && (
              <ToolForm currentUser={currentUser}
                onClose={() => setShowAdd(false)}
                onSaved={(t: LabTool) => { setTools(prev => [t, ...prev]); setShowAdd(false); }} />
            )}
            {activeTab === 'skills' && (
              <SkillForm currentUser={currentUser}
                onClose={() => setShowAdd(false)}
                onSaved={(s: SkillItem) => { setSkills(prev => [s, ...prev]); setShowAdd(false); }} />
            )}
          </Modal>
        )}

        {/* Edit modal */}
        {editingItem && (
          <Modal open={true} onClose={() => setEditingItem(null)}
            title={`Edit ${editingItem.type.charAt(0).toUpperCase() + editingItem.type.slice(1)}`} size="md">
            {editingItem.type === 'project' && (
              <ProjectForm currentUser={currentUser} existing={editingItem.data}
                onClose={() => setEditingItem(null)}
                onSaved={(p: LabProject) => { setProjects(prev => prev.map(x => x.id === p.id ? p : x)); setEditingItem(null); }} />
            )}
            {editingItem.type === 'tool' && (
              <ToolForm currentUser={currentUser} existing={editingItem.data}
                onClose={() => setEditingItem(null)}
                onSaved={(t: LabTool) => { setTools(prev => prev.map(x => x.id === t.id ? t : x)); setEditingItem(null); }} />
            )}
            {editingItem.type === 'skill' && (
              <SkillForm currentUser={currentUser} existing={editingItem.data}
                onClose={() => setEditingItem(null)}
                onSaved={(s: SkillItem) => { setSkills(prev => prev.map(x => x.id === s.id ? s : x)); setEditingItem(null); }} />
            )}
          </Modal>
        )}
      </div>
    </PageTransition>
  );
}

// ── PROJECT FORM ───────────────────────────────────────────────
function ProjectForm({ currentUser, existing, onClose, onSaved }: any) {
  const supabase = useRef(createClient()).current;
  const isEdit = !!existing;
  const [title, setTitle]             = useState(existing?.title || '');
  const [description, setDescription] = useState(existing?.description || '');
  const [status, setStatus]           = useState<ProjectStatus>(existing?.status || 'idea');
  const [techStack, setTechStack]     = useState(existing?.tech_stack || '');
  const [url, setUrl]                 = useState(existing?.url || '');
  const [repoUrl, setRepoUrl]         = useState(existing?.repo_url || '');
  const [saving, setSaving]           = useState(false);

  async function handleSave() {
    if (!title || !currentUser) return;
    setSaving(true);
    const payload = { title, description: description || null, status, tech_stack: techStack || null, url: url || null, repo_url: repoUrl || null };
    const res = isEdit
      ? await updateLabProject(existing.id, payload)
      : await createLabProject(payload);
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error || 'Could not save project');
      return;
    }
    onSaved(res.data);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Input label="Project Name" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g., AI invoice parser" autoFocus />
      <Textarea label="Description" value={description} onChange={e => setDescription(e.target.value)}
        placeholder="What is it, why are you building it..." style={{ minHeight: 80 }} />
      <div className="rgrid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Select label="Status" value={status} onChange={e => setStatus(e.target.value as ProjectStatus)}
          options={Object.entries(PROJECT_STATUS).map(([v, c]) => ({ value: v, label: c.label }))} />
        <Input label="Tech Stack" value={techStack} onChange={e => setTechStack(e.target.value)} placeholder="React, Node, etc." />
      </div>
      <div className="rgrid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Input label="Live URL" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..." />
        <Input label="Repo URL" value={repoUrl} onChange={e => setRepoUrl(e.target.value)} placeholder="https://github.com/..." />
      </div>
      <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
        <Button variant="secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</Button>
        <Button onClick={handleSave} loading={saving} disabled={!title} style={{ flex: 1 }}>{isEdit ? 'Save Changes' : 'Add Project'}</Button>
      </div>
    </div>
  );
}

// ── TOOL FORM ──────────────────────────────────────────────────
function ToolForm({ currentUser, existing, onClose, onSaved }: any) {
  const supabase = useRef(createClient()).current;
  const isEdit = !!existing;
  const [name, setName]           = useState(existing?.name || '');
  const [category, setCategory]   = useState(existing?.category || 'AI / LLM');
  const [status, setStatus]       = useState<ToolStatus>(existing?.status || 'evaluating');
  const [notes, setNotes]         = useState(existing?.notes || '');
  const [url, setUrl]             = useState(existing?.url || '');
  const [monthlyCost, setMonthlyCost] = useState(existing?.monthly_cost != null ? String(existing.monthly_cost) : '');
  const [saving, setSaving]       = useState(false);

  async function handleSave() {
    if (!name || !currentUser) return;
    setSaving(true);
    const payload = { name, category, status, notes: notes || null, url: url || null, monthly_cost: monthlyCost !== '' ? parseFloat(monthlyCost) : 0 };
    const res = isEdit
      ? await updateLabTool(existing.id, payload)
      : await createLabTool(payload);
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error || 'Could not save tool');
      return;
    }
    onSaved(res.data);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="rgrid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Input label="Tool Name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Cursor, Claude, Vercel" autoFocus />
        <Select label="Category" value={category} onChange={e => setCategory(e.target.value)}
          options={TOOL_CATEGORIES.map(c => ({ value: c, label: c }))} />
      </div>
      <div className="rgrid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Select label="Status" value={status} onChange={e => setStatus(e.target.value as ToolStatus)}
          options={[{ value: 'evaluating', label: 'Evaluating' }, { value: 'using', label: 'Using' }, { value: 'dropped', label: 'Dropped' }]} />
        <Input label="Monthly Cost (₹, 0 = free)" type="number" value={monthlyCost} onChange={e => setMonthlyCost(e.target.value)} placeholder="0" />
      </div>
      <Input label="URL" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..." />
      <Textarea label="Notes" value={notes} onChange={e => setNotes(e.target.value)}
        placeholder="What it does, how you use it, pros/cons..." style={{ minHeight: 80 }} />
      <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
        <Button variant="secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</Button>
        <Button onClick={handleSave} loading={saving} disabled={!name} style={{ flex: 1 }}>{isEdit ? 'Save Changes' : 'Add Tool'}</Button>
      </div>
    </div>
  );
}

// ── SKILL FORM ─────────────────────────────────────────────────
function SkillForm({ currentUser, existing, onClose, onSaved }: any) {
  const supabase = useRef(createClient()).current;
  const isEdit = !!existing;
  const [name, setName]         = useState(existing?.name || '');
  const [category, setCategory] = useState(existing?.category || 'Frontend');
  const [status, setStatus]     = useState<SkillStatus>(existing?.status || 'learning');
  const [resource, setResource] = useState(existing?.resource || '');
  const [notes, setNotes]       = useState(existing?.notes || '');
  const [saving, setSaving]     = useState(false);

  async function handleSave() {
    if (!name || !currentUser) return;
    setSaving(true);
    const payload = { name, category, status, resource: resource || null, notes: notes || null };
    const res = isEdit
      ? await updateLabSkill(existing.id, payload)
      : await createLabSkill(payload);
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error || 'Could not save skill');
      return;
    }
    onSaved(res.data);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="rgrid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Input label="Skill / Topic" value={name} onChange={e => setName(e.target.value)} placeholder="e.g., React Server Components" autoFocus />
        <Select label="Category" value={category} onChange={e => setCategory(e.target.value)}
          options={SKILL_CATEGORIES.map(c => ({ value: c, label: c }))} />
      </div>
      <Select label="Status" value={status} onChange={e => setStatus(e.target.value as SkillStatus)}
        options={[{ value: 'learning', label: '📖 Learning' }, { value: 'practicing', label: '⚒ Practicing' }, { value: 'solid', label: '✓ Solid' }]} />
      <Input label="Resource / Course" value={resource} onChange={e => setResource(e.target.value)} placeholder="e.g., Next.js docs, Udemy course..." />
      <Textarea label="Notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="What you know, what's next..." style={{ minHeight: 60 }} />
      <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
        <Button variant="secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</Button>
        <Button onClick={handleSave} loading={saving} disabled={!name} style={{ flex: 1 }}>{isEdit ? 'Save Changes' : 'Add Skill'}</Button>
      </div>
    </div>
  );
}

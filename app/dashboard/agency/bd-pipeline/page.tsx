'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useBrand } from '@/lib/brand';
import { useCurrentUser } from '@/lib/auth/use-auth';
import { createClient } from '@/lib/supabase/client';
import { PageTransition } from '@/components/dashboard/PageTransition';
import { Button, Modal, Input, Select, Textarea } from '@/components/ui';
import { toast } from '@/components/ui/Toast';
import { formatRelative, formatDate, formatINR } from '@/lib/utils';
import {
  Plus, ChevronRight, Trash2, Pencil, Check, X,
  ArrowRight, LayoutList, Kanban, Search,
  ChevronUp, ChevronDown, Linkedin, Mail, MessageCircle,
  Phone, Radio, Instagram, Share2, ExternalLink,
} from 'lucide-react';
import type { Lead, LeadStage } from '@/types';

// ── Channel config ─────────────────────────────────────────────
const CHANNELS: { value: string; label: string; color: string; icon: React.ReactNode }[] = [
  { value: 'linkedin',  label: 'LinkedIn',  color: 'var(--accent-blue)',   icon: <Linkedin size={11} /> },
  { value: 'email',     label: 'Email',     color: 'var(--accent-blue)',   icon: <Mail size={11} /> },
  { value: 'whatsapp',  label: 'WhatsApp',  color: 'var(--accent-green)',  icon: <MessageCircle size={11} /> },
  { value: 'phone',     label: 'Phone',     color: 'var(--accent-amber)',  icon: <Phone size={11} /> },
  { value: 'cold_call', label: 'Cold Call', color: 'var(--accent-amber)',  icon: <Radio size={11} /> },
  { value: 'instagram', label: 'Instagram', color: 'var(--accent-violet)', icon: <Instagram size={11} /> },
  { value: 'other',     label: 'Other',     color: 'var(--text-tertiary)', icon: <Share2 size={11} /> },
];
const CHANNEL_MAP = Object.fromEntries(CHANNELS.map(c => [c.value, c]));

// ── Stage config ───────────────────────────────────────────────
// Contacts tab: prospect → meeting_scheduled (pre-proposal)
// Deals tab:    proposal_sent → closed (post-proposal)
const ALL_STAGES: { value: LeadStage; label: string; color: string; tab: 'contacts' | 'deals' | 'closed' }[] = [
  { value: 'prospect',          label: 'Prospect',      color: 'var(--text-tertiary)',  tab: 'contacts' },
  { value: 'contacted',         label: 'Contacted',     color: 'var(--accent-blue)',    tab: 'contacts' },
  { value: 'replied',           label: 'Replied',       color: 'var(--accent-violet)',  tab: 'contacts' },
  { value: 'meeting_scheduled', label: 'Meeting',       color: 'var(--accent-amber)',   tab: 'contacts' },
  { value: 'proposal_sent',     label: 'Proposal Sent', color: 'var(--accent-blue)',    tab: 'deals' },
  { value: 'negotiating',       label: 'Negotiating',   color: 'var(--accent-amber)',   tab: 'deals' },
  { value: 'closed_won',        label: 'Closed Won',    color: 'var(--accent-green)',   tab: 'closed' },
  { value: 'closed_lost',       label: 'Closed Lost',   color: 'var(--accent-red)',     tab: 'closed' },
];
const CONTACT_STAGES = ALL_STAGES.filter(s => s.tab === 'contacts');
const DEAL_STAGES    = ALL_STAGES.filter(s => s.tab === 'deals');
const STAGE_MAP      = Object.fromEntries(ALL_STAGES.map(s => [s.value, s]));
const STAGE_ORDER    = Object.fromEntries(ALL_STAGES.map((s, i) => [s.value, i]));
const SOURCE_OPTIONS = ['LinkedIn', 'Referral', 'Cold email', 'Inbound', 'Event', 'Other'];

type SortKey = 'company' | 'stage' | 'deal_value' | 'last_activity_at';
type SortDir = 'asc' | 'desc';
type ActiveTab = 'contacts' | 'deals' | 'closed';

function stageCfg(stage: LeadStage) { return STAGE_MAP[stage] || ALL_STAGES[0]; }

// ── Shared primitives ──────────────────────────────────────────
function StagePill({ stage, size = 'md' }: { stage: LeadStage; size?: 'sm' | 'md' }) {
  const cfg = stageCfg(stage);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: size === 'sm' ? '2px 7px' : '3px 9px', borderRadius: 100, fontSize: size === 'sm' ? 10 : 11, fontWeight: 500, background: `${cfg.color}18`, color: cfg.color, whiteSpace: 'nowrap', flexShrink: 0 }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', flexShrink: 0 }} />
      {cfg.label}
    </span>
  );
}

function ChannelBadge({ channel }: { channel: string | null }) {
  if (!channel) return null;
  const c = CHANNEL_MAP[channel] || CHANNEL_MAP.other;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 7px', borderRadius: 100, fontSize: 10, fontWeight: 600, background: `${c.color}14`, color: c.color, flexShrink: 0 }}>
      {c.icon} {c.label}
    </span>
  );
}

function PipelineProgress({ stage }: { stage: LeadStage }) {
  if (stage === 'closed_won' || stage === 'closed_lost') return null;
  const allActive = [...CONTACT_STAGES, ...DEAL_STAGES];
  const idx = allActive.findIndex(s => s.value === stage);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      {allActive.map((s, i) => {
        const done = i <= idx; const current = s.value === stage;
        return (
          <div key={s.value} style={{ flex: 1, height: 3, borderRadius: 100, background: done ? s.color : 'var(--bg-hover)', position: 'relative', transition: 'background 300ms' }}>
            {current && <div style={{ position: 'absolute', inset: 0, borderRadius: 100, background: s.color, boxShadow: `0 0 4px ${s.color}80` }} />}
          </div>
        );
      })}
    </div>
  );
}

// ── MAIN PAGE ──────────────────────────────────────────────────
export default function AgencyBDPipelinePage() {
  const { mode } = useBrand();
  const { user: currentUser } = useCurrentUser();
  const supabaseRef = useRef(createClient());
  const supabase    = supabaseRef.current;

  const [leads, setLeads]           = useState<Lead[]>([]);
  const [loading, setLoading]       = useState(true);
  const [activeTab, setActiveTab]   = useState<ActiveTab>('contacts');
  const [view, setView]             = useState<'table' | 'kanban'>('table');
  const [showCreate, setShowCreate] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [search, setSearch]         = useState('');
  const [stageFilter, setStageFilter] = useState<LeadStage | 'all'>('all');
  const [sortKey, setSortKey]       = useState<SortKey>('last_activity_at');
  const [sortDir, setSortDir]       = useState<SortDir>('desc');
  const [showClosed, setShowClosed] = useState(false);

  const loadLeads = useCallback(async () => {
    if (!currentUser) return;
    const { data } = await supabase.from('leads').select('*')
      .eq('user_id', currentUser.ownerId).eq('mode', mode)
      .order('last_activity_at', { ascending: false });
    setLeads((data as Lead[]) || []);
    setLoading(false);
  }, [currentUser, mode, supabase]);

  useEffect(() => {
    loadLeads();
    const channel = supabase.channel(`bd-leads-${mode}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'leads',
        // Scope to this owner's rows — without this filter, the subscription
        // receives change events for every user in the database.
        filter: `user_id=eq.${currentUser.ownerId}`,
      }, payload => {
        if (payload.eventType === 'INSERT') setLeads(prev => [payload.new as Lead, ...prev]);
        if (payload.eventType === 'UPDATE') {
          setLeads(prev => prev.map(l => l.id === payload.new.id ? payload.new as Lead : l));
          setSelectedLead(prev => prev?.id === payload.new.id ? payload.new as Lead : prev);
        }
        if (payload.eventType === 'DELETE') {
          setLeads(prev => prev.filter(l => l.id !== (payload.old as Lead).id));
          setSelectedLead(prev => prev?.id === (payload.old as Lead).id ? null : prev);
        }
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadLeads, mode, supabase]);

  async function moveStage(leadId: string, newStage: LeadStage) {
    const { error } = await supabase.from('leads').update({ stage: newStage, last_activity_at: new Date().toISOString() }).eq('id', leadId);
    if (error) { toast.error('Failed to update stage'); return; }
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, stage: newStage } : l));
    setSelectedLead(prev => prev?.id === leadId ? { ...prev, stage: newStage } : prev);
  }

  async function deleteLead(id: string) {
    const { error } = await supabase.from('leads').delete().eq('id', id);
    if (error) { toast.error('Failed to delete lead'); return; }
    setLeads(prev => prev.filter(l => l.id !== id));
    if (selectedLead?.id === id) setSelectedLead(null);
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }

  // Derived
  const contactLeads = leads.filter(l => CONTACT_STAGES.some(s => s.value === l.stage));
  const dealLeads    = leads.filter(l => DEAL_STAGES.some(s => s.value === l.stage));
  const closedLeads  = leads.filter(l => l.stage === 'closed_won' || l.stage === 'closed_lost');
  const wonLeads     = closedLeads.filter(l => l.stage === 'closed_won');

  // Stats
  const totalActive = contactLeads.length + dealLeads.length;
  const pipelineVal = dealLeads.reduce((s, l) => s + Number(l.deal_value || 0), 0);
  const wonVal      = wonLeads.reduce((s, l) => s + Number(l.deal_value || 0), 0);

  // Filter + sort for table views
  function applyFilter(list: Lead[]) {
    return list
      .filter(l => {
        const q = search.toLowerCase();
        if (q && !l.company.toLowerCase().includes(q) && !(l.contact_name || '').toLowerCase().includes(q)) return false;
        if (stageFilter !== 'all' && l.stage !== stageFilter) return false;
        return true;
      })
      .sort((a, b) => {
        let av: any, bv: any;
        if (sortKey === 'stage')           { av = STAGE_ORDER[a.stage]; bv = STAGE_ORDER[b.stage]; }
        else if (sortKey === 'deal_value') { av = Number(a.deal_value || 0); bv = Number(b.deal_value || 0); }
        else if (sortKey === 'company')    { av = a.company.toLowerCase(); bv = b.company.toLowerCase(); }
        else                               { av = a.last_activity_at; bv = b.last_activity_at; }
        if (av < bv) return sortDir === 'asc' ? -1 : 1;
        if (av > bv) return sortDir === 'asc' ? 1 : -1;
        return 0;
      });
  }

  const filteredContacts = applyFilter(contactLeads);
  const filteredDeals    = applyFilter(dealLeads);

  const TABS: { value: ActiveTab; label: string; count: number }[] = [
    { value: 'contacts', label: 'Contacts',  count: contactLeads.length },
    { value: 'deals',    label: 'Deals',     count: dealLeads.length },
    { value: 'closed',   label: 'Closed',    count: closedLeads.length },
  ];

  // When switching tabs reset stage filter
  function handleTabChange(tab: ActiveTab) {
    setActiveTab(tab);
    setStageFilter('all');
    setSearch('');
  }

  const currentStages = activeTab === 'contacts' ? CONTACT_STAGES : DEAL_STAGES;

  return (
    <PageTransition>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <h1 className="t-h1">BD Pipeline</h1>
            <p className="t-xs text-secondary" style={{ marginTop: 4 }}>Full funnel from first contact to closed deal.</p>
          </div>
          <Button icon={<Plus size={14} />} onClick={() => setShowCreate(true)}>Add Lead</Button>
        </div>

        {/* Summary stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {([
            { label: 'Active',         value: totalActive,                                color: 'var(--accent-blue)',   sub: `${contactLeads.length} contacts · ${dealLeads.length} deals` },
            { label: 'Pipeline Value', value: pipelineVal > 0 ? formatINR(pipelineVal) : '₹0', color: 'var(--accent-violet)', sub: 'from active deals' },
            { label: 'Won',            value: wonLeads.length,                            color: 'var(--accent-green)',  sub: wonVal > 0 ? formatINR(wonVal) : 'no closed deals yet' },
          ] as { label: string; value: number | string; color: string; sub: string }[]).map(({ label, value, color, sub }) => (
            <div key={label} className="card" style={{ padding: '13px 16px' }}>
              <p className="t-label" style={{ marginBottom: 6 }}>{label}</p>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800, color, lineHeight: 1, marginBottom: 3 }}>{value}</p>
              <p className="t-2xs text-tertiary">{sub}</p>
            </div>
          ))}
        </div>

        {/* Tabs — underline style */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', gap: 0 }}>
          {TABS.map(tab => (
            <button key={tab.value} onClick={() => handleTabChange(tab.value)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500, fontFamily: 'var(--font-body)', color: activeTab === tab.value ? 'var(--text-primary)' : 'var(--text-tertiary)', borderBottom: `2px solid ${activeTab === tab.value ? 'var(--accent-blue)' : 'transparent'}`, marginBottom: -1, transition: 'color 150ms, border-color 150ms' }}>
              {tab.label}
              {tab.count > 0 && (
                <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>({tab.count})</span>
              )}
            </button>
          ))}
          {/* View toggle — only for contacts and deals tabs */}
          {activeTab !== 'closed' && (
            <div style={{ marginLeft: 'auto', display: 'flex', background: 'var(--bg-hover)', padding: 3, borderRadius: 'var(--radius-md)', gap: 2, alignSelf: 'center', marginBottom: 1 }}>
              {([
                { v: 'table',  icon: <LayoutList size={12} />, label: 'List' },
                { v: 'kanban', icon: <Kanban size={12} />,     label: 'Board' },
              ] as const).map(({ v, icon, label }) => (
                <button key={v} onClick={() => setView(v)}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 9px', borderRadius: 'calc(var(--radius-md) - 3px)', border: 'none', background: view === v ? 'var(--bg-surface)' : 'transparent', color: view === v ? 'var(--text-primary)' : 'var(--text-tertiary)', fontSize: 11, fontWeight: view === v ? 600 : 400, fontFamily: 'var(--font-body)', cursor: 'pointer', boxShadow: view === v ? 'var(--shadow-card)' : 'none', transition: 'all 150ms', whiteSpace: 'nowrap' }}>
                  {icon} {label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── CONTACTS TAB ── person-centric, pre-proposal ── */}
        {activeTab === 'contacts' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {view === 'table' && (
              <>
                <Toolbar search={search} setSearch={setSearch} stageFilter={stageFilter}
                  setStageFilter={setStageFilter} stages={CONTACT_STAGES}
                  resultCount={filteredContacts.length} />
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  <ContactTableHeader sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  {filteredContacts.length === 0 ? (
                    <EmptyTableState search={search} stageFilter={stageFilter}
                      onAdd={() => setShowCreate(true)} noun="contacts" />
                  ) : filteredContacts.map((lead, i) => (
                    <ContactRow key={lead.id} lead={lead} isLast={i === filteredContacts.length - 1}
                      onClick={() => setSelectedLead(lead)}
                      onAdvance={() => {
                        const ni = CONTACT_STAGES.findIndex(s => s.value === lead.stage) + 1;
                        if (ni < CONTACT_STAGES.length) moveStage(lead.id, CONTACT_STAGES[ni].value);
                        else moveStage(lead.id, 'proposal_sent'); // graduate to deals
                      }}
                      canAdvance={true} />
                  ))}
                </div>
              </>
            )}
            {view === 'kanban' && (
              <KanbanBoard stages={CONTACT_STAGES} leads={contactLeads}
                onCardClick={setSelectedLead}
                onAdvance={(lead) => {
                  const ni = CONTACT_STAGES.findIndex(s => s.value === lead.stage) + 1;
                  if (ni < CONTACT_STAGES.length) moveStage(lead.id, CONTACT_STAGES[ni].value);
                  else moveStage(lead.id, 'proposal_sent');
                }} />
            )}
          </div>
        )}

        {/* ── DEALS TAB ── company-centric, post-proposal ── */}
        {activeTab === 'deals' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {view === 'table' && (
              <>
                <Toolbar search={search} setSearch={setSearch} stageFilter={stageFilter}
                  setStageFilter={setStageFilter} stages={DEAL_STAGES}
                  resultCount={filteredDeals.length} />
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  <DealTableHeader sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  {filteredDeals.length === 0 ? (
                    <EmptyTableState search={search} stageFilter={stageFilter}
                      onAdd={() => setShowCreate(true)} noun="deals" />
                  ) : filteredDeals.map((lead, i) => (
                    <DealRow key={lead.id} lead={lead} isLast={i === filteredDeals.length - 1}
                      onClick={() => setSelectedLead(lead)}
                      onAdvance={() => {
                        const ni = DEAL_STAGES.findIndex(s => s.value === lead.stage) + 1;
                        if (ni < DEAL_STAGES.length) moveStage(lead.id, DEAL_STAGES[ni].value);
                      }}
                      canAdvance={DEAL_STAGES.findIndex(s => s.value === lead.stage) < DEAL_STAGES.length - 1} />
                  ))}
                </div>
              </>
            )}
            {view === 'kanban' && (
              <KanbanBoard stages={DEAL_STAGES} leads={dealLeads}
                onCardClick={setSelectedLead}
                onAdvance={(lead) => {
                  const ni = DEAL_STAGES.findIndex(s => s.value === lead.stage) + 1;
                  if (ni < DEAL_STAGES.length) moveStage(lead.id, DEAL_STAGES[ni].value);
                }} />
            )}
          </div>
        )}

        {/* ── CLOSED TAB ── archive ── */}
        {activeTab === 'closed' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {closedLeads.length === 0 ? (
              <div className="card" style={{ padding: '40px 24px', textAlign: 'center' }}>
                <p className="t-sm-semibold" style={{ marginBottom: 4 }}>No closed deals yet</p>
                <p className="t-xs text-secondary">Won and lost deals will appear here.</p>
              </div>
            ) : (
              <>
                {/* Won */}
                {wonLeads.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <p className="t-label" style={{ marginBottom: 8, color: 'var(--accent-green)' }}>Won ({wonLeads.length})</p>
                    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                      {wonLeads.map((lead, i) => (
                        <ClosedRow key={lead.id} lead={lead} isLast={i === wonLeads.length - 1}
                          onClick={() => setSelectedLead(lead)} />
                      ))}
                    </div>
                  </div>
                )}
                {/* Lost */}
                {closedLeads.filter(l => l.stage === 'closed_lost').length > 0 && (
                  <div>
                    <p className="t-label" style={{ marginBottom: 8, color: 'var(--accent-red)' }}>
                      Lost ({closedLeads.filter(l => l.stage === 'closed_lost').length})
                    </p>
                    <div className="card" style={{ padding: 0, overflow: 'hidden', opacity: 0.8 }}>
                      {closedLeads.filter(l => l.stage === 'closed_lost').map((lead, i, arr) => (
                        <ClosedRow key={lead.id} lead={lead} isLast={i === arr.length - 1}
                          onClick={() => setSelectedLead(lead)} />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Modals */}
        {selectedLead && (
          <LeadDetailModal lead={selectedLead}
            onClose={() => setSelectedLead(null)}
            onMoveStage={moveStage} onDelete={deleteLead}
            onUpdate={updated => { setLeads(prev => prev.map(l => l.id === updated.id ? updated : l)); setSelectedLead(updated); }} />
        )}
        <CreateLeadModal open={showCreate} onClose={() => setShowCreate(false)}
          mode={mode} currentUser={currentUser}
          initialTab={activeTab === 'deals' ? 'deals' : 'contacts'}
          onCreated={lead => { setLeads(prev => [lead, ...prev]); setShowCreate(false); }} />
      </div>
    </PageTransition>
  );
}

// ── TOOLBAR (shared) ───────────────────────────────────────────
function Toolbar({ search, setSearch, stageFilter, setStageFilter, stages, resultCount }: {
  search: string; setSearch: (v: string) => void;
  stageFilter: LeadStage | 'all'; setStageFilter: (v: LeadStage | 'all') => void;
  stages: typeof CONTACT_STAGES; resultCount: number;
}) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <div style={{ position: 'relative', flex: 1, maxWidth: 280 }}>
        <Search size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none' }} />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search company or contact..."
          style={{ width: '100%', padding: '7px 10px 7px 28px', background: 'var(--bg-hover)', border: '1px solid transparent', borderRadius: 'var(--radius-md)', fontSize: 12, fontFamily: 'var(--font-body)', color: 'var(--text-primary)', outline: 'none', transition: 'border-color 150ms', boxSizing: 'border-box' }}
          onFocus={e => { e.target.style.borderColor = 'var(--border-default)'; }}
          onBlur={e => { e.target.style.borderColor = 'transparent'; }} />
        {search && (
          <button onClick={() => setSearch('')}
            style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex', padding: 2 }}>
            <X size={11} />
          </button>
        )}
      </div>
      <select value={stageFilter} onChange={e => setStageFilter(e.target.value as LeadStage | 'all')}
        style={{ padding: '7px 10px', background: 'var(--bg-hover)', border: '1px solid transparent', borderRadius: 'var(--radius-md)', fontSize: 12, fontFamily: 'var(--font-body)', color: stageFilter !== 'all' ? 'var(--text-primary)' : 'var(--text-secondary)', outline: 'none', cursor: 'pointer' }}>
        <option value="all">All stages</option>
        {stages.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>
      <span className="t-2xs text-tertiary" style={{ whiteSpace: 'nowrap' }}>{resultCount} lead{resultCount !== 1 ? 's' : ''}</span>
    </div>
  );
}

// ── SORT HEADER HELPER ─────────────────────────────────────────
function SortTh({ label, sortKey, activeKey, dir, onSort }: {
  label: string; sortKey: SortKey | null; activeKey: SortKey; dir: SortDir; onSort: (k: SortKey) => void;
}) {
  const active = sortKey && activeKey === sortKey;
  return (
    <div onClick={() => sortKey && onSort(sortKey)}
      style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.06em', color: active ? 'var(--text-primary)' : 'var(--text-tertiary)', cursor: sortKey ? 'pointer' : 'default', userSelect: 'none' as const, fontFamily: 'var(--font-body)', transition: 'color 150ms' }}>
      {label}
      {active && (dir === 'asc' ? <ChevronUp size={10} /> : <ChevronDown size={10} />)}
    </div>
  );
}

// ── CONTACT TABLE ──────────────────────────────────────────────
// Columns: Name + Company | Channel | Stage | Last Activity | Next Action | →
const CONTACT_COLS = '2fr 1fr 1.2fr 1fr 1.6fr 80px';

function ContactTableHeader({ sortKey, sortDir, onSort }: { sortKey: SortKey; sortDir: SortDir; onSort: (k: SortKey) => void }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: CONTACT_COLS, padding: '8px 16px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-hover)' }}>
      <SortTh label="Contact"       sortKey="company"          activeKey={sortKey} dir={sortDir} onSort={onSort} />
      <SortTh label="Channel"       sortKey={null}             activeKey={sortKey} dir={sortDir} onSort={onSort} />
      <SortTh label="Stage"         sortKey="stage"            activeKey={sortKey} dir={sortDir} onSort={onSort} />
      <SortTh label="Last Activity" sortKey="last_activity_at" activeKey={sortKey} dir={sortDir} onSort={onSort} />
      <SortTh label="Next Action"   sortKey={null}             activeKey={sortKey} dir={sortDir} onSort={onSort} />
      <div />
    </div>
  );
}

function ContactRow({ lead, isLast, onClick, onAdvance, canAdvance }: {
  lead: Lead; isLast: boolean; onClick: () => void; onAdvance: () => void; canAdvance: boolean;
}) {
  const cfg = stageCfg(lead.stage);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: CONTACT_COLS, padding: '10px 16px', borderBottom: isLast ? 'none' : '1px solid var(--border-subtle)', cursor: 'pointer', transition: 'background 150ms', alignItems: 'center' }}
      onClick={onClick}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
      <div style={{ minWidth: 0, paddingRight: 10 }}>
        <p className="t-xs-medium" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {lead.contact_name || lead.company}
        </p>
        <p className="t-2xs text-tertiary" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {lead.contact_name ? lead.company : ''}
        </p>
      </div>
      <div><ChannelBadge channel={lead.channel} /></div>
      <div><StagePill stage={lead.stage} size="sm" /></div>
      <div><span className="t-2xs text-secondary">{formatRelative(lead.last_activity_at)}</span></div>
      <div style={{ minWidth: 0, paddingRight: 8 }}>
        {lead.next_action
          ? <p className="t-2xs" style={{ color: 'var(--accent-amber)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>→ {lead.next_action}</p>
          : <span className="t-2xs text-tertiary">—</span>}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }} onClick={e => e.stopPropagation()}>
        <button onClick={e => { e.stopPropagation(); onAdvance(); }}
          title="Advance stage"
          style={{ display: 'flex', alignItems: 'center', padding: '4px 8px', borderRadius: 'var(--radius-sm)', border: `1px solid ${cfg.color}`, background: `${cfg.color}14`, color: cfg.color, fontSize: 10, fontWeight: 600, fontFamily: 'var(--font-body)', cursor: 'pointer', transition: 'all 150ms' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = `${cfg.color}28`; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = `${cfg.color}14`; }}>
          <ArrowRight size={10} />
        </button>
      </div>
    </div>
  );
}

// ── DEAL TABLE ─────────────────────────────────────────────────
// Columns: Company | Stage | Value | Last Activity | Next Action | →
const DEAL_COLS = '2fr 1.4fr 1fr 1fr 1.6fr 80px';

function DealTableHeader({ sortKey, sortDir, onSort }: { sortKey: SortKey; sortDir: SortDir; onSort: (k: SortKey) => void }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: DEAL_COLS, padding: '8px 16px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-hover)' }}>
      <SortTh label="Company"       sortKey="company"          activeKey={sortKey} dir={sortDir} onSort={onSort} />
      <SortTh label="Stage"         sortKey="stage"            activeKey={sortKey} dir={sortDir} onSort={onSort} />
      <SortTh label="Value"         sortKey="deal_value"       activeKey={sortKey} dir={sortDir} onSort={onSort} />
      <SortTh label="Last Activity" sortKey="last_activity_at" activeKey={sortKey} dir={sortDir} onSort={onSort} />
      <SortTh label="Next Action"   sortKey={null}             activeKey={sortKey} dir={sortDir} onSort={onSort} />
      <div />
    </div>
  );
}

function DealRow({ lead, isLast, onClick, onAdvance, canAdvance }: {
  lead: Lead; isLast: boolean; onClick: () => void; onAdvance: () => void; canAdvance: boolean;
}) {
  const cfg = stageCfg(lead.stage);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: DEAL_COLS, padding: '10px 16px', borderBottom: isLast ? 'none' : '1px solid var(--border-subtle)', cursor: 'pointer', transition: 'background 150ms', alignItems: 'center' }}
      onClick={onClick}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
      <div style={{ minWidth: 0, paddingRight: 10 }}>
        <p className="t-xs-medium" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.company}</p>
        {lead.contact_name && <p className="t-2xs text-tertiary" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.contact_name}</p>}
      </div>
      <div><StagePill stage={lead.stage} size="sm" /></div>
      <div>
        {lead.deal_value
          ? <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--accent-green)' }}>{formatINR(Number(lead.deal_value))}</span>
          : <span className="t-2xs text-tertiary">—</span>}
      </div>
      <div><span className="t-2xs text-secondary">{formatRelative(lead.last_activity_at)}</span></div>
      <div style={{ minWidth: 0, paddingRight: 8 }}>
        {lead.next_action
          ? <p className="t-2xs" style={{ color: 'var(--accent-amber)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>→ {lead.next_action}</p>
          : <span className="t-2xs text-tertiary">—</span>}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }} onClick={e => e.stopPropagation()}>
        {canAdvance && (
          <button onClick={e => { e.stopPropagation(); onAdvance(); }}
            style={{ display: 'flex', alignItems: 'center', padding: '4px 8px', borderRadius: 'var(--radius-sm)', border: `1px solid ${cfg.color}`, background: `${cfg.color}14`, color: cfg.color, fontSize: 10, fontWeight: 600, fontFamily: 'var(--font-body)', cursor: 'pointer', transition: 'all 150ms' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = `${cfg.color}28`; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = `${cfg.color}14`; }}>
            <ArrowRight size={10} />
          </button>
        )}
      </div>
    </div>
  );
}

// ── CLOSED ROW ─────────────────────────────────────────────────
function ClosedRow({ lead, isLast, onClick }: { lead: Lead; isLast: boolean; onClick: () => void }) {
  const cfg = stageCfg(lead.stage);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: isLast ? 'none' : '1px solid var(--border-subtle)', cursor: 'pointer', transition: 'background 150ms' }}
      onClick={onClick}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
      <div style={{ width: 26, height: 26, borderRadius: 'var(--radius-sm)', background: `${cfg.color}14`, color: cfg.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {lead.stage === 'closed_won' ? <Check size={12} /> : <X size={12} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p className="t-xs-medium" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.company}</p>
        {lead.contact_name && <p className="t-2xs text-tertiary">{lead.contact_name}</p>}
      </div>
      {lead.deal_value && (
        <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 600, color: cfg.color, flexShrink: 0 }}>{formatINR(Number(lead.deal_value))}</span>
      )}
      <span className="t-2xs text-tertiary">{formatRelative(lead.last_activity_at)}</span>
    </div>
  );
}

// ── KANBAN BOARD (shared) ──────────────────────────────────────
function KanbanBoard({ stages, leads, onCardClick, onAdvance }: {
  stages: typeof CONTACT_STAGES; leads: Lead[];
  onCardClick: (l: Lead) => void; onAdvance: (l: Lead) => void;
}) {
  return (
    <div style={{ overflowX: 'auto', paddingBottom: 8 }}>
      <div style={{ display: 'flex', gap: 10, minWidth: 'max-content', alignItems: 'flex-start' }}>
        {stages.map(stage => {
          const stageLeads = leads.filter(l => l.stage === stage.value);
          return (
            <div key={stage.value} style={{ width: 228, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 2px' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: stage.color, flexShrink: 0 }} />
                <span className="t-label" style={{ flex: 1 }}>{stage.label}</span>
                <span className="t-mono-sm" style={{ color: stageLeads.length > 0 ? 'var(--text-secondary)' : 'var(--text-tertiary)' }}>{stageLeads.length}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {stageLeads.map(lead => (
                  <KanbanCard key={lead.id} lead={lead} stageColor={stage.color}
                    onClick={() => onCardClick(lead)} onAdvance={() => onAdvance(lead)} />
                ))}
                {stageLeads.length === 0 && (
                  <div style={{ padding: '18px 8px', textAlign: 'center', border: '1px dashed var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
                    <p className="t-2xs text-tertiary">Empty</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function KanbanCard({ lead, stageColor, onClick, onAdvance }: {
  lead: Lead; stageColor: string; onClick: () => void; onAdvance: () => void;
}) {
  return (
    <div className="card"
      style={{ padding: '11px 13px', cursor: 'pointer', transition: 'background 150ms', borderLeft: `3px solid ${stageColor}` }}
      onClick={onClick}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; }}>
      <p className="t-xs-medium" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 2 }}>
        {lead.contact_name || lead.company}
      </p>
      {lead.contact_name && (
        <p className="t-2xs text-secondary" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 5 }}>{lead.company}</p>
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: lead.next_action ? 5 : 0 }}>
        <span className="t-2xs text-tertiary">{formatRelative(lead.last_activity_at)}</span>
        {lead.channel && <ChannelBadge channel={lead.channel} />}
      </div>
      {lead.deal_value && (
        <p style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--accent-green)', marginBottom: lead.next_action ? 4 : 0 }}>{formatINR(Number(lead.deal_value))}</p>
      )}
      {lead.next_action && (
        <p className="t-2xs" style={{ color: 'var(--accent-amber)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>→ {lead.next_action}</p>
      )}
      <div style={{ marginTop: 7, paddingTop: 7, borderTop: '1px solid var(--border-subtle)' }}
        onClick={e => e.stopPropagation()}>
        <button onClick={e => { e.stopPropagation(); onAdvance(); }}
          style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 600, color: stageColor, background: `${stageColor}14`, border: 'none', borderRadius: 'var(--radius-sm)', padding: '4px 8px', cursor: 'pointer', fontFamily: 'var(--font-body)', width: '100%', justifyContent: 'center', transition: 'background 150ms' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = `${stageColor}28`; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = `${stageColor}14`; }}>
          <ArrowRight size={10} /> Advance
        </button>
      </div>
    </div>
  );
}

// ── EMPTY STATE ────────────────────────────────────────────────
function EmptyTableState({ search, stageFilter, onAdd, noun }: {
  search: string; stageFilter: string; onAdd: () => void; noun: string;
}) {
  return (
    <div style={{ padding: '32px 16px', textAlign: 'center' }}>
      <p className="t-xs text-tertiary" style={{ fontStyle: 'italic', marginBottom: search || stageFilter !== 'all' ? 0 : 12 }}>
        {search || stageFilter !== 'all'
          ? `No ${noun} match your filters.`
          : `No ${noun} yet.`}
      </p>
      {!search && stageFilter === 'all' && (
        <Button icon={<Plus size={13} />} onClick={onAdd} variant="secondary">Add Lead</Button>
      )}
    </div>
  );
}

// ── LEAD DETAIL MODAL ──────────────────────────────────────────
function LeadDetailModal({ lead, onClose, onMoveStage, onDelete, onUpdate }: {
  lead: Lead; onClose: () => void;
  onMoveStage: (id: string, stage: LeadStage) => void;
  onDelete: (id: string) => void;
  onUpdate: (lead: Lead) => void;
}) {
  const supabase = useRef(createClient()).current;
  const [newNote, setNewNote]         = useState('');
  const [savingNote, setSavingNote]   = useState(false);
  const [editing, setEditing]         = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [company, setCompany]               = useState(lead.company);
  const [contactName, setContactName]       = useState(lead.contact_name || '');
  const [contactEmail, setContactEmail]     = useState(lead.contact_email || '');
  const [contactPhone, setContactPhone]     = useState(lead.contact_phone || '');
  const [channel, setChannel]               = useState(lead.channel || 'linkedin');
  const [profileUrl, setProfileUrl]         = useState(lead.profile_url || '');
  const [context, setContext]               = useState(lead.context || '');
  const [dealValue, setDealValue]           = useState(lead.deal_value ? String(lead.deal_value) : '');
  const [nextAction, setNextAction]         = useState(lead.next_action || '');
  const [nextActionDate, setNextActionDate] = useState(lead.next_action_date || '');
  const [savingEdit, setSavingEdit]         = useState(false);

  const isContact = CONTACT_STAGES.some(s => s.value === lead.stage);
  const isDeal    = DEAL_STAGES.some(s => s.value === lead.stage);
  const isActive  = isContact || isDeal;
  const allActive = [...CONTACT_STAGES, ...DEAL_STAGES];
  const curIdx    = allActive.findIndex(s => s.value === lead.stage);
  const nextStage = allActive[curIdx + 1] ?? null;
  const cfg       = stageCfg(lead.stage);

  async function saveEdit() {
    setSavingEdit(true);
    const { data } = await supabase.from('leads').update({
      company: company.trim(), contact_name: contactName || null,
      contact_email: contactEmail || null, contact_phone: contactPhone || null,
      channel: channel || null, profile_url: profileUrl || null,
      context: context || null,
      deal_value: dealValue ? parseFloat(dealValue) : null,
      next_action: nextAction || null, next_action_date: nextActionDate || null,
      updated_at: new Date().toISOString(),
    }).eq('id', lead.id).select().single();
    if (data) onUpdate(data as Lead);
    setSavingEdit(false);
    setEditing(false);
  }

  async function addNote() {
    if (!newNote.trim()) return;
    setSavingNote(true);
    const notes = [...(lead.notes || []), { text: newNote.trim(), created_at: new Date().toISOString() }];
    await supabase.from('leads').update({ notes, last_activity_at: new Date().toISOString() }).eq('id', lead.id);
    onUpdate({ ...lead, notes } as Lead);
    setNewNote('');
    setSavingNote(false);
  }

  return (
    <Modal open={true} onClose={onClose}
      title={lead.contact_name || lead.company}
      description={lead.contact_name ? lead.company : undefined}
      size="md">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

        {/* Stage + progress */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            <StagePill stage={lead.stage} />
            {lead.channel && <ChannelBadge channel={lead.channel} />}
            {lead.deal_value && (
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-green)', fontFamily: 'var(--font-mono)' }}>{formatINR(Number(lead.deal_value))}</span>
            )}
            {lead.source && (
              <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 100, border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}>{lead.source}</span>
            )}
          </div>
          {isActive && <PipelineProgress stage={lead.stage} />}
        </div>

        {/* Stage actions */}
        {isActive && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {nextStage && (
              <button onClick={() => onMoveStage(lead.id, nextStage.value)}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 'var(--radius-sm)', border: `1px solid ${nextStage.color}`, background: `${nextStage.color}14`, color: nextStage.color, fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-body)', cursor: 'pointer', transition: 'all 150ms' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = `${nextStage.color}28`; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = `${nextStage.color}14`; }}>
                <ChevronRight size={12} /> Move to {nextStage.label}
              </button>
            )}
            <button onClick={() => onMoveStage(lead.id, 'closed_won')}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--accent-green)', background: 'var(--accent-green-dim)', color: 'var(--accent-green)', fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-body)', cursor: 'pointer' }}>
              <Check size={11} /> Close Won
            </button>
            <button onClick={() => onMoveStage(lead.id, 'closed_lost')}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)', background: 'transparent', color: 'var(--text-tertiary)', fontSize: 11, fontFamily: 'var(--font-body)', cursor: 'pointer', transition: 'all 150ms' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent-red)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent-red)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)'; }}>
              <X size={11} /> Close Lost
            </button>
          </div>
        )}

        {/* Context block (if set) */}
        {lead.context && !editing && (
          <div style={{ padding: '10px 14px', background: 'var(--bg-hover)', borderRadius: 'var(--radius-md)', borderLeft: `3px solid ${cfg.color}` }}>
            <p className="t-label" style={{ marginBottom: 4 }}>Context</p>
            <p className="t-xs text-secondary">{lead.context}</p>
          </div>
        )}

        {/* Contact details — view */}
        {!editing ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {lead.contact_email && (
              <div>
                <p className="t-label" style={{ marginBottom: 3 }}>Email</p>
                <p className="t-xs" style={{ color: 'var(--accent-blue)' }}>{lead.contact_email}</p>
              </div>
            )}
            {lead.contact_phone && (
              <div>
                <p className="t-label" style={{ marginBottom: 3 }}>Phone</p>
                <p className="t-xs">{lead.contact_phone}</p>
              </div>
            )}
            {lead.profile_url && (
              <div>
                <p className="t-label" style={{ marginBottom: 3 }}>Profile</p>
                <a href={lead.profile_url} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--accent-blue)', textDecoration: 'none', fontFamily: 'var(--font-body)' }}>
                  <ExternalLink size={12} /> View profile
                </a>
              </div>
            )}
            {lead.next_action && (
              <div>
                <p className="t-label" style={{ marginBottom: 3 }}>Next Action</p>
                <p className="t-xs" style={{ color: 'var(--accent-amber)' }}>{lead.next_action}</p>
              </div>
            )}
            {lead.next_action_date && (
              <div>
                <p className="t-label" style={{ marginBottom: 3 }}>Action Date</p>
                <p className="t-xs">{formatDate(lead.next_action_date)}</p>
              </div>
            )}
          </div>
        ) : (
          /* Edit form */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '14px', background: 'var(--bg-hover)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Input label="Company" value={company} onChange={e => setCompany(e.target.value)} />
              <Input label="Contact Name" value={contactName} onChange={e => setContactName(e.target.value)} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Input label="Email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} />
              <Input label="Phone" value={contactPhone} onChange={e => setContactPhone(e.target.value)} />
            </div>
            {/* Channel picker */}
            <div>
              <label className="t-label" style={{ display: 'block', marginBottom: 6 }}>Channel</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {CHANNELS.map(ch => (
                  <button key={ch.value} type="button" onClick={() => setChannel(ch.value)}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 9px', borderRadius: 'var(--radius-sm)', border: `1px solid ${channel === ch.value ? ch.color : 'var(--border-default)'}`, background: channel === ch.value ? `${ch.color}14` : 'transparent', color: channel === ch.value ? ch.color : 'var(--text-secondary)', fontSize: 10, fontWeight: channel === ch.value ? 600 : 400, fontFamily: 'var(--font-body)', cursor: 'pointer', transition: 'all 150ms' }}>
                    {ch.icon} {ch.label}
                  </button>
                ))}
              </div>
            </div>
            <Input label="Profile URL" value={profileUrl} onChange={e => setProfileUrl(e.target.value)} placeholder="https://..." />
            <Textarea label="Context" value={context} onChange={e => setContext(e.target.value)} placeholder="What are they looking for? Why are you reaching out?" style={{ minHeight: 60 }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Input label="Deal Value (₹)" type="number" value={dealValue} onChange={e => setDealValue(e.target.value)} />
              <Input label="Action Date" type="date" value={nextActionDate} onChange={e => setNextActionDate(e.target.value)} />
            </div>
            <Input label="Next Action" value={nextAction} onChange={e => setNextAction(e.target.value)} />
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="secondary" onClick={() => setEditing(false)} style={{ flex: 1 }}>Cancel</Button>
              <Button onClick={saveEdit} loading={savingEdit} style={{ flex: 1 }}>Save</Button>
            </div>
          </div>
        )}

        {/* Action buttons */}
        {!editing && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={() => setEditing(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 11, fontFamily: 'var(--font-body)', cursor: 'pointer', transition: 'all 150ms' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent-blue)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent-blue)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)'; }}>
              <Pencil size={11} /> Edit
            </button>
            {!confirmDelete ? (
              <button onClick={() => setConfirmDelete(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'transparent', color: 'var(--text-tertiary)', fontSize: 11, fontFamily: 'var(--font-body)', cursor: 'pointer', transition: 'color 150ms' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent-red)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; }}>
                <Trash2 size={11} /> Delete
              </button>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="t-2xs text-secondary">Delete this lead?</span>
                <button onClick={() => { onDelete(lead.id); onClose(); }}
                  style={{ padding: '4px 10px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--accent-red)', color: '#fff', fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-body)', cursor: 'pointer' }}>
                  Yes, delete
                </button>
                <button onClick={() => setConfirmDelete(false)}
                  style={{ padding: '4px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 11, fontFamily: 'var(--font-body)', cursor: 'pointer' }}>
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}

        {/* Activity log */}
        <div>
          <p className="t-label" style={{ marginBottom: 10 }}>Activity Log</p>
          {(lead.notes || []).length === 0 ? (
            <p className="t-xs text-tertiary" style={{ fontStyle: 'italic', marginBottom: 10 }}>No notes yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 160, overflowY: 'auto', marginBottom: 10 }}>
              {[...(lead.notes || [])].reverse().map((note: any, i: number) => (
                <div key={i} style={{ padding: '7px 11px', borderLeft: '2px solid var(--border-default)', background: 'var(--bg-hover)', borderRadius: '0 var(--radius-sm) var(--radius-sm) 0' }}>
                  <p className="t-xs text-primary" style={{ lineHeight: 1.5 }}>{note.text}</p>
                  <p className="t-2xs text-tertiary" style={{ marginTop: 3 }}>{formatRelative(note.created_at)}</p>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <Input value={newNote} onChange={e => setNewNote(e.target.value)}
              placeholder="Add a note..." style={{ flex: 1 }}
              onKeyDown={e => e.key === 'Enter' && addNote()} />
            <Button variant="secondary" onClick={addNote} loading={savingNote} disabled={!newNote.trim()}>Add</Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ── CREATE LEAD MODAL ──────────────────────────────────────────
function CreateLeadModal({ open, onClose, mode, currentUser, initialTab, onCreated }: {
  open: boolean; onClose: () => void; mode: string; currentUser: any;
  initialTab: 'contacts' | 'deals'; onCreated: (lead: Lead) => void;
}) {
  const supabase = useRef(createClient()).current;
  const [company, setCompany]         = useState('');
  const [contactName, setContactName] = useState('');
  const [email, setEmail]             = useState('');
  const [phone, setPhone]             = useState('');
  const [channel, setChannel]         = useState('linkedin');
  const [profileUrl, setProfileUrl]   = useState('');
  const [context, setContext]         = useState('');
  const [source, setSource]           = useState('');
  const [dealValue, setDealValue]     = useState('');
  const [nextAction, setNextAction]   = useState('');
  const [saving, setSaving]           = useState(false);

  // Default stage based on which tab triggered the add
  const defaultStage: LeadStage = initialTab === 'deals' ? 'proposal_sent' : 'prospect';

  useEffect(() => {
    if (!open) {
      setCompany(''); setContactName(''); setEmail(''); setPhone('');
      setChannel('linkedin'); setProfileUrl(''); setContext('');
      setSource(''); setDealValue(''); setNextAction('');
    }
  }, [open]);

  async function handleCreate() {
    if (!company.trim() || !currentUser) return;
    setSaving(true);
    // Build the insert payload — omit channel/profile_url/context if not set
    // to avoid 400 errors on instances where migration 011 hasn't been applied yet
    const payload: Record<string, unknown> = {
      user_id: currentUser.ownerId, mode, company: company.trim(),
      contact_name: contactName || null, contact_email: email || null,
      contact_phone: phone || null,
      source: source || null, stage: defaultStage,
      deal_value: dealValue ? parseFloat(dealValue) : null,
      next_action: nextAction || null, notes: [],
      last_activity_at: new Date().toISOString(),
    };
    if (channel)     payload.channel     = channel;
    if (profileUrl)  payload.profile_url = profileUrl;
    if (context)     payload.context     = context;

    const { data } = await supabase.from('leads').insert(payload).select().single();
    if (data) onCreated(data as Lead);
    setSaving(false);
  }

  const isDeals = initialTab === 'deals';

  return (
    <Modal open={open} onClose={onClose}
      title={isDeals ? 'Add Deal' : 'Add Contact'}
      description={isDeals ? 'Starts at Proposal Sent stage' : 'Starts at Prospect stage'}
      size="md">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Input label="Company *" value={company} onChange={e => setCompany(e.target.value)} placeholder="Company name" autoFocus />
          <Input label="Contact Name" value={contactName} onChange={e => setContactName(e.target.value)} placeholder="Full name" />
        </div>

        {/* Channel — only for contacts */}
        {!isDeals && (
          <div>
            <label className="t-label" style={{ display: 'block', marginBottom: 7 }}>Channel</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {CHANNELS.map(ch => (
                <button key={ch.value} type="button" onClick={() => setChannel(ch.value)}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 'var(--radius-sm)', border: `1px solid ${channel === ch.value ? ch.color : 'var(--border-default)'}`, background: channel === ch.value ? `${ch.color}14` : 'transparent', color: channel === ch.value ? ch.color : 'var(--text-secondary)', fontSize: 11, fontWeight: channel === ch.value ? 600 : 400, fontFamily: 'var(--font-body)', cursor: 'pointer', transition: 'all 150ms' }}>
                  {ch.icon} {ch.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Input label="Email" value={email} onChange={e => setEmail(e.target.value)} placeholder="contact@company.com" />
          <Input label="Phone" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91..." />
        </div>

        {!isDeals && (
          <>
            <Input label="Profile URL" value={profileUrl} onChange={e => setProfileUrl(e.target.value)}
              placeholder={channel === 'linkedin' ? 'https://linkedin.com/in/...' : 'https://...'} />
            <Textarea label="Context (what they need / why reaching out)" value={context}
              onChange={e => setContext(e.target.value)} style={{ minHeight: 60 }} />
          </>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Select label="Source" value={source} onChange={e => setSource(e.target.value)}
            options={[{ value: '', label: 'Unknown' }, ...SOURCE_OPTIONS.map(s => ({ value: s, label: s }))]} />
          <Input label="Deal Value (₹)" type="number" value={dealValue} onChange={e => setDealValue(e.target.value)} placeholder="0" />
        </div>

        <Input label="Next Action" value={nextAction} onChange={e => setNextAction(e.target.value)}
          placeholder={isDeals ? 'e.g., Follow up on proposal...' : 'e.g., Send intro message...'} />

        <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
          <Button variant="secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</Button>
          <Button onClick={handleCreate} loading={saving} disabled={!company.trim()} style={{ flex: 1 }}>
            {isDeals ? 'Add Deal' : 'Add Contact'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useBrand } from '@/lib/brand';
import { useCurrentUser } from '@/lib/auth/use-auth';
import { createClient } from '@/lib/supabase/client';
import { PageTransition } from '@/components/dashboard/PageTransition';
import { Button, Input, Modal, Textarea, Select } from '@/components/ui';
import { toast } from '@/components/ui/Toast';
import { formatDate, formatRelative, stageLabel, buildMailtoLink, buildWhatsAppLink } from '@/lib/utils';
import {
  Plus, Users, Search, ChevronRight, ChevronLeft, Mail, MessageCircle,
  StickyNote, Key, CheckCircle2, Trash2, Pencil, X, FileText, ExternalLink,
} from 'lucide-react';
import type { Client, ClientStage, PreferredChannel } from '@/types';
import type { Json } from '@/types/database';
import {
  createClientRecord,
  updateClientRecord,
  changeClientStage,
  updateClientNotes,
  updateClientCredentials,
  deleteClientRecord,
} from '@/app/dashboard/actions/clients';

const ALL_STAGES: ClientStage[] = [
  'lead', 'contacted', 'qualified',
  'proposal_sent', 'proposal_accepted',
  'contract_sent', 'contract_signed',
  'upfront_paid', 'requirements_sent', 'requirements_received', 'credentials_pending',
  'in_progress', 'milestone_review', 'revision',
  'final_review', 'final_payment_sent', 'final_payment_received',
  'handover', 'deployed',
  'support_active', 'feedback_sent', 'retention_sent', 'completed',
];

const PHASES = [
  { label: 'Discovery',    stages: ['lead','contacted','qualified'],                                                      color: 'var(--text-tertiary)' },
  { label: 'Proposal',     stages: ['proposal_sent','proposal_accepted'],                                                  color: 'var(--accent-amber)' },
  { label: 'Contracting',  stages: ['contract_sent','contract_signed'],                                                    color: 'var(--accent-amber)' },
  { label: 'Kickoff',      stages: ['upfront_paid','requirements_sent','requirements_received','credentials_pending'],    color: 'var(--accent-blue)' },
  { label: 'Active',       stages: ['in_progress','milestone_review','revision'],                                         color: 'var(--accent-violet)' },
  { label: 'Closing',      stages: ['final_review','final_payment_sent','final_payment_received'],                        color: 'var(--accent-blue)' },
  { label: 'Handover',     stages: ['handover','deployed'],                                                               color: 'var(--accent-green)' },
  { label: 'Post-project', stages: ['support_active','feedback_sent','retention_sent'],                                   color: 'var(--accent-green)' },
];

const SERVICE_TYPES = [
  { value: 'web_dev',     label: 'Web Development' },
  { value: 'app_dev',     label: 'App Development' },
  { value: 'web_design',  label: 'Web / App Design' },
  { value: 'logo',        label: 'Logo Design' },
  { value: 'branding',    label: 'Branding & Print' },
  { value: 'seo',         label: 'SEO' },
  { value: 'digital_mkt', label: 'Digital Marketing' },
  { value: 'other',       label: 'Other' },
];

function stageBadgeColor(stage: ClientStage): string {
  if (['lead','contacted','qualified'].includes(stage)) return 'var(--text-tertiary)';
  if (['proposal_sent','proposal_accepted','contract_sent','contract_signed'].includes(stage)) return 'var(--accent-amber)';
  if (['upfront_paid','requirements_sent','requirements_received','credentials_pending'].includes(stage)) return 'var(--accent-blue)';
  if (['in_progress','milestone_review','revision'].includes(stage)) return 'var(--accent-violet)';
  if (['final_review','final_payment_sent','final_payment_received','handover','deployed'].includes(stage)) return 'var(--accent-blue)';
  if (['support_active','feedback_sent','retention_sent'].includes(stage)) return 'var(--accent-green)';
  return 'var(--text-tertiary)';
}

function phaseOf(stage: ClientStage) {
  return PHASES.find(p => p.stages.includes(stage))?.label || '';
}

function clientInitialColor(name: string) {
  const hue = name.charCodeAt(0) * 37 % 360;
  return `hsl(${hue}, 50%, 40%)`;
}

function StagePill({ stage }: { stage: ClientStage }) {
  const color = stageBadgeColor(stage);
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 9px', borderRadius: 100, fontSize: 11, fontWeight: 500,
      background: `${color}1A`, color,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', flexShrink: 0 }} />
      {stageLabel(stage)}
    </span>
  );
}

// ─── MAIN PAGE ───
export default function PersonalClientsPage() {
  const { mode } = useBrand();
  const { user: currentUser } = useCurrentUser();
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;

  const [clients, setClients]             = useState<Client[]>([]);
  const [loading, setLoading]             = useState(true);
  const [search, setSearch]               = useState('');
  const [showCreate, setShowCreate]       = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showPast, setShowPast]           = useState(false);

  const fetchClients = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    const { data } = await supabase.from('clients').select('*')
      .eq('user_id', currentUser.ownerId).eq('mode', mode)
      .order('updated_at', { ascending: false });
    setClients((data as unknown as Client[]) || []);
    setLoading(false);
  }, [currentUser, mode, supabase]);

  useEffect(() => { fetchClients(); }, [fetchClients]);

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.company?.toLowerCase().includes(search.toLowerCase()) ||
    c.contact_name?.toLowerCase().includes(search.toLowerCase())
  );
  const active = filtered.filter(c => c.current_stage !== 'completed');
  const past   = filtered.filter(c => c.current_stage === 'completed');

  async function handleStageChange(clientId: string, newStage: ClientStage) {
    const client = clients.find(c => c.id === clientId);
    if (!client) return;
    // Optimistic update — server recomputes stage_history authoritatively,
    // but showing the new stage immediately makes the kanban feel snappy.
    // If the server rejects, we roll back and surface the error.
    const optimisticHistory = [
      ...(client.stage_history || []),
      { stage: newStage, entered_at: new Date().toISOString() },
    ];
    const optimistic = { ...client, current_stage: newStage, stage_history: optimisticHistory };
    const prevClients = clients;
    setClients(prev => prev.map(c => c.id === clientId ? optimistic : c));
    if (selectedClient?.id === clientId) setSelectedClient(optimistic);

    const res = await changeClientStage(clientId, newStage);
    if (!res.ok) {
      setClients(prevClients);
      if (selectedClient?.id === clientId) setSelectedClient(client);
      toast.error(res.error || 'Could not change stage');
      return;
    }
    // Replace optimistic with server truth (stage_history appended server-side
    // includes server-generated entered_at timestamp, which may differ from ours).
    setClients(prev => prev.map(c => c.id === clientId ? res.data : c));
    if (selectedClient?.id === clientId) setSelectedClient(res.data);
  }

  async function handleDelete(clientId: string) {
    const prevClients = clients;
    const prevSelected = selectedClient;
    setClients(prev => prev.filter(c => c.id !== clientId));
    if (selectedClient?.id === clientId) setSelectedClient(null);

    const res = await deleteClientRecord(clientId);
    if (!res.ok) {
      setClients(prevClients);
      setSelectedClient(prevSelected);
      toast.error(res.error || 'Could not delete client');
    }
  }

  // Any active clients across all phases?
  const hasActive = PHASES.some(p => active.some(c => p.stages.includes(c.current_stage)));

  return (
    <PageTransition>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <h1 className="t-h1">Clients</h1>
            <p className="t-xs mt-1">Every client, every project, one place.</p>
          </div>
          <Button icon={<Plus size={14} />} onClick={() => setShowCreate(true)}>Add Client</Button>
        </div>

        {/* Pipeline phase strip — only show phases that have clients */}
        {hasActive && (
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
            {PHASES.map(phase => {
              const count = active.filter(c => phase.stages.includes(c.current_stage)).length;
              if (count === 0) return null;
              return (
                <div key={phase.label} style={{
                  padding: '10px 16px', background: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)',
                  borderTop: `3px solid ${phase.color}`, flexShrink: 0, textAlign: 'center', minWidth: 80,
                }}>
                  <p style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800, color: phase.color, lineHeight: 1 }}>{count}</p>
                  <p className="t-label" style={{ marginTop: 4 }}>{phase.label}</p>
                </div>
              );
            })}
          </div>
        )}

        {/* Search */}
        <div style={{ position: 'relative', maxWidth: 340 }}>
          <Search size={13} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none' }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search clients..."
            style={{ width: '100%', background: 'var(--bg-hover)', border: '1px solid transparent', borderRadius: 'var(--radius-md)', padding: '8px 12px 8px 34px', fontSize: 12, fontFamily: 'var(--font-body)', color: 'var(--text-primary)', outline: 'none', transition: 'border-color 150ms' }}
            onFocus={e => { e.target.style.borderColor = 'var(--border-default)'; }}
            onBlur={e => { e.target.style.borderColor = 'transparent'; }} />
        </div>

        {/* Client list */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[1,2,3].map(i => <div key={i} className="card" style={{ height: 68, background: 'var(--bg-hover)', animation: 'ds-pulse 1.5s ease-in-out infinite' }} />)}
          </div>
        ) : active.length === 0 && past.length === 0 ? (
          <div className="card" style={{ padding: '48px 24px', textAlign: 'center' }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--accent-blue-dim)', color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Users size={20} />
            </div>
            <p className="t-sm-semibold" style={{ marginBottom: 6 }}>No clients yet</p>
            <p className="t-xs" style={{ marginBottom: 18 }}>Add your first client. Usually starts from an outreach lead converting.</p>
            <Button icon={<Plus size={14} />} onClick={() => setShowCreate(true)}>Add Client</Button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {active.map(client => (
              <div key={client.id} className="card"
                style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', transition: 'background 150ms' }}
                onClick={() => setSelectedClient(client)}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; }}>
                {/* Avatar */}
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: clientInitialColor(client.name), color: '#fff', fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {client.name[0].toUpperCase()}
                </div>
                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <span className="t-sm-semibold">{client.name}</span>
                    {client.company && <span className="t-2xs text-tertiary">· {client.company}</span>}
                    {client.service_type && (
                      <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 100, background: 'var(--accent-violet-dim)', color: 'var(--accent-violet)', fontWeight: 500 }}>
                        {SERVICE_TYPES.find(s => s.value === client.service_type)?.label}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="t-2xs text-tertiary">{phaseOf(client.current_stage)}</span>
                    <span className="t-2xs text-tertiary">·</span>
                    <span className="t-2xs text-tertiary">{formatRelative(client.updated_at)}</span>
                  </div>
                </div>
                {/* Stage + chevron */}
                <StagePill stage={client.current_stage} />
                <ChevronRight size={14} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
              </div>
            ))}

            {/* Completed clients — collapsed */}
            {past.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <button onClick={() => setShowPast(!showPast)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', fontFamily: 'var(--font-body)' }}>
                  <ChevronRight size={13} style={{ transform: showPast ? 'rotate(90deg)' : 'none', transition: 'transform 150ms' }} />
                  Completed ({past.length})
                </button>
                {showPast && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6, opacity: 0.6 }}>
                    {past.map(client => (
                      <div key={client.id} className="card"
                        style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
                        onClick={() => setSelectedClient(client)}>
                        <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--bg-hover)', color: 'var(--text-tertiary)', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {client.name[0].toUpperCase()}
                        </div>
                        <span className="t-xs" style={{ flex: 1 }}>{client.name}</span>
                        {client.company && <span className="t-2xs text-tertiary">{client.company}</span>}
                        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 100, background: 'var(--accent-green-dim)', color: 'var(--accent-green)', fontWeight: 500 }}>Completed</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      <CreateClientModal
        open={showCreate} onClose={() => setShowCreate(false)} mode={mode} currentUser={currentUser}
        onCreated={client => { setClients(prev => [client, ...prev]); setShowCreate(false); }} />

      {selectedClient && (
        <ClientDetailModal
          client={selectedClient}
          onClose={() => setSelectedClient(null)}
          onStageChange={handleStageChange}
          onDelete={() => handleDelete(selectedClient.id)}
          onUpdate={updated => {
            setClients(prev => prev.map(c => c.id === updated.id ? updated : c));
            setSelectedClient(updated);
          }} />
      )}
    </PageTransition>
  );
}

// ─── CLIENT DETAIL MODAL ───
function ClientDetailModal({ client, onClose, onStageChange, onUpdate, onDelete }: {
  client: Client; onClose: () => void;
  onStageChange: (id: string, stage: ClientStage) => void;
  onUpdate: (c: Client) => void;
  onDelete: () => void;
}) {
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;

  const [notes, setNotes]         = useState(client.notes || '');
  const [savingNotes, setSavingNotes] = useState(false);
  const [activeSection, setActiveSection] = useState<'overview' | 'documents' | 'credentials' | 'history'>('overview');
  const [editing, setEditing]     = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [clientDocs, setClientDocs] = useState<any[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);

  // Update notes when client changes
  useEffect(() => { setNotes(client.notes || ''); }, [client.id]);

  // Fetch client documents when that tab is opened
  useEffect(() => {
    if (activeSection !== 'documents') return;
    setDocsLoading(true);
    supabase.from('documents')
      .select('id, type, title, status, updated_at, share_token')
      .eq('client_id', client.id)
      .order('updated_at', { ascending: false })
      .then(({ data }) => { setClientDocs(data || []); setDocsLoading(false); });
  }, [activeSection, client.id, supabase]);

  const currentIdx = ALL_STAGES.indexOf(client.current_stage);
  const nextStage  = currentIdx < ALL_STAGES.length - 1 ? ALL_STAGES[currentIdx + 1] : null;
  const prevStage  = currentIdx > 0 ? ALL_STAGES[currentIdx - 1] : null;

  async function saveNotes() {
    setSavingNotes(true);
    const res = await updateClientNotes(client.id, notes);
    setSavingNotes(false);
    if (!res.ok) {
      toast.error(res.error || 'Could not save notes');
      return;
    }
    onUpdate({ ...client, notes });
  }

  return (
    <Modal open={true} onClose={onClose} title={client.name} description={client.company || undefined} size="lg">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Stage navigation */}
        <div style={{ padding: '14px 16px', background: 'var(--bg-hover)', borderRadius: 'var(--radius-md)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <p className="t-label sub-label-gap">Current Stage</p>
              <StagePill stage={client.current_stage} />
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {prevStage && (
                <button onClick={() => onStageChange(client.id, prevStage)}
                  title={`Back to ${stageLabel(prevStage)}`}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 11, fontFamily: 'var(--font-body)', cursor: 'pointer', transition: 'all 150ms' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-strong)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)'; }}>
                  <ChevronLeft size={11} /> {stageLabel(prevStage)}
                </button>
              )}
              {nextStage && (
                <button onClick={() => onStageChange(client.id, nextStage)}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--accent-blue)', background: 'var(--accent-blue-dim)', color: 'var(--accent-blue)', fontSize: 11, fontFamily: 'var(--font-body)', cursor: 'pointer', transition: 'all 150ms' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--accent-blue)'; (e.currentTarget as HTMLElement).style.color = '#fff'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--accent-blue-dim)'; (e.currentTarget as HTMLElement).style.color = 'var(--accent-blue)'; }}>
                  {stageLabel(nextStage)} <ChevronRight size={11} />
                </button>
              )}
            </div>
          </div>
          {/* Progress bar */}
          <div style={{ height: 4, background: 'var(--border-subtle)', borderRadius: 100, overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 100, background: 'var(--accent-blue)', width: `${Math.round((currentIdx / (ALL_STAGES.length - 1)) * 100)}%`, transition: 'width 0.4s ease' }} />
          </div>
          <p className="t-2xs text-tertiary" style={{ marginTop: 5 }}>
            Step {currentIdx + 1} of {ALL_STAGES.length} · {phaseOf(client.current_stage)} phase
          </p>
        </div>

        {/* Contact info + quick actions */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px 20px', flex: 1 }}>
            {client.contact_name  && <div><p className="t-label sub-label-gap">Contact</p><p className="t-xs">{client.contact_name}</p></div>}
            {client.contact_email && <div><p className="t-label sub-label-gap">Email</p><p className="t-xs" style={{ color: 'var(--accent-blue)' }}>{client.contact_email}</p></div>}
            {client.contact_phone && <div><p className="t-label sub-label-gap">Phone</p><p className="t-xs">{client.contact_phone}</p></div>}
            {client.service_type  && <div><p className="t-label sub-label-gap">Service</p><p className="t-xs">{SERVICE_TYPES.find(s => s.value === client.service_type)?.label}</p></div>}
            {client.preferred_channel && <div><p className="t-label sub-label-gap">Channel</p><p className="t-xs" style={{ textTransform: 'capitalize' }}>{client.preferred_channel}</p></div>}
          </div>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            {client.contact_email && (
              <button onClick={() => window.open(buildMailtoLink(client.contact_email!, '', ''), '_blank')}
                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 11, fontFamily: 'var(--font-body)', cursor: 'pointer', transition: 'all 150ms' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent-blue)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent-blue)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)'; }}>
                <Mail size={12} /> Email
              </button>
            )}
            {client.contact_phone && (
              <button onClick={() => window.open(buildWhatsAppLink(client.contact_phone!, ''), '_blank')}
                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 11, fontFamily: 'var(--font-body)', cursor: 'pointer', transition: 'all 150ms' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent-green)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent-green)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)'; }}>
                <MessageCircle size={12} /> WhatsApp
              </button>
            )}
            <button onClick={() => setEditing(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 11, fontFamily: 'var(--font-body)', cursor: 'pointer', transition: 'all 150ms' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; }}>
              <Pencil size={12} /> Edit
            </button>
          </div>
        </div>

        {/* Section tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', gap: 0 }}>
          {(['overview', 'documents', 'credentials', 'history'] as const).map(s => (
            <button key={s} onClick={() => setActiveSection(s)} style={{
              padding: '7px 16px', fontSize: 12, fontWeight: 500, fontFamily: 'var(--font-body)',
              background: 'none', border: 'none', cursor: 'pointer',
              borderBottom: `2px solid ${activeSection === s ? 'var(--accent-blue)' : 'transparent'}`,
              color: activeSection === s ? 'var(--text-primary)' : 'var(--text-tertiary)',
              marginBottom: -1, transition: 'all 150ms',
            }}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        {/* Overview — notes */}
        {activeSection === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)}
              onBlur={saveNotes}
              placeholder="Running notes — project context, preferences, blockers, anything important..."
              style={{ minHeight: 140 }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p className="t-2xs text-tertiary">Auto-saves on blur</p>
              <Button variant="secondary" size="sm" icon={<StickyNote size={12} />}
                onClick={saveNotes} loading={savingNotes}>
                Save Notes
              </Button>
            </div>

            {/* Delete zone */}
            <div style={{ marginTop: 8, paddingTop: 16 }}>
              {!confirmDelete ? (
                <button onClick={() => setConfirmDelete(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)', transition: 'color 150ms' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent-red)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; }}>
                  <Trash2 size={12} /> Delete client
                </button>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <p className="t-xs" style={{ color: 'var(--accent-red)' }}>Delete "{client.name}"? This cannot be undone.</p>
                  <button onClick={onDelete} style={{ padding: '4px 12px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--accent-red)', color: '#fff', fontSize: 11, fontFamily: 'var(--font-body)', cursor: 'pointer' }}>
                    Delete
                  </button>
                  <button onClick={() => setConfirmDelete(false)} style={{ padding: '4px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 11, fontFamily: 'var(--font-body)', cursor: 'pointer' }}>
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Documents */}
        {activeSection === 'documents' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {docsLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[1,2].map(i => <div key={i} style={{ height: 52, borderRadius: 'var(--radius-md)', background: 'var(--bg-hover)', animation: 'ds-pulse 1.5s ease-in-out infinite' }} />)}
              </div>
            ) : clientDocs.length === 0 ? (
              <div style={{ padding: '24px 16px', textAlign: 'center' }}>
                <FileText size={24} style={{ color: 'var(--text-tertiary)', margin: '0 auto 8px' }} />
                <p className="t-xs text-tertiary">No documents yet for this client.</p>
                <p className="t-2xs text-tertiary" style={{ marginTop: 4 }}>Create one in Paperwork and link it to this client.</p>
              </div>
            ) : (
              clientDocs.map(doc => {
                const STATUS_COLOR: Record<string, string> = {
                  draft: 'var(--text-tertiary)', final: 'var(--accent-blue)',
                  sent: 'var(--accent-amber)', viewed: 'var(--accent-violet)',
                  signed: 'var(--accent-green)', paid: 'var(--accent-green)',
                };
                const DOC_LABEL: Record<string, string> = {
                  proposal: 'Proposal', contract: 'Contract', sow: 'Scope of Work',
                  requirements: 'Requirements', invoice: 'Invoice', delivery: 'Delivery',
                };
                const color = STATUS_COLOR[doc.status] || 'var(--text-tertiary)';
                return (
                  <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--bg-hover)', borderRadius: 'var(--radius-md)' }}>
                    <div style={{ width: 30, height: 30, borderRadius: 'var(--radius-sm)', background: 'var(--accent-blue-dim)', color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <FileText size={14} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p className="t-xs-medium text-primary" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.title || 'Untitled'}</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                        <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', border: '1px solid var(--border-default)', borderRadius: 100, padding: '1px 7px', color: 'var(--text-secondary)' }}>
                          {DOC_LABEL[doc.type] || doc.type}
                        </span>
                        <span style={{ fontSize: 11, color, fontWeight: 500 }}>● {doc.status.charAt(0).toUpperCase() + doc.status.slice(1)}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      <span className="t-mono-sm">{formatRelative(doc.updated_at)}</span>
                      {doc.share_token && (
                        <button
                          onClick={() => window.open(`/doc/${doc.share_token}`, '_blank')}
                          title="Preview document"
                          style={{ display: 'flex', padding: '4px 6px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)', background: 'transparent', color: 'var(--text-tertiary)', cursor: 'pointer', transition: 'color 150ms' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent-blue)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent-blue)'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)'; }}>
                          <ExternalLink size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Credentials */}
        {activeSection === 'credentials' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Key size={13} style={{ color: 'var(--accent-amber)' }} />
              <p className="t-xs text-secondary">Client credentials and access. Stored only in your dashboard.</p>
            </div>
            {(client.credentials || []).length === 0 ? (
              <p className="t-xs text-tertiary" style={{ fontStyle: 'italic' }}>
                No credentials logged yet. Add domain, hosting, CMS, email access as the project progresses.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {(client.credentials || []).map((cred, i) => (
                  <CredentialRow key={i} cred={cred} index={i}
                    onDelete={() => {
                      const updated = client.credentials.filter((_, idx) => idx !== i);
                      void updateClientCredentials(client.id, updated).then(res => {
                        if (!res.ok) toast.error(res.error || 'Could not delete credential');
                      });
                      onUpdate({ ...client, credentials: updated });
                    }} />
                ))}
              </div>
            )}
            <CredentialAdder clientId={client.id} existing={client.credentials || []}
              onSaved={updated => onUpdate({ ...client, credentials: updated })} />
          </div>
        )}

        {/* History */}
        {activeSection === 'history' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {(!client.stage_history || client.stage_history.length === 0) ? (
              <p className="t-xs text-tertiary" style={{ fontStyle: 'italic' }}>No history recorded.</p>
            ) : (
              [...client.stage_history].reverse().map((entry: any, i: number) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 'var(--radius-sm)', background: i === 0 ? 'var(--accent-blue-dim)' : 'transparent' }}>
                  <CheckCircle2 size={13} style={{ color: i === 0 ? 'var(--accent-blue)' : 'var(--accent-green)', flexShrink: 0 }} />
                  <span className="t-xs" style={{ flex: 1, color: i === 0 ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{stageLabel(entry.stage)}</span>
                  <span className="t-mono-sm">{formatDate(entry.entered_at, 'dd MMM yyyy')}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Edit client info modal */}
      {editing && (
        <EditClientModal client={client} onClose={() => setEditing(false)}
          onSaved={updated => { onUpdate(updated); setEditing(false); }} />
      )}
    </Modal>
  );
}

// ─── CREDENTIAL ROW ───
function CredentialRow({ cred, index, onDelete }: { cred: { service: string; detail: string }; index: number; onDelete: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', background: 'var(--bg-hover)', borderRadius: 'var(--radius-md)' }}
      onMouseEnter={e => { (e.currentTarget.querySelector('.cred-del') as HTMLElement | null)?.style.setProperty('opacity', '1'); }}
      onMouseLeave={e => { (e.currentTarget.querySelector('.cred-del') as HTMLElement | null)?.style.setProperty('opacity', '0'); }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p className="t-xs-medium text-primary">{cred.service}</p>
        <p className="t-2xs text-secondary" style={{ marginTop: 2, wordBreak: 'break-all', whiteSpace: 'pre-wrap' }}>{cred.detail}</p>
      </div>
      <button className="cred-del" onClick={onDelete}
        style={{ opacity: 0, display: 'flex', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', transition: 'color 150ms, opacity 150ms', flexShrink: 0 }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent-red)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; }}>
        <X size={13} />
      </button>
    </div>
  );
}

// ─── CREDENTIAL ADDER ───
function CredentialAdder({ clientId, existing, onSaved }: {
  clientId: string;
  existing: { service: string; detail: string }[];
  onSaved: (updated: { service: string; detail: string }[]) => void;
}) {
  const [service, setService] = useState('');
  const [detail, setDetail]   = useState('');
  const [saving, setSaving]   = useState(false);

  async function handleAdd() {
    if (!service.trim() || !detail.trim()) return;
    setSaving(true);
    const updated = [...existing, { service: service.trim(), detail: detail.trim() }];
    const res = await updateClientCredentials(clientId, updated);
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error || 'Could not add credential');
      return;
    }
    onSaved(updated);
    setService(''); setDetail('');
  }

  return (
    <div style={{ padding: 14, background: 'var(--bg-hover)', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <p className="t-label">Add Credential</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Input label="Service" value={service} onChange={e => setService(e.target.value)} placeholder="Hostinger, cPanel, GoDaddy…" />
        <Input label="Login / Details" value={detail} onChange={e => setDetail(e.target.value)} placeholder="user: foo / pass: bar" />
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button size="sm" onClick={handleAdd} loading={saving} disabled={!service.trim() || !detail.trim()}>Add</Button>
      </div>
    </div>
  );
}

// ─── EDIT CLIENT MODAL ───
function EditClientModal({ client, onClose, onSaved }: {
  client: Client; onClose: () => void; onSaved: (c: Client) => void;
}) {
  const [name, setName]               = useState(client.name);
  const [company, setCompany]         = useState(client.company || '');
  const [contactName, setContactName] = useState(client.contact_name || '');
  const [email, setEmail]             = useState(client.contact_email || '');
  const [phone, setPhone]             = useState(client.contact_phone || '');
  const [channel, setChannel]         = useState(client.preferred_channel || 'whatsapp');
  const [serviceType, setServiceType] = useState(client.service_type || 'web_dev');
  const [saving, setSaving]           = useState(false);

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    const res = await updateClientRecord(client.id, {
      name: name.trim(),
      company: company || null,
      contact_name: contactName || null,
      contact_email: email || null,
      contact_phone: phone || null,
      preferred_channel: channel as PreferredChannel,
      service_type: serviceType,
    });
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error || 'Could not save client');
      return;
    }
    onSaved(res.data);
  }

  return (
    <Modal open={true} onClose={onClose} title="Edit Client" size="md">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Input label="Name / Project *" value={name} onChange={e => setName(e.target.value)} autoFocus />
          <Select label="Service Type" options={SERVICE_TYPES} value={serviceType} onChange={e => setServiceType(e.target.value)} />
        </div>
        <Input label="Company" value={company} onChange={e => setCompany(e.target.value)} placeholder="Optional" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Input label="Contact Name" value={contactName} onChange={e => setContactName(e.target.value)} />
          <Input label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Input label="Phone / WhatsApp" value={phone} onChange={e => setPhone(e.target.value)} />
          <Select label="Preferred Channel" options={[
            { value: 'whatsapp', label: 'WhatsApp' },
            { value: 'email', label: 'Email' },
            { value: 'phone', label: 'Phone' },
          ]} value={channel} onChange={e => setChannel(e.target.value as PreferredChannel)} />
        </div>
        <div style={{ display: 'flex', gap: 10, paddingTop: 8 }}>
          <Button variant="secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</Button>
          <Button onClick={handleSave} loading={saving} disabled={!name.trim()} style={{ flex: 1 }}>Save Changes</Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── CREATE CLIENT MODAL ───
function CreateClientModal({ open, onClose, mode, currentUser, onCreated }: {
  open: boolean; onClose: () => void; mode: 'personal' | 'agency'; currentUser: { ownerId: string } | null; onCreated: (c: Client) => void;
}) {
  const [name, setName]               = useState('');
  const [company, setCompany]         = useState('');
  const [contactName, setContactName] = useState('');
  const [email, setEmail]             = useState('');
  const [phone, setPhone]             = useState('');
  const [channel, setChannel]         = useState('whatsapp');
  const [serviceType, setServiceType] = useState('web_dev');
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState('');

  // Reset on close
  useEffect(() => {
    if (!open) { setName(''); setCompany(''); setContactName(''); setEmail(''); setPhone(''); setError(''); }
  }, [open]);

  async function handleCreate() {
    if (!name.trim()) { setError('Name is required'); return; }
    if (!currentUser) return;
    setSaving(true); setError('');
    // Server action handles user_id + initial stage + stage_history + empty
    // credentials. The client only provides what the form collected.
    const res = await createClientRecord({
      mode,
      name: name.trim(),
      company: company || null,
      contact_name: contactName || null,
      contact_email: email || null,
      contact_phone: phone || null,
      preferred_channel: channel as PreferredChannel,
      service_type: serviceType,
      notes: '',
    });
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    onCreated(res.data);
  }

  return (
    <Modal open={open} onClose={onClose} title="Add Client" size="md">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Input label="Name / Project *" value={name} onChange={e => setName(e.target.value)} placeholder="Acme Corp" autoFocus />
          <Select label="Service Type" options={SERVICE_TYPES} value={serviceType} onChange={e => setServiceType(e.target.value)} />
        </div>
        <Input label="Company" value={company} onChange={e => setCompany(e.target.value)} placeholder="Optional" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Input label="Contact Name" value={contactName} onChange={e => setContactName(e.target.value)} />
          <Input label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Input label="Phone / WhatsApp" value={phone} onChange={e => setPhone(e.target.value)} />
          <Select label="Preferred Channel" options={[
            { value: 'whatsapp', label: 'WhatsApp' },
            { value: 'email', label: 'Email' },
            { value: 'phone', label: 'Phone' },
          ]} value={channel} onChange={e => setChannel(e.target.value as PreferredChannel)} />
        </div>
        {error && <p style={{ fontSize: 12, color: 'var(--accent-red)', fontFamily: 'var(--font-body)' }}>{error}</p>}
        <div style={{ display: 'flex', gap: 10, paddingTop: 8 }}>
          <Button variant="secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</Button>
          <Button onClick={handleCreate} loading={saving} disabled={!name.trim()} style={{ flex: 1 }}>Add Client</Button>
        </div>
      </div>
    </Modal>
  );
}

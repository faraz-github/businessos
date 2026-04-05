'use client';

import { useState, useEffect, useCallback } from 'react';
import { useBrand } from '@/lib/brand';
import { useCurrentUser } from '@/lib/auth/use-auth';
import { createClient } from '@/lib/supabase/client';
import { PageTransition } from '@/components/dashboard/PageTransition';
import { Card, Badge, Button, Input, Modal, Textarea, Select, EmptyState } from '@/components/ui';
import { formatDate, formatRelative, stageLabel, buildMailtoLink, buildWhatsAppLink } from '@/lib/utils';
import {
  Plus, Users, Search, ChevronRight, Mail, MessageCircle,
  FileText, StickyNote, Key, CheckCircle2, Circle,
} from 'lucide-react';
import type { Client, ClientStage } from '@/types';

/* ── Stages in exact workflow order ── */
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

/* ── Phase grouping for visual pipeline header ── */
const PHASES = [
  { label: 'Discovery',    stages: ['lead', 'contacted', 'qualified'],                                          color: 'var(--text-tertiary)' },
  { label: 'Proposal',     stages: ['proposal_sent', 'proposal_accepted'],                                      color: 'var(--accent-amber)' },
  { label: 'Contracting',  stages: ['contract_sent', 'contract_signed'],                                        color: 'var(--accent-amber)' },
  { label: 'Kickoff',      stages: ['upfront_paid', 'requirements_sent', 'requirements_received', 'credentials_pending'], color: 'var(--accent-blue)' },
  { label: 'Active',       stages: ['in_progress', 'milestone_review', 'revision'],                             color: 'var(--accent-violet)' },
  { label: 'Closing',      stages: ['final_review', 'final_payment_sent', 'final_payment_received'],            color: 'var(--accent-blue)' },
  { label: 'Handover',     stages: ['handover', 'deployed'],                                                    color: 'var(--accent-green)' },
  { label: 'Post-project', stages: ['support_active', 'feedback_sent', 'retention_sent'],                       color: 'var(--accent-green)' },
];

function stageBadgeVariant(stage: ClientStage): string {
  if (['lead', 'contacted', 'qualified'].includes(stage)) return 'outline';
  if (['proposal_sent', 'proposal_accepted', 'contract_sent', 'contract_signed'].includes(stage)) return 'amber';
  if (['upfront_paid', 'requirements_sent', 'requirements_received', 'credentials_pending'].includes(stage)) return 'blue';
  if (['in_progress', 'milestone_review', 'revision'].includes(stage)) return 'violet';
  if (['final_review', 'final_payment_sent', 'final_payment_received', 'handover', 'deployed'].includes(stage)) return 'blue';
  if (['support_active', 'feedback_sent', 'retention_sent'].includes(stage)) return 'green';
  return 'outline';
}

function phaseOf(stage: ClientStage): string {
  return PHASES.find(p => p.stages.includes(stage))?.label || '';
}

const SERVICE_TYPES = [
  { value: 'web_dev',      label: 'Web Development' },
  { value: 'app_dev',      label: 'App Development' },
  { value: 'web_design',   label: 'Web / App Design (Figma)' },
  { value: 'logo',         label: 'Logo Design' },
  { value: 'branding',     label: 'Branding & Print' },
  { value: 'seo',          label: 'SEO' },
  { value: 'digital_mkt',  label: 'Digital Marketing' },
  { value: 'other',        label: 'Other' },
];

export default function PersonalClientsPage() {
  const { mode } = useBrand();
  const { user: currentUser } = useCurrentUser();
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showPast, setShowPast] = useState(false);
  const supabase = createClient();

  const fetchClients = useCallback(async () => {
    if (!currentUser) return;
    const { data } = await supabase.from('clients').select('*')
      .eq('user_id', currentUser.id).eq('mode', mode)
      .order('updated_at', { ascending: false });
    setClients((data as Client[]) || []);
  }, [currentUser, mode]);

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
    const history = [...(client.stage_history || []), { stage: newStage, entered_at: new Date().toISOString() }];
    await supabase.from('clients').update({ current_stage: newStage, stage_history: history, updated_at: new Date().toISOString() }).eq('id', clientId);
    setClients(prev => prev.map(c => c.id === clientId ? { ...c, current_stage: newStage, stage_history: history } : c));
    if (selectedClient?.id === clientId) setSelectedClient(prev => prev ? { ...prev, current_stage: newStage, stage_history: history } : prev);
  }

  return (
    <PageTransition>
      <div className="flex flex-col gap-9">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="t-h1">Clients</h1>
            <p className="t-xs mt-1">Every client, every project, one place.</p>
          </div>
          <Button icon={<Plus size={14} />} onClick={() => setShowCreate(true)}>Add Client</Button>
        </div>

        {/* Pipeline phase strip */}
        <div className="flex gap-1 overflow-x-auto pb-1">
          {PHASES.map(phase => {
            const count = active.filter(c => phase.stages.includes(c.current_stage)).length;
            return (
              <div key={phase.label} className="card shrink-0 text-center"
                style={{ padding: '10px 14px', minWidth: 90, borderTop: `2px solid ${count > 0 ? phase.color : 'var(--border-subtle)'}` }}>
                <p className="t-metric-sm" style={{ color: count > 0 ? phase.color : 'var(--text-tertiary)' }}>{count}</p>
                <p className="t-label" style={{ marginTop: 4 }}>{phase.label}</p>
              </div>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative" style={{ maxWidth: 360 }}>
          <Search size={13} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none' }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search clients..."
            style={{ width: '100%', background: 'var(--bg-hover)', border: '1px solid transparent', borderRadius: 'var(--radius-md)', padding: '8px 12px 8px 34px', fontSize: 12, fontFamily: 'var(--font-body)', color: 'var(--text-primary)', outline: 'none' }}
            onFocus={e => { e.target.style.borderColor = 'var(--border-default)'; }}
            onBlur={e => { e.target.style.borderColor = 'transparent'; }} />
        </div>

        {/* Client list */}
        {active.length === 0 && past.length === 0 ? (
          <Card>
            <EmptyState icon={<Users />} title="No clients yet"
              description="Add your first client. Usually starts from an outreach lead converting."
              action={<Button icon={<Plus size={14} />} onClick={() => setShowCreate(true)}>Add Client</Button>} />
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {active.map(client => (
              <div key={client.id} className="card interactive hover-bg-hover cursor-pointer"
                style={{ display: 'flex', alignItems: 'center', gap: 14 }}
                onClick={() => setSelectedClient(client)}>
                <div className="flex items-center justify-center rounded-full shrink-0"
                  style={{ width: 36, height: 36, background: `hsl(${client.name.charCodeAt(0) * 7 % 360}, 55%, 45%)`, color: '#fff', fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-display)' }}>
                  {client.name[0].toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="flex items-center gap-2">
                    <span className="t-sm-semibold">{client.name}</span>
                    {client.company && <span className="t-2xs text-tertiary">· {client.company}</span>}
                    {(client as any).service_type && (
                      <span className="t-2xs" style={{ color: 'var(--accent-violet)' }}>
                        {SERVICE_TYPES.find(s => s.value === (client as any).service_type)?.label}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="t-2xs text-tertiary">{phaseOf(client.current_stage)}</span>
                    <span className="t-2xs text-tertiary">·</span>
                    <span className="t-2xs text-tertiary">Updated {formatRelative(client.updated_at)}</span>
                  </div>
                </div>
                <Badge variant={stageBadgeVariant(client.current_stage) as any}>{stageLabel(client.current_stage)}</Badge>
                <ChevronRight size={14} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
              </div>
            ))}

            {past.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <button onClick={() => setShowPast(!showPast)}
                  style={{ fontSize: 12, color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0' }}>
                  {showPast ? '▾' : '▸'} Completed clients ({past.length})
                </button>
                {showPast && (
                  <div className="flex flex-col gap-2" style={{ marginTop: 8, opacity: 0.65 }}>
                    {past.map(client => (
                      <div key={client.id} className="card interactive hover-bg-hover cursor-pointer"
                        style={{ display: 'flex', alignItems: 'center', gap: 12 }}
                        onClick={() => setSelectedClient(client)}>
                        <div className="flex items-center justify-center rounded-full shrink-0"
                          style={{ width: 32, height: 32, background: 'var(--bg-hover)', color: 'var(--text-tertiary)', fontSize: 12, fontWeight: 700 }}>
                          {client.name[0].toUpperCase()}
                        </div>
                        <span className="t-xs flex-1">{client.name}</span>
                        <Badge variant="outline">Completed</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {selectedClient && (
          <ClientDetailModal client={selectedClient} onClose={() => setSelectedClient(null)}
            onStageChange={handleStageChange}
            onUpdate={updated => { setClients(prev => prev.map(c => c.id === updated.id ? updated : c)); setSelectedClient(updated); }} />
        )}
        <CreateClientModal open={showCreate} onClose={() => setShowCreate(false)} mode={mode} currentUser={currentUser}
          onCreated={client => { setClients(prev => [client, ...prev]); setShowCreate(false); }} />
      </div>
    </PageTransition>
  );
}

function ClientDetailModal({ client, onClose, onStageChange, onUpdate }: {
  client: Client; onClose: () => void;
  onStageChange: (id: string, stage: ClientStage) => void;
  onUpdate: (c: Client) => void;
}) {
  const [notes, setNotes] = useState(client.notes || '');
  const [savingNotes, setSavingNotes] = useState(false);
  const [activeSection, setActiveSection] = useState<'overview' | 'credentials' | 'history'>('overview');
  const supabase = createClient();

  const currentIdx = ALL_STAGES.indexOf(client.current_stage);
  const nextStage  = currentIdx < ALL_STAGES.length - 1 ? ALL_STAGES[currentIdx + 1] : null;
  const prevStage  = currentIdx > 0 ? ALL_STAGES[currentIdx - 1] : null;

  async function saveNotes() {
    setSavingNotes(true);
    await supabase.from('clients').update({ notes, updated_at: new Date().toISOString() }).eq('id', client.id);
    onUpdate({ ...client, notes });
    setSavingNotes(false);
  }

  /* Credentials stored in client.notes as a JSON block — simple approach */
  const credentials: { service: string; detail: string }[] = (client as any).credentials || [];

  return (
    <Modal open={true} onClose={onClose} title={client.name} description={client.company || undefined} size="lg">
      <div className="flex flex-col gap-5">

        {/* Stage progress */}
        <div style={{ padding: '14px 16px', background: 'var(--bg-hover)', borderRadius: 'var(--radius-md)' }}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="t-label sub-label-gap">Current Stage</p>
              <Badge variant={stageBadgeVariant(client.current_stage) as any} style={{ fontSize: 11 }}>
                {stageLabel(client.current_stage)}
              </Badge>
            </div>
            <div className="flex gap-2">
              {nextStage && (
                <Button size="sm" icon={<ChevronRight size={12} />}
                  onClick={() => onStageChange(client.id, nextStage)}>
                  → {stageLabel(nextStage)}
                </Button>
              )}
            </div>
          </div>
          {/* Progress bar */}
          <div style={{ height: 4, background: 'var(--border-subtle)', borderRadius: 100, overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 100, background: 'var(--accent-blue)', width: `${Math.round((currentIdx / (ALL_STAGES.length - 1)) * 100)}%`, transition: 'width 0.4s ease' }} />
          </div>
          <p className="t-2xs text-tertiary" style={{ marginTop: 4 }}>
            Step {currentIdx + 1} of {ALL_STAGES.length} · {phaseOf(client.current_stage)} phase
          </p>
        </div>

        {/* Contact info */}
        <div className="grid grid-cols-3 gap-3">
          {client.contact_name  && <div><p className="t-label sub-label-gap">Contact</p><p className="t-xs">{client.contact_name}</p></div>}
          {client.contact_email && <div><p className="t-label sub-label-gap">Email</p><p className="t-xs text-accent-blue">{client.contact_email}</p></div>}
          {client.contact_phone && <div><p className="t-label sub-label-gap">Phone</p><p className="t-xs">{client.contact_phone}</p></div>}
        </div>

        {/* Quick actions */}
        <div className="flex gap-2">
          {client.contact_email && (
            <Button variant="secondary" size="sm" icon={<Mail size={12} />}
              onClick={() => window.open(buildMailtoLink(client.contact_email!, '', ''), '_blank')}>
              Email
            </Button>
          )}
          {client.contact_phone && (
            <Button variant="secondary" size="sm" icon={<MessageCircle size={12} />}
              onClick={() => window.open(buildWhatsAppLink(client.contact_phone!, ''), '_blank')}>
              WhatsApp
            </Button>
          )}
        </div>

        {/* Section tabs */}
        <div className="flex gap-1" style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: 0 }}>
          {(['overview', 'credentials', 'history'] as const).map(s => (
            <button key={s} onClick={() => setActiveSection(s)}
              style={{
                padding: '6px 14px', fontSize: 12, fontWeight: 500, fontFamily: 'var(--font-body)',
                background: 'none', border: 'none', cursor: 'pointer',
                borderBottom: `2px solid ${activeSection === s ? 'var(--accent-blue)' : 'transparent'}`,
                color: activeSection === s ? 'var(--accent-blue)' : 'var(--text-secondary)',
                marginBottom: -1, transition: 'all 150ms',
              }}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        {/* Overview — running notes */}
        {activeSection === 'overview' && (
          <div>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Running notes — project context, client preferences, blockers, anything important..."
              style={{ minHeight: 140 }} />
            <div className="flex justify-end" style={{ marginTop: 8 }}>
              <Button variant="secondary" size="sm" icon={<StickyNote size={12} />}
                onClick={saveNotes} loading={savingNotes}>
                Save Notes
              </Button>
            </div>
          </div>
        )}

        {/* Credentials — domain, hosting, access */}
        {activeSection === 'credentials' && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Key size={14} style={{ color: 'var(--accent-amber)' }} />
              <p className="t-xs">Client credentials and access. Stored only in your dashboard.</p>
            </div>
            {credentials.length === 0 ? (
              <p className="t-xs text-tertiary" style={{ fontStyle: 'italic', padding: '12px 0' }}>
                No credentials logged yet. Add domain, hosting, CMS, email access etc. as the project progresses.
              </p>
            ) : (
              <div className="flex flex-col gap-2 mb-3">
                {credentials.map((cred, i) => (
                  <div key={i} className="flex items-start gap-3" style={{ padding: '10px 12px', background: 'var(--bg-hover)', borderRadius: 'var(--radius-md)' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p className="t-xs-medium text-primary">{cred.service}</p>
                      <p className="t-2xs text-secondary" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', marginTop: 2 }}>{cred.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <CredentialAdder clientId={client.id} existing={credentials}
              onSaved={updated => onUpdate({ ...client, credentials: updated } as any)} />
          </div>
        )}

        {/* History */}
        {activeSection === 'history' && (
          <div>
            {(!client.stage_history || client.stage_history.length === 0) ? (
              <p className="t-xs text-tertiary" style={{ fontStyle: 'italic' }}>No history recorded.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {[...client.stage_history].reverse().map((entry: any, i: number) => (
                  <div key={i} className="flex items-center gap-3" style={{ padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                    <CheckCircle2 size={13} style={{ color: 'var(--accent-green)', flexShrink: 0 }} />
                    <span className="t-xs flex-1">{stageLabel(entry.stage)}</span>
                    <span className="t-mono-sm">{formatDate(entry.entered_at, 'dd MMM yyyy')}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

function CredentialAdder({ clientId, existing, onSaved }: {
  clientId: string;
  existing: { service: string; detail: string }[];
  onSaved: (updated: { service: string; detail: string }[]) => void;
}) {
  const supabase = createClient();
  const [service, setService] = useState('');
  const [detail, setDetail] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleAdd() {
    if (!service || !detail) return;
    setSaving(true);
    const updated = [...existing, { service, detail }];
    await supabase.from('clients').update({ credentials: updated }).eq('id', clientId);
    onSaved(updated);
    setService('');
    setDetail('');
    setSaving(false);
  }

  return (
    <div className="flex flex-col gap-3" style={{ padding: '12px', background: 'var(--bg-hover)', borderRadius: 'var(--radius-md)' }}>
      <p className="t-label">Add Credential</p>
      <div className="grid grid-cols-2 gap-3">
        <Input label="Service" value={service} onChange={e => setService(e.target.value)} placeholder="e.g., Hostinger, GoDaddy, cPanel" />
        <Input label="Details / Login" value={detail} onChange={e => setDetail(e.target.value)} placeholder="username / URL / notes" />
      </div>
      <div className="flex justify-end">
        <Button size="sm" onClick={handleAdd} loading={saving} disabled={!service || !detail}>Add</Button>
      </div>
    </div>
  );
}

function CreateClientModal({ open, onClose, mode, currentUser, onCreated }: {
  open: boolean; onClose: () => void; mode: string; currentUser: any; onCreated: (c: Client) => void;
}) {
  const supabase = createClient();
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [channel, setChannel] = useState('whatsapp');
  const [serviceType, setServiceType] = useState('web_dev');
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    if (!name || !currentUser) return;
    setSaving(true);
    const { data, error } = await supabase.from('clients').insert({
      user_id: currentUser.id, mode, name,
      company: company || null,
      contact_name: contactName || null,
      contact_email: email || null,
      contact_phone: phone || null,
      preferred_channel: channel,
      service_type: serviceType,
      notes: '',
      current_stage: 'lead',
      stage_history: [{ stage: 'lead', entered_at: new Date().toISOString() }],
    }).select().single();
    if (!error && data) onCreated(data as Client);
    setSaving(false);
  }

  return (
    <Modal open={open} onClose={onClose} title="Add Client" size="md">
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Input label="Name / Project" value={name} onChange={e => setName(e.target.value)} placeholder="Acme Corp" required />
          <Select label="Service Type" options={SERVICE_TYPES} value={serviceType} onChange={e => setServiceType(e.target.value)} />
        </div>
        <Input label="Company" value={company} onChange={e => setCompany(e.target.value)} placeholder="Optional" />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Contact Name" value={contactName} onChange={e => setContactName(e.target.value)} />
          <Input label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Phone / WhatsApp" value={phone} onChange={e => setPhone(e.target.value)} />
          <Select label="Preferred Channel" options={[
            { value: 'whatsapp', label: 'WhatsApp' },
            { value: 'email', label: 'Email' },
            { value: 'phone', label: 'Phone' },
          ]} value={channel} onChange={e => setChannel(e.target.value)} />
        </div>
        <div className="flex gap-2 border-t-subtle" style={{ paddingTop: 16 }}>
          <Button variant="secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</Button>
          <Button onClick={handleCreate} loading={saving} style={{ flex: 1 }} disabled={!name}>Add Client</Button>
        </div>
      </div>
    </Modal>
  );
}

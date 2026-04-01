'use client';

import { useState, useEffect, useCallback } from 'react';
import { useBrand } from '@/lib/brand';
import { useCurrentUser } from '@/lib/auth/use-auth';
import { createClient } from '@/lib/supabase/client';
import { PageTransition } from '@/components/dashboard/PageTransition';
import { Card, Badge, Button, Input, Modal, Textarea, Select, EmptyState } from '@/components/ui';
import { formatDate, formatRelative, stageLabel, cn } from '@/lib/utils';
import { Plus, Users, Search, ChevronRight, Mail, MessageCircle, FileText, StickyNote } from 'lucide-react';
import type { Client, ClientStage } from '@/types';

const allStages: ClientStage[] = [
  'interested', 'proposal_sent', 'contract_sent', 'contract_signed',
  'requirements_sent', 'requirements_received', 'initial_payment_received',
  'work_in_progress', 'phase_1_complete', 'phase_2_complete',
  'review_and_feedback', 'revisions_complete', 'final_payment_received',
  'delivered', 'deployed', 'support_period_active', 'completed',
];

const activeStages = allStages.filter((s) => s !== 'completed');

function stageBadgeVariant(stage: ClientStage): any {
  if (['interested', 'proposal_sent', 'contract_sent'].includes(stage)) return 'amber';
  if (['contract_signed', 'requirements_sent', 'requirements_received', 'initial_payment_received'].includes(stage)) return 'blue';
  if (['work_in_progress', 'phase_1_complete', 'phase_2_complete', 'review_and_feedback', 'revisions_complete'].includes(stage)) return 'violet';
  if (['final_payment_received', 'delivered', 'deployed', 'support_period_active'].includes(stage)) return 'green';
  return 'outline';
}

export default function PersonalClientsPage() {
  const { mode } = useBrand();
  const { user: currentUser } = useCurrentUser();
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showPast, setShowPast] = useState(false);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchClients = useCallback(async () => {
    setLoading(true);
    const user = currentUser;
    if (!user) return;
    const { data } = await supabase
      .from('clients').select('*').eq('user_id', user.id).eq('mode', mode)
      .order('updated_at', { ascending: false });
    setClients((data as Client[]) || []);
    setLoading(false);
  }, [mode, supabase]);

  useEffect(() => { fetchClients(); }, [fetchClients]);

  const filtered = clients.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.company?.toLowerCase().includes(search.toLowerCase()) ||
    c.contact_name?.toLowerCase().includes(search.toLowerCase())
  );

  const active = filtered.filter((c) => c.current_stage !== 'completed');
  const past = filtered.filter((c) => c.current_stage === 'completed');

  async function handleStageChange(clientId: string, newStage: ClientStage) {
    const client = clients.find((c) => c.id === clientId);
    if (!client) return;
    const history = [...(client.stage_history || []), { stage: newStage, entered_at: new Date().toISOString() }];
    await supabase.from('clients').update({ current_stage: newStage, stage_history: history }).eq('id', clientId);
    setClients((prev) => prev.map((c) => c.id === clientId ? { ...c, current_stage: newStage, stage_history: history } : c));
  }

  return (
    <PageTransition>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-extrabold tracking-tight">Clients</h1>
            <p className="text-[13px] text-[var(--text-secondary)] mt-1">Single source of truth for every client.</p>
          </div>
          <Button icon={<Plus size={14} />} onClick={() => setShowCreate(true)}>Add Client</Button>
        </div>

        <div className="relative max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search clients..."
            className="w-full bg-[var(--bg-hover)] border border-transparent rounded-[var(--radius-md)] pl-9 pr-3 py-2 text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:border-[var(--border-default)]"
          />
        </div>

        {active.length === 0 && past.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Users />}
              title="No clients yet"
              description="Add your first client to start tracking projects."
              action={<Button icon={<Plus size={14} />} onClick={() => setShowCreate(true)}>Add Client</Button>}
            />
          </Card>
        ) : (
          <>
            <div className="space-y-2">
              {active.map((client) => (
                <Card
                  key={client.id}
                  variant="base"
                  className="flex items-center gap-4 cursor-pointer hover:bg-[var(--bg-hover)] transition-colors"
                  onClick={() => setSelectedClient(client)}
                >
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[12px] font-bold shrink-0"
                    style={{ background: `hsl(${client.name.charCodeAt(0) * 7 % 360}, 60%, 50%)` }}
                  >
                    {client.name[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-medium text-[var(--text-primary)]">{client.name}</span>
                      {client.company && <span className="text-[11px] text-[var(--text-tertiary)]">· {client.company}</span>}
                    </div>
                    <p className="text-[11px] text-[var(--text-tertiary)]">Updated {formatRelative(client.updated_at)}</p>
                  </div>
                  <Badge variant={stageBadgeVariant(client.current_stage)}>{stageLabel(client.current_stage)}</Badge>
                  <ChevronRight size={14} className="text-[var(--text-tertiary)]" />
                </Card>
              ))}
            </div>

            {past.length > 0 && (
              <div>
                <button
                  onClick={() => setShowPast(!showPast)}
                  className="text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                >
                  {showPast ? 'Hide' : 'Show'} past clients ({past.length})
                </button>
                {showPast && (
                  <div className="space-y-2 mt-2 opacity-70">
                    {past.map((client) => (
                      <Card key={client.id} variant="base" className="flex items-center gap-4 cursor-pointer hover:bg-[var(--bg-hover)]" onClick={() => setSelectedClient(client)}>
                        <div className="w-9 h-9 rounded-full bg-[var(--bg-hover)] flex items-center justify-center text-[12px] font-bold text-[var(--text-tertiary)] shrink-0">
                          {client.name[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-[13px] text-[var(--text-secondary)]">{client.name}</span>
                        </div>
                        <Badge variant="outline">Completed</Badge>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Client Detail Modal */}
        {selectedClient && (
          <ClientDetailModal
            client={selectedClient}
            onClose={() => setSelectedClient(null)}
            onStageChange={handleStageChange}
            onUpdate={(updated) => {
              setClients((prev) => prev.map((c) => c.id === updated.id ? updated : c));
              setSelectedClient(updated);
            }}
          />
        )}

        {/* Create Client Modal */}
        <CreateClientModal
          open={showCreate}
          onClose={() => setShowCreate(false)}
          mode={mode}
          onCreated={(client) => { setClients((prev) => [client, ...prev]); setShowCreate(false); }}
        />
      </div>
    </PageTransition>
  );
}

function ClientDetailModal({ client, onClose, onStageChange, onUpdate }: {
  client: Client; onClose: () => void;
  onStageChange: (id: string, stage: ClientStage) => void;
  onUpdate: (client: Client) => void;
}) {
  const [notes, setNotes] = useState(client.notes);
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  const currentIdx = allStages.indexOf(client.current_stage);
  const nextStage = currentIdx < allStages.length - 1 ? allStages[currentIdx + 1] : null;

  async function saveNotes() {
    setSaving(true);
    await supabase.from('clients').update({ notes }).eq('id', client.id);
    onUpdate({ ...client, notes });
    setSaving(false);
  }

  return (
    <Modal open={true} onClose={onClose} title={client.name} description={client.company || undefined} size="lg">
      <div className="space-y-5">
        {/* Stage */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-tertiary)] mb-2">Current Stage</p>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={stageBadgeVariant(client.current_stage)} className="text-xs">
              {stageLabel(client.current_stage)}
            </Badge>
            {nextStage && (
              <Button
                variant="secondary"
                size="sm"
                icon={<ChevronRight size={12} />}
                onClick={() => onStageChange(client.id, nextStage)}
              >
                Move to {stageLabel(nextStage)}
              </Button>
            )}
          </div>
        </div>

        {/* Contact Info */}
        <div className="grid grid-cols-2 gap-3">
          {client.contact_name && (
            <div>
              <p className="text-[11px] text-[var(--text-tertiary)]">Contact</p>
              <p className="text-[13px] text-[var(--text-primary)]">{client.contact_name}</p>
            </div>
          )}
          {client.contact_email && (
            <div>
              <p className="text-[11px] text-[var(--text-tertiary)]">Email</p>
              <p className="text-[13px] text-[var(--accent-blue)]">{client.contact_email}</p>
            </div>
          )}
          {client.contact_phone && (
            <div>
              <p className="text-[11px] text-[var(--text-tertiary)]">Phone</p>
              <p className="text-[13px] text-[var(--text-primary)]">{client.contact_phone}</p>
            </div>
          )}
          <div>
            <p className="text-[11px] text-[var(--text-tertiary)]">Preferred Channel</p>
            <p className="text-[13px] text-[var(--text-primary)] capitalize">{client.preferred_channel}</p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" icon={<Mail size={12} />}>
            Email
          </Button>
          <Button variant="secondary" size="sm" icon={<MessageCircle size={12} />}>
            WhatsApp
          </Button>
          <Button variant="secondary" size="sm" icon={<FileText size={12} />}>
            New Document
          </Button>
        </div>

        {/* Notes */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-tertiary)] mb-2">Running Notes</p>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="min-h-[120px] text-[13px]"
            placeholder="Notes about this client (never deleted)..."
          />
          <Button variant="secondary" size="sm" onClick={saveNotes} loading={saving} className="mt-2">
            <StickyNote size={12} /> Save Notes
          </Button>
        </div>

        {/* Stage History */}
        {client.stage_history && client.stage_history.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-tertiary)] mb-2">Stage History</p>
            <div className="space-y-1">
              {[...client.stage_history].reverse().map((entry: any, i: number) => (
                <div key={i} className="flex items-center gap-2 text-[11px]">
                  <span className="text-[var(--text-tertiary)] font-mono">{formatDate(entry.entered_at, 'dd MMM')}</span>
                  <span className="text-[var(--text-secondary)]">{stageLabel(entry.stage)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function CreateClientModal({ open, onClose, mode, onCreated }: {
  open: boolean; onClose: () => void; mode: string; onCreated: (client: Client) => void;
}) {
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [channel, setChannel] = useState('email');
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    if (!name) return;
    setSaving(true);
    const supabase = createClient();
    const user = currentUser;
    if (!user) return;

    const { data, error } = await supabase
      .from('clients')
      .insert({
        user_id: user.id,
        mode,
        name,
        company: company || null,
        contact_name: contactName || null,
        contact_email: email || null,
        contact_phone: phone || null,
        preferred_channel: channel,
        current_stage: 'interested',
        stage_history: [{ stage: 'interested', entered_at: new Date().toISOString() }],
      })
      .select()
      .single();

    if (!error && data) onCreated(data as Client);
    setSaving(false);
  }

  return (
    <Modal open={open} onClose={onClose} title="Add Client" size="md">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Input label="Client / Project Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Corp" required />
          <Input label="Company" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Optional" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Contact Name" value={contactName} onChange={(e) => setContactName(e.target.value)} />
          <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Select
            label="Preferred Channel"
            options={[
              { value: 'email', label: 'Email' },
              { value: 'whatsapp', label: 'WhatsApp' },
              { value: 'phone', label: 'Phone' },
            ]}
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
          />
        </div>
        <div className="flex gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} className="flex-1">Cancel</Button>
          <Button onClick={handleCreate} loading={saving} className="flex-1" disabled={!name}>Add Client</Button>
        </div>
      </div>
    </Modal>
  );
}

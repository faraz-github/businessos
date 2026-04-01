'use client';

import { useState, useEffect } from 'react';
import { useBrand } from '@/lib/brand';
import { useCurrentUser } from '@/lib/auth/use-auth';
import { createClient } from '@/lib/supabase/client';
import { PageTransition } from '@/components/dashboard/PageTransition';
import { Card, Badge, Button, Modal, Input, Textarea, Select, EmptyState } from '@/components/ui';
import { formatRelative, stageLabel, formatINR, cn } from '@/lib/utils';
import { Plus, GripVertical, Phone, StickyNote, ChevronRight } from 'lucide-react';
import type { Lead, LeadStage } from '@/types';

const stages: { value: LeadStage; label: string; color: string }[] = [
  { value: 'prospect', label: 'Prospect', color: 'var(--text-tertiary)' },
  { value: 'contacted', label: 'Contacted', color: 'var(--accent-blue)' },
  { value: 'replied', label: 'Replied', color: 'var(--accent-violet)' },
  { value: 'meeting_scheduled', label: 'Meeting', color: 'var(--accent-amber)' },
  { value: 'proposal_sent', label: 'Proposal Sent', color: 'var(--accent-blue)' },
  { value: 'negotiating', label: 'Negotiating', color: 'var(--accent-amber)' },
  { value: 'closed_won', label: 'Closed Won', color: 'var(--accent-green)' },
  { value: 'closed_lost', label: 'Closed Lost', color: 'var(--accent-red)' },
];

export default function AgencyBDPipelinePage() {
  const { mode } = useBrand();
  const { user: currentUser } = useCurrentUser();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const supabase = createClient();

  useEffect(() => {
    async function fetch() {
      const user = currentUser;
      if (!user) return;
      const { data } = await supabase.from('leads').select('*').eq('user_id', user.id).eq('mode', mode).order('last_activity_at', { ascending: false });
      setLeads((data as Lead[]) || []);
    }
    fetch();

    // Realtime subscription
    const channel = supabase.channel('leads-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, (payload) => {
        if (payload.eventType === 'INSERT') setLeads((prev) => [payload.new as Lead, ...prev]);
        if (payload.eventType === 'UPDATE') setLeads((prev) => prev.map((l) => l.id === payload.new.id ? payload.new as Lead : l));
        if (payload.eventType === 'DELETE') setLeads((prev) => prev.filter((l) => l.id !== payload.old.id));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [mode, supabase]);

  async function moveLeadStage(leadId: string, newStage: LeadStage) {
    await supabase.from('leads').update({ stage: newStage, last_activity_at: new Date().toISOString() }).eq('id', leadId);
    setLeads((prev) => prev.map((l) => l.id === leadId ? { ...l, stage: newStage } : l));
  }

  return (
    <PageTransition>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-extrabold tracking-tight">BD Pipeline</h1>
            <p className="text-[13px] text-[var(--text-secondary)] mt-1">Manage leads from prospect to close.</p>
          </div>
          <Button icon={<Plus size={14} />} onClick={() => setShowCreate(true)}>Add Lead</Button>
        </div>

        {/* Kanban Board */}
        <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: '60vh' }}>
          {stages.map((stage) => {
            const stageLeads = leads.filter((l) => l.stage === stage.value);
            return (
              <div key={stage.value} className="flex-shrink-0 w-[240px]">
                <div className="flex items-center gap-2 mb-3 px-1">
                  <div className="w-2 h-2 rounded-full" style={{ background: stage.color }} />
                  <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
                    {stage.label}
                  </span>
                  <span className="text-[11px] text-[var(--text-tertiary)] font-mono">
                    {stageLeads.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {stageLeads.map((lead) => (
                    <Card
                      key={lead.id}
                      variant="base"
                      className="cursor-pointer hover:bg-[var(--bg-hover)] transition-colors"
                      onClick={() => setSelectedLead(lead)}
                    >
                      <p className="text-[13px] font-medium text-[var(--text-primary)] truncate">{lead.company}</p>
                      {lead.contact_name && (
                        <p className="text-[11px] text-[var(--text-secondary)] truncate">{lead.contact_name}</p>
                      )}
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-[10px] text-[var(--text-tertiary)]">{formatRelative(lead.last_activity_at)}</span>
                        {lead.deal_value && (
                          <Badge variant="green" className="text-[9px]">{formatINR(lead.deal_value)}</Badge>
                        )}
                      </div>
                      {lead.next_action && (
                        <p className="text-[10px] text-[var(--accent-amber)] mt-1 truncate">→ {lead.next_action}</p>
                      )}
                    </Card>
                  ))}
                  {stageLeads.length === 0 && (
                    <div className="py-8 text-center text-[11px] text-[var(--text-tertiary)] border border-dashed border-[var(--border-subtle)] rounded-[var(--radius-lg)]">
                      No leads
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Lead Detail Modal */}
        {selectedLead && (
          <LeadDetailModal
            lead={selectedLead}
            onClose={() => setSelectedLead(null)}
            onMoveStage={moveLeadStage}
            onUpdate={(updated) => { setLeads((prev) => prev.map((l) => l.id === updated.id ? updated : l)); setSelectedLead(updated); }}
          />
        )}

        {/* Create Lead Modal */}
        <CreateLeadModal
          open={showCreate}
          onClose={() => setShowCreate(false)}
          mode={mode}
          onCreated={(lead) => { setLeads((prev) => [lead, ...prev]); setShowCreate(false); }}
        />
      </div>
    </PageTransition>
  );
}

function LeadDetailModal({ lead, onClose, onMoveStage, onUpdate }: {
  lead: Lead; onClose: () => void;
  onMoveStage: (id: string, stage: LeadStage) => void;
  onUpdate: (lead: Lead) => void;
}) {
  const [newNote, setNewNote] = useState('');
  const [saving, setSaving] = useState(false);
  const supabase = createClient();
  const currentIdx = stages.findIndex((s) => s.value === lead.stage);
  const nextStage = currentIdx < stages.length - 1 ? stages[currentIdx + 1] : null;

  async function addNote() {
    if (!newNote.trim()) return;
    setSaving(true);
    const notes = [...(lead.notes || []), { text: newNote, created_at: new Date().toISOString() }];
    await supabase.from('leads').update({ notes, last_activity_at: new Date().toISOString() }).eq('id', lead.id);
    onUpdate({ ...lead, notes } as Lead);
    setNewNote('');
    setSaving(false);
  }

  return (
    <Modal open={true} onClose={onClose} title={lead.company} description={lead.contact_name || undefined} size="md">
      <div className="space-y-5">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="blue">{stageLabel(lead.stage)}</Badge>
          {lead.deal_value && <Badge variant="green">{formatINR(lead.deal_value)}</Badge>}
          {lead.source && <Badge variant="outline">{lead.source}</Badge>}
          {nextStage && (
            <Button variant="secondary" size="sm" icon={<ChevronRight size={12} />} onClick={() => onMoveStage(lead.id, nextStage.value)}>
              Move to {nextStage.label}
            </Button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 text-[12px]">
          {lead.contact_email && <div><p className="text-[var(--text-tertiary)]">Email</p><p className="text-[var(--accent-blue)]">{lead.contact_email}</p></div>}
          {lead.contact_phone && <div><p className="text-[var(--text-tertiary)]">Phone</p><p>{lead.contact_phone}</p></div>}
          {lead.next_action && <div><p className="text-[var(--text-tertiary)]">Next Action</p><p className="text-[var(--accent-amber)]">{lead.next_action}</p></div>}
        </div>

        {/* Notes */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-tertiary)] mb-2">Activity Log</p>
          <div className="space-y-2 max-h-[200px] overflow-y-auto mb-3">
            {(lead.notes || []).slice().reverse().map((note: any, i: number) => (
              <div key={i} className="text-[12px] pl-3 border-l-2 border-[var(--border-subtle)]">
                <p className="text-[var(--text-primary)]">{note.text}</p>
                <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5">{formatRelative(note.created_at)}</p>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Input value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder="Add a note..." className="flex-1" onKeyDown={(e) => e.key === 'Enter' && addNote()} />
            <Button variant="secondary" onClick={addNote} loading={saving}><StickyNote size={12} /> Add</Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function CreateLeadModal({ open, onClose, mode, onCreated }: any) {
  const [company, setCompany] = useState('');
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [source, setSource] = useState('');
  const [dealValue, setDealValue] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    if (!company) return;
    setSaving(true);
    const supabase = createClient();
    const user = currentUser;
    if (!user) return;
    const { data, error } = await supabase.from('leads')
      .insert({
        user_id: user.id, mode, company, contact_name: contactName || null,
        contact_email: email || null, contact_phone: phone || null,
        source: source || null, stage: 'prospect',
        deal_value: dealValue ? parseFloat(dealValue) : null,
        notes: [], last_activity_at: new Date().toISOString(),
      })
      .select().single();
    if (!error && data) onCreated(data);
    setSaving(false);
  }

  return (
    <Modal open={open} onClose={onClose} title="Add Lead" size="md">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Input label="Company" value={company} onChange={(e) => setCompany(e.target.value)} required />
          <Input label="Contact Name" value={contactName} onChange={(e) => setContactName(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Source" value={source} onChange={(e) => setSource(e.target.value)} placeholder="e.g., LinkedIn, referral" />
          <Input label="Deal Value (₹)" type="number" value={dealValue} onChange={(e) => setDealValue(e.target.value)} />
        </div>
        <div className="flex gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} className="flex-1">Cancel</Button>
          <Button onClick={handleCreate} loading={saving} className="flex-1" disabled={!company}>Add Lead</Button>
        </div>
      </div>
    </Modal>
  );
}

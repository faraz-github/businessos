'use client';

import { useState, useEffect } from 'react';
import { useBrand } from '@/lib/brand';
import { useCurrentUser } from '@/lib/auth/use-auth';
import { createClient } from '@/lib/supabase/client';
import { PageTransition } from '@/components/dashboard/PageTransition';
import { Card, Badge, Button, Modal, Input, EmptyState } from '@/components/ui';
import { formatRelative, stageLabel, formatINR } from '@/lib/utils';
import { Plus, StickyNote, ChevronRight } from 'lucide-react';
import type { Lead, LeadStage } from '@/types';

const stages: { value: LeadStage; label: string; color: string }[] = [
  { value: 'prospect',         label: 'Prospect',      color: 'var(--text-tertiary)' },
  { value: 'contacted',        label: 'Contacted',     color: 'var(--accent-blue)' },
  { value: 'replied',          label: 'Replied',       color: 'var(--accent-violet)' },
  { value: 'meeting_scheduled',label: 'Meeting',       color: 'var(--accent-amber)' },
  { value: 'proposal_sent',    label: 'Proposal Sent', color: 'var(--accent-blue)' },
  { value: 'negotiating',      label: 'Negotiating',   color: 'var(--accent-amber)' },
  { value: 'closed_won',       label: 'Closed Won',    color: 'var(--accent-green)' },
  { value: 'closed_lost',      label: 'Closed Lost',   color: 'var(--accent-red)' },
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
      if (!currentUser) return;
      const { data } = await supabase.from('leads').select('*')
        .eq('user_id', currentUser.id).eq('mode', mode).order('last_activity_at', { ascending: false });
      setLeads((data as Lead[]) || []);
    }
    fetch();

    const channel = supabase.channel('leads-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, (payload) => {
        if (payload.eventType === 'INSERT') setLeads((prev) => [payload.new as Lead, ...prev]);
        if (payload.eventType === 'UPDATE') setLeads((prev) => prev.map((l) => l.id === payload.new.id ? payload.new as Lead : l));
        if (payload.eventType === 'DELETE') setLeads((prev) => prev.filter((l) => l.id !== payload.old.id));
      }).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [mode, currentUser]);

  async function moveLeadStage(leadId: string, newStage: LeadStage) {
    await supabase.from('leads').update({ stage: newStage, last_activity_at: new Date().toISOString() }).eq('id', leadId);
    setLeads((prev) => prev.map((l) => l.id === leadId ? { ...l, stage: newStage } : l));
  }

  return (
    <PageTransition>
      <div className="flex flex-col gap-9">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="t-h1">BD Pipeline</h1>
            <p className="t-xs mt-1">Manage leads from prospect to close.</p>
          </div>
          <Button icon={<Plus size={14} />} onClick={() => setShowCreate(true)}>Add Lead</Button>
        </div>

        {/* Kanban Board */}
        <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: '60vh' }}>
          {stages.map((stage) => {
            const stageLeads = leads.filter((l) => l.stage === stage.value);
            return (
              <div key={stage.value} className="shrink-0 w-[240px]">
                <div className="flex items-center gap-2 mb-3 px-1">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background: stage.color }} />
                  <span className="t-label">{stage.label}</span>
                  <span className="t-mono-sm">{stageLeads.length}</span>
                </div>
                <div className="flex flex-col gap-3">
                  {stageLeads.map((lead) => (
                    <Card key={lead.id} variant="base" className="cursor-pointer hover-bg-hover interactive" onClick={() => setSelectedLead(lead)}>
                      <p className="t-sm-medium truncate">{lead.company}</p>
                      {lead.contact_name && <p className="t-xs text-secondary truncate">{lead.contact_name}</p>}
                      <div className="flex items-center justify-between mt-2">
                        <span className="t-2xs text-tertiary">{formatRelative(lead.last_activity_at)}</span>
                        {lead.deal_value && <Badge variant="green">{formatINR(lead.deal_value)}</Badge>}
                      </div>
                      {lead.next_action && (
                        <p className="t-2xs mt-1 truncate" style={{ color: 'var(--accent-amber)' }}>→ {lead.next_action}</p>
                      )}
                    </Card>
                  ))}
                  {stageLeads.length === 0 && (
                    <div className="py-8 text-center border-subtle radius-lg"
                      style={{ border: '1px dashed var(--border-subtle)' }}>
                      <p className="t-2xs text-tertiary">No leads</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {selectedLead && (
          <LeadDetailModal lead={selectedLead} onClose={() => setSelectedLead(null)} onMoveStage={moveLeadStage}
            onUpdate={(updated) => { setLeads((prev) => prev.map((l) => l.id === updated.id ? updated : l)); setSelectedLead(updated); }} />
        )}
        <CreateLeadModal open={showCreate} onClose={() => setShowCreate(false)} mode={mode} currentUser={currentUser}
          onCreated={(lead) => { setLeads((prev) => [lead, ...prev]); setShowCreate(false); }} />
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
      <div className="flex flex-col gap-6">
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

        <div className="grid grid-cols-2 gap-4">
          {lead.contact_email && (
            <div>
              <p className="t-label sub-label-gap">Email</p>
              <p className="t-xs text-accent-blue">{lead.contact_email}</p>
            </div>
          )}
          {lead.contact_phone && (
            <div>
              <p className="t-label sub-label-gap">Phone</p>
              <p className="t-xs">{lead.contact_phone}</p>
            </div>
          )}
          {lead.next_action && (
            <div>
              <p className="t-label sub-label-gap">Next Action</p>
              <p className="t-xs" style={{ color: 'var(--accent-amber)' }}>{lead.next_action}</p>
            </div>
          )}
        </div>

        {/* Activity Log */}
        <div>
          <p className="t-label section-gap">Activity Log</p>
          <div className="flex flex-col gap-2 overflow-y-auto mb-3" style={{ maxHeight: 200 }}>
            {(lead.notes || []).slice().reverse().map((note: any, i: number) => (
              <div key={i} className="t-xs pl-3" style={{ borderLeft: '2px solid var(--border-subtle)' }}>
                <p className="text-primary">{note.text}</p>
                <p className="t-2xs text-tertiary mt-0.5">{formatRelative(note.created_at)}</p>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Input value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder="Add a note..." style={{ flex: 1 }}
              onKeyDown={(e) => e.key === 'Enter' && addNote()} />
            <Button variant="secondary" onClick={addNote} loading={saving}><StickyNote size={12} /> Add</Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function CreateLeadModal({ open, onClose, mode, currentUser, onCreated }: any) {
  const [company, setCompany] = useState('');
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [source, setSource] = useState('');
  const [dealValue, setDealValue] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    if (!company || !currentUser) return;
    setSaving(true);
    const supabase = createClient();
    const { data, error } = await supabase.from('leads')
      .insert({
        user_id: currentUser.id, mode, company,
        contact_name: contactName || null, contact_email: email || null, contact_phone: phone || null,
        source: source || null, stage: 'prospect',
        deal_value: dealValue ? parseFloat(dealValue) : null,
        notes: [], last_activity_at: new Date().toISOString(),
      }).select().single();
    if (!error && data) onCreated(data);
    setSaving(false);
  }

  return (
    <Modal open={open} onClose={onClose} title="Add Lead" size="md">
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-4">
          <Input label="Company" value={company} onChange={(e) => setCompany(e.target.value)} required />
          <Input label="Contact Name" value={contactName} onChange={(e) => setContactName(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Source" value={source} onChange={(e) => setSource(e.target.value)} placeholder="e.g., LinkedIn, referral" />
          <Input label="Deal Value (₹)" type="number" value={dealValue} onChange={(e) => setDealValue(e.target.value)} />
        </div>
        <div className="flex gap-2 pt-2 border-t-subtle">
          <Button variant="secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</Button>
          <Button onClick={handleCreate} loading={saving} style={{ flex: 1 }} disabled={!company}>Add Lead</Button>
        </div>
      </div>
    </Modal>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { useBrand } from '@/lib/brand';
import { useCurrentUser } from '@/lib/auth/use-auth';
import { createClient } from '@/lib/supabase/client';
import { PageTransition } from '@/components/dashboard/PageTransition';
import { Card, Badge, Button, Modal, Input, Select, Textarea, EmptyState } from '@/components/ui';
import { formatDate, daysUntil, cn, buildMailtoLink, buildWhatsAppLink } from '@/lib/utils';
import { Plus, Shield, Mail, MessageCircle, Copy, Check } from 'lucide-react';
import type { Client } from '@/types';

export default function PersonalSupportPage() {
  const { mode, brand } = useBrand();
  const { user: currentUser } = useCurrentUser();
  const [periods, setPeriods] = useState<any[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [showClosing, setShowClosing] = useState<any>(null);
  const supabase = createClient();

  useEffect(() => {
    async function fetch() {
      if (!currentUser) return;
      const { data: sp } = await supabase.from('support_periods')
        .select('*, clients(name, contact_email, contact_phone)')
        .eq('user_id', currentUser.id).eq('mode', mode).order('end_date', { ascending: true });
      setPeriods(sp || []);
      const { data: c } = await supabase.from('clients').select('*').eq('user_id', currentUser.id).eq('mode', mode);
      setClients((c as Client[]) || []);
    }
    fetch();
  }, [mode, currentUser]);

  const active = periods.filter((p) => new Date(p.end_date) >= new Date());
  const ended  = periods.filter((p) => new Date(p.end_date) < new Date());

  return (
    <PageTransition>
      <div className="flex flex-col gap-9">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="t-h1">Support Periods</h1>
            <p className="t-xs mt-1">Track active support and retention touchpoints.</p>
          </div>
          <Button icon={<Plus size={14} />} onClick={() => setShowAdd(true)}>Add Period</Button>
        </div>

        {active.length === 0 && ended.length === 0 ? (
          <Card><EmptyState icon={<Shield />} title="No support periods" description="Add a support period when you deliver a project." /></Card>
        ) : (
          <>
            {active.length > 0 && (
              <div className="flex flex-col gap-3">
                <h2 className="t-label">Active</h2>
                {active.map((sp) => {
                  const days = daysUntil(sp.end_date);
                  const isUrgent = days <= 5;
                  return (
                    <Card key={sp.id} variant="base" className="flex items-center gap-4">
                      <div className={cn('w-9 h-9 rounded-full flex items-center justify-center shrink-0',
                        isUrgent ? 'bg-accent-amber-dim' : 'bg-accent-green-dim')}>
                        <Shield size={16} style={{ color: isUrgent ? 'var(--accent-amber)' : 'var(--accent-green)' }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="t-sm-medium">{sp.clients?.name}</p>
                        <p className="t-2xs text-tertiary">{formatDate(sp.start_date)} — {formatDate(sp.end_date)}</p>
                      </div>
                      <Badge variant={isUrgent ? 'amber' : 'green'} dot>{days} day{days !== 1 ? 's' : ''} left</Badge>
                      {isUrgent && (
                        <Button variant="secondary" size="sm" onClick={() => setShowClosing(sp)}>Compose Closing</Button>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
            {ended.length > 0 && (
              <div className="flex flex-col gap-3">
                <h2 className="t-label">Ended</h2>
                {ended.map((sp) => (
                  <Card key={sp.id} variant="base" className="flex items-center gap-4" style={{ opacity: 0.6 }}>
                    <Shield size={16} className="text-tertiary" />
                    <div className="flex-1">
                      <p className="t-xs text-secondary">{sp.clients?.name}</p>
                      <p className="t-2xs text-tertiary">Ended {formatDate(sp.end_date)}</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setShowClosing(sp)}>Send Closing</Button>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}

        {showClosing && <ClosingComposer period={showClosing} brand={brand} onClose={() => setShowClosing(null)} />}
        <AddSupportModal open={showAdd} onClose={() => setShowAdd(false)} mode={mode} clients={clients} currentUser={currentUser}
          onCreated={(sp) => { setPeriods((prev) => [sp, ...prev]); setShowAdd(false); }} />
      </div>
    </PageTransition>
  );
}

function ClosingComposer({ period, brand, onClose }: { period: any; brand: any; onClose: () => void }) {
  const clientName = period.clients?.name || 'there';
  const bizName = brand?.business_name || 'us';
  const [copied, setCopied] = useState(false);

  const message = `Hi ${clientName},\n\nI wanted to reach out as your support period is coming to an end. It's been a real pleasure working with you on this project.\n\nThank you for trusting ${bizName} with your vision. If you ever need anything in the future — whether it's a new project, updates, or just a quick chat — don't hesitate to reach out.\n\nI'd also love to hear any feedback you have about the experience. It helps me keep improving.\n\nWishing you all the best,\n${bizName}`;

  return (
    <Modal open={true} onClose={onClose} title="Closing Message" description={`For ${clientName}`} size="md">
      <div className="flex flex-col gap-5">
        {/* Read-only textarea styled distinctly */}
        <div className="p-3 bg-hover radius-md border-subtle" style={{ whiteSpace: 'pre-wrap', fontSize: 13, fontFamily: 'var(--font-body)', color: 'var(--text-primary)', lineHeight: 1.6, minHeight: 200, overflowY: 'auto' }}>
          {message}
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" icon={copied ? <Check size={14} /> : <Copy size={14} />}
            onClick={() => { navigator.clipboard.writeText(message); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
            {copied ? 'Copied!' : 'Copy'}
          </Button>
          {period.clients?.contact_email && (
            <Button icon={<Mail size={14} />}
              onClick={() => window.open(buildMailtoLink(period.clients.contact_email, `Thank you — ${bizName}`, message), '_blank')}>
              Email
            </Button>
          )}
          {period.clients?.contact_phone && (
            <Button variant="secondary" icon={<MessageCircle size={14} />}
              onClick={() => window.open(buildWhatsAppLink(period.clients.contact_phone, message), '_blank')}>
              WhatsApp
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}

function AddSupportModal({ open, onClose, mode, clients, currentUser, onCreated }: any) {
  const [clientId, setClientId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!clientId || !startDate || !endDate || !currentUser) return;
    setSaving(true);
    const supabase = createClient();
    const { data, error } = await supabase.from('support_periods')
      .insert({ user_id: currentUser.id, mode, client_id: clientId, start_date: startDate, end_date: endDate, notes: notes || null })
      .select('*, clients(name, contact_email, contact_phone)').single();
    if (!error && data) onCreated(data);
    setSaving(false);
  }

  return (
    <Modal open={open} onClose={onClose} title="Add Support Period" size="sm">
      <div className="flex flex-col gap-5">
        <Select label="Client" placeholder="Select..." options={clients.map((c: Client) => ({ value: c.id, label: c.name }))} value={clientId} onChange={(e) => setClientId(e.target.value)} />
        <div className="grid grid-cols-2 gap-4">
          <Input label="Start Date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <Input label="End Date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
        <Textarea label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes..." />
        <div className="flex gap-2 pt-2 border-t-subtle">
          <Button variant="secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</Button>
          <Button onClick={handleSave} loading={saving} style={{ flex: 1 }}>Add</Button>
        </div>
      </div>
    </Modal>
  );
}

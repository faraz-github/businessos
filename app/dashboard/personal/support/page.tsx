'use client';

import { useState, useEffect } from 'react';
import { useBrand } from '@/lib/brand';
import { createClient } from '@/lib/supabase/client';
import { PageTransition } from '@/components/dashboard/PageTransition';
import { Card, Badge, Button, Modal, Input, Select, Textarea, EmptyState } from '@/components/ui';
import { formatDate, daysUntil, cn, buildMailtoLink, buildWhatsAppLink } from '@/lib/utils';
import { Plus, Shield, Clock, Mail, MessageCircle, Copy, Check } from 'lucide-react';
import type { Client, SupportPeriod } from '@/types';

export default function PersonalSupportPage() {
  const { mode, brand } = useBrand();
  const [periods, setPeriods] = useState<any[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [showClosing, setShowClosing] = useState<any>(null);
  const supabase = createClient();

  useEffect(() => {
    async function fetch() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: sp } = await supabase
        .from('support_periods')
        .select('*, clients(name, contact_email, contact_phone)')
        .eq('user_id', user.id)
        .eq('mode', mode)
        .order('end_date', { ascending: true });
      setPeriods(sp || []);
      const { data: c } = await supabase.from('clients').select('*').eq('user_id', user.id).eq('mode', mode);
      setClients((c as Client[]) || []);
    }
    fetch();
  }, [mode, supabase]);

  const active = periods.filter((p) => new Date(p.end_date) >= new Date());
  const ended = periods.filter((p) => new Date(p.end_date) < new Date());

  return (
    <PageTransition>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-2xl font-extrabold tracking-tight">Support Periods</h1>
            <p className="text-[13px] text-[var(--text-secondary)] mt-1">Track active support and retention touchpoints.</p>
          </div>
          <Button icon={<Plus size={14} />} onClick={() => setShowAdd(true)}>Add Period</Button>
        </div>

        {active.length === 0 && ended.length === 0 ? (
          <Card><EmptyState icon={<Shield />} title="No support periods" description="Add a support period when you deliver a project." /></Card>
        ) : (
          <>
            {active.length > 0 && (
              <div className="space-y-2">
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-tertiary)]">Active</h2>
                {active.map((sp) => {
                  const days = daysUntil(sp.end_date);
                  const isUrgent = days <= 5;
                  return (
                    <Card key={sp.id} variant="base" className="flex items-center gap-4">
                      <div className={cn(
                        'w-9 h-9 rounded-full flex items-center justify-center shrink-0',
                        isUrgent ? 'bg-[var(--accent-amber-dim)]' : 'bg-[var(--accent-green-dim)]',
                      )}>
                        <Shield size={16} className={isUrgent ? 'text-[var(--accent-amber)]' : 'text-[var(--accent-green)]'} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-[var(--text-primary)]">{sp.clients?.name}</p>
                        <p className="text-[11px] text-[var(--text-tertiary)]">
                          {formatDate(sp.start_date)} — {formatDate(sp.end_date)}
                        </p>
                      </div>
                      <Badge variant={isUrgent ? 'amber' : 'green'} dot>
                        {days} day{days !== 1 ? 's' : ''} left
                      </Badge>
                      {isUrgent && (
                        <Button variant="secondary" size="sm" onClick={() => setShowClosing(sp)}>
                          Compose Closing
                        </Button>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}

            {ended.length > 0 && (
              <div className="space-y-2">
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-tertiary)]">Ended</h2>
                {ended.map((sp) => (
                  <Card key={sp.id} variant="base" className="flex items-center gap-4 opacity-60">
                    <Shield size={16} className="text-[var(--text-tertiary)]" />
                    <div className="flex-1">
                      <p className="text-[13px] text-[var(--text-secondary)]">{sp.clients?.name}</p>
                      <p className="text-[11px] text-[var(--text-tertiary)]">Ended {formatDate(sp.end_date)}</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setShowClosing(sp)}>Send Closing</Button>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}

        {/* Closing Composer */}
        {showClosing && (
          <ClosingComposer
            period={showClosing}
            brand={brand}
            onClose={() => setShowClosing(null)}
          />
        )}

        {/* Add Support Period */}
        <AddSupportModal
          open={showAdd}
          onClose={() => setShowAdd(false)}
          mode={mode}
          clients={clients}
          onCreated={(sp) => { setPeriods((prev) => [sp, ...prev]); setShowAdd(false); }}
        />
      </div>
    </PageTransition>
  );
}

function ClosingComposer({ period, brand, onClose }: { period: any; brand: any; onClose: () => void }) {
  const clientName = period.clients?.name || 'there';
  const bizName = brand?.business_name || 'us';
  const [copied, setCopied] = useState(false);

  const message = `Hi ${clientName},

I wanted to reach out as your support period is coming to an end. It's been a real pleasure working with you on this project.

Thank you for trusting ${bizName} with your vision. If you ever need anything in the future — whether it's a new project, updates, or just a quick chat — don't hesitate to reach out.

I'd also love to hear any feedback you have about the experience. It helps me keep improving.

Wishing you all the best,
${bizName}`;

  return (
    <Modal open={true} onClose={onClose} title="Closing Message" description={`For ${clientName}`} size="md">
      <div className="space-y-4">
        <Textarea value={message} className="min-h-[200px] text-[13px]" readOnly />
        <div className="flex gap-2">
          <Button
            variant="secondary"
            icon={copied ? <Check size={14} /> : <Copy size={14} />}
            onClick={() => { navigator.clipboard.writeText(message); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
          >
            {copied ? 'Copied!' : 'Copy'}
          </Button>
          {period.clients?.contact_email && (
            <Button
              icon={<Mail size={14} />}
              onClick={() => window.open(buildMailtoLink(period.clients.contact_email, `Thank you — ${bizName}`, message), '_blank')}
            >
              Email
            </Button>
          )}
          {period.clients?.contact_phone && (
            <Button
              variant="secondary"
              icon={<MessageCircle size={14} />}
              onClick={() => window.open(buildWhatsAppLink(period.clients.contact_phone, message), '_blank')}
            >
              WhatsApp
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}

function AddSupportModal({ open, onClose, mode, clients, onCreated }: any) {
  const [clientId, setClientId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!clientId || !startDate || !endDate) return;
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase
      .from('support_periods')
      .insert({ user_id: user.id, mode, client_id: clientId, start_date: startDate, end_date: endDate, notes: notes || null })
      .select('*, clients(name, contact_email, contact_phone)')
      .single();
    if (!error && data) onCreated(data);
    setSaving(false);
  }

  return (
    <Modal open={open} onClose={onClose} title="Add Support Period" size="sm">
      <div className="space-y-4">
        <Select label="Client" placeholder="Select..." options={clients.map((c: Client) => ({ value: c.id, label: c.name }))} value={clientId} onChange={(e) => setClientId(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Start Date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <Input label="End Date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
        <Textarea label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes..." />
        <div className="flex gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} className="flex-1">Cancel</Button>
          <Button onClick={handleSave} loading={saving} className="flex-1">Add</Button>
        </div>
      </div>
    </Modal>
  );
}

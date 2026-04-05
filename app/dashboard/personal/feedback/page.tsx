'use client';

import { useState, useEffect } from 'react';
import { useBrand } from '@/lib/brand';
import { useCurrentUser } from '@/lib/auth/use-auth';
import { createClient } from '@/lib/supabase/client';
import { PageTransition } from '@/components/dashboard/PageTransition';
import { Card, Badge, Button, Modal, Input, Textarea, Select, EmptyState } from '@/components/ui';
import { formatDate, buildMailtoLink, buildWhatsAppLink } from '@/lib/utils';
import { Plus, Mail, MessageCircle, Quote } from 'lucide-react';
import type { Testimonial, Client } from '@/types';

export default function PersonalFeedbackPage() {
  const { mode, brand } = useBrand();
  const { user: currentUser } = useCurrentUser();
  const [testimonials, setTestimonials] = useState<any[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    async function fetch() {
      if (!currentUser) return;
      const { data: t } = await supabase.from('testimonials').select('*, clients(name)')
        .eq('user_id', currentUser.id).eq('mode', mode).order('received_at', { ascending: false });
      setTestimonials(t || []);
      const { data: c } = await supabase.from('clients').select('*').eq('user_id', currentUser.id).eq('mode', mode);
      setClients((c as Client[]) || []);
    }
    fetch();
  }, [mode, currentUser]);

  const portfolioUsable = testimonials.filter((t) => t.portfolio_usable);

  return (
    <PageTransition>
      <div className="flex flex-col gap-9">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="t-h1">Feedback</h1>
            <p className="t-xs mt-1">Request feedback, store testimonials, and send re-engagement messages.</p>
          </div>
          <Button icon={<Plus size={14} />} onClick={() => setShowAdd(true)}>Add Testimonial</Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card variant="metric">
            <p className="t-label section-gap">Total</p>
            <p className="t-metric">{testimonials.length}</p>
          </Card>
          <Card variant="metric">
            <p className="t-label section-gap">Portfolio</p>
            <p className="t-metric">{portfolioUsable.length}</p>
          </Card>
          <Card variant="metric">
            <p className="t-label section-gap">Clients</p>
            <p className="t-metric">{new Set(testimonials.map((t) => t.client_id)).size}</p>
          </Card>
        </div>

        {/* Request Feedback */}
        <Card variant="base">
          <p className="t-label section-gap">Request Feedback</p>
          <div className="grid grid-cols-2 gap-2">
            {clients
              .filter((c) => ['handover', 'deployed', 'support_active', 'feedback_sent', 'retention_sent', 'completed'].includes(c.current_stage))
              .map((client) => (
                <div key={client.id} className="flex items-center gap-3 p-3 radius-md border-subtle hover-bg-hover interactive">
                  <div className="flex-1 min-w-0">
                    <p className="t-sm-medium truncate">{client.name}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm"
                      onClick={() => window.open(buildMailtoLink(client.contact_email || '', 'Feedback Request', ''), '_blank')}>
                      <Mail size={12} />
                    </Button>
                    <Button variant="ghost" size="sm"
                      onClick={() => window.open(buildWhatsAppLink(client.contact_phone || '', ''), '_blank')}>
                      <MessageCircle size={12} />
                    </Button>
                  </div>
                </div>
              ))}
          </div>
        </Card>

        {/* Testimonials */}
        {testimonials.length === 0 ? (
          <Card><EmptyState icon={<Quote />} title="No testimonials yet" description="Collect feedback from your delivered clients." /></Card>
        ) : (
          <div className="flex flex-col gap-3">
            {testimonials.map((t) => (
              <Card key={t.id} variant="base">
                <div className="flex items-start gap-3">
                  <Quote size={16} style={{ color: 'var(--accent-violet)', flexShrink: 0, marginTop: 2 }} />
                  <div className="flex-1">
                    <p className="t-sm text-primary" style={{ fontStyle: 'italic', lineHeight: 1.6 }}>&ldquo;{t.content}&rdquo;</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="t-2xs text-secondary">{t.clients?.name}</span>
                      <Badge variant={t.portfolio_usable ? 'green' : 'outline'}>{t.portfolio_usable ? 'Portfolio' : 'Private'}</Badge>
                      <Badge variant="outline" style={{ textTransform: 'capitalize' }}>{t.source}</Badge>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        <AddTestimonialModal
          open={showAdd}
          onClose={() => setShowAdd(false)}
          mode={mode}
          clients={clients}
          currentUser={currentUser}
          onCreated={(t) => { setTestimonials((prev) => [t, ...prev]); setShowAdd(false); }}
        />
      </div>
    </PageTransition>
  );
}

function AddTestimonialModal({ open, onClose, mode, clients, currentUser, onCreated }: any) {
  const [clientId, setClientId] = useState('');
  const [content, setContent] = useState('');
  const [source, setSource] = useState('direct');
  const [portfolioUsable, setPortfolioUsable] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!clientId || !content || !currentUser) return;
    setSaving(true);
    const supabase = createClient();
    const { data, error } = await supabase.from('testimonials')
      .insert({ user_id: currentUser.id, mode, client_id: clientId, content, source, portfolio_usable: portfolioUsable })
      .select('*, clients(name)').single();
    if (!error && data) onCreated(data);
    setSaving(false);
  }

  return (
    <Modal open={open} onClose={onClose} title="Add Testimonial" size="md">
      <div className="flex flex-col gap-5">
        <Select label="Client" placeholder="Select client..." options={clients.map((c: Client) => ({ value: c.id, label: c.name }))} value={clientId} onChange={(e) => setClientId(e.target.value)} />
        <Textarea label="Testimonial Content" value={content} onChange={(e) => setContent(e.target.value)} placeholder="What did they say?" />
        <div className="grid grid-cols-2 gap-4">
          <Select label="Source" options={[{ value: 'direct', label: 'Direct' }, { value: 'linkedin', label: 'LinkedIn' }, { value: 'email', label: 'Email' }, { value: 'form', label: 'Form' }]} value={source} onChange={(e) => setSource(e.target.value)} />
          <div className="flex flex-col gap-1.5">
            <label className="t-label">Portfolio Usable</label>
            <label className="flex items-center gap-2 cursor-pointer mt-1">
              <input type="checkbox" checked={portfolioUsable} onChange={(e) => setPortfolioUsable(e.target.checked)} style={{ accentColor: 'var(--accent-blue)' }} />
              <span className="t-sm text-primary">Can be used publicly</span>
            </label>
          </div>
        </div>
        <div className="flex gap-2 pt-2 border-t-subtle">
          <Button variant="secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</Button>
          <Button onClick={handleSave} loading={saving} style={{ flex: 1 }} disabled={!clientId || !content}>Save</Button>
        </div>
      </div>
    </Modal>
  );
}

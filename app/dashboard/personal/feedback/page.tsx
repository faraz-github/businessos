'use client';

import { useState, useEffect } from 'react';
import { useBrand } from '@/lib/brand';
import { useCurrentUser } from '@/lib/auth/use-auth';
import { createClient } from '@/lib/supabase/client';
import { PageTransition } from '@/components/dashboard/PageTransition';
import { Card, Badge, Button, Tabs, Modal, Input, Textarea, Select, EmptyState } from '@/components/ui';
import { formatDate, buildMailtoLink, buildWhatsAppLink } from '@/lib/utils';
import { Plus, MessageSquare, Mail, MessageCircle, Star, Quote, Copy, Check } from 'lucide-react';
import type { Testimonial, Client } from '@/types';

type FeedbackAction = 'form' | 'whatsapp' | 'email' | 'recommendation' | 'endorsement';

export default function PersonalFeedbackPage() {
  const { mode, brand } = useBrand();
  const { user: currentUser } = useCurrentUser();
  const [testimonials, setTestimonials] = useState<any[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [showCompose, setShowCompose] = useState<{ client: Client; action: FeedbackAction } | null>(null);
  const supabase = createClient();

  useEffect(() => {
    async function fetch() {
      const user = currentUser;
      if (!user) return;
      const { data: t } = await supabase
        .from('testimonials')
        .select('*, clients(name)')
        .eq('user_id', user.id)
        .eq('mode', mode)
        .order('received_at', { ascending: false });
      setTestimonials(t || []);
      const { data: c } = await supabase.from('clients').select('*').eq('user_id', user.id).eq('mode', mode);
      setClients((c as Client[]) || []);
    }
    fetch();
  }, [mode, supabase]);

  const portfolioUsable = testimonials.filter((t) => t.portfolio_usable);

  return (
    <PageTransition>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="t-h1">Feedback</h1>
            <p className="text-[13px] text-[var(--text-secondary)] mt-1">Collect and manage client testimonials.</p>
          </div>
          <Button icon={<Plus size={14} />} onClick={() => setShowAdd(true)}>Add Testimonial</Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card variant="metric">
            <p className="text-[11px] text-[var(--text-tertiary)] uppercase tracking-wide font-semibold">Total</p>
            <p className="t-h1">{testimonials.length}</p>
          </Card>
          <Card variant="metric">
            <p className="text-[11px] text-[var(--text-tertiary)] uppercase tracking-wide font-semibold">Portfolio</p>
            <p className="t-h1">{portfolioUsable.length}</p>
          </Card>
          <Card variant="metric">
            <p className="text-[11px] text-[var(--text-tertiary)] uppercase tracking-wide font-semibold">Clients</p>
            <p className="t-h1">
              {new Set(testimonials.map((t) => t.client_id)).size}
            </p>
          </Card>
        </div>

        {/* Request Feedback from Client */}
        <Card variant="base">
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-tertiary)] mb-3">Request Feedback</p>
          <div className="grid grid-cols-2 gap-2">
            {clients.filter((c) => ['delivered', 'deployed', 'support_period_active', 'completed'].includes(c.current_stage)).map((client) => (
              <div key={client.id} className="flex items-center gap-3 p-3 rounded-[var(--radius-md)] border border-[var(--border-subtle)] hover:bg-[var(--bg-hover)] transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-[var(--text-primary)] truncate">{client.name}</p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => setShowCompose({ client, action: 'email' })}>
                    <Mail size={12} />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setShowCompose({ client, action: 'whatsapp' })}>
                    <MessageCircle size={12} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Testimonials List */}
        {testimonials.length === 0 ? (
          <Card>
            <EmptyState icon={<Quote />} title="No testimonials yet" description="Collect feedback from your delivered clients." />
          </Card>
        ) : (
          <div className="flex flex-col gap-2">
            {testimonials.map((t) => (
              <Card key={t.id} variant="base">
                <div className="flex items-start gap-3">
                  <Quote size={16} className="text-[var(--accent-violet)] shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-[13px] text-[var(--text-primary)] leading-relaxed italic">&ldquo;{t.content}&rdquo;</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-[11px] text-[var(--text-secondary)]">{t.clients?.name}</span>
                      <Badge variant={t.portfolio_usable ? 'green' : 'outline'} className="text-[9px]">
                        {t.portfolio_usable ? 'Portfolio' : 'Private'}
                      </Badge>
                      <Badge variant="outline" className="text-[9px] capitalize">{t.source}</Badge>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Add Testimonial Modal */}
        <AddTestimonialModal
          open={showAdd}
          onClose={() => setShowAdd(false)}
          mode={mode}
          clients={clients}
          onCreated={(t) => { setTestimonials((prev) => [t, ...prev]); setShowAdd(false); }}
        />
      </div>
    </PageTransition>
  );
}

function AddTestimonialModal({ open, onClose, mode, clients, onCreated }: any) {
  const [clientId, setClientId] = useState('');
  const [content, setContent] = useState('');
  const [source, setSource] = useState('direct');
  const [portfolioUsable, setPortfolioUsable] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!clientId || !content) return;
    setSaving(true);
    const supabase = createClient();
    const user = currentUser;
    if (!user) return;

    const { data, error } = await supabase
      .from('testimonials')
      .insert({ user_id: user.id, mode, client_id: clientId, content, source, portfolio_usable: portfolioUsable })
      .select('*, clients(name)')
      .single();

    if (!error && data) onCreated(data);
    setSaving(false);
  }

  return (
    <Modal open={open} onClose={onClose} title="Add Testimonial" size="md">
      <div className="flex flex-col gap-4">
        <Select
          label="Client"
          placeholder="Select client..."
          options={clients.map((c: Client) => ({ value: c.id, label: c.name }))}
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
        />
        <Textarea label="Testimonial Content" value={content} onChange={(e) => setContent(e.target.value)} placeholder="What did they say?" />
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Source"
            options={[
              { value: 'direct', label: 'Direct' },
              { value: 'linkedin', label: 'LinkedIn' },
              { value: 'email', label: 'Email' },
              { value: 'form', label: 'Form' },
            ]}
            value={source}
            onChange={(e) => setSource(e.target.value)}
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--text-tertiary)]">Portfolio Usable</label>
            <label className="flex items-center gap-2 cursor-pointer mt-1">
              <input type="checkbox" checked={portfolioUsable} onChange={(e) => setPortfolioUsable(e.target.checked)} className="accent-[var(--accent-blue)]" />
              <span className="text-[13px] text-[var(--text-primary)]">Can be used publicly</span>
            </label>
          </div>
        </div>
        <div className="flex gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</Button>
          <Button onClick={handleSave} loading={saving} style={{ flex: 1 }} disabled={!clientId || !content}>Save</Button>
        </div>
      </div>
    </Modal>
  );
}

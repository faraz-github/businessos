'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useBrand } from '@/lib/brand';
import { useCurrentUser } from '@/lib/auth/use-auth';
import { createClient } from '@/lib/supabase/client';
import { PageTransition } from '@/components/dashboard/PageTransition';
import { Button, Modal, Input, Textarea, Select, OverflowMenu, LoadMore, useLoadMore } from '@/components/ui';
import { toast } from '@/components/ui/Toast';
import { formatDate, buildMailtoLink, buildWhatsAppLink } from '@/lib/utils';
import {
  Plus, Mail, MessageCircle, Quote, Copy, Check,
  Pencil, Trash2, Star, Filter, RotateCcw,
} from 'lucide-react';
import type { Client } from '@/types';
import {
  createTestimonial,
  updateTestimonial,
  deleteTestimonial,
} from '@/app/dashboard/actions/engagements';

// ── Stages considered "post-delivery" for feedback requests ──
const FEEDBACK_ELIGIBLE_STAGES = [
  'handover', 'deployed', 'support_active',
  'feedback_sent', 'retention_sent', 'completed',
];

const SOURCE_LABELS: Record<string, string> = {
  direct: 'Direct', linkedin: 'LinkedIn', email: 'Email', form: 'Form',
};

// ── MAIN PAGE ────────────────────────────────────────────────
export default function PersonalFeedbackPage() {
  const { mode, brand } = useBrand();
  const { user: currentUser } = useCurrentUser();
  const supabaseRef = useRef(createClient());
  const supabase    = supabaseRef.current;

  const [testimonials, setTestimonials] = useState<any[]>([]);
  const [clients, setClients]           = useState<Client[]>([]);
  const [showAdd, setShowAdd]           = useState(false);
  const [editingT, setEditingT]         = useState<any>(null);
  const [composingFor, setComposingFor] = useState<Client | null>(null);
  const [filterMode, setFilterMode]     = useState<'all' | 'portfolio' | 'private'>('all');
  const [copied, setCopied]             = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!currentUser) return;
    const [{ data: t }, { data: c }] = await Promise.all([
      supabase.from('testimonials').select('*, clients(name)')
        .eq('user_id', currentUser.ownerId).eq('mode', mode)
        .order('received_at', { ascending: false }),
      supabase.from('clients').select('id, name, contact_email, contact_phone, current_stage')
        .eq('user_id', currentUser.ownerId).eq('mode', mode),
    ]);
    setTestimonials(t || []);
    setClients((c as Client[]) || []);
  }, [currentUser, mode, supabase]);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleDelete(id: string) {
    const prev = testimonials;
    setTestimonials(p => p.filter(t => t.id !== id));
    const res = await deleteTestimonial(id);
    if (!res.ok) {
      setTestimonials(prev);
      toast.error(res.error || 'Could not delete testimonial');
    }
  }

  function handleCopy(content: string, id: string) {
    navigator.clipboard.writeText(content);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  }

  // Stats
  const portfolioCount  = testimonials.filter(t => t.portfolio_usable).length;
  const uniqueClients   = new Set(testimonials.map(t => t.client_id)).size;
  const eligibleClients = useMemo(() => clients.filter(c =>
    FEEDBACK_ELIGIBLE_STAGES.includes(c.current_stage || '')
  ), [clients]);

  // Filter testimonials
  const filtered = useMemo(() => testimonials.filter(t => {
    if (filterMode === 'portfolio') return t.portfolio_usable;
    if (filterMode === 'private')   return !t.portfolio_usable;
    return true;
  }), [testimonials, filterMode]);

  // Pagination
  const testimonialsPage = useLoadMore(filtered,        { pageSize: 20 });
  const eligiblePage     = useLoadMore(eligibleClients, { pageSize: 10 });

  return (
    <PageTransition>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <h1 className="t-h1">Feedback</h1>
            <p className="t-xs mt-1">Request feedback, store testimonials, and send re-engagement messages.</p>
          </div>
          <Button icon={<Plus size={14} />} onClick={() => setShowAdd(true)}>Add Testimonial</Button>
        </div>

        {/* Stats */}
        <div className="rgrid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {[
            { label: 'Total', value: testimonials.length, color: 'var(--accent-violet)', sub: 'testimonials collected' },
            { label: 'Portfolio-ready', value: portfolioCount, color: 'var(--accent-green)', sub: 'approved for public use' },
            { label: 'Unique Clients', value: uniqueClients, color: 'var(--accent-blue)', sub: 'clients who gave feedback' },
          ].map(({ label, value, color, sub }) => (
            <div key={label} className="card" style={{ padding: '16px 20px' }}>
              <p className="t-label" style={{ marginBottom: 8 }}>{label}</p>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 800, color, lineHeight: 1, marginBottom: 4 }}>{value}</p>
              <p className="t-2xs text-tertiary">{sub}</p>
            </div>
          ))}
        </div>

        {/* Request Feedback section */}
        <div className="card" style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <p className="t-label">Request Feedback</p>
            <span className="t-2xs text-tertiary">{eligibleClients.length} delivered client{eligibleClients.length !== 1 ? 's' : ''}</span>
          </div>

          {eligibleClients.length === 0 ? (
            <p className="t-xs text-tertiary" style={{ fontStyle: 'italic' }}>
              No eligible clients yet. Clients at Handover or later stages will appear here.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {eligiblePage.paginated.map(client => (
                <div key={client.id} className="dense-row" style={{ padding: '10px 14px', background: 'var(--bg-hover)', borderRadius: 'var(--radius-md)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-elevated)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; }}>
                  {/* Avatar */}
                  <div className="dense-row__lead" style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--accent-violet-dim)', color: 'var(--accent-violet)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-display)' }}>
                    {client.name[0].toUpperCase()}
                  </div>
                  <div className="dense-row__body">
                    <div className="dense-row__title">
                      <span className="t-xs-medium dense-row__name">{client.name}</span>
                    </div>
                    {client.contact_email && (
                      <div className="dense-row__meta">
                        <span className="t-2xs text-tertiary">{client.contact_email}</span>
                      </div>
                    )}
                  </div>
                  <div className="dense-row__actions">
                    <button onClick={() => setComposingFor(client)}
                      className="row-btn-primary"
                      style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 11, fontFamily: 'var(--font-body)', cursor: 'pointer', transition: 'all 150ms' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent-violet)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent-violet)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)'; }}>
                      <MessageCircle size={11} /> <span className="row-btn-label">Request</span>
                    </button>
                  </div>
                </div>
              ))}
              <LoadMore hasMore={eligiblePage.hasMore} onLoadMore={eligiblePage.loadMore}
                shown={eligiblePage.shown} total={eligiblePage.total} showFooter={false} />
            </div>
          )}
        </div>

        {/* Testimonials list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Section header with filter */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p className="t-label">Testimonials</p>
            {testimonials.length > 0 && (
              <div style={{ display: 'flex', background: 'var(--bg-hover)', padding: 3, borderRadius: 'var(--radius-md)', gap: 2 }}>
                {(['all', 'portfolio', 'private'] as const).map(f => (
                  <button key={f} onClick={() => setFilterMode(f)}
                    style={{ padding: '4px 10px', borderRadius: 'calc(var(--radius-md) - 3px)', border: 'none', background: filterMode === f ? 'var(--bg-surface)' : 'transparent', color: filterMode === f ? 'var(--text-primary)' : 'var(--text-tertiary)', fontSize: 11, fontFamily: 'var(--font-body)', fontWeight: filterMode === f ? 500 : 400, cursor: 'pointer', boxShadow: filterMode === f ? 'var(--shadow-card)' : 'none', transition: 'all 150ms', textTransform: 'capitalize' }}>
                    {f}
                  </button>
                ))}
              </div>
            )}
          </div>

          {testimonials.length === 0 ? (
            <div className="card" style={{ padding: '40px 24px', textAlign: 'center' }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--accent-violet-dim)', color: 'var(--accent-violet)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <Quote size={20} />
              </div>
              <p className="t-sm-semibold" style={{ marginBottom: 6 }}>No testimonials yet</p>
              <p className="t-xs text-tertiary" style={{ marginBottom: 20 }}>Request feedback from delivered clients, then log it here.</p>
              <Button icon={<Plus size={14} />} onClick={() => setShowAdd(true)}>Add First Testimonial</Button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="card" style={{ padding: '24px', textAlign: 'center' }}>
              <p className="t-xs text-tertiary">No {filterMode} testimonials found.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {testimonialsPage.paginated.map(t => (
                <div key={t.id} className="card dense-row" style={{ padding: '16px 20px', alignItems: 'flex-start' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; }}>

                  {/* Quote icon */}
                  <div className="dense-row__lead" style={{ width: 32, height: 32, borderRadius: 'var(--radius-sm)', background: 'var(--accent-violet-dim)', color: 'var(--accent-violet)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
                    <Quote size={14} />
                  </div>

                  {/* Content */}
                  <div className="dense-row__body">
                    <p className="t-sm text-primary chip-opt-out" style={{ fontStyle: 'italic', lineHeight: 1.65, marginBottom: 10 }}>
                      "{t.content}"
                    </p>
                    <div className="dense-row__meta">
                      <span className="t-xs-medium">{t.clients?.name}</span>
                      <span className="t-2xs text-tertiary">{formatDate(t.received_at)}</span>
                      <span className="chip-opt-out" style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '2px 7px', borderRadius: 100, border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}>
                        {SOURCE_LABELS[t.source] || t.source}
                      </span>
                      {t.portfolio_usable && (
                        <span className="chip-opt-out" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '2px 8px', borderRadius: 100, background: 'var(--accent-green-dim)', color: 'var(--accent-green)' }}>
                          <Star size={9} /> Portfolio
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="dense-row__actions" style={{ marginTop: 1 }}>
                    <button onClick={() => handleCopy(t.content, t.id)} aria-label="Copy testimonial"
                      style={{ display: 'flex', padding: '5px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)', background: 'transparent', color: copied === t.id ? 'var(--accent-green)' : 'var(--text-tertiary)', cursor: 'pointer', transition: 'all 150ms' }}
                      onMouseEnter={e => { if (copied !== t.id) { (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; } }}
                      onMouseLeave={e => { if (copied !== t.id) { (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; } }}>
                      {copied === t.id ? <Check size={12} /> : <Copy size={12} />}
                    </button>
                    <button onClick={() => setEditingT(t)} aria-label="Edit"
                      style={{ display: 'flex', padding: '5px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)', background: 'transparent', color: 'var(--text-tertiary)', cursor: 'pointer', transition: 'all 150ms' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent-blue)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent-blue)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)'; }}>
                      <Pencil size={12} />
                    </button>
                    <button onClick={() => handleDelete(t.id)} aria-label="Delete"
                      className="hide-on-mobile-row"
                      style={{ display: 'flex', padding: '5px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'transparent', color: 'var(--text-tertiary)', cursor: 'pointer', transition: 'color 150ms' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent-red)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; }}>
                      <Trash2 size={12} />
                    </button>
                    <OverflowMenu
                      items={[
                        { label: 'Delete testimonial', icon: <Trash2 size={14} />, onClick: () => handleDelete(t.id), destructive: true },
                      ]}
                    />
                  </div>
                </div>
              ))}
              <LoadMore hasMore={testimonialsPage.hasMore} onLoadMore={testimonialsPage.loadMore}
                shown={testimonialsPage.shown} total={testimonialsPage.total} />
            </div>
          )}
        </div>
        {showAdd && (
          <TestimonialModal mode={mode} clients={clients} currentUser={currentUser}
            onClose={() => setShowAdd(false)}
            onSaved={t => { setTestimonials(prev => [t, ...prev]); setShowAdd(false); }} />
        )}
        {editingT && (
          <TestimonialModal mode={mode} clients={clients} currentUser={currentUser}
            existing={editingT}
            onClose={() => setEditingT(null)}
            onSaved={updated => {
              setTestimonials(prev => prev.map(t => t.id === updated.id ? updated : t));
              setEditingT(null);
            }} />
        )}
        {composingFor && (
          <FeedbackRequestComposer client={composingFor} brand={brand} onClose={() => setComposingFor(null)} />
        )}
      </div>
    </PageTransition>
  );
}

// ── ADD / EDIT TESTIMONIAL MODAL ─────────────────────────────
function TestimonialModal({ mode, clients, currentUser, existing, onClose, onSaved }: {
  mode: 'personal' | 'agency'; clients: Client[]; currentUser: { ownerId: string } | null;
  existing?: any; onClose: () => void; onSaved: (t: any) => void;
}) {
  const supabase = useRef(createClient()).current;
  const isEdit   = !!existing;

  const [clientId, setClientId]           = useState(existing?.client_id || '');
  const [content, setContent]             = useState(existing?.content || '');
  const [source, setSource]               = useState(existing?.source || 'direct');
  const [portfolioUsable, setPortfolioUsable] = useState(existing?.portfolio_usable ?? false);
  const [receivedAt, setReceivedAt]       = useState(existing?.received_at || new Date().toISOString().split('T')[0]);
  const [saving, setSaving]               = useState(false);

  async function handleSave() {
    if (!clientId || !content || !currentUser) return;
    setSaving(true);

    const res = isEdit
      ? await updateTestimonial(existing.id, {
          client_id:        clientId,
          content,
          source,
          portfolio_usable: portfolioUsable,
          received_at:      receivedAt,
        })
      : await createTestimonial({
          mode,
          client_id:        clientId,
          content,
          source,
          portfolio_usable: portfolioUsable,
          received_at:      receivedAt,
        });

    setSaving(false);
    if (!res.ok) {
      toast.error(res.error || 'Could not save testimonial');
      return;
    }
    onSaved(res.data);
  }

  return (
    <Modal open={true} onClose={onClose} title={isEdit ? 'Edit Testimonial' : 'Add Testimonial'} size="md">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Select label="Client" placeholder="Select client..."
          options={clients.map(c => ({ value: c.id, label: c.name }))}
          value={clientId} onChange={e => setClientId(e.target.value)} />
        <Textarea label="What did they say?" value={content} onChange={e => setContent(e.target.value)}
          placeholder="Paste the testimonial or write what they said..." style={{ minHeight: 120 }} />
        <div className="rgrid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Select label="Source" options={[
            { value: 'direct', label: 'Direct (in-person / call)' },
            { value: 'linkedin', label: 'LinkedIn' },
            { value: 'email', label: 'Email' },
            { value: 'form', label: 'Feedback Form' },
          ]} value={source} onChange={e => setSource(e.target.value)} />
          <Input label="Date Received" type="date" value={receivedAt} onChange={e => setReceivedAt(e.target.value)} />
        </div>

        {/* Portfolio toggle */}
        <button type="button" onClick={() => setPortfolioUsable((v: boolean) => !v)}
          style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 'var(--radius-md)', border: `1px solid ${portfolioUsable ? 'var(--accent-green)' : 'var(--border-default)'}`, background: portfolioUsable ? 'var(--accent-green-dim)' : 'transparent', cursor: 'pointer', transition: 'all 150ms', textAlign: 'left' }}>
          <div style={{ width: 36, height: 20, borderRadius: 100, background: portfolioUsable ? 'var(--accent-green)' : 'var(--bg-hover)', position: 'relative', flexShrink: 0, transition: 'background 150ms' }}>
            <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: portfolioUsable ? 19 : 3, transition: 'left 150ms', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: portfolioUsable ? 'var(--accent-green)' : 'var(--text-primary)', fontFamily: 'var(--font-body)' }}>Portfolio-ready</p>
            <p className="t-2xs text-tertiary">Can be used publicly on your portfolio or website</p>
          </div>
        </button>

        <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
          <Button variant="secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</Button>
          <Button onClick={handleSave} loading={saving} disabled={!clientId || !content} style={{ flex: 1 }}>
            {isEdit ? 'Save Changes' : 'Add Testimonial'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ── FEEDBACK REQUEST COMPOSER ────────────────────────────────
function FeedbackRequestComposer({ client, brand, onClose }: { client: Client; brand: any; onClose: () => void }) {
  const cn  = client.contact_name || client.name;
  const biz = brand?.business_name || '[Your Name]';

  const [channel, setChannel] = useState<'email' | 'whatsapp'>('email');
  const [userEdited, setUserEdited] = useState(false);
  const [copied, setCopied]         = useState(false);

  const defaultBody = (ch: 'email' | 'whatsapp') => ch === 'whatsapp'
    ? `Hey ${cn}! I hope everything's going well. I'd love to hear your honest feedback about the project we worked on together — even just a few sentences would mean a lot to me. Thank you so much! 🙏`
    : `Hi ${cn},\n\nI hope everything is going smoothly after the project!\n\nIf you have a moment, I'd genuinely appreciate your honest feedback about your experience working with ${biz}. Even a few sentences about what went well and what could be improved would be incredibly helpful.\n\nYou can simply reply to this email — there are no forms or links to fill in.\n\nThank you so much for your time, and it was a real pleasure working with you.\n\nWarm regards,\n${biz}`;

  const [body, setBody] = useState(() => defaultBody('email'));
  const subject = `A quick favour — feedback on our project`;

  function handleChannelChange(ch: 'email' | 'whatsapp') {
    setChannel(ch);
    if (!userEdited) setBody(defaultBody(ch));
  }

  function handleOpen() {
    if (channel === 'email') {
      window.open(buildMailtoLink(client.contact_email || '', subject, body), '_blank');
    } else {
      window.open(buildWhatsAppLink(client.contact_phone || '', body), '_blank');
    }
  }

  const channelMeta = {
    email:    { color: 'var(--accent-blue)',  action: 'Open in Mail',  icon: <Mail size={13} /> },
    whatsapp: { color: 'var(--accent-green)', action: 'Open WhatsApp', icon: <MessageCircle size={13} /> },
  }[channel];

  return (
    <Modal open={true} onClose={onClose} title="Request Feedback" description={`Asking ${cn} for feedback`} size="md">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Channel */}
        <div style={{ display: 'flex', background: 'var(--bg-hover)', padding: 3, borderRadius: 'var(--radius-md)', gap: 2 }}>
          {([
            { id: 'email', label: 'Email', icon: <Mail size={12} /> },
            { id: 'whatsapp', label: 'WhatsApp', icon: <MessageCircle size={12} /> },
          ] as const).map(ch => (
            <button key={ch.id} onClick={() => handleChannelChange(ch.id)}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '6px 0', borderRadius: 'calc(var(--radius-md) - 3px)', border: 'none', background: channel === ch.id ? 'var(--bg-surface)' : 'transparent', color: channel === ch.id ? 'var(--text-primary)' : 'var(--text-tertiary)', fontSize: 12, fontWeight: channel === ch.id ? 600 : 400, fontFamily: 'var(--font-body)', cursor: 'pointer', boxShadow: channel === ch.id ? 'var(--shadow-card)' : 'none', transition: 'all 150ms' }}>
              {ch.icon} {ch.label}
            </button>
          ))}
        </div>

        {/* Subject row */}
        {channel === 'email' && (
          <div style={{ padding: '8px 12px', background: 'var(--bg-hover)', borderRadius: 'var(--radius-sm)' }}>
            <span className="t-label" style={{ marginRight: 8 }}>Subject:</span>
            <span className="t-xs text-secondary">{subject}</span>
          </div>
        )}

        {/* Body */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <label className="t-label">Message</label>
            {userEdited && (
              <button onClick={() => { setBody(defaultBody(channel)); setUserEdited(false); }}
                style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)', transition: 'color 150ms' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent-amber)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; }}>
                <RotateCcw size={11} /> Reset
              </button>
            )}
          </div>
          <textarea value={body} onChange={e => { setBody(e.target.value); setUserEdited(true); }}
            style={{ width: '100%', minHeight: channel === 'email' ? 180 : 100, resize: 'vertical', background: 'var(--bg-input)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: '12px 14px', fontSize: 13, fontFamily: 'var(--font-body)', color: 'var(--text-primary)', outline: 'none', lineHeight: 1.7, boxSizing: 'border-box', transition: 'border-color 150ms, box-shadow 150ms' }}
            onFocus={e => { e.target.style.borderColor = 'var(--accent-blue)'; e.target.style.boxShadow = '0 0 0 3px var(--accent-blue-glow)'; }}
            onBlur={e => { e.target.style.borderColor = 'var(--border-default)'; e.target.style.boxShadow = 'none'; }} />
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => { navigator.clipboard.writeText(channel === 'email' ? `Subject: ${subject}\n\n${body}` : body); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', background: 'var(--bg-elevated)', color: copied ? 'var(--accent-green)' : 'var(--text-secondary)', fontSize: 12, fontFamily: 'var(--font-body)', fontWeight: 500, cursor: 'pointer', transition: 'all 150ms' }}>
            {copied ? <><Check size={13} /> Copied!</> : <><Copy size={13} /> Copy</>}
          </button>
          {((channel === 'email' && client.contact_email) || (channel === 'whatsapp' && client.contact_phone)) && (
            <button onClick={handleOpen}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 'var(--radius-md)', border: 'none', background: channelMeta.color, color: '#fff', fontSize: 12, fontFamily: 'var(--font-body)', fontWeight: 600, cursor: 'pointer', transition: 'opacity 150ms' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '0.88'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}>
              {channelMeta.icon} {channelMeta.action}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}

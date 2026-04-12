'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useBrand } from '@/lib/brand';
import { useCurrentUser } from '@/lib/auth/use-auth';
import { createClient } from '@/lib/supabase/client';
import { PageTransition } from '@/components/dashboard/PageTransition';
import { Button, Modal, Input, Select, Textarea } from '@/components/ui';
import { toast } from '@/components/ui/Toast';
import { formatDate, daysUntil, buildMailtoLink, buildWhatsAppLink } from '@/lib/utils';
import {
  Plus, Shield, Mail, MessageCircle, Copy, Check,
  Pencil, Trash2, Calendar, Clock, RotateCcw,
} from 'lucide-react';
import type { Client, SupportPeriodWithClient } from '@/types';

// ── Helpers ────────────────────────────────────────────────────
function progressPct(start: string, end: string): number {
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  const n = Date.now();
  if (n <= s) return 0;
  if (n >= e) return 100;
  return Math.round(((n - s) / (e - s)) * 100);
}

function totalDays(start: string, end: string): number {
  return Math.ceil((new Date(end).getTime() - new Date(start).getTime()) / 86400000);
}

// ── STATUS HELPERS ─────────────────────────────────────────────
function periodStatus(endDate: string): 'active' | 'ending' | 'ended' {
  const days = daysUntil(endDate);
  if (days < 0) return 'ended';
  if (days <= 7) return 'ending';
  return 'active';
}

const STATUS_META = {
  active:  { color: 'var(--accent-green)',  bg: 'var(--accent-green-dim)',  label: 'Active' },
  ending:  { color: 'var(--accent-amber)',  bg: 'var(--accent-amber-dim)',  label: 'Ending soon' },
  ended:   { color: 'var(--text-tertiary)', bg: 'var(--bg-hover)',          label: 'Ended' },
};

// ── MAIN PAGE ──────────────────────────────────────────────────
export default function PersonalSupportPage() {
  const { mode, brand } = useBrand();
  const { user: currentUser } = useCurrentUser();
  const supabaseRef = useRef(createClient());
  const supabase    = supabaseRef.current;

  const [periods, setPeriods]     = useState<SupportPeriodWithClient[]>([]);
  const [clients, setClients]     = useState<Client[]>([]);
  const [showAdd, setShowAdd]     = useState(false);
  const [editingPeriod, setEditingPeriod] = useState<SupportPeriodWithClient | null>(null);
  const [composingFor, setComposingFor]   = useState<SupportPeriodWithClient | null>(null);

  const loadData = useCallback(async () => {
    if (!currentUser) return;
    const [{ data: sp }, { data: cl }] = await Promise.all([
      supabase.from('support_periods')
        .select('*, clients(name, contact_email, contact_phone)')
        .eq('user_id', currentUser.ownerId).eq('mode', mode)
        .order('end_date', { ascending: true }),
      supabase.from('clients').select('id, name, contact_email, contact_phone')
        .eq('user_id', currentUser.ownerId).eq('mode', mode),
    ]);
    setPeriods(sp || []);
    setClients((cl as Client[]) || []);
  }, [currentUser, mode, supabase]);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleDelete(id: string) {
    const { error: delErr } = await supabase.from('support_periods').delete().eq('id', id);
    if (delErr) { toast.error("Failed to delete support period"); return; }
    setPeriods(prev => prev.filter(p => p.id !== id));
  }

  const active = periods.filter(p => new Date(p.end_date) >= new Date());
  const ended  = periods.filter(p => new Date(p.end_date) < new Date());

  return (
    <PageTransition>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <h1 className="t-h1">Support</h1>
            <p className="t-xs mt-1">Active support periods and closing messages after delivery.</p>
          </div>
          <Button icon={<Plus size={14} />} onClick={() => setShowAdd(true)}>Add Period</Button>
        </div>

        {/* Empty state */}
        {periods.length === 0 && (
          <div className="card" style={{ padding: '48px 24px', textAlign: 'center' }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--accent-green-dim)', color: 'var(--accent-green)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Shield size={20} />
            </div>
            <p className="t-sm-semibold" style={{ marginBottom: 6 }}>No support periods yet</p>
            <p className="t-xs text-tertiary" style={{ marginBottom: 20 }}>Add a support period when you deliver a project to track your post-delivery commitment.</p>
            <Button icon={<Plus size={14} />} onClick={() => setShowAdd(true)}>Add First Period</Button>
          </div>
        )}

        {/* Active + Ending periods */}
        {active.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <p className="t-label">Active</p>
            {active.map(sp => {
              const days   = daysUntil(sp.end_date);
              const status = periodStatus(sp.end_date);
              const meta   = STATUS_META[status];
              const pct    = progressPct(sp.start_date, sp.end_date);
              const total  = totalDays(sp.start_date, sp.end_date);

              return (
                <div key={sp.id} className="card" style={{ padding: '16px 20px' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; }}>

                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                    {/* Icon */}
                    <div style={{ width: 38, height: 38, borderRadius: '50%', background: meta.bg, color: meta.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Shield size={17} />
                    </div>

                    {/* Main info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <p className="t-sm-semibold">{sp.clients?.name}</p>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 100, fontSize: 11, fontWeight: 500, background: meta.bg, color: meta.color }}>
                          <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', flexShrink: 0 }} />
                          {status === 'ending' ? `${days} day${days !== 1 ? 's' : ''} left` : meta.label}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                        <Calendar size={11} style={{ color: 'var(--text-tertiary)' }} />
                        <p className="t-2xs text-tertiary">
                          {formatDate(sp.start_date)} — {formatDate(sp.end_date)}
                          <span style={{ marginLeft: 8 }}>· {total} day period</span>
                        </p>
                      </div>

                      {/* Progress bar */}
                      <div style={{ height: 4, background: 'var(--bg-hover)', borderRadius: 100, overflow: 'hidden', marginBottom: sp.notes ? 10 : 0 }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: meta.color, borderRadius: 100, transition: 'width 0.6s ease-out' }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
                        <span className="t-2xs text-tertiary">{pct}% elapsed</span>
                        <span className="t-2xs" style={{ color: meta.color, fontWeight: 500 }}>{days} day{days !== 1 ? 's' : ''} remaining</span>
                      </div>

                      {/* Notes */}
                      {sp.notes && (
                        <p className="t-xs text-secondary" style={{ marginTop: 10, padding: '8px 12px', background: 'var(--bg-hover)', borderRadius: 'var(--radius-sm)', borderLeft: `3px solid ${meta.color}` }}>
                          {sp.notes}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      <button onClick={() => setComposingFor(sp)}
                        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 'var(--radius-sm)', border: `1px solid ${meta.color}`, background: meta.bg, color: meta.color, fontSize: 11, fontFamily: 'var(--font-body)', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 150ms' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '0.8'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}>
                        <Mail size={11} /> Closing Message
                      </button>
                      <button onClick={() => setEditingPeriod(sp)}
                        style={{ display: 'flex', padding: '6px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)', background: 'transparent', color: 'var(--text-tertiary)', cursor: 'pointer', transition: 'all 150ms' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent-blue)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent-blue)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)'; }}>
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => handleDelete(sp.id)}
                        style={{ display: 'flex', padding: '6px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'transparent', color: 'var(--text-tertiary)', cursor: 'pointer', transition: 'color 150ms' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent-red)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Ended periods */}
        {ended.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <p className="t-label">Ended</p>
            {ended.map(sp => {
              const daysAgo = Math.abs(daysUntil(sp.end_date));
              return (
                <div key={sp.id} className="card" style={{ padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 14, opacity: 0.7, transition: 'opacity 150ms, background 150ms' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '0.7'; (e.currentTarget as HTMLElement).style.background = ''; }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--bg-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Shield size={14} style={{ color: 'var(--text-tertiary)' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p className="t-xs-medium">{sp.clients?.name}</p>
                    <p className="t-2xs text-tertiary">
                      {formatDate(sp.start_date)} — {formatDate(sp.end_date)}
                      <span style={{ marginLeft: 8 }}>· Ended {daysAgo} day{daysAgo !== 1 ? 's' : ''} ago</span>
                    </p>
                    {sp.notes && <p className="t-2xs text-tertiary" style={{ marginTop: 2, fontStyle: 'italic' }}>{sp.notes}</p>}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => setComposingFor(sp)}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 11, fontFamily: 'var(--font-body)', cursor: 'pointer', transition: 'all 150ms', whiteSpace: 'nowrap' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; }}>
                      <Mail size={11} /> Closing Message
                    </button>
                    <button onClick={() => handleDelete(sp.id)}
                      style={{ display: 'flex', padding: '5px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'transparent', color: 'var(--text-tertiary)', cursor: 'pointer', transition: 'color 150ms' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent-red)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Modals */}
        {showAdd && (
          <AddEditModal
            mode={mode} clients={clients} currentUser={currentUser}
            onClose={() => setShowAdd(false)}
            onSaved={sp => { setPeriods(prev => [sp, ...prev].sort((a, b) => a.end_date.localeCompare(b.end_date))); setShowAdd(false); }} />
        )}
        {editingPeriod && (
          <AddEditModal
            mode={mode} clients={clients} currentUser={currentUser}
            existing={editingPeriod}
            onClose={() => setEditingPeriod(null)}
            onSaved={updated => { setPeriods(prev => prev.map(p => p.id === updated.id ? updated : p)); setEditingPeriod(null); }} />
        )}
        {composingFor && (
          <ClosingComposer period={composingFor} brand={brand} onClose={() => setComposingFor(null)} />
        )}
      </div>
    </PageTransition>
  );
}

// ── ADD / EDIT MODAL ──────────────────────────────────────────
function AddEditModal({ mode, clients, currentUser, existing, onClose, onSaved }: {
  mode: string; clients: Client[]; currentUser: any;
  existing?: any; onClose: () => void; onSaved: (sp: any) => void;
}) {
  const supabase = useRef(createClient()).current;
  const isEdit   = !!existing;

  const [clientId, setClientId]   = useState(existing?.client_id || '');
  const [startDate, setStartDate] = useState(existing?.start_date || '');
  const [endDate, setEndDate]     = useState(existing?.end_date || '');
  const [notes, setNotes]         = useState(existing?.notes || '');
  const [saving, setSaving]       = useState(false);

  // Auto-set end date 30 days after start
  function handleStartChange(val: string) {
    setStartDate(val);
    if (!endDate && val) {
      const d = new Date(val);
      d.setDate(d.getDate() + 30);
      setEndDate(d.toISOString().split('T')[0]);
    }
  }

  async function handleSave() {
    if (!clientId || !startDate || !endDate || !currentUser) return;
    setSaving(true);
    const payload = { user_id: currentUser.ownerId, mode, client_id: clientId, start_date: startDate, end_date: endDate, notes: notes || null };

    if (isEdit) {
      const { data } = await supabase.from('support_periods')
        .update({ client_id: clientId, start_date: startDate, end_date: endDate, notes: notes || null, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
        .select('*, clients(name, contact_email, contact_phone)').single();
      if (data) onSaved(data);
    } else {
      const { data } = await supabase.from('support_periods')
        .insert(payload)
        .select('*, clients(name, contact_email, contact_phone)').single();
      if (data) onSaved(data);
    }
    setSaving(false);
  }

  const durationDays = startDate && endDate
    ? Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000)
    : null;

  return (
    <Modal open={true} onClose={onClose} title={isEdit ? 'Edit Support Period' : 'Add Support Period'} size="sm">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Select label="Client" placeholder="Select client..."
          options={clients.map(c => ({ value: c.id, label: c.name }))}
          value={clientId} onChange={e => setClientId(e.target.value)} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Input label="Start Date" type="date" value={startDate} onChange={e => handleStartChange(e.target.value)} />
          <Input label="End Date" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
        </div>
        {durationDays !== null && durationDays > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', background: 'var(--accent-blue-dim)', borderRadius: 'var(--radius-sm)' }}>
            <Clock size={12} style={{ color: 'var(--accent-blue)' }} />
            <span style={{ fontSize: 12, color: 'var(--accent-blue)', fontFamily: 'var(--font-body)' }}>
              {durationDays} day support period
            </span>
          </div>
        )}
        <Textarea label="Notes (Optional)" value={notes} onChange={e => setNotes(e.target.value)}
          placeholder="e.g., Includes bug fixes, no new features" style={{ minHeight: 80 }} />
        <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
          <Button variant="secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</Button>
          <Button onClick={handleSave} loading={saving} disabled={!clientId || !startDate || !endDate} style={{ flex: 1 }}>
            {isEdit ? 'Save Changes' : 'Add Period'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ── CLOSING COMPOSER ──────────────────────────────────────────
function ClosingComposer({ period, brand, onClose }: { period: any; brand: any; onClose: () => void }) {
  const cn       = period.clients?.name || 'there';
  const biz      = brand?.business_name || '[Your Name]';
  const status   = periodStatus(period.end_date);
  const days     = daysUntil(period.end_date);

  const [channel, setChannel] = useState<'email' | 'whatsapp'>('email');
  const [copied, setCopied]   = useState(false);
  const [userEdited, setUserEdited] = useState(false);

  const defaultBody = (ch: 'email' | 'whatsapp') => {
    const isShort = ch === 'whatsapp';
    if (isShort) {
      return `Hey ${cn}! ${status === 'ended' ? 'Your support period has ended' : 'Your support period is coming to a close'} — it's been a pleasure working together! 🙏 If you ever need anything in the future, you know where to find me. Would love to hear your feedback too!`;
    }
    return `Hi ${cn},\n\nI wanted to reach out as your support period ${status === 'ended' ? 'has now ended' : 'is coming to an end'}. It's been a genuine pleasure working with you on this project.\n\nDuring the support period, I've been available for any questions, fixes, and guidance — I hope the experience has been smooth.\n\nThank you for trusting ${biz} with your project. If you ever need anything in the future — whether it's new features, updates, or a brand new project — please don't hesitate to reach out.\n\nI'd also love to hear your feedback on the overall experience. Even a few words would mean a lot.\n\nWishing you all the best,\n${biz}`;
  };

  const [body, setBody] = useState(() => defaultBody('email'));
  const subject = `Thank you — ${cn} support period wrap-up`;

  function handleChannelChange(ch: 'email' | 'whatsapp') {
    setChannel(ch);
    if (!userEdited) setBody(defaultBody(ch));
  }

  function handleCopy() {
    navigator.clipboard.writeText(channel === 'email' ? `Subject: ${subject}\n\n${body}` : body);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleOpen() {
    if (channel === 'email') {
      window.open(buildMailtoLink(period.clients?.contact_email || '', subject, body), '_blank');
    } else {
      window.open(buildWhatsAppLink(period.clients?.contact_phone || '', body), '_blank');
    }
  }

  const channelMeta = {
    email:    { color: 'var(--accent-blue)',  action: 'Open in Mail',   icon: <Mail size={13} /> },
    whatsapp: { color: 'var(--accent-green)', action: 'Open WhatsApp',  icon: <MessageCircle size={13} /> },
  }[channel];

  return (
    <Modal open={true} onClose={onClose} title="Closing Message" description={`For ${cn}`} size="md">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Context banner */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: status === 'ended' ? 'var(--bg-hover)' : 'var(--accent-amber-dim)', borderRadius: 'var(--radius-sm)' }}>
          <Clock size={12} style={{ color: status === 'ended' ? 'var(--text-tertiary)' : 'var(--accent-amber)', flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: status === 'ended' ? 'var(--text-secondary)' : 'var(--accent-amber)', fontFamily: 'var(--font-body)' }}>
            {status === 'ended'
              ? `Support period ended ${Math.abs(days)} day${Math.abs(days) !== 1 ? 's' : ''} ago`
              : `${days} day${days !== 1 ? 's' : ''} remaining in support period`}
          </span>
        </div>

        {/* Channel toggle */}
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

        {/* Subject — email only */}
        {channel === 'email' && (
          <div style={{ padding: '8px 12px', background: 'var(--bg-hover)', borderRadius: 'var(--radius-sm)' }}>
            <span className="t-label" style={{ marginRight: 8 }}>Subject:</span>
            <span className="t-xs text-secondary">{subject}</span>
          </div>
        )}

        {/* Body editor */}
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
          <textarea value={body}
            onChange={e => { setBody(e.target.value); setUserEdited(true); }}
            style={{ width: '100%', minHeight: channel === 'email' ? 220 : 120, resize: 'vertical', background: 'var(--bg-input)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: '12px 14px', fontSize: 13, fontFamily: 'var(--font-body)', color: 'var(--text-primary)', outline: 'none', lineHeight: 1.7, boxSizing: 'border-box', transition: 'border-color 150ms, box-shadow 150ms' }}
            onFocus={e => { e.target.style.borderColor = 'var(--accent-blue)'; e.target.style.boxShadow = '0 0 0 3px var(--accent-blue-glow)'; }}
            onBlur={e => { e.target.style.borderColor = 'var(--border-default)'; e.target.style.boxShadow = 'none'; }} />
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleCopy}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', background: 'var(--bg-elevated)', color: copied ? 'var(--accent-green)' : 'var(--text-secondary)', fontSize: 12, fontFamily: 'var(--font-body)', fontWeight: 500, cursor: 'pointer', transition: 'all 150ms' }}>
            {copied ? <><Check size={13} /> Copied!</> : <><Copy size={13} /> Copy</>}
          </button>
          {((channel === 'email' && period.clients?.contact_email) ||
            (channel === 'whatsapp' && period.clients?.contact_phone)) && (
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

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useBrand } from '@/lib/brand';
import { useCurrentUser } from '@/lib/auth/use-auth';
import { createClient } from '@/lib/supabase/client';
import { PageTransition } from '@/components/dashboard/PageTransition';
import { Button, Input, Modal, Select, Textarea } from '@/components/ui';
import { toast } from '@/components/ui/Toast';
import { formatDate, generateShareToken, generateAccessCode } from '@/lib/utils';
import {
  Plus, FileText, Link2, Pencil, Trash2,
  Send, Check, ExternalLink, Copy, Pen, ArrowRight,
  AlertCircle, X,
} from 'lucide-react';
import type { Client } from '@/types';

type DocType = 'proposal' | 'contract' | 'sow' | 'requirements' | 'invoice' | 'delivery';

const DOC_TYPES: { value: DocType; label: string; description: string }[] = [
  { value: 'proposal',     label: 'Proposal',         description: 'Project overview, scope, and pricing' },
  { value: 'contract',     label: 'Contract',         description: 'Legal agreement with payment terms' },
  { value: 'sow',          label: 'Scope of Work',    description: 'Detailed deliverables and milestones' },
  { value: 'requirements', label: 'Requirements',     description: 'Client requirements document' },
  { value: 'invoice',      label: 'Invoice',          description: 'Payment request with line items' },
  { value: 'delivery',     label: 'Delivery',         description: 'Project handover document' },
];

// Status options per document type — only show relevant statuses
const STATUS_OPTIONS: Record<DocType, { value: string; label: string }[]> = {
  proposal:     [{ value: 'draft', label: 'Draft' }, { value: 'final', label: 'Final' }, { value: 'sent', label: 'Sent' }, { value: 'viewed', label: 'Viewed' }, { value: 'signed', label: 'Accepted' }],
  contract:     [{ value: 'draft', label: 'Draft' }, { value: 'final', label: 'Final' }, { value: 'sent', label: 'Sent' }, { value: 'viewed', label: 'Viewed' }, { value: 'signed', label: 'Signed' }],
  sow:          [{ value: 'draft', label: 'Draft' }, { value: 'final', label: 'Final' }, { value: 'sent', label: 'Sent' }, { value: 'signed', label: 'Approved' }],
  requirements: [{ value: 'draft', label: 'Draft' }, { value: 'sent', label: 'Sent' }, { value: 'signed', label: 'Completed' }],
  invoice:      [{ value: 'draft', label: 'Draft' }, { value: 'sent', label: 'Sent' }, { value: 'viewed', label: 'Viewed' }, { value: 'paid', label: 'Paid' }],
  delivery:     [{ value: 'draft', label: 'Draft' }, { value: 'final', label: 'Final' }, { value: 'sent', label: 'Sent' }, { value: 'signed', label: 'Accepted' }],
};

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  draft:  { color: 'var(--text-tertiary)',  label: 'Draft'    },
  final:  { color: 'var(--accent-blue)',    label: 'Final'    },
  sent:   { color: 'var(--accent-amber)',   label: 'Sent'     },
  viewed: { color: 'var(--accent-violet)',  label: 'Viewed'   },
  signed: { color: 'var(--accent-green)',   label: 'Signed'   },
  paid:   { color: 'var(--accent-green)',   label: 'Paid'     },
};

// Per-type status labels override defaults
const STATUS_LABELS: Record<string, Partial<Record<string, string>>> = {
  proposal:     { signed: 'Accepted' },
  sow:          { signed: 'Approved' },
  requirements: { signed: 'Completed' },
  delivery:     { signed: 'Accepted' },
};

function getStatusLabel(type: DocType, status: string): string {
  return STATUS_LABELS[type]?.[status] ?? STATUS_CONFIG[status]?.label ?? status;
}

function StatusPill({ status, docType }: { status: string; docType?: DocType }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
  const label = docType ? getStatusLabel(docType, status) : cfg.label;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 100, fontSize: 11, fontWeight: 500, background: `${cfg.color}1A`, color: cfg.color }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', flexShrink: 0 }} />
      {label}
    </span>
  );
}

function DocTypePill({ type }: { type: DocType }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 100, fontSize: 10, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.04em', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}>
      {DOC_TYPES.find(d => d.value === type)?.label || type}
    </span>
  );
}

export default function PersonalPaperworkPage() {
  const { mode } = useBrand();
  const { user: currentUser } = useCurrentUser();
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;

  const [activeType, setActiveType]   = useState<DocType | 'all'>('all');
  const [documents, setDocuments]     = useState<any[]>([]);
  const [clients, setClients]         = useState<Client[]>([]);
  const [loading, setLoading]         = useState(true);
  const [showCreate, setShowCreate]   = useState(false);
  const [editingDoc, setEditingDoc]   = useState<any | null>(null);
  const [sendingDoc, setSendingDoc]   = useState<any | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [search, setSearch]           = useState('');
  const [page, setPage]               = useState(0);
  const PAGE_SIZE = 20;

  const loadData = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    let query = supabase.from('documents')
      .select('*, clients(name, company)')
      .eq('user_id', currentUser.ownerId).eq('mode', mode)
      .order('updated_at', { ascending: false });
    if (activeType !== 'all') query = query.eq('type', activeType);
    const [{ data: docs }, { data: cl }] = await Promise.all([
      query,
      supabase.from('clients').select('id, name, company').eq('user_id', currentUser.ownerId).eq('mode', mode),
    ]);
    setDocuments(docs || []);
    setClients((cl as Client[]) || []);
    setLoading(false);
  }, [currentUser, mode, activeType, supabase]);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleDelete(docId: string) {
    const { error } = await supabase.from('documents').delete().eq('id', docId);
    if (error) { toast.error('Failed to delete document'); return; }
    setDocuments(prev => prev.filter(d => d.id !== docId));
    setConfirmDelete(null);
    toast.success('Document deleted');
  }

  // Duplicate a proposal as a contract, pre-filling matching fields
  async function handleDuplicateAsContract(doc: any) {
    if (!currentUser) return;
    const proposalFields = doc.fields as Record<string, any>;
    const contractFields = {
      project_description: proposalFields.overview || '',
      payment_schedule: proposalFields.payment_terms
        ? [{ trigger: 'As per proposal', amount: proposalFields.investment_amount || 0 }]
        : [],
      parties: { client: doc.clients?.name || '', freelancer: '' },
      revision_policy: '',
      ip_clause: '',
      confidentiality_clause: '',
      governing_law: 'India',
      termination_clause: '',
    };
    const { data } = await supabase.from('documents')
      .insert({
        user_id: currentUser.ownerId, mode,
        type: 'contract',
        title: doc.title.replace(/^Proposal/i, 'Contract'),
        client_id: doc.client_id || null,
        fields: contractFields,
        status: 'draft',
      }).select('*, clients(name, company)').single();
    if (data) {
      setDocuments(prev => [data, ...prev]);
      setEditingDoc(data);
      toast.success('Contract created from proposal');
    }
  }

  return (
    <PageTransition>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <h1 className="t-h1">Paperwork</h1>
            <p className="t-xs mt-1" style={{ color: 'var(--text-secondary)' }}>Create and manage branded documents.</p>
          </div>
          <Button icon={<Plus size={14} />} onClick={() => setShowCreate(true)}>New Document</Button>
        </div>

        {/* Type filter */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', gap: 0 }}>
          {[{ value: 'all', label: 'All' }, ...DOC_TYPES].map(tab => (
            <button key={tab.value} onClick={() => setActiveType(tab.value as any)}
              style={{ padding: '8px 16px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500, fontFamily: 'var(--font-body)', color: activeType === tab.value ? 'var(--text-primary)' : 'var(--text-tertiary)', borderBottom: `2px solid ${activeType === tab.value ? 'var(--accent-blue)' : 'transparent'}`, marginBottom: -1, transition: 'color 150ms, border-color 150ms' }}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div style={{ position: 'relative', maxWidth: 320 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none' }}>
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(0); }}
            placeholder="Search by title or client..."
            style={{ width: '100%', padding: '7px 10px 7px 30px', background: 'var(--bg-hover)', border: '1px solid transparent', borderRadius: 'var(--radius-md)', fontSize: 12, fontFamily: 'var(--font-body)', color: 'var(--text-primary)', outline: 'none', transition: 'border-color 150ms', boxSizing: 'border-box' as const }}
            onFocus={e => { e.target.style.borderColor = 'var(--border-default)'; }}
            onBlur={e => { e.target.style.borderColor = 'transparent'; }} />
        </div>

        {/* Document list */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[1,2,3].map(i => <div key={i} className="card" style={{ height: 68, background: 'var(--bg-hover)', animation: 'ds-pulse 1.5s ease-in-out infinite' }} />)}
          </div>
        ) : (() => {
          const q = search.toLowerCase();
          const filtered = documents.filter(d =>
            (!q || d.title?.toLowerCase().includes(q) || d.clients?.name?.toLowerCase().includes(q) || d.clients?.company?.toLowerCase().includes(q))
          );
          const paginated = filtered.slice(0, (page + 1) * PAGE_SIZE);
          const hasMore = filtered.length > paginated.length;

          if (filtered.length === 0) return (
            <div className="card" style={{ padding: '48px 24px', textAlign: 'center' }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--accent-blue-dim)', color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <FileText size={20} />
              </div>
              {search ? (
                <p className="t-xs text-secondary">No documents match &ldquo;{search}&rdquo;</p>
              ) : (
                <>
                  <p className="t-sm-semibold" style={{ marginBottom: 6 }}>No documents yet</p>
                  <p className="t-xs text-secondary" style={{ marginBottom: 18 }}>Create your first proposal, contract, or invoice.</p>
                  <Button icon={<Plus size={14} />} onClick={() => setShowCreate(true)}>Create Document</Button>
                </>
              )}
            </div>
          );
          return (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {paginated.map(doc => {
              const isProposalAccepted = doc.type === 'proposal' && (doc.status === 'signed' || doc.status === 'viewed');
              return (
                <div key={doc.id} className="card"
                  style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, transition: 'background 150ms' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; }}>

                  {/* Icon */}
                  <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'var(--accent-blue-dim)', color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <FileText size={16} />
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <span className="t-sm-semibold" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {doc.title || 'Untitled'}
                      </span>
                      <DocTypePill type={doc.type} />
                      <StatusPill status={doc.status} docType={doc.type} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <p className="t-2xs text-tertiary">
                        {doc.clients?.name && `${doc.clients.name} · `}
                        Updated {formatDate(doc.updated_at)}
                        {doc.signed_at && ` · ${doc.type === 'proposal' ? 'Accepted' : 'Signed'} by ${doc.signer_name}`}
                      </p>
                      {/* "Create Contract" shortcut on accepted proposals */}
                      {isProposalAccepted && (
                        <button onClick={() => handleDuplicateAsContract(doc)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 100, fontSize: 10, fontWeight: 600, border: '1px solid var(--accent-violet)', background: 'var(--accent-violet-dim)', color: 'var(--accent-violet)', cursor: 'pointer', fontFamily: 'var(--font-body)', transition: 'all 150ms' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--accent-violet)'; (e.currentTarget as HTMLElement).style.color = '#fff'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--accent-violet-dim)'; (e.currentTarget as HTMLElement).style.color = 'var(--accent-violet)'; }}>
                          <ArrowRight size={9} /> Create Contract
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                    <button onClick={() => setEditingDoc(doc)} title="Edit"
                      style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 11, fontFamily: 'var(--font-body)', cursor: 'pointer', transition: 'all 150ms' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent-blue)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent-blue)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)'; }}>
                      <Pencil size={12} /> Edit
                    </button>

                    {doc.share_token && (
                      <button onClick={() => window.open(`/doc/${doc.share_token}`, '_blank')} title="Preview"
                        style={{ display: 'flex', padding: '5px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', transition: 'all 150ms' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; }}>
                        <ExternalLink size={13} />
                      </button>
                    )}

                    <button onClick={() => setSendingDoc(doc)}
                      style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 'var(--radius-sm)', fontSize: 11, fontFamily: 'var(--font-body)', cursor: 'pointer', transition: 'all 150ms', border: doc.share_token ? '1px solid var(--border-default)' : '1px solid var(--accent-blue)', background: doc.share_token ? 'transparent' : 'var(--accent-blue-dim)', color: doc.share_token ? 'var(--text-secondary)' : 'var(--accent-blue)' }}
                      onMouseEnter={e => { const el = e.currentTarget as HTMLElement; if (doc.share_token) { el.style.color = 'var(--text-primary)'; } else { el.style.background = 'var(--accent-blue)'; el.style.color = '#fff'; } }}
                      onMouseLeave={e => { const el = e.currentTarget as HTMLElement; if (doc.share_token) { el.style.color = 'var(--text-secondary)'; } else { el.style.background = 'var(--accent-blue-dim)'; el.style.color = 'var(--accent-blue)'; } }}>
                      {doc.share_token ? <><Link2 size={11} /> Manage</> : <><Send size={11} /> Send</>}
                    </button>

                    {/* Delete with confirmation */}
                    {confirmDelete === doc.id ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span className="t-2xs text-secondary">Delete?</span>
                        <button onClick={() => handleDelete(doc.id)}
                          style={{ padding: '4px 9px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--accent-red)', color: '#fff', fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-body)', cursor: 'pointer' }}>
                          Yes
                        </button>
                        <button onClick={() => setConfirmDelete(null)}
                          style={{ padding: '4px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 11, fontFamily: 'var(--font-body)', cursor: 'pointer' }}>
                          No
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmDelete(doc.id)} title="Delete"
                        style={{ display: 'flex', padding: '5px 7px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'transparent', color: 'var(--text-tertiary)', cursor: 'pointer', transition: 'color 150ms' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent-red)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; }}>
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              );
                })}
              </div>
              {hasMore && (
                <button onClick={() => setPage(p => p + 1)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 12, fontFamily: 'var(--font-body)', cursor: 'pointer', transition: 'all 150ms', width: '100%' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-strong)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; }}>
                  Load more ({filtered.length - paginated.length} remaining)
                </button>
              )}
              {filtered.length > 0 && (
                <p className="t-2xs text-tertiary" style={{ textAlign: 'center' }}>Showing {paginated.length} of {filtered.length}</p>
              )}
            </>
          );
        })()
      }
      </div>

      <CreateDocumentModal open={showCreate} onClose={() => setShowCreate(false)}
        mode={mode} clients={clients} currentUser={currentUser}
        onCreated={doc => { setDocuments(prev => [doc, ...prev]); setShowCreate(false); setEditingDoc(doc); }} />

      {sendingDoc && (
        <SendDocumentDialog doc={sendingDoc} onClose={() => setSendingDoc(null)}
          onSent={updated => { setDocuments(prev => prev.map(d => d.id === updated.id ? updated : d)); setSendingDoc(updated); }} />
      )}

      {editingDoc && (
        <DocumentEditorModal doc={editingDoc} clients={clients}
          onClose={() => setEditingDoc(null)}
          onSend={doc => { setEditingDoc(null); setSendingDoc(doc); }}
          onDuplicateAsContract={handleDuplicateAsContract}
          onSaved={updated => { setDocuments(prev => prev.map(d => d.id === updated.id ? updated : d)); setEditingDoc(updated); }} />
      )}
    </PageTransition>
  );
}

// ─── CREATE MODAL ─────────────────────────────────────────────
function CreateDocumentModal({ open, onClose, mode, clients, currentUser, onCreated }: {
  open: boolean; onClose: () => void; mode: string;
  clients: Client[]; currentUser: any; onCreated: (doc: any) => void;
}) {
  const supabase = useRef(createClient()).current;
  const [docType, setDocType]   = useState<DocType>('proposal');
  const [title, setTitle]       = useState('');
  const [clientId, setClientId] = useState('');
  const [saving, setSaving]     = useState(false);

  useEffect(() => { if (!open) { setTitle(''); setClientId(''); setDocType('proposal'); } }, [open]);

  async function handleCreate() {
    if (!currentUser || !title.trim()) return;
    setSaving(true);
    const { data } = await supabase.from('documents')
      .insert({ user_id: currentUser.ownerId, mode, type: docType, title: title.trim(), client_id: clientId || null, fields: {}, status: 'draft' })
      .select('*, clients(name, company)').single();
    if (data) onCreated(data);
    setSaving(false);
  }

  const selected = DOC_TYPES.find(d => d.value === docType);

  return (
    <Modal open={open} onClose={onClose} title="New Document" size="sm">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label className="t-label" style={{ display: 'block', marginBottom: 8 }}>Document Type</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {DOC_TYPES.map(dt => (
              <button key={dt.value} type="button" onClick={() => setDocType(dt.value)}
                style={{ padding: '10px 12px', borderRadius: 'var(--radius-md)', border: `1px solid ${docType === dt.value ? 'var(--accent-blue)' : 'var(--border-default)'}`, background: docType === dt.value ? 'var(--accent-blue-dim)' : 'transparent', cursor: 'pointer', textAlign: 'left' as const, transition: 'all 150ms' }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: docType === dt.value ? 'var(--accent-blue)' : 'var(--text-primary)', fontFamily: 'var(--font-body)', margin: 0 }}>{dt.label}</p>
                <p style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-body)', marginTop: 2, marginBottom: 0 }}>{dt.description}</p>
              </button>
            ))}
          </div>
        </div>
        <Input label="Title *" value={title} onChange={e => setTitle(e.target.value)}
          placeholder={`e.g., ${selected?.label} for Client Name`} autoFocus />
        <Select label="Client (Optional)" placeholder="Select client..."
          options={[{ value: '', label: 'No client' }, ...clients.map(c => ({ value: c.id, label: c.name }))]}
          value={clientId} onChange={e => setClientId(e.target.value)} />
        <div style={{ display: 'flex', gap: 10, paddingTop: 8 }}>
          <Button variant="secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</Button>
          <Button onClick={handleCreate} loading={saving} disabled={!title.trim()} style={{ flex: 1 }}>
            Create & Edit
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── DOCUMENT EDITOR MODAL ────────────────────────────────────
function DocumentEditorModal({ doc, clients, onClose, onSend, onDuplicateAsContract, onSaved }: {
  doc: any; clients: Client[];
  onClose: () => void;
  onSend: (doc: any) => void;
  onDuplicateAsContract: (doc: any) => void;
  onSaved: (doc: any) => void;
}) {
  const supabase       = useRef(createClient()).current;
  const autoSaveTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestFields   = useRef<Record<string, any>>(doc.fields || {});
  const latestTitle    = useRef<string>(doc.title || '');
  const latestClientId = useRef<string>(doc.client_id || '');
  const latestStatus   = useRef<string>(doc.status || 'draft');

  const [fields, setFields]       = useState<Record<string, any>>(doc.fields || {});
  const [title, setTitle]         = useState(doc.title || '');
  const [clientId, setClientId]   = useState(doc.client_id || '');
  const [status, setStatus]       = useState(doc.status || 'draft');
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);
  const [autoSaved, setAutoSaved] = useState(false);
  // Track edit_count in a ref so it stays current across multiple saves in one session.
  // We only count edits AFTER the document has been sent (share_token exists).
  // Pre-send saves are just drafting — not meaningful revisions the client would see.
  const editCountRef = useRef<number>(doc.edit_count || 0);

  useEffect(() => { latestFields.current   = fields;   }, [fields]);
  useEffect(() => { latestTitle.current    = title;    }, [title]);
  useEffect(() => { latestClientId.current = clientId; }, [clientId]);
  useEffect(() => { latestStatus.current   = status;   }, [status]);
  useEffect(() => () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); }, []);

  function scheduleAutoSave() {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(async () => {
      const { data } = await supabase.from('documents')
        .update({ title: latestTitle.current.trim(), client_id: latestClientId.current || null, fields: latestFields.current, status: latestStatus.current, updated_at: new Date().toISOString() })
        .eq('id', doc.id).select('*, clients(name, company)').single();
      if (data) { onSaved(data); setAutoSaved(true); setTimeout(() => setAutoSaved(false), 2000); }
      // Note: auto-save does NOT increment edit_count — only explicit Save does
    }, 2000);
  }

  function setField(key: string, value: any) {
    if (key === '__invoice_batch') {
      // Invoice recalculate writes multiple related fields atomically
      setFields(prev => ({ ...prev, ...value }));
    } else {
      setFields(prev => ({ ...prev, [key]: value }));
    }
    scheduleAutoSave();
  }

  async function handleSave() {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    setSaving(true);
    const now = new Date().toISOString();
    // Only count as an edit revision if the document has already been sent to a client.
    // Pre-send saves (drafting) do not count — they're not edits from the client's perspective.
    const isSent = !!doc.share_token;
    const newEditCount = isSent ? editCountRef.current + 1 : editCountRef.current;
    const updatePayload: Record<string, unknown> = {
      title: title.trim(), client_id: clientId || null, fields, status,
      updated_at: now,
      edit_count: newEditCount,
      ...(isSent ? { last_edited_at: now } : {}),
    };
    const { data, error } = await supabase.from('documents')
      .update(updatePayload)
      .eq('id', doc.id).select('*, clients(name, company)').single();
    if (error) { toast.error('Failed to save document'); setSaving(false); return; }
    if (data) {
      // Update the ref so subsequent saves in this session use the new count
      editCountRef.current = newEditCount;
      onSaved(data);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
    setSaving(false);
  }

  const typeLabel = DOC_TYPES.find(d => d.value === doc.type)?.label || 'Document';
  const isProposal = doc.type === 'proposal';
  const isProposalAccepted = isProposal && (doc.status === 'signed' || doc.status === 'viewed');
  const statusOptions = STATUS_OPTIONS[doc.type as DocType] || STATUS_OPTIONS.proposal;

  return (
    <Modal open={true} onClose={onClose}
      title={`Edit ${typeLabel}`}
      description={doc.clients?.name || undefined}
      size="xl">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Meta row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <Input label="Title" value={title}
            onChange={e => { setTitle(e.target.value); scheduleAutoSave(); }} />
          <Select label="Client"
            options={[{ value: '', label: 'No client' }, ...clients.map(c => ({ value: c.id, label: c.name }))]}
            value={clientId}
            onChange={e => { setClientId(e.target.value); scheduleAutoSave(); }} />
          <Select label="Status" value={status}
            options={statusOptions}
            onChange={e => { setStatus(e.target.value); scheduleAutoSave(); }} />
        </div>

        <div style={{ height: 1, background: 'var(--border-subtle)' }} />

        {/* Type-specific editor */}
        {doc.type === 'proposal'     && <ProposalEditor     fields={fields} setField={setField} />}
        {doc.type === 'contract'     && <ContractEditor     fields={fields} setField={setField} />}
        {doc.type === 'sow'          && <SOWEditor          fields={fields} setField={setField} />}
        {doc.type === 'requirements' && <RequirementsEditor fields={fields} setField={setField} />}
        {doc.type === 'invoice'      && <InvoiceEditor      fields={fields} setField={setField} />}
        {doc.type === 'delivery'     && <DeliveryEditor     fields={fields} setField={setField} />}

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid var(--border-subtle)', gap: 10 }}>

          {/* Left: secondary actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {doc.share_token && (
              <button onClick={() => window.open(`/doc/${doc.share_token}`, '_blank')}
                style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--accent-blue)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)', padding: 0 }}>
                <ExternalLink size={13} /> Preview
              </button>
            )}
            {isProposalAccepted && (
              <button onClick={() => { onDuplicateAsContract(doc); onClose(); }}
                style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--accent-violet)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)', padding: 0 }}>
                <ArrowRight size={13} /> Create Contract
              </button>
            )}
            {autoSaved && !saving && (
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-body)' }}>Auto-saved</span>
            )}
          </div>

          {/* Right: primary actions */}
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="secondary" onClick={onClose}>Close</Button>
            {/* Send button in editor — proposal/contract/invoice only */}
            {['proposal', 'contract', 'invoice', 'sow', 'requirements', 'delivery'].includes(doc.type) && (
              <Button variant="secondary" icon={<Send size={13} />}
                onClick={async () => { await handleSave(); onSend({ ...doc, title, client_id: clientId, fields, status }); }}>
                {doc.share_token ? 'Manage Send' : 'Send'}
              </Button>
            )}
            <Button onClick={handleSave} loading={saving} icon={saved ? <Check size={13} /> : undefined}>
              {saved ? 'Saved!' : 'Save'}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ─── EDITOR HELPERS ───────────────────────────────────────────
function EditorSection({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: 6 }}>
        <p className="t-label" style={{ color: 'var(--text-secondary)' }}>{title}</p>
        {hint && <p style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-body)', marginTop: 3 }}>{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function ListEditor({ label, items, onChange, placeholder }: {
  label: string; items: string[]; onChange: (v: string[]) => void; placeholder: string;
}) {
  const [draft, setDraft] = useState('');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label className="t-label">{label}</label>
      {items.map((item, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ flex: 1, padding: '7px 12px', background: 'var(--bg-hover)', borderRadius: 'var(--radius-sm)', fontSize: 12, color: 'var(--text-primary)', fontFamily: 'var(--font-body)' }}>{item}</div>
          <button onClick={() => onChange(items.filter((_, idx) => idx !== i))}
            style={{ display: 'flex', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', transition: 'color 150ms' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent-red)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; }}>
            <Trash2 size={13} />
          </button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 6 }}>
        <input value={draft} onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && draft.trim()) { onChange([...items, draft.trim()]); setDraft(''); } }}
          placeholder={placeholder}
          style={{ flex: 1, background: 'var(--bg-input)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', padding: '7px 10px', fontSize: 12, fontFamily: 'var(--font-body)', color: 'var(--text-primary)', outline: 'none', transition: 'border-color 150ms' }}
          onFocus={e => { e.target.style.borderColor = 'var(--accent-blue)'; }}
          onBlur={e => { e.target.style.borderColor = 'var(--border-default)'; }} />
        <button onClick={() => { if (draft.trim()) { onChange([...items, draft.trim()]); setDraft(''); } }}
          style={{ padding: '7px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)', background: 'transparent', fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
          + Add
        </button>
      </div>
    </div>
  );
}

// ─── SENDER SIGNATURE FIELD ───────────────────────────────────
// Used in Contract and Delivery editors — the sender signs these.
// Proposals are NOT signed by the sender; they're accepted by the client.
function SenderSignatureField({ value, onChange }: {
  value: { type: string; data: string; date: string; name: string } | null;
  onChange: (v: { type: string; data: string; date: string; name: string } | null) => void;
}) {
  const [open, setOpen]         = useState(false);
  const [tab, setTab]           = useState<'typed' | 'drawn'>('typed');
  const [name, setName]         = useState(value?.type === 'typed' ? value.data : '');
  const [date, setDate]         = useState(value?.date || new Date().toISOString().split('T')[0]);
  const canvasRef               = useRef<HTMLCanvasElement>(null);
  const drawing                 = useRef(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  function startDraw(e: React.MouseEvent<HTMLCanvasElement>) {
    drawing.current = true;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    // Scale mouse position from CSS pixels to canvas internal resolution
    const scaleX = canvas.width  / rect.width;
    const scaleY = canvas.height / rect.height;
    ctx.beginPath();
    ctx.moveTo((e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY);
  }
  function draw(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!drawing.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width  / rect.width;
    const scaleY = canvas.height / rect.height;
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#1a1a2e'; // fixed dark colour — visible on any background
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineTo((e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY);
    ctx.stroke();
    setHasDrawn(true);
  }
  function clearCanvas() {
    canvasRef.current?.getContext('2d')?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    setHasDrawn(false);
  }
  function handleSave() {
    if (tab === 'typed' && !name.trim()) return;
    if (tab === 'drawn' && !hasDrawn) return;
    const data = tab === 'drawn' ? (canvasRef.current?.toDataURL('image/png') || '') : name.trim();
    onChange({ type: tab, data, date, name: tab === 'typed' ? name.trim() : '(drawn)' });
    setOpen(false);
  }
  const canSave = (tab === 'typed' && name.trim().length > 1) || (tab === 'drawn' && hasDrawn);

  if (value) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <label className="t-label">Sender Signature</label>
        <div style={{ padding: '14px 16px', background: 'var(--bg-hover)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
          <div>
            {value.type === 'drawn'
              ? <img src={value.data} alt="Signature" style={{ maxHeight: 48, maxWidth: 200 }} />
              : <span style={{ fontSize: 18, fontFamily: 'var(--font-display)', fontWeight: 800, color: 'var(--text-primary)' }}>{value.data}</span>}
            <p className="t-2xs text-tertiary" style={{ marginTop: 4 }}>{value.date}</p>
          </div>
          <button onClick={() => onChange(null)}
            style={{ fontSize: 11, color: 'var(--accent-red)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
            Remove
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <label className="t-label">Sender Signature</label>
      {!open ? (
        <button onClick={() => setOpen(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-default)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 12, fontFamily: 'var(--font-body)', cursor: 'pointer', transition: 'all 150ms', width: 'fit-content' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent-blue)'; (e.currentTarget as HTMLElement).style.color = 'var(--accent-blue)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; }}>
          <Pen size={13} /> Add your signature
        </button>
      ) : (
        <div style={{ padding: '14px 16px', background: 'var(--bg-hover)', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', padding: 2, gap: 2, width: 'fit-content' }}>
            {(['typed', 'drawn'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                style={{ padding: '5px 14px', borderRadius: 'calc(var(--radius-sm) - 2px)', border: 'none', background: tab === t ? 'var(--bg-elevated)' : 'transparent', color: tab === t ? 'var(--text-primary)' : 'var(--text-tertiary)', fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-body)', cursor: 'pointer', boxShadow: tab === t ? 'var(--shadow-card)' : 'none', transition: 'all 150ms', textTransform: 'capitalize' as const }}>
                {t}
              </button>
            ))}
          </div>
          {tab === 'typed' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Type your full name"
                style={{ background: 'var(--bg-input)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', fontSize: 13, fontFamily: 'var(--font-body)', color: 'var(--text-primary)', outline: 'none', transition: 'border-color 150ms' }}
                onFocus={e => { e.target.style.borderColor = 'var(--accent-blue)'; }}
                onBlur={e => { e.target.style.borderColor = 'var(--border-default)'; }} />
              {name.trim().length > 1 && (
                <div style={{ padding: '10px 14px', background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', borderBottom: '2px solid var(--accent-blue)' }}>
                  <span style={{ fontSize: 18, fontFamily: 'var(--font-display)', fontWeight: 800, color: 'var(--text-primary)' }}>{name}</span>
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={clearCanvas} style={{ fontSize: 11, color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>Clear</button>
              </div>
              <canvas ref={canvasRef} width={400} height={90}
                style={{ width: '100%', height: 90, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)', background: '#ffffff', cursor: 'crosshair', display: 'block', borderBottom: '2px solid var(--accent-blue)' }}
                onMouseDown={startDraw} onMouseMove={draw}
                onMouseUp={() => { drawing.current = false; }}
                onMouseLeave={() => { drawing.current = false; }} />
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)', fontSize: 12, fontFamily: 'var(--font-body)', color: 'var(--text-primary)', background: 'var(--bg-input)', outline: 'none' }}
              onFocus={e => { e.target.style.borderColor = 'var(--accent-blue)'; }}
              onBlur={e => { e.target.style.borderColor = 'var(--border-default)'; }} />
            <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
              <Button variant="secondary" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
              <Button size="sm" onClick={handleSave} disabled={!canSave}>Save Signature</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── PROPOSAL EDITOR ──────────────────────────────────────────
// Section-based flexible editor. Sections can be added and removed.
// No sender signature — proposals are one-way selling documents.
// Contracts and Delivery docs get sender signatures.

type ProposalSectionType =
  | 'overview' | 'scope' | 'deliverables' | 'timeline' | 'investment'
  | 'process' | 'whyus' | 'terms' | 'portfolio' | 'custom';

const ADDABLE_SECTIONS: { type: ProposalSectionType; label: string; description: string }[] = [
  { type: 'overview',    label: 'Overview',         description: 'Project summary and goals' },
  { type: 'scope',       label: 'Scope',             description: "What's included and excluded" },
  { type: 'deliverables',label: 'Deliverables',      description: "Specific items you'll deliver" },
  { type: 'timeline',    label: 'Timeline',          description: 'Project schedule' },
  { type: 'investment',  label: 'Investment',        description: 'Pricing and payment terms' },
  { type: 'process',     label: 'Our Process',       description: 'How you work' },
  { type: 'whyus',       label: 'Why Us',            description: 'Your differentiators' },
  { type: 'terms',       label: 'Terms',             description: 'Validity, revisions, IP' },
  { type: 'portfolio',   label: 'Relevant Work',     description: 'Portfolio reference' },
  { type: 'custom',      label: 'Custom Section',    description: 'Any other content' },
];

const DEFAULT_SECTIONS: ProposalSectionType[] = ['overview', 'scope', 'timeline', 'investment'];

function ProposalEditor({ fields, setField }: { fields: any; setField: (k: string, v: any) => void }) {
  // Track which sections are active — stored in fields.active_sections
  const activeSections: ProposalSectionType[] = fields.active_sections?.length
    ? fields.active_sections
    : DEFAULT_SECTIONS;

  const [showAddSection, setShowAddSection] = useState(false);

  function addSection(type: ProposalSectionType) {
    if (activeSections.includes(type)) return;
    setField('active_sections', [...activeSections, type]);
    setShowAddSection(false);
  }

  function removeSection(type: ProposalSectionType) {
    setField('active_sections', activeSections.filter(s => s !== type));
  }

  const availableToAdd = ADDABLE_SECTIONS.filter(s => !activeSections.includes(s.type));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {activeSections.map(section => (
        <ProposalSection
          key={section}
          type={section}
          fields={fields}
          setField={setField}
          onRemove={() => removeSection(section)}
        />
      ))}

      {/* Add Section */}
      {availableToAdd.length > 0 && (
        <div>
          {!showAddSection ? (
            <button onClick={() => setShowAddSection(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-default)', background: 'transparent', color: 'var(--text-tertiary)', fontSize: 12, fontFamily: 'var(--font-body)', cursor: 'pointer', transition: 'all 150ms', width: '100%', justifyContent: 'center' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent-blue)'; (e.currentTarget as HTMLElement).style.color = 'var(--accent-blue)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; }}>
              <Plus size={13} /> Add Section
            </button>
          ) : (
            <div style={{ padding: '14px', background: 'var(--bg-hover)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <p className="t-label">Add a section</p>
                <button onClick={() => setShowAddSection(false)}
                  style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex' }}>
                  <X size={14} />
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                {availableToAdd.map(s => (
                  <button key={s.type} onClick={() => addSection(s.type)}
                    style={{ padding: '9px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)', background: 'var(--bg-surface)', cursor: 'pointer', textAlign: 'left' as const, transition: 'all 150ms' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent-blue)'; (e.currentTarget as HTMLElement).style.background = 'var(--accent-blue-dim)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)'; (e.currentTarget as HTMLElement).style.background = 'var(--bg-surface)'; }}>
                    <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-body)', margin: 0 }}>{s.label}</p>
                    <p style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-body)', marginTop: 2, marginBottom: 0 }}>{s.description}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Individual section renderer — each section is a collapsible card with a remove button
function ProposalSection({ type, fields, setField, onRemove }: {
  type: ProposalSectionType; fields: any;
  setField: (k: string, v: any) => void; onRemove: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const cfg = ADDABLE_SECTIONS.find(s => s.type === type);

  return (
    <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
      {/* Section header */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', background: 'var(--bg-hover)', gap: 8 }}>
        <button onClick={() => setCollapsed(c => !c)}
          style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left' as const, padding: 0 }}>
          <span style={{ color: 'var(--text-tertiary)', display: 'flex', transition: 'transform 150ms', transform: collapsed ? 'rotate(-90deg)' : 'none' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m6 9 6 6 6-6"/></svg>
          </span>
          <p className="t-label" style={{ color: 'var(--text-secondary)', margin: 0 }}>{cfg?.label || type}</p>
        </button>
        <button onClick={onRemove} title="Remove this section"
          style={{ display: 'flex', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 2, borderRadius: 'var(--radius-sm)', transition: 'color 150ms' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent-red)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; }}>
          <X size={13} />
        </button>
      </div>

      {/* Section content */}
      {!collapsed && (
        <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {type === 'overview' && (
            <Textarea value={fields.overview || ''} onChange={e => setField('overview', e.target.value)}
              placeholder="Describe the project and what you'll deliver — be specific about outcomes, not just tasks..." style={{ minHeight: 100 }} />
          )}
          {type === 'scope' && (
            <>
              <ListEditor label="What's Included" items={fields.inclusions || []} onChange={v => setField('inclusions', v)} placeholder="e.g., 5-page responsive website" />
              <ListEditor label="Exclusions" items={fields.exclusions || []} onChange={v => setField('exclusions', v)} placeholder="e.g., Content writing, stock photography" />
            </>
          )}
          {type === 'deliverables' && (
            <ListEditor label="Deliverables" items={fields.deliverables_list || []} onChange={v => setField('deliverables_list', v)} placeholder="e.g., Figma design file with 5 screens" />
          )}
          {type === 'timeline' && (
            <Input label="Timeline" value={fields.timeline || ''} onChange={e => setField('timeline', e.target.value)} placeholder="e.g., 3–4 weeks from kickoff" />
          )}
          {type === 'investment' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Input label="Investment (₹)" type="number" value={fields.investment_amount || ''} onChange={e => setField('investment_amount', Number(e.target.value))} placeholder="0" />
                <Input label="Valid Until" type="date" value={fields.validity_date || ''} onChange={e => setField('validity_date', e.target.value)} />
              </div>
              <Input label="Payment Terms" value={fields.payment_terms || ''} onChange={e => setField('payment_terms', e.target.value)} placeholder="e.g., 50% upfront, 50% on delivery" />
            </>
          )}
          {type === 'process' && (
            <Textarea value={fields.our_process || ''} onChange={e => setField('our_process', e.target.value)}
              placeholder="Describe how you work — discovery, design, development, review, delivery..." style={{ minHeight: 80 }} />
          )}
          {type === 'whyus' && (
            <Textarea value={fields.why_us || ''} onChange={e => setField('why_us', e.target.value)}
              placeholder="What makes you the right choice for this project..." style={{ minHeight: 80 }} />
          )}
          {type === 'terms' && (
            <>
              <Input label="Revisions" value={fields.revision_terms || ''} onChange={e => setField('revision_terms', e.target.value)} placeholder="e.g., 2 rounds of revisions included" />
              <Input label="IP Ownership" value={fields.ip_terms || ''} onChange={e => setField('ip_terms', e.target.value)} placeholder="e.g., Full IP transfers to client upon final payment" />
            </>
          )}
          {type === 'portfolio' && (
            <>
              <Input label="URL" value={fields.portfolio_url || ''} onChange={e => setField('portfolio_url', e.target.value)} placeholder="https://..." />
              <Input label="Context" value={fields.portfolio_note || ''} onChange={e => setField('portfolio_note', e.target.value)} placeholder="e.g., Similar branding project for a lifestyle brand" />
            </>
          )}
          {type === 'custom' && (
            <>
              <Input label="Section Title" value={fields.custom_title || ''} onChange={e => setField('custom_title', e.target.value)} placeholder="e.g., Testimonials" />
              <Textarea label="Content" value={fields.custom_content || ''} onChange={e => setField('custom_content', e.target.value)} style={{ minHeight: 80 }} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── CONTRACT EDITOR ──────────────────────────────────────────
// Section-based flexible editor — same pattern as ProposalEditor.
// Sections can be added, removed, and collapsed independently.

type ContractSectionType =
  | 'parties' | 'project' | 'payment' | 'revisions' | 'ip'
  | 'confidentiality' | 'termination' | 'governing_law' | 'signatures' | 'custom_c';

const CONTRACT_SECTIONS: { type: ContractSectionType; label: string; description: string }[] = [
  { type: 'parties',         label: 'Parties',           description: 'Client and service provider names' },
  { type: 'project',         label: 'Project',           description: 'Description, dates, scope reference' },
  { type: 'payment',         label: 'Payment Schedule',  description: 'Milestone-based payment triggers' },
  { type: 'revisions',       label: 'Revision Policy',   description: 'Number of rounds, process' },
  { type: 'ip',              label: 'IP & Ownership',    description: 'Who owns the work and when' },
  { type: 'confidentiality', label: 'Confidentiality',   description: 'NDA and information handling' },
  { type: 'termination',     label: 'Termination',       description: 'Notice period and exit terms' },
  { type: 'governing_law',   label: 'Governing Law',     description: 'Jurisdiction and applicable law' },
  { type: 'signatures',      label: 'Signatures',        description: 'Sender and client signatures' },
  { type: 'custom_c',        label: 'Custom Clause',     description: 'Any additional clause' },
];

const DEFAULT_CONTRACT_SECTIONS: ContractSectionType[] = [
  'parties', 'project', 'payment', 'ip', 'signatures',
];

function ContractEditor({ fields, setField }: { fields: any; setField: (k: string, v: any) => void }) {
  const activeSections: ContractSectionType[] = fields.active_sections_contract?.length
    ? fields.active_sections_contract
    : DEFAULT_CONTRACT_SECTIONS;

  const [showAddSection, setShowAddSection] = useState(false);

  function addSection(type: ContractSectionType) {
    if (activeSections.includes(type)) return;
    setField('active_sections_contract', [...activeSections, type]);
    setShowAddSection(false);
  }
  function removeSection(type: ContractSectionType) {
    setField('active_sections_contract', activeSections.filter(s => s !== type));
  }

  const availableToAdd = CONTRACT_SECTIONS.filter(s => !activeSections.includes(s.type));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {activeSections.map(section => (
        <ContractSection
          key={section}
          type={section}
          fields={fields}
          setField={setField}
          onRemove={() => removeSection(section)}
        />
      ))}

      {availableToAdd.length > 0 && (
        <div>
          {!showAddSection ? (
            <button onClick={() => setShowAddSection(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-default)', background: 'transparent', color: 'var(--text-tertiary)', fontSize: 12, fontFamily: 'var(--font-body)', cursor: 'pointer', transition: 'all 150ms', width: '100%', justifyContent: 'center' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent-blue)'; (e.currentTarget as HTMLElement).style.color = 'var(--accent-blue)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; }}>
              <Plus size={13} /> Add Clause
            </button>
          ) : (
            <div style={{ padding: '14px', background: 'var(--bg-hover)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <p className="t-label">Add a clause</p>
                <button onClick={() => setShowAddSection(false)}
                  style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex' }}>
                  <X size={14} />
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                {availableToAdd.map(s => (
                  <button key={s.type} onClick={() => addSection(s.type)}
                    style={{ padding: '9px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)', background: 'var(--bg-surface)', cursor: 'pointer', textAlign: 'left' as const, transition: 'all 150ms' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent-blue)'; (e.currentTarget as HTMLElement).style.background = 'var(--accent-blue-dim)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)'; (e.currentTarget as HTMLElement).style.background = 'var(--bg-surface)'; }}>
                    <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-body)', margin: 0 }}>{s.label}</p>
                    <p style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-body)', marginTop: 2, marginBottom: 0 }}>{s.description}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ContractSection({ type, fields, setField, onRemove }: {
  type: ContractSectionType; fields: any;
  setField: (k: string, v: any) => void; onRemove: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [newPayment, setNewPayment] = useState({ trigger: '', amount: '' });
  const schedule = fields.payment_schedule || [];
  const cfg = CONTRACT_SECTIONS.find(s => s.type === type);

  return (
    <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', background: 'var(--bg-hover)', gap: 8 }}>
        <button onClick={() => setCollapsed(c => !c)}
          style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left' as const, padding: 0 }}>
          <span style={{ color: 'var(--text-tertiary)', display: 'flex', transition: 'transform 150ms', transform: collapsed ? 'rotate(-90deg)' : 'none' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m6 9 6 6 6-6"/></svg>
          </span>
          <p className="t-label" style={{ color: 'var(--text-secondary)', margin: 0 }}>{cfg?.label || type}</p>
        </button>
        <button onClick={onRemove} title="Remove this clause"
          style={{ display: 'flex', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 2, borderRadius: 'var(--radius-sm)', transition: 'color 150ms' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent-red)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; }}>
          <X size={13} />
        </button>
      </div>

      {/* Content */}
      {!collapsed && (
        <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {type === 'parties' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Input label="Client Name" value={fields.parties?.client || ''} onChange={e => setField('parties', { ...fields.parties, client: e.target.value })} placeholder="Client full name" />
              <Input label="Service Provider" value={fields.parties?.freelancer || ''} onChange={e => setField('parties', { ...fields.parties, freelancer: e.target.value })} placeholder="Your full name" />
            </div>
          )}
          {type === 'project' && (
            <>
              <Textarea label="Project Description" value={fields.project_description || ''} onChange={e => setField('project_description', e.target.value)} placeholder="Brief description of the work being contracted..." style={{ minHeight: 80 }} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Input label="Project Start Date" type="date" value={fields.start_date || ''} onChange={e => setField('start_date', e.target.value)} />
                <Input label="Expected Delivery" type="date" value={fields.delivery_date || ''} onChange={e => setField('delivery_date', e.target.value)} />
              </div>
            </>
          )}
          {type === 'payment' && (
            <>
              {schedule.map((p: any, i: number) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--bg-hover)', borderRadius: 'var(--radius-sm)' }}>
                  <span className="t-xs" style={{ flex: 1 }}>{p.trigger}</span>
                  <span className="t-xs-medium" style={{ color: 'var(--accent-green)' }}>₹{Number(p.amount).toLocaleString('en-IN')}</span>
                  <button onClick={() => setField('payment_schedule', schedule.filter((_: any, idx: number) => idx !== i))}
                    style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}>
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8 }}>
                <input value={newPayment.trigger} onChange={e => setNewPayment(p => ({ ...p, trigger: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter' && newPayment.trigger && newPayment.amount) { setField('payment_schedule', [...schedule, newPayment]); setNewPayment({ trigger: '', amount: '' }); } }}
                  placeholder="Trigger (e.g., On signing)" className="input" style={{ fontSize: 12 }} />
                <input value={newPayment.amount} onChange={e => setNewPayment(p => ({ ...p, amount: e.target.value }))}
                  placeholder="₹ Amount" type="number" className="input" style={{ fontSize: 12, width: 120 }} />
                <button onClick={() => { if (newPayment.trigger && newPayment.amount) { setField('payment_schedule', [...schedule, newPayment]); setNewPayment({ trigger: '', amount: '' }); } }}
                  style={{ padding: '7px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)', background: 'transparent', fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'var(--font-body)', whiteSpace: 'nowrap' as const }}>
                  + Add
                </button>
              </div>
              {schedule.length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 4, borderTop: '1px solid var(--border-subtle)' }}>
                  <span className="t-xs-medium" style={{ color: 'var(--accent-green)' }}>
                    Total: ₹{schedule.reduce((s: number, p: any) => s + Number(p.amount), 0).toLocaleString('en-IN')}
                  </span>
                </div>
              )}
            </>
          )}
          {type === 'revisions' && (
            <Textarea value={fields.revision_policy || ''} onChange={e => setField('revision_policy', e.target.value)}
              placeholder="e.g., 2 rounds of revisions included. Additional rounds billed at ₹X/hour. Revisions must be consolidated and submitted within 7 days of delivery." style={{ minHeight: 80 }} />
          )}
          {type === 'ip' && (
            <Textarea value={fields.ip_clause || ''} onChange={e => setField('ip_clause', e.target.value)}
              placeholder="Full IP and ownership rights transfer to the client upon receipt of final payment. Until final payment, all work remains the intellectual property of the service provider." style={{ minHeight: 80 }} />
          )}
          {type === 'confidentiality' && (
            <Textarea value={fields.confidentiality_clause || ''} onChange={e => setField('confidentiality_clause', e.target.value)}
              placeholder="Both parties agree to keep project details, pricing, source materials, and communications confidential. Neither party will disclose confidential information to third parties without prior written consent, except as required by law. This obligation survives termination of the agreement." style={{ minHeight: 100 }} />
          )}
          {type === 'termination' && (
            <Textarea value={fields.termination_clause || ''} onChange={e => setField('termination_clause', e.target.value)}
              placeholder="Either party may terminate this agreement with 7 days written notice. All work completed up to the termination date will be invoiced pro-rata. The client retains rights only to fully paid deliverables. Any third-party costs already incurred are non-refundable." style={{ minHeight: 100 }} />
          )}
          {type === 'governing_law' && (
            <Input label="Governing Law & Jurisdiction" value={fields.governing_law || ''} onChange={e => setField('governing_law', e.target.value)} placeholder="e.g., India — disputes subject to jurisdiction of courts in Mumbai" />
          )}
          {type === 'signatures' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <SenderSignatureField value={fields.creator_signature || null} onChange={v => setField('creator_signature', v)} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label className="t-label">Client Signature</label>
                <div style={{ padding: '10px 14px', background: 'var(--bg-hover)', borderRadius: 'var(--radius-md)', fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'var(--font-body)', fontStyle: 'italic' }}>
                  Client signs via the shared link after you send it.
                </div>
              </div>
            </div>
          )}
          {type === 'custom_c' && (
            <>
              <Input label="Clause Title" value={fields.custom_c_title || ''} onChange={e => setField('custom_c_title', e.target.value)} placeholder="e.g., Non-Solicitation" />
              <Textarea label="Clause Content" value={fields.custom_c_content || ''} onChange={e => setField('custom_c_content', e.target.value)} style={{ minHeight: 80 }} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── SOW EDITOR ───────────────────────────────────────────────
type SOWSectionType =
  | 'objectives' | 'deliverables' | 'out_of_scope' | 'milestones'
  | 'acceptance' | 'assumptions' | 'dependencies' | 'signoff';

const SOW_SECTIONS: { type: SOWSectionType; label: string; description: string }[] = [
  { type: 'objectives',   label: 'Objectives',        description: 'Goals this work achieves' },
  { type: 'deliverables', label: 'Deliverables',       description: 'Specific items you will deliver' },
  { type: 'out_of_scope', label: 'Out of Scope',       description: 'What is explicitly excluded' },
  { type: 'milestones',   label: 'Milestones',         description: 'Key dates and checkpoints' },
  { type: 'acceptance',   label: 'Acceptance Criteria',description: 'How completion is measured' },
  { type: 'assumptions',  label: 'Assumptions',        description: 'What you are taking as given' },
  { type: 'dependencies', label: 'Dependencies',       description: 'What you need from the client' },
  { type: 'signoff',      label: 'Client Sign-off',    description: 'Approval signature from client' },
];

const DEFAULT_SOW_SECTIONS: SOWSectionType[] = [
  'objectives', 'deliverables', 'acceptance', 'signoff',
];

function SOWEditor({ fields, setField }: { fields: any; setField: (k: string, v: any) => void }) {
  const activeSections: SOWSectionType[] = fields.active_sections_sow?.length
    ? fields.active_sections_sow
    : DEFAULT_SOW_SECTIONS;

  const [showAddSection, setShowAddSection] = useState(false);

  function addSection(type: SOWSectionType) {
    if (activeSections.includes(type)) return;
    setField('active_sections_sow', [...activeSections, type]);
    setShowAddSection(false);
  }
  function removeSection(type: SOWSectionType) {
    setField('active_sections_sow', activeSections.filter(s => s !== type));
  }

  const availableToAdd = SOW_SECTIONS.filter(s => !activeSections.includes(s.type));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {activeSections.map(section => (
        <SOWSection
          key={section} type={section}
          fields={fields} setField={setField}
          onRemove={() => removeSection(section)}
        />
      ))}

      {availableToAdd.length > 0 && (
        <div>
          {!showAddSection ? (
            <button onClick={() => setShowAddSection(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-default)', background: 'transparent', color: 'var(--text-tertiary)', fontSize: 12, fontFamily: 'var(--font-body)', cursor: 'pointer', transition: 'all 150ms', width: '100%', justifyContent: 'center' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent-blue)'; (e.currentTarget as HTMLElement).style.color = 'var(--accent-blue)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; }}>
              <Plus size={13} /> Add Section
            </button>
          ) : (
            <div style={{ padding: '14px', background: 'var(--bg-hover)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <p className="t-label">Add a section</p>
                <button onClick={() => setShowAddSection(false)}
                  style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex' }}>
                  <X size={14} />
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                {availableToAdd.map(s => (
                  <button key={s.type} onClick={() => addSection(s.type)}
                    style={{ padding: '9px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)', background: 'var(--bg-surface)', cursor: 'pointer', textAlign: 'left' as const, transition: 'all 150ms' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent-blue)'; (e.currentTarget as HTMLElement).style.background = 'var(--accent-blue-dim)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)'; (e.currentTarget as HTMLElement).style.background = 'var(--bg-surface)'; }}>
                    <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-body)', margin: 0 }}>{s.label}</p>
                    <p style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-body)', marginTop: 2, marginBottom: 0 }}>{s.description}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SOWSection({ type, fields, setField, onRemove }: {
  type: SOWSectionType; fields: any;
  setField: (k: string, v: any) => void; onRemove: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [newDeliverable, setNewDeliverable] = useState({ title: '', description: '' });
  const [newMilestone, setNewMilestone] = useState({ title: '', date: '' });
  const deliverables = fields.deliverables || [];
  const milestones   = fields.milestones   || [];
  const cfg = SOW_SECTIONS.find(s => s.type === type);

  return (
    <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', background: 'var(--bg-hover)', gap: 8 }}>
        <button onClick={() => setCollapsed(c => !c)}
          style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left' as const, padding: 0 }}>
          <span style={{ color: 'var(--text-tertiary)', display: 'flex', transition: 'transform 150ms', transform: collapsed ? 'rotate(-90deg)' : 'none' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m6 9 6 6 6-6"/></svg>
          </span>
          <p className="t-label" style={{ color: 'var(--text-secondary)', margin: 0 }}>{cfg?.label || type}</p>
        </button>
        <button onClick={onRemove} title="Remove this section"
          style={{ display: 'flex', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 2, borderRadius: 'var(--radius-sm)', transition: 'color 150ms' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent-red)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; }}>
          <X size={13} />
        </button>
      </div>

      {!collapsed && (
        <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {type === 'objectives' && (
            <Textarea value={fields.objectives || ''} onChange={e => setField('objectives', e.target.value)}
              placeholder="Describe the goals this scope of work is meant to achieve — outcomes, not just activities..." style={{ minHeight: 90 }} />
          )}
          {type === 'out_of_scope' && (
            <Textarea value={fields.out_of_scope || ''} onChange={e => setField('out_of_scope', e.target.value)}
              placeholder="Be explicit about what is not included — this protects both parties from scope creep. e.g., Content writing, stock photography, ongoing maintenance, third-party API fees..." style={{ minHeight: 90 }} />
          )}
          {type === 'deliverables' && (
            <>
              {deliverables.map((d: any, i: number) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '9px 12px', background: 'var(--bg-hover)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ flex: 1 }}>
                    <p className="t-xs-medium" style={{ margin: 0 }}>{d.title}</p>
                    {d.description && <p className="t-2xs text-tertiary" style={{ marginTop: 3, marginBottom: 0 }}>{d.description}</p>}
                  </div>
                  <button onClick={() => setField('deliverables', deliverables.filter((_: any, idx: number) => idx !== i))}
                    style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', flexShrink: 0, transition: 'color 150ms' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent-red)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; }}>
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 12px', background: 'var(--bg-hover)', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--border-default)' }}>
                <input value={newDeliverable.title}
                  onChange={e => setNewDeliverable(d => ({ ...d, title: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter' && newDeliverable.title.trim()) { setField('deliverables', [...deliverables, { ...newDeliverable, title: newDeliverable.title.trim() }]); setNewDeliverable({ title: '', description: '' }); } }}
                  placeholder="Deliverable title (press Enter to add)" className="input" style={{ fontSize: 12 }} />
                <input value={newDeliverable.description}
                  onChange={e => setNewDeliverable(d => ({ ...d, description: e.target.value }))}
                  placeholder="Description (optional)" className="input" style={{ fontSize: 12 }} />
                <button onClick={() => { if (newDeliverable.title.trim()) { setField('deliverables', [...deliverables, { ...newDeliverable, title: newDeliverable.title.trim() }]); setNewDeliverable({ title: '', description: '' }); } }}
                  style={{ padding: '5px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)', background: 'transparent', fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer', alignSelf: 'flex-end', fontFamily: 'var(--font-body)' }}>
                  + Add Deliverable
                </button>
              </div>
            </>
          )}
          {type === 'milestones' && (
            <>
              {milestones.map((m: any, i: number) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--bg-hover)', borderRadius: 'var(--radius-sm)' }}>
                  <span className="t-xs" style={{ flex: 1 }}>{m.title}</span>
                  {m.date && <span className="t-2xs text-tertiary">{m.date}</span>}
                  <button onClick={() => setField('milestones', milestones.filter((_: any, idx: number) => idx !== i))}
                    style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', transition: 'color 150ms' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent-red)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; }}>
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8 }}>
                <input value={newMilestone.title} onChange={e => setNewMilestone(m => ({ ...m, title: e.target.value }))}
                  placeholder="Milestone name (e.g., Design approval)" className="input" style={{ fontSize: 12 }} />
                <input value={newMilestone.date} onChange={e => setNewMilestone(m => ({ ...m, date: e.target.value }))}
                  type="date" className="input" style={{ fontSize: 12 }} />
                <button onClick={() => { if (newMilestone.title.trim()) { setField('milestones', [...milestones, newMilestone]); setNewMilestone({ title: '', date: '' }); } }}
                  style={{ padding: '7px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)', background: 'transparent', fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'var(--font-body)', whiteSpace: 'nowrap' as const }}>
                  + Add
                </button>
              </div>
            </>
          )}
          {type === 'acceptance' && (
            <Textarea value={fields.acceptance_criteria || ''} onChange={e => setField('acceptance_criteria', e.target.value)}
              placeholder="Define how you and the client will agree that work is complete and acceptable. e.g., All pages load under 3s, passes client review within 7 days, no critical bugs at launch..." style={{ minHeight: 90 }} />
          )}
          {type === 'assumptions' && (
            <Textarea value={fields.assumptions || ''} onChange={e => setField('assumptions', e.target.value)}
              placeholder="State what you are assuming to be true for this scope to hold. e.g., Client will provide brand assets by kickoff, copy is finalised before development begins..." style={{ minHeight: 80 }} />
          )}
          {type === 'dependencies' && (
            <Textarea value={fields.dependencies || ''} onChange={e => setField('dependencies', e.target.value)}
              placeholder="List what you need from the client to start or continue work. e.g., Access to CMS, logo files, existing codebase, third-party API credentials..." style={{ minHeight: 80 }} />
          )}
          {type === 'signoff' && (
            <div style={{ padding: '10px 14px', background: 'var(--bg-hover)', borderRadius: 'var(--radius-md)', fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'var(--font-body)', fontStyle: 'italic' }}>
              Client signs via the shared document link to acknowledge and approve this scope.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── REQUIREMENTS EDITOR ──────────────────────────────────────
type ReqSectionType =
  | 'background' | 'functional' | 'design' | 'technical'
  | 'content' | 'deadline' | 'signoff';

const REQ_SECTIONS: { type: ReqSectionType; label: string; description: string }[] = [
  { type: 'background',  label: 'Project Background',       description: 'Context, goals, and brief' },
  { type: 'functional',  label: 'Functional Requirements',  description: 'What it needs to do' },
  { type: 'design',      label: 'Design Preferences',       description: 'Look, feel, and references' },
  { type: 'technical',   label: 'Technical Requirements',   description: 'Stack, hosting, integrations' },
  { type: 'content',     label: 'Content Responsibilities', description: 'Who provides what content' },
  { type: 'deadline',    label: 'Deadline & Timeline',      description: 'Target dates and constraints' },
  { type: 'signoff',     label: 'Client Sign-off',          description: 'Client approval signature' },
];

const DEFAULT_REQ_SECTIONS: ReqSectionType[] = [
  'background', 'functional', 'technical', 'deadline', 'signoff',
];

function RequirementsEditor({ fields, setField }: { fields: any; setField: (k: string, v: any) => void }) {
  const activeSections: ReqSectionType[] = fields.active_sections_req?.length
    ? fields.active_sections_req
    : DEFAULT_REQ_SECTIONS;

  const [showAddSection, setShowAddSection] = useState(false);

  function addSection(type: ReqSectionType) {
    if (activeSections.includes(type)) return;
    setField('active_sections_req', [...activeSections, type]);
    setShowAddSection(false);
  }
  function removeSection(type: ReqSectionType) {
    setField('active_sections_req', activeSections.filter(s => s !== type));
  }

  const availableToAdd = REQ_SECTIONS.filter(s => !activeSections.includes(s.type));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {activeSections.map(section => (
        <ReqSection
          key={section} type={section}
          fields={fields} setField={setField}
          onRemove={() => removeSection(section)}
        />
      ))}

      {availableToAdd.length > 0 && (
        <div>
          {!showAddSection ? (
            <button onClick={() => setShowAddSection(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-default)', background: 'transparent', color: 'var(--text-tertiary)', fontSize: 12, fontFamily: 'var(--font-body)', cursor: 'pointer', transition: 'all 150ms', width: '100%', justifyContent: 'center' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent-blue)'; (e.currentTarget as HTMLElement).style.color = 'var(--accent-blue)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; }}>
              <Plus size={13} /> Add Section
            </button>
          ) : (
            <div style={{ padding: '14px', background: 'var(--bg-hover)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <p className="t-label">Add a section</p>
                <button onClick={() => setShowAddSection(false)}
                  style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex' }}>
                  <X size={14} />
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                {availableToAdd.map(s => (
                  <button key={s.type} onClick={() => addSection(s.type)}
                    style={{ padding: '9px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)', background: 'var(--bg-surface)', cursor: 'pointer', textAlign: 'left' as const, transition: 'all 150ms' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent-blue)'; (e.currentTarget as HTMLElement).style.background = 'var(--accent-blue-dim)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)'; (e.currentTarget as HTMLElement).style.background = 'var(--bg-surface)'; }}>
                    <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-body)', margin: 0 }}>{s.label}</p>
                    <p style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-body)', marginTop: 2, marginBottom: 0 }}>{s.description}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ReqSection({ type, fields, setField, onRemove }: {
  type: ReqSectionType; fields: any;
  setField: (k: string, v: any) => void; onRemove: () => void;
}) {
  const [collapsed, setCollapsed]   = useState(false);
  const [newReq, setNewReq]         = useState('');
  const requirements = fields.functional_requirements || [];
  const cfg = REQ_SECTIONS.find(s => s.type === type);

  return (
    <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', background: 'var(--bg-hover)', gap: 8 }}>
        <button onClick={() => setCollapsed(c => !c)}
          style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left' as const, padding: 0 }}>
          <span style={{ color: 'var(--text-tertiary)', display: 'flex', transition: 'transform 150ms', transform: collapsed ? 'rotate(-90deg)' : 'none' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m6 9 6 6 6-6"/></svg>
          </span>
          <p className="t-label" style={{ color: 'var(--text-secondary)', margin: 0 }}>{cfg?.label || type}</p>
        </button>
        <button onClick={onRemove} title="Remove this section"
          style={{ display: 'flex', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 2, borderRadius: 'var(--radius-sm)', transition: 'color 150ms' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent-red)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; }}>
          <X size={13} />
        </button>
      </div>

      {!collapsed && (
        <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {type === 'background' && (
            <Textarea value={fields.project_background || ''} onChange={e => setField('project_background', e.target.value)}
              placeholder="Describe the project context — what the client does, what problem this solves, and what success looks like to them..." style={{ minHeight: 90 }} />
          )}
          {type === 'functional' && (
            <>
              <p style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-body)', margin: 0 }}>
                List each feature or behaviour the project must have. Be specific — these become the basis for acceptance.
              </p>
              {requirements.map((r: any, i: number) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', background: 'var(--bg-hover)', borderRadius: 'var(--radius-sm)' }}>
                  <span className="t-xs" style={{ flex: 1 }}>{r.requirement}</span>
                  <button onClick={() => setField('functional_requirements', requirements.filter((_: any, idx: number) => idx !== i))}
                    style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', flexShrink: 0, transition: 'color 150ms' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent-red)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; }}>
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
              <input value={newReq} onChange={e => setNewReq(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && newReq.trim()) { setField('functional_requirements', [...requirements, { requirement: newReq.trim() }]); setNewReq(''); } }}
                placeholder="Type a requirement and press Enter... e.g., User can reset password via email"
                className="input" style={{ fontSize: 12 }} />
            </>
          )}
          {type === 'design' && (
            <Textarea value={fields.design_preferences || ''} onChange={e => setField('design_preferences', e.target.value)}
              placeholder="Describe the visual direction — style references, colours, fonts, mood. Include links to inspiration sites or competitor sites. e.g., Clean and minimal like Linear.app, brand colour #3B82F6, no stock photos..." style={{ minHeight: 100 }} />
          )}
          {type === 'technical' && (
            <Textarea value={fields.technical_requirements || ''} onChange={e => setField('technical_requirements', e.target.value)}
              placeholder="Specify technical constraints or preferences — hosting platform, existing CMS, required integrations, browser support, performance targets, authentication requirements..." style={{ minHeight: 90 }} />
          )}
          {type === 'content' && (
            <Textarea value={fields.content_responsibilities || ''} onChange={e => setField('content_responsibilities', e.target.value)}
              placeholder="Clarify who provides what — e.g., Client provides all copy and images before kickoff. Service provider sources stock photography if needed. Client provides logo in SVG format..." style={{ minHeight: 80 }} />
          )}
          {type === 'deadline' && (
            <>
              <Input label="Target Launch Date" type="date" value={fields.deadline || ''} onChange={e => setField('deadline', e.target.value)} />
              <Textarea label="Timeline Notes" value={fields.timeline_notes || ''} onChange={e => setField('timeline_notes', e.target.value)}
                placeholder="Any fixed constraints, hard deadlines, or milestones that affect the schedule..." style={{ minHeight: 60 }} />
            </>
          )}
          {type === 'signoff' && (
            <div style={{ padding: '10px 14px', background: 'var(--bg-hover)', borderRadius: 'var(--radius-md)', fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'var(--font-body)', fontStyle: 'italic' }}>
              Client reviews and approves these requirements via the shared document link.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── INVOICE EDITOR ───────────────────────────────────────────
// MONEY SAFETY RULES:
// 1. recalculate() is the single source of truth — it always derives totals
//    from current items + current rate. Never store totals from stale closures.
// 2. All amounts displayed in editor use formatINR() — no raw numbers shown.
// 3. Line items with quantity < 1 or rate <= 0 are rejected before adding.
// 4. GST rate is validated: must be a positive number ≤ 100.

function InvoiceEditor({ fields, setField }: { fields: any; setField: (k: string, v: any) => void }) {
  const [newItem, setNewItem] = useState({ description: '', quantity: '', rate: '' });
  const lineItems: any[] = fields.line_items || [];

  // Single source of truth for all totals.
  // Always called with the full items array and current rates — never stale.
  function recalculate(items: any[], gstEnabled: boolean, gstRate: number) {
    const rate    = Math.max(0, Math.min(100, gstRate || 18));
    const subtotal = items.reduce((s, item) => s + (Number(item.quantity) * Number(item.rate)), 0);
    const gstAmount = gstEnabled ? Math.round(subtotal * rate / 100) : 0;
    // Batch all field writes — one autoSave trigger not four
    setField('__invoice_batch', {
      line_items: items, subtotal, gst_amount: gstAmount,
      total: subtotal + gstAmount, gst_rate: rate,
    });
  }

  function addItem() {
    const qty  = Number(newItem.quantity);
    const rate = Number(newItem.rate);
    if (!newItem.description.trim()) return;
    if (qty < 1 || !Number.isFinite(qty)) return;   // reject invalid qty
    if (rate <= 0 || !Number.isFinite(rate)) return; // reject zero/negative rate
    const item = { description: newItem.description.trim(), quantity: qty, rate };
    recalculate([...lineItems, item], fields.gst_enabled || false, fields.gst_rate || 18);
    setNewItem({ description: '', quantity: '', rate: '' });
  }

  function removeItem(index: number) {
    recalculate(
      lineItems.filter((_: any, idx: number) => idx !== index),
      fields.gst_enabled || false, fields.gst_rate || 18
    );
  }

  function toggleGST(enabled: boolean) {
    setField('gst_enabled', enabled);
    recalculate(lineItems, enabled, fields.gst_rate || 18);
  }

  function updateGSTRate(rate: number) {
    if (rate <= 0 || rate > 100 || !Number.isFinite(rate)) return;
    recalculate(lineItems, fields.gst_enabled || false, rate);
  }

  // Derive display totals fresh from current items — never trust stored values in render
  const currentGST  = Math.max(0, Math.min(100, fields.gst_rate || 18));
  const subtotal    = lineItems.reduce((s, item) => s + (Number(item.quantity) * Number(item.rate)), 0);
  const gstAmount   = fields.gst_enabled ? Math.round(subtotal * currentGST / 100) : 0;
  const total       = subtotal + gstAmount;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Invoice Details */}
      <EditorSection title="Invoice Details">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <Input label="Invoice Number" value={fields.invoice_number || ''} onChange={e => setField('invoice_number', e.target.value)}
              placeholder="INV-2026-001 or INV/2026-27/001" />
            <p style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-body)', marginTop: 4, marginBottom: 0 }}>
              Use a consistent numbering format — e.g. INV-YYYY-NNN for calendar year or INV/FY/NNN for financial year
            </p>
          </div>
          <Input label="Client Name" value={fields.client_name || ''} onChange={e => setField('client_name', e.target.value)}
            placeholder="Full name or company name" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Input label="Invoice Date" type="date" value={fields.invoice_date || new Date().toISOString().split('T')[0]}
            onChange={e => setField('invoice_date', e.target.value)} />
          <Input label="Due Date" type="date" value={fields.due_date || ''} onChange={e => setField('due_date', e.target.value)} />
        </div>
        <Input label="Invoice Description" value={fields.description || ''} onChange={e => setField('description', e.target.value)}
          placeholder="e.g., 50% upfront payment — Website design and development for ACME Corp" />
        <Input label="Payment Terms" value={fields.payment_terms || ''} onChange={e => setField('payment_terms', e.target.value)}
          placeholder="e.g., Due on receipt · Net 14 · Net 30" />
      </EditorSection>

      {/* Line Items */}
      <EditorSection title="Line Items">

        {/* Column headers */}
        {lineItems.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 56px 110px 110px 28px', gap: 8, padding: '0 12px' }}>
            {['Description', 'Qty', 'Rate (₹)', 'Amount (₹)', ''].map((h, i) => (
              <span key={i} className="t-label" style={{ textAlign: i > 0 && i < 4 ? 'right' : 'left' }}>{h}</span>
            ))}
          </div>
        )}

        {/* Existing items */}
        {lineItems.map((item: any, i: number) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 56px 110px 110px 28px', gap: 8, alignItems: 'center', padding: '9px 12px', background: 'var(--bg-hover)', borderRadius: 'var(--radius-sm)' }}>
            <span className="t-xs">{item.description}</span>
            <span className="t-xs" style={{ textAlign: 'right' }}>{item.quantity}</span>
            <span className="t-xs" style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 11 }}>{Number(item.rate).toLocaleString('en-IN')}</span>
            <span className="t-xs-medium" style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 11 }}>{(Number(item.quantity) * Number(item.rate)).toLocaleString('en-IN')}</span>
            <button onClick={() => removeItem(i)}
              style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex', transition: 'color 150ms' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent-red)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; }}>
              <Trash2 size={12} />
            </button>
          </div>
        ))}

        {/* Add new item row */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 56px 110px auto', gap: 8, padding: '10px 12px', background: 'var(--bg-hover)', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--border-default)' }}>
          <input value={newItem.description} onChange={e => setNewItem(p => ({ ...p, description: e.target.value }))}
            onKeyDown={e => { if (e.key === 'Enter') addItem(); }}
            placeholder="Item description" className="input" style={{ fontSize: 12 }} />
          <input value={newItem.quantity} onChange={e => setNewItem(p => ({ ...p, quantity: e.target.value }))}
            type="number" min="1" placeholder="Qty" className="input" style={{ fontSize: 12, textAlign: 'right' }} />
          <input value={newItem.rate} onChange={e => setNewItem(p => ({ ...p, rate: e.target.value }))}
            type="number" min="0" placeholder="Rate ₹" className="input" style={{ fontSize: 12, textAlign: 'right' }} />
          <button onClick={addItem}
            style={{ padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--accent-blue)', background: 'var(--accent-blue-dim)', fontSize: 12, color: 'var(--accent-blue)', cursor: 'pointer', fontFamily: 'var(--font-body)', whiteSpace: 'nowrap' as const, fontWeight: 500 }}>
            + Add
          </button>
        </div>

        {/* Totals — derived fresh, not from stored fields */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingTop: 8 }}>

          {/* GST toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-body)', cursor: 'pointer' }}>
              <input type="checkbox" checked={fields.gst_enabled || false} onChange={e => toggleGST(e.target.checked)} />
              Add GST
            </label>
            {fields.gst_enabled && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <input value={fields.gst_rate || 18}
                  onChange={e => updateGSTRate(Number(e.target.value))}
                  type="number" min="0" max="100" step="0.5"
                  className="input" style={{ width: 56, fontSize: 12, textAlign: 'right' }} />
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}>%</span>
              </div>
            )}
          </div>

          {/* Totals block */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 200 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}>
              <span>Subtotal</span>
              <span style={{ fontFamily: 'var(--font-mono)' }}>₹{subtotal.toLocaleString('en-IN')}</span>
            </div>
            {fields.gst_enabled && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}>
                <span>GST {currentGST}%</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>₹{gstAmount.toLocaleString('en-IN')}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-body)', borderTop: '1px solid var(--border-subtle)', paddingTop: 6, marginTop: 2 }}>
              <span>Total Due</span>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-green)', fontSize: 15 }}>₹{total.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>

        {lineItems.length === 0 && (
          <p style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-body)', textAlign: 'center', padding: '8px 0', fontStyle: 'italic' }}>
            No items yet — add at least one line item above
          </p>
        )}
      </EditorSection>

      {/* Payment Notes */}
      <EditorSection title="Notes">
        <Textarea value={fields.notes || ''} onChange={e => setField('notes', e.target.value)}
          placeholder="Optional notes to the client — e.g., Please include the invoice number in your payment reference. Late payments may incur interest at 2% per month."
          style={{ minHeight: 70 }} />
      </EditorSection>
    </div>
  );
}

// ─── DELIVERY EDITOR ──────────────────────────────────────────
type DeliverySectionType =
  | 'summary' | 'deliverables' | 'credentials' | 'maintenance'
  | 'support' | 'signatures';

const DELIVERY_SECTIONS: { type: DeliverySectionType; label: string; description: string }[] = [
  { type: 'summary',      label: 'Project Summary',    description: 'What was built and delivered' },
  { type: 'deliverables', label: 'Deliverables',        description: 'Links, files, and handover items' },
  { type: 'credentials',  label: 'Credentials & Access', description: 'Logins, keys, hosting access' },
  { type: 'maintenance',  label: 'Usage & Maintenance', description: 'How to use and maintain the work' },
  { type: 'support',      label: 'Support Period',      description: 'Post-delivery support terms' },
  { type: 'signatures',   label: 'Signatures',          description: 'Sender delivery + client acceptance' },
];

const DEFAULT_DELIVERY_SECTIONS: DeliverySectionType[] = [
  'summary', 'deliverables', 'maintenance', 'support', 'signatures',
];

function DeliveryEditor({ fields, setField }: { fields: any; setField: (k: string, v: any) => void }) {
  const activeSections: DeliverySectionType[] = fields.active_sections_delivery?.length
    ? fields.active_sections_delivery
    : DEFAULT_DELIVERY_SECTIONS;

  const [showAddSection, setShowAddSection] = useState(false);

  function addSection(type: DeliverySectionType) {
    if (activeSections.includes(type)) return;
    setField('active_sections_delivery', [...activeSections, type]);
    setShowAddSection(false);
  }
  function removeSection(type: DeliverySectionType) {
    setField('active_sections_delivery', activeSections.filter(s => s !== type));
  }

  const availableToAdd = DELIVERY_SECTIONS.filter(s => !activeSections.includes(s.type));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {activeSections.map(section => (
        <DeliverySection
          key={section} type={section}
          fields={fields} setField={setField}
          onRemove={() => removeSection(section)}
        />
      ))}

      {availableToAdd.length > 0 && (
        <div>
          {!showAddSection ? (
            <button onClick={() => setShowAddSection(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-default)', background: 'transparent', color: 'var(--text-tertiary)', fontSize: 12, fontFamily: 'var(--font-body)', cursor: 'pointer', transition: 'all 150ms', width: '100%', justifyContent: 'center' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent-blue)'; (e.currentTarget as HTMLElement).style.color = 'var(--accent-blue)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; }}>
              <Plus size={13} /> Add Section
            </button>
          ) : (
            <div style={{ padding: '14px', background: 'var(--bg-hover)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <p className="t-label">Add a section</p>
                <button onClick={() => setShowAddSection(false)}
                  style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex' }}>
                  <X size={14} />
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                {availableToAdd.map(s => (
                  <button key={s.type} onClick={() => addSection(s.type)}
                    style={{ padding: '9px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)', background: 'var(--bg-surface)', cursor: 'pointer', textAlign: 'left' as const, transition: 'all 150ms' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent-blue)'; (e.currentTarget as HTMLElement).style.background = 'var(--accent-blue-dim)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)'; (e.currentTarget as HTMLElement).style.background = 'var(--bg-surface)'; }}>
                    <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-body)', margin: 0 }}>{s.label}</p>
                    <p style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-body)', marginTop: 2, marginBottom: 0 }}>{s.description}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DeliverySection({ type, fields, setField, onRemove }: {
  type: DeliverySectionType; fields: any;
  setField: (k: string, v: any) => void; onRemove: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [newDel, setNewDel]       = useState({ title: '', link: '', description: '' });
  const [newCred, setNewCred]     = useState({ label: '', value: '', note: '' });
  const deliverables  = fields.deliverables  || [];
  const credentials   = fields.credentials   || [];
  const cfg = DELIVERY_SECTIONS.find(s => s.type === type);

  function addDeliverable() {
    if (!newDel.title.trim()) return;
    setField('deliverables', [...deliverables, { ...newDel, title: newDel.title.trim() }]);
    setNewDel({ title: '', link: '', description: '' });
  }
  function addCredential() {
    if (!newCred.label.trim() || !newCred.value.trim()) return;
    setField('credentials', [...credentials, { ...newCred, label: newCred.label.trim(), value: newCred.value.trim() }]);
    setNewCred({ label: '', value: '', note: '' });
  }

  return (
    <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', background: 'var(--bg-hover)', gap: 8 }}>
        <button onClick={() => setCollapsed(c => !c)}
          style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left' as const, padding: 0 }}>
          <span style={{ color: 'var(--text-tertiary)', display: 'flex', transition: 'transform 150ms', transform: collapsed ? 'rotate(-90deg)' : 'none' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m6 9 6 6 6-6"/></svg>
          </span>
          <p className="t-label" style={{ color: 'var(--text-secondary)', margin: 0 }}>{cfg?.label || type}</p>
        </button>
        <button onClick={onRemove} title="Remove this section"
          style={{ display: 'flex', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 2, borderRadius: 'var(--radius-sm)', transition: 'color 150ms' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent-red)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; }}>
          <X size={13} />
        </button>
      </div>

      {!collapsed && (
        <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: 12 }}>

          {type === 'summary' && (
            <>
              <Textarea value={fields.project_summary || ''} onChange={e => setField('project_summary', e.target.value)}
                placeholder="Briefly describe what was designed and built — the scope delivered, technologies used, and any notable decisions made during the project..." style={{ minHeight: 90 }} />
              <Input label="Delivery Date" type="date" value={fields.delivery_date || new Date().toISOString().split('T')[0]}
                onChange={e => setField('delivery_date', e.target.value)} />
            </>
          )}

          {type === 'deliverables' && (
            <>
              {deliverables.map((d: any, i: number) => (
                <div key={i} style={{ padding: '10px 12px', background: 'var(--bg-hover)', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <p className="t-xs-medium" style={{ margin: 0 }}>{d.title}</p>
                    {d.link && <p className="t-2xs" style={{ color: 'var(--accent-blue)', marginTop: 2, marginBottom: 0 }}>{d.link}</p>}
                    {d.description && <p className="t-2xs text-tertiary" style={{ marginTop: 2, marginBottom: 0 }}>{d.description}</p>}
                  </div>
                  <button onClick={() => setField('deliverables', deliverables.filter((_: any, idx: number) => idx !== i))}
                    style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', flexShrink: 0, transition: 'color 150ms' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent-red)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; }}>
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 12px', background: 'var(--bg-hover)', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--border-default)' }}>
                <input value={newDel.title}
                  onChange={e => setNewDel(d => ({ ...d, title: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') addDeliverable(); }}
                  placeholder="Deliverable name — e.g., Homepage design, Source code repository, Admin credentials" className="input" style={{ fontSize: 12 }} />
                <input value={newDel.link}
                  onChange={e => setNewDel(d => ({ ...d, link: e.target.value }))}
                  placeholder="URL or file path (optional) — e.g., https://github.com/org/repo, Figma link" className="input" style={{ fontSize: 12 }} />
                <input value={newDel.description}
                  onChange={e => setNewDel(d => ({ ...d, description: e.target.value }))}
                  placeholder="Notes — e.g., Password protected, requires client approval before going live" className="input" style={{ fontSize: 12 }} />
                <button onClick={addDeliverable}
                  style={{ padding: '5px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)', background: 'transparent', fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer', alignSelf: 'flex-end', fontFamily: 'var(--font-body)' }}>
                  + Add Deliverable
                </button>
              </div>
            </>
          )}

          {type === 'credentials' && (
            <>
              {/* Warning — credentials in a shared document need care */}
              <div style={{ padding: '10px 14px', background: 'var(--accent-amber-dim)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--accent-amber)', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 13, flexShrink: 0 }}>⚠</span>
                <p style={{ fontSize: 11, color: 'var(--accent-amber)', fontFamily: 'var(--font-body)', margin: 0, lineHeight: 1.5 }}>
                  This document will be shared with the client. Do not include passwords or API keys directly — list the credential name and instruct the client to request or reset them. Use a password manager to transfer sensitive values separately.
                </p>
              </div>
              {credentials.map((c: any, i: number) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '9px 12px', background: 'var(--bg-hover)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ flex: 1 }}>
                    <p className="t-xs-medium" style={{ margin: 0 }}>{c.label}</p>
                    <p className="t-2xs" style={{ color: 'var(--accent-blue)', marginTop: 2, marginBottom: 0 }}>{c.value}</p>
                    {c.note && <p className="t-2xs text-tertiary" style={{ marginTop: 2, marginBottom: 0 }}>{c.note}</p>}
                  </div>
                  <button onClick={() => setField('credentials', credentials.filter((_: any, idx: number) => idx !== i))}
                    style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', flexShrink: 0, transition: 'color 150ms' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent-red)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; }}>
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 12px', background: 'var(--bg-hover)', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--border-default)' }}>
                <input value={newCred.label}
                  onChange={e => setNewCred(c => ({ ...c, label: e.target.value }))}
                  placeholder="Access label — e.g., WordPress Admin, cPanel, Vercel, Figma" className="input" style={{ fontSize: 12 }} />
                <input value={newCred.value}
                  onChange={e => setNewCred(c => ({ ...c, value: e.target.value }))}
                  placeholder="URL or handle — e.g., https://yoursite.com/wp-admin, username: client@email.com" className="input" style={{ fontSize: 12 }} />
                <input value={newCred.note}
                  onChange={e => setNewCred(c => ({ ...c, note: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') addCredential(); }}
                  placeholder="Notes — e.g., Reset password on first login, 2FA enabled" className="input" style={{ fontSize: 12 }} />
                <button onClick={addCredential}
                  style={{ padding: '5px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)', background: 'transparent', fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer', alignSelf: 'flex-end', fontFamily: 'var(--font-body)' }}>
                  + Add Access Item
                </button>
              </div>
            </>
          )}

          {type === 'maintenance' && (
            <Textarea value={fields.usage_notes || ''} onChange={e => setField('usage_notes', e.target.value)}
              placeholder="Explain how to use and maintain the delivered work — how to update content, manage users, run backups, deploy changes, or handle common issues. Write this as if explaining to someone who will maintain it without your help..." style={{ minHeight: 100 }} />
          )}

          {type === 'support' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Input label="Support Ends On" type="date" value={fields.support_end_date || ''}
                  onChange={e => setField('support_end_date', e.target.value)} />
                <Input label="Support Contact" value={fields.support_contact || ''}
                  onChange={e => setField('support_contact', e.target.value)}
                  placeholder="e.g., hello@yourstudio.com or WhatsApp" />
              </div>
              <Textarea label="Support Terms" value={fields.support_terms || ''}
                onChange={e => setField('support_terms', e.target.value)}
                placeholder="What does support cover during this period? e.g., Bug fixes for issues arising from delivered work, minor content updates (under 1hr), email/WhatsApp response within 24hrs on business days. Does not cover new features or third-party service issues." style={{ minHeight: 80 }} />
            </>
          )}

          {type === 'signatures' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <SenderSignatureField value={fields.creator_signature || null} onChange={v => setField('creator_signature', v)} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label className="t-label">Client Acceptance</label>
                <div style={{ padding: '10px 14px', background: 'var(--bg-hover)', borderRadius: 'var(--radius-md)', fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'var(--font-body)', fontStyle: 'italic' }}>
                  Client confirms acceptance via the shared document link.
                </div>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}

// ─── SEND DOCUMENT DIALOG ─────────────────────────────────────
function SendDocumentDialog({ doc, onClose, onSent }: {
  doc: any; onClose: () => void; onSent: (updated: any) => void;
}) {
  const supabase = useRef(createClient()).current;
  const [sending, setSending]         = useState(false);
  const [sent, setSent]               = useState(doc.status === 'sent' || doc.status === 'viewed' || doc.status === 'signed');
  const [code, setCode]               = useState<string>(doc.access_code || '');
  const [expiresAt, setExpiresAt]     = useState<string>(doc.access_code_expires_at || '');
  const [copied, setCopied]           = useState<'link' | 'code' | null>(null);
  const [regenerating, setRegenerating] = useState(false);

  const shareUrl = doc.share_token
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/doc/${doc.share_token}`
    : null;

  async function handleGenerate() {
    setSending(true);
    const token   = doc.share_token || generateShareToken();
    const newCode = generateAccessCode();
    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data } = await supabase.from('documents')
      .update({ status: 'sent', share_token: token, access_code: newCode, access_code_expires_at: expires, updated_at: new Date().toISOString() })
      .eq('id', doc.id).select().single();
    if (data) { onSent(data); setCode(newCode); setExpiresAt(expires); setSent(true); }
    setSending(false);
  }

  async function handleRegenerate() {
    setRegenerating(true);
    const newCode = generateAccessCode();
    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data } = await supabase.from('documents')
      .update({ access_code: newCode, access_code_expires_at: expires })
      .eq('id', doc.id).select().single();
    if (data) { onSent(data); setCode(newCode); setExpiresAt(expires); }
    setRegenerating(false);
  }

  function copyText(text: string, type: 'link' | 'code') {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2500);
  }

  const expiryDate = expiresAt ? new Date(expiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  const isExpired  = expiresAt ? new Date(expiresAt) < new Date() : false;
  const typeLabel  = DOC_TYPES.find(d => d.value === doc.type)?.label || 'Document';

  return (
    <Modal open={true} onClose={onClose} title={`Send ${typeLabel}`} size="sm">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'var(--bg-hover)', borderRadius: 'var(--radius-md)' }}>
          <div style={{ width: 34, height: 34, borderRadius: 'var(--radius-sm)', background: 'var(--accent-blue-dim)', color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <FileText size={16} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p className="t-sm-semibold" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.title}</p>
            <p className="t-2xs text-tertiary" style={{ textTransform: 'capitalize' as const }}>{typeLabel}</p>
          </div>
          <StatusPill status={doc.status} docType={doc.type} />
        </div>

        {!sent ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p className="t-xs text-secondary">
              Sending generates a secure link and a 7-digit access code. Share the link via email and the code separately — e.g., via WhatsApp.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <Button variant="secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</Button>
              <Button onClick={handleGenerate} loading={sending} icon={<Send size={13} />} style={{ flex: 1 }}>
                Generate & Send
              </Button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <p className="t-label" style={{ marginBottom: 6 }}>Share Link</p>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1, padding: '9px 12px', background: 'var(--bg-hover)', borderRadius: 'var(--radius-md)', fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                  {shareUrl}
                </div>
                <button onClick={() => copyText(shareUrl!, 'link')}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', background: 'transparent', color: copied === 'link' ? 'var(--accent-green)' : 'var(--text-secondary)', fontSize: 12, fontFamily: 'var(--font-body)', cursor: 'pointer', transition: 'all 150ms', flexShrink: 0 }}>
                  {copied === 'link' ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
                </button>
              </div>
            </div>

            <div>
              <p className="t-label" style={{ marginBottom: 6 }}>Access Code</p>
              <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
                <div style={{ flex: 1, padding: '10px 16px', background: 'var(--bg-hover)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--font-display)', letterSpacing: 6, color: isExpired ? 'var(--accent-red)' : 'var(--text-primary)' }}>
                    {code}
                  </span>
                  {isExpired && <span style={{ fontSize: 10, color: 'var(--accent-red)', fontWeight: 600, textTransform: 'uppercase' as const }}>Expired</span>}
                </div>
                <button onClick={() => copyText(code, 'code')}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', background: 'transparent', color: copied === 'code' ? 'var(--accent-green)' : 'var(--text-secondary)', fontSize: 12, fontFamily: 'var(--font-body)', cursor: 'pointer', transition: 'all 150ms', flexShrink: 0 }}>
                  {copied === 'code' ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
                </button>
              </div>
              <p className="t-2xs text-tertiary" style={{ marginTop: 6 }}>
                {isExpired ? 'Code has expired — regenerate to create a new one.' : `Expires ${expiryDate}`}
              </p>
            </div>

            <div style={{ padding: '10px 14px', background: 'var(--accent-blue-dim)', borderRadius: 'var(--radius-md)', fontSize: 12, color: 'var(--accent-blue)', fontFamily: 'var(--font-body)', lineHeight: 1.5 }}>
              Send the link via email and the access code separately (e.g., WhatsApp) for security.
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button onClick={handleRegenerate} disabled={regenerating}
                style={{ fontSize: 12, color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)', transition: 'color 150ms' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent-amber)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; }}>
                {regenerating ? 'Regenerating...' : '↻ Regenerate access code'}
              </button>
              <Button variant="secondary" onClick={onClose}>Done</Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

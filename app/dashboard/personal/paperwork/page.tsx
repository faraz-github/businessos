'use client';

import { useState, useEffect } from 'react';
import { useBrand } from '@/lib/brand';
import { useCurrentUser } from '@/lib/auth/use-auth';
import { createClient } from '@/lib/supabase/client';
import { PageTransition } from '@/components/dashboard/PageTransition';
import { Card, Badge, Button, Tabs, Modal, Input, Select, EmptyState } from '@/components/ui';
import { formatDate, generateShareToken } from '@/lib/utils';
import { Plus, FileText, Send, Link2 } from 'lucide-react';
import type { Document as DocType, DocumentType, Client } from '@/types';

const docTypes: { value: DocumentType; label: string }[] = [
  { value: 'proposal', label: 'Proposal' },
  { value: 'contract', label: 'Contract' },
  { value: 'sow', label: 'Scope of Work' },
  { value: 'requirements', label: 'Requirements' },
  { value: 'invoice', label: 'Invoice' },
  { value: 'delivery', label: 'Delivery' },
];

const statusConfig: Record<string, { variant: any; label: string }> = {
  draft:  { variant: 'outline', label: 'Draft' },
  final:  { variant: 'blue',    label: 'Final' },
  sent:   { variant: 'amber',   label: 'Sent' },
  viewed: { variant: 'violet',  label: 'Viewed' },
  signed: { variant: 'green',   label: 'Signed' },
};

export default function PersonalPaperworkPage() {
  const { mode } = useBrand();
  const { user: currentUser } = useCurrentUser();
  const [activeType, setActiveType] = useState<DocumentType | 'all'>('all');
  const [documents, setDocuments] = useState<any[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    async function fetch() {
      setLoading(true);
      if (!currentUser) return;
      let query = supabase.from('documents').select('*, clients(name, company)')
        .eq('user_id', currentUser.id).eq('mode', mode).order('updated_at', { ascending: false });
      if (activeType !== 'all') query = query.eq('type', activeType);
      const { data } = await query;
      setDocuments(data || []);
      const { data: cl } = await supabase.from('clients').select('*').eq('user_id', currentUser.id).eq('mode', mode);
      setClients((cl as Client[]) || []);
      setLoading(false);
    }
    fetch();
  }, [mode, activeType, currentUser]);

  async function handleStatusChange(docId: string, newStatus: string) {
    const updates: Record<string, string> = { status: newStatus };
    if (newStatus === 'sent') updates.share_token = generateShareToken();
    await supabase.from('documents').update(updates).eq('id', docId);
    setDocuments((prev) => prev.map((d) => (d.id === docId ? { ...d, ...updates } : d)));
  }

  return (
    <PageTransition>
      <div className="flex flex-col gap-9">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="t-h1">Paperwork</h1>
            <p className="t-xs mt-1">Create and manage branded documents.</p>
          </div>
          <Button icon={<Plus size={14} />} onClick={() => setShowCreate(true)}>New Document</Button>
        </div>

        <Tabs
          tabs={[{ value: 'all', label: 'All' }, ...docTypes.map((t) => ({ value: t.value, label: t.label }))]}
          value={activeType}
          onChange={(v) => setActiveType(v as any)}
        />

        {documents.length === 0 ? (
          <Card>
            <EmptyState
              icon={<FileText />}
              title="No documents yet"
              description="Create your first proposal, contract, or invoice."
              action={<Button icon={<Plus size={14} />} onClick={() => setShowCreate(true)}>Create Document</Button>}
            />
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {documents.map((doc) => {
              const config = statusConfig[doc.status] || statusConfig.draft;
              const shareUrl = doc.share_token
                ? `${typeof window !== 'undefined' ? window.location.origin : ''}/doc/${doc.share_token}`
                : null;
              return (
                <Card key={doc.id} variant="base" className="flex items-center gap-4">
                  <div className="w-9 h-9 radius-md bg-accent-blue-dim flex items-center justify-center shrink-0">
                    <FileText size={16} style={{ color: 'var(--accent-blue)' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="t-sm-medium truncate">{doc.title || 'Untitled'}</p>
                      <Badge variant="outline">{doc.type}</Badge>
                      <Badge variant={config.variant}>{config.label}</Badge>
                    </div>
                    <p className="t-2xs text-tertiary mt-0.5">
                      {doc.clients?.name && `${doc.clients.name} · `}
                      Updated {formatDate(doc.updated_at)}
                      {doc.signed_at && ` · Signed by ${doc.signer_name}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {doc.status === 'draft' && (
                      <Button variant="ghost" size="sm" onClick={() => handleStatusChange(doc.id, 'sent')}>
                        <Send size={12} /> Send
                      </Button>
                    )}
                    {shareUrl && (
                      <Button variant="ghost" size="sm" onClick={() => navigator.clipboard.writeText(shareUrl)}>
                        <Link2 size={12} /> Copy Link
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        <CreateDocumentModal
          open={showCreate}
          onClose={() => setShowCreate(false)}
          mode={mode}
          clients={clients}
          currentUser={currentUser}
          onCreated={(doc) => { setDocuments((prev) => [doc, ...prev]); setShowCreate(false); }}
        />
      </div>
    </PageTransition>
  );
}

function CreateDocumentModal({ open, onClose, mode, clients, currentUser, onCreated }: {
  open: boolean; onClose: () => void; mode: string;
  clients: Client[]; currentUser: any; onCreated: (doc: any) => void;
}) {
  const [docType, setDocType] = useState<DocumentType>('proposal');
  const [title, setTitle] = useState('');
  const [clientId, setClientId] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    if (!currentUser) return;
    setSaving(true);
    const supabase = createClient();
    const { data, error } = await supabase.from('documents')
      .insert({ user_id: currentUser.id, mode, type: docType, title, client_id: clientId || null, fields: {}, status: 'draft' })
      .select('*, clients(name, company)').single();
    if (!error && data) onCreated(data);
    setSaving(false);
  }

  return (
    <Modal open={open} onClose={onClose} title="New Document" size="sm">
      <div className="flex flex-col gap-5">
        <Select label="Document Type" options={docTypes} value={docType} onChange={(e) => setDocType(e.target.value as DocumentType)} />
        <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Website Redesign Proposal" />
        <Select
          label="Client (Optional)"
          placeholder="Select client..."
          options={[{ value: '', label: 'None' }, ...clients.map((c) => ({ value: c.id, label: c.name }))]}
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
        />
        <div className="flex gap-2 pt-2 border-t-subtle">
          <Button variant="secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</Button>
          <Button onClick={handleCreate} loading={saving} style={{ flex: 1 }}>Create</Button>
        </div>
      </div>
    </Modal>
  );
}

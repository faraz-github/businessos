'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button, Input, Textarea, Card, Select } from '@/components/ui';
import { calculateGST, generateInvoiceNumber, cn } from '@/lib/utils';
import { Plus, Trash2, Save, Check } from 'lucide-react';
import type { Document as DocType, BrandProfile, DocumentType } from '@/types';

interface DocumentEditorProps {
  document: DocType;
  brand: BrandProfile | null;
  onSaved?: () => void;
}

export function DocumentEditor({ document: doc, brand, onSaved }: DocumentEditorProps) {
  const [fields, setFields] = useState<Record<string, any>>(doc.fields as Record<string, any>);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const supabase = createClient();

  function updateField(key: string, value: any) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    await supabase.from('documents').update({ fields }).eq('id', doc.id);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    setSaving(false);
    onSaved?.();
  }

  return (
    <div className="space-y-4">
      {doc.type === 'proposal' && <ProposalForm fields={fields} onChange={updateField} />}
      {doc.type === 'contract' && <ContractForm fields={fields} onChange={updateField} />}
      {doc.type === 'sow' && <SOWForm fields={fields} onChange={updateField} />}
      {doc.type === 'requirements' && <RequirementsForm fields={fields} onChange={updateField} />}
      {doc.type === 'invoice' && <InvoiceForm fields={fields} onChange={updateField} brand={brand} />}
      {doc.type === 'delivery' && <DeliveryForm fields={fields} onChange={updateField} />}

      <div className="flex gap-2 pt-4 border-t border-[var(--border-subtle)]">
        <Button icon={saved ? <Check size={14} /> : <Save size={14} />} loading={saving} onClick={handleSave}>
          {saved ? 'Saved!' : 'Save Document'}
        </Button>
      </div>
    </div>
  );
}

// ─── LIST HELPERS ───
function ListEditor({ label, items, onChange, placeholder }: {
  label: string; items: string[]; onChange: (items: string[]) => void; placeholder?: string;
}) {
  return (
    <div>
      <label className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--text-tertiary)] block mb-1.5">{label}</label>
      <div className="space-y-1.5">
        {(items || []).map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              value={item}
              onChange={(e) => { const next = [...items]; next[i] = e.target.value; onChange(next); }}
              className="flex-1 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[var(--radius-sm)] px-2.5 py-1.5 text-[12px] text-[var(--text-primary)] outline-none focus:border-[var(--accent-blue)]"
              placeholder={placeholder}
            />
            <button onClick={() => onChange(items.filter((_, idx) => idx !== i))} className="text-[var(--text-tertiary)] hover:text-[var(--accent-red)]">
              <Trash2 size={12} />
            </button>
          </div>
        ))}
        <button onClick={() => onChange([...(items || []), ''])} className="text-[11px] text-[var(--accent-blue)] flex items-center gap-1 hover:underline">
          <Plus size={11} /> Add item
        </button>
      </div>
    </div>
  );
}

// ─── PROPOSAL FORM ───
function ProposalForm({ fields, onChange }: { fields: any; onChange: (k: string, v: any) => void }) {
  return (
    <div className="space-y-4">
      <Input label="Client Name" value={fields.client_name || ''} onChange={(e) => onChange('client_name', e.target.value)} />
      <Input label="Project Title" value={fields.project_title || ''} onChange={(e) => onChange('project_title', e.target.value)} />
      <Textarea label="Overview" value={fields.overview || ''} onChange={(e) => onChange('overview', e.target.value)} placeholder="Describe the project..." />
      <ListEditor label="Inclusions" items={fields.inclusions || []} onChange={(v) => onChange('inclusions', v)} placeholder="What's included" />
      <ListEditor label="Exclusions" items={fields.exclusions || []} onChange={(v) => onChange('exclusions', v)} placeholder="What's not included" />
      <Input label="Timeline" value={fields.timeline || ''} onChange={(e) => onChange('timeline', e.target.value)} placeholder="e.g., 4-6 weeks" />
      <div className="grid grid-cols-2 gap-3">
        <Input label="Investment Amount (₹)" type="number" value={fields.investment_amount || ''} onChange={(e) => onChange('investment_amount', parseFloat(e.target.value) || 0)} />
        <Input label="Validity Period" value={fields.validity_period || ''} onChange={(e) => onChange('validity_period', e.target.value)} placeholder="e.g., 14 days" />
      </div>
      <Textarea label="Payment Terms" value={fields.payment_terms || ''} onChange={(e) => onChange('payment_terms', e.target.value)} placeholder="e.g., 50% upfront, 50% on delivery" />
      <Input label="Portfolio Reference (Optional)" value={fields.portfolio_reference || ''} onChange={(e) => onChange('portfolio_reference', e.target.value)} />
    </div>
  );
}

// ─── CONTRACT FORM ───
function ContractForm({ fields, onChange }: { fields: any; onChange: (k: string, v: any) => void }) {
  const schedule = fields.payment_schedule || [];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Input label="Party One (You)" value={fields.party_one || ''} onChange={(e) => onChange('party_one', e.target.value)} />
        <Input label="Party Two (Client)" value={fields.party_two || ''} onChange={(e) => onChange('party_two', e.target.value)} />
      </div>
      <Textarea label="Project Description" value={fields.project_description || ''} onChange={(e) => onChange('project_description', e.target.value)} />
      <Input label="Scope Reference" value={fields.scope_reference || ''} onChange={(e) => onChange('scope_reference', e.target.value)} placeholder="Link to SOW document" />

      {/* Payment Schedule */}
      <div>
        <label className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--text-tertiary)] block mb-1.5">Payment Schedule</label>
        <div className="space-y-2">
          {schedule.map((item: any, i: number) => (
            <div key={i} className="flex gap-2 items-end">
              <Input label={i === 0 ? 'Amount (₹)' : undefined} type="number" value={item.amount || ''} onChange={(e) => { const next = [...schedule]; next[i] = { ...item, amount: parseFloat(e.target.value) || 0 }; onChange('payment_schedule', next); }} className="w-28" />
              <Input label={i === 0 ? 'Trigger / Milestone' : undefined} value={item.trigger || ''} onChange={(e) => { const next = [...schedule]; next[i] = { ...item, trigger: e.target.value }; onChange('payment_schedule', next); }} className="flex-1" />
              <button onClick={() => onChange('payment_schedule', schedule.filter((_: any, idx: number) => idx !== i))} className="text-[var(--text-tertiary)] hover:text-[var(--accent-red)] pb-2"><Trash2 size={12} /></button>
            </div>
          ))}
          <button onClick={() => onChange('payment_schedule', [...schedule, { amount: 0, trigger: '' }])} className="text-[11px] text-[var(--accent-blue)] flex items-center gap-1"><Plus size={11} /> Add payment</button>
        </div>
      </div>

      <Textarea label="Revision Policy" value={fields.revision_policy || ''} onChange={(e) => onChange('revision_policy', e.target.value)} />
      <Textarea label="IP Clause" value={fields.ip_clause || ''} onChange={(e) => onChange('ip_clause', e.target.value)} />
      <Textarea label="Confidentiality Clause" value={fields.confidentiality_clause || ''} onChange={(e) => onChange('confidentiality_clause', e.target.value)} />
      <Textarea label="Termination Clause" value={fields.termination_clause || ''} onChange={(e) => onChange('termination_clause', e.target.value)} />
      <Input label="Governing Law" value={fields.governing_law || 'India'} onChange={(e) => onChange('governing_law', e.target.value)} />
    </div>
  );
}

// ─── SOW FORM ───
function SOWForm({ fields, onChange }: { fields: any; onChange: (k: string, v: any) => void }) {
  const deliverables = fields.deliverables || [];
  const milestones = fields.milestone_schedule || [];

  return (
    <div className="space-y-4">
      <Textarea label="Objectives" value={fields.objectives || ''} onChange={(e) => onChange('objectives', e.target.value)} />

      <div>
        <label className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--text-tertiary)] block mb-1.5">Deliverables</label>
        {deliverables.map((d: any, i: number) => (
          <div key={i} className="flex gap-2 items-start mb-2">
            <div className="flex-1 space-y-1">
              <Input placeholder="Title" value={d.title || ''} onChange={(e) => { const next = [...deliverables]; next[i] = { ...d, title: e.target.value }; onChange('deliverables', next); }} />
              <Input placeholder="Description" value={d.description || ''} onChange={(e) => { const next = [...deliverables]; next[i] = { ...d, description: e.target.value }; onChange('deliverables', next); }} />
            </div>
            <button onClick={() => onChange('deliverables', deliverables.filter((_: any, idx: number) => idx !== i))} className="text-[var(--text-tertiary)] hover:text-[var(--accent-red)] mt-2"><Trash2 size={12} /></button>
          </div>
        ))}
        <button onClick={() => onChange('deliverables', [...deliverables, { title: '', description: '' }])} className="text-[11px] text-[var(--accent-blue)] flex items-center gap-1"><Plus size={11} /> Add deliverable</button>
      </div>

      <ListEditor label="Out of Scope" items={fields.out_of_scope || []} onChange={(v) => onChange('out_of_scope', v)} />

      <div>
        <label className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--text-tertiary)] block mb-1.5">Milestone Schedule</label>
        {milestones.map((m: any, i: number) => (
          <div key={i} className="flex gap-2 mb-2">
            <Input placeholder="Milestone" value={m.milestone || ''} onChange={(e) => { const next = [...milestones]; next[i] = { ...m, milestone: e.target.value }; onChange('milestone_schedule', next); }} className="flex-1" />
            <Input type="date" value={m.target_date || ''} onChange={(e) => { const next = [...milestones]; next[i] = { ...m, target_date: e.target.value }; onChange('milestone_schedule', next); }} className="w-40" />
            <button onClick={() => onChange('milestone_schedule', milestones.filter((_: any, idx: number) => idx !== i))} className="text-[var(--text-tertiary)] hover:text-[var(--accent-red)]"><Trash2 size={12} /></button>
          </div>
        ))}
        <button onClick={() => onChange('milestone_schedule', [...milestones, { milestone: '', target_date: '' }])} className="text-[11px] text-[var(--accent-blue)] flex items-center gap-1"><Plus size={11} /> Add milestone</button>
      </div>

      <Textarea label="Acceptance Criteria" value={fields.acceptance_criteria || ''} onChange={(e) => onChange('acceptance_criteria', e.target.value)} />
      <ListEditor label="Assumptions" items={fields.assumptions || []} onChange={(v) => onChange('assumptions', v)} />
      <ListEditor label="Dependencies" items={fields.dependencies || []} onChange={(v) => onChange('dependencies', v)} />
    </div>
  );
}

// ─── REQUIREMENTS FORM ───
function RequirementsForm({ fields, onChange }: { fields: any; onChange: (k: string, v: any) => void }) {
  const requirements = fields.functional_requirements || [];

  return (
    <div className="space-y-4">
      <Textarea label="Project Background" value={fields.project_background || ''} onChange={(e) => onChange('project_background', e.target.value)} />

      <div>
        <label className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--text-tertiary)] block mb-1.5">Functional Requirements</label>
        {requirements.map((r: any, i: number) => (
          <div key={i} className="flex items-center gap-2 mb-1.5">
            <input
              type="checkbox"
              checked={r.completed || false}
              onChange={(e) => { const next = [...requirements]; next[i] = { ...r, completed: e.target.checked }; onChange('functional_requirements', next); }}
              className="accent-[var(--accent-blue)]"
            />
            <input
              value={r.requirement || ''}
              onChange={(e) => { const next = [...requirements]; next[i] = { ...r, requirement: e.target.value }; onChange('functional_requirements', next); }}
              className="flex-1 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[var(--radius-sm)] px-2.5 py-1.5 text-[12px] text-[var(--text-primary)] outline-none focus:border-[var(--accent-blue)]"
              placeholder="Requirement"
            />
            <button onClick={() => onChange('functional_requirements', requirements.filter((_: any, idx: number) => idx !== i))} className="text-[var(--text-tertiary)] hover:text-[var(--accent-red)]"><Trash2 size={12} /></button>
          </div>
        ))}
        <button onClick={() => onChange('functional_requirements', [...requirements, { requirement: '', completed: false }])} className="text-[11px] text-[var(--accent-blue)] flex items-center gap-1"><Plus size={11} /> Add requirement</button>
      </div>

      <ListEditor label="Design References" items={fields.design_references || []} onChange={(v) => onChange('design_references', v)} placeholder="URL or description" />
      <Textarea label="Content Responsibilities" value={fields.content_responsibilities || ''} onChange={(e) => onChange('content_responsibilities', e.target.value)} />
      <ListEditor label="Technical Access Required" items={fields.technical_access || []} onChange={(v) => onChange('technical_access', v)} />
      <Input label="Deadline Expectations" value={fields.deadline_expectations || ''} onChange={(e) => onChange('deadline_expectations', e.target.value)} />
    </div>
  );
}

// ─── INVOICE FORM ───
function InvoiceForm({ fields, onChange, brand }: { fields: any; onChange: (k: string, v: any) => void; brand: BrandProfile | null }) {
  const lineItems = fields.line_items || [];
  const gstEnabled = fields.gst_enabled !== false;
  const gstRate = fields.gst_rate || 18;

  function recalculate(items: any[], gst: boolean, rate: number) {
    const subtotal = items.reduce((sum: number, item: any) => sum + (item.amount || 0), 0);
    const { gst: gstAmount, total } = gst ? calculateGST(subtotal, rate) : { gst: 0, total: subtotal };
    onChange('subtotal', subtotal);
    onChange('gst_amount', gstAmount);
    onChange('total', total);
  }

  function updateLineItem(index: number, key: string, value: any) {
    const next = [...lineItems];
    next[index] = { ...next[index], [key]: value };
    if (key === 'quantity' || key === 'rate') {
      next[index].amount = (next[index].quantity || 1) * (next[index].rate || 0);
    }
    onChange('line_items', next);
    recalculate(next, gstEnabled, gstRate);
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Input label="Invoice Number" value={fields.invoice_number || ''} onChange={(e) => onChange('invoice_number', e.target.value)} />
        <Input label="Due Date" type="date" value={fields.due_date || ''} onChange={(e) => onChange('due_date', e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input label="Client Name" value={fields.client_name || ''} onChange={(e) => onChange('client_name', e.target.value)} />
        <Input label="Client Company" value={fields.client_company || ''} onChange={(e) => onChange('client_company', e.target.value)} />
      </div>
      <Textarea label="Client Address" value={fields.client_address || ''} onChange={(e) => onChange('client_address', e.target.value)} className="min-h-[60px]" />

      {/* Line Items */}
      <div>
        <label className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--text-tertiary)] block mb-1.5">Line Items</label>
        <div className="space-y-2">
          {lineItems.map((item: any, i: number) => (
            <div key={i} className="grid grid-cols-[1fr_60px_80px_80px_24px] gap-2 items-end">
              <Input label={i === 0 ? 'Description' : undefined} value={item.description || ''} onChange={(e) => updateLineItem(i, 'description', e.target.value)} />
              <Input label={i === 0 ? 'Qty' : undefined} type="number" value={item.quantity || 1} onChange={(e) => updateLineItem(i, 'quantity', parseFloat(e.target.value) || 1)} />
              <Input label={i === 0 ? 'Rate' : undefined} type="number" value={item.rate || ''} onChange={(e) => updateLineItem(i, 'rate', parseFloat(e.target.value) || 0)} />
              <div className={cn(i === 0 && 'pt-[22px]')}>
                <p className="text-[12px] text-[var(--text-secondary)] py-2 text-right font-mono">₹{(item.amount || 0).toLocaleString('en-IN')}</p>
              </div>
              <button onClick={() => { const next = lineItems.filter((_: any, idx: number) => idx !== i); onChange('line_items', next); recalculate(next, gstEnabled, gstRate); }} className={cn('text-[var(--text-tertiary)] hover:text-[var(--accent-red)]', i === 0 && 'mt-5')}><Trash2 size={12} /></button>
            </div>
          ))}
          <button onClick={() => { onChange('line_items', [...lineItems, { description: '', quantity: 1, rate: 0, amount: 0 }]); }} className="text-[11px] text-[var(--accent-blue)] flex items-center gap-1"><Plus size={11} /> Add line item</button>
        </div>
      </div>

      {/* GST Toggle */}
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={gstEnabled} onChange={(e) => { onChange('gst_enabled', e.target.checked); recalculate(lineItems, e.target.checked, gstRate); }} className="accent-[var(--accent-blue)]" />
          <span className="text-[12px] text-[var(--text-primary)]">Apply GST</span>
        </label>
        {gstEnabled && (
          <Input label="GST Rate (%)" type="number" value={gstRate} onChange={(e) => { const rate = parseFloat(e.target.value) || 18; onChange('gst_rate', rate); recalculate(lineItems, true, rate); }} className="w-24" />
        )}
      </div>

      {/* Totals */}
      <Card variant="base" className="text-right space-y-1">
        <div className="flex justify-between text-[12px]">
          <span className="text-[var(--text-tertiary)]">Subtotal</span>
          <span className="font-mono">₹{(fields.subtotal || 0).toLocaleString('en-IN')}</span>
        </div>
        {gstEnabled && (
          <div className="flex justify-between text-[12px]">
            <span className="text-[var(--text-tertiary)]">GST ({gstRate}%)</span>
            <span className="font-mono">₹{(fields.gst_amount || 0).toLocaleString('en-IN')}</span>
          </div>
        )}
        <div className="flex justify-between text-sm font-bold border-t border-[var(--border-subtle)] pt-2 mt-2">
          <span>Total</span>
          <span className="font-display text-[var(--accent-blue)]">₹{(fields.total || 0).toLocaleString('en-IN')}</span>
        </div>
      </Card>

      <Textarea label="Payment Instructions" value={fields.payment_instructions || ''} onChange={(e) => onChange('payment_instructions', e.target.value)} placeholder="Bank details, UPI, etc. (auto-filled from brand if empty)" />
    </div>
  );
}

// ─── DELIVERY FORM ───
function DeliveryForm({ fields, onChange }: { fields: any; onChange: (k: string, v: any) => void }) {
  const deliverables = fields.deliverables || [];
  const credentials = fields.credentials || [];

  return (
    <div className="space-y-4">
      <Textarea label="Project Summary" value={fields.project_summary || ''} onChange={(e) => onChange('project_summary', e.target.value)} />

      <div>
        <label className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--text-tertiary)] block mb-1.5">Deliverables</label>
        {deliverables.map((d: any, i: number) => (
          <div key={i} className="flex gap-2 mb-2 items-start">
            <div className="flex-1 space-y-1">
              <Input placeholder="Title" value={d.title || ''} onChange={(e) => { const next = [...deliverables]; next[i] = { ...d, title: e.target.value }; onChange('deliverables', next); }} />
              <Input placeholder="Link (optional)" value={d.link || ''} onChange={(e) => { const next = [...deliverables]; next[i] = { ...d, link: e.target.value }; onChange('deliverables', next); }} />
            </div>
            <button onClick={() => onChange('deliverables', deliverables.filter((_: any, idx: number) => idx !== i))} className="text-[var(--text-tertiary)] hover:text-[var(--accent-red)] mt-2"><Trash2 size={12} /></button>
          </div>
        ))}
        <button onClick={() => onChange('deliverables', [...deliverables, { title: '', link: '' }])} className="text-[11px] text-[var(--accent-blue)] flex items-center gap-1"><Plus size={11} /> Add deliverable</button>
      </div>

      <div>
        <label className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--text-tertiary)] block mb-1.5">Credentials</label>
        {credentials.map((c: any, i: number) => (
          <div key={i} className="flex gap-2 mb-2">
            <Input placeholder="Service" value={c.service || ''} onChange={(e) => { const next = [...credentials]; next[i] = { ...c, service: e.target.value }; onChange('credentials', next); }} className="w-40" />
            <Input placeholder="Details" value={c.details || ''} onChange={(e) => { const next = [...credentials]; next[i] = { ...c, details: e.target.value }; onChange('credentials', next); }} className="flex-1" />
            <button onClick={() => onChange('credentials', credentials.filter((_: any, idx: number) => idx !== i))} className="text-[var(--text-tertiary)] hover:text-[var(--accent-red)]"><Trash2 size={12} /></button>
          </div>
        ))}
        <button onClick={() => onChange('credentials', [...credentials, { service: '', details: '' }])} className="text-[11px] text-[var(--accent-blue)] flex items-center gap-1"><Plus size={11} /> Add credentials</button>
      </div>

      <Textarea label="Usage & Maintenance Notes" value={fields.usage_notes || ''} onChange={(e) => onChange('usage_notes', e.target.value)} />
      <Textarea label="Support Period Details" value={fields.support_period_details || ''} onChange={(e) => onChange('support_period_details', e.target.value)} />
    </div>
  );
}

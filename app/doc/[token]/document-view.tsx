'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { formatDate, formatINR, stageLabel } from '@/lib/utils';
import { motion } from 'framer-motion';
import { Check, FileText, Download } from 'lucide-react';
import type { Document, BrandProfile } from '@/types';

interface DocumentViewProps {
  document: Document;
  brand: BrandProfile | null;
}

export function DocumentView({ document: doc, brand }: DocumentViewProps) {
  const [signerName, setSignerName] = useState('');
  const [signing, setSigning] = useState(false);
  const [signed, setSigned] = useState(!!doc.signed_at);
  const fields = doc.fields as Record<string, any>;
  const showSignature = ['contract', 'proposal'].includes(doc.type) && !signed;

  async function handleSign() {
    if (!signerName.trim()) return;
    setSigning(true);
    try {
      const supabase = createClient();

      // Insert signature
      await supabase.from('signatures').insert({
        document_id: doc.id,
        signer_name: signerName,
      });

      // Update document
      await supabase.from('documents').update({
        status: 'signed',
        signed_at: new Date().toISOString(),
        signer_name: signerName,
      }).eq('id', doc.id);

      setSigned(true);
    } catch (error) {
      console.error('Signing failed:', error);
    } finally {
      setSigning(false);
    }
  }

  const primaryColor = brand?.primary_colour || '#4F8EF7';
  const secondaryColor = brand?.secondary_colour || '#8B6CF7';

  return (
    <div className="min-h-screen bg-[#F0F2F7]">
      <div className="max-w-3xl mx-auto py-8 px-4">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="bg-white rounded-2xl shadow-lg overflow-hidden"
        >
          {/* Header */}
          <div className="p-8 border-b" style={{ borderBottomColor: primaryColor + '20' }}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                {brand?.logo_url ? (
                  <img src={brand.logo_url} alt={brand.business_name} className="w-12 h-12 rounded-xl object-cover" />
                ) : (
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-lg font-bold"
                    style={{ background: primaryColor }}
                  >
                    {(brand?.business_name || '?')[0]}
                  </div>
                )}
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">{brand?.business_name || 'Business'}</h2>
                  {brand?.tagline && <p className="text-sm text-gray-500">{brand.tagline}</p>}
                </div>
              </div>
              <div className="text-right">
                <Badge variant={doc.type === 'invoice' ? 'green' : 'blue'} className="capitalize text-xs">
                  {doc.type}
                </Badge>
                {signed && (
                  <div className="mt-2">
                    <Badge variant="green" dot>Signed</Badge>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Document Title */}
          <div className="px-8 pt-6">
            <h1 className="text-2xl font-bold text-gray-900">{doc.title || `${doc.type.charAt(0).toUpperCase() + doc.type.slice(1)}`}</h1>
            <p className="text-sm text-gray-500 mt-1">Created {formatDate(doc.created_at)}</p>
          </div>

          {/* Document Content */}
          <div className="px-8 py-6 space-y-6">
            {/* Render fields based on document type */}
            {doc.type === 'proposal' && <ProposalView fields={fields} color={primaryColor} />}
            {doc.type === 'contract' && <ContractView fields={fields} color={primaryColor} />}
            {doc.type === 'sow' && <SOWView fields={fields} color={primaryColor} />}
            {doc.type === 'requirements' && <RequirementsView fields={fields} color={primaryColor} />}
            {doc.type === 'invoice' && <InvoiceView fields={fields} color={primaryColor} brand={brand} />}
            {doc.type === 'delivery' && <DeliveryView fields={fields} color={primaryColor} />}

            {/* Generic fallback for empty fields */}
            {Object.keys(fields).length === 0 && (
              <p className="text-gray-500 italic text-sm">This document is being prepared. Content will appear here once finalized.</p>
            )}
          </div>

          {/* Signature Section */}
          {showSignature && (
            <div className="px-8 py-6 border-t border-gray-100 bg-gray-50/50">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">E-Signature</h3>
              <p className="text-sm text-gray-500 mb-4">
                By typing your name below and clicking &quot;Sign&quot;, you agree to the terms outlined in this document.
              </p>
              <div className="flex items-end gap-3 max-w-md">
                <div className="flex-1">
                  <Input
                    label="Your Full Name"
                    value={signerName}
                    onChange={(e) => setSignerName(e.target.value)}
                    placeholder="Type your full name"
                    className="!bg-white"
                  />
                </div>
                <Button onClick={handleSign} loading={signing} disabled={!signerName.trim()} size="lg">
                  <Check size={14} /> Sign Document
                </Button>
              </div>
            </div>
          )}

          {signed && (
            <div className="px-8 py-6 border-t border-gray-100 bg-green-50/50">
              <div className="flex items-center gap-2">
                <Check size={16} className="text-green-600" />
                <span className="text-sm font-medium text-green-800">
                  Signed by {doc.signer_name || signerName} on {formatDate(doc.signed_at || new Date().toISOString())}
                </span>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="px-8 py-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
            <span>{brand?.business_name} · {brand?.email}</span>
            <span>{brand?.phone}</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

// ─── Document Type Renderers ───

function SectionTitle({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <h3 className="text-sm font-semibold text-gray-900 pb-2 mb-3 border-b-2" style={{ borderColor: color + '30' }}>
      {children}
    </h3>
  );
}

function ProposalView({ fields, color }: { fields: any; color: string }) {
  return (
    <>
      {fields.overview && <><SectionTitle color={color}>Overview</SectionTitle><p className="text-sm text-gray-700 leading-relaxed">{fields.overview}</p></>}
      {fields.inclusions?.length > 0 && (
        <><SectionTitle color={color}>What&apos;s Included</SectionTitle>
          <ul className="flex flex-col gap-1">{fields.inclusions.map((item: string, i: number) => <li key={i} className="text-sm text-gray-700 flex items-start gap-2"><span style={{ color }}>✓</span>{item}</li>)}</ul>
        </>
      )}
      {fields.exclusions?.length > 0 && (
        <><SectionTitle color={color}>Exclusions</SectionTitle>
          <ul className="flex flex-col gap-1">{fields.exclusions.map((item: string, i: number) => <li key={i} className="text-sm text-gray-500 flex items-start gap-2"><span>✗</span>{item}</li>)}</ul>
        </>
      )}
      {fields.timeline && <><SectionTitle color={color}>Timeline</SectionTitle><p className="text-sm text-gray-700">{fields.timeline}</p></>}
      {fields.investment_amount && (
        <div className="p-4 rounded-xl" style={{ background: color + '08' }}>
          <p className="text-sm text-gray-500">Investment</p>
          <p className="text-2xl font-bold" style={{ color }}>{formatINR(fields.investment_amount)}</p>
          {fields.payment_terms && <p className="text-sm text-gray-500 mt-1">{fields.payment_terms}</p>}
        </div>
      )}
    </>
  );
}

function ContractView({ fields, color }: { fields: any; color: string }) {
  return (
    <>
      {fields.project_description && <><SectionTitle color={color}>Project Description</SectionTitle><p className="text-sm text-gray-700 leading-relaxed">{fields.project_description}</p></>}
      {fields.payment_schedule?.length > 0 && (
        <><SectionTitle color={color}>Payment Schedule</SectionTitle>
          <div className="flex flex-col gap-2">{fields.payment_schedule.map((p: any, i: number) => (
            <div key={i} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg text-sm">
              <span className="text-gray-700">{p.trigger}</span>
              <span className="font-semibold" style={{ color }}>{formatINR(p.amount)}</span>
            </div>
          ))}</div>
        </>
      )}
      {fields.revision_policy && <><SectionTitle color={color}>Revision Policy</SectionTitle><p className="text-sm text-gray-700">{fields.revision_policy}</p></>}
      {fields.ip_clause && <><SectionTitle color={color}>Intellectual Property</SectionTitle><p className="text-sm text-gray-700">{fields.ip_clause}</p></>}
      {fields.confidentiality_clause && <><SectionTitle color={color}>Confidentiality</SectionTitle><p className="text-sm text-gray-700">{fields.confidentiality_clause}</p></>}
      {fields.termination_clause && <><SectionTitle color={color}>Termination</SectionTitle><p className="text-sm text-gray-700">{fields.termination_clause}</p></>}
    </>
  );
}

function SOWView({ fields, color }: { fields: any; color: string }) {
  return (
    <>
      {fields.objectives && <><SectionTitle color={color}>Objectives</SectionTitle><p className="text-sm text-gray-700">{fields.objectives}</p></>}
      {fields.deliverables?.length > 0 && (
        <><SectionTitle color={color}>Deliverables</SectionTitle>
          <div className="flex flex-col gap-2">{fields.deliverables.map((d: any, i: number) => (
            <div key={i} className="p-3 bg-gray-50 rounded-lg"><p className="text-sm font-medium text-gray-900">{d.title}</p><p className="text-sm text-gray-600 mt-1">{d.description}</p></div>
          ))}</div>
        </>
      )}
      {fields.milestone_schedule?.length > 0 && (
        <><SectionTitle color={color}>Milestones</SectionTitle>
          <div className="flex flex-col gap-2">{fields.milestone_schedule.map((m: any, i: number) => (
            <div key={i} className="flex justify-between text-sm p-2"><span className="text-gray-700">{m.milestone}</span><span className="text-gray-500">{m.target_date}</span></div>
          ))}</div>
        </>
      )}
    </>
  );
}

function RequirementsView({ fields, color }: { fields: any; color: string }) {
  return (
    <>
      {fields.project_background && <><SectionTitle color={color}>Background</SectionTitle><p className="text-sm text-gray-700">{fields.project_background}</p></>}
      {fields.functional_requirements?.length > 0 && (
        <><SectionTitle color={color}>Requirements</SectionTitle>
          <div className="flex flex-col gap-1">{fields.functional_requirements.map((r: any, i: number) => (
            <div key={i} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={r.completed} readOnly className="accent-current" style={{ accentColor: color }} /><span className="text-gray-700">{r.requirement}</span></div>
          ))}</div>
        </>
      )}
    </>
  );
}

function InvoiceView({ fields, color, brand }: { fields: any; color: string; brand: BrandProfile | null }) {
  return (
    <>
      <div className="flex justify-between items-start">
        <div><p className="text-sm text-gray-500">Invoice To</p><p className="font-semibold text-gray-900">{fields.client_name}</p>{fields.client_company && <p className="text-sm text-gray-600">{fields.client_company}</p>}</div>
        <div className="text-right"><p className="text-sm text-gray-500">Invoice #</p><p className="font-mono font-semibold" style={{ color }}>{fields.invoice_number}</p><p className="text-sm text-gray-500 mt-1">Due: {fields.due_date}</p></div>
      </div>
      {fields.line_items?.length > 0 && (
        <table className="w-full text-sm mt-4">
          <thead><tr className="border-b"><th className="text-left py-2 text-gray-500">Description</th><th className="text-right py-2 text-gray-500">Qty</th><th className="text-right py-2 text-gray-500">Rate</th><th className="text-right py-2 text-gray-500">Amount</th></tr></thead>
          <tbody>
            {fields.line_items.map((item: any, i: number) => (
              <tr key={i} className="border-b border-gray-100"><td className="py-2 text-gray-700">{item.description}</td><td className="text-right text-gray-600">{item.quantity}</td><td className="text-right text-gray-600">{formatINR(item.rate)}</td><td className="text-right font-medium">{formatINR(item.amount)}</td></tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="flex justify-end mt-4">
        <div className="w-48 space-y-1 text-sm">
          <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>{formatINR(fields.subtotal || 0)}</span></div>
          {fields.gst_enabled && <div className="flex justify-between"><span className="text-gray-500">GST ({fields.gst_rate}%)</span><span>{formatINR(fields.gst_amount || 0)}</span></div>}
          <div className="flex justify-between font-bold text-base pt-2 border-t"><span>Total</span><span style={{ color }}>{formatINR(fields.total || 0)}</span></div>
        </div>
      </div>
      {brand?.bank_name && (
        <div className="mt-6 p-4 bg-gray-50 rounded-xl text-sm"><p className="font-medium text-gray-900 mb-1">Payment Details</p><p className="text-gray-600">{brand.bank_name} · A/C: {brand.bank_account_number} · IFSC: {brand.bank_ifsc}</p>{brand.bank_upi && <p className="text-gray-600">UPI: {brand.bank_upi}</p>}</div>
      )}
    </>
  );
}

function DeliveryView({ fields, color }: { fields: any; color: string }) {
  return (
    <>
      {fields.project_summary && <><SectionTitle color={color}>Project Summary</SectionTitle><p className="text-sm text-gray-700">{fields.project_summary}</p></>}
      {fields.deliverables?.length > 0 && (
        <><SectionTitle color={color}>Deliverables</SectionTitle>
          <div className="flex flex-col gap-2">{fields.deliverables.map((d: any, i: number) => (
            <div key={i} className="p-3 bg-gray-50 rounded-lg"><p className="text-sm font-medium text-gray-900">{d.title}</p>{d.link && <a href={d.link} className="text-sm" style={{ color }}>{d.link}</a>}{d.description && <p className="text-sm text-gray-600 mt-1">{d.description}</p>}</div>
          ))}</div>
        </>
      )}
      {fields.usage_notes && <><SectionTitle color={color}>Usage & Maintenance</SectionTitle><p className="text-sm text-gray-700">{fields.usage_notes}</p></>}
    </>
  );
}

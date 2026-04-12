'use client';

import { useState, useRef, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatDate, formatINR } from '@/lib/utils';
import { motion } from 'framer-motion';
import { Check, Shield, Lock, Pen, Type, Calendar, Printer } from 'lucide-react';
import type { Document, BrandProfile } from '@/types';

const FONTS = `https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700;800&family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap`;

interface DocumentViewProps {
  // access_code and access_code_expires_at are stripped server-side.
  // has_access_code tells us whether to show the gate UI.
  document: Document & { has_access_code?: boolean };
  brand: BrandProfile | null;
}

// ─── MAIN EXPORT ─────────────────────────────────────────────
export function DocumentView({ document: doc, brand }: DocumentViewProps) {
  const supabaseRef = useRef(createClient());
  const supabase    = supabaseRef.current;

  // If doc has no access_code set, it's open to view directly.
  // has_access_code is a boolean set server-side — the actual code never reaches the browser.
  const [unlocked, setUnlocked]       = useState(!doc.has_access_code);
  const [showSignModal, setShowSignModal] = useState(false);
  const [signed, setSigned]           = useState(!!doc.signed_at);
  const [signerName, setSignerName]   = useState(doc.signer_name || '');
  const [signedDate, setSignedDate]   = useState(doc.signed_at || '');
  // Live fields state — updated immediately after signing so the
  // signature renders without a page reload.
  const [liveFields, setLiveFields]   = useState<Record<string, any>>(
    (doc.fields as Record<string, any>) || {}
  );

  const primary = brand?.primary_colour || '#4F8EF7';
  const bizName = brand?.business_name  || 'Business';
  // Proposals do not get signed — they are one-way selling documents.
  // Only contracts, SOWs, requirements docs, and delivery docs get client signatures.
  const canSign = ['contract', 'sow', 'requirements', 'delivery'].includes(doc.type) && !signed;

  // Access code is verified server-side via POST /api/doc/verify-code.
  // The actual code value is never sent to the browser.
  async function handleUnlock(code: string): Promise<string | null> {
    try {
      const res = await fetch('/api/doc/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: doc.share_token, code }),
      });
      const data = await res.json();
      if (!res.ok) return data.error ?? 'Incorrect code. Please check and try again.';
      setUnlocked(true);
      return null; // null = success
    } catch {
      return 'Something went wrong. Please try again.';
    }
  }

  async function handleSign(type: string, data: string, date: string) {
    try {
      const resolvedName = type === 'typed' ? data : '(drawn signature)';
      const clientSig    = { type, data, date, name: resolvedName };
      const updatedFields = { ...liveFields, client_signature: clientSig };

      await supabase.from('signatures').insert({
        document_id: doc.id,
        signer_name: resolvedName,
        signature_type: type,
        signature_data: data,
        signed_date: date,
      });
      await supabase.from('documents').update({
        status: 'signed',
        signed_at: new Date().toISOString(),
        signer_name: resolvedName,
        fields: updatedFields,
      }).eq('id', doc.id);

      // Update local state immediately — no page reload needed.
      // The signature renders as soon as the DB write completes.
      setLiveFields(updatedFields);
      setSigned(true);
      setSignerName(resolvedName);
      setSignedDate(new Date().toISOString());
      setShowSignModal(false);
    } catch (err) { console.error('Signing failed:', err); }
  }

  if (!unlocked) {
    return (
      <AccessGate
        bizName={bizName}
        primary={primary}
        onUnlock={handleUnlock}
      />
    );
  }

  return (
    <>
      <DocumentBody
        doc={doc} liveFields={liveFields} brand={brand} primary={primary} bizName={bizName}
        signed={signed} signerName={signerName} signedDate={signedDate}
        canSign={canSign} onOpenSign={() => setShowSignModal(true)}
      />
      {showSignModal && (
        <SignModal primary={primary} onSign={handleSign} onClose={() => setShowSignModal(false)} />
      )}
    </>
  );
}

// ─── ACCESS GATE ─────────────────────────────────────────────
function AccessGate({ bizName, primary, onUnlock }: {
  bizName: string;
  primary: string;
  onUnlock: (code: string) => Promise<string | null>;
}) {
  const [code, setCode]       = useState('');
  const [error, setError]     = useState('');
  const [checking, setChecking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 100); }, []);

  async function handleSubmit() {
    if (code.length < 7) return;
    setChecking(true);
    setError('');
    const err = await onUnlock(code);
    if (err) { setError(err); setCode(''); setChecking(false); }
    // if err is null, parent sets unlocked=true and this component unmounts
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F2F4F8', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'DM Sans, sans-serif' }}>
      <link href={FONTS} rel="stylesheet" />
      <motion.div
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
        style={{ width: '100%', maxWidth: 360, background: '#fff', borderRadius: 20, padding: '36px 32px', boxShadow: '0 8px 40px rgba(0,0,0,0.10)' }}>

        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: `${primary}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', border: `1px solid ${primary}28` }}>
            <Lock size={22} style={{ color: primary }} />
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: '#111318', margin: 0, fontFamily: 'Space Grotesk, sans-serif' }}>
            Protected Document
          </h2>
          <p style={{ fontSize: 13, color: '#6b7280', margin: '8px 0 0', lineHeight: 1.6 }}>
            {bizName} shared a document with you.<br />Enter your access code to view it.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
              Access Code
            </label>
            <input
              ref={inputRef}
              value={code}
              onChange={e => { setCode(e.target.value.replace(/\D/g, '').slice(0, 7)); setError(''); }}
              onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
              placeholder="0000000"
              maxLength={7}
              style={{
                width: '100%', padding: '13px 16px', borderRadius: 12,
                border: `2px solid ${error ? '#ef4444' : '#e5e7eb'}`,
                fontSize: 26, fontWeight: 800, textAlign: 'center', letterSpacing: 10,
                fontFamily: 'Space Grotesk, sans-serif', outline: 'none',
                boxSizing: 'border-box', transition: 'border-color 150ms, box-shadow 150ms',
                color: '#111318',
              }}
              onFocus={e => { if (!error) { e.target.style.borderColor = primary; e.target.style.boxShadow = `0 0 0 3px ${primary}20`; } }}
              onBlur={e => { if (!error) { e.target.style.borderColor = '#e5e7eb'; e.target.style.boxShadow = 'none'; } }}
            />
            {error && (
              <p style={{ fontSize: 12, color: '#ef4444', marginTop: 6, textAlign: 'center' }}>{error}</p>
            )}
          </div>
          <button
            onClick={handleSubmit}
            disabled={code.length < 7 || checking}
            style={{
              width: '100%', padding: '13px', borderRadius: 12, border: 'none',
              background: code.length === 7 && !checking ? primary : '#e5e7eb',
              color: code.length === 7 && !checking ? '#fff' : '#9ca3af',
              fontSize: 14, fontWeight: 700, fontFamily: 'DM Sans, sans-serif',
              cursor: code.length === 7 && !checking ? 'pointer' : 'default',
              transition: 'background 150ms',
            }}>
            {checking ? 'Checking...' : 'View Document'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── SIGN MODAL ─────────────────────────────────────────────
function SignModal({ onSign, onClose, primary }: {
  onSign: (type: string, data: string, date: string) => void;
  onClose: () => void;
  primary: string;
}) {
  const [tab, setTab]             = useState<'typed' | 'drawn'>('typed');
  const [typedName, setTypedName] = useState('');
  const [signDate, setSignDate]   = useState(new Date().toISOString().split('T')[0]);
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const drawing    = useRef(false);
  const [hasDrawn, setHasDrawn]   = useState(false);

  function startDraw(e: React.MouseEvent<HTMLCanvasElement>) {
    drawing.current = true;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;
    const rect = canvas.getBoundingClientRect();
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
    ctx.lineWidth   = 2.5;
    ctx.strokeStyle = '#111318';
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';
    ctx.lineTo((e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY);
    ctx.stroke();
    setHasDrawn(true);
  }
  function endDraw() { drawing.current = false; }
  function clearCanvas() {
    if (!canvasRef.current) return;
    canvasRef.current.getContext('2d')?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    setHasDrawn(false);
  }

  function handleSign() {
    if (tab === 'typed' && !typedName.trim()) return;
    if (tab === 'drawn' && !hasDrawn) return;
    const data = tab === 'drawn' ? (canvasRef.current?.toDataURL('image/png') || '') : typedName.trim();
    onSign(tab, data, signDate);
  }

  const canSign = (tab === 'typed' && typedName.trim().length > 1) || (tab === 'drawn' && hasDrawn);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: 'DM Sans, sans-serif' }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.2 }}
        style={{ width: '100%', maxWidth: 480, background: '#fff', borderRadius: 20, overflow: 'hidden', boxShadow: '0 16px 60px rgba(0,0,0,0.20)' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding: '20px 24px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: `${primary}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Pen size={16} style={{ color: primary }} />
          </div>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: '#111318', margin: 0, fontFamily: 'Space Grotesk, sans-serif' }}>Sign</h3>
            <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>Choose how you'd like to sign</p>
          </div>
        </div>

        {/* Tab picker */}
        <div style={{ display: 'flex', margin: '0 24px', background: '#f3f4f6', borderRadius: 10, padding: 3, gap: 2 }}>
          {([{ id: 'typed', label: 'Type', icon: <Type size={13} /> }, { id: 'drawn', label: 'Draw', icon: <Pen size={13} /> }] as const).map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '7px 0', borderRadius: 8, border: 'none', background: tab === t.id ? '#fff' : 'transparent', color: tab === t.id ? '#111318' : '#6b7280', fontSize: 13, fontWeight: 600, fontFamily: 'DM Sans, sans-serif', cursor: 'pointer', boxShadow: tab === t.id ? '0 1px 4px rgba(0,0,0,0.12)' : 'none', transition: 'all 150ms' }}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Typed */}
          {tab === 'typed' && (
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Full Name</label>
              <input
                value={typedName} onChange={e => setTypedName(e.target.value)}
                placeholder="Type your full legal name" autoFocus
                style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 14, fontFamily: 'DM Sans, sans-serif', outline: 'none', boxSizing: 'border-box', transition: 'border-color 150ms, box-shadow 150ms', color: '#111318' }}
                onFocus={e => { e.target.style.borderColor = primary; e.target.style.boxShadow = `0 0 0 3px ${primary}20`; }}
                onBlur={e => { e.target.style.borderColor = '#e5e7eb'; e.target.style.boxShadow = 'none'; }} />
              {typedName.trim().length > 1 && (
                <div style={{ marginTop: 10, padding: '14px 18px', background: '#f9fafb', borderRadius: 10, borderBottom: `2px solid ${primary}` }}>
                  <span style={{ fontSize: 22, fontFamily: 'Space Grotesk, sans-serif', fontWeight: 800, color: '#111318', letterSpacing: '-0.3px' }}>{typedName}</span>
                </div>
              )}
            </div>
          )}

          {/* Drawn */}
          {tab === 'drawn' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Draw Your Signature</label>
                <button onClick={clearCanvas} style={{ fontSize: 11, color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>Clear</button>
              </div>
              <canvas
                ref={canvasRef} width={432} height={120}
                style={{ width: '100%', height: 120, borderRadius: 10, border: '1px solid #e5e7eb', background: '#fafafa', cursor: 'crosshair', display: 'block', borderBottom: `2px solid ${primary}` }}
                onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw} />
              {!hasDrawn && <p style={{ fontSize: 11, color: '#9ca3af', textAlign: 'center', marginTop: 4 }}>Sign in the box above</p>}
            </div>
          )}

          {/* Date */}
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
              <Calendar size={11} /> Signing Date
            </label>
            <input type="date" value={signDate} onChange={e => setSignDate(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 13, fontFamily: 'DM Sans, sans-serif', outline: 'none', color: '#374151', background: '#fff', transition: 'border-color 150ms' }}
              onFocus={e => { e.target.style.borderColor = primary; }}
              onBlur={e => { e.target.style.borderColor = '#e5e7eb'; }} />
          </div>

          <p style={{ fontSize: 12, color: '#9ca3af', lineHeight: 1.5, margin: 0 }}>
            By clicking Sign, you confirm this constitutes your legally binding electronic signature.
          </p>

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid #e5e7eb', background: '#fff', color: '#374151', fontSize: 14, fontWeight: 600, fontFamily: 'DM Sans, sans-serif', cursor: 'pointer' }}>
              Cancel
            </button>
            <button onClick={handleSign} disabled={!canSign}
              style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', background: canSign ? primary : '#e5e7eb', color: canSign ? '#fff' : '#9ca3af', fontSize: 14, fontWeight: 700, fontFamily: 'DM Sans, sans-serif', cursor: canSign ? 'pointer' : 'default', transition: 'background 150ms' }}>
              Sign Document
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ─── DOCUMENT BODY ────────────────────────────────────────────
function DocumentBody({ doc, liveFields, brand, primary, bizName, signed, signerName, signedDate, canSign, onOpenSign }: {
  doc: any; liveFields: Record<string, any>; brand: BrandProfile | null; primary: string; bizName: string;
  signed: boolean; signerName: string; signedDate: string;
  canSign: boolean; onOpenSign: () => void;
}) {
  // Use liveFields (updated in parent state after signing) not doc.fields (stale server prop)
  const fields = liveFields;
  const docTypeLabel = ({ proposal: 'Proposal', contract: 'Contract', sow: 'Scope of Work', requirements: 'Requirements', invoice: 'Invoice', delivery: 'Delivery Document' } as Record<string,string>)[doc.type] || doc.type;

  return (
    <div style={{ background: '#F2F4F8', minHeight: '100vh', padding: '40px 16px', fontFamily: 'DM Sans, sans-serif' }}>
      <link href={FONTS} rel="stylesheet" />

      {/* Print button */}
      <div style={{ maxWidth: 794, margin: '0 auto 16px', display: 'flex', justifyContent: 'flex-end' }} className="no-print">
        <button onClick={() => window.print()}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, border: '1px solid #d1d5db', background: '#fff', color: '#374151', fontSize: 13, fontWeight: 500, fontFamily: 'DM Sans, sans-serif', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <Printer size={14} /> Save as PDF
        </button>
      </div>

      {/* A4 sheet — 794px = 210mm at 96dpi */}
      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="doc-page"
        style={{ width: 794, margin: '0 auto', background: '#fff', borderRadius: 12, boxShadow: '0 4px 40px rgba(0,0,0,0.10)' }}>

        {/* Header */}
        <div style={{ padding: '36px 56px 28px', background: `linear-gradient(135deg, ${primary}0F 0%, ${primary}06 100%)`, borderBottom: `1px solid ${primary}18` }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              {brand?.logo_url ? (
                <img src={brand.logo_url} alt={bizName} style={{ width: 48, height: 48, borderRadius: 10, objectFit: 'contain', border: `1px solid ${primary}20`, background: '#fff', padding: 4 }} />
              ) : (
                <div style={{ width: 48, height: 48, borderRadius: 10, background: primary, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 20, fontFamily: 'Space Grotesk, sans-serif', fontWeight: 800 }}>
                  {bizName[0].toUpperCase()}
                </div>
              )}
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 800, color: '#111318', margin: 0, fontFamily: 'Space Grotesk, sans-serif' }}>{bizName}</h2>
                {brand?.tagline && <p style={{ fontSize: 12, color: '#6b7280', margin: '2px 0 0' }}>{brand.tagline}</p>}
              </div>
            </div>
            <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
              <span style={{ padding: '4px 12px', borderRadius: 100, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', background: `${primary}15`, color: primary, border: `1px solid ${primary}28` }}>
                {docTypeLabel}
              </span>
              {signed && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 100, fontSize: 10, fontWeight: 600, background: '#dcfce7', color: '#16a34a', border: '1px solid #bbf7d0' }}>
                  <Check size={10} /> Signed
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Title */}
        <div style={{ padding: '28px 56px 0' }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#111318', margin: 0, fontFamily: 'Space Grotesk, sans-serif', letterSpacing: '-0.5px', lineHeight: 1.15 }}>
            {doc.title || docTypeLabel}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
            <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>Created {formatDate(doc.created_at)}</p>
            {(doc as any).last_edited_at && (
              <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>
                · {(doc as any).edit_count > 1
                    ? `Edited ${(doc as any).edit_count} times · Last edited ${formatDate((doc as any).last_edited_at)}`
                    : `Edited ${formatDate((doc as any).last_edited_at)}`}
              </p>
            )}
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: '24px 56px', display: 'flex', flexDirection: 'column', gap: 28 }}>
          {Object.keys(fields).length === 0 ? (
            <p style={{ fontSize: 14, color: '#9ca3af', fontStyle: 'italic' }}>This document is being prepared.</p>
          ) : (
            <>
              {doc.type === 'proposal'     && <ProposalView     fields={fields} color={primary} />}
              {doc.type === 'contract'     && <ContractView     fields={fields} color={primary} />}
              {doc.type === 'sow'          && <SOWView          fields={fields} color={primary} />}
              {doc.type === 'requirements' && <RequirementsView fields={fields} color={primary} />}
              {doc.type === 'invoice'      && <InvoiceView      fields={fields} color={primary} brand={brand} />}
              {doc.type === 'delivery'     && <DeliveryView     fields={fields} color={primary} />}
            </>
          )}
        </div>

        {/* Sign CTA */}
        {canSign && (() => {
          const isProposal = doc.type === 'proposal';
          return (
            <div style={{ margin: '0 56px 32px', padding: '20px 24px', background: '#f9fafb', borderRadius: 12, border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20 }} className="no-print">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Shield size={16} style={{ color: primary, flexShrink: 0 }} />
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#111318', margin: 0 }}>
                    {isProposal ? 'Ready to accept this proposal?' : 'Ready to sign?'}
                  </p>
                  <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>
                    {isProposal ? 'Confirm your acceptance by signing below.' : 'Type or draw your signature electronically.'}
                  </p>
                </div>
              </div>
              <button onClick={onOpenSign}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', borderRadius: 10, border: 'none', background: primary, color: '#fff', fontSize: 13, fontWeight: 700, fontFamily: 'DM Sans, sans-serif', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                <Pen size={13} /> {isProposal ? 'Accept Proposal' : 'Sign Document'}
              </button>
            </div>
          );
        })()}

        {/* Signed confirmation */}
        {signed && (
          <div style={{ margin: '0 56px 32px', padding: '14px 18px', background: '#f0fdf4', borderRadius: 10, border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Check size={15} style={{ color: '#16a34a', flexShrink: 0 }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#15803d' }}>
              {doc.type === 'proposal' ? 'Accepted' : 'Signed'} by {signerName} on {signedDate ? formatDate(signedDate) : 'today'}
            </span>
          </div>
        )}

        {/* Footer */}
        <div style={{ padding: '14px 56px', borderTop: `1px solid ${primary}12`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 11, color: '#9ca3af' }}>{bizName}{brand?.email ? ` · ${brand.email}` : ''}{brand?.website ? ` · ${brand.website}` : ''}</span>
          <span style={{ fontSize: 11, color: '#9ca3af' }}>{brand?.phone || ''}</span>
        </div>
      </motion.div>

      <style>{`
        @import url('${FONTS}');
        @media print {
          /* Kill the outer wrapper background and padding */
          body, html { background: #fff !important; margin: 0 !important; padding: 0 !important; }
          /* Ensure brand colours print correctly */
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          /* Hide all UI chrome */
          .no-print { display: none !important; }
          /* The outer page bg wrapper — collapse it */
          body > div { background: #fff !important; padding: 0 !important; min-height: unset !important; }
          /* The A4 card — fill the full page */
          .doc-page {
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            overflow: visible !important;
          }
          /* Page setup */
          @page {
            size: A4 portrait;
            margin: 12mm 14mm;
          }
          /* Prevent page breaks inside section blocks */
          section, .doc-section { page-break-inside: avoid; }
          /* Ensure signature blocks don't split across pages */
          .signature-row { page-break-inside: avoid; }
        }
      `}</style>
    </div>
  );
}


// ─── SIGNATURE BLOCK ─────────────────────────────────────────
// Renders a signature (typed or drawn) or a blank placeholder line.
function SignatureBlock({ label, sig, color }: {
  label: string;
  sig: { type: string; data: string; date: string; name: string } | null | undefined;
  color: string;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0 }}>{label}</p>
      {/* Signature area */}
      <div style={{ minHeight: 60, borderBottom: `2px solid ${sig ? color : '#d1d5db'}`, display: 'flex', alignItems: 'flex-end', paddingBottom: 6 }}>
        {sig ? (
          sig.type === 'drawn' ? (
            <img src={sig.data} alt={sig.name} style={{ maxHeight: 52, maxWidth: 200 }} />
          ) : (
            <span style={{ fontSize: 22, fontFamily: 'Space Grotesk, sans-serif', fontWeight: 800, color: '#111318', letterSpacing: '-0.3px' }}>{sig.data}</span>
          )
        ) : (
          <span style={{ fontSize: 12, color: '#d1d5db', fontStyle: 'italic' }} className="no-print">Awaiting signature</span>
        )}
      </div>
      {/* Name + date below the line */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: '#374151' }}>{sig?.type !== 'drawn' ? (sig?.name || '') : ''}</span>
        <span style={{ fontSize: 11, color: '#9ca3af' }}>{sig?.date || ''}</span>
      </div>
    </div>
  );
}

// ─── RENDERERS ────────────────────────────────────────────────
function Section({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 style={{ fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.08em', paddingBottom: 8, marginBottom: 12, borderBottom: `2px solid ${color}20`, margin: '0 0 12px' }}>{title}</h3>
      {children}
    </div>
  );
}

function ProposalSectionView({ type, fields, color }: { type: string; fields: any; color: string }) {
  const listItem = (item: string, i: number, tick = true) => (
    <div key={i} style={{ display: 'flex', gap: 10, fontSize: 14, color: tick ? '#374151' : '#6b7280' }}>
      <span style={{ color: tick ? color : '#9ca3af', fontWeight: 700, flexShrink: 0 }}>{tick ? '✓' : '✗'}</span>{item}
    </div>
  );
  switch (type) {
    case 'overview':
      return fields.overview ? <Section title="Overview" color={color}><p style={{ fontSize: 14, color: '#374151', lineHeight: 1.75, margin: 0 }}>{fields.overview}</p></Section> : null;
    case 'scope':
      return (fields.inclusions?.length > 0 || fields.exclusions?.length > 0) ? (
        <>
          {fields.inclusions?.length > 0 && <Section title="What's Included" color={color}><div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{fields.inclusions.map((item: string, i: number) => listItem(item, i, true))}</div></Section>}
          {fields.exclusions?.length > 0 && <Section title="Exclusions" color={color}><div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{fields.exclusions.map((item: string, i: number) => listItem(item, i, false))}</div></Section>}
        </>
      ) : null;
    case 'deliverables':
      return fields.deliverables_list?.length > 0 ? (
        <Section title="Deliverables" color={color}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{fields.deliverables_list.map((item: string, i: number) => listItem(item, i, true))}</div>
        </Section>
      ) : null;
    case 'timeline':
      return fields.timeline ? <Section title="Timeline" color={color}><p style={{ fontSize: 14, color: '#374151', margin: 0 }}>{fields.timeline}</p></Section> : null;
    case 'investment':
      return (fields.investment_amount > 0 || fields.validity_date) ? (
        <>
          {fields.investment_amount > 0 && (
            <div style={{ padding: '20px 24px', borderRadius: 12, background: `${color}08`, border: `1px solid ${color}18` }}>
              <p style={{ fontSize: 11, color: '#9ca3af', margin: '0 0 4px', textTransform: 'uppercase' as const, letterSpacing: '0.07em', fontWeight: 600 }}>Investment</p>
              <p style={{ fontSize: 32, fontWeight: 800, color, margin: 0, fontFamily: 'Space Grotesk, sans-serif', lineHeight: 1 }}>{formatINR(fields.investment_amount)}</p>
              {fields.payment_terms && <p style={{ fontSize: 13, color: '#6b7280', margin: '8px 0 0' }}>{fields.payment_terms}</p>}
            </div>
          )}
          {fields.validity_date && <p style={{ fontSize: 12, color: '#9ca3af', fontStyle: 'italic', margin: 0 }}>Valid until: {formatDate(fields.validity_date)}</p>}
        </>
      ) : null;
    case 'process':
      return fields.our_process ? <Section title="Our Process" color={color}><p style={{ fontSize: 14, color: '#374151', lineHeight: 1.75, margin: 0, whiteSpace: 'pre-line' }}>{fields.our_process}</p></Section> : null;
    case 'whyus':
      return fields.why_us ? <Section title="Why Us" color={color}><p style={{ fontSize: 14, color: '#374151', lineHeight: 1.75, margin: 0, whiteSpace: 'pre-line' }}>{fields.why_us}</p></Section> : null;
    case 'terms':
      return (fields.revision_terms || fields.ip_terms) ? (
        <Section title="Terms" color={color}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {fields.revision_terms && <p style={{ fontSize: 14, color: '#374151', margin: 0 }}><strong>Revisions:</strong> {fields.revision_terms}</p>}
            {fields.ip_terms && <p style={{ fontSize: 14, color: '#374151', margin: 0 }}><strong>IP Ownership:</strong> {fields.ip_terms}</p>}
          </div>
        </Section>
      ) : null;
    case 'portfolio':
      return fields.portfolio_url ? (
        <Section title="Relevant Work" color={color}>
          <a href={fields.portfolio_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color, wordBreak: 'break-all' as const }}>{fields.portfolio_url}</a>
          {fields.portfolio_note && <p style={{ fontSize: 13, color: '#6b7280', margin: '4px 0 0' }}>{fields.portfolio_note}</p>}
        </Section>
      ) : null;
    case 'custom':
      return fields.custom_content ? (
        <Section title={fields.custom_title || 'Additional Information'} color={color}>
          <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.75, margin: 0, whiteSpace: 'pre-line' }}>{fields.custom_content}</p>
        </Section>
      ) : null;
    default:
      return null;
  }
}

function ProposalView({ fields, color }: { fields: any; color: string }) {
  // Determine which sections to render and in what order
  const activeSections: string[] = fields.active_sections?.length
    ? fields.active_sections
    : ['overview', 'scope', 'timeline', 'investment']; // default for old documents

  return (
    <>
      {activeSections.map(section => (
        <ProposalSectionView key={section} type={section} fields={fields} color={color} />
      ))}
    </>
  );
}

// Individual contract section renderer for the public view
function ContractSectionView({ type, fields, color }: { type: string; fields: any; color: string }) {
  switch (type) {
    case 'parties':
      return fields.parties ? (
        <Section title="Parties" color={color}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {fields.parties.client && <div><p style={{ fontSize: 11, color: '#9ca3af', margin: '0 0 3px', textTransform: 'uppercase' as const, fontWeight: 600, letterSpacing: '0.06em' }}>Client</p><p style={{ fontSize: 14, fontWeight: 600, color: '#111318', margin: 0 }}>{fields.parties.client}</p></div>}
            {fields.parties.freelancer && <div><p style={{ fontSize: 11, color: '#9ca3af', margin: '0 0 3px', textTransform: 'uppercase' as const, fontWeight: 600, letterSpacing: '0.06em' }}>Service Provider</p><p style={{ fontSize: 14, fontWeight: 600, color: '#111318', margin: 0 }}>{fields.parties.freelancer}</p></div>}
          </div>
        </Section>
      ) : null;
    case 'project':
      return (fields.project_description || fields.start_date || fields.delivery_date) ? (
        <Section title="Project" color={color}>
          {fields.project_description && <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.75, margin: '0 0 12px' }}>{fields.project_description}</p>}
          {(fields.start_date || fields.delivery_date) && (
            <div style={{ display: 'flex', gap: 32 }}>
              {fields.start_date && <div><p style={{ fontSize: 11, color: '#9ca3af', margin: '0 0 3px', textTransform: 'uppercase' as const, fontWeight: 600 }}>Start Date</p><p style={{ fontSize: 14, fontWeight: 600, color: '#111318', margin: 0 }}>{formatDate(fields.start_date)}</p></div>}
              {fields.delivery_date && <div><p style={{ fontSize: 11, color: '#9ca3af', margin: '0 0 3px', textTransform: 'uppercase' as const, fontWeight: 600 }}>Expected Delivery</p><p style={{ fontSize: 14, fontWeight: 600, color: '#111318', margin: 0 }}>{formatDate(fields.delivery_date)}</p></div>}
            </div>
          )}
        </Section>
      ) : null;
    case 'payment':
      return fields.payment_schedule?.length > 0 ? (
        <Section title="Payment Schedule" color={color}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {fields.payment_schedule.map((p: any, i: number) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#f9fafb', borderRadius: 8 }}>
                <span style={{ fontSize: 14, color: '#374151' }}>{p.trigger}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color }}>{formatINR(Number(p.amount))}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color }}>
                Total: {formatINR(fields.payment_schedule.reduce((s: number, p: any) => s + Number(p.amount), 0))}
              </span>
            </div>
          </div>
        </Section>
      ) : null;
    case 'revisions':
      return fields.revision_policy ? <Section title="Revision Policy" color={color}><p style={{ fontSize: 14, color: '#374151', lineHeight: 1.7, margin: 0 }}>{fields.revision_policy}</p></Section> : null;
    case 'ip':
      return fields.ip_clause ? <Section title="Intellectual Property" color={color}><p style={{ fontSize: 14, color: '#374151', lineHeight: 1.7, margin: 0 }}>{fields.ip_clause}</p></Section> : null;
    case 'confidentiality':
      return fields.confidentiality_clause ? <Section title="Confidentiality" color={color}><p style={{ fontSize: 14, color: '#374151', lineHeight: 1.7, margin: 0 }}>{fields.confidentiality_clause}</p></Section> : null;
    case 'termination':
      return fields.termination_clause ? <Section title="Termination" color={color}><p style={{ fontSize: 14, color: '#374151', lineHeight: 1.7, margin: 0 }}>{fields.termination_clause}</p></Section> : null;
    case 'governing_law':
      return fields.governing_law ? (
        <p style={{ fontSize: 12, color: '#9ca3af', margin: 0, fontStyle: 'italic' }}>
          Governing Law: {fields.governing_law}
        </p>
      ) : null;
    case 'signatures':
      return (
        <div style={{ paddingTop: 24, borderTop: '1px solid #f3f4f6', display: 'flex', gap: 40 }}>
          <SignatureBlock label="Service Provider" sig={fields.creator_signature} color={color} />
          <SignatureBlock label="Client" sig={fields.client_signature} color={color} />
        </div>
      );
    case 'custom_c':
      return fields.custom_c_content ? (
        <Section title={fields.custom_c_title || 'Additional Clause'} color={color}>
          <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.7, margin: 0, whiteSpace: 'pre-line' }}>{fields.custom_c_content}</p>
        </Section>
      ) : null;
    default:
      return null;
  }
}

function ContractView({ fields, color }: { fields: any; color: string }) {
  // Render from active_sections_contract if set; otherwise fall back to
  // the legacy field-by-field order for documents created before this version.
  const activeSections: string[] = fields.active_sections_contract?.length
    ? fields.active_sections_contract
    : ['parties', 'project', 'payment', 'revisions', 'ip', 'confidentiality', 'termination', 'governing_law', 'signatures'];

  return (
    <>
      {activeSections.map(section => (
        <ContractSectionView key={section} type={section} fields={fields} color={color} />
      ))}
    </>
  );
}

function SOWSectionView({ type, fields, color }: { type: string; fields: any; color: string }) {
  switch (type) {
    case 'objectives':
      return fields.objectives ? (
        <Section title="Objectives" color={color}>
          <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.75, margin: 0 }}>{fields.objectives}</p>
        </Section>
      ) : null;
    case 'deliverables':
      return fields.deliverables?.length > 0 ? (
        <Section title="Deliverables" color={color}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {fields.deliverables.map((d: any, i: number) => (
              <div key={i} style={{ padding: '10px 14px', background: '#f9fafb', borderRadius: 8, borderLeft: `3px solid ${color}` }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: '#111318', margin: 0 }}>{d.title}</p>
                {d.description && <p style={{ fontSize: 13, color: '#6b7280', margin: '3px 0 0' }}>{d.description}</p>}
              </div>
            ))}
          </div>
        </Section>
      ) : null;
    case 'out_of_scope':
      return fields.out_of_scope ? (
        <Section title="Out of Scope" color={color}>
          <p style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.7, margin: 0 }}>{fields.out_of_scope}</p>
        </Section>
      ) : null;
    case 'milestones':
      return fields.milestones?.length > 0 ? (
        <Section title="Milestones" color={color}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {fields.milestones.map((m: any, i: number) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 14px', background: '#f9fafb', borderRadius: 8 }}>
                <span style={{ fontSize: 14, color: '#374151' }}>{m.title}</span>
                {m.date && <span style={{ fontSize: 12, color: '#9ca3af', fontFamily: 'DM Mono, monospace' }}>{formatDate(m.date)}</span>}
              </div>
            ))}
          </div>
        </Section>
      ) : null;
    case 'acceptance':
      return fields.acceptance_criteria ? (
        <Section title="Acceptance Criteria" color={color}>
          <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.7, margin: 0, whiteSpace: 'pre-line' }}>{fields.acceptance_criteria}</p>
        </Section>
      ) : null;
    case 'assumptions':
      return fields.assumptions ? (
        <Section title="Assumptions" color={color}>
          <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.7, margin: 0, whiteSpace: 'pre-line' }}>{fields.assumptions}</p>
        </Section>
      ) : null;
    case 'dependencies':
      return fields.dependencies ? (
        <Section title="Dependencies" color={color}>
          <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.7, margin: 0, whiteSpace: 'pre-line' }}>{fields.dependencies}</p>
        </Section>
      ) : null;
    case 'signoff':
      return (
        <div style={{ paddingTop: 24, borderTop: '1px solid #f3f4f6', display: 'flex', gap: 40 }}>
          <SignatureBlock label="Client Acknowledgement" sig={fields.client_signature} color={color} />
        </div>
      );
    default:
      return null;
  }
}

function SOWView({ fields, color }: { fields: any; color: string }) {
  const activeSections: string[] = fields.active_sections_sow?.length
    ? fields.active_sections_sow
    : ['objectives', 'deliverables', 'out_of_scope', 'acceptance', 'assumptions', 'signoff'];

  return (
    <>
      {activeSections.map(section => (
        <SOWSectionView key={section} type={section} fields={fields} color={color} />
      ))}
    </>
  );
}

function ReqSectionView({ type, fields, color }: { type: string; fields: any; color: string }) {
  switch (type) {
    case 'background':
      return fields.project_background ? (
        <Section title="Project Background" color={color}>
          <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.75, margin: 0 }}>{fields.project_background}</p>
        </Section>
      ) : null;
    case 'functional':
      return fields.functional_requirements?.length > 0 ? (
        <Section title="Functional Requirements" color={color}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {fields.functional_requirements.map((r: any, i: number) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                {/* Checkbox — client ticks off acknowledged requirements */}
                <div style={{ width: 18, height: 18, borderRadius: 4, border: `2px solid ${color}40`, background: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }} />
                <span style={{ fontSize: 14, color: '#374151', lineHeight: 1.6 }}>{r.requirement}</span>
              </div>
            ))}
          </div>
        </Section>
      ) : null;
    case 'design':
      return fields.design_preferences ? (
        <Section title="Design Preferences" color={color}>
          <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.75, margin: 0, whiteSpace: 'pre-line' }}>{fields.design_preferences}</p>
        </Section>
      ) : null;
    case 'technical':
      return fields.technical_requirements ? (
        <Section title="Technical Requirements" color={color}>
          <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.75, margin: 0, whiteSpace: 'pre-line' }}>{fields.technical_requirements}</p>
        </Section>
      ) : null;
    case 'content':
      return fields.content_responsibilities ? (
        <Section title="Content Responsibilities" color={color}>
          <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.75, margin: 0, whiteSpace: 'pre-line' }}>{fields.content_responsibilities}</p>
        </Section>
      ) : null;
    case 'deadline':
      return (fields.deadline || fields.timeline_notes) ? (
        <Section title="Deadline & Timeline" color={color}>
          {fields.deadline && (
            <div style={{ marginBottom: fields.timeline_notes ? 10 : 0 }}>
              <p style={{ fontSize: 11, color: '#9ca3af', margin: '0 0 3px', textTransform: 'uppercase' as const, fontWeight: 600, letterSpacing: '0.06em' }}>Target Launch</p>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#111318', margin: 0 }}>{formatDate(fields.deadline)}</p>
            </div>
          )}
          {fields.timeline_notes && (
            <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.6, margin: 0 }}>{fields.timeline_notes}</p>
          )}
        </Section>
      ) : null;
    case 'signoff':
      return (
        <div style={{ paddingTop: 24, borderTop: '1px solid #f3f4f6', display: 'flex', gap: 40 }}>
          <SignatureBlock label="Approved by (Client)" sig={fields.client_signature} color={color} />
        </div>
      );
    default:
      return null;
  }
}

function RequirementsView({ fields, color }: { fields: any; color: string }) {
  const activeSections: string[] = fields.active_sections_req?.length
    ? fields.active_sections_req
    : ['background', 'functional', 'technical', 'deadline', 'signoff'];

  return (
    <>
      {activeSections.map(section => (
        <ReqSectionView key={section} type={section} fields={fields} color={color} />
      ))}
    </>
  );
}

function InvoiceView({ fields, color, brand }: { fields: any; color: string; brand: BrandProfile | null }) {
  // Recompute totals from line items — never trust stored values which may be stale
  const gstRate  = Math.max(0, Math.min(100, Number(fields.gst_rate) || 18));
  const subtotal = (fields.line_items || []).reduce(
    (s: number, item: any) => s + Number(item.quantity) * Number(item.rate), 0
  );
  const gstAmount = fields.gst_enabled ? Math.round(subtotal * gstRate / 100) : 0;
  const total     = subtotal + gstAmount;
  const hasBankDetails = !!(brand?.bank_name || brand?.bank_upi);

  return (
    <>
      {/* Header: Invoice To + Invoice # side by side */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <p style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase' as const, fontWeight: 600, letterSpacing: '0.06em', margin: '0 0 4px' }}>Invoice To</p>
          <p style={{ fontSize: 16, fontWeight: 700, color: '#111318', margin: 0 }}>{fields.client_name || '—'}</p>
          {fields.description && (
            <p style={{ fontSize: 13, color: '#6b7280', margin: '4px 0 0', maxWidth: 340 }}>{fields.description}</p>
          )}
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase' as const, fontWeight: 600, letterSpacing: '0.06em', margin: '0 0 4px' }}>Invoice #</p>
          <p style={{ fontSize: 15, fontWeight: 700, color, margin: 0, fontFamily: 'DM Mono, monospace' }}>{fields.invoice_number || '—'}</p>
          {fields.invoice_date && (
            <p style={{ fontSize: 12, color: '#9ca3af', margin: '3px 0 0' }}>Issued: {formatDate(fields.invoice_date)}</p>
          )}
          {fields.due_date && (
            <p style={{ fontSize: 12, color: '#374151', fontWeight: 600, margin: '2px 0 0' }}>Due: {formatDate(fields.due_date)}</p>
          )}
          {fields.payment_terms && (
            <p style={{ fontSize: 11, color: '#9ca3af', margin: '2px 0 0', fontStyle: 'italic' }}>{fields.payment_terms}</p>
          )}
        </div>
      </div>

      {/* Line items table */}
      {fields.line_items?.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #f3f4f6' }}>
              <th style={{ textAlign: 'left', padding: '8px 0', color: '#9ca3af', fontWeight: 600 }}>Description</th>
              <th style={{ textAlign: 'right', padding: '8px 0', color: '#9ca3af', fontWeight: 600 }}>Qty</th>
              <th style={{ textAlign: 'right', padding: '8px 0', color: '#9ca3af', fontWeight: 600 }}>Rate</th>
              <th style={{ textAlign: 'right', padding: '8px 0', color: '#9ca3af', fontWeight: 600 }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {fields.line_items.map((item: any, i: number) => (
              <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '10px 0', color: '#374151', lineHeight: 1.5 }}>{item.description}</td>
                <td style={{ textAlign: 'right', padding: '10px 0', color: '#6b7280' }}>{item.quantity}</td>
                <td style={{ textAlign: 'right', padding: '10px 0', color: '#6b7280', fontFamily: 'DM Mono, monospace', fontSize: 12 }}>{formatINR(Number(item.rate))}</td>
                <td style={{ textAlign: 'right', padding: '10px 0', fontWeight: 600, color: '#111318', fontFamily: 'DM Mono, monospace', fontSize: 12 }}>{formatINR(Number(item.quantity) * Number(item.rate))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Totals — derived fresh, not from stored fields */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 220 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#6b7280' }}>
            <span>Subtotal</span>
            <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 12 }}>{formatINR(subtotal)}</span>
          </div>
          {fields.gst_enabled && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#6b7280' }}>
              <span>GST {gstRate}%</span>
              <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 12 }}>{formatINR(gstAmount)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 800, color, paddingTop: 10, borderTop: '2px solid #f3f4f6', marginTop: 2 }}>
            <span>Total Due</span>
            <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 17 }}>{formatINR(total)}</span>
          </div>
        </div>
      </div>

      {/* Notes */}
      {fields.notes && (
        <div style={{ padding: '12px 16px', background: '#f9fafb', borderRadius: 8, borderLeft: `3px solid ${color}40` }}>
          <p style={{ fontSize: 13, color: '#374151', margin: 0, lineHeight: 1.6 }}>{fields.notes}</p>
        </div>
      )}

      {/* Payment details */}
      {hasBankDetails ? (
        <div style={{ padding: '16px 18px', background: '#f9fafb', borderRadius: 10, border: '1px solid #e5e7eb' }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#374151', margin: '0 0 8px', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>Payment Details</p>
          {brand?.bank_name && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: brand?.bank_upi ? 8 : 0 }}>
              <p style={{ fontSize: 13, color: '#374151', fontWeight: 600, margin: 0 }}>{brand.bank_name}</p>
              {brand.bank_account_number && (
                <p style={{ fontSize: 13, color: '#6b7280', margin: 0, fontFamily: 'DM Mono, monospace', fontSize: 12 } as React.CSSProperties}>
                  A/C: {brand.bank_account_number}{brand.bank_ifsc ? ` · IFSC: ${brand.bank_ifsc}` : ''}
                </p>
              )}
            </div>
          )}
          {brand?.bank_upi && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase' as const }}>UPI</span>
              <span style={{ fontSize: 13, color: '#374151', fontFamily: 'DM Mono, monospace', fontSize: 12 } as React.CSSProperties}>{brand.bank_upi}</span>
            </div>
          )}
        </div>
      ) : (
        <div style={{ padding: '12px 16px', background: '#fffbeb', borderRadius: 8, border: '1px solid #fde68a' }}>
          <p style={{ fontSize: 12, color: '#92400e', margin: 0 }}>
            ⚠ Payment details not configured — please add your bank account and UPI details in Brand Settings so clients know how to pay you.
          </p>
        </div>
      )}
    </>
  );
}

function DeliverySectionView({ type, fields, color }: { type: string; fields: any; color: string }) {
  switch (type) {
    case 'summary':
      return (fields.project_summary || fields.delivery_date) ? (
        <Section title="Project Summary" color={color}>
          {fields.project_summary && (
            <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.75, margin: fields.delivery_date ? '0 0 12px' : 0 }}>{fields.project_summary}</p>
          )}
          {fields.delivery_date && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', background: `${color}10`, borderRadius: 100, border: `1px solid ${color}25` }}>
              <span style={{ fontSize: 11, fontWeight: 600, color, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>Delivered</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{formatDate(fields.delivery_date)}</span>
            </div>
          )}
        </Section>
      ) : null;
    case 'deliverables':
      return fields.deliverables?.length > 0 ? (
        <Section title="Deliverables" color={color}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {fields.deliverables.map((d: any, i: number) => (
              <div key={i} style={{ padding: '10px 14px', background: '#f9fafb', borderRadius: 8, borderLeft: `3px solid ${color}` }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: '#111318', margin: 0 }}>{d.title}</p>
                {d.link && (
                  <a href={d.link} target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: 12, color, marginTop: 3, display: 'block', wordBreak: 'break-all' as const }}>
                    {d.link}
                  </a>
                )}
                {d.description && <p style={{ fontSize: 13, color: '#6b7280', margin: '3px 0 0' }}>{d.description}</p>}
              </div>
            ))}
          </div>
        </Section>
      ) : null;
    case 'credentials':
      return fields.credentials?.length > 0 ? (
        <Section title="Credentials & Access" color={color}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {fields.credentials.map((c: any, i: number) => (
              <div key={i} style={{ padding: '10px 14px', background: '#f9fafb', borderRadius: 8 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#374151', margin: '0 0 4px', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>{c.label}</p>
                <p style={{ fontSize: 13, color: '#111318', margin: 0, fontFamily: 'DM Mono, monospace', wordBreak: 'break-all' as const }}>{c.value}</p>
                {c.note && <p style={{ fontSize: 12, color: '#6b7280', margin: '4px 0 0', fontStyle: 'italic' }}>{c.note}</p>}
              </div>
            ))}
          </div>
        </Section>
      ) : null;
    case 'maintenance':
      return fields.usage_notes ? (
        <Section title="Usage & Maintenance" color={color}>
          <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.75, margin: 0, whiteSpace: 'pre-line' }}>{fields.usage_notes}</p>
        </Section>
      ) : null;
    case 'support':
      return (fields.support_end_date || fields.support_terms || fields.support_contact) ? (
        <Section title="Support Period" color={color}>
          {(fields.support_end_date || fields.support_contact) && (
            <div style={{ display: 'flex', gap: 32, marginBottom: fields.support_terms ? 12 : 0 }}>
              {fields.support_end_date && (
                <div>
                  <p style={{ fontSize: 11, color: '#9ca3af', margin: '0 0 3px', textTransform: 'uppercase' as const, fontWeight: 600, letterSpacing: '0.06em' }}>Support Until</p>
                  <p style={{ fontSize: 14, fontWeight: 600, color: '#111318', margin: 0 }}>{formatDate(fields.support_end_date)}</p>
                </div>
              )}
              {fields.support_contact && (
                <div>
                  <p style={{ fontSize: 11, color: '#9ca3af', margin: '0 0 3px', textTransform: 'uppercase' as const, fontWeight: 600, letterSpacing: '0.06em' }}>Contact</p>
                  <p style={{ fontSize: 14, fontWeight: 600, color: '#111318', margin: 0 }}>{fields.support_contact}</p>
                </div>
              )}
            </div>
          )}
          {fields.support_terms && (
            <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.7, margin: 0, whiteSpace: 'pre-line' }}>{fields.support_terms}</p>
          )}
        </Section>
      ) : null;
    case 'signatures':
      return (
        <div style={{ paddingTop: 24, borderTop: '1px solid #f3f4f6', display: 'flex', gap: 40 }}>
          <SignatureBlock label="Delivered by" sig={fields.creator_signature} color={color} />
          <SignatureBlock label="Accepted by (Client)" sig={fields.client_signature} color={color} />
        </div>
      );
    default:
      return null;
  }
}

function DeliveryView({ fields, color }: { fields: any; color: string }) {
  const activeSections: string[] = fields.active_sections_delivery?.length
    ? fields.active_sections_delivery
    : ['summary', 'deliverables', 'maintenance', 'support', 'signatures'];

  return (
    <>
      {activeSections.map(section => (
        <DeliverySectionView key={section} type={section} fields={fields} color={color} />
      ))}
    </>
  );
}

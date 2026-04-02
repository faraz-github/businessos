// ============================================================
// Business OS — Setup Page
// Accessible at /setup — seeds the superadmin from env vars.
// No auth required. Works in any browser.
// Remove or protect this route after initial setup if desired.
// ============================================================
'use client';

import { useState, useEffect } from 'react';
import { CheckCircle2, AlertCircle, Loader, ArrowRight, Database } from 'lucide-react';

interface SeedStatus {
  seeded: boolean;
  email?: string;
  error?: string;
}

interface SeedResult {
  ok?: boolean;
  action?: 'created' | 'updated';
  message?: string;
  error?: string;
}

export default function SetupPage() {
  const [status, setStatus] = useState<SeedStatus | null>(null);
  const [result, setResult] = useState<SeedResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    fetch('/api/auth/seed')
      .then(r => r.json())
      .then(setStatus)
      .finally(() => setChecking(false));
  }, []);

  async function runSeed() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/auth/seed', { method: 'POST' });
      const data = await res.json();
      setResult(data);
      if (data.ok) {
        const check = await fetch('/api/auth/seed').then(r => r.json());
        setStatus(check);
      }
    } catch {
      setResult({ error: 'Network error — is the server running?' });
    } finally {
      setLoading(false);
    }
  }

  const step = (num: number, label: string, done: boolean, active: boolean) => (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: done ? 'var(--accent-green-dim)' : active ? 'var(--accent-blue-dim)' : 'var(--bg-hover)',
        border: `1px solid ${done ? 'var(--accent-green)' : active ? 'var(--accent-blue)' : 'var(--border-default)'}`,
        color: done ? 'var(--accent-green)' : active ? 'var(--accent-blue)' : 'var(--text-tertiary)',
        fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-display)',
      }}>
        {done ? <CheckCircle2 size={14} /> : num}
      </div>
      <div style={{ paddingTop: 4 }}>
        <p style={{ fontSize: 13, fontWeight: 500, color: active || done ? 'var(--text-primary)' : 'var(--text-tertiary)', fontFamily: 'var(--font-body)' }}>{label}</p>
      </div>
    </div>
  );

  const migrationDone = !checking && (status?.seeded === true || status?.seeded === false);
  const seedDone = status?.seeded === true;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, position: 'relative', overflow: 'hidden' }}>
      {/* Background glow */}
      <div style={{ position: 'absolute', top: '40%', left: '50%', transform: 'translate(-50%,-50%)', width: 600, height: 400, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(79,142,247,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: 520, position: 'relative' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 48, height: 48, borderRadius: 14, background: 'var(--accent-blue-dim)', border: '1px solid rgba(79,142,247,0.2)', marginBottom: 16 }}>
            <Database size={22} style={{ color: 'var(--accent-blue)' }} />
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 800, letterSpacing: '-0.5px', color: 'var(--text-primary)', margin: 0 }}>Business OS Setup</h1>
          <p style={{ marginTop: 8, fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}>
            Initialize your workspace in one click.
          </p>
        </div>

        {/* Card */}
        <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-elevated)', overflow: 'hidden' }}>

          {/* Steps */}
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', fontFamily: 'var(--font-body)', marginBottom: 4 }}>Setup Checklist</p>

            {step(1, 'Run migration 004_custom_auth.sql in Supabase SQL Editor', migrationDone, !migrationDone)}
            {step(2, 'Set SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD in .env.local', migrationDone, migrationDone && !seedDone)}
            {step(3, 'Seed the SuperAdmin account', seedDone, migrationDone && !seedDone)}
          </div>

          <div style={{ height: 1, background: 'var(--border-subtle)' }} />

          {/* Status */}
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {checking ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-secondary)' }}>
                <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} />
                <span style={{ fontSize: 13, fontFamily: 'var(--font-body)' }}>Checking current status...</span>
              </div>
            ) : status?.seeded ? (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px', background: 'var(--accent-green-dim)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(52,201,136,0.2)' }}>
                <CheckCircle2 size={16} style={{ color: 'var(--accent-green)', flexShrink: 0, marginTop: 1 }} />
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-green)', fontFamily: 'var(--font-body)' }}>SuperAdmin exists</p>
                  <p style={{ fontSize: 12, color: 'var(--accent-green)', opacity: 0.8, fontFamily: 'var(--font-body)', marginTop: 2 }}>
                    {status.email} · You can sign in now.
                  </p>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px', background: 'var(--accent-amber-dim)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(245,166,35,0.2)' }}>
                <AlertCircle size={16} style={{ color: 'var(--accent-amber)', flexShrink: 0, marginTop: 1 }} />
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-amber)', fontFamily: 'var(--font-body)' }}>No SuperAdmin found</p>
                  <p style={{ fontSize: 12, color: 'var(--accent-amber)', opacity: 0.8, fontFamily: 'var(--font-body)', marginTop: 2 }}>
                    Set SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD in .env.local, then click Seed below.
                  </p>
                </div>
              </div>
            )}

            {/* Result */}
            {result && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px', background: result.ok ? 'var(--accent-green-dim)' : 'var(--accent-red-dim)', borderRadius: 'var(--radius-md)', border: `1px solid ${result.ok ? 'rgba(52,201,136,0.2)' : 'rgba(240,82,82,0.2)'}` }}>
                {result.ok
                  ? <CheckCircle2 size={16} style={{ color: 'var(--accent-green)', flexShrink: 0, marginTop: 1 }} />
                  : <AlertCircle size={16} style={{ color: 'var(--accent-red)', flexShrink: 0, marginTop: 1 }} />
                }
                <p style={{ fontSize: 13, fontFamily: 'var(--font-body)', color: result.ok ? 'var(--accent-green)' : 'var(--accent-red)', fontWeight: 500 }}>
                  {result.message || result.error}
                </p>
              </div>
            )}

            {/* Seed button */}
            <button
              onClick={runSeed}
              disabled={loading}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                width: '100%', padding: '11px 20px',
                background: loading ? 'rgba(79,142,247,0.5)' : 'var(--accent-blue)',
                color: '#fff', border: 'none', borderRadius: 'var(--radius-md)',
                fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-body)',
                cursor: loading ? 'not-allowed' : 'pointer', transition: 'opacity 150ms',
              }}
              onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLElement).style.opacity = '0.88'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
            >
              {loading ? (
                <><Loader size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> Seeding...</>
              ) : status?.seeded ? (
                <>Re-seed from .env.local (reset credentials)</>
              ) : (
                <>Seed SuperAdmin <ArrowRight size={14} /></>
              )}
            </button>

            {/* Go to login */}
            {status?.seeded && (
              <a href="/auth/login" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 20px', background: 'var(--bg-hover)', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', textDecoration: 'none', fontFamily: 'var(--font-body)', transition: 'background 150ms' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--border-default)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; }}
              >
                Go to Sign In <ArrowRight size={14} />
              </a>
            )}
          </div>
        </div>

        <p style={{ marginTop: 20, textAlign: 'center', fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-body)' }}>
          This page can also be triggered via: <code style={{ background: 'var(--bg-elevated)', padding: '1px 6px', borderRadius: 4 }}>pnpm seed</code>
        </p>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

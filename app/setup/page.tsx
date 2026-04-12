'use client';

// ============================================================
// Business OS — Setup Page
// Accessible at /setup — seeds the superadmin from env vars.
// Requires the SEED_SECRET from your .env.local to authorize.
// No auth session required — works before first login.
// ============================================================

import { useState } from 'react';
import { CheckCircle2, AlertCircle, Loader, ArrowRight, Database, Lock } from 'lucide-react';

interface SeedResult {
  ok?: boolean;
  action?: 'created' | 'updated';
  message?: string;
  error?: string;
  seeded?: boolean;
  created_at?: string;
}

export default function SetupPage() {
  const [secret, setSecret]     = useState('');
  const [result, setResult]     = useState<SeedResult | null>(null);
  const [loading, setLoading]   = useState(false);
  const [done, setDone]         = useState(false);

  async function runSeed() {
    if (!secret.trim()) {
      setResult({ error: 'Enter your SEED_SECRET from .env.local first.' });
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/auth/seed', {
        method: 'POST',
        headers: { 'x-seed-secret': secret.trim() },
      });
      const data: SeedResult = await res.json();
      setResult(data);
      if (data.ok) setDone(true);
    } catch {
      setResult({ error: 'Network error — is the server running?' });
    } finally {
      setLoading(false);
    }
  }

  const step = (num: number, label: string, sub: string, active: boolean, complete: boolean) => (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, opacity: active || complete ? 1 : 0.45 }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: complete ? 'var(--accent-green-dim)' : active ? 'var(--accent-blue-dim)' : 'var(--bg-hover)',
        border: `1px solid ${complete ? 'var(--accent-green)' : active ? 'var(--accent-blue)' : 'var(--border-default)'}`,
        color: complete ? 'var(--accent-green)' : active ? 'var(--accent-blue)' : 'var(--text-tertiary)',
        fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-display)',
      }}>
        {complete ? <CheckCircle2 size={14} /> : num}
      </div>
      <div style={{ paddingTop: 3 }}>
        <p style={{ fontSize: 13, fontWeight: 500, fontFamily: 'var(--font-body)', color: active || complete ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{label}</p>
        <p style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{sub}</p>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 500 }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 48, height: 48, borderRadius: 14, background: 'var(--accent-blue-dim)', border: '1px solid rgba(79,142,247,0.2)', marginBottom: 16 }}>
            <Database size={22} style={{ color: 'var(--accent-blue)' }} />
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 800, letterSpacing: '-0.5px', color: 'var(--text-primary)', margin: 0 }}>Business OS Setup</h1>
          <p style={{ marginTop: 8, fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}>
            Initialize your superadmin account.
          </p>
        </div>

        <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-elevated)', overflow: 'hidden' }}>

          {/* Checklist */}
          <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: 'var(--text-tertiary)', fontFamily: 'var(--font-body)' }}>Prerequisites</p>
            {step(1, 'Supabase migrations applied', 'Run 001 → 018 in Supabase SQL Editor', true, true)}
            {step(2, 'Set credentials in .env.local', 'SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD, SEED_SECRET', true, false)}
            {step(3, 'Seed superadmin account', 'Enter SEED_SECRET below and click Seed', !done, done)}
          </div>

          <div style={{ height: 1, background: 'var(--border-subtle)' }} />

          {/* Seed form */}
          <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>

            {!done && (
              <div>
                <label style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase' as const, letterSpacing: '0.06em', color: 'var(--text-tertiary)', fontFamily: 'var(--font-body)', display: 'block', marginBottom: 6 }}>
                  Seed Secret
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none' }} />
                  <input
                    type="password"
                    value={secret}
                    onChange={e => setSecret(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') runSeed(); }}
                    placeholder="Paste SEED_SECRET from .env.local"
                    style={{
                      width: '100%', padding: '9px 12px 9px 32px',
                      background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
                      borderRadius: 'var(--radius-md)', fontSize: 13, fontFamily: 'var(--font-mono)',
                      color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' as const,
                    }}
                  />
                </div>
                <p style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-body)', marginTop: 6 }}>
                  This is the SEED_SECRET value from your .env.local file — not your password.
                </p>
              </div>
            )}

            {/* Result banner */}
            {result && (
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 10, padding: '11px 14px',
                background: result.ok ? 'var(--accent-green-dim)' : 'var(--accent-red-dim)',
                borderRadius: 'var(--radius-md)',
                border: `1px solid ${result.ok ? 'rgba(52,201,136,0.25)' : 'rgba(240,82,82,0.25)'}`,
              }}>
                {result.ok
                  ? <CheckCircle2 size={15} style={{ color: 'var(--accent-green)', flexShrink: 0, marginTop: 1 }} />
                  : <AlertCircle  size={15} style={{ color: 'var(--accent-red)',   flexShrink: 0, marginTop: 1 }} />
                }
                <p style={{ fontSize: 13, fontFamily: 'var(--font-body)', color: result.ok ? 'var(--accent-green)' : 'var(--accent-red)', fontWeight: 500 }}>
                  {result.message || result.error}
                </p>
              </div>
            )}

            {/* Action button */}
            {!done ? (
              <button
                onClick={runSeed}
                disabled={loading || !secret.trim()}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  width: '100%', padding: '11px 20px',
                  background: loading || !secret.trim() ? 'rgba(79,142,247,0.4)' : 'var(--accent-blue)',
                  color: '#fff', border: 'none', borderRadius: 'var(--radius-md)',
                  fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-body)',
                  cursor: loading || !secret.trim() ? 'not-allowed' : 'pointer',
                }}
              >
                {loading
                  ? <><Loader size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> Seeding...</>
                  : <>Seed SuperAdmin <ArrowRight size={14} /></>
                }
              </button>
            ) : (
              <a href="/auth/login" style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '11px 20px', background: 'var(--accent-blue)',
                borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 600,
                color: '#fff', textDecoration: 'none', fontFamily: 'var(--font-body)',
              }}>
                Go to Sign In <ArrowRight size={14} />
              </a>
            )}
          </div>
        </div>

        <p style={{ marginTop: 16, textAlign: 'center', fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-body)' }}>
          Can also seed via terminal:{' '}
          <code style={{ background: 'var(--bg-elevated)', padding: '1px 6px', borderRadius: 4 }}>
            curl -X POST .../api/auth/seed -H &quot;x-seed-secret: ...&quot;
          </code>
        </p>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

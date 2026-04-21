// ============================================================
// Business OS — Setup Page
// Accessible at /setup — seeds the superadmin from env vars.
// No auth session required (works before first login), but the
// underlying /api/auth/seed endpoint requires a SEED_SECRET header,
// which the user enters here. SEED_SECRET is set in .env.local.
// ============================================================
'use client';

import { useState, useEffect, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Loader, ArrowRight, Database, Lock } from 'lucide-react';

interface SeedStatus {
  seeded: boolean;
  created_at?: string;
  error?: string;
  message?: string;
}

interface SeedResult {
  ok?: boolean;
  action?: 'created' | 'updated';
  message?: string;
  error?: string;
}

export default function SetupPage() {
  const [secret, setSecret]     = useState('');
  const [status, setStatus]     = useState<SeedStatus | null>(null);
  const [result, setResult]     = useState<SeedResult | null>(null);
  const [loading, setLoading]   = useState(false);
  const [checking, setChecking] = useState(false);

  // Check status only after the user provides a secret. We can't probe
  // status anonymously anymore — the GET endpoint also requires the secret.
  const checkStatus = useCallback(async (secretValue: string) => {
    if (!secretValue.trim()) return;
    setChecking(true);
    try {
      const res = await fetch('/api/auth/seed', {
        method: 'GET',
        headers: { 'x-seed-secret': secretValue.trim() },
      });
      const data: SeedStatus = await res.json();
      setStatus(data);
    } catch {
      setStatus({ seeded: false, error: 'Network error' });
    } finally {
      setChecking(false);
    }
  }, []);

  // When the secret stops changing for 400ms, refresh status. This gives
  // the user immediate feedback that their secret is valid (status loads)
  // or invalid (401 surfaces in the result panel below).
  useEffect(() => {
    const trimmed = secret.trim();
    if (!trimmed) {
      setStatus(null);
      return;
    }
    const t = setTimeout(() => { void checkStatus(trimmed); }, 400);
    return () => clearTimeout(t);
  }, [secret, checkStatus]);

  async function runSeed() {
    const trimmed = secret.trim();
    if (!trimmed) {
      setResult({ error: 'Enter your SEED_SECRET from .env.local first.' });
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/auth/seed', {
        method: 'POST',
        headers: { 'x-seed-secret': trimmed },
      });
      const data: SeedResult = await res.json();
      setResult(data);
      if (data.ok) {
        await checkStatus(trimmed);
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

  const secretProvided = secret.trim().length > 0;
  const seedDone       = status?.seeded === true;
  const migrationDone  = secretProvided && status !== null && !checking;

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

          {/* Secret input — required for both status check and seed */}
          <div style={{ padding: 24, borderBottom: '1px solid var(--border-subtle)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', fontFamily: 'var(--font-body)', marginBottom: 8 }}>
              <Lock size={11} /> Seed Secret
            </label>
            <input
              type="password"
              value={secret}
              onChange={e => setSecret(e.target.value)}
              placeholder="Paste SEED_SECRET from .env.local"
              autoComplete="off"
              spellCheck={false}
              style={{
                width: '100%', padding: '10px 12px',
                background: 'var(--bg-base)', color: 'var(--text-primary)',
                border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)',
                fontSize: 13, fontFamily: 'var(--font-mono)',
                outline: 'none', transition: 'border-color 150ms, box-shadow 150ms',
              }}
              onFocus={e => { (e.currentTarget as HTMLInputElement).style.borderColor = 'var(--accent-blue)'; (e.currentTarget as HTMLInputElement).style.boxShadow = '0 0 0 3px var(--accent-blue-glow)'; }}
              onBlur={e => { (e.currentTarget as HTMLInputElement).style.borderColor = 'var(--border-default)'; (e.currentTarget as HTMLInputElement).style.boxShadow = 'none'; }}
            />
            <p style={{ marginTop: 8, fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-body)' }}>
              Required to authorize this endpoint. Generate with:{' '}
              <code style={{ background: 'var(--bg-base)', padding: '1px 6px', borderRadius: 4, fontFamily: 'var(--font-mono)', fontSize: 10 }}>
                openssl rand -hex 32
              </code>
            </p>
          </div>

          {/* Steps */}
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', fontFamily: 'var(--font-body)', marginBottom: 4 }}>Setup Checklist</p>

            {step(1, 'Set SEED_SECRET in .env.local and paste it above',     secretProvided, !secretProvided)}
            {step(2, 'Apply the consolidated schema in Supabase (001/002/003)', migrationDone,  secretProvided && !migrationDone)}
            {step(3, 'Set SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD env',    migrationDone,  migrationDone && !seedDone)}
            {step(4, 'Seed the SuperAdmin account',                          seedDone,       migrationDone && !seedDone)}
          </div>

          <div style={{ height: 1, background: 'var(--border-subtle)' }} />

          {/* Status */}
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {!secretProvided ? (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px', background: 'var(--bg-hover)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <Lock size={16} style={{ color: 'var(--text-tertiary)', flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}>
                  Enter your SEED_SECRET above to check setup status.
                </p>
              </div>
            ) : checking ? (
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
                    You can sign in now.
                  </p>
                </div>
              </div>
            ) : status?.error ? (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px', background: 'var(--accent-red-dim)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(240,82,82,0.2)' }}>
                <AlertCircle size={16} style={{ color: 'var(--accent-red)', flexShrink: 0, marginTop: 1 }} />
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-red)', fontFamily: 'var(--font-body)' }}>Status check failed</p>
                  <p style={{ fontSize: 12, color: 'var(--accent-red)', opacity: 0.8, fontFamily: 'var(--font-body)', marginTop: 2 }}>
                    {status.error} — check your SEED_SECRET matches the one in .env.local.
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
              disabled={loading || !secretProvided}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                width: '100%', padding: '11px 20px',
                background: !secretProvided ? 'var(--bg-hover)' : loading ? 'rgba(79,142,247,0.5)' : 'var(--accent-blue)',
                color: !secretProvided ? 'var(--text-tertiary)' : '#fff',
                border: 'none', borderRadius: 'var(--radius-md)',
                fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-body)',
                cursor: (loading || !secretProvided) ? 'not-allowed' : 'pointer',
                transition: 'opacity 150ms, background 150ms, color 150ms',
              }}
              onMouseEnter={e => { if (!loading && secretProvided) (e.currentTarget as HTMLElement).style.opacity = '0.88'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
            >
              {loading ? (
                <><Loader size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> Seeding...</>
              ) : !secretProvided ? (
                <><Lock size={14} /> Enter SEED_SECRET to continue</>
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
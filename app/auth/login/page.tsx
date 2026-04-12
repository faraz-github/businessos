'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Mail, Lock, AlertCircle } from 'lucide-react';

interface PublicBrand {
  business_name: string | null;
  logo_url: string | null;
  primary_colour: string;
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [brand, setBrand] = useState<PublicBrand | null>(null);
  const [brandLoaded, setBrandLoaded] = useState(false);

  // Fetch brand on mount — unauthenticated, safe
  useEffect(() => {
    fetch('/api/brand/public', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setBrand(data); setBrandLoaded(true); })
      .catch(() => { setBrandLoaded(true); });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Something went wrong'); return; }
      // Route based on role and allowed sections — mirrors proxy.ts getDefaultRoute()
      if (data.user.role === 'superadmin') {
        router.push('/dashboard/personal/home');
      } else if (data.user.allowedPersonal?.length) {
        router.push(`/dashboard/personal/${data.user.allowedPersonal[0]}`);
      } else if (data.user.allowedAgency?.length) {
        router.push(`/dashboard/agency/${data.user.allowedAgency[0]}`);
      } else {
        router.push('/403');
      }
      router.refresh();
    } catch {
      setError('Could not connect to server. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const primaryColour = brand?.primary_colour || '#4F8EF7';
  const displayName   = brand?.business_name  || 'Business OS';

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'var(--bg-input)',
    border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius-md)',
    padding: '9px 12px 9px 36px',
    fontSize: 13,
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-body)',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 150ms, box-shadow 150ms',
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-base)', padding: 16, position: 'relative', overflow: 'hidden',
    }}>
      {/* Background glow using brand primary colour */}
      <div style={{
        position: 'absolute', top: '35%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 600, height: 400, borderRadius: '50%',
        background: `radial-gradient(ellipse, ${primaryColour}12 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0, 0, 0.2, 1] }}
        style={{ width: '100%', maxWidth: 360, position: 'relative' }}
      >
        {/* Brand mark — hidden until brand fetch resolves to avoid flash */}
        <div style={{ textAlign: 'center', marginBottom: 28, opacity: brandLoaded ? 1 : 0, transition: 'opacity 200ms' }}>
          {brand?.logo_url ? (
            /* Real logo — square with slight rounding */
            <div style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 56, height: 56, borderRadius: 14,
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-default)',
              marginBottom: 14, overflow: 'hidden',
            }}>
              <img
                src={brand.logo_url}
                alt={displayName}
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            </div>
          ) : (
            /* Fallback monogram using brand primary colour */
            <div style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 48, height: 48, borderRadius: 12,
              background: `${primaryColour}1A`,
              border: `1px solid ${primaryColour}33`,
              marginBottom: 14,
            }}>
              <span style={{
                fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800,
                color: primaryColour, lineHeight: 1,
              }}>
                {displayName[0].toUpperCase()}
              </span>
            </div>
          )}

          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 26, fontWeight: 800, letterSpacing: '-0.5px',
            color: 'var(--text-primary)', lineHeight: 1, margin: 0,
          }}>
            {displayName}
          </h1>
          <p style={{
            marginTop: 8, fontSize: 13,
            color: 'var(--text-secondary)', fontFamily: 'var(--font-body)',
          }}>
            Sign in to your workspace
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-xl)',
          padding: 24, boxShadow: 'var(--shadow-elevated)',
        }}>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Email */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label className="t-label">Email</label>
              <div style={{ position: 'relative' }}>
                <Mail size={14} style={{
                  position: 'absolute', left: 11, top: '50%',
                  transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none',
                }} />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="your@email.com" required autoComplete="email"
                  style={inputStyle}
                  onFocus={e => { e.target.style.borderColor = 'var(--accent-blue)'; e.target.style.boxShadow = '0 0 0 3px var(--accent-blue-glow)'; }}
                  onBlur={e => { e.target.style.borderColor = 'var(--border-default)'; e.target.style.boxShadow = 'none'; }}
                />
              </div>
            </div>

            {/* Password */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label className="t-label">Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={14} style={{
                  position: 'absolute', left: 11, top: '50%',
                  transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none',
                }} />
                <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" required autoComplete="current-password"
                  style={inputStyle}
                  onFocus={e => { e.target.style.borderColor = 'var(--accent-blue)'; e.target.style.boxShadow = '0 0 0 3px var(--accent-blue-glow)'; }}
                  onBlur={e => { e.target.style.borderColor = 'var(--border-default)'; e.target.style.boxShadow = 'none'; }}
                />
              </div>
            </div>

            {/* Error */}
            {error && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '9px 12px',
                background: 'var(--accent-red-dim)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid rgba(240,82,82,0.2)',
              }}>
                <AlertCircle size={13} style={{ color: 'var(--accent-red)', flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: 'var(--accent-red)', fontFamily: 'var(--font-body)' }}>{error}</span>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                width: '100%', padding: '10px 20px',
                background: loading ? `${primaryColour}99` : primaryColour,
                color: '#fff', border: 'none',
                borderRadius: 'var(--radius-md)',
                fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-body)',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'opacity 150ms', marginTop: 4,
              }}
              onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLElement).style.opacity = '0.88'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
            >
              {loading ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                    style={{ animation: 'spin 0.8s linear infinite' }}>
                    <circle cx="12" cy="12" r="10" stroke="currentColor"
                      strokeWidth="3" strokeDasharray="32" strokeLinecap="round" />
                  </svg>
                  Signing in...
                </>
              ) : 'Sign in'}
            </button>
          </form>
        </div>

        <p style={{
          marginTop: 20, textAlign: 'center',
          fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-body)',
        }}>
          Forgot your password? Contact the administrator.
        </p>
      </motion.div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

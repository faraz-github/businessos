'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { motion } from 'framer-motion';
import { Mail, Lock, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    const supabase = createClient();

    try {
      if (isSignUp) {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
        });
        if (signUpError) throw signUpError;
        setSuccess('Check your email for a confirmation link.');
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
        router.push('/dashboard/personal/home');
        router.refresh();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'var(--bg-base)' }}
    >
      {/* Subtle background glow */}
      <div
        className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(79,142,247,0.06) 0%, transparent 70%)',
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0, 0, 0.2, 1] }}
        className="w-full max-w-sm relative"
      >
        {/* Logo / Title */}
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-11 h-11 rounded-xl mb-4"
            style={{ background: 'var(--accent-blue-dim)', border: '1px solid var(--accent-blue-dim)' }}
          >
            <span style={{ color: 'var(--accent-blue)', fontSize: 20, fontWeight: 800, fontFamily: 'var(--font-display)' }}>
              B
            </span>
          </div>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 26,
              fontWeight: 800,
              letterSpacing: '-0.5px',
              color: 'var(--text-primary)',
              lineHeight: 1,
            }}
          >
            Business OS
          </h1>
          <p style={{ marginTop: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
            {isSignUp ? 'Create your workspace' : 'Sign in to your workspace'}
          </p>
        </div>

        {/* Card */}
        <div
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-xl)',
            padding: 24,
            boxShadow: 'var(--shadow-elevated)',
          }}
        >
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Email */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label
                htmlFor="email"
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: 'var(--text-tertiary)',
                  fontFamily: 'var(--font-body)',
                }}
              >
                Email
              </label>
              <div style={{ position: 'relative' }}>
                <Mail
                  size={14}
                  style={{
                    position: 'absolute',
                    left: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-tertiary)',
                  }}
                />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  style={{
                    width: '100%',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-md)',
                    padding: '8px 12px 8px 36px',
                    fontSize: 13,
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-body)',
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border-color 150ms, box-shadow 150ms',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = 'var(--accent-blue)';
                    e.target.style.boxShadow = '0 0 0 3px var(--accent-blue-glow)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'var(--border-default)';
                    e.target.style.boxShadow = 'none';
                  }}
                />
              </div>
            </div>

            {/* Password */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label
                htmlFor="password"
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: 'var(--text-tertiary)',
                  fontFamily: 'var(--font-body)',
                }}
              >
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <Lock
                  size={14}
                  style={{
                    position: 'absolute',
                    left: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-tertiary)',
                  }}
                />
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  style={{
                    width: '100%',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-md)',
                    padding: '8px 12px 8px 36px',
                    fontSize: 13,
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-body)',
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border-color 150ms, box-shadow 150ms',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = 'var(--accent-blue)';
                    e.target.style.boxShadow = '0 0 0 3px var(--accent-blue-glow)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'var(--border-default)';
                    e.target.style.boxShadow = 'none';
                  }}
                />
              </div>
            </div>

            {/* Error / Success */}
            {error && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 12px',
                  background: 'var(--accent-red-dim)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 12,
                  color: 'var(--accent-red)',
                }}
              >
                <AlertCircle size={13} style={{ flexShrink: 0 }} />
                {error}
              </div>
            )}
            {success && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 12px',
                  background: 'var(--accent-green-dim)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 12,
                  color: 'var(--accent-green)',
                }}
              >
                <CheckCircle2 size={13} style={{ flexShrink: 0 }} />
                {success}
              </div>
            )}

            <Button type="submit" loading={loading} size="lg" className="w-full mt-1">
              {isSignUp ? 'Create account' : 'Sign in'}
            </Button>
          </form>

          <div style={{ marginTop: 16, textAlign: 'center' }}>
            <button
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError('');
                setSuccess('');
              }}
              style={{
                fontSize: 12,
                color: 'var(--accent-blue)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'var(--font-body)',
              }}
            >
              {isSignUp
                ? 'Already have an account? Sign in'
                : "Don't have an account? Create one"}
            </button>
          </div>
        </div>

        {/* Footer note */}
        <p
          style={{
            marginTop: 20,
            textAlign: 'center',
            fontSize: 11,
            color: 'var(--text-tertiary)',
          }}
        >
          Your data is private and only accessible to you.
        </p>
      </motion.div>
    </div>
  );
}

'use client';

import { useState, useEffect, useRef } from 'react';
import { useBrand } from '@/lib/brand';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';

interface QuickLogModalProps {
  open: boolean;
  onClose: () => void;
  onLogged?: () => void;
}

export function QuickLogModal({ open, onClose, onLogged }: QuickLogModalProps)): JSX.Element {
  const { mode } = useBrand();
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setContent('');
      setTimeout(() => textareaRef.current?.focus(), 80);
    }
  }, [open]);

  async function handleSubmit() {
    const text = content.trim();
    if (!text || saving) return;
    setSaving(true);
    try {
      const res = await fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, content: text }),
      });
      if (!res.ok) throw new Error('Failed to save log');
      onLogged?.();
      window.dispatchEvent(new CustomEvent('quicklog:saved', { detail: { mode } }));
      onClose();
    } catch (err) {
      console.error('Quick log failed:', err);
    } finally {
      setSaving(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  }

  const isPersonal = mode === 'personal';

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-[100] bg-black/55 backdrop-blur-[6px]"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
          />

          {/* Modal */}
          <div className="fixed inset-0 z-[101] flex items-center justify-center p-5">
            <motion.div
              style={{
                width: '100%', maxWidth: 380,
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-xl)',
                boxShadow: 'var(--shadow-modal)',
                overflow: 'hidden',
              }}
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              transition={{ duration: 0.2, ease: [0, 0, 0.2, 1] }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ padding: '20px 20px 20px' }}>

                {/* Top row: mode pill + close button */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '3px 10px', borderRadius: 100,
                    background: isPersonal ? 'var(--accent-blue-dim)' : 'var(--accent-violet-dim)',
                    color: isPersonal ? 'var(--accent-blue)' : 'var(--accent-violet)',
                    fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.06em',
                  }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', flexShrink: 0 }} />
                    {isPersonal ? 'Personal' : 'Agency'}
                  </div>

                  <button
                    onClick={onClose}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: 26, height: 26, borderRadius: 'var(--radius-sm)',
                      background: 'transparent', border: 'none', cursor: 'pointer',
                      color: 'var(--text-tertiary)', transition: 'background 150ms, color 150ms',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; }}
                  >
                    <X size={14} />
                  </button>
                </div>

                {/* Textarea */}
                <textarea
                  ref={textareaRef}
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="What happened? Just type it..."
                  style={{
                    width: '100%', minHeight: 96, resize: 'none', outline: 'none',
                    background: 'var(--bg-hover)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: '12px 14px',
                    fontSize: 13, fontFamily: 'var(--font-body)',
                    color: 'var(--text-primary)', lineHeight: 1.6,
                    transition: 'border-color 150ms',
                    display: 'block',
                  }}
                  onFocus={e => { e.target.style.borderColor = 'var(--accent-blue)'; }}
                  onBlur={e => { e.target.style.borderColor = 'var(--border-subtle)'; }}
                />

                {/* Footer: hint left, button right */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-body)' }}>
                    ⌘ Enter to save
                  </span>
                  <button
                    onClick={handleSubmit}
                    disabled={!content.trim() || saving}
                    style={{
                      padding: '7px 18px',
                      background: content.trim() ? 'var(--accent-blue)' : 'var(--bg-hover)',
                      color: content.trim() ? '#fff' : 'var(--text-tertiary)',
                      border: 'none', borderRadius: 'var(--radius-md)',
                      fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-body)',
                      cursor: content.trim() ? 'pointer' : 'default',
                      transition: 'background 150ms, color 150ms',
                    }}
                  >
                    {saving ? 'Saving…' : 'Log it'}
                  </button>
                </div>

              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

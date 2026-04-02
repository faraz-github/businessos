'use client';

import { useEffect, useCallback, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeMap = { sm: 400, md: 520, lg: 680, xl: 860 };

export function Modal({ open, onClose, title, description, children, size = 'md' }: ModalProps) {
  const handleEscape = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [open, handleEscape]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-[100] bg-black/55 backdrop-blur-[6px]"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
          />
          <div className="fixed inset-0 z-[101] flex items-center justify-center p-5">
            <motion.div
              className="card-elevated flex flex-col overflow-hidden w-full"
              style={{ maxWidth: sizeMap[size], maxHeight: '88vh', boxShadow: 'var(--shadow-modal)' }}
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              transition={{ duration: 0.2, ease: [0, 0, 0.2, 1] }}
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              {(title || description) && (
                <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b-subtle shrink-0">
                  <div>
                    {title && <h2 className="t-h2">{title}</h2>}
                    {description && <p className="t-xs mt-1">{description}</p>}
                  </div>
                  <button
                    onClick={onClose}
                    className="flex items-center justify-center w-7 h-7 radius-sm bg-hover transition-colors text-tertiary hover-text-primary ml-3 shrink-0"
                    style={{ border: 'none', cursor: 'pointer' }}
                  >
                    <X size={15} />
                  </button>
                </div>
              )}
              {/* Body */}
              <div className="flex-1 overflow-y-auto p-6">{children}</div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

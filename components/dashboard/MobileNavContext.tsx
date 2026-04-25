'use client';
// ============================================================
// Business OS — MobileNavContext
// Controls the sidebar drawer open/close state on tablet/mobile.
// The sidebar itself renders the drawer via CSS (media queries
// in globals.css); this context only owns the open boolean.
// Desktop doesn't read the value — the drawer CSS is scoped to
// max-width: 1023px, so opening it on desktop is a no-op.
// ============================================================

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';

interface MobileNavValue {
  open: boolean;
  setOpen: (v: boolean) => void;
  toggle: () => void;
}

const MobileNavCtx = createContext<MobileNavValue | null>(null);

export function MobileNavProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close the drawer on route change.  Without this, tapping a
  // nav item navigates but leaves the drawer overlaying the new
  // page — surprising and obscures content.
  useEffect(() => { setOpen(false); }, [pathname]);

  // Lock body scroll while the drawer is open on mobile.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const value = useMemo<MobileNavValue>(() => ({
    open,
    setOpen,
    toggle: () => setOpen(v => !v),
  }), [open]);

  return <MobileNavCtx.Provider value={value}>{children}</MobileNavCtx.Provider>;
}

export function useMobileNav(): MobileNavValue {
  const ctx = useContext(MobileNavCtx);
  // Fall back to a no-op so components rendered outside the
  // provider (e.g. the public /doc/[token] page if it ever
  // reuses the sidebar) don't crash.
  if (!ctx) return { open: false, setOpen: () => {}, toggle: () => {} };
  return ctx;
}

/**
 * Backdrop rendered by the dashboard layout. Only visible when
 * the drawer is open AND the viewport is below lg — the drawer
 * CSS hides this on desktop via a media query in globals.css.
 */
export function SidebarBackdrop() {
  const { open, setOpen } = useMobileNav();
  // Hook must be called unconditionally — keep it above the early return
  // so the hook order is stable across renders (Rules of Hooks).
  const handleClick = useCallback(() => setOpen(false), [setOpen]);
  if (!open) return null;
  return (
    <div
      className="sidebar-backdrop"
      aria-hidden
      onClick={handleClick}
    />
  );
}

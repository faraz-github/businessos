'use client';
// ============================================================
// OverflowMenu — trigger button + dropdown popover for secondary
// row actions. Used by dense list rows on mobile to move
// destructive / less-common actions out of the visible strip.
//
// Usage:
//   <OverflowMenu
//     items={[
//       { label: 'Preview', icon: <ExternalLink size={14} />, onClick: () => … },
//       { label: 'Delete', icon: <Trash2 size={14} />, onClick: () => …, destructive: true },
//     ]}
//   />
//
// By default the trigger is mobile-only (appears < 768px). Pass
// `alwaysVisible` to show it at all breakpoints — useful when
// all row actions are secondary and always live in the menu.
// ============================================================

import { useState, useRef, useEffect, useCallback, type ReactNode } from 'react';
import { MoreHorizontal } from 'lucide-react';

export interface OverflowMenuItem {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  destructive?: boolean;
  disabled?: boolean;
}

interface OverflowMenuProps {
  items: OverflowMenuItem[];
  alwaysVisible?: boolean;
  /** Accessible label for the trigger. Default: "More actions". */
  ariaLabel?: string;
  /** Optional stop-propagation for cases where the row itself is clickable. */
  stopPropagation?: boolean;
}

export function OverflowMenu({
  items,
  alwaysVisible = false,
  ariaLabel = 'More actions',
  stopPropagation = false,
}: OverflowMenuProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Position the popover below the trigger, right-aligned. We measure
  // on open rather than at layout because the trigger can sit inside
  // cards whose position changes as the list scrolls.
  useEffect(() => {
    if (!open || !triggerRef.current) { setPos(null); return; }
    const rect = triggerRef.current.getBoundingClientRect();
    setPos({
      top: rect.bottom + window.scrollY + 6,
      right: window.innerWidth - rect.right - window.scrollX,
    });
  }, [open]);

  // Close on outside click or Escape
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      const t = e.target as Node;
      if (
        triggerRef.current?.contains(t) ||
        popoverRef.current?.contains(t)
      ) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const handleTriggerClick = useCallback((e: React.MouseEvent) => {
    if (stopPropagation) e.stopPropagation();
    setOpen(v => !v);
  }, [stopPropagation]);

  const handleItemClick = useCallback((e: React.MouseEvent, item: OverflowMenuItem) => {
    if (stopPropagation) e.stopPropagation();
    if (item.disabled) return;
    setOpen(false);
    item.onClick();
  }, [stopPropagation]);

  if (items.length === 0) return null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={handleTriggerClick}
        className={`overflow-menu-trigger${alwaysVisible ? '' : ' mobile-only'}`}
      >
        <MoreHorizontal size={15} />
      </button>

      {open && pos && (
        <div
          ref={popoverRef}
          role="menu"
          className="overflow-menu-popover"
          style={{ top: pos.top, right: pos.right }}
          onClick={stopPropagation ? e => e.stopPropagation() : undefined}
        >
          {items.map((item, i) => (
            <button
              key={i}
              type="button"
              role="menuitem"
              aria-disabled={item.disabled || undefined}
              disabled={item.disabled}
              onClick={e => handleItemClick(e, item)}
              className={`overflow-menu-item${item.destructive ? ' overflow-menu-item--danger' : ''}`}
            >
              {item.icon && <span style={{ display: 'flex', color: item.destructive ? 'var(--accent-red)' : 'var(--text-tertiary)' }}>{item.icon}</span>}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </>
  );
}

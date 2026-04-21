'use client';
// ============================================================
// Business OS — ConfirmDialog
//
// Two-step confirmation modal for destructive actions (delete a
// client, remove a subscription, discard unsaved changes, etc.).
//
// Use this instead of bare `window.confirm()` or ad-hoc modals so
// destructive flows have a consistent look and a single retry path.
//
// Usage:
//   <ConfirmDialog
//     open={confirmOpen}
//     onClose={() => setConfirmOpen(false)}
//     onConfirm={handleDelete}
//     title="Delete this client?"
//     description="All associated documents will be unlinked. This cannot be undone."
//     confirmLabel="Delete"
//     loading={deleting}
//   />
// ============================================================

import { AlertTriangle } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  /** Label for the destructive button. Default: 'Confirm'. */
  confirmLabel?: string;
  /** Label for the cancel button. Default: 'Cancel'. */
  cancelLabel?: string;
  /** When true, the confirm button shows a spinner and cancel is disabled. */
  loading?: boolean;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  loading = false,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onClose} size="sm">
      <div className="flex flex-col items-center text-center pt-2">
        <div className="w-12 h-12 rounded-full bg-accent-amber-dim flex items-center justify-center mb-4">
          <AlertTriangle size={20} className="text-accent-amber" />
        </div>
        <p className="t-sm-semibold mb-2">{title}</p>
        <p className="t-xs mb-6 max-w-xs">{description}</p>
        <div className="flex items-center gap-3 w-full">
          <Button
            variant="secondary"
            onClick={onClose}
            style={{ flex: 1 }}
            disabled={loading}
          >
            {cancelLabel}
          </Button>
          <Button
            variant="danger"
            onClick={onConfirm}
            loading={loading}
            style={{ flex: 1 }}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

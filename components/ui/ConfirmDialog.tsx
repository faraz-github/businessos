'use client';

import { Modal } from './Modal';
import { Button } from './Button';
import { AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  loading?: boolean;
}

export function ConfirmDialog({ open, onClose, onConfirm, title, description, confirmLabel = 'Confirm', loading }: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onClose} size="sm">
      <div className="flex flex-col items-center text-center pt-2">
        <div className="w-12 h-12 rounded-full bg-accent-amber-dim flex items-center justify-center mb-4">
          <AlertTriangle size={20} className="text-accent-amber" />
        </div>
        <p className="t-sm-semibold mb-2">{title}</p>
        <p className="t-xs mb-6 max-w-xs">{description}</p>
        <div className="flex items-center gap-3 w-full">
          <Button variant="secondary" onClick={onClose} style={{ flex: 1 }} disabled={loading}>Cancel</Button>
          <Button variant="danger" onClick={onConfirm} loading={loading} style={{ flex: 1 }}>{confirmLabel}</Button>
        </div>
      </div>
    </Modal>
  );
}

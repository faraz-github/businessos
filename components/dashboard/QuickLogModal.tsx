'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { quickLogSchema, type QuickLogFormData } from '@/types/schemas';
import { useBrand } from '@/lib/brand';
import { createClient } from '@/lib/supabase/client';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { cn } from '@/lib/utils';
import {
  UserPlus,
  Phone,
  StickyNote,
  IndianRupee,
  CheckSquare,
  MoreHorizontal,
} from 'lucide-react';
import type { QuickLogType } from '@/types';

interface QuickLogModalProps {
  open: boolean;
  onClose: () => void;
}

const logTypes: {
  value: QuickLogType;
  label: string;
  icon: React.ReactNode;
  color: string;
}[] = [
  { value: 'lead', label: 'Lead', icon: <UserPlus size={16} />, color: 'var(--accent-blue)' },
  { value: 'call', label: 'Call', icon: <Phone size={16} />, color: 'var(--accent-green)' },
  {
    value: 'client_note',
    label: 'Client Note',
    icon: <StickyNote size={16} />,
    color: 'var(--accent-amber)',
  },
  {
    value: 'payment',
    label: 'Payment',
    icon: <IndianRupee size={16} />,
    color: 'var(--accent-violet)',
  },
  {
    value: 'task',
    label: 'Task',
    icon: <CheckSquare size={16} />,
    color: 'var(--accent-blue)',
  },
  {
    value: 'other',
    label: 'Other',
    icon: <MoreHorizontal size={16} />,
    color: 'var(--text-secondary)',
  },
];

export function QuickLogModal({ open, onClose }: QuickLogModalProps) {
  const { mode } = useBrand();
  const [saving, setSaving] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<QuickLogFormData>({
    resolver: zodResolver(quickLogSchema),
    defaultValues: { mode, type: 'lead', content: '' },
  });

  const selectedType = watch('type');

  function handleTypeSelect(type: QuickLogType) {
    setValue('type', type, { shouldValidate: true });
  }

  async function onSubmit(data: QuickLogFormData) {
    setSaving(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.from('quick_logs').insert({
        user_id: user.id,
        mode: data.mode,
        type: data.type,
        content: data.content,
      });

      reset({ mode, type: 'lead', content: '' });
      onClose();
    } catch (error) {
      console.error('Quick log failed:', error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Quick Log"
      description="Log something in under 10 seconds."
      size="sm"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <input type="hidden" {...register('mode')} value={mode} />
        <input type="hidden" {...register('type')} />

        {/* Type selector */}
        <div className="grid grid-cols-3 gap-2">
          {logTypes.map((lt) => (
            <button
              key={lt.value}
              type="button"
              onClick={() => handleTypeSelect(lt.value)}
              className={cn(
                'flex flex-col items-center gap-1.5 py-3 rounded-[var(--radius-md)] border transition-all text-xs',
                selectedType === lt.value
                  ? 'border-[var(--accent-blue)] bg-[var(--accent-blue-dim)]'
                  : 'border-[var(--border-subtle)] hover:border-[var(--border-default)] bg-transparent',
              )}
            >
              <span style={{ color: lt.color }}>{lt.icon}</span>
              <span className="text-[var(--text-secondary)]">{lt.label}</span>
            </button>
          ))}
        </div>

        <Textarea
          {...register('content')}
          placeholder="What happened? Keep it brief..."
          error={errors.content?.message}
          style={{ minHeight: 60 }}
          autoFocus
        />

        <div className="flex gap-2 pt-1">
          <Button variant="secondary" type="button" onClick={onClose} style={{ flex: 1 }}>
            Cancel
          </Button>
          <Button type="submit" loading={saving} style={{ flex: 1 }}>
            Log it
          </Button>
        </div>
      </form>
    </Modal>
  );
}

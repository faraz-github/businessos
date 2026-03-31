'use client';

import { cn } from '@/lib/utils';

interface ColorPickerProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  presets?: string[];
  className?: string;
}

const defaultPresets = [
  '#4F8EF7', '#8B6CF7', '#34C988', '#F5A623', '#F05252',
  '#3B82F6', '#6366F1', '#14B8A6', '#F59E0B', '#EF4444',
  '#0EA5E9', '#A855F7', '#10B981', '#F97316', '#EC4899',
];

export function ColorPicker({ label, value, onChange, presets = defaultPresets, className }: ColorPickerProps) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {label && (
        <label className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
          {label}
        </label>
      )}
      <div className="flex items-center gap-3">
        <div className="relative">
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <div
            className="w-9 h-9 rounded-[var(--radius-md)] border border-[var(--border-default)] cursor-pointer"
            style={{ background: value }}
          />
        </div>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[var(--radius-md)] px-3 py-1.5 text-[13px] text-[var(--text-primary)] font-[family-name:var(--font-mono)] w-24 outline-none focus:border-[var(--accent-blue)]"
          maxLength={7}
        />
      </div>
      <div className="flex flex-wrap gap-1.5 mt-1">
        {presets.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => onChange(color)}
            className={cn(
              'w-5 h-5 rounded-full border-2 transition-transform hover:scale-110',
              value === color ? 'border-white scale-110' : 'border-transparent',
            )}
            style={{ background: color }}
          />
        ))}
      </div>
    </div>
  );
}

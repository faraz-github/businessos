'use client';

interface ColorPickerProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  presets?: string[];
}

const DEFAULT_PRESETS = [
  '#4F8EF7', '#8B6CF7', '#34C988', '#F5A623', '#F05252',
  '#3B82F6', '#6366F1', '#14B8A6', '#F59E0B', '#EF4444',
  '#0EA5E9', '#A855F7', '#10B981', '#F97316', '#EC4899',
];

export function ColorPicker({ label, value, onChange, presets = DEFAULT_PRESETS }: ColorPickerProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {label && <label className="t-label">{label}</label>}

      {/* Swatch + hex input */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* Clickable colour swatch */}
        <div style={{ position: 'relative', width: 36, height: 36, flexShrink: 0 }}>
          <input
            type="color"
            value={value}
            onChange={e => onChange(e.target.value)}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
          />
          <div style={{
            width: 36, height: 36,
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-default)',
            background: value,
            cursor: 'pointer',
          }} />
        </div>

        {/* Hex text input */}
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          maxLength={7}
          style={{
            width: 96,
            background: 'var(--bg-input)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-md)',
            padding: '7px 10px',
            fontSize: 13,
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-primary)',
            outline: 'none',
            transition: 'border-color 150ms',
          }}
          onFocus={e => { e.target.style.borderColor = 'var(--accent-blue)'; }}
          onBlur={e => { e.target.style.borderColor = 'var(--border-default)'; }}
        />
      </div>

      {/* Preset swatches */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {presets.map(color => (
          <button
            key={color}
            type="button"
            onClick={() => onChange(color)}
            style={{
              width: 20, height: 20,
              borderRadius: '50%',
              border: `2px solid ${value === color ? 'var(--text-primary)' : 'transparent'}`,
              background: color,
              cursor: 'pointer',
              padding: 0,
              transform: value === color ? 'scale(1.15)' : 'scale(1)',
              transition: 'transform 150ms, border-color 150ms',
              outline: 'none',
            }}
          />
        ))}
      </div>
    </div>
  );
}

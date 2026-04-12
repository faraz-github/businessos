// ============================================================
// Business OS — Skeleton component
// Uses design system tokens only — no Tailwind classes.
// Animation uses ds-pulse from globals.css.
// ============================================================

interface SkeletonProps {
  style?: React.CSSProperties;
  rounded?: 'sm' | 'md' | 'lg' | 'full';
}

// A single skeleton bar. All sizing via inline style — keeps
// the skeleton output pixel-accurate to the real content.
export function Skeleton({ style, rounded = 'md' }: SkeletonProps) {
  const radii = {
    sm:   'var(--radius-sm)',
    md:   'var(--radius-md)',
    lg:   'var(--radius-lg)',
    full: '100px',
  };
  return (
    <div style={{
      background:   'var(--bg-hover)',
      borderRadius: radii[rounded],
      animation:    'ds-pulse 1.6s ease-in-out infinite',
      flexShrink:   0,
      ...style,
    }} />
  );
}

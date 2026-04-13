'use client';

export default function ForbiddenPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)' }}>
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontFamily: 'var(--font-display)', fontSize: 64, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>403</p>
        <p style={{ marginTop: 12, fontSize: 14, color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}>
          You don&apos;t have access to this section.
        </p>
        <p style={{ marginTop: 6, fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'var(--font-body)' }}>
          Contact your administrator to request access.
        </p>
        <button onClick={() => window.history.back()}
          style={{ display: 'inline-block', marginTop: 20, padding: '8px 18px', background: 'transparent', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', color: 'var(--text-secondary)', fontSize: 12, fontFamily: 'var(--font-body)', cursor: 'pointer', transition: 'all 150ms' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-strong)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; }}>
          ← Go back
        </button>
      </div>
    </div>
  );
}

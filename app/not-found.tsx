export default function NotFound() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)' }}>
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontFamily: 'var(--font-display)', fontSize: 64, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>404</p>
        <p style={{ marginTop: 12, fontSize: 14, color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}>
          This page doesn&apos;t exist.
        </p>
        {/* proxy.ts will redirect to the correct home for the current user's role */}
        <a href="/dashboard/personal/home"
          style={{ display: 'inline-block', marginTop: 20, padding: '9px 20px', background: 'var(--accent-blue)', borderRadius: 'var(--radius-md)', color: '#fff', fontSize: 12, fontWeight: 500, fontFamily: 'var(--font-body)', textDecoration: 'none' }}>
          Go home
        </a>
      </div>
    </div>
  );
}

export default function ForbiddenPage() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'var(--bg-base)',
    }}>
      <div style={{ textAlign: 'center' }}>
        <p style={{
          fontFamily: 'var(--font-display)', fontSize: 64, fontWeight: 800,
          color: 'var(--text-primary)', lineHeight: 1,
        }}>403</p>
        <p style={{ marginTop: 12, fontSize: 14, color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}>
          You don&apos;t have access to this section.
        </p>
        <p style={{ marginTop: 6, fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'var(--font-body)' }}>
          Contact your administrator to request access.
        </p>
      </div>
    </div>
  );
}

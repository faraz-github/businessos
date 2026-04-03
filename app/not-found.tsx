export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-base">
      <div className="text-center">
        <p className="t-display">404</p>
        <p className="t-xs text-secondary mt-3">This page doesn&apos;t exist.</p>
        <a href="/dashboard/personal/home"
          className="inline-block mt-6 bg-accent-blue radius-md interactive no-underline" style={{ padding: "10px 20px", color: "#fff", fontSize: 12, fontWeight: 500, fontFamily: "var(--font-body)" }}>
          Go home
        </a>
      </div>
    </div>
  );
}

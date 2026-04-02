import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-base)]">
      <div className="text-center">
        <h1 style={{ fontFamily: "Space Grotesk, sans-serif", fontSize: 60, fontWeight: 800, letterSpacing: "-1px", color: "var(--text-primary)" }}>404</h1>
        <p className="mt-3 text-[var(--text-secondary)]">This page doesn&apos;t exist.</p>
        <Link
          href="/dashboard/personal/home"
          className="inline-block mt-6 px-5 py-2.5 bg-[var(--accent-blue)] text-white rounded-[var(--radius-md)] text-sm font-medium no-underline hover:opacity-90 transition-opacity"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}

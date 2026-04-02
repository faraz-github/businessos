export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-base">
      <div className="text-center">
        <p className="t-display">404</p>
        <p className="t-xs text-secondary mt-3">This page doesn&apos;t exist.</p>
        <a href="/dashboard/personal/home"
          className="inline-block mt-6 px-5 py-2.5 bg-accent-blue text-white radius-md t-xs font-medium no-underline interactive">
          Go home
        </a>
      </div>
    </div>
  );
}

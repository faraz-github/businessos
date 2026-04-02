interface SkeletonProps { className?: string; }

export function Skeleton({ className = '' }: SkeletonProps) {
  return <div className={`bg-hover radius-md animate-pulse ${className}`} />;
}

export function SkeletonCard() {
  return (
    <div className="card p-5">
      <Skeleton className="h-3 w-20 mb-3" />
      <Skeleton className="h-7 w-32 mb-2" />
      <Skeleton className="h-3 w-24" />
    </div>
  );
}

export function SkeletonMetricRow() {
  return (
    <div className="grid grid-cols-4 gap-3">
      {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
    </div>
  );
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-4 py-2">
        <Skeleton className="h-3 w-24" /><Skeleton className="h-3 w-32" />
        <Skeleton className="h-3 w-20" /><Skeleton className="h-3 w-16" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 py-3 border-t-subtle">
          <Skeleton className="h-4 w-28" /><Skeleton className="h-4 w-36" />
          <Skeleton className="h-4 w-20" /><Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}

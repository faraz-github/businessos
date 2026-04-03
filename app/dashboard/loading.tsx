import { Skeleton } from '@/components/ui/Skeleton';

export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-9">
      {/* Page header */}
      <div>
        <Skeleton className="h-8 w-52 mb-2 radius-md" />
        <Skeleton className="h-4 w-64 radius-md" />
      </div>

      {/* Two-column layout matching home page */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 32 }}>
        {/* Left column */}
        <div className="flex flex-col gap-9">
          {/* Attention section */}
          <div>
            <Skeleton className="h-3 w-28 mb-3 radius-md" />
            <Skeleton className="h-32 w-full radius-lg" />
          </div>
          {/* Stats grid */}
          <div>
            <Skeleton className="h-3 w-36 mb-3 radius-md" />
            <div className="grid grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="card">
                  <Skeleton className="h-3 w-20 mb-3 radius-md" />
                  <Skeleton className="h-8 w-28 mb-2 radius-md" />
                  <Skeleton className="h-3 w-24 radius-md" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right column — focus panel */}
        <div className="flex flex-col gap-4">
          <Skeleton className="h-3 w-24 radius-md" />
          <div className="card">
            <Skeleton className="h-3 w-28 mb-4 radius-md" />
            <div className="flex flex-col gap-3">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-5 w-full radius-md" />
              ))}
            </div>
          </div>
          <div className="card">
            <Skeleton className="h-3 w-24 mb-4 radius-md" />
            <Skeleton className="h-4 w-40 radius-md" />
          </div>
        </div>
      </div>
    </div>
  );
}

import { Skeleton, SkeletonMetricRow } from '@/components/ui/Skeleton';

export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <Skeleton className="h-7 w-48 mb-2" />
        <Skeleton className="h-4 w-72" />
      </div>
      <SkeletonMetricRow />
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 flex flex-col gap-3">
          <Skeleton className="h-3 w-32 mb-2" />
          <Skeleton className="h-16 w-full radius-lg" />
          <Skeleton className="h-16 w-full radius-lg" />
          <Skeleton className="h-16 w-full radius-lg" />
        </div>
        <div className="flex flex-col gap-3">
          <Skeleton className="h-3 w-24 mb-2" />
          <Skeleton className="h-32 w-full radius-lg" />
          <Skeleton className="h-48 w-full radius-lg" />
        </div>
      </div>
    </div>
  );
}

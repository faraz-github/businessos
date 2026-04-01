import { Skeleton, SkeletonMetricRow } from '@/components/ui/Skeleton';

export default function DashboardLoading() {
  return (
    <div className="space-y-6 p-6">
      <div>
        <Skeleton className="h-7 w-48 mb-2" />
        <Skeleton className="h-4 w-72" />
      </div>
      <SkeletonMetricRow />
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 space-y-3">
          <Skeleton className="h-3 w-32 mb-2" />
          <Skeleton className="h-16 w-full rounded-[14px]" />
          <Skeleton className="h-16 w-full rounded-[14px]" />
          <Skeleton className="h-16 w-full rounded-[14px]" />
        </div>
        <div className="space-y-3">
          <Skeleton className="h-3 w-24 mb-2" />
          <Skeleton className="h-32 w-full rounded-[14px]" />
          <Skeleton className="h-48 w-full rounded-[14px]" />
        </div>
      </div>
    </div>
  );
}

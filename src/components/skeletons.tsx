import { Skeleton } from "@/components/ui/skeleton";

/** Matches the dashboard layout: header → 4 stat cards → chart grid pairs */
export function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      {/* Page header */}
      <div>
        <Skeleton className="h-8 w-24" />
        <Skeleton className="mt-1.5 h-4 w-36" />
      </div>

      {/* Stat cards 4-grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-card bg-secondary p-6">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-4 rounded" />
            </div>
            <Skeleton className="mt-3 h-8 w-28" />
          </div>
        ))}
      </div>

      {/* Chart grid pairs (3 rows of 2) */}
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-card bg-secondary p-4">
            <div className="mb-4 flex items-center gap-2">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-5 w-24" />
            </div>
            <Skeleton className="h-[280px] w-full rounded-widget" />
          </div>
          <div className="rounded-card bg-secondary p-4">
            <div className="mb-4 flex items-center gap-2">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-5 w-24" />
            </div>
            <Skeleton className="h-[280px] w-full rounded-widget" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Matches the table list page layout: header → table with rows */
export function TablePageSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-28" />
          <Skeleton className="mt-1.5 h-4 w-20" />
        </div>
        <Skeleton className="h-9 w-24 rounded-md" />
      </div>

      {/* Table */}
      <div className="rounded-card bg-secondary">
        {/* Header */}
        <div className="flex items-center gap-4 border-b px-4 py-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-16" />
          ))}
        </div>
        {/* Rows */}
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-border/50 px-4 py-3.5 last:border-0">
            <Skeleton className="h-5 w-5 rounded-full" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-12" />
          </div>
        ))}
      </div>
    </div>
  );
}

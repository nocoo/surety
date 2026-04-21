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

/** Matches insurers page: header → 5-column table */
export function InsurersPageSkeleton() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-24" />
          <Skeleton className="mt-1.5 h-4 w-32" />
        </div>
        <Skeleton className="h-9 w-28 rounded-md" />
      </div>

      {/* Table */}
      <div className="rounded-card bg-secondary">
        <div className="flex items-center gap-6 border-b px-4 py-3">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-12" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-6 border-b border-border/50 px-4 py-3.5 last:border-0">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-8" />
            <Skeleton className="h-8 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Matches assets page: header → 6-column table */
export function AssetsPageSkeleton() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-24" />
          <Skeleton className="mt-1.5 h-4 w-28" />
        </div>
        <Skeleton className="h-9 w-24 rounded-md" />
      </div>

      {/* Table */}
      <div className="rounded-card bg-secondary">
        <div className="flex items-center gap-6 border-b px-4 py-3">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-12" />
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-6 border-b border-border/50 px-4 py-3.5 last:border-0">
            <Skeleton className="h-6 w-6 rounded" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-8" />
            <Skeleton className="h-8 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Matches renewal calendar: header → 4 stat cards → chart → monthly details */
export function RenewalCalendarSkeleton() {
  return (
    <div className="space-y-8">
      {/* Page header */}
      <div>
        <Skeleton className="h-8 w-24" />
        <Skeleton className="mt-1.5 h-4 w-48" />
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-card bg-secondary p-5">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-2 h-8 w-16" />
            <Skeleton className="mt-1 h-3 w-24" />
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="rounded-card bg-secondary p-4">
        <Skeleton className="mb-4 h-5 w-32" />
        <Skeleton className="h-[300px] w-full rounded-widget" />
      </div>

      {/* Monthly Details */}
      <div>
        <Skeleton className="mb-4 h-6 w-20" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-card bg-secondary p-4">
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-4 w-16" />
              </div>
              <div className="mt-3 space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Matches coverage lookup: header → type buttons → selector cards → categories */
export function CoverageLookupSkeleton() {
  return (
    <div className="space-y-8">
      {/* Page header */}
      <div>
        <Skeleton className="h-8 w-24" />
        <Skeleton className="mt-1.5 h-4 w-64" />
      </div>

      {/* Type Switcher */}
      <div className="flex gap-2">
        <Skeleton className="h-9 w-28 rounded-md" />
        <Skeleton className="h-9 w-20 rounded-md" />
      </div>

      {/* Member selector cards */}
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-card bg-secondary p-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div>
                <Skeleton className="h-4 w-16" />
                <Skeleton className="mt-1 h-3 w-12" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Category sections */}
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-card bg-secondary p-4">
            <div className="flex items-center gap-2 mb-3">
              <Skeleton className="h-5 w-5 rounded" />
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-5 w-8 rounded-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-12 w-full rounded-widget" />
              <Skeleton className="h-12 w-full rounded-widget" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Matches policy detail: back button + header → 4-column layout */
export function PolicyDetailSkeleton() {
  return (
    <div className="space-y-6">
      {/* Back button + header */}
      <div className="flex items-center gap-4">
        <Skeleton className="h-9 w-9 rounded-md" />
        <div>
          <Skeleton className="h-7 w-48" />
          <Skeleton className="mt-1 h-4 w-32" />
        </div>
      </div>

      {/* 4-column grid */}
      <div className="grid gap-6 lg:grid-cols-4">
        {/* Meta Column */}
        <div className="space-y-4">
          <div className="rounded-card bg-secondary p-4">
            <Skeleton className="h-5 w-20 mb-3" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </div>
          <div className="rounded-card bg-secondary p-4">
            <Skeleton className="h-5 w-16 mb-3" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </div>
        </div>

        {/* Timeline Column */}
        <div className="rounded-card bg-secondary p-4">
          <Skeleton className="h-5 w-20 mb-4" />
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-3 w-3 rounded-full" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
        </div>

        {/* Coverage Section */}
        <div className="rounded-card bg-secondary p-4">
          <Skeleton className="h-5 w-24 mb-4" />
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-widget bg-card p-3">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="mt-1 h-3 w-20" />
              </div>
            ))}
          </div>
        </div>

        {/* Payments Section */}
        <div className="rounded-card bg-secondary p-4">
          <Skeleton className="h-5 w-20 mb-4" />
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-widget bg-card p-3">
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-12" />
                </div>
                <Skeleton className="mt-1 h-3 w-24" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

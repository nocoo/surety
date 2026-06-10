import { Skeleton } from "@/components/ui/skeleton";

/**
 * Page-level loading skeletons.
 *
 * Each skeleton is hand-tuned to match the *real* layout of its page so the
 * silhouette doesn't shift when data arrives. Mismatches cause CLS, a
 * disorienting "everything moves" effect on slow connections, and they
 * also lie to the user about what's coming. Whenever a page's structure
 * changes (header style, grid columns, sections added/removed) the
 * matching skeleton MUST be updated here.
 *
 * Cross-cutting choices:
 * - Page header is `h-8` (matches `text-2xl font-semibold` h1) plus a
 *   muted `h-4` subtitle.
 * - Section banners (SectionDivider) render a small `h-4 w-20` label
 *   plus a thin separator line.
 * - List rows match the real Table column count + alignment when
 *   possible (header cells use `h-4`, body cells use `h-5` for a beat
 *   of visual hierarchy).
 */

// ---------------------------------------------------------------------------
// Shared building blocks
// ---------------------------------------------------------------------------

/** Page header that pairs an h1 with a one-line subtitle. */
function PageHeaderSkeleton({
  titleWidth = "w-28",
  subtitleWidth = "w-32",
  action,
}: {
  titleWidth?: string;
  subtitleWidth?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <Skeleton className={`h-8 ${titleWidth}`} />
        <Skeleton className={`mt-1.5 h-4 ${subtitleWidth}`} />
      </div>
      {action}
    </div>
  );
}

/** Mirrors <SectionDivider>: small label + horizontal line. */
function SectionDividerSkeleton({ titleWidth = "w-20" }: { titleWidth?: string }) {
  return (
    <div className="flex items-center gap-3">
      <Skeleton className={`h-4 ${titleWidth} shrink-0`} />
      <div aria-hidden="true" className="h-px flex-1 bg-border/60" />
    </div>
  );
}

/** A boxed chart (title + body) used by the dashboard chart grid. */
function ChartCardSkeleton({ height = "h-[280px]" }: { height?: string }) {
  return (
    <div className="rounded-card bg-secondary p-4">
      <div className="mb-4 flex items-center gap-2">
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-5 w-24" />
      </div>
      <Skeleton className={`${height} w-full rounded-widget`} />
    </div>
  );
}

/** A single stat card (label + icon + value + optional sub-line). */
function StatCardSkeleton({ withSub = true }: { withSub?: boolean }) {
  return (
    <div className="rounded-card bg-secondary p-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-8 w-8 rounded-md" />
      </div>
      <Skeleton className="mt-2 h-8 w-28" />
      {withSub && <Skeleton className="mt-1 h-3 w-24" />}
    </div>
  );
}

/**
 * Simple table skeleton with N column-header strips and M body rows.
 * Cell widths cycle through a few sizes so the rows don't read as a
 * suspiciously uniform mosaic.
 */
function TableSkeleton({ columns, rows }: { columns: number; rows: number }) {
  const headerWidths = ["w-16", "w-20", "w-14", "w-12", "w-20", "w-16", "w-12"];
  const cellWidths = ["w-32", "w-24", "w-28", "w-20", "w-24", "w-16", "w-12"];
  return (
    <div className="rounded-card bg-secondary overflow-hidden">
      <div className="flex items-center gap-6 border-b px-4 py-3">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className={`h-4 ${headerWidths[i % headerWidths.length]}`} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          className="flex items-center gap-6 border-b border-border/50 px-4 py-3.5 last:border-0"
        >
          {Array.from({ length: columns }).map((_, c) => (
            <Skeleton
              key={c}
              className={`h-5 ${cellWidths[(r + c) % cellWidths.length]}`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

/**
 * Dashboard layout = greeting header → 家庭概览 (4 stat cards) →
 * 保障状态 (3+2 split: health card + action items) → 分布详情 (5 rows
 * of paired chart cards). The greeting card has a longer h1 (问候语 +
 * name) so the title bar runs wider than other pages.
 */
export function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      {/* Greeting header */}
      <div>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-1.5 h-4 w-56" />
      </div>

      {/* 家庭概览 — 4 stat cards */}
      <div className="space-y-4">
        <SectionDividerSkeleton titleWidth="w-20" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>
      </div>

      {/* 保障状态 — health card (3/5) + action items (2/5) */}
      <div className="space-y-4">
        <SectionDividerSkeleton titleWidth="w-20" />
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="lg:col-span-3 rounded-card bg-secondary p-6">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div className="flex-1">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="mt-1.5 h-5 w-48" />
              </div>
            </div>
            <Skeleton className="mt-4 h-4 w-full" />
            <Skeleton className="mt-2 h-4 w-3/4" />
            <Skeleton className="mt-6 h-9 w-32" />
          </div>
          <div className="lg:col-span-2 rounded-card bg-secondary p-6">
            <div className="mb-4 flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div>
                <Skeleton className="h-3 w-16" />
                <Skeleton className="mt-1.5 h-5 w-24" />
              </div>
            </div>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="mb-3 flex items-start gap-3">
                <Skeleton className="h-5 w-5 rounded-full" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="mt-1 h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 分布详情 — 5 rows × 2 chart cards */}
      <div className="space-y-4">
        <SectionDividerSkeleton titleWidth="w-20" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="grid gap-6 lg:grid-cols-2">
            <ChartCardSkeleton />
            <ChartCardSkeleton />
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Generic table page (used by 全部保单 / 家庭成员 / 就诊记录 / 医生 / 医院)
// ---------------------------------------------------------------------------

/**
 * Common shape: header (with action button) + filter/toolbar row +
 * table. `columns` should match the real <Table>'s TableHead count so
 * the row strips don't shrink/expand on swap.
 */
export function TablePageSkeleton({
  rows = 8,
  columns = 6,
  /** Hide the filter toolbar row when the page has none (e.g. 家庭成员). */
  withFilters = true,
}: {
  rows?: number;
  columns?: number;
  withFilters?: boolean;
}) {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton
        titleWidth="w-28"
        subtitleWidth="w-32"
        action={<Skeleton className="h-9 w-24 rounded-md" />}
      />
      {withFilters && (
        <div className="flex flex-wrap items-center gap-3">
          <Skeleton className="h-9 w-32 rounded-md" />
          <Skeleton className="h-9 w-24 rounded-md" />
          <Skeleton className="h-9 w-28 rounded-md ml-auto" />
        </div>
      )}
      <TableSkeleton columns={columns} rows={rows} />
    </div>
  );
}

/** Insurers: 5-col table (名称 / 客服电话 / 网站 / 保单数 / 操作). */
export function InsurersPageSkeleton() {
  return <TablePageSkeleton rows={5} columns={5} withFilters={false} />;
}

/** Assets: 6-col table (名称 / 类型 / 标识 / 所有人 / 保单数 / 操作). */
export function AssetsPageSkeleton() {
  return <TablePageSkeleton rows={4} columns={6} withFilters={false} />;
}

// ---------------------------------------------------------------------------
// Renewal calendar
// ---------------------------------------------------------------------------

/**
 * Layout = header + 4 SummaryCards + 三个 SectionDivider (日历视图 /
 * 按月柱状图 / 月度明细).
 */
export function RenewalCalendarSkeleton() {
  return (
    <div className="space-y-8">
      <PageHeaderSkeleton titleWidth="w-24" subtitleWidth="w-48" />

      {/* Summary cards (matches SummaryCards: 4-up grid, label + icon + value). */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatCardSkeleton key={i} withSub={false} />
        ))}
      </div>

      {/* 日历视图 — 12-month grid */}
      <div className="space-y-4">
        <SectionDividerSkeleton titleWidth="w-16" />
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="rounded-card bg-secondary p-4">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="mt-2 h-7 w-16" />
              <Skeleton className="mt-1 h-3 w-20" />
            </div>
          ))}
        </div>
      </div>

      {/* 按月柱状图 */}
      <div className="space-y-4">
        <SectionDividerSkeleton titleWidth="w-20" />
        <div className="rounded-card bg-secondary p-4">
          <Skeleton className="h-[300px] w-full rounded-widget" />
        </div>
      </div>

      {/* 月度明细 */}
      <div className="space-y-4">
        <SectionDividerSkeleton titleWidth="w-16" />
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

// ---------------------------------------------------------------------------
// Coverage lookup (保障速查)
// ---------------------------------------------------------------------------

/**
 * Layout = header (with copy-all button) → segmented tabs (家庭成员 /
 * 资产) → selector grid → category sections (each is a category badge
 * + policy rows).
 */
export function CoverageLookupSkeleton() {
  return (
    <div className="space-y-5">
      <PageHeaderSkeleton
        titleWidth="w-24"
        subtitleWidth="w-72"
        action={<Skeleton className="h-9 w-32 rounded-md" />}
      />

      {/* Segmented tabs (member / asset) */}
      <div className="inline-flex rounded-card bg-secondary p-1 gap-1">
        <Skeleton className="h-10 w-32 rounded-[10px]" />
        <Skeleton className="h-10 w-24 rounded-[10px]" />
      </div>

      {/* Subject selector cards (members or assets) */}
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-card bg-secondary p-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="mt-1 h-3 w-12" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Category groups (badge + count + policy rows) */}
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-card bg-secondary p-4">
            <div className="mb-3 flex items-center gap-2">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-4 w-12" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-14 w-full rounded-widget" />
              <Skeleton className="h-14 w-full rounded-widget" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Policy detail
// ---------------------------------------------------------------------------

/**
 * Layout = back-button row → three equal-width columns (1:1:1) on lg+:
 *   col 1  保单信息 (Meta — long form)
 *   col 2  保障明细 (Coverage)
 *   col 3  保单时间线 + 缴费记录 (stacked)
 * Below lg, all columns collapse to a single stack.
 */
export function PolicyDetailSkeleton() {
  return (
    <div className="space-y-6">
      {/* Back button */}
      <Skeleton className="h-7 w-28 rounded-md" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* col 1 — Meta (longest) */}
        <div className="rounded-card bg-secondary p-5 space-y-5">
          <div className="space-y-2">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-32" />
          </div>
          {Array.from({ length: 3 }).map((_, section) => (
            <div key={section}>
              <Skeleton className="mb-2 h-4 w-16" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            </div>
          ))}
        </div>

        {/* col 2 — Coverage */}
        <div className="rounded-card bg-secondary p-5">
          <Skeleton className="h-5 w-24 mb-4" />
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-widget bg-background/60 p-3">
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-16" />
                </div>
                <Skeleton className="mt-1.5 h-3 w-24" />
              </div>
            ))}
          </div>
        </div>

        {/* col 3 — Timeline + Payments */}
        <div className="space-y-6">
          <div className="rounded-card bg-secondary p-5">
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
          <div className="rounded-card bg-secondary p-5">
            <Skeleton className="h-5 w-20 mb-4" />
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-widget bg-background/60 p-3">
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
    </div>
  );
}

import { useNavigate } from "react-router";
import type { MonthlyRenewal, RenewalItem } from "@surety/api/renewal-calendar";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/chart-config";

interface MonthlyCalendarProps {
  data: MonthlyRenewal[];
}

/**
 * Compact 12-month calendar grid. Each month is a small 7-col grid;
 * days with renewal events show a colored dot + the event count.
 *
 * Used as a complement to MonthlyChart (bar) — the bar answers
 * "which month is the heaviest", the calendar answers "exactly which
 * days in 九月 do I owe a premium". Both views consume the same
 * MonthlyRenewal[] from the API, no extra fetch.
 */
export function MonthlyCalendar({ data }: MonthlyCalendarProps) {
  if (data.length === 0) {
    return (
      <div className="rounded-card bg-secondary p-6">
        <p className="text-muted-foreground text-sm text-center">
          未来一年内没有需要续保的保单
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-card bg-secondary p-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {data.map((month) => (
          <MonthCalendar key={month.month} month={month} />
        ))}
      </div>
    </div>
  );
}

function MonthCalendar({ month }: { month: MonthlyRenewal }) {
  const eventsByDay = bucketEventsByDay(month.items);
  const cells = buildMonthGrid(month.month);

  return (
    <article className="rounded-widget bg-card p-3">
      <header className="mb-2 flex items-baseline justify-between">
        <h3 className="font-display text-sm font-semibold tabular-nums">
          {month.monthLabel}
        </h3>
        {month.count > 0 && (
          <span className="text-[11px] text-muted-foreground tabular-nums">
            {month.count} 次 · {formatCurrency(month.totalPremium)}
          </span>
        )}
      </header>

      <div className="grid grid-cols-7 gap-y-1 text-center text-[10px] text-muted-foreground">
        {WEEKDAY_LABELS.map((d) => (
          <span key={d} className="leading-none">{d}</span>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((cell, i) => (
          <DayCell key={i} day={cell.day} events={cell.day ? eventsByDay.get(cell.day) ?? [] : []} />
        ))}
      </div>
    </article>
  );
}

const WEEKDAY_LABELS = ["一", "二", "三", "四", "五", "六", "日"];

interface GridCell {
  day: number | null;
}

/**
 * Build a 6×7 (= 42) cell grid for a YYYY-MM key, week starting Monday.
 * Cells outside the month carry `day: null` and render as spacers.
 */
function buildMonthGrid(yearMonth: string): GridCell[] {
  const [yStr, mStr] = yearMonth.split("-");
  const year = Number(yStr);
  const month = Number(mStr); // 1-based
  if (!year || !month) return [];

  const firstDay = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  // JS getDay(): 0=Sunday..6=Saturday. Shift so Monday=0.
  const leadingBlanks = (firstDay.getDay() + 6) % 7;

  const cells: GridCell[] = [];
  for (let i = 0; i < leadingBlanks; i++) cells.push({ day: null });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d });
  while (cells.length % 7 !== 0) cells.push({ day: null });
  return cells;
}

function bucketEventsByDay(items: RenewalItem[]): Map<number, RenewalItem[]> {
  const byDay = new Map<number, RenewalItem[]>();
  for (const item of items) {
    const day = Number(item.nextDueDate.slice(8, 10));
    if (!day) continue;
    const arr = byDay.get(day);
    if (arr) arr.push(item);
    else byDay.set(day, [item]);
  }
  return byDay;
}

function DayCell({ day, events }: { day: number | null; events: RenewalItem[] }) {
  const navigate = useNavigate();

  if (day === null) {
    return <span aria-hidden="true" className="aspect-square" />;
  }

  if (events.length === 0) {
    return (
      <span className="aspect-square flex items-center justify-center text-[11px] text-muted-foreground/70 tabular-nums">
        {day}
      </span>
    );
  }

  const total = events.reduce((sum, e) => sum + e.premium, 0);
  const tooltip = events
    .map((e) => `${e.productName} (${e.insuredMemberName}) · ${formatCurrency(e.premium)}`)
    .join("\n");

  // Single-event days link straight to that policy; multi-event days
  // jump to the first one — the tooltip lists all so the user can pick.
  const target = events[0]?.id;

  return (
    <button
      type="button"
      onClick={() => target != null && navigate(`/policies/${target}`)}
      title={`${tooltip}\n合计 ${formatCurrency(total)}`}
      className={cn(
        "relative aspect-square flex items-center justify-center rounded-sm tabular-nums text-[11px]",
        "bg-primary/15 text-foreground font-medium",
        "hover:bg-primary/25 transition-colors",
      )}
    >
      {day}
      {events.length > 1 && (
        <span className="absolute -top-0.5 -right-0.5 inline-flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-medium text-primary-foreground leading-none">
          {events.length}
        </span>
      )}
    </button>
  );
}

// Export pure helpers so they're unit-testable without rendering.
export const __test__ = { buildMonthGrid, bucketEventsByDay };

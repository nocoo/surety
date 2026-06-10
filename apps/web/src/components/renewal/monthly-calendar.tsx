import { useState } from "react";
import { useNavigate } from "react-router";
import { CalendarDays } from "lucide-react";
import type { MonthlyRenewal, RenewalItem } from "@surety/api/renewal-calendar";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/chart-config";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { getCategoryConfig } from "@surety/api/lib/category-config";

interface MonthlyCalendarProps {
  data: MonthlyRenewal[];
}

/**
 * Compact 12-month calendar grid. Each month is a small 7-col grid;
 * days with renewal events show a colored cell + the event count.
 *
 * Used as a complement to MonthlyChart (bar) — the bar answers
 * "which month is the heaviest", the calendar answers "exactly which
 * days in 九月 do I owe a premium". Both views consume the same
 * MonthlyRenewal[] from the API, no extra fetch.
 *
 * Click behavior:
 *   - day with 1 event → navigate straight to /policies/<id>
 *   - day with 2+ events → open a Dialog listing all events for that
 *     day; the user picks one to drill into. Avoids "click a day with
 *     3 renewals, only see one" surprise from the previous version.
 */
export function MonthlyCalendar({ data }: MonthlyCalendarProps) {
  const [activeDay, setActiveDay] = useState<{
    date: string;
    monthLabel: string;
    events: RenewalItem[];
  } | null>(null);

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
          <MonthCalendar
            key={month.month}
            month={month}
            onPickDay={(events, day) =>
              setActiveDay({
                date: `${month.month}-${String(day).padStart(2, "0")}`,
                monthLabel: month.monthLabel,
                events,
              })
            }
          />
        ))}
      </div>

      <DayEventsDialog
        active={activeDay}
        onClose={() => setActiveDay(null)}
      />
    </div>
  );
}

interface MonthCalendarProps {
  month: MonthlyRenewal;
  onPickDay: (events: RenewalItem[], day: number) => void;
}

function MonthCalendar({ month, onPickDay }: MonthCalendarProps) {
  const eventsByDay = bucketEventsByDay(month.items);
  const cells = buildMonthGrid(month.month);
  const accent = monthAccentClasses(month.count);

  return (
    <article className={cn("rounded-widget bg-card p-4 border-l-2", accent.border)}>
      <header className="mb-4 flex items-baseline justify-between gap-2">
        <h3 className={cn("font-display text-base font-semibold tabular-nums", accent.title)}>
          {month.monthLabel}
        </h3>
        {month.count > 0 ? (
          <span className="text-xs text-muted-foreground tabular-nums">
            {month.count} 次 · {formatCurrency(month.totalPremium)}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground/60">无续保</span>
        )}
      </header>

      <div className="grid grid-cols-7 gap-y-1.5 text-center text-[11px] text-muted-foreground">
        {WEEKDAY_LABELS.map((d) => (
          <span key={d} className="leading-none">{d}</span>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-7 gap-1">
        {cells.map((cell, i) => (
          <DayCell
            key={i}
            day={cell.day}
            events={cell.day ? eventsByDay.get(cell.day) ?? [] : []}
            onPickDay={onPickDay}
          />
        ))}
      </div>
    </article>
  );
}

/**
 * Visual accent per month: the busier the month, the warmer the
 * left-border + title color. Decoration only — the textual "N 次" is
 * still the source of truth.
 */
function monthAccentClasses(count: number): { border: string; title: string } {
  if (count === 0) return { border: "border-l-muted-foreground/15", title: "text-muted-foreground" };
  if (count <= 2) return { border: "border-l-primary/30", title: "text-foreground" };
  if (count <= 5) return { border: "border-l-primary/60", title: "text-foreground" };
  return { border: "border-l-primary", title: "text-primary" };
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

function DayCell({
  day,
  events,
  onPickDay,
}: {
  day: number | null;
  events: RenewalItem[];
  onPickDay: (events: RenewalItem[], day: number) => void;
}) {
  const navigate = useNavigate();

  if (day === null) {
    return <span aria-hidden="true" className="aspect-square" />;
  }

  if (events.length === 0) {
    return (
      <span className="aspect-square flex items-center justify-center text-xs text-muted-foreground/70 tabular-nums">
        {day}
      </span>
    );
  }

  const single = events.length === 1;
  // Multi-event days open the dialog so all renewals on that day are
  // visible — clicking the button on a 3-event day used to jump to
  // event[0] only.
  const onClick = () => {
    if (single) {
      const target = events[0]?.id;
      if (target != null) navigate(`/policies/${target}`);
    } else {
      onPickDay(events, day);
    }
  };

  const total = events.reduce((sum, e) => sum + e.premium, 0);
  const tooltip = events
    .map((e) => `${e.productName} (${e.insuredMemberName}) · ${formatCurrency(e.premium)}`)
    .join("\n");
  const ariaLabel = single
    ? `${day} 日：${events[0]?.productName}`
    : `${day} 日：${events.length} 笔续费，点击查看`;

  return (
    <button
      type="button"
      onClick={onClick}
      title={`${tooltip}\n合计 ${formatCurrency(total)}`}
      aria-label={ariaLabel}
      className={cn(
        "relative aspect-square flex items-center justify-center rounded-sm tabular-nums text-xs",
        "bg-primary/15 text-foreground font-medium",
        "hover:bg-primary/25 transition-colors",
      )}
    >
      {day}
      {events.length > 1 && (
        <span className="absolute -top-1 -right-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground leading-none">
          {events.length}
        </span>
      )}
    </button>
  );
}

interface DayEventsDialogProps {
  active: { date: string; monthLabel: string; events: RenewalItem[] } | null;
  onClose: () => void;
}

/**
 * Dialog opened by clicking a multi-event day cell. Lists every renewal
 * on that calendar day with category badge, member, premium, and a
 * link into the policy detail. Closing the dialog returns the user to
 * the calendar — preserves nav-stack expectations vs. a hard navigate.
 */
function DayEventsDialog({ active, onClose }: DayEventsDialogProps) {
  const navigate = useNavigate();

  return (
    <Dialog
      open={active !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            {active ? active.date : ""}
          </DialogTitle>
          <DialogDescription>
            {active
              ? `${active.monthLabel} · ${active.events.length} 笔续费 · 合计 ${formatCurrency(
                  active.events.reduce((s, e) => s + e.premium, 0),
                )}`
              : ""}
          </DialogDescription>
        </DialogHeader>

        {active && (
          <ul className="divide-y divide-border/50 max-h-[60vh] overflow-y-auto">
            {active.events.map((event) => {
              const category = getCategoryConfig(event.category);
              return (
                <li key={`${event.id}-${event.nextDueDate}`}>
                  <button
                    type="button"
                    onClick={() => {
                      navigate(`/policies/${event.id}`);
                      onClose();
                    }}
                    className="flex w-full items-center justify-between gap-3 px-1 py-3 text-left hover:bg-muted/40 rounded transition-colors"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium truncate">{event.productName}</span>
                        <Badge variant={category.variant} className="shrink-0">
                          {category.label}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{event.insuredMemberName}</p>
                    </div>
                    <span className="text-sm font-semibold tabular-nums shrink-0">
                      {formatCurrency(event.premium)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Export pure helpers so they're unit-testable without rendering.
export const __test__ = { buildMonthGrid, bucketEventsByDay, monthAccentClasses };

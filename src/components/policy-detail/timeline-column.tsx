"use client";

import { useMemo } from "react";
import { CircleCheck, Circle, CalendarDays, ArrowDown } from "lucide-react";
import type { PolicyDetail } from "@/lib/types/policy";

interface TimelineEvent {
  date: Date;
  dateStr: string;
  label: string;
  type: "past" | "today" | "future";
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function addYears(date: Date, years: number): Date {
  const result = new Date(date);
  result.setFullYear(result.getFullYear() + years);
  return result;
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseDate(dateStr: string): Date {
  // Parse YYYY-MM-DD as local date (not UTC)
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
}

function getToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function buildTimeline(policy: PolicyDetail): TimelineEvent[] {
  const today = getToday();
  const todayTime = today.getTime();
  const effective = parseDate(policy.effectiveDate);

  const events: TimelineEvent[] = [];

  // 1. effectiveDate — always present
  events.push({
    date: effective,
    dateStr: policy.effectiveDate,
    label: "生效日期",
    type: effective.getTime() <= todayTime ? "past" : "future",
  });

  // 2. hesitationEndDate
  if (policy.hesitationEndDate) {
    const d = parseDate(policy.hesitationEndDate);
    events.push({
      date: d,
      dateStr: policy.hesitationEndDate,
      label: "犹豫期截止",
      type: d.getTime() <= todayTime ? "past" : "future",
    });
  }

  // 3. waitingDays → effectiveDate + N days
  if (policy.waitingDays != null) {
    const d = addDays(effective, policy.waitingDays);
    events.push({
      date: d,
      dateStr: formatDate(d),
      label: `等待期结束 (${policy.waitingDays}天)`,
      type: d.getTime() <= todayTime ? "past" : "future",
    });
  }

  // 4. nextDueDate
  if (policy.nextDueDate) {
    const d = parseDate(policy.nextDueDate);
    events.push({
      date: d,
      dateStr: policy.nextDueDate,
      label: "下次缴费日",
      type: d.getTime() <= todayTime ? "past" : "future",
    });
  }

  // 5. guaranteedRenewalYears → effectiveDate + N years
  if (policy.guaranteedRenewalYears != null) {
    const d = addYears(effective, policy.guaranteedRenewalYears);
    events.push({
      date: d,
      dateStr: formatDate(d),
      label: `保证续保到期 (${policy.guaranteedRenewalYears}年)`,
      type: d.getTime() <= todayTime ? "past" : "future",
    });
  }

  // 6. expiryDate
  if (policy.expiryDate) {
    const d = parseDate(policy.expiryDate);
    events.push({
      date: d,
      dateStr: policy.expiryDate,
      label: "保单到期",
      type: d.getTime() <= todayTime ? "past" : "future",
    });
  }

  // Insert "today" marker
  events.push({
    date: today,
    dateStr: formatDate(today),
    label: "今天",
    type: "today",
  });

  // Sort ascending by date, then by type so "today" comes after same-day past events
  events.sort((a, b) => {
    const diff = a.date.getTime() - b.date.getTime();
    if (diff !== 0) return diff;
    // If same date, put "today" marker after past events but before future
    const order = { past: 0, today: 1, future: 2 };
    return order[a.type] - order[b.type];
  });

  return events;
}

export function TimelineColumn({ policy }: { policy: PolicyDetail }) {
  const events = useMemo(() => buildTimeline(policy), [policy]);

  return (
    <div className="space-y-1">
      <h3 className="text-sm font-medium text-muted-foreground mb-4">
        保单时间线
      </h3>
      <div>
        {events.map((event, index) => {
          const isLast = index === events.length - 1;

          return (
            <div key={`${event.dateStr}-${event.label}`} className="relative pl-8 pb-5 last:pb-0">
              {/* Icon */}
              <div className="absolute left-0 top-0 flex items-center justify-center w-4 h-4">
                {event.type === "past" && (
                  <CircleCheck className="h-4 w-4 text-emerald-500" />
                )}
                {event.type === "today" && (
                  <CalendarDays className="h-4 w-4 text-primary" />
                )}
                {event.type === "future" && (
                  <Circle className="h-4 w-4 text-muted-foreground/50" />
                )}
              </div>

              {/* Vertical line connecting to next event */}
              {!isLast && (
                <div className="absolute left-[7px] top-4 bottom-0 border-l-2 border-muted" />
              )}

              {/* Arrow indicator on last event */}
              {isLast && events.length > 1 && (
                <div className="absolute left-0 -bottom-1 flex items-center justify-center w-4">
                  <ArrowDown className="h-3 w-3 text-muted-foreground/50" />
                </div>
              )}

              {/* Content */}
              <div className="flex flex-col gap-0.5">
                <span
                  className={`text-xs font-mono ${
                    event.type === "today"
                      ? "text-primary font-semibold"
                      : event.type === "past"
                        ? "text-muted-foreground"
                        : ""
                  }`}
                >
                  {event.dateStr}
                </span>
                <span
                  className={`text-sm ${
                    event.type === "today"
                      ? "text-primary font-semibold"
                      : event.type === "past"
                        ? "text-muted-foreground"
                        : ""
                  }`}
                >
                  {event.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

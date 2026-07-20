import {
	formatDaysFromToday,
	formatLocalDate,
	getDaysFromToday,
	parseLocalDate,
} from "@surety/db/lib/date-utils";
import { ArrowDown, CalendarDays, Circle, CircleCheck, Clock } from "lucide-react";
import { useMemo } from "react";
import type { PolicyDetail } from "@/lib/types/policy";

interface TimelineEvent {
	date: Date;
	dateStr: string;
	label: string;
	type: "past" | "today" | "future";
}

export type { TimelineEvent };

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

function getToday(): Date {
	const now = new Date();
	return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function buildTimeline(policy: PolicyDetail): TimelineEvent[] {
	const today = getToday();
	const todayTime = today.getTime();

	// Termination semantics — DB status used here so an expired Active
	// policy doesn't get its future events silently dropped.
	const dbStatus = policy.status === "Expired" ? "Active" : policy.status;
	const isTerminated =
		dbStatus === "Surrendered" || dbStatus === "Claimed" || dbStatus === "Lapsed";
	const terminatedAtDate =
		isTerminated && policy.terminatedAt ? parseLocalDate(policy.terminatedAt) : null;
	const terminatedTime = terminatedAtDate?.getTime() ?? null;

	/**
	 * Keep an event only when:
	 *  - the policy is not terminated, or
	 *  - the event falls on/before terminatedAt. Strictly-after events are
	 *    visually pruned (the underlying payments rows still exist in the
	 *    DB and reappear if the policy is reactivated; this filter is read-
	 *    only).
	 *
	 * Same-day events (eventTime === terminatedTime) remain visible so the
	 * termination milestone sits next to the day's other markers.
	 */
	function keepEvent(eventDate: Date): boolean {
		if (terminatedTime === null) return true;
		return eventDate.getTime() <= terminatedTime;
	}

	const events: TimelineEvent[] = [];

	// 1. effectiveDate — always present
	const effectiveDate = parseLocalDate(policy.effectiveDate);
	events.push({
		date: effectiveDate,
		dateStr: policy.effectiveDate,
		label: "生效日期",
		type: effectiveDate.getTime() <= todayTime ? "past" : "future",
	});

	// 2. hesitationEndDate
	if (policy.hesitationEndDate) {
		const d = parseLocalDate(policy.hesitationEndDate);
		events.push({
			date: d,
			dateStr: policy.hesitationEndDate,
			label: "犹豫期截止",
			type: d.getTime() <= todayTime ? "past" : "future",
		});
	}

	// 3. waitingDays → effectiveDate + N days
	if (policy.waitingDays != null) {
		const d = addDays(effectiveDate, policy.waitingDays);
		events.push({
			date: d,
			dateStr: formatLocalDate(d),
			label: `等待期结束 (${policy.waitingDays}天)`,
			type: d.getTime() <= todayTime ? "past" : "future",
		});
	}

	// 4. nextDueDate
	if (policy.nextDueDate) {
		const d = parseLocalDate(policy.nextDueDate);
		events.push({
			date: d,
			dateStr: policy.nextDueDate,
			label: "下次缴费日",
			type: d.getTime() <= todayTime ? "past" : "future",
		});
	}

	// 5. guaranteedRenewalYears → individual renewal anniversary events
	if (policy.guaranteedRenewalYears != null && policy.guaranteedRenewalYears > 0) {
		for (let year = 1; year <= policy.guaranteedRenewalYears; year++) {
			const d = addYears(effectiveDate, year);
			const isLastYear = year === policy.guaranteedRenewalYears;
			events.push({
				date: d,
				dateStr: formatLocalDate(d),
				label: isLastYear ? `保证续保到期 (第${year}年)` : `第${year}年续期`,
				type: d.getTime() <= todayTime ? "past" : "future",
			});
		}
	}

	// 6. expiryDate
	if (policy.expiryDate) {
		const d = parseLocalDate(policy.expiryDate);
		events.push({
			date: d,
			dateStr: policy.expiryDate,
			label: "保单到期",
			type: d.getTime() <= todayTime ? "past" : "future",
		});
	}

	// 7. Future payment dates (for policies with totalPayments)
	if (policy.totalPayments != null && policy.totalPayments > 0) {
		const freq = policy.paymentFrequency;

		for (let i = 1; i <= policy.totalPayments; i++) {
			let dueDate: Date;
			const [startYear, startMonth, startDay] = policy.effectiveDate.split("-").map(Number);
			const startY = startYear ?? 0;
			const startM = (startMonth ?? 1) - 1;

			if (freq === "Monthly") {
				const targetYear = startY + Math.floor((startM + i - 1) / 12);
				const targetMonth = (startM + i - 1) % 12;
				const lastDayOfTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
				const dueDay = Math.min(startDay ?? 1, lastDayOfTargetMonth);
				dueDate = new Date(targetYear, targetMonth, dueDay);
			} else if (freq === "Yearly") {
				const targetYear = startY + i - 1;
				dueDate = addYears(effectiveDate, i - 1);
				// Clamp to month end for yearly edge case (leap day → Feb 28)
				const lastDayOfTargetMonth = new Date(targetYear, startM + 1, 0).getDate();
				const dueDay = Math.min(startDay ?? 1, lastDayOfTargetMonth);
				dueDate = new Date(targetYear, startM, dueDay);
			} else {
				// Single or unknown - skip future payments
				break;
			}

			// Skip if this is the same as nextDueDate (already added above)
			if (policy.nextDueDate && formatLocalDate(dueDate) === policy.nextDueDate) {
				continue;
			}

			const dueDateStr = formatLocalDate(dueDate);
			const isPast = dueDate.getTime() <= todayTime;

			events.push({
				date: dueDate,
				dateStr: dueDateStr,
				label: `第 ${i} 期缴费`,
				type: isPast ? "past" : "future",
			});
		}
	}

	// Apply termination filter to all derived events. Filtering after
	// collection (instead of guarding every push) keeps each event
	// builder readable and ensures any future event source picks up the
	// filter automatically.
	const filtered = terminatedTime === null ? events : events.filter((e) => keepEvent(e.date));

	// Termination milestone. Reuses `type: "today"` so the existing
	// CalendarDays/primary styling makes it stand out, without growing a
	// new TimelineEvent.type variant.
	if (isTerminated && policy.terminatedAt && terminatedAtDate) {
		const milestoneLabel =
			dbStatus === "Surrendered" ? "退保" : dbStatus === "Claimed" ? "理赔结案" : "失效";
		filtered.push({
			date: terminatedAtDate,
			dateStr: policy.terminatedAt,
			label: milestoneLabel,
			type: "today",
		});
	}

	// Planned-surrender milestone. Mutually exclusive with the termination
	// path — the dialog clears plannedSurrenderAt when termination fires,
	// and renderPolicyStatusBadges only emits the rose badge for
	// Active/Expired display states; mirror that gate here.
	const displayStatus = policy.status;
	if (
		!isTerminated &&
		policy.plannedSurrenderAt &&
		(displayStatus === "Active" || displayStatus === "Expired")
	) {
		const d = parseLocalDate(policy.plannedSurrenderAt);
		filtered.push({
			date: d,
			dateStr: policy.plannedSurrenderAt,
			label: "计划退保",
			type: d.getTime() <= todayTime ? "past" : "future",
		});
	}

	// Insert "today" marker — suppressed when the policy is terminated so
	// the timeline visually anchors on the termination milestone instead.
	if (!isTerminated) {
		filtered.push({
			date: today,
			dateStr: formatLocalDate(today),
			label: "今天",
			type: "today",
		});
	}

	// Sort ascending by date, then by type so "today" comes after same-day past events
	filtered.sort((a, b) => {
		const diff = a.date.getTime() - b.date.getTime();
		if (diff !== 0) return diff;
		// If same date, put "today" marker after past events but before future
		const order = { past: 0, today: 1, future: 2 };
		return order[a.type] - order[b.type];
	});

	return filtered;
}

export function TimelineColumn({ policy }: { policy: PolicyDetail }) {
	const events = useMemo(() => buildTimeline(policy), [policy]);

	return (
		<div className="space-y-1">
			<h3 className="text-sm font-medium text-muted-foreground mb-4">
				<Clock className="mr-1.5 inline size-4 align-text-bottom" />
				保单时间线
			</h3>
			<div>
				{events.map((event, index) => {
					const isLast = index === events.length - 1;

					return (
						<div key={`${event.dateStr}-${event.label}`} className="relative pl-8 pb-5 last:pb-0">
							{/* Icon */}
							<div className="absolute left-0 top-0 flex items-center justify-center w-4 h-4">
								{event.type === "past" && <CircleCheck className="h-4 w-4 text-success" />}
								{event.type === "today" && <CalendarDays className="h-4 w-4 text-primary" />}
								{event.type === "future" && <Circle className="h-4 w-4 text-muted-foreground/50" />}
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
									{event.type !== "today" && (
										<span className="ml-1.5 font-sans text-muted-foreground/70">
											({formatDaysFromToday(getDaysFromToday(event.dateStr))})
										</span>
									)}
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

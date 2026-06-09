import { Building2, Calendar, Clock, Pencil, Trash2, UserRound } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, getAvatarColor, hashString } from "@/lib/utils";
import { groupVisitsByMonth, UNKNOWN_DATE_KEY } from "@/lib/visit-grouping";

// Mirror of the page-local type — kept structural to avoid a circular import.
export interface VisitForTimeline {
  id: number;
  memberId: number;
  memberName?: string | undefined;
  memberBirthDate?: string | null | undefined;
  hospitalName?: string | undefined;
  doctorName?: string | undefined;
  visitDate: string;
  visitTimeStart?: string | null | undefined;
  visitTimeEnd?: string | null | undefined;
  visitType: string;
  visitReason: string;
  symptoms?: string | null | undefined;
  diagnosis: string | null;
  treatment: string | null;
}

const VISIT_TYPE_COLORS: Record<
  string,
  "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info" | "purple" | "teal"
> = {
  "门诊": "default",
  "急诊": "destructive",
  "体检": "teal",
  "复查": "info",
  "预约": "purple",
  "儿保": "success",
};

const SYMPTOM_BG_CLASSES = [
  "bg-chart-1/15",
  "bg-chart-2/15",
  "bg-chart-3/15",
  "bg-chart-4/15",
  "bg-chart-5/15",
  "bg-chart-6/15",
  "bg-chart-7/15",
  "bg-chart-8/15",
  "bg-chart-9/15",
  "bg-chart-10/15",
  "bg-chart-11/15",
  "bg-chart-12/15",
  "bg-chart-13/15",
  "bg-chart-14/15",
  "bg-chart-15/15",
  "bg-chart-16/15",
] as const;

function symptomColorClass(symptom: string): string {
  const idx = hashString(symptom) % SYMPTOM_BG_CLASSES.length;
  return SYMPTOM_BG_CLASSES[idx] ?? "bg-chart-1/15";
}

function parseSymptoms(symptoms: string | null | undefined): string[] {
  if (!symptoms) return [];
  try {
    const parsed = JSON.parse(symptoms);
    if (Array.isArray(parsed)) {
      return parsed.filter((s): s is string => typeof s === "string" && s.length > 0);
    }
  } catch {
    /* fall through to delimiter split */
  }
  return symptoms.split(/[,，、]/).map((s) => s.trim()).filter((s) => s.length > 0);
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

interface VisitTimelineProps {
  visits: VisitForTimeline[];
  onEdit: (visitId: number) => void;
  onDelete: (visitId: number) => void;
}

export function VisitTimeline({ visits, onEdit, onDelete }: VisitTimelineProps) {
  if (visits.length === 0) {
    return (
      <div className="rounded-card bg-secondary p-8 text-center">
        <Calendar className="mx-auto h-12 w-12 text-muted-foreground/50" />
        <p className="mt-4 text-sm text-muted-foreground">暂无就诊记录</p>
      </div>
    );
  }

  const months = groupVisitsByMonth(visits);

  return (
    <div className="space-y-8">
      {months.map((bucket) => (
        <section key={bucket.key}>
          <div className="mb-3 flex items-center gap-3">
            <h2
              className={cn(
                "font-display text-lg font-semibold tabular-nums",
                bucket.key === UNKNOWN_DATE_KEY && "text-warning-text",
              )}
            >
              {bucket.label}
            </h2>
            <span className="text-xs text-muted-foreground">
              {bucket.visits.length} 条
            </span>
            {bucket.key === UNKNOWN_DATE_KEY && (
              <span className="text-xs text-muted-foreground">
                · 这些记录的就诊日期为空或格式不合法，请编辑修复
              </span>
            )}
            <div className="flex-1 border-t border-border/60" />
          </div>

          {/*
           * Each card mirrors the same data the row used to expose but
           * groups it visually: header (people + type + actions), then a
           * 2-line body with reason / diagnosis / treatment / symptoms
           * inline — much easier to scan than a 12-column row.
           */}
          <div className="space-y-3">
            {bucket.visits.map((visit) => (
              <VisitCard
                key={visit.id}
                visit={visit}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function VisitCard({
  visit,
  onEdit,
  onDelete,
}: {
  visit: VisitForTimeline;
  onEdit: (visitId: number) => void;
  onDelete: (visitId: number) => void;
}) {
  const symptoms = parseSymptoms(visit.symptoms);

  return (
    <article className="rounded-card bg-secondary p-4">
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarFallback className={cn("text-xs text-white", getAvatarColor(visit.memberName ?? ""))}>
              {visit.memberName?.[0] ?? "?"}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{visit.memberName}</span>
              <Badge variant={VISIT_TYPE_COLORS[visit.visitType] ?? "outline"}>
                {visit.visitType}
              </Badge>
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {formatDate(visit.visitDate)}
              </span>
              {(visit.visitTimeStart || visit.visitTimeEnd) && (
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {visit.visitTimeStart || "?"} - {visit.visitTimeEnd || "?"}
                </span>
              )}
              {visit.hospitalName && (
                <span className="inline-flex items-center gap-1">
                  <Building2 className="h-3 w-3" />
                  {visit.hospitalName}
                </span>
              )}
              {visit.doctorName && (
                <span className="inline-flex items-center gap-1">
                  <UserRound className="h-3 w-3" />
                  {visit.doctorName}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(visit.id)}>
            <Pencil className="h-4 w-4" />
            <span className="sr-only">编辑</span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={() => onDelete(visit.id)}
          >
            <Trash2 className="h-4 w-4" />
            <span className="sr-only">删除</span>
          </Button>
        </div>
      </header>

      <dl className="mt-3 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-[6rem_1fr]">
        {visit.visitReason && (
          <>
            <dt className="text-muted-foreground">就诊原因</dt>
            <dd>{visit.visitReason}</dd>
          </>
        )}
        {symptoms.length > 0 && (
          <>
            <dt className="text-muted-foreground">症状</dt>
            <dd>
              <div className="flex flex-wrap gap-1">
                {symptoms.map((s, i) => (
                  <span
                    key={`${s}-${i}`}
                    className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium text-foreground ${symptomColorClass(s)}`}
                  >
                    {s}
                  </span>
                ))}
              </div>
            </dd>
          </>
        )}
        {visit.diagnosis && (
          <>
            <dt className="text-muted-foreground">诊断</dt>
            <dd className="whitespace-pre-wrap">{visit.diagnosis}</dd>
          </>
        )}
        {visit.treatment && (
          <>
            <dt className="text-muted-foreground">治疗方案</dt>
            <dd className="whitespace-pre-wrap">{visit.treatment}</dd>
          </>
        )}
      </dl>
    </article>
  );
}

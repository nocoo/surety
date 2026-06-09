
import { useState, useEffect, useMemo } from "react";
import { Plus, Pencil, Trash2, Building2, UserRound, Calendar, Clock, AlertCircle, List, GalleryVerticalEnd } from "lucide-react";
import { AppShell } from "@/components/layout";
import { TablePageSkeleton } from "@/components/skeletons";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { usePersistedState } from "@/hooks/use-persisted-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { VisitSheet } from "./visit-sheet";
import { VisitTimeline } from "./visit-timeline";
import { cn, getAvatarColor, hashString } from "@/lib/utils";

interface Member {
  id: number;
  name: string;
  birthDate: string | null;
}

interface Hospital {
  id: number;
  name: string;
}

interface Doctor {
  id: number;
  name: string;
  hospitalId: number;
}

interface MedicalVisit {
  id: number;
  memberId: number;
  memberName?: string | undefined;
  memberBirthDate?: string | null | undefined;
  hospitalId: number;
  hospitalName?: string | undefined;
  doctorId: number | null;
  doctorName?: string | undefined;
  visitDate: string;
  visitTimeStart?: string | null | undefined;
  visitTimeEnd?: string | null | undefined;
  visitType: string;
  visitReason: string;
  department: string | null;
  symptoms?: string | null | undefined;
  diagnosis: string | null;
  treatment: string | null;
  totalCost: number | null;
  insurancePaid: number | null;
  selfPaid: number | null;
  notes: string | null;
}

const VISIT_TYPE_COLORS: Record<string, "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info" | "purple" | "teal"> = {
  "门诊": "default",
  "急诊": "destructive",
  "体检": "teal",
  "复查": "info",
  "预约": "purple",
  "儿保": "success",
};

// Symptom tag palette — name-keyed via the same chart palette used for
// avatars/charts, so the same symptom ("咳嗽") is always the same color,
// and the color picks up dark-mode automatically through tokens.
// Listed verbatim so Tailwind's source detection picks them up.
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
  return SYMPTOM_BG_CLASSES[idx] ?? SYMPTOM_BG_CLASSES[0] ?? "bg-chart-1/15";
}

function parseSymptoms(symptoms: string | null | undefined): string[] {
  if (!symptoms) return [];
  // Try parsing as JSON array first (the canonical format)
  try {
    const parsed = JSON.parse(symptoms);
    if (Array.isArray(parsed)) {
      return parsed.filter((s) => typeof s === "string" && s.length > 0);
    }
  } catch {
    // Not JSON, fall back to splitting by delimiters for legacy data
  }
  // Fallback: split by comma, Chinese comma, or pause mark
  return symptoms
    .split(/[,，、]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function calculateDaysAgo(dateStr: string): number {
  const visitDate = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  visitDate.setHours(0, 0, 0, 0);
  return Math.floor((today.getTime() - visitDate.getTime()) / (1000 * 60 * 60 * 24));
}

function calculateAgeInMonths(birthDateStr: string | null | undefined, visitDateStr: string): number | null {
  if (!birthDateStr) return null;
  const birthDate = new Date(birthDateStr);
  const visitDate = new Date(visitDateStr);
  const months = (visitDate.getFullYear() - birthDate.getFullYear()) * 12
    + (visitDate.getMonth() - birthDate.getMonth());
  return months;
}

function formatAgeInMonths(months: number | null): string {
  if (months === null) return "-";
  if (months < 0) return "-";
  if (months < 12) return `${months}月龄`;
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  if (remainingMonths === 0) return `${years}岁`;
  return `${years}岁${remainingMonths}月`;
}

function formatDaysAgo(days: number): string {
  if (days === 0) return "今天";
  if (days === 1) return "昨天";
  if (days === -1) return "明天";
  if (days < 0) {
    // Future date
    const abs = -days;
    if (abs < 7) return `${abs}天后`;
    if (abs < 30) return `${Math.floor(abs / 7)}周后`;
    if (abs < 365) return `${Math.floor(abs / 30)}月后`;
    return `${Math.floor(abs / 365)}年后`;
  }
  if (days < 7) return `${days}天前`;
  if (days < 30) return `${Math.floor(days / 7)}周前`;
  if (days < 365) return `${Math.floor(days / 30)}月前`;
  return `${Math.floor(days / 365)}年前`;
}

export default function MedicalVisitsPage() {
  const [visits, setVisits] = useState<MedicalVisit[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingVisit, setEditingVisit] = useState<MedicalVisit | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [visitToDelete, setVisitToDelete] = useState<MedicalVisit | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<string>("all");
  const [viewMode, setViewMode] = usePersistedState<"table" | "timeline">(
    "surety-medical-view",
    "table",
  );

  const fetchData = () => {
    Promise.all([
      fetch("/api/medical-visits").then((res) => {
        if (!res.ok) throw new Error("FETCH_FAILED");
        return res.json();
      }),
      fetch("/api/members").then((res) => {
        if (!res.ok) throw new Error("FETCH_FAILED");
        return res.json();
      }),
      fetch("/api/hospitals").then((res) => {
        if (!res.ok) throw new Error("FETCH_FAILED");
        return res.json();
      }),
      fetch("/api/doctors").then((res) => {
        if (!res.ok) throw new Error("FETCH_FAILED");
        return res.json();
      }),
    ])
      .then(([visitsData, membersData, hospitalsData, doctorsData]: [MedicalVisit[], Member[], Hospital[], Doctor[]]) => {
        const memberMap = new Map(membersData.map((m) => [m.id, m]));
        const hospitalMap = new Map(hospitalsData.map((h) => [h.id, h.name]));
        const doctorMap = new Map(doctorsData.map((d) => [d.id, d.name]));

        const enrichedVisits = visitsData.map((v) => {
          const member = memberMap.get(v.memberId);
          return {
            ...v,
            memberName: member?.name ?? "未知成员",
            memberBirthDate: member?.birthDate,
            hospitalName: hospitalMap.get(v.hospitalId) ?? "未知医院",
            doctorName: v.doctorId ? doctorMap.get(v.doctorId) ?? "未知医生" : undefined,
          };
        });

        setVisits(enrichedVisits);
        setMembers(membersData);
        setHospitals(hospitalsData);
        setDoctors(doctorsData);
        setError(null);
        setLoading(false);
      })
      .catch(() => {
        setError("加载就诊记录失败，请刷新页面重试");
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredVisits = useMemo(() => {
    if (selectedMemberId === "all") return visits;
    return visits.filter((v) => v.memberId === parseInt(selectedMemberId, 10));
  }, [visits, selectedMemberId]);

  const handleAdd = () => {
    setEditingVisit(null);
    setSheetOpen(true);
  };

  const handleEdit = (visit: MedicalVisit) => {
    setEditingVisit(visit);
    setSheetOpen(true);
  };

  const handleDeleteClick = (visit: MedicalVisit) => {
    setVisitToDelete(visit);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!visitToDelete) return;

    setDeleteError(null);
    try {
      const response = await fetch(`/api/medical-visits/${visitToDelete.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setDeleteDialogOpen(false);
        setVisitToDelete(null);
        fetchData();
      } else {
        const data = await response.json().catch(() => null);
        setDeleteError(data?.error ?? "删除就诊记录失败，请重试");
      }
    } catch {
      setDeleteError("网络异常，请检查连接后重试");
    }
  };

  const canAddVisit = members.length > 0 && hospitals.length > 0;

  if (loading) {
    return (
      <AppShell breadcrumbs={[{ label: "就诊记录" }]}>
        <TablePageSkeleton />
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell breadcrumbs={[{ label: "就诊记录" }]}>
        <div className="rounded-card bg-secondary p-8 text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-destructive/50" />
          <h3 className="mt-4 text-lg font-medium">加载失败</h3>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell breadcrumbs={[{ label: "就诊记录" }]}>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">就诊记录</h1>
            <p className="text-sm text-muted-foreground">
              共 {filteredVisits.length} 条记录
              {selectedMemberId !== "all" && ` (已筛选)`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <ToggleGroup
              type="single"
              value={viewMode}
              onValueChange={(v) => v && setViewMode(v as "table" | "timeline")}
              aria-label="视图模式"
            >
              <ToggleGroupItem value="table" aria-label="表格视图">
                <List className="h-4 w-4" />
              </ToggleGroupItem>
              <ToggleGroupItem value="timeline" aria-label="时间轴视图">
                <GalleryVerticalEnd className="h-4 w-4" />
              </ToggleGroupItem>
            </ToggleGroup>
            <Select value={selectedMemberId} onValueChange={setSelectedMemberId}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="全部成员" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部成员</SelectItem>
                {members.map((member) => (
                  <SelectItem key={member.id} value={member.id.toString()}>
                    {member.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleAdd} disabled={!canAddVisit}>
              <Plus className="mr-2 h-4 w-4" />
              添加记录
            </Button>
          </div>
        </div>

        {!canAddVisit ? (
          <div className="rounded-card bg-secondary p-8 text-center">
            <Calendar className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-medium">请先添加基础数据</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {members.length === 0 && "需要先在家庭成员中添加成员。"}
              {hospitals.length === 0 && "需要先在医院管理中添加医院。"}
            </p>
          </div>
        ) : viewMode === "timeline" ? (
          <VisitTimeline
            visits={filteredVisits}
            onEdit={(id) => {
              const v = filteredVisits.find((x) => x.id === id);
              if (v) handleEdit(v);
            }}
            onDelete={(id) => {
              const v = filteredVisits.find((x) => x.id === id);
              if (v) handleDeleteClick(v);
            }}
          />
        ) : (
          <div className="rounded-card bg-secondary">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>就诊人</TableHead>
                  <TableHead className="w-[80px]">类型</TableHead>
                  <TableHead>时间</TableHead>
                  <TableHead>就诊原因</TableHead>
                  <TableHead>医院 / 医生</TableHead>
                  <TableHead>症状 / 诊断 / 治疗</TableHead>
                  <TableHead className="w-[100px]">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredVisits.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">
                      <div className="text-muted-foreground">
                        暂无就诊记录，点击上方按钮添加
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredVisits.map((visit) => {
                    const ageInMonths = calculateAgeInMonths(visit.memberBirthDate, visit.visitDate);
                    const ageLabel = formatAgeInMonths(ageInMonths);
                    const daysAgo = calculateDaysAgo(visit.visitDate);
                    const symptoms = visit.symptoms ? parseSymptoms(visit.symptoms) : [];

                    return (
                      <TableRow key={visit.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-7 w-7">
                              <AvatarFallback className={cn("text-xs text-white", getAvatarColor(visit.memberName ?? ""))}>
                                {visit.memberName?.[0] ?? "?"}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col leading-tight">
                              <span className="font-medium">{visit.memberName}</span>
                              {ageLabel !== "-" && (
                                <span className="text-xs text-muted-foreground">{ageLabel}</span>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={VISIT_TYPE_COLORS[visit.visitType] ?? "outline"}>
                            {visit.visitType}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-0.5 leading-tight">
                            <div className="flex items-center gap-1.5">
                              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="font-mono text-sm">{formatDate(visit.visitDate)}</span>
                            </div>
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {formatDaysAgo(daysAgo)}
                              {(visit.visitTimeStart || visit.visitTimeEnd) && (
                                <>
                                  <span className="mx-1">·</span>
                                  {visit.visitTimeStart || "?"}-{visit.visitTimeEnd || "?"}
                                </>
                              )}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="whitespace-normal">{visit.visitReason}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-0.5 leading-tight">
                            <span className="flex items-center gap-1.5 whitespace-normal">
                              <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              {visit.hospitalName}
                            </span>
                            {visit.doctorName && (
                              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <UserRound className="h-3 w-3 shrink-0" />
                                {visit.doctorName}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[420px]">
                          <div className="flex flex-col gap-1 text-sm">
                            {symptoms.length > 0 && (
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
                            )}
                            {visit.diagnosis && (
                              <p className="whitespace-normal">
                                <span className="text-xs text-muted-foreground mr-1">诊断:</span>
                                {visit.diagnosis}
                              </p>
                            )}
                            {visit.treatment && (
                              <p className="whitespace-normal">
                                <span className="text-xs text-muted-foreground mr-1">治疗:</span>
                                {visit.treatment}
                              </p>
                            )}
                            {symptoms.length === 0 && !visit.diagnosis && !visit.treatment && (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleEdit(visit)}
                            >
                              <Pencil className="h-4 w-4" />
                              <span className="sr-only">编辑</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => handleDeleteClick(visit)}
                            >
                              <Trash2 className="h-4 w-4" />
                              <span className="sr-only">删除</span>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <VisitSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        visit={editingVisit}
        members={members}
        hospitals={hospitals}
        doctors={doctors}
        onSuccess={fetchData}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={(open) => {
        setDeleteDialogOpen(open);
        if (!open) setDeleteError(null);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除「{visitToDelete?.memberName}」在 {visitToDelete?.visitDate} 的就诊记录吗？此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span>{deleteError}</span>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              variant="destructive"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}

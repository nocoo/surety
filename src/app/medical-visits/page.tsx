"use client";

import { useState, useEffect, useMemo } from "react";
import { Plus, Pencil, Trash2, Building2, UserRound, Calendar, Clock } from "lucide-react";
import { AppShell } from "@/components/layout";
import { TablePageSkeleton } from "@/components/skeletons";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  assessment?: string | null | undefined;
  treatment: string | null;
  totalCost: number | null;
  insurancePaid: number | null;
  selfPaid: number | null;
  notes: string | null;
}

const VISIT_TYPE_COLORS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  "门诊": "default",
  "急诊": "destructive",
  "体检": "secondary",
  "复查": "outline",
  "预约": "outline",
  "儿保": "secondary",
};

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
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingVisit, setEditingVisit] = useState<MedicalVisit | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [visitToDelete, setVisitToDelete] = useState<MedicalVisit | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<string>("all");

  const fetchData = () => {
    Promise.all([
      fetch("/api/medical-visits").then((res) => res.json()),
      fetch("/api/members").then((res) => res.json()),
      fetch("/api/hospitals").then((res) => res.json()),
      fetch("/api/doctors").then((res) => res.json()),
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
        setLoading(false);
      })
      .catch(() => setLoading(false));
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

    const response = await fetch(`/api/medical-visits/${visitToDelete.id}`, {
      method: "DELETE",
    });

    if (response.ok) {
      fetchData();
    }
    setDeleteDialogOpen(false);
    setVisitToDelete(null);
  };

  const canAddVisit = members.length > 0 && hospitals.length > 0;

  if (loading) {
    return (
      <AppShell breadcrumbs={[{ label: "就诊记录" }]}>
        <TablePageSkeleton />
      </AppShell>
    );
  }

  return (
    <AppShell breadcrumbs={[{ label: "就诊记录" }]}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">就诊记录</h1>
            <p className="text-sm text-muted-foreground">
              共 {filteredVisits.length} 条记录
              {selectedMemberId !== "all" && ` (已筛选)`}
            </p>
          </div>
          <div className="flex items-center gap-3">
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
        ) : (
          <div className="rounded-card bg-secondary">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>就诊人</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>月龄</TableHead>
                  <TableHead>距今</TableHead>
                  <TableHead>时间</TableHead>
                  <TableHead>就诊原因</TableHead>
                  <TableHead>医院</TableHead>
                  <TableHead>医生</TableHead>
                  <TableHead>症状</TableHead>
                  <TableHead>诊断</TableHead>
                  <TableHead>评估</TableHead>
                  <TableHead>治疗方案</TableHead>
                  <TableHead className="w-[100px]">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredVisits.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={13} className="h-24 text-center">
                      <div className="text-muted-foreground">
                        暂无就诊记录，点击上方按钮添加
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredVisits.map((visit) => {
                    const ageInMonths = calculateAgeInMonths(visit.memberBirthDate, visit.visitDate);
                    const daysAgo = calculateDaysAgo(visit.visitDate);

                    return (
                      <TableRow key={visit.id} className="hover:bg-muted/50">
                        <TableCell>
                          <span className="font-medium">{visit.memberName}</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={VISIT_TYPE_COLORS[visit.visitType] ?? "outline"}>
                            {visit.visitType}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {formatAgeInMonths(ageInMonths)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-sm">{formatDaysAgo(daysAgo)}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-1.5">
                              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                              {formatDate(visit.visitDate)}
                            </div>
                            {(visit.visitTimeStart || visit.visitTimeEnd) && (
                              <span className="text-xs text-muted-foreground">
                                {visit.visitTimeStart || "?"} - {visit.visitTimeEnd || "?"}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="max-w-[120px] truncate block">
                            {visit.visitReason}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="max-w-[100px] truncate">
                              {visit.hospitalName}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {visit.doctorName ? (
                            <div className="flex items-center gap-1.5">
                              <UserRound className="h-3.5 w-3.5 text-muted-foreground" />
                              <span>{visit.doctorName}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {visit.symptoms ? (
                            <span className="max-w-[100px] truncate block text-sm">
                              {visit.symptoms}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {visit.diagnosis ? (
                            <span className="max-w-[100px] truncate block">
                              {visit.diagnosis}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {visit.assessment ? (
                            <span className="max-w-[100px] truncate block text-sm">
                              {visit.assessment}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {visit.treatment ? (
                            <span className="max-w-[100px] truncate block text-sm">
                              {visit.treatment}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
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

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除「{visitToDelete?.memberName}」在 {visitToDelete?.visitDate} 的就诊记录吗？此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}

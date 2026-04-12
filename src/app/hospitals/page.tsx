"use client";

import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Phone, MapPin, Users } from "lucide-react";
import { AppShell } from "@/components/layout";
import { TablePageSkeleton } from "@/components/skeletons";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
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
import { HospitalSheet } from "./hospital-sheet";

interface Hospital {
  id: number;
  name: string;
  level: string | null;
  isPublic: boolean;
  address: string | null;
  phone: string | null;
  notes: string | null;
  doctorCount?: number;
}

export default function HospitalsPage() {
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingHospital, setEditingHospital] = useState<Hospital | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [hospitalToDelete, setHospitalToDelete] = useState<Hospital | null>(
    null
  );

  const fetchHospitals = () => {
    fetch("/api/hospitals")
      .then((res) => res.json())
      .then((data: Hospital[]) => {
        setHospitals(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchHospitals();
  }, []);

  const handleAdd = () => {
    setEditingHospital(null);
    setSheetOpen(true);
  };

  const handleEdit = (hospital: Hospital) => {
    setEditingHospital(hospital);
    setSheetOpen(true);
  };

  const handleDeleteClick = (hospital: Hospital) => {
    setHospitalToDelete(hospital);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!hospitalToDelete) return;

    const response = await fetch(`/api/hospitals/${hospitalToDelete.id}`, {
      method: "DELETE",
    });

    if (response.ok) {
      fetchHospitals();
    }
    setDeleteDialogOpen(false);
    setHospitalToDelete(null);
  };

  if (loading) {
    return (
      <AppShell breadcrumbs={[{ label: "医院管理" }]}>
        <TablePageSkeleton />
      </AppShell>
    );
  }

  return (
    <AppShell breadcrumbs={[{ label: "医院管理" }]}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">医院管理</h1>
            <p className="text-sm text-muted-foreground">
              共 {hospitals.length} 家医院
            </p>
          </div>
          <Button onClick={handleAdd}>
            <Plus className="mr-2 h-4 w-4" />
            添加医院
          </Button>
        </div>

        <div className="rounded-card bg-secondary">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>名称</TableHead>
                <TableHead>级别</TableHead>
                <TableHead>性质</TableHead>
                <TableHead>地址</TableHead>
                <TableHead>电话</TableHead>
                <TableHead className="text-center">医生数</TableHead>
                <TableHead className="w-[100px]">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {hospitals.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center">
                    <div className="text-muted-foreground">
                      暂无医院，点击上方按钮添加
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                hospitals.map((hospital) => (
                  <TableRow key={hospital.id} className="hover:bg-muted/50">
                    <TableCell>
                      <span className="font-medium">{hospital.name}</span>
                    </TableCell>
                    <TableCell>
                      {hospital.level ? (
                        <Badge variant="outline">{hospital.level}</Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={hospital.isPublic ? "default" : "secondary"}
                      >
                        {hospital.isPublic ? "公立" : "私立"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {hospital.address ? (
                        <div className="flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="max-w-[200px] truncate">
                            {hospital.address}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {hospital.phone ? (
                        <a
                          href={`tel:${hospital.phone}`}
                          className="inline-flex items-center gap-1.5 hover:underline"
                        >
                          <Phone className="h-3.5 w-3.5 text-primary" />
                          {hospital.phone}
                        </a>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {hospital.doctorCount && hospital.doctorCount > 0 ? (
                        <div className="flex items-center justify-center gap-1">
                          <Users className="h-3 w-3 text-primary" />
                          <span className="text-sm">{hospital.doctorCount}</span>
                        </div>
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
                          onClick={() => handleEdit(hospital)}
                        >
                          <Pencil className="h-4 w-4" />
                          <span className="sr-only">编辑</span>
                        </Button>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span tabIndex={0}>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  disabled={(hospital.doctorCount ?? 0) > 0}
                                  onClick={() => handleDeleteClick(hospital)}
                                  aria-label={
                                    (hospital.doctorCount ?? 0) > 0
                                      ? "已有医生关联，无法删除医院"
                                      : "删除医院"
                                  }
                                >
                                  <Trash2 className="h-4 w-4" />
                                  <span className="sr-only">删除</span>
                                </Button>
                              </span>
                            </TooltipTrigger>
                            {(hospital.doctorCount ?? 0) > 0 && (
                              <TooltipContent>
                                已有医生关联，无法删除
                              </TooltipContent>
                            )}
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <HospitalSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        hospital={editingHospital}
        onSuccess={fetchHospitals}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除医院「{hospitalToDelete?.name}」吗？此操作无法撤销。
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

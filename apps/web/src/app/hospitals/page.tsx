
import { useState, useEffect, useMemo } from "react";
import { Plus, Pencil, Trash2, Phone, MapPin, Users, AlertCircle } from "lucide-react";
import { AppShell } from "@/components/layout";
import { TablePageSkeleton } from "@/components/skeletons";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
import { HospitalSheet } from "./hospital-sheet";
import { cn, getAvatarColor, getHospitalInitial } from "@/lib/utils";

const HOSPITAL_LEVELS = ["三甲", "三乙", "二甲", "二乙", "一级", "社区", "诊所", "未评级"];

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
  const [error, setError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingHospital, setEditingHospital] = useState<Hospital | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [hospitalToDelete, setHospitalToDelete] = useState<Hospital | null>(
    null
  );
  const [filterLevel, setFilterLevel] = useState<string>("all");
  const [filterPublic, setFilterPublic] = useState<string>("all");

  const filteredHospitals = useMemo(() => {
    return hospitals.filter((h) => {
      if (filterLevel !== "all" && h.level !== filterLevel) return false;
      if (filterPublic === "public" && !h.isPublic) return false;
      if (filterPublic === "private" && h.isPublic) return false;
      return true;
    });
  }, [hospitals, filterLevel, filterPublic]);

  const fetchHospitals = () => {
    fetch("/api/hospitals")
      .then((res) => {
        if (!res.ok) throw new Error("FETCH_FAILED");
        return res.json();
      })
      .then((data: Hospital[]) => {
        setHospitals(data);
        setError(null);
        setLoading(false);
      })
      .catch(() => {
        setError("加载医院列表失败，请刷新页面重试");
        setLoading(false);
      });
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

    setDeleteError(null);
    try {
      const response = await fetch(`/api/hospitals/${hospitalToDelete.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setDeleteDialogOpen(false);
        setHospitalToDelete(null);
        fetchHospitals();
      } else {
        const data = await response.json().catch(() => null);
        setDeleteError(data?.error ?? "删除医院失败，请重试");
      }
    } catch {
      setDeleteError("网络异常，请检查连接后重试");
    }
  };

  if (loading) {
    return (
      <AppShell breadcrumbs={[{ label: "医院管理" }]}>
        <TablePageSkeleton />
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell breadcrumbs={[{ label: "医院管理" }]}>
        <div className="rounded-card bg-secondary p-8 text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-destructive/50" />
          <h3 className="mt-4 text-lg font-medium">加载失败</h3>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
        </div>
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
              {filteredHospitals.length !== hospitals.length && (
                <span>，当前筛选显示 {filteredHospitals.length} 家</span>
              )}
            </p>
          </div>
          <Button onClick={handleAdd}>
            <Plus className="mr-2 h-4 w-4" />
            添加医院
          </Button>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">级别</span>
            <Select value={filterLevel} onValueChange={setFilterLevel}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="全部级别" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部级别</SelectItem>
                {HOSPITAL_LEVELS.map((level) => (
                  <SelectItem key={level} value={level}>
                    {level}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">性质</span>
            <Select value={filterPublic} onValueChange={setFilterPublic}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="全部性质" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                <SelectItem value="public">公立</SelectItem>
                <SelectItem value="private">私立</SelectItem>
              </SelectContent>
            </Select>
          </div>
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
              {filteredHospitals.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center">
                    <div className="text-muted-foreground">
                      {hospitals.length === 0
                        ? "暂无医院，点击上方按钮添加"
                        : "没有符合筛选条件的医院"}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredHospitals.map((hospital) => (
                  <TableRow key={hospital.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-7 w-7">
                          <AvatarFallback className={cn("text-xs text-white", getAvatarColor(hospital.name))}>
                            {getHospitalInitial(hospital.name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{hospital.name}</span>
                      </div>
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
                          <span className="whitespace-normal">
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

      <AlertDialog open={deleteDialogOpen} onOpenChange={(open) => {
        setDeleteDialogOpen(open);
        if (!open) setDeleteError(null);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除医院「{hospitalToDelete?.name}」吗？此操作无法撤销。
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

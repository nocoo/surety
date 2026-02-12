"use client";

import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Phone, Globe, FileText } from "lucide-react";
import { AppShell } from "@/components/layout";
import { Button } from "@/components/ui/button";
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
import { InsurerSheet } from "./insurer-sheet";

interface Insurer {
  id: number;
  name: string;
  phone: string | null;
  website: string | null;
  policyCount?: number;
}

export default function InsurersPage() {
  const [insurers, setInsurers] = useState<Insurer[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingInsurer, setEditingInsurer] = useState<Insurer | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [insurerToDelete, setInsurerToDelete] = useState<Insurer | null>(null);

  const fetchInsurers = () => {
    fetch("/api/insurers")
      .then((res) => res.json())
      .then((data: Insurer[]) => {
        setInsurers(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchInsurers();
  }, []);

  const handleAdd = () => {
    setEditingInsurer(null);
    setSheetOpen(true);
  };

  const handleEdit = (insurer: Insurer) => {
    setEditingInsurer(insurer);
    setSheetOpen(true);
  };

  const handleDeleteClick = (insurer: Insurer) => {
    setInsurerToDelete(insurer);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!insurerToDelete) return;

    const response = await fetch(`/api/insurers/${insurerToDelete.id}`, {
      method: "DELETE",
    });

    if (response.ok) {
      fetchInsurers();
    }
    setDeleteDialogOpen(false);
    setInsurerToDelete(null);
  };

  if (loading) {
    return (
      <AppShell breadcrumbs={[{ label: "保险公司" }]}>
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">加载中...</div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell breadcrumbs={[{ label: "保险公司" }]}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">保险公司</h1>
            <p className="text-sm text-muted-foreground">
              共 {insurers.length} 家保险公司
            </p>
          </div>
          <Button onClick={handleAdd}>
            <Plus className="mr-2 h-4 w-4" />
            添加保险公司
          </Button>
        </div>

        <div className="rounded-card bg-secondary">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>名称</TableHead>
                <TableHead>客服电话</TableHead>
                <TableHead>官方网站</TableHead>
                <TableHead className="text-center">保单数</TableHead>
                <TableHead className="w-[100px]">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {insurers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    <div className="text-muted-foreground">
                      暂无保险公司，点击上方按钮添加
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                insurers.map((insurer) => (
                  <TableRow key={insurer.id} className="hover:bg-muted/50">
                    <TableCell>
                      <span className="font-medium">{insurer.name}</span>
                    </TableCell>
                    <TableCell>
                      {insurer.phone ? (
                        <a
                          href={`tel:${insurer.phone}`}
                          className="inline-flex items-center gap-1.5 hover:underline"
                        >
                          <Phone className="h-3.5 w-3.5 text-primary" />
                          {insurer.phone}
                        </a>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          未设置
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {insurer.website ? (
                        <a
                          href={insurer.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 hover:underline"
                        >
                          <Globe className="h-3.5 w-3.5 text-primary" />
                          {new URL(insurer.website).hostname}
                        </a>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {insurer.policyCount && insurer.policyCount > 0 ? (
                        <div className="flex items-center justify-center gap-1">
                          <FileText className="h-3 w-3 text-primary" />
                          <span className="text-sm">{insurer.policyCount}</span>
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
                          onClick={() => handleEdit(insurer)}
                        >
                          <Pencil className="h-4 w-4" />
                          <span className="sr-only">编辑</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          disabled={(insurer.policyCount ?? 0) > 0}
                          onClick={() => handleDeleteClick(insurer)}
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">删除</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <InsurerSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        insurer={editingInsurer}
        onSuccess={fetchInsurers}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除保险公司「{insurerToDelete?.name}」吗？此操作无法撤销。
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

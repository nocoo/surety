"use client";

import { useState, useEffect } from "react";
import { MoreHorizontal, Plus, Eye, Pencil, Trash2 } from "lucide-react";
import { AppShell } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PolicySheet } from "./policy-sheet";

type PolicyStatus = "Active" | "Lapsed" | "Surrendered" | "Claimed";

interface Policy {
  id: number;
  policyNumber: string;
  productName: string;
  insurerName: string;
  insuredName: string;
  category: string;
  subCategory: string | null;
  status: PolicyStatus;
  premium: number;
  sumAssured: number;
  nextDueDate: string | null;
  effectiveDate: string;
  expiryDate: string | null;
  channel: string | null;
  archived: boolean | null;
}

const categoryLabels: Record<string, string> = {
  Life: "寿险",
  CriticalIllness: "重疾险",
  Medical: "医疗险",
  Accident: "意外险",
  Annuity: "年金险",
  Property: "财产险",
};

const statusConfig: Record<PolicyStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  Active: { label: "生效中", variant: "default" },
  Lapsed: { label: "已失效", variant: "secondary" },
  Surrendered: { label: "已退保", variant: "outline" },
  Claimed: { label: "已理赔", variant: "destructive" },
};

function formatCurrency(value: number): string {
  if (value >= 10000) {
    return `${(value / 10000).toFixed(value % 10000 === 0 ? 0 : 1)}万`;
  }
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export default function PoliciesPage() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<Policy | null>(null);

  const fetchPolicies = () => {
    fetch("/api/policies")
      .then((res) => res.json())
      .then((data: Policy[]) => {
        setPolicies(data.filter((p) => !p.archived));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchPolicies();
  }, []);

  const handleAdd = () => {
    setEditingPolicy(null);
    setSheetOpen(true);
  };

  const handleEdit = (policy: Policy) => {
    setEditingPolicy(policy);
    setSheetOpen(true);
  };

  const handleDelete = async (policyId: number) => {
    try {
      const response = await fetch(`/api/policies/${policyId}`, {
        method: "DELETE",
      });
      if (response.ok) {
        fetchPolicies();
      }
    } catch (error) {
      console.error("Error deleting policy:", error);
    }
  };

  if (loading) {
    return (
      <AppShell breadcrumbs={[{ label: "保单" }]}>
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">加载中...</div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell breadcrumbs={[{ label: "保单" }]}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">全部保单</h1>
            <p className="text-sm text-muted-foreground">
              共 {policies.length} 份保单
            </p>
          </div>
          <Button onClick={handleAdd}>
            <Plus className="mr-2 h-4 w-4" />
            添加保单
          </Button>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">状态</TableHead>
                <TableHead>产品名称</TableHead>
                <TableHead>保险公司</TableHead>
                <TableHead>被保人</TableHead>
                <TableHead className="text-right">保额</TableHead>
                <TableHead className="text-right">年保费</TableHead>
                <TableHead className="font-mono">生效日期</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {policies.map((policy) => {
                const status = statusConfig[policy.status];
                const categoryLabel = categoryLabels[policy.category] ?? policy.category;
                return (
                  <TableRow key={policy.id} className="hover:bg-muted/50">
                    <TableCell>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{policy.productName}</div>
                        <div className="text-xs text-muted-foreground">
                          {policy.subCategory ?? categoryLabel}
                          {policy.policyNumber && ` · ${policy.policyNumber}`}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {policy.insurerName}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-xs">
                            {policy.insuredName?.[0] ?? "?"}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm">{policy.insuredName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {policy.sumAssured > 0 ? formatCurrency(policy.sumAssured) : "-"}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {policy.premium > 0 ? formatCurrency(policy.premium) : "-"}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {policy.effectiveDate}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">操作菜单</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Eye className="mr-2 h-4 w-4" />
                            查看详情
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleEdit(policy)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            编辑
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => handleDelete(policy.id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            删除
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      <PolicySheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        policy={editingPolicy}
        onSuccess={fetchPolicies}
      />
    </AppShell>
  );
}

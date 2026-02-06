"use client";

import { useState } from "react";
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

interface MockPolicy {
  id: number;
  policyNumber: string;
  productName: string;
  insurerName: string;
  insuredName: string;
  category: string;
  status: PolicyStatus;
  premium: number;
  sumAssured: number;
  nextDueDate: string;
}

const mockPolicies: MockPolicy[] = [
  {
    id: 1,
    policyNumber: "P2024010001",
    productName: "国寿福终身寿险",
    insurerName: "中国人寿",
    insuredName: "张伟",
    category: "寿险",
    status: "Active",
    premium: 12000,
    sumAssured: 1000000,
    nextDueDate: "2025-01-15",
  },
  {
    id: 2,
    policyNumber: "P2024010002",
    productName: "平安福重疾险",
    insurerName: "平安保险",
    insuredName: "李娜",
    category: "重疾险",
    status: "Active",
    premium: 8500,
    sumAssured: 500000,
    nextDueDate: "2025-02-01",
  },
  {
    id: 3,
    policyNumber: "P2024010003",
    productName: "尊享e生百万医疗险",
    insurerName: "众安保险",
    insuredName: "张小明",
    category: "医疗险",
    status: "Active",
    premium: 1200,
    sumAssured: 6000000,
    nextDueDate: "2025-01-01",
  },
  {
    id: 4,
    policyNumber: "P2024010004",
    productName: "安行宝综合意外险",
    insurerName: "太平洋保险",
    insuredName: "张伟",
    category: "意外险",
    status: "Active",
    premium: 360,
    sumAssured: 1000000,
    nextDueDate: "2025-03-01",
  },
  {
    id: 5,
    policyNumber: "P2024010005",
    productName: "泰康鑫享人生年金险",
    insurerName: "泰康人寿",
    insuredName: "张伟",
    category: "年金险",
    status: "Active",
    premium: 50000,
    sumAssured: 500000,
    nextDueDate: "2025-01-01",
  },
  {
    id: 6,
    policyNumber: "P2024010008",
    productName: "微医保长期医疗险",
    insurerName: "泰康在线",
    insuredName: "王秀英",
    category: "医疗险",
    status: "Lapsed",
    premium: 2800,
    sumAssured: 2000000,
    nextDueDate: "2024-12-31",
  },
];

const statusConfig: Record<PolicyStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  Active: { label: "生效中", variant: "default" },
  Lapsed: { label: "已失效", variant: "secondary" },
  Surrendered: { label: "已退保", variant: "outline" },
  Claimed: { label: "已理赔", variant: "destructive" },
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export default function PoliciesPage() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<MockPolicy | null>(null);

  const handleAdd = () => {
    setEditingPolicy(null);
    setSheetOpen(true);
  };

  const handleEdit = (policy: MockPolicy) => {
    setEditingPolicy(policy);
    setSheetOpen(true);
  };

  return (
    <AppShell breadcrumbs={[{ label: "保单" }]}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">全部保单</h1>
            <p className="text-sm text-muted-foreground">
              管理您家庭的所有保险保单
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
                <TableHead className="font-mono">下次缴费</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockPolicies.map((policy) => {
                const status = statusConfig[policy.status];
                return (
                  <TableRow key={policy.id} className="hover:bg-muted/50">
                    <TableCell>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{policy.productName}</div>
                        <div className="text-xs text-muted-foreground">
                          {policy.category} · {policy.policyNumber}
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
                            {policy.insuredName[0]}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm">{policy.insuredName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(policy.sumAssured)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatCurrency(policy.premium)}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {policy.nextDueDate}
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
                          <DropdownMenuItem className="text-destructive">
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

        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" disabled>
            上一页
          </Button>
          <Button variant="outline" size="sm" disabled>
            下一页
          </Button>
        </div>
      </div>

      <PolicySheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        policy={editingPolicy}
      />
    </AppShell>
  );
}

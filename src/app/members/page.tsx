"use client";

import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Shield } from "lucide-react";
import { AppShell } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn, getAvatarColor } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MemberSheet } from "./member-sheet";

type Relation = "Self" | "Spouse" | "Child" | "Parent";

interface Member {
  id: number;
  name: string;
  relation: Relation;
  gender: "M" | "F" | null;
  birthDate: string | null;
  phone: string | null;
  policyCount?: number;
}

const relationLabels: Record<Relation, string> = {
  Self: "本人",
  Spouse: "配偶",
  Child: "子女",
  Parent: "父母",
};

const relationVariants: Record<Relation, "default" | "secondary" | "outline"> = {
  Self: "default",
  Spouse: "secondary",
  Child: "outline",
  Parent: "outline",
};

function calculateAge(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);

  const fetchMembers = () => {
    fetch("/api/members")
      .then((res) => res.json())
      .then((data: Member[]) => {
        setMembers(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  const handleAdd = () => {
    setEditingMember(null);
    setSheetOpen(true);
  };

  const handleEdit = (member: Member) => {
    setEditingMember(member);
    setSheetOpen(true);
  };

  const handleDelete = async (member: Member) => {
    if (!confirm(`确定要删除 ${member.name} 吗？`)) return;

    const response = await fetch(`/api/members/${member.id}`, {
      method: "DELETE",
    });

    if (response.ok) {
      fetchMembers();
    }
  };

  if (loading) {
    return (
      <AppShell breadcrumbs={[{ label: "家庭成员" }]}>
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">加载中...</div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell breadcrumbs={[{ label: "家庭成员" }]}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">家庭成员</h1>
            <p className="text-sm text-muted-foreground">
              共 {members.length} 位成员
            </p>
          </div>
          <Button onClick={handleAdd}>
            <Plus className="mr-2 h-4 w-4" />
            添加成员
          </Button>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>姓名</TableHead>
                <TableHead>关系</TableHead>
                <TableHead>性别</TableHead>
                <TableHead>年龄</TableHead>
                <TableHead>出生日期</TableHead>
                <TableHead>手机号</TableHead>
                <TableHead className="text-center">保单数</TableHead>
                <TableHead className="w-[100px]">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => {
                const age = calculateAge(member.birthDate);
                return (
                  <TableRow key={member.id} className="hover:bg-muted/50">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className={cn("text-sm text-white", getAvatarColor(member.name))}>
                            {member.name[0]}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{member.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={relationVariants[member.relation]}>
                        {relationLabels[member.relation]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {member.gender === "M" ? "男" : member.gender === "F" ? "女" : "-"}
                    </TableCell>
                    <TableCell>
                      {age !== null ? (
                        <>
                          <span className="font-medium">{age}</span>
                          <span className="text-muted-foreground"> 岁</span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">
                      {member.birthDate ?? "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {member.phone ?? "-"}
                    </TableCell>
                    <TableCell className="text-center">
                      {member.policyCount && member.policyCount > 0 ? (
                        <div className="flex items-center justify-center gap-1">
                          <Shield className="h-3 w-3 text-success" />
                          <span className="text-sm">{member.policyCount}</span>
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
                          onClick={() => handleEdit(member)}
                        >
                          <Pencil className="h-4 w-4" />
                          <span className="sr-only">编辑</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          disabled={member.relation === "Self"}
                          onClick={() => handleDelete(member)}
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">删除</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      <MemberSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        member={editingMember}
        onSuccess={fetchMembers}
      />
    </AppShell>
  );
}

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface MemberFormData {
  name: string;
  relation: string;
  gender: string;
  birthDate: string;
  idCard: string;
  phone: string;
}

interface Member {
  id: number;
  name: string;
  relation: string;
  gender: string | null;
  birthDate: string;
  idCard: string | null;
  phone: string | null;
}

interface MemberSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member?: Member | null;
}

const relations = [
  { value: "Self", label: "本人" },
  { value: "Spouse", label: "配偶" },
  { value: "Child", label: "子女" },
  { value: "Parent", label: "父母" },
];

const genders = [
  { value: "M", label: "男" },
  { value: "F", label: "女" },
];

function createFormData(member: Member | null | undefined): MemberFormData {
  if (member) {
    return {
      name: member.name,
      relation: member.relation,
      gender: member.gender ?? "",
      birthDate: member.birthDate,
      idCard: member.idCard ?? "",
      phone: member.phone ?? "",
    };
  }
  return {
    name: "",
    relation: "",
    gender: "",
    birthDate: "",
    idCard: "",
    phone: "",
  };
}

function MemberForm({
  member,
  onClose,
}: {
  member: Member | null | undefined;
  onClose: () => void;
}) {
  const isEditing = !!member;
  const [formData, setFormData] = useState<MemberFormData>(() =>
    createFormData(member)
  );

  const handleChange = (field: keyof MemberFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Form submitted:", formData);
    onClose();
  };

  return (
    <>
      <SheetHeader>
        <SheetTitle>{isEditing ? "编辑成员" : "添加成员"}</SheetTitle>
        <SheetDescription>
          {isEditing ? "修改家庭成员信息" : "添加新的家庭成员"}
        </SheetDescription>
      </SheetHeader>

      <form onSubmit={onSubmit} className="flex-1 space-y-6 overflow-y-auto px-4 py-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">姓名</Label>
            <Input
              id="name"
              placeholder="请输入姓名"
              value={formData.name}
              onChange={(e) => handleChange("name", e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>与本人关系</Label>
              <Select
                value={formData.relation}
                onValueChange={(value) => handleChange("relation", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择关系" />
                </SelectTrigger>
                <SelectContent>
                  {relations.map((rel) => (
                    <SelectItem key={rel.value} value={rel.value}>
                      {rel.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>性别</Label>
              <Select
                value={formData.gender}
                onValueChange={(value) => handleChange("gender", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择性别" />
                </SelectTrigger>
                <SelectContent>
                  {genders.map((g) => (
                    <SelectItem key={g.value} value={g.value}>
                      {g.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="birthDate">出生日期</Label>
            <Input
              id="birthDate"
              type="date"
              value={formData.birthDate}
              onChange={(e) => handleChange("birthDate", e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="idCard">身份证号</Label>
            <Input
              id="idCard"
              placeholder="可选，用于保单录入"
              value={formData.idCard}
              onChange={(e) => handleChange("idCard", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">手机号</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="可选"
              value={formData.phone}
              onChange={(e) => handleChange("phone", e.target.value)}
            />
          </div>
        </div>

        <SheetFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button type="submit">
            {isEditing ? "保存修改" : "添加成员"}
          </Button>
        </SheetFooter>
      </form>
    </>
  );
}

export function MemberSheet({ open, onOpenChange, member }: MemberSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col sm:max-w-md">
        <MemberForm
          key={member?.id ?? "new"}
          member={member}
          onClose={() => onOpenChange(false)}
        />
      </SheetContent>
    </Sheet>
  );
}

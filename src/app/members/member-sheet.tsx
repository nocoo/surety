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
import { Switch } from "@/components/ui/switch";

interface MemberFormData {
  name: string;
  relation: string;
  gender: string;
  birthDate: string;
  idCard: string;
  idType: string;
  idExpiryStart: string;
  idExpiryEnd: string;
  phone: string;
  hasSocialInsurance: boolean;
}

interface Member {
  id: number;
  name: string;
  relation: string;
  gender: string | null;
  birthDate: string | null;
  idCard?: string | null;
  idType?: string | null;
  idExpiry?: string | null;
  phone: string | null;
  hasSocialInsurance?: boolean | null;
}

interface MemberSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member?: Member | null;
  onSuccess?: () => void;
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

const idTypes = [
  { value: "身份证", label: "身份证" },
  { value: "户口本", label: "户口本" },
  { value: "护照", label: "护照" },
];

function parseIdExpiry(idExpiry: string | null | undefined): { start: string; end: string } {
  if (!idExpiry) return { start: "", end: "" };
  const parts = idExpiry.split("|");
  return { start: parts[0] ?? "", end: parts[1] ?? "" };
}

function createFormData(member: Member | null | undefined): MemberFormData {
  if (member) {
    const expiry = parseIdExpiry(member.idExpiry);
    return {
      name: member.name,
      relation: member.relation,
      gender: member.gender ?? "",
      birthDate: member.birthDate ?? "",
      idCard: member.idCard ?? "",
      idType: member.idType ?? "",
      idExpiryStart: expiry.start,
      idExpiryEnd: expiry.end,
      phone: member.phone ?? "",
      hasSocialInsurance: member.hasSocialInsurance ?? false,
    };
  }
  return {
    name: "",
    relation: "",
    gender: "",
    birthDate: "",
    idCard: "",
    idType: "",
    idExpiryStart: "",
    idExpiryEnd: "",
    phone: "",
    hasSocialInsurance: false,
  };
}

function MemberForm({
  member,
  onClose,
  onSuccess,
}: {
  member: Member | null | undefined;
  onClose: () => void;
  onSuccess?: (() => void) | undefined;
}) {
  const isEditing = !!member;
  const [formData, setFormData] = useState<MemberFormData>(() =>
    createFormData(member)
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (field: keyof MemberFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const url = isEditing ? `/api/members/${member.id}` : "/api/members";
      const method = isEditing ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          relation: formData.relation,
          gender: formData.gender || null,
          birthDate: formData.birthDate || null,
          idCard: formData.idCard || null,
          idType: formData.idType || null,
          idExpiry: formData.idExpiryStart && formData.idExpiryEnd
            ? `${formData.idExpiryStart}|${formData.idExpiryEnd}`
            : null,
          phone: formData.phone || null,
          hasSocialInsurance: formData.hasSocialInsurance,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save member");
      }

      onSuccess?.();
      onClose();
    } catch (error) {
      console.error("Error saving member:", error);
    } finally {
      setIsSubmitting(false);
    }
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
            <Label htmlFor="idCard">证件号码</Label>
            <Input
              id="idCard"
              placeholder="可选，用于保单录入"
              value={formData.idCard}
              onChange={(e) => handleChange("idCard", e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>证件类型</Label>
              <Select
                value={formData.idType}
                onValueChange={(value) => handleChange("idType", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择类型" />
                </SelectTrigger>
                <SelectContent>
                  {idTypes.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>有社保</Label>
              <div className="flex items-center h-9 pt-1">
                <Switch
                  checked={formData.hasSocialInsurance}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({ ...prev, hasSocialInsurance: checked }))
                  }
                />
                <span className="ml-2 text-sm text-muted-foreground">
                  {formData.hasSocialInsurance ? "有" : "无"}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>证件有效期</Label>
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="date"
                placeholder="起始日期"
                value={formData.idExpiryStart}
                onChange={(e) => handleChange("idExpiryStart", e.target.value)}
              />
              <Input
                type="date"
                placeholder="到期日期"
                value={formData.idExpiryEnd}
                onChange={(e) => handleChange("idExpiryEnd", e.target.value)}
              />
            </div>
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

        <SheetFooter className="flex-row justify-end gap-2 pt-4 border-t">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
            取消
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "保存中..." : isEditing ? "保存修改" : "添加成员"}
          </Button>
        </SheetFooter>
      </form>
    </>
  );
}

export function MemberSheet({ open, onOpenChange, member, onSuccess }: MemberSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col sm:max-w-md">
        <MemberForm
          key={member?.id ?? "new"}
          member={member}
          onClose={() => onOpenChange(false)}
          onSuccess={onSuccess}
        />
      </SheetContent>
    </Sheet>
  );
}

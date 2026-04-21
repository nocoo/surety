"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const HOSPITAL_LEVELS = [
  "三甲",
  "三乙",
  "二甲",
  "二乙",
  "一级",
  "社区",
  "诊所",
  "未评级",
];

interface HospitalFormData {
  name: string;
  level: string;
  isPublic: boolean;
  address: string;
  phone: string;
  notes: string;
}

interface Hospital {
  id: number;
  name: string;
  level: string | null;
  isPublic: boolean;
  address: string | null;
  phone: string | null;
  notes: string | null;
}

interface HospitalSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hospital?: Hospital | null;
  onSuccess?: () => void;
}

function createFormData(hospital: Hospital | null | undefined): HospitalFormData {
  if (hospital) {
    return {
      name: hospital.name,
      level: hospital.level ?? "",
      isPublic: hospital.isPublic,
      address: hospital.address ?? "",
      phone: hospital.phone ?? "",
      notes: hospital.notes ?? "",
    };
  }
  return {
    name: "",
    level: "",
    isPublic: true,
    address: "",
    phone: "",
    notes: "",
  };
}

function HospitalForm({
  hospital,
  onClose,
  onSuccess,
}: {
  hospital: Hospital | null | undefined;
  onClose: () => void;
  onSuccess?: (() => void) | undefined;
}) {
  const isEditing = !!hospital;
  const [formData, setFormData] = useState<HospitalFormData>(() =>
    createFormData(hospital)
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = <K extends keyof HospitalFormData>(
    field: K,
    value: HospitalFormData[K]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError(null);
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const url = isEditing ? `/api/hospitals/${hospital.id}` : "/api/hospitals";
      const method = isEditing ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          level: formData.level || null,
          isPublic: formData.isPublic,
          address: formData.address || null,
          phone: formData.phone || null,
          notes: formData.notes || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "保存失败");
      }

      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <SheetHeader>
        <SheetTitle>{isEditing ? "编辑医院" : "添加医院"}</SheetTitle>
        <SheetDescription>
          {isEditing ? "修改医院信息" : "添加新的医院"}
        </SheetDescription>
      </SheetHeader>

      <form
        onSubmit={onSubmit}
        className="flex-1 space-y-6 overflow-y-auto px-4 py-6"
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">医院名称</Label>
            <Input
              id="name"
              placeholder="例如：北京协和医院"
              value={formData.name}
              onChange={(e) => handleChange("name", e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="level">医院级别</Label>
            <Select
              value={formData.level}
              onValueChange={(value) => handleChange("level", value)}
            >
              <SelectTrigger id="level">
                <SelectValue placeholder="选择级别" />
              </SelectTrigger>
              <SelectContent>
                {HOSPITAL_LEVELS.map((level) => (
                  <SelectItem key={level} value={level}>
                    {level}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="isPublic">公立医院</Label>
              <p className="text-xs text-muted-foreground">
                公立医院通常医保报销比例更高
              </p>
            </div>
            <Switch
              id="isPublic"
              checked={formData.isPublic}
              onCheckedChange={(checked) => handleChange("isPublic", checked)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">地址</Label>
            <Input
              id="address"
              placeholder="例如：北京市东城区王府井大街1号"
              value={formData.address}
              onChange={(e) => handleChange("address", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">电话</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="例如：010-65296114"
              value={formData.phone}
              onChange={(e) => handleChange("phone", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">备注</Label>
            <Textarea
              id="notes"
              placeholder="其他需要记录的信息"
              value={formData.notes}
              onChange={(e) => handleChange("notes", e.target.value)}
              rows={3}
            />
          </div>
        </div>

        {error && (
          <div className="rounded-widget bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <SheetFooter className="flex-row justify-end gap-2 border-t pt-4">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={isSubmitting}
          >
            取消
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "保存中..." : isEditing ? "保存修改" : "添加"}
          </Button>
        </SheetFooter>
      </form>
    </>
  );
}

export function HospitalSheet({
  open,
  onOpenChange,
  hospital,
  onSuccess,
}: HospitalSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col sm:max-w-md">
        <HospitalForm
          key={open ? (hospital?.id ?? "new") : "closed"}
          hospital={hospital}
          onClose={() => onOpenChange(false)}
          onSuccess={onSuccess}
        />
      </SheetContent>
    </Sheet>
  );
}

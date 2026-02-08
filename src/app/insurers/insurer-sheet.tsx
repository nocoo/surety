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

interface InsurerFormData {
  name: string;
  phone: string;
  website: string;
}

interface Insurer {
  id: number;
  name: string;
  phone: string | null;
  website: string | null;
}

interface InsurerSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  insurer?: Insurer | null;
  onSuccess?: () => void;
}

function createFormData(insurer: Insurer | null | undefined): InsurerFormData {
  if (insurer) {
    return {
      name: insurer.name,
      phone: insurer.phone ?? "",
      website: insurer.website ?? "",
    };
  }
  return {
    name: "",
    phone: "",
    website: "",
  };
}

function InsurerForm({
  insurer,
  onClose,
  onSuccess,
}: {
  insurer: Insurer | null | undefined;
  onClose: () => void;
  onSuccess?: (() => void) | undefined;
}) {
  const isEditing = !!insurer;
  const [formData, setFormData] = useState<InsurerFormData>(() =>
    createFormData(insurer)
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (field: keyof InsurerFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError(null);
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const url = isEditing ? `/api/insurers/${insurer.id}` : "/api/insurers";
      const method = isEditing ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          phone: formData.phone || null,
          website: formData.website || null,
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
        <SheetTitle>{isEditing ? "编辑保险公司" : "添加保险公司"}</SheetTitle>
        <SheetDescription>
          {isEditing ? "修改保险公司信息" : "添加新的保险公司"}
        </SheetDescription>
      </SheetHeader>

      <form onSubmit={onSubmit} className="flex-1 space-y-6 overflow-y-auto px-4 py-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">公司名称</Label>
            <Input
              id="name"
              placeholder="例如：中国人寿"
              value={formData.name}
              onChange={(e) => handleChange("name", e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">客服电话</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="例如：95519"
              value={formData.phone}
              onChange={(e) => handleChange("phone", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              填写官方客服热线，紧急情况下可快速拨打
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="website">官方网站</Label>
            <Input
              id="website"
              type="url"
              placeholder="例如：https://www.chinalife.com.cn"
              value={formData.website}
              onChange={(e) => handleChange("website", e.target.value)}
            />
          </div>
        </div>

        {error && (
          <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <SheetFooter className="flex-row justify-end gap-2 pt-4 border-t">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
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

export function InsurerSheet({ open, onOpenChange, insurer, onSuccess }: InsurerSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col sm:max-w-md">
        <InsurerForm
          key={insurer?.id ?? "new"}
          insurer={insurer}
          onClose={() => onOpenChange(false)}
          onSuccess={onSuccess}
        />
      </SheetContent>
    </Sheet>
  );
}

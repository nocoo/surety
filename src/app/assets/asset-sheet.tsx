"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

type AssetType = "RealEstate" | "Vehicle";

interface AssetFormData {
  type: AssetType | "";
  name: string;
  identifier: string;
  ownerId: string;
  details: string;
}

interface Asset {
  id: number;
  type: AssetType;
  name: string;
  identifier: string;
  ownerId: number | null;
  ownerName: string | null;
  details: string | null;
}

interface Member {
  id: number;
  name: string;
}

interface AssetSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset?: Asset | null;
  onSuccess?: () => void;
}

const assetTypes = [
  { value: "RealEstate", label: "不动产" },
  { value: "Vehicle", label: "车辆" },
];

function createFormData(asset: Asset | null | undefined): AssetFormData {
  if (asset) {
    return {
      type: asset.type,
      name: asset.name,
      identifier: asset.identifier,
      ownerId: asset.ownerId?.toString() ?? "",
      details: asset.details ?? "",
    };
  }
  return {
    type: "",
    name: "",
    identifier: "",
    ownerId: "",
    details: "",
  };
}

function AssetForm({
  asset,
  onClose,
  onSuccess,
}: {
  asset: Asset | null | undefined;
  onClose: () => void;
  onSuccess?: (() => void) | undefined;
}) {
  const isEditing = !!asset;
  const [formData, setFormData] = useState<AssetFormData>(() =>
    createFormData(asset)
  );
  const [members, setMembers] = useState<Member[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/members")
      .then((res) => res.json())
      .then((data: Member[]) => setMembers(data))
      .catch(() => {});
  }, []);

  const handleChange = (field: keyof AssetFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const url = isEditing ? `/api/assets/${asset.id}` : "/api/assets";
      const method = isEditing ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: formData.type,
          name: formData.name,
          identifier: formData.identifier,
          ownerId: formData.ownerId ? parseInt(formData.ownerId, 10) : null,
          details: formData.details || null,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save asset");
      }

      onSuccess?.();
      onClose();
    } catch (error) {
      console.error("Error saving asset:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const placeholders: Record<AssetType | "", { identifier: string; details: string }> = {
    "": { identifier: "请先选择资产类型", details: "" },
    RealEstate: {
      identifier: "如：京(2020)朝阳区不动产权第0012345号",
      details: '如：{"address": "北京市朝阳区...", "area": 120}',
    },
    Vehicle: {
      identifier: "如：京A88888",
      details: '如：{"brand": "Tesla", "model": "Model Y"}',
    },
  };

  const currentPlaceholder = placeholders[formData.type || ""];

  return (
    <>
      <SheetHeader>
        <SheetTitle>{isEditing ? "编辑资产" : "添加资产"}</SheetTitle>
        <SheetDescription>
          {isEditing ? "修改资产信息" : "添加新的资产"}
        </SheetDescription>
      </SheetHeader>

      <form onSubmit={onSubmit} className="flex-1 space-y-6 overflow-y-auto px-4 py-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>资产类型</Label>
            <Select
              value={formData.type}
              onValueChange={(value) => handleChange("type", value)}
              disabled={isEditing}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择资产类型" />
              </SelectTrigger>
              <SelectContent>
                {assetTypes.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">资产名称</Label>
            <Input
              id="name"
              placeholder={formData.type === "RealEstate" ? "如：朝阳区住宅" : "如：特斯拉 Model Y"}
              value={formData.name}
              onChange={(e) => handleChange("name", e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="identifier">
              {formData.type === "Vehicle" ? "车牌号" : "产权证号"}
            </Label>
            <Input
              id="identifier"
              placeholder={currentPlaceholder.identifier}
              value={formData.identifier}
              onChange={(e) => handleChange("identifier", e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>所有人</Label>
            <Select
              value={formData.ownerId}
              onValueChange={(value) => handleChange("ownerId", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择所有人（可选）" />
              </SelectTrigger>
              <SelectContent>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.id.toString()}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="details">详细信息（JSON）</Label>
            <Textarea
              id="details"
              placeholder={currentPlaceholder.details}
              value={formData.details}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleChange("details", e.target.value)}
              className="font-mono text-sm"
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              可选，用于记录额外信息如面积、品牌等
            </p>
          </div>
        </div>

        <SheetFooter className="flex-row justify-end gap-2 pt-4 border-t">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
            取消
          </Button>
          <Button type="submit" disabled={isSubmitting || !formData.type}>
            {isSubmitting ? "保存中..." : isEditing ? "保存修改" : "添加资产"}
          </Button>
        </SheetFooter>
      </form>
    </>
  );
}

export function AssetSheet({ open, onOpenChange, asset, onSuccess }: AssetSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col sm:max-w-md">
        <AssetForm
          key={asset?.id ?? "new"}
          asset={asset}
          onClose={() => onOpenChange(false)}
          onSuccess={onSuccess}
        />
      </SheetContent>
    </Sheet>
  );
}

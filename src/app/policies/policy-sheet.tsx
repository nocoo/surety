"use client";

import { useState, useEffect } from "react";
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
import { categoryLabels, paymentFrequencyLabels } from "@/lib/constants/policy";

interface PolicyFormData {
  applicantId: string;
  insuredType: "Member" | "Asset";
  insuredMemberId: string;
  insuredAssetId: string;
  category: string;
  subCategory: string;
  insurerName: string;
  productName: string;
  policyNumber: string;
  channel: string;
  effectiveDate: string;
  premium: string;
  sumAssured: string;
  paymentFrequency: string;
  status: string;
}

interface PolicySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const defaultFormData: PolicyFormData = {
  applicantId: "",
  insuredType: "Member",
  insuredMemberId: "",
  insuredAssetId: "",
  category: "",
  subCategory: "",
  insurerName: "",
  productName: "",
  policyNumber: "",
  channel: "",
  effectiveDate: "",
  premium: "",
  sumAssured: "",
  paymentFrequency: "Yearly",
  status: "Active",
};

const statusOptions = [
  { value: "Active", label: "生效中" },
  { value: "Lapsed", label: "已失效" },
  { value: "Surrendered", label: "已退保" },
  { value: "Claimed", label: "已理赔" },
];

function PolicyForm({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess?: (() => void) | undefined;
}) {
  const [formData, setFormData] = useState<PolicyFormData>(defaultFormData);
  const [members, setMembers] = useState<{ id: number; name: string }[]>([]);
  const [assets, setAssets] = useState<{ id: number; name: string }[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/members").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/assets").then((r) => (r.ok ? r.json() : [])),
    ]).then(([m, a]) => {
      setMembers(m);
      setAssets(a);
    });
  }, []);

  const handleChange = (field: keyof PolicyFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setSubmitError(null);
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicantId: parseInt(formData.applicantId, 10),
          insuredType: formData.insuredType,
          insuredMemberId:
            formData.insuredType === "Member" && formData.insuredMemberId
              ? parseInt(formData.insuredMemberId, 10)
              : null,
          insuredAssetId:
            formData.insuredType === "Asset" && formData.insuredAssetId
              ? parseInt(formData.insuredAssetId, 10)
              : null,
          category: formData.category,
          subCategory: formData.subCategory || null,
          insurerName: formData.insurerName,
          productName: formData.productName,
          policyNumber: formData.policyNumber,
          channel: formData.channel || null,
          effectiveDate: formData.effectiveDate,
          premium: formData.premium ? parseFloat(formData.premium) : 0,
          sumAssured: formData.sumAssured ? parseFloat(formData.sumAssured) : 0,
          paymentFrequency: formData.paymentFrequency,
          status: formData.status,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error ?? "Failed to create policy");
      }

      setSubmitError(null);
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error("Error creating policy:", error);
      setSubmitError(
        error instanceof Error && error.message !== "Failed to create policy"
          ? error.message
          : "创建保单失败，请重试"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <SheetHeader>
        <SheetTitle>新增保单</SheetTitle>
        <SheetDescription>录入新的保单信息</SheetDescription>
      </SheetHeader>

      <form
        onSubmit={onSubmit}
        className="flex-1 space-y-6 overflow-y-auto px-4 py-6"
      >
        {submitError && (
          <div
            className="rounded-widget border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            role="alert"
          >
            {submitError}
          </div>
        )}

        <div className="space-y-4">
          {/* Product Info */}
          <div className="space-y-2">
            <Label htmlFor="productName">产品名称 *</Label>
            <Input
              id="productName"
              placeholder="请输入产品名称"
              value={formData.productName}
              onChange={(e) => handleChange("productName", e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="insurerName">保险公司 *</Label>
            <Input
              id="insurerName"
              placeholder="请输入保险公司名称"
              value={formData.insurerName}
              onChange={(e) => handleChange("insurerName", e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="policyNumber">保单号 *</Label>
            <Input
              id="policyNumber"
              placeholder="请输入保单号"
              value={formData.policyNumber}
              onChange={(e) => handleChange("policyNumber", e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>保险类型 *</Label>
              <Select
                value={formData.category}
                onValueChange={(v) => handleChange("category", v)}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择类型" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(categoryLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="subCategory">子类别</Label>
              <Input
                id="subCategory"
                placeholder="如：百万医疗"
                value={formData.subCategory}
                onChange={(e) => handleChange("subCategory", e.target.value)}
              />
            </div>
          </div>

          {/* People */}
          <div className="space-y-2">
            <Label>投保人 *</Label>
            <Select
              value={formData.applicantId}
              onValueChange={(v) => handleChange("applicantId", v)}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="选择投保人" />
              </SelectTrigger>
              <SelectContent>
                {members.map((m) => (
                  <SelectItem key={m.id} value={String(m.id)}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>被保类型</Label>
              <Select
                value={formData.insuredType}
                onValueChange={(v) =>
                  handleChange("insuredType", v as "Member" | "Asset")
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Member">人</SelectItem>
                  <SelectItem value="Asset">财产</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.insuredType === "Member" ? (
              <div className="space-y-2">
                <Label>被保人</Label>
                <Select
                  value={formData.insuredMemberId}
                  onValueChange={(v) => handleChange("insuredMemberId", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择被保人" />
                  </SelectTrigger>
                  <SelectContent>
                    {members.map((m) => (
                      <SelectItem key={m.id} value={String(m.id)}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>保险标的</Label>
                <Select
                  value={formData.insuredAssetId}
                  onValueChange={(v) => handleChange("insuredAssetId", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择资产" />
                  </SelectTrigger>
                  <SelectContent>
                    {assets.map((a) => (
                      <SelectItem key={a.id} value={String(a.id)}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Dates & Financials */}
          <div className="space-y-2">
            <Label htmlFor="effectiveDate">生效日期 *</Label>
            <Input
              id="effectiveDate"
              type="date"
              value={formData.effectiveDate}
              onChange={(e) => handleChange("effectiveDate", e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sumAssured">保额</Label>
              <Input
                id="sumAssured"
                type="number"
                min="0"
                step="0.01"
                placeholder="0"
                value={formData.sumAssured}
                onChange={(e) => handleChange("sumAssured", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="premium">保费</Label>
              <Input
                id="premium"
                type="number"
                min="0"
                step="0.01"
                placeholder="0"
                value={formData.premium}
                onChange={(e) => handleChange("premium", e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>缴费频率</Label>
              <Select
                value={formData.paymentFrequency}
                onValueChange={(v) => handleChange("paymentFrequency", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(paymentFrequencyLabels).map(
                    ([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>状态</Label>
              <Select
                value={formData.status}
                onValueChange={(v) => handleChange("status", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="channel">渠道</Label>
            <Input
              id="channel"
              placeholder="如：支付宝、关哥说险"
              value={formData.channel}
              onChange={(e) => handleChange("channel", e.target.value)}
            />
          </div>
        </div>

        <SheetFooter className="flex-row justify-end gap-2 pt-4 border-t">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={isSubmitting}
          >
            取消
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "创建中..." : "创建保单"}
          </Button>
        </SheetFooter>
      </form>
    </>
  );
}

export function PolicySheet({ open, onOpenChange, onSuccess }: PolicySheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col sm:max-w-md">
        {open && (
          <PolicyForm
            onClose={() => onOpenChange(false)}
            {...(onSuccess && { onSuccess })}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

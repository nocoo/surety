"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PolicyDetail } from "@/lib/types/policy";

interface PolicyFormData {
  productName: string;
  insurerName: string;
  policyNumber: string;
  category: string;
  subCategory: string;
  channel: string;
  sumAssured: string;
  premium: string;
  paymentFrequency: string;
  paymentYears: string;
  totalPayments: string;
  renewalType: string;
  paymentAccount: string;
  nextDueDate: string;
  effectiveDate: string;
  expiryDate: string;
  hesitationEndDate: string;
  waitingDays: string;
  guaranteedRenewalYears: string;
  deathBenefit: string;
  notes: string;
  status: string;
}

function createFormData(policy: PolicyDetail): PolicyFormData {
  return {
    productName: policy.productName,
    insurerName: policy.insurerName,
    policyNumber: policy.policyNumber,
    category: policy.category,
    subCategory: policy.subCategory ?? "",
    channel: policy.channel ?? "",
    sumAssured: String(policy.sumAssured),
    premium: String(policy.premium),
    paymentFrequency: policy.paymentFrequency ?? "Yearly",
    paymentYears: policy.paymentYears != null ? String(policy.paymentYears) : "",
    totalPayments: policy.totalPayments != null ? String(policy.totalPayments) : "",
    renewalType: policy.renewalType ?? "",
    paymentAccount: policy.paymentAccount ?? "",
    nextDueDate: policy.nextDueDate ?? "",
    effectiveDate: policy.effectiveDate ?? "",
    expiryDate: policy.expiryDate ?? "",
    hesitationEndDate: policy.hesitationEndDate ?? "",
    waitingDays: policy.waitingDays != null ? String(policy.waitingDays) : "",
    guaranteedRenewalYears: policy.guaranteedRenewalYears != null
      ? String(policy.guaranteedRenewalYears)
      : "",
    deathBenefit: policy.deathBenefit ?? "",
    notes: policy.notes ?? "",
    status: policy.status,
  };
}

const categories = [
  { value: "Life", label: "寿险" },
  { value: "CriticalIllness", label: "重疾险" },
  { value: "Medical", label: "医疗险" },
  { value: "Accident", label: "意外险" },
  { value: "Annuity", label: "年金险" },
  { value: "Property", label: "财产险" },
];

const paymentFrequencies = [
  { value: "Single", label: "趸交" },
  { value: "Monthly", label: "月缴" },
  { value: "Yearly", label: "年缴" },
];

const renewalTypes = [
  { value: "Manual", label: "手动续保" },
  { value: "Auto", label: "自动续保" },
  { value: "Yearly", label: "一年期" },
];

const statuses = [
  { value: "Active", label: "生效中" },
  { value: "Lapsed", label: "已失效" },
  { value: "Surrendered", label: "已退保" },
  { value: "Claimed", label: "已理赔" },
];

interface PolicyEditDialogProps {
  policy: PolicyDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (() => void) | undefined;
}

function PolicyEditForm({
  policy,
  onCancel,
  onSuccess,
}: {
  policy: PolicyDetail;
  onCancel: () => void;
  onSuccess?: (() => void) | undefined;
}) {
  const router = useRouter();
  const [formData, setFormData] = useState<PolicyFormData>(() =>
    createFormData(policy)
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleChange = (field: keyof PolicyFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setSubmitError(null);
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/policies/${policy.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productName: formData.productName,
          insurerName: formData.insurerName,
          policyNumber: formData.policyNumber,
          category: formData.category,
          subCategory: formData.subCategory || null,
          channel: formData.channel || null,
          sumAssured: formData.sumAssured ? Number(formData.sumAssured) : 0,
          premium: formData.premium ? Number(formData.premium) : 0,
          paymentFrequency: formData.paymentFrequency || "Yearly",
          paymentYears: formData.paymentYears ? Number(formData.paymentYears) : null,
          totalPayments: formData.totalPayments ? Number(formData.totalPayments) : null,
          renewalType: formData.renewalType || null,
          paymentAccount: formData.paymentAccount || null,
          nextDueDate: formData.nextDueDate || null,
          effectiveDate: formData.effectiveDate || null,
          expiryDate: formData.expiryDate || null,
          hesitationEndDate: formData.hesitationEndDate || null,
          waitingDays: formData.waitingDays ? Number(formData.waitingDays) : null,
          guaranteedRenewalYears: formData.guaranteedRenewalYears
            ? Number(formData.guaranteedRenewalYears)
            : null,
          deathBenefit: formData.deathBenefit || null,
          notes: formData.notes || null,
          status: formData.status || "Active",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save policy");
      }

      setSubmitError(null);
      onSuccess?.();
      router.refresh(); // Refresh the page to show updated data
    } catch (error) {
      console.error("Error saving policy:", error);
      setSubmitError("保存保单失败，请重试");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {submitError && (
        <div className="rounded-widget border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {submitError}
        </div>
      )}

      {/* Scrollable content area */}
      <div className="max-h-[60vh] space-y-6 overflow-y-auto px-1">
        {/* 产品信息 */}
        <fieldset className="space-y-3">
          <legend className="text-sm font-medium text-muted-foreground">产品信息</legend>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="productName">产品名称</Label>
              <Input
                id="productName"
                value={formData.productName}
                onChange={(e) => handleChange("productName", e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="insurerName">保险公司</Label>
              <Input
                id="insurerName"
                value={formData.insurerName}
                onChange={(e) => handleChange("insurerName", e.target.value)}
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="policyNumber">保单号</Label>
              <Input
                id="policyNumber"
                value={formData.policyNumber}
                onChange={(e) => handleChange("policyNumber", e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>险种类型</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => handleChange("category", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="subCategory">子类别</Label>
              <Input
                id="subCategory"
                value={formData.subCategory}
                onChange={(e) => handleChange("subCategory", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="channel">购买渠道</Label>
              <Input
                id="channel"
                value={formData.channel}
                onChange={(e) => handleChange("channel", e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>保单状态</Label>
            <Select
              value={formData.status}
              onValueChange={(value) => handleChange("status", value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statuses.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </fieldset>

        {/* 保障信息 */}
        <fieldset className="space-y-3">
          <legend className="text-sm font-medium text-muted-foreground">保障信息</legend>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="sumAssured">保额 (元)</Label>
              <Input
                id="sumAssured"
                type="number"
                value={formData.sumAssured}
                onChange={(e) => handleChange("sumAssured", e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="deathBenefit">身故保障</Label>
              <Input
                id="deathBenefit"
                value={formData.deathBenefit}
                onChange={(e) => handleChange("deathBenefit", e.target.value)}
              />
            </div>
          </div>
        </fieldset>

        {/* 缴费信息 */}
        <fieldset className="space-y-3">
          <legend className="text-sm font-medium text-muted-foreground">缴费信息</legend>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="premium">保费 (元)</Label>
              <Input
                id="premium"
                type="number"
                value={formData.premium}
                onChange={(e) => handleChange("premium", e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>缴费方式</Label>
              <Select
                value={formData.paymentFrequency}
                onValueChange={(value) => handleChange("paymentFrequency", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {paymentFrequencies.map((pf) => (
                    <SelectItem key={pf.value} value={pf.value}>
                      {pf.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="paymentYears">缴费年限</Label>
              <Input
                id="paymentYears"
                type="number"
                value={formData.paymentYears}
                onChange={(e) => handleChange("paymentYears", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="totalPayments">总期数</Label>
              <Input
                id="totalPayments"
                type="number"
                value={formData.totalPayments}
                onChange={(e) => handleChange("totalPayments", e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>续保方式</Label>
              <Select
                value={formData.renewalType}
                onValueChange={(value) => handleChange("renewalType", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {renewalTypes.map((rt) => (
                    <SelectItem key={rt.value} value={rt.value}>
                      {rt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="paymentAccount">扣款账户</Label>
              <Input
                id="paymentAccount"
                value={formData.paymentAccount}
                onChange={(e) => handleChange("paymentAccount", e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nextDueDate">下次缴费日</Label>
            <Input
              id="nextDueDate"
              type="date"
              value={formData.nextDueDate}
              onChange={(e) => handleChange("nextDueDate", e.target.value)}
            />
          </div>
        </fieldset>

        {/* 时间信息 */}
        <fieldset className="space-y-3">
          <legend className="text-sm font-medium text-muted-foreground">时间信息</legend>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="effectiveDate">生效日期</Label>
              <Input
                id="effectiveDate"
                type="date"
                value={formData.effectiveDate}
                onChange={(e) => handleChange("effectiveDate", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="expiryDate">到期日期</Label>
              <Input
                id="expiryDate"
                type="date"
                value={formData.expiryDate}
                onChange={(e) => handleChange("expiryDate", e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="hesitationEndDate">犹豫期结束</Label>
              <Input
                id="hesitationEndDate"
                type="date"
                value={formData.hesitationEndDate}
                onChange={(e) => handleChange("hesitationEndDate", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="waitingDays">等待期 (天)</Label>
              <Input
                id="waitingDays"
                type="number"
                value={formData.waitingDays}
                onChange={(e) => handleChange("waitingDays", e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="guaranteedRenewalYears">保证续保 (年)</Label>
            <Input
              id="guaranteedRenewalYears"
              type="number"
              value={formData.guaranteedRenewalYears}
              onChange={(e) => handleChange("guaranteedRenewalYears", e.target.value)}
            />
          </div>
        </fieldset>

        {/* 备注 */}
        <fieldset className="space-y-3">
          <legend className="text-sm font-medium text-muted-foreground">备注</legend>
          <div className="space-y-1.5">
            <Label htmlFor="notes">备注信息</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => handleChange("notes", e.target.value)}
              rows={3}
            />
          </div>
        </fieldset>
      </div>

      <DialogFooter className="flex-row justify-end gap-2 pt-4 border-t">
        <Button
          type="button"
          variant="ghost"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          取消
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          保存修改
        </Button>
      </DialogFooter>
    </form>
  );
}

export function PolicyEditDialog({
  policy,
  open,
  onOpenChange,
  onSuccess,
}: PolicyEditDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>编辑保单</DialogTitle>
          <DialogDescription>修改保单的基本信息和保障条款</DialogDescription>
        </DialogHeader>
        <PolicyEditForm
          policy={policy}
          onCancel={() => onOpenChange(false)}
          onSuccess={onSuccess ?? undefined}
        />
      </DialogContent>
    </Dialog>
  );
}

export function PolicyEditButton({
  policy,
  onSuccess,
}: {
  policy: PolicyDetail;
  onSuccess?: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Pencil className="mr-1.5 h-4 w-4" />
        编辑
      </Button>
      <PolicyEditDialog
        policy={policy}
        open={open}
        onOpenChange={(newOpen) => {
          setOpen(newOpen);
          if (!newOpen) onSuccess?.();
        }}
        onSuccess={() => {
          onSuccess?.();
          setOpen(false);
        }}
      />
    </>
  );
}

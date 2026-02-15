"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Shield } from "lucide-react";
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

interface PolicyFormData {
  productName: string;
  insurerName: string;
  policyNumber: string;
  category: string;
  subCategory: string;
  channel: string;
  applicantId: string;
  insuredMemberId: string;
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

interface Policy {
  id: number;
  productName: string;
  insurerName: string;
  policyNumber: string;
  category: string;
  insuredName?: string | null;
  sumAssured: number;
  premium: number;
  applicantId?: number | null;
  insuredMemberId?: number | null;
  effectiveDate?: string | null;
  expiryDate?: string | null;
  subCategory?: string | null;
  channel?: string | null;
  paymentFrequency?: string | null;
  paymentYears?: number | null;
  totalPayments?: number | null;
  renewalType?: string | null;
  paymentAccount?: string | null;
  nextDueDate?: string | null;
  hesitationEndDate?: string | null;
  waitingDays?: number | null;
  guaranteedRenewalYears?: number | null;
  deathBenefit?: string | null;
  notes?: string | null;
  status?: string;
  archived?: boolean | null;
}

interface Member {
  id: number;
  name: string;
  relation: string;
}

interface CoverageItem {
  id: number;
  policyId: number;
  name: string;
  periodLimit: number | null;
  lifetimeLimit: number | null;
  deductible: number | null;
  coveragePercent: number | null;
  isOptional: boolean | number;
  notes: string | null;
  sortOrder: number;
}

interface CoverageItemDraft {
  name: string;
  periodLimit: string;
  lifetimeLimit: string;
  deductible: string;
  coveragePercent: string;
  isOptional: boolean;
  notes: string;
}

interface PolicySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  policy?: Policy | null;
  onSuccess?: () => void;
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

function createFormData(policy: Policy | null | undefined): PolicyFormData {
  if (policy) {
    return {
      productName: policy.productName,
      insurerName: policy.insurerName,
      policyNumber: policy.policyNumber,
      category: policy.category,
      subCategory: policy.subCategory ?? "",
      channel: policy.channel ?? "",
      applicantId: policy.applicantId ? String(policy.applicantId) : "",
      insuredMemberId: policy.insuredMemberId
        ? String(policy.insuredMemberId)
        : "",
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
      guaranteedRenewalYears: policy.guaranteedRenewalYears != null ? String(policy.guaranteedRenewalYears) : "",
      deathBenefit: policy.deathBenefit ?? "",
      notes: policy.notes ?? "",
      status: policy.status ?? "Active",
    };
  }
  return {
    productName: "",
    insurerName: "",
    policyNumber: "",
    category: "",
    subCategory: "",
    channel: "",
    applicantId: "",
    insuredMemberId: "",
    sumAssured: "",
    premium: "",
    paymentFrequency: "Yearly",
    paymentYears: "",
    totalPayments: "",
    renewalType: "",
    paymentAccount: "",
    nextDueDate: "",
    effectiveDate: "",
    expiryDate: "",
    hesitationEndDate: "",
    waitingDays: "",
    guaranteedRenewalYears: "",
    deathBenefit: "",
    notes: "",
    status: "Active",
  };
}

function PolicyForm({
  policy,
  onClose,
  onSuccess,
}: {
  policy: Policy | null | undefined;
  onClose: () => void;
  onSuccess?: (() => void) | undefined;
}) {
  const isEditing = !!policy;
  const [formData, setFormData] = useState<PolicyFormData>(() =>
    createFormData(policy)
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [coverageItems, setCoverageItems] = useState<CoverageItem[]>([]);
  const [newItem, setNewItem] = useState<CoverageItemDraft | null>(null);

  useEffect(() => {
    fetch("/api/members")
      .then((res) => res.json())
      .then((data) => setMembers(data))
      .catch(console.error);
  }, []);

  // Fetch coverage items when editing
  useEffect(() => {
    if (policy?.id) {
      fetch(`/api/policies/${policy.id}/coverage-items`)
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => setCoverageItems(data))
        .catch(() => setCoverageItems([]));
    }
  }, [policy?.id]);

  const handleChange = (field: keyof PolicyFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const url = isEditing ? `/api/policies/${policy.id}` : "/api/policies";
      const method = isEditing ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productName: formData.productName,
          insurerName: formData.insurerName,
          policyNumber: formData.policyNumber,
          category: formData.category,
          subCategory: formData.subCategory || null,
          channel: formData.channel || null,
          applicantId: formData.applicantId
            ? Number(formData.applicantId)
            : null,
          insuredType: "Member",
          insuredMemberId: formData.insuredMemberId
            ? Number(formData.insuredMemberId)
            : null,
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
          guaranteedRenewalYears: formData.guaranteedRenewalYears ? Number(formData.guaranteedRenewalYears) : null,
          deathBenefit: formData.deathBenefit || null,
          notes: formData.notes || null,
          status: formData.status || "Active",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save policy");
      }

      onSuccess?.();
      onClose();
    } catch (error) {
      console.error("Error saving policy:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <SheetHeader>
        <SheetTitle>{isEditing ? "编辑保单" : "添加保单"}</SheetTitle>
        <SheetDescription>
          {isEditing ? "修改保单信息" : "填写保单基本信息，创建新保单记录"}
        </SheetDescription>
      </SheetHeader>

      <form onSubmit={onSubmit} className="flex-1 space-y-6 overflow-y-auto px-4 py-6">
        {/* Section 1: Product Info */}
        <fieldset className="space-y-4">
          <legend className="text-sm font-medium text-muted-foreground">产品信息</legend>

          <div className="space-y-2">
            <Label htmlFor="productName">产品名称</Label>
            <Input
              id="productName"
              placeholder="如：国寿福终身寿险"
              value={formData.productName}
              onChange={(e) => handleChange("productName", e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="insurerName">保险公司</Label>
            <Input
              id="insurerName"
              placeholder="如：中国人寿"
              value={formData.insurerName}
              onChange={(e) => handleChange("insurerName", e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="policyNumber">保单号</Label>
              <Input
                id="policyNumber"
                placeholder="P2024010001"
                value={formData.policyNumber}
                onChange={(e) => handleChange("policyNumber", e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>险种类型</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => handleChange("category", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择险种" />
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="subCategory">子类别</Label>
              <Input
                id="subCategory"
                placeholder="如：百万医疗险"
                value={formData.subCategory}
                onChange={(e) => handleChange("subCategory", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="channel">购买渠道</Label>
              <Input
                id="channel"
                placeholder="如：支付宝"
                value={formData.channel}
                onChange={(e) => handleChange("channel", e.target.value)}
              />
            </div>
          </div>

          {isEditing && (
            <div className="space-y-2">
              <Label>保单状态</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => handleChange("status", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择状态" />
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
          )}
        </fieldset>

        {/* Section 2: People */}
        <fieldset className="space-y-4">
          <legend className="text-sm font-medium text-muted-foreground">人员信息</legend>

          <div className="space-y-2">
            <Label>投保人</Label>
            <Select
              value={formData.applicantId}
              onValueChange={(value) => handleChange("applicantId", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择投保人" />
              </SelectTrigger>
              <SelectContent>
                {members.map((member) => (
                  <SelectItem key={member.id} value={String(member.id)}>
                    {member.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>被保险人</Label>
            <Select
              value={formData.insuredMemberId}
              onValueChange={(value) => handleChange("insuredMemberId", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择家庭成员" />
              </SelectTrigger>
              <SelectContent>
                {members.map((member) => (
                  <SelectItem key={member.id} value={String(member.id)}>
                    {member.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </fieldset>

        {/* Section 3: Coverage */}
        <fieldset className="space-y-4">
          <legend className="text-sm font-medium text-muted-foreground">保障信息</legend>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sumAssured">保额 (元)</Label>
              <Input
                id="sumAssured"
                type="number"
                placeholder="1000000"
                value={formData.sumAssured}
                onChange={(e) => handleChange("sumAssured", e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="deathBenefit">身故保障</Label>
              <Input
                id="deathBenefit"
                placeholder="如：赔付已交保费"
                value={formData.deathBenefit}
                onChange={(e) => handleChange("deathBenefit", e.target.value)}
              />
            </div>
          </div>
        </fieldset>

        {/* Section 4: Payment */}
        <fieldset className="space-y-4">
          <legend className="text-sm font-medium text-muted-foreground">缴费信息</legend>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="premium">保费 (元)</Label>
              <Input
                id="premium"
                type="number"
                placeholder="12000"
                value={formData.premium}
                onChange={(e) => handleChange("premium", e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>缴费方式</Label>
              <Select
                value={formData.paymentFrequency}
                onValueChange={(value) => handleChange("paymentFrequency", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择方式" />
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="paymentYears">缴费年限</Label>
              <Input
                id="paymentYears"
                type="number"
                placeholder="20"
                value={formData.paymentYears}
                onChange={(e) => handleChange("paymentYears", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="totalPayments">总期数</Label>
              <Input
                id="totalPayments"
                type="number"
                placeholder="20"
                value={formData.totalPayments}
                onChange={(e) => handleChange("totalPayments", e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>续保方式</Label>
              <Select
                value={formData.renewalType}
                onValueChange={(value) => handleChange("renewalType", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择续保" />
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

            <div className="space-y-2">
              <Label htmlFor="paymentAccount">扣款账户</Label>
              <Input
                id="paymentAccount"
                placeholder="如：工行尾号1234"
                value={formData.paymentAccount}
                onChange={(e) => handleChange("paymentAccount", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="nextDueDate">下次缴费日</Label>
            <Input
              id="nextDueDate"
              type="date"
              value={formData.nextDueDate}
              onChange={(e) => handleChange("nextDueDate", e.target.value)}
            />
          </div>
        </fieldset>

        {/* Section 5: Dates */}
        <fieldset className="space-y-4">
          <legend className="text-sm font-medium text-muted-foreground">时间信息</legend>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="effectiveDate">生效日期</Label>
              <Input
                id="effectiveDate"
                type="date"
                value={formData.effectiveDate}
                onChange={(e) => handleChange("effectiveDate", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="expiryDate">到期日期</Label>
              <Input
                id="expiryDate"
                type="date"
                value={formData.expiryDate}
                onChange={(e) => handleChange("expiryDate", e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="hesitationEndDate">犹豫期结束</Label>
              <Input
                id="hesitationEndDate"
                type="date"
                value={formData.hesitationEndDate}
                onChange={(e) => handleChange("hesitationEndDate", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="waitingDays">等待期 (天)</Label>
              <Input
                id="waitingDays"
                type="number"
                placeholder="90"
                value={formData.waitingDays}
                onChange={(e) => handleChange("waitingDays", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="guaranteedRenewalYears">保证续保 (年)</Label>
            <Input
              id="guaranteedRenewalYears"
              type="number"
              placeholder="如：20"
              value={formData.guaranteedRenewalYears}
              onChange={(e) => handleChange("guaranteedRenewalYears", e.target.value)}
            />
          </div>
        </fieldset>

        {/* Section 6: Notes */}
        <fieldset className="space-y-4">
          <legend className="text-sm font-medium text-muted-foreground">附加信息</legend>

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
        </fieldset>

        {/* Section 7: Coverage Items (edit mode only) */}
        {isEditing && policy && (
          <fieldset className="space-y-4">
            <legend className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Shield className="h-4 w-4" />
              保障明细
              {coverageItems.length > 0 && (
                <Badge variant="secondary" className="text-xs">{coverageItems.length}</Badge>
              )}
            </legend>

            {coverageItems.map((item) => (
              <div key={item.id} className="flex items-start gap-2 rounded-md border p-3 bg-secondary">
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{item.name}</span>
                    {(item.isOptional === true || item.isOptional === 1) && (
                      <Badge variant="outline" className="text-xs">可选</Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                    {item.periodLimit != null && <span>年度限额: {(item.periodLimit / 10000).toFixed(0)}万</span>}
                    {item.deductible != null && <span>免赔额: {item.deductible.toLocaleString()}</span>}
                    {item.coveragePercent != null && <span>赔付: {item.coveragePercent}%</span>}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                  onClick={async () => {
                    const res = await fetch(
                      `/api/policies/${policy.id}/coverage-items/${item.id}`,
                      { method: "DELETE", headers: { "Content-Type": "application/json" } }
                    );
                    if (res.ok) {
                      setCoverageItems((prev) => prev.filter((i) => i.id !== item.id));
                    }
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}

            {newItem ? (
              <div className="space-y-3 rounded-md border p-3 bg-background">
                <div className="space-y-1.5">
                  <Label className="text-xs">保障名称 *</Label>
                  <Input
                    placeholder="如：住院医疗"
                    value={newItem.name}
                    onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">年度限额</Label>
                    <Input
                      type="number"
                      placeholder="6000000"
                      value={newItem.periodLimit}
                      onChange={(e) => setNewItem({ ...newItem, periodLimit: e.target.value })}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">免赔额</Label>
                    <Input
                      type="number"
                      placeholder="10000"
                      value={newItem.deductible}
                      onChange={(e) => setNewItem({ ...newItem, deductible: e.target.value })}
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">赔付比例 (%)</Label>
                    <Input
                      type="number"
                      placeholder="100"
                      value={newItem.coveragePercent}
                      onChange={(e) => setNewItem({ ...newItem, coveragePercent: e.target.value })}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="flex items-end gap-2 pb-0.5">
                    <Switch
                      checked={newItem.isOptional}
                      onCheckedChange={(v) => setNewItem({ ...newItem, isOptional: v })}
                    />
                    <Label className="text-xs">可选保障</Label>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setNewItem(null)}
                  >
                    取消
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={!newItem.name.trim()}
                    onClick={async () => {
                      const res = await fetch(`/api/policies/${policy.id}/coverage-items`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          name: newItem.name.trim(),
                          periodLimit: newItem.periodLimit ? Number(newItem.periodLimit) : null,
                          lifetimeLimit: newItem.lifetimeLimit ? Number(newItem.lifetimeLimit) : null,
                          deductible: newItem.deductible ? Number(newItem.deductible) : null,
                          coveragePercent: newItem.coveragePercent ? Number(newItem.coveragePercent) : null,
                          isOptional: newItem.isOptional,
                          notes: newItem.notes || null,
                          sortOrder: coverageItems.length,
                        }),
                      });
                      if (res.ok) {
                        const created = await res.json();
                        setCoverageItems((prev) => [...prev, created]);
                        setNewItem(null);
                      }
                    }}
                  >
                    添加
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() =>
                  setNewItem({
                    name: "",
                    periodLimit: "",
                    lifetimeLimit: "",
                    deductible: "",
                    coveragePercent: "",
                    isOptional: false,
                    notes: "",
                  })
                }
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                添加保障项目
              </Button>
            )}
          </fieldset>
        )}

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
            {isSubmitting
              ? "保存中..."
              : isEditing
                ? "保存修改"
                : "创建保单"}
          </Button>
        </SheetFooter>
      </form>
    </>
  );
}

export function PolicySheet({
  open,
  onOpenChange,
  policy,
  onSuccess,
}: PolicySheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col sm:max-w-lg">
        <PolicyForm
          key={policy?.id ?? "new"}
          policy={policy}
          onClose={() => onOpenChange(false)}
          onSuccess={onSuccess}
        />
      </SheetContent>
    </Sheet>
  );
}

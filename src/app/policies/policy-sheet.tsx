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

interface PolicyFormData {
  productName: string;
  insurerName: string;
  policyNumber: string;
  category: string;
  applicantId: string;
  insuredMemberId: string;
  sumAssured: string;
  premium: string;
  effectiveDate: string;
  expiryDate: string;
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
  status?: string;
  nextDueDate?: string | null;
  channel?: string | null;
  archived?: boolean | null;
}

interface Member {
  id: number;
  name: string;
  relation: string;
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

function createFormData(policy: Policy | null | undefined): PolicyFormData {
  if (policy) {
    return {
      productName: policy.productName,
      insurerName: policy.insurerName,
      policyNumber: policy.policyNumber,
      category: policy.category,
      applicantId: policy.applicantId ? String(policy.applicantId) : "",
      insuredMemberId: policy.insuredMemberId
        ? String(policy.insuredMemberId)
        : "",
      sumAssured: String(policy.sumAssured),
      premium: String(policy.premium),
      effectiveDate: policy.effectiveDate ?? "",
      expiryDate: policy.expiryDate ?? "",
    };
  }
  return {
    productName: "",
    insurerName: "",
    policyNumber: "",
    category: "",
    applicantId: "",
    insuredMemberId: "",
    sumAssured: "",
    premium: "",
    effectiveDate: "",
    expiryDate: "",
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

  useEffect(() => {
    fetch("/api/members")
      .then((res) => res.json())
      .then((data) => setMembers(data))
      .catch(console.error);
  }, []);

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
          applicantId: formData.applicantId
            ? Number(formData.applicantId)
            : null,
          insuredType: "Member",
          insuredMemberId: formData.insuredMemberId
            ? Number(formData.insuredMemberId)
            : null,
          sumAssured: formData.sumAssured ? Number(formData.sumAssured) : 0,
          premium: formData.premium ? Number(formData.premium) : 0,
          paymentFrequency: "Yearly",
          effectiveDate: formData.effectiveDate || null,
          expiryDate: formData.expiryDate || null,
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
        <div className="space-y-4">
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
              <Label htmlFor="premium">年保费 (元)</Label>
              <Input
                id="premium"
                type="number"
                placeholder="12000"
                value={formData.premium}
                onChange={(e) => handleChange("premium", e.target.value)}
                required
              />
            </div>
          </div>

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

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

interface PolicyFormData {
  productName: string;
  insurerName: string;
  policyNumber: string;
  category: string;
  insuredName: string;
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
  insuredName: string;
  sumAssured: number;
  premium: number;
}

interface PolicySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  policy?: Policy | null;
}

const categories = [
  { value: "Life", label: "寿险" },
  { value: "CriticalIllness", label: "重疾险" },
  { value: "Medical", label: "医疗险" },
  { value: "Accident", label: "意外险" },
  { value: "Annuity", label: "年金险" },
  { value: "Property", label: "财产险" },
];

const familyMembers = [
  { value: "张伟", label: "张伟 (本人)" },
  { value: "李娜", label: "李娜 (配偶)" },
  { value: "张小明", label: "张小明 (儿子)" },
  { value: "李建国", label: "李建国 (姥爷)" },
  { value: "王秀英", label: "王秀英 (姥姥)" },
  { value: "张国强", label: "张国强 (爷爷)" },
  { value: "刘桂芳", label: "刘桂芳 (奶奶)" },
];

function createFormData(policy: Policy | null | undefined): PolicyFormData {
  if (policy) {
    return {
      productName: policy.productName,
      insurerName: policy.insurerName,
      policyNumber: policy.policyNumber,
      category: policy.category,
      insuredName: policy.insuredName,
      sumAssured: String(policy.sumAssured),
      premium: String(policy.premium),
      effectiveDate: "",
      expiryDate: "",
    };
  }
  return {
    productName: "",
    insurerName: "",
    policyNumber: "",
    category: "",
    insuredName: "",
    sumAssured: "",
    premium: "",
    effectiveDate: "",
    expiryDate: "",
  };
}

function PolicyForm({
  policy,
  onClose,
}: {
  policy: Policy | null | undefined;
  onClose: () => void;
}) {
  const isEditing = !!policy;
  const [formData, setFormData] = useState<PolicyFormData>(() =>
    createFormData(policy)
  );

  const handleChange = (field: keyof PolicyFormData, value: string) => {
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
            <Label>被保险人</Label>
            <Select
              value={formData.insuredName}
              onValueChange={(value) => handleChange("insuredName", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择家庭成员" />
              </SelectTrigger>
              <SelectContent>
                {familyMembers.map((member) => (
                  <SelectItem key={member.value} value={member.value}>
                    {member.label}
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

        <SheetFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button type="submit">
            {isEditing ? "保存修改" : "创建保单"}
          </Button>
        </SheetFooter>
      </form>
    </>
  );
}

export function PolicySheet({ open, onOpenChange, policy }: PolicySheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col sm:max-w-lg">
        <PolicyForm
          key={policy?.id ?? "new"}
          policy={policy}
          onClose={() => onOpenChange(false)}
        />
      </SheetContent>
    </Sheet>
  );
}

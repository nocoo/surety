"use client";

import { useState } from "react";
import { Copy, Check, Pencil, Building2, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AttachmentSection } from "@/components/attachments/attachment-section";
import { cn, getAvatarColor } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import {
  statusConfig,
  categoryLabels,
  paymentFrequencyLabels,
  renewalTypeLabels,
} from "@/lib/constants/policy";
import type { PolicyDetail, Beneficiary } from "@/lib/types/policy";
import { formatDateWithDays } from "@/lib/date-utils";
import { EditableInfoRow } from "./editable-info-row";

interface MetaColumnProps {
  policy: PolicyDetail;
  beneficiaries: Beneficiary[];
  onPolicyUpdate?: () => void;
}

const categories = [
  { value: "Life", label: "寿险" },
  { value: "CriticalIllness", label: "重疾险" },
  { value: "Medical", label: "医疗险" },
  { value: "Accident", label: "意外险" },
  { value: "Annuity", label: "年金险" },
  { value: "Property", label: "财产险" },
] as const;

const paymentFrequencies = [
  { value: "Single", label: "趸交" },
  { value: "Monthly", label: "月缴" },
  { value: "Yearly", label: "年缴" },
] as const;

const renewalTypes = [
  { value: "Manual", label: "手动续保" },
  { value: "Auto", label: "自动续保" },
  { value: "Yearly", label: "一年期" },
] as const;

const statuses = [
  { value: "Active", label: "生效中" },
  { value: "Lapsed", label: "已失效" },
  { value: "Surrendered", label: "已退保" },
  { value: "Claimed", label: "已理赔" },
] as const;

function PersonRow({
  name,
  label,
  icon,
}: {
  name: string;
  label: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        {icon ?? (
          <Avatar size="sm">
            <AvatarFallback className={cn(getAvatarColor(name), "text-white")}>
              {name[0]}
            </AvatarFallback>
          </Avatar>
        )}
        <span className="font-medium">{name}</span>
      </div>
    </div>
  );
}

// Basic Info Section
function BasicInfoSection({
  policy,
  onPolicyUpdate,
}: {
  policy: PolicyDetail;
  onPolicyUpdate?: () => void;
}) {
  type FormData = {
    productName: string;
    insurerName: string;
    category: string;
    subCategory: string;
    channel: string;
    status: typeof policy.status;
  };

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>({
    productName: policy.productName,
    insurerName: policy.insurerName,
    category: policy.category,
    subCategory: policy.subCategory ?? "",
    channel: policy.channel ?? "",
    status: policy.status,
  });

  const updateField = <K extends keyof FormData>(field: K, value: FormData[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/policies/${policy.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productName: formData.productName,
          insurerName: formData.insurerName,
          category: formData.category,
          subCategory: formData.subCategory || null,
          channel: formData.channel || null,
          status: formData.status,
        }),
      });

      if (!response.ok) {
        throw new Error("保存失败");
      }

      setIsEditing(false);
      onPolicyUpdate?.();
    } catch {
      setError("保存失败，请重试");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      productName: policy.productName,
      insurerName: policy.insurerName,
      category: policy.category,
      subCategory: policy.subCategory ?? "",
      channel: policy.channel ?? "",
      status: policy.status,
    });
    setIsEditing(false);
    setError(null);
  };

  return (
    <div className="group">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-muted-foreground">
          基本信息
        </h3>
        {!isEditing ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => setIsEditing(true)}
          >
            <Pencil className="h-3 w-3" />
          </Button>
        ) : (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-success hover:text-success"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Check className="h-3 w-3" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-destructive hover:text-destructive"
              onClick={handleCancel}
              disabled={isSaving}
            >
              X
            </Button>
          </div>
        )}
      </div>
      <div className="space-y-2">
        <EditableInfoRow
          label="产品名称"
          value={policy.productName}
          editValue={formData.productName}
          onEditChange={isEditing ? (v) => updateField("productName", v) : undefined}
        />
        <EditableInfoRow
          label="保险公司"
          value={policy.insurerName}
          editValue={formData.insurerName}
          onEditChange={isEditing ? (v) => updateField("insurerName", v) : undefined}
        />
        <EditableInfoRow
          label="险种"
          value={categoryLabels[policy.category] ?? policy.category}
          type="select"
          options={categories}
          editValue={formData.category}
          onEditChange={isEditing ? (v) => updateField("category", v) : undefined}
        />
        <EditableInfoRow
          label="子类"
          value={policy.subCategory}
          editValue={formData.subCategory}
          onEditChange={isEditing ? (v) => updateField("subCategory", v) : undefined}
        />
        <EditableInfoRow
          label="渠道"
          value={policy.channel}
          editValue={formData.channel}
          onEditChange={isEditing ? (v) => updateField("channel", v) : undefined}
        />
        <EditableInfoRow
          label="状态"
          value={<Badge variant={statusConfig[policy.status].variant}>{statusConfig[policy.status].label}</Badge>}
          type="select"
          options={statuses}
          editValue={formData.status}
          onEditChange={isEditing ? (v) => updateField("status", v as typeof policy.status) : undefined}
        />
      </div>
      {error && <p className="text-xs text-destructive mt-2">{error}</p>}
    </div>
  );
}

// Coverage Info Section
function CoverageInfoSection({
  policy,
  onPolicyUpdate,
}: {
  policy: PolicyDetail;
  onPolicyUpdate?: () => void;
}) {
  type FormData = {
    sumAssured: string;
    deathBenefit: string;
    premium: string;
    paymentFrequency: string;
  };

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>({
    sumAssured: String(policy.sumAssured),
    deathBenefit: policy.deathBenefit ?? "",
    premium: String(policy.premium),
    paymentFrequency: policy.paymentFrequency ?? "Yearly",
  });

  const updateField = <K extends keyof FormData>(field: K, value: FormData[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/policies/${policy.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sumAssured: formData.sumAssured ? Number(formData.sumAssured) : 0,
          deathBenefit: formData.deathBenefit || null,
          premium: formData.premium ? Number(formData.premium) : 0,
          paymentFrequency: formData.paymentFrequency || "Yearly",
        }),
      });

      if (!response.ok) {
        throw new Error("保存失败");
      }

      setIsEditing(false);
      onPolicyUpdate?.();
    } catch {
      setError("保存失败，请重试");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      sumAssured: String(policy.sumAssured),
      deathBenefit: policy.deathBenefit ?? "",
      premium: String(policy.premium),
      paymentFrequency: policy.paymentFrequency ?? "Yearly",
    });
    setIsEditing(false);
    setError(null);
  };

  const frequencyLabel = paymentFrequencyLabels[policy.paymentFrequency] ?? policy.paymentFrequency;

  return (
    <div className="group">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-muted-foreground">
          保障信息
        </h3>
        {!isEditing ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => setIsEditing(true)}
          >
            <Pencil className="h-3 w-3" />
          </Button>
        ) : (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-success hover:text-success"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Check className="h-3 w-3" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-destructive hover:text-destructive"
              onClick={handleCancel}
              disabled={isSaving}
            >
              X
            </Button>
          </div>
        )}
      </div>
      <div className="space-y-2">
        <EditableInfoRow
          label="保额"
          value={formatCurrency(policy.sumAssured)}
          type="number"
          editValue={formData.sumAssured}
          onEditChange={isEditing ? (v) => updateField("sumAssured", v) : undefined}
        />
        <EditableInfoRow
          label="身故保额"
          value={policy.deathBenefit}
          editValue={formData.deathBenefit}
          onEditChange={isEditing ? (v) => updateField("deathBenefit", v) : undefined}
        />
        <EditableInfoRow
          label="保费"
          value={`${formatCurrency(policy.premium)}/${frequencyLabel}`}
          type="number"
          editValue={formData.premium}
          onEditChange={isEditing ? (v) => updateField("premium", v) : undefined}
        />
        <EditableInfoRow
          label="缴费方式"
          value={frequencyLabel}
          type="select"
          options={paymentFrequencies}
          editValue={formData.paymentFrequency}
          onEditChange={isEditing ? (v) => updateField("paymentFrequency", v) : undefined}
        />
      </div>
      {error && <p className="text-xs text-destructive mt-2">{error}</p>}
    </div>
  );
}

// Payment Details Section
function PaymentDetailsSection({
  policy,
  onPolicyUpdate,
}: {
  policy: PolicyDetail;
  onPolicyUpdate?: () => void;
}) {
  type FormData = {
    paymentYears: string;
    totalPayments: string;
    renewalType: string;
    paymentAccount: string;
    nextDueDate: string;
  };

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>({
    paymentYears: policy.paymentYears != null ? String(policy.paymentYears) : "",
    totalPayments: policy.totalPayments != null ? String(policy.totalPayments) : "",
    renewalType: policy.renewalType ?? "",
    paymentAccount: policy.paymentAccount ?? "",
    nextDueDate: policy.nextDueDate ?? "",
  });

  const updateField = <K extends keyof FormData>(field: K, value: FormData[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/policies/${policy.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentYears: formData.paymentYears ? Number(formData.paymentYears) : null,
          totalPayments: formData.totalPayments ? Number(formData.totalPayments) : null,
          renewalType: formData.renewalType || null,
          paymentAccount: formData.paymentAccount || null,
          nextDueDate: formData.nextDueDate || null,
        }),
      });

      if (!response.ok) {
        throw new Error("保存失败");
      }

      setIsEditing(false);
      onPolicyUpdate?.();
    } catch {
      setError("保存失败，请重试");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      paymentYears: policy.paymentYears != null ? String(policy.paymentYears) : "",
      totalPayments: policy.totalPayments != null ? String(policy.totalPayments) : "",
      renewalType: policy.renewalType ?? "",
      paymentAccount: policy.paymentAccount ?? "",
      nextDueDate: policy.nextDueDate ?? "",
    });
    setIsEditing(false);
    setError(null);
  };

  return (
    <div className="group">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-muted-foreground">
          缴费详情
        </h3>
        {!isEditing ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => setIsEditing(true)}
          >
            <Pencil className="h-3 w-3" />
          </Button>
        ) : (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-success hover:text-success"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Check className="h-3 w-3" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-destructive hover:text-destructive"
              onClick={handleCancel}
              disabled={isSaving}
            >
              X
            </Button>
          </div>
        )}
      </div>
      <div className="space-y-2">
        {(isEditing || policy.paymentYears != null) && (
          <EditableInfoRow
            label="缴费年限"
            value={policy.paymentYears != null ? `${policy.paymentYears} 年` : null}
            type="number"
            editValue={formData.paymentYears}
            onEditChange={isEditing ? (v) => updateField("paymentYears", v) : undefined}
          />
        )}
        {(isEditing || policy.totalPayments != null) && (
          <EditableInfoRow
            label="总期数"
            value={policy.totalPayments != null ? `${policy.totalPayments} 期` : null}
            type="number"
            editValue={formData.totalPayments}
            onEditChange={isEditing ? (v) => updateField("totalPayments", v) : undefined}
          />
        )}
        {(isEditing || policy.renewalType) && (
          <EditableInfoRow
            label="续保方式"
            value={policy.renewalType ? (renewalTypeLabels[policy.renewalType] ?? policy.renewalType) : null}
            type="select"
            options={renewalTypes}
            editValue={formData.renewalType}
            onEditChange={isEditing ? (v) => updateField("renewalType", v) : undefined}
          />
        )}
        <EditableInfoRow
          label="扣款账户"
          value={policy.paymentAccount}
          editValue={formData.paymentAccount}
          onEditChange={isEditing ? (v) => updateField("paymentAccount", v) : undefined}
        />
        <EditableInfoRow
          label="下次缴费日"
          value={formatDateWithDays(policy.nextDueDate)}
          type="date"
          editValue={formData.nextDueDate}
          onEditChange={isEditing ? (v) => updateField("nextDueDate", v) : undefined}
        />
      </div>
      {error && <p className="text-xs text-destructive mt-2">{error}</p>}
    </div>
  );
}

// Date Info Section
function DateInfoSection({
  policy,
  onPolicyUpdate,
}: {
  policy: PolicyDetail;
  onPolicyUpdate?: () => void;
}) {
  type FormData = {
    effectiveDate: string;
    expiryDate: string;
    hesitationEndDate: string;
    waitingDays: string;
    guaranteedRenewalYears: string;
  };

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>({
    effectiveDate: policy.effectiveDate,
    expiryDate: policy.expiryDate ?? "",
    hesitationEndDate: policy.hesitationEndDate ?? "",
    waitingDays: policy.waitingDays != null ? String(policy.waitingDays) : "",
    guaranteedRenewalYears: policy.guaranteedRenewalYears != null ? String(policy.guaranteedRenewalYears) : "",
  });

  const updateField = <K extends keyof FormData>(field: K, value: FormData[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/policies/${policy.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          effectiveDate: formData.effectiveDate,
          expiryDate: formData.expiryDate || null,
          hesitationEndDate: formData.hesitationEndDate || null,
          waitingDays: formData.waitingDays ? Number(formData.waitingDays) : null,
          guaranteedRenewalYears: formData.guaranteedRenewalYears ? Number(formData.guaranteedRenewalYears) : null,
        }),
      });

      if (!response.ok) {
        throw new Error("保存失败");
      }

      setIsEditing(false);
      onPolicyUpdate?.();
    } catch {
      setError("保存失败，请重试");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      effectiveDate: policy.effectiveDate,
      expiryDate: policy.expiryDate ?? "",
      hesitationEndDate: policy.hesitationEndDate ?? "",
      waitingDays: policy.waitingDays != null ? String(policy.waitingDays) : "",
      guaranteedRenewalYears: policy.guaranteedRenewalYears != null ? String(policy.guaranteedRenewalYears) : "",
    });
    setIsEditing(false);
    setError(null);
  };

  return (
    <div className="group">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-muted-foreground">
          时间信息
        </h3>
        {!isEditing ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => setIsEditing(true)}
          >
            <Pencil className="h-3 w-3" />
          </Button>
        ) : (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-success hover:text-success"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Check className="h-3 w-3" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-destructive hover:text-destructive"
              onClick={handleCancel}
              disabled={isSaving}
            >
              X
            </Button>
          </div>
        )}
      </div>
      <div className="space-y-2">
        <EditableInfoRow
          label="生效日期"
          value={formatDateWithDays(policy.effectiveDate)}
          type="date"
          editValue={formData.effectiveDate}
          onEditChange={isEditing ? (v) => updateField("effectiveDate", v) : undefined}
        />
        {(isEditing || policy.expiryDate) && (
          <EditableInfoRow
            label="到期日期"
            value={formatDateWithDays(policy.expiryDate)}
            type="date"
            editValue={formData.expiryDate}
            onEditChange={isEditing ? (v) => updateField("expiryDate", v) : undefined}
          />
        )}
        {(isEditing || policy.hesitationEndDate) && (
          <EditableInfoRow
            label="犹豫期截止"
            value={formatDateWithDays(policy.hesitationEndDate)}
            type="date"
            editValue={formData.hesitationEndDate}
            onEditChange={isEditing ? (v) => updateField("hesitationEndDate", v) : undefined}
          />
        )}
        {(isEditing || policy.waitingDays != null) && (
          <EditableInfoRow
            label="等待期 (天)"
            value={policy.waitingDays != null ? `${policy.waitingDays} 天` : null}
            type="number"
            editValue={formData.waitingDays}
            onEditChange={isEditing ? (v) => updateField("waitingDays", v) : undefined}
          />
        )}
        {(isEditing || policy.guaranteedRenewalYears != null) && (
          <EditableInfoRow
            label="保证续保 (年)"
            value={policy.guaranteedRenewalYears != null ? `${policy.guaranteedRenewalYears} 年` : null}
            type="number"
            editValue={formData.guaranteedRenewalYears}
            onEditChange={isEditing ? (v) => updateField("guaranteedRenewalYears", v) : undefined}
          />
        )}
      </div>
      {error && <p className="text-xs text-destructive mt-2">{error}</p>}
    </div>
  );
}

// Notes Section
function NotesSection({
  policy,
  onPolicyUpdate,
}: {
  policy: PolicyDetail;
  onPolicyUpdate?: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState(policy.notes ?? "");

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/policies/${policy.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes: notes || null,
        }),
      });

      if (!response.ok) {
        throw new Error("保存失败");
      }

      setIsEditing(false);
      onPolicyUpdate?.();
    } catch {
      setError("保存失败，请重试");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setNotes(policy.notes ?? "");
    setIsEditing(false);
    setError(null);
  };

  if (!policy.notes && !isEditing) return null;

  return (
    <div className="group">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-muted-foreground">
          备注
        </h3>
        {!isEditing ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => setIsEditing(true)}
          >
            <Pencil className="h-3 w-3" />
          </Button>
        ) : (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-success hover:text-success"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Check className="h-3 w-3" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-destructive hover:text-destructive"
              onClick={handleCancel}
              disabled={isSaving}
            >
              X
            </Button>
          </div>
        )}
      </div>
      {isEditing ? (
        <div>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="text-sm"
          />
          {error && <p className="text-xs text-destructive mt-2">{error}</p>}
        </div>
      ) : (
        <p className="text-sm whitespace-pre-wrap">{policy.notes}</p>
      )}
    </div>
  );
}

export function MetaColumn({ policy, beneficiaries, onPolicyUpdate }: MetaColumnProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(policy.policyNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const status = statusConfig[policy.status];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Pencil className="size-5 text-primary shrink-0" />
          <h2 className="text-lg font-semibold leading-tight">
            {policy.productName}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={status.variant}>{status.label}</Badge>
          <span className="text-sm text-muted-foreground">
            {policy.policyNumber}
          </span>
          <button
            type="button"
            onClick={handleCopy}
            className="text-muted-foreground hover:text-foreground transition-colors"
            title="复制保单号"
          >
            {copied ? (
              <Check className="size-3.5 text-success" />
            ) : (
              <Copy className="size-3.5" />
            )}
          </button>
        </div>
      </div>

      <Separator />

      {/* Editable Sections */}
      <BasicInfoSection policy={policy} {...(onPolicyUpdate && { onPolicyUpdate })} />

      <Separator />

      <CoverageInfoSection policy={policy} {...(onPolicyUpdate && { onPolicyUpdate })} />

      <Separator />

      <PaymentDetailsSection policy={policy} {...(onPolicyUpdate && { onPolicyUpdate })} />

      <Separator />

      <DateInfoSection policy={policy} {...(onPolicyUpdate && { onPolicyUpdate })} />

      <Separator />

      {/* 人员信息 */}
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-2">
          人员信息
        </h3>
        <div className="space-y-2">
          <PersonRow name={policy.insuredName} label="被保人" />
          {policy.applicantName && (
            <PersonRow name={policy.applicantName} label="投保人" />
          )}
          {policy.insuredAssetName && (
            <PersonRow
              name={policy.insuredAssetName}
              label="保障标的"
              icon={
                <div className="flex size-6 items-center justify-center rounded-full bg-muted">
                  <Building2 className="size-3.5 text-muted-foreground" />
                </div>
              }
            />
          )}
        </div>
      </div>

      {/* 受益人 */}
      {beneficiaries.length > 0 && (
        <>
          <Separator />
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-2">
              受益人
            </h3>
            <div className="space-y-2">
              {beneficiaries.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between text-sm"
                >
                  <div className="flex items-center gap-2">
                    <Avatar size="sm">
                      <AvatarFallback
                        className={cn(getAvatarColor(b.name), "text-white")}
                      >
                        {b.name[0]}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{b.name}</span>
                    <Badge variant="outline" className="text-xs px-1.5 py-0">
                      {b.rankOrder}序
                    </Badge>
                  </div>
                  <span className="text-muted-foreground">
                    {b.sharePercent}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <Separator />

      <NotesSection policy={policy} {...(onPolicyUpdate && { onPolicyUpdate })} />

      {/* 附件 */}
      <AttachmentSection policyId={policy.id} />
    </div>
  );
}

import { formatCurrency } from "@surety/api/lib/format";
import { formatDateWithDays } from "@surety/db/lib/date-utils";
import {
	BadgeCheck,
	Building2,
	Check,
	CircleSlash,
	CircleX,
	Clock,
	Copy,
	Loader2,
	Pencil,
	RotateCcw,
	ShieldCheck,
} from "lucide-react";
import { useState } from "react";
import { AttachmentSection } from "@/components/attachments/attachment-section";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
	categoryLabels,
	paymentFrequencyLabels,
	renderPolicyStatusBadges,
	renewalTypeLabels,
} from "@/lib/constants/policy";
import type { Beneficiary, PolicyDetail, PolicyStatus } from "@/lib/types/policy";
import { cn, getAvatarColor } from "@/lib/utils";
import { EditableInfoRow } from "./editable-info-row";
import { PlannedSurrenderDialog } from "./planned-surrender-dialog";
import { TerminationDialog, type TerminationTarget } from "./termination-dialog";

interface MetaColumnProps {
	policy: PolicyDetail;
	beneficiaries: Beneficiary[];
	members: { id: number; name: string }[];
	assets: { id: number; name: string }[];
	onPolicyUpdate?: () => void;
	/**
	 * Fires after a successful status transition (terminate /
	 * planned-surrender / reactivate). Caller is expected to refresh both
	 * policy and payments because terminate clears planned-surrender and
	 * payments visibility is derived from policy.terminatedAt.
	 */
	onTransitionSuccess?: () => void;
}

const categories = [
	{ value: "Life", label: "定期寿" },
	{ value: "WholeLife", label: "终身寿" },
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

// All status transitions go through the action buttons + dialogs in
// `<PolicyActions>`. BasicInfoSection no longer exposes status as an
// editable field. See docs/19-policy-status.md.
function isTerminalStatus(s: PolicyStatus): s is "Surrendered" | "Claimed" | "Lapsed" {
	return s === "Surrendered" || s === "Claimed" || s === "Lapsed";
}

function PersonRow({ name, label, icon }: { name: string; label: string; icon?: React.ReactNode }) {
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
		policyNumber: string;
		insurerName: string;
		category: string;
		subCategory: string;
		channel: string;
	};

	const [isEditing, setIsEditing] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [formData, setFormData] = useState<FormData>({
		productName: policy.productName,
		policyNumber: policy.policyNumber,
		insurerName: policy.insurerName,
		category: policy.category,
		subCategory: policy.subCategory ?? "",
		channel: policy.channel ?? "",
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
					policyNumber: formData.policyNumber,
					insurerName: formData.insurerName,
					category: formData.category,
					subCategory: formData.subCategory || null,
					channel: formData.channel || null,
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
			policyNumber: policy.policyNumber,
			insurerName: policy.insurerName,
			category: policy.category,
			subCategory: policy.subCategory ?? "",
			channel: policy.channel ?? "",
		});
		setIsEditing(false);
		setError(null);
	};

	return (
		<div className="group">
			<div className="flex items-center justify-between mb-2">
				<h3 className="text-sm font-medium text-muted-foreground">基本信息</h3>
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
					label="保单号"
					value={policy.policyNumber}
					editValue={formData.policyNumber}
					onEditChange={isEditing ? (v) => updateField("policyNumber", v) : undefined}
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
					value={
						<div className="flex flex-wrap items-center gap-1.5">
							{renderPolicyStatusBadges(policy).map((b) => (
								<Badge key={b.label} variant={b.variant}>
									{b.label}
								</Badge>
							))}
						</div>
					}
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
				<h3 className="text-sm font-medium text-muted-foreground">保障信息</h3>
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
				<h3 className="text-sm font-medium text-muted-foreground">缴费详情</h3>
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
					label="缴费年限"
					value={policy.paymentYears != null ? `${policy.paymentYears} 年` : null}
					type="number"
					editValue={formData.paymentYears}
					onEditChange={isEditing ? (v) => updateField("paymentYears", v) : undefined}
				/>
				<EditableInfoRow
					label="总期数"
					value={policy.totalPayments != null ? `${policy.totalPayments} 期` : null}
					type="number"
					editValue={formData.totalPayments}
					onEditChange={isEditing ? (v) => updateField("totalPayments", v) : undefined}
				/>
				<EditableInfoRow
					label="续保方式"
					value={
						policy.renewalType
							? (renewalTypeLabels[policy.renewalType] ?? policy.renewalType)
							: null
					}
					type="select"
					options={renewalTypes}
					editValue={formData.renewalType}
					onEditChange={isEditing ? (v) => updateField("renewalType", v) : undefined}
				/>
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
		guaranteedRenewalYears:
			policy.guaranteedRenewalYears != null ? String(policy.guaranteedRenewalYears) : "",
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
					guaranteedRenewalYears: formData.guaranteedRenewalYears
						? Number(formData.guaranteedRenewalYears)
						: null,
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
			guaranteedRenewalYears:
				policy.guaranteedRenewalYears != null ? String(policy.guaranteedRenewalYears) : "",
		});
		setIsEditing(false);
		setError(null);
	};

	return (
		<div className="group">
			<div className="flex items-center justify-between mb-2">
				<h3 className="text-sm font-medium text-muted-foreground">时间信息</h3>
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
				<EditableInfoRow
					label="到期日期"
					value={formatDateWithDays(policy.expiryDate)}
					type="date"
					editValue={formData.expiryDate}
					onEditChange={isEditing ? (v) => updateField("expiryDate", v) : undefined}
				/>
				<EditableInfoRow
					label="犹豫期截止"
					value={formatDateWithDays(policy.hesitationEndDate)}
					type="date"
					editValue={formData.hesitationEndDate}
					onEditChange={isEditing ? (v) => updateField("hesitationEndDate", v) : undefined}
				/>
				<EditableInfoRow
					label="等待期 (天)"
					value={policy.waitingDays != null ? `${policy.waitingDays} 天` : null}
					type="number"
					editValue={formData.waitingDays}
					onEditChange={isEditing ? (v) => updateField("waitingDays", v) : undefined}
				/>
				<EditableInfoRow
					label="保证续保 (年)"
					value={
						policy.guaranteedRenewalYears != null ? `${policy.guaranteedRenewalYears} 年` : null
					}
					type="number"
					editValue={formData.guaranteedRenewalYears}
					onEditChange={isEditing ? (v) => updateField("guaranteedRenewalYears", v) : undefined}
				/>
			</div>
			{error && <p className="text-xs text-destructive mt-2">{error}</p>}
		</div>
	);
}

// Person Info Section (editable)
function PersonInfoSection({
	policy,
	members,
	assets,
	onPolicyUpdate,
}: {
	policy: PolicyDetail;
	members: { id: number; name: string }[];
	assets: { id: number; name: string }[];
	onPolicyUpdate?: () => void;
}) {
	type FormData = {
		applicantId: string;
		insuredType: "Member" | "Asset";
		insuredMemberId: string;
		insuredAssetId: string;
	};

	const [isEditing, setIsEditing] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [formData, setFormData] = useState<FormData>({
		applicantId: String(policy.applicantId),
		insuredType: policy.insuredType as "Member" | "Asset",
		insuredMemberId: policy.insuredMemberId != null ? String(policy.insuredMemberId) : "",
		insuredAssetId: policy.insuredAssetId != null ? String(policy.insuredAssetId) : "",
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
					applicantId: formData.applicantId ? Number(formData.applicantId) : undefined,
					insuredType: formData.insuredType,
					insuredMemberId:
						formData.insuredType === "Member" &&
						formData.insuredMemberId &&
						formData.insuredMemberId !== "__none__"
							? Number(formData.insuredMemberId)
							: null,
					insuredAssetId:
						formData.insuredType === "Asset" && formData.insuredAssetId
							? Number(formData.insuredAssetId)
							: null,
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
			applicantId: String(policy.applicantId),
			insuredType: policy.insuredType as "Member" | "Asset",
			insuredMemberId: policy.insuredMemberId != null ? String(policy.insuredMemberId) : "",
			insuredAssetId: policy.insuredAssetId != null ? String(policy.insuredAssetId) : "",
		});
		setIsEditing(false);
		setError(null);
	};

	const baseMemberOptions = members.map((m) => ({ value: String(m.id), label: m.name }));
	const insuredMemberOptions = [{ value: "__none__", label: "未知/空白" }, ...baseMemberOptions];
	const assetOptions = assets.map((a) => ({ value: String(a.id), label: a.name }));

	// Disable Asset option when no assets exist
	const hasAssets = assets.length > 0;
	const insuredTypeOptions = [
		{ value: "Member", label: "人" },
		{ value: "Asset", label: hasAssets ? "财产" : "财产 (无可选资产)", disabled: !hasAssets },
	];

	return (
		<div className="group">
			<div className="flex items-center justify-between mb-2">
				<h3 className="text-sm font-medium text-muted-foreground">人员信息</h3>
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
				{isEditing ? (
					<>
						<EditableInfoRow
							label="被保类型"
							value={formData.insuredType === "Member" ? "人" : "财产"}
							type="select"
							options={insuredTypeOptions}
							editValue={formData.insuredType}
							onEditChange={(v) => updateField("insuredType", v as "Member" | "Asset")}
						/>
						{formData.insuredType === "Member" ? (
							<EditableInfoRow
								label="被保人"
								value={policy.insuredName}
								type="select"
								options={insuredMemberOptions}
								editValue={formData.insuredMemberId}
								onEditChange={(v) => updateField("insuredMemberId", v)}
							/>
						) : (
							assetOptions.length > 0 && (
								<EditableInfoRow
									label="保障标的"
									value={policy.insuredAssetName}
									type="select"
									options={assetOptions}
									editValue={formData.insuredAssetId}
									onEditChange={(v) => updateField("insuredAssetId", v)}
								/>
							)
						)}
						<EditableInfoRow
							label="投保人"
							value={policy.applicantName ?? "未知"}
							type="select"
							options={baseMemberOptions}
							editValue={formData.applicantId}
							onEditChange={(v) => updateField("applicantId", v)}
						/>
					</>
				) : (
					<>
						<PersonRow name={policy.insuredName} label="被保人" />
						{policy.applicantName && <PersonRow name={policy.applicantName} label="投保人" />}
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
					</>
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

	return (
		<div className="group">
			<div className="flex items-center justify-between mb-2">
				<h3 className="text-sm font-medium text-muted-foreground">备注</h3>
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
			) : policy.notes ? (
				<p className="text-sm whitespace-pre-wrap">{policy.notes}</p>
			) : (
				<p className="text-sm text-muted-foreground/50">—</p>
			)}
		</div>
	);
}

/**
 * Status-transition action area, rendered between the policy header and
 * the editable sections in MetaColumn. Layout depends on DB status:
 *
 *   - Active or display-Expired (DB Active, just past expiry) — three
 *     terminate buttons (退保 / 理赔结案 / 标记失效) plus a planned-
 *     surrender link/edit-link.
 *   - Terminal (Surrendered / Claimed / Lapsed) — "修改终止信息" reuses
 *     the same TerminationDialog with prefilled values, and "恢复 Active"
 *     opens an AlertDialog confirm before PUTing `{status:"Active"}`.
 *
 * All transitions invoke `onSuccess` after the API call succeeds so the
 * caller can refresh policy + payments.
 */
function PolicyActions({ policy, onSuccess }: { policy: PolicyDetail; onSuccess: () => void }) {
	const [termDialogTarget, setTermDialogTarget] = useState<TerminationTarget | null>(null);
	const [plannedOpen, setPlannedOpen] = useState(false);
	const [reactivateOpen, setReactivateOpen] = useState(false);
	const [reactivating, setReactivating] = useState(false);
	const [reactivateError, setReactivateError] = useState<string | null>(null);

	const dbStatusIsTerminal = isTerminalStatus(policy.status);

	async function handleReactivate() {
		setReactivating(true);
		setReactivateError(null);
		try {
			const res = await fetch(`/api/policies/${policy.id}`, {
				method: "PUT",
				credentials: "include",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ status: "Active" }),
			});
			if (!res.ok) {
				const body = await res.json().catch(() => null);
				setReactivateError((body as { error?: string } | null)?.error ?? "恢复失败");
				return;
			}
			setReactivateOpen(false);
			onSuccess();
		} catch {
			setReactivateError("网络错误，请重试");
		} finally {
			setReactivating(false);
		}
	}

	return (
		<>
			<div className="flex flex-wrap items-center gap-2">
				{!dbStatusIsTerminal ? (
					<>
						<Button variant="outline" size="sm" onClick={() => setTermDialogTarget("Surrendered")}>
							<CircleSlash className="size-3.5" />
							退保
						</Button>
						<Button variant="outline" size="sm" onClick={() => setTermDialogTarget("Claimed")}>
							<BadgeCheck className="size-3.5" />
							理赔结案
						</Button>
						<Button variant="destructive" size="sm" onClick={() => setTermDialogTarget("Lapsed")}>
							<CircleX className="size-3.5" />
							标记失效
						</Button>
						<Button
							variant="link"
							size="sm"
							className="text-[hsl(var(--badge-red))] hover:text-[hsl(var(--badge-red))]"
							onClick={() => setPlannedOpen(true)}
						>
							<Clock className="size-3.5" />
							{policy.plannedSurrenderAt ? "编辑拟退保" : "标记拟退保"}
						</Button>
					</>
				) : (
					<>
						<Button
							variant="outline"
							size="sm"
							onClick={() => setTermDialogTarget(policy.status as TerminationTarget)}
						>
							<Pencil className="size-3.5" />
							修改终止信息
						</Button>
						<Button variant="outline" size="sm" onClick={() => setReactivateOpen(true)}>
							<RotateCcw className="size-3.5" />
							恢复 Active
						</Button>
					</>
				)}
			</div>

			{termDialogTarget !== null && (
				<TerminationDialog
					policy={policy}
					open
					targetStatus={termDialogTarget}
					onOpenChange={(open) => {
						if (!open) setTermDialogTarget(null);
					}}
					onSuccess={onSuccess}
				/>
			)}

			<PlannedSurrenderDialog
				policy={policy}
				open={plannedOpen}
				onOpenChange={setPlannedOpen}
				onSuccess={onSuccess}
			/>

			<AlertDialog open={reactivateOpen} onOpenChange={setReactivateOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>恢复为 Active？</AlertDialogTitle>
						<AlertDialogDescription>
							将把保单状态恢复为 Active，并清空终止日期 / 终止原因 / 拟退保标记。
							终止期间隐藏的未来未缴费用会重新可见。该操作可再次终止保单撤回。
						</AlertDialogDescription>
					</AlertDialogHeader>
					{reactivateError && (
						<p className="text-sm text-destructive" role="alert">
							{reactivateError}
						</p>
					)}
					<AlertDialogFooter>
						<AlertDialogCancel disabled={reactivating}>取消</AlertDialogCancel>
						<AlertDialogAction
							onClick={(e) => {
								e.preventDefault();
								void handleReactivate();
							}}
							disabled={reactivating}
						>
							恢复
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}

export function MetaColumn({
	policy,
	beneficiaries,
	members,
	assets,
	onPolicyUpdate,
	onTransitionSuccess,
}: MetaColumnProps) {
	const [copied, setCopied] = useState(false);

	const handleCopy = async () => {
		await navigator.clipboard.writeText(policy.policyNumber);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	const statusBadges = renderPolicyStatusBadges(policy);

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="space-y-2">
				<div className="flex items-center gap-2">
					<ShieldCheck className="size-5 text-primary shrink-0" />
					<h2 className="text-lg font-semibold leading-tight">{policy.productName}</h2>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					{statusBadges.map((b) => (
						<Badge key={b.label} variant={b.variant}>
							{b.label}
						</Badge>
					))}
					<span className="text-sm text-muted-foreground">{policy.policyNumber}</span>
					<button
						type="button"
						onClick={handleCopy}
						className="text-muted-foreground hover:text-foreground transition-colors"
						title="复制保单号"
					>
						{copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
					</button>
				</div>
			</div>

			{onTransitionSuccess && <PolicyActions policy={policy} onSuccess={onTransitionSuccess} />}

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
			<PersonInfoSection
				policy={policy}
				members={members}
				assets={assets}
				{...(onPolicyUpdate && { onPolicyUpdate })}
			/>

			{/* 受益人 */}
			{beneficiaries.length > 0 && (
				<>
					<Separator />
					<div>
						<h3 className="text-sm font-medium text-muted-foreground mb-2">受益人</h3>
						<div className="space-y-2">
							{beneficiaries.map((b) => (
								<div key={b.id} className="flex items-center justify-between text-sm">
									<div className="flex items-center gap-2">
										<Avatar size="sm">
											<AvatarFallback className={cn(getAvatarColor(b.name), "text-white")}>
												{b.name[0]}
											</AvatarFallback>
										</Avatar>
										<span className="font-medium">{b.name}</span>
										<Badge variant="outline" className="text-xs px-1.5 py-0">
											{b.rankOrder}序
										</Badge>
									</div>
									<span className="text-muted-foreground">{b.sharePercent}%</span>
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

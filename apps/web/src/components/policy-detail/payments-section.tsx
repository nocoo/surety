
import { useState } from "react";
import {
  Plus,
  Trash2,
  Wand2,
  Check,
  X,
  Pencil,
  Banknote,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { todayStr } from "@surety/db/lib/date-utils";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { formatCurrencyFull } from "@surety/api/lib/format";
import { isObsoletedByTermination } from "@surety/db/types";
import type { Payment, PolicyStatus } from "@/lib/types/policy";

interface PaymentsSectionProps {
  policyId: number;
  payments: Payment[];
  paymentFrequency: string;
  /** Display status — used to decide whether write entries are visible. */
  policyStatus: PolicyStatus;
  /** ISO terminated date or null. Drives the obsoleted-rows filter. */
  policyTerminatedAt: string | null;
  onPaymentsChange: (payments: Payment[]) => void;
}

function isTerminalDisplayStatus(s: PolicyStatus): boolean {
  return s === "Surrendered" || s === "Claimed" || s === "Lapsed";
}

interface PaymentFormData {
  periodNumber: string;
  dueDate: string;
  amount: string;
  status: "Pending" | "Paid" | "Overdue";
  paidDate: string;
  // Track the original status to preserve Overdue when editing
  originalStatus: "Pending" | "Paid" | "Overdue" | undefined;
}

const today = () => todayStr();

const emptyPaymentForm: PaymentFormData = {
  periodNumber: "",
  dueDate: "",
  amount: "",
  status: "Pending",
  paidDate: today(),
  originalStatus: undefined,
};

function paymentToForm(p: Payment): PaymentFormData {
  return {
    periodNumber: String(p.periodNumber),
    dueDate: p.dueDate,
    amount: String(p.amount),
    // Keep original status for display, but map to Pending for form interaction
    // (UI only shows Pending/Paid options, but we preserve Overdue when submitting)
    status: p.status === "Overdue" ? "Pending" : p.status,
    paidDate: p.paidDate ?? today(),
    originalStatus: p.status,
  };
}

/**
 * Terminated-state edit: force the form into the Paid back-fill path so
 * the only thing the user can submit is the back-fill payload the API
 * accepts (`{status:"Paid", paidDate?, paidAmount?}`).
 *
 * Even though we visually disable the structural inputs, mirroring the
 * existing values here keeps the form valid for the legacy validators
 * (canSave needs non-empty periodNumber/dueDate/amount).
 */
export function paymentToFormForTerminatedEdit(p: Payment): PaymentFormData {
  return {
    periodNumber: String(p.periodNumber),
    dueDate: p.dueDate,
    amount: String(p.amount),
    status: "Paid",
    paidDate: p.paidDate ?? today(),
    originalStatus: p.status,
  };
}

/**
 * Build the PUT body for `/api/policies/:id/payments/:paymentId`.
 *
 * Pure derivation surfaced for unit testing. When the policy is in a
 * terminal state, the body is restricted to the API-accepted shape
 * `{status:"Paid", paidDate, paidAmount}` — no structural fields. When
 * the policy is active, the legacy structural body is preserved so
 * edits to dueDate / amount / periodNumber still flow through. The
 * Pending→Overdue preservation rule for active rows lives here too.
 */
export function buildPaymentUpdatePayload(
  form: PaymentFormData,
  ctx: { isTerminated: boolean; originalAmount: number },
): Record<string, unknown> {
  if (ctx.isTerminated) {
    return {
      status: "Paid",
      paidDate: form.paidDate || today(),
      paidAmount: Number(form.amount) > 0 ? Number(form.amount) : ctx.originalAmount,
    };
  }

  let submitStatus: "Pending" | "Paid" | "Overdue" = form.status;
  if (form.status === "Pending" && form.originalStatus === "Overdue") {
    submitStatus = "Overdue";
  }

  const body: Record<string, unknown> = {
    periodNumber: Number(form.periodNumber),
    dueDate: form.dueDate,
    amount: Number(form.amount),
    status: submitStatus,
  };
  if (form.status === "Paid") {
    body.paidDate = form.paidDate || today();
    body.paidAmount = Number(form.amount);
  } else {
    body.paidDate = null;
    body.paidAmount = null;
  }
  return body;
}

// ---------------------------------------------------------------------------
// Inline form (shared between add & edit)
// ---------------------------------------------------------------------------

function PaymentForm({
  form,
  onChange,
  onSave,
  onCancel,
  saving,
  saveLabel,
  paidOnly = false,
}: {
  form: PaymentFormData;
  onChange: (f: PaymentFormData) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  saveLabel: string;
  /**
   * When true the status select offers only "已缴" — used in the
   * terminated-policy back-fill flow where the API rejects anything
   * other than `{status: "Paid", paidDate?, paidAmount?}`.
   */
  paidOnly?: boolean;
}) {
  const update = (field: keyof PaymentFormData, value: string) =>
    onChange({ ...form, [field]: value });

  const canSave =
    form.periodNumber && form.dueDate && form.amount && Number(form.amount) > 0;

  return (
    <div className="space-y-3 rounded-lg border bg-background p-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">期数 *</Label>
          <Input
            type="number"
            placeholder="1"
            value={form.periodNumber}
            onChange={(e) => update("periodNumber", e.target.value)}
            className="h-8 text-sm"
            disabled={paidOnly}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">应缴日期 *</Label>
          <Input
            type="date"
            value={form.dueDate}
            onChange={(e) => update("dueDate", e.target.value)}
            className="h-8 text-sm"
            disabled={paidOnly}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">金额 *</Label>
          <Input
            type="number"
            placeholder="5000"
            value={form.amount}
            onChange={(e) => update("amount", e.target.value)}
            className="h-8 text-sm"
            disabled={paidOnly}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">状态</Label>
          <Select
            value={form.status}
            onValueChange={(v) =>
              onChange({ ...form, status: v as "Pending" | "Paid" })
            }
          >
            <SelectTrigger className="h-8 w-full text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {!paidOnly && <SelectItem value="Pending">待缴</SelectItem>}
              <SelectItem value="Paid">已缴</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {form.status === "Paid" && (
        <div className="space-y-1.5">
          <Label className="text-xs">实缴日期</Label>
          <Input
            type="date"
            value={form.paidDate}
            onChange={(e) => update("paidDate", e.target.value)}
            className="h-8 text-sm"
          />
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={saving}
        >
          <X className="mr-1 size-3.5" />
          取消
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={onSave}
          disabled={saving || !canSave}
        >
          <Check className="mr-1 size-3.5" />
          {saving ? "保存中..." : saveLabel}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status badge helper
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: Payment["status"] }) {
  switch (status) {
    case "Paid":
      return <Badge variant="success">已缴</Badge>;
    case "Overdue":
      return <Badge variant="destructive">逾期</Badge>;
    default:
      return <Badge variant="outline">待缴</Badge>;
  }
}

// ---------------------------------------------------------------------------
// Main section
// ---------------------------------------------------------------------------

export function PaymentsSection({
  policyId,
  payments,
  paymentFrequency,
  policyStatus,
  policyTerminatedAt,
  onPaymentsChange,
}: PaymentsSectionProps) {
  const [addingForm, setAddingForm] = useState<PaymentFormData | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generateConfirmOpen, setGenerateConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [markingPaid, setMarkingPaid] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingForm, setEditingForm] = useState<PaymentFormData>(emptyPaymentForm);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [obsoletedExpanded, setObsoletedExpanded] = useState(false);

  // Partition the row list: `live` rows render normally and feed all
  // counts / totals; `obsoleted` rows fall into a collapsible bucket at
  // the bottom. `isObsoletedByTermination` keeps Paid rows in `live` even
  // if their dueDate is after terminatedAt.
  const liveRows = payments.filter(
    (p) => !isObsoletedByTermination(p, policyTerminatedAt),
  );
  const obsoletedRows = payments.filter((p) =>
    isObsoletedByTermination(p, policyTerminatedAt),
  );
  const sortedLive = [...liveRows].sort(
    (a, b) => a.periodNumber - b.periodNumber,
  );
  const sortedObsoleted = [...obsoletedRows].sort(
    (a, b) => a.periodNumber - b.periodNumber,
  );

  const isTerminated = isTerminalDisplayStatus(policyStatus);

  // --- summary (live rows only) ---
  const paidCount = liveRows.filter((p) => p.status === "Paid").length;
  const totalCount = liveRows.length;
  const paidAmount = liveRows
    .filter((p) => p.status === "Paid")
    .reduce((sum, p) => sum + (p.paidAmount ?? p.amount), 0);
  const totalAmount = liveRows.reduce((sum, p) => sum + p.amount, 0);

  // --- mutual exclusion ---
  const startAdd = () => {
    setAddingForm({ ...emptyPaymentForm });
    setEditingId(null);
  };
  const startEdit = (payment: Payment) => {
    setEditingId(payment.id);
    setEditingForm(
      isTerminated
        ? paymentToFormForTerminatedEdit(payment)
        : paymentToForm(payment),
    );
    setAddingForm(null);
  };

  // --- handlers ---
  const handleAdd = async () => {
    if (!addingForm) return;
    setSaving(true);
    setResultMessage(null);
    try {
      const body: Record<string, unknown> = {
        periodNumber: Number(addingForm.periodNumber),
        dueDate: addingForm.dueDate,
        amount: Number(addingForm.amount),
        status: addingForm.status,
      };
      if (addingForm.status === "Paid") {
        body.paidDate = addingForm.paidDate || today();
        body.paidAmount = Number(addingForm.amount);
      }
      const res = await fetch(`/api/policies/${policyId}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const created = (await res.json()) as Payment;
        onPaymentsChange([...payments, created]);
        setAddingForm(null);
      } else {
        const err = await res.json().catch(() => null);
        setResultMessage(
          (err as { error?: string } | null)?.error ??
            `添加失败 (${res.status})`,
        );
      }
    } catch {
      setResultMessage("网络错误，请重试");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (editingId === null) return;
    setSaving(true);
    setResultMessage(null);
    try {
      const original = payments.find((p) => p.id === editingId);
      const body = buildPaymentUpdatePayload(editingForm, {
        isTerminated,
        originalAmount: original?.amount ?? Number(editingForm.amount),
      });
      const res = await fetch(
        `/api/policies/${policyId}/payments/${editingId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (res.ok) {
        const updated = (await res.json()) as Payment;
        onPaymentsChange(
          payments.map((p) => (p.id === editingId ? updated : p)),
        );
        setEditingId(null);
      } else {
        const err = await res.json().catch(() => null);
        setResultMessage(
          (err as { error?: string } | null)?.error ??
            `修改失败 (${res.status})`,
        );
      }
    } catch {
      setResultMessage("修改失败，请重试");
    } finally {
      setSaving(false);
    }
  };

  const handleMarkPaid = async (payment: Payment) => {
    setMarkingPaid(payment.id);
    setResultMessage(null);
    try {
      const res = await fetch(
        `/api/policies/${policyId}/payments/${payment.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "Paid",
            paidDate: today(),
            paidAmount: payment.amount,
          }),
        },
      );
      if (res.ok) {
        const updated = (await res.json()) as Payment;
        onPaymentsChange(
          payments.map((p) => (p.id === payment.id ? updated : p)),
        );
      } else {
        const err = await res.json().catch(() => null);
        setResultMessage(
          (err as { error?: string } | null)?.error ??
            `标记失败 (${res.status})`,
        );
      }
    } catch {
      setResultMessage("标记失败，请重试");
    } finally {
      setMarkingPaid(null);
    }
  };

  const handleDelete = async (paymentId: number) => {
    setResultMessage(null);
    try {
      const res = await fetch(
        `/api/policies/${policyId}/payments/${paymentId}`,
        { method: "DELETE" },
      );
      if (res.ok) {
        onPaymentsChange(payments.filter((p) => p.id !== paymentId));
      } else {
        const err = await res.json().catch(() => null);
        setResultMessage(
          (err as { error?: string } | null)?.error ??
            `删除失败 (${res.status})`,
        );
      }
    } catch {
      setResultMessage("删除失败，请重试");
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setResultMessage(null);
    try {
      const res = await fetch(
        `/api/policies/${policyId}/payments/generate`,
        { method: "POST" },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setResultMessage(
          (body as { error?: string } | null)?.error ??
            `生成失败 (${res.status})`,
        );
        return;
      }
      const data = (await res.json()) as {
        generated: number;
        payments: Payment[];
      };
      onPaymentsChange(data.payments);
      setResultMessage(`成功生成 ${data.generated} 条缴费记录`);
    } catch {
      setResultMessage("网络错误，请重试");
    } finally {
      setGenerating(false);
      setGenerateConfirmOpen(false);
    }
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">
          <Banknote className="mr-1.5 inline size-4 align-text-bottom" />
          缴费记录
          {liveRows.length > 0 && (
            <Badge variant="secondary" className="ml-2 text-xs">
              {liveRows.length}
            </Badge>
          )}
        </h3>
        <div className="flex gap-2">
          {!isTerminated && paymentFrequency !== "Single" && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={generating}
              onClick={() => {
                setResultMessage(null);
                setGenerateConfirmOpen(true);
              }}
            >
              <Wand2 className="mr-1 size-3.5" />
              生成缴费记录
            </Button>
          )}
          {!isTerminated && !addingForm && editingId === null && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={startAdd}
            >
              <Plus className="mr-1 size-3.5" />
              手动添加
            </Button>
          )}
        </div>
      </div>

      {/* Summary bar — counts/totals ignore obsoleted rows. */}
      {liveRows.length > 0 && (
        <div className="mb-3 rounded-lg bg-muted/30 px-3 py-2 text-sm">
          已缴{" "}
          <span className="font-medium">
            {paidCount} / {totalCount}
          </span>{" "}
          期 &mdash;{" "}
          <span className="font-medium">{formatCurrencyFull(paidAmount)}</span>{" "}
          / {formatCurrencyFull(totalAmount)}
        </div>
      )}

      {/* Result message */}
      {resultMessage && (
        <p
          className={cn(
            "mb-2 text-sm",
            resultMessage.startsWith("成功")
              ? "text-success-text"
              : "text-destructive-text",
          )}
        >
          {resultMessage}
        </p>
      )}

      {/* Payment list (live rows). Obsoleted rows render in a separate
          collapsible section below so terminal-state users still see the
          history but don't mistake those rows for current obligations. */}
      {sortedLive.length > 0 && (
        <div className="space-y-3">
          {sortedLive.map((p) => (
            <div key={p.id}>
              {editingId === p.id ? (
                <PaymentForm
                  form={editingForm}
                  onChange={setEditingForm}
                  onSave={handleUpdate}
                  onCancel={() => setEditingId(null)}
                  saving={saving}
                  saveLabel="保存"
                  paidOnly={isTerminated}
                />
              ) : (
                <div className="group rounded-lg bg-muted/30 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">
                      第{p.periodNumber}期
                      <span className="ml-2">
                        <StatusBadge status={p.status} />
                      </span>
                    </span>
                    <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-6"
                        onClick={() => startEdit(p)}
                      >
                        <Pencil className="size-3" />
                      </Button>
                      {!isTerminated && p.status !== "Paid" && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-6"
                          disabled={markingPaid === p.id}
                          onClick={() => void handleMarkPaid(p)}
                          title="标记已缴"
                        >
                          <Check className="size-3" />
                        </Button>
                      )}
                      {!isTerminated && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-6 text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(p.id)}
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="mt-1 space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">应缴日期</span>
                      <span className="font-mono">{p.dueDate}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">金额</span>
                      <span>{formatCurrencyFull(p.amount)}</span>
                    </div>
                    {p.status === "Paid" && p.paidDate && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">实缴日期</span>
                        <span className="font-mono">{p.paidDate}</span>
                      </div>
                    )}
                    {p.status === "Paid" && p.paidAmount != null && p.paidAmount !== p.amount && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">实缴金额</span>
                        <span>{formatCurrencyFull(p.paidAmount)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Obsoleted rows — collapsed by default, dimmed with line-through
          when expanded so users can verify the row exists without
          confusing it with an active obligation. */}
      {sortedObsoleted.length > 0 && (
        <div className="mt-3">
          <Collapsible open={obsoletedExpanded} onOpenChange={setObsoletedExpanded}>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex w-full items-center gap-1.5 rounded-lg bg-muted/30 px-3 py-2 text-sm text-muted-foreground hover:bg-muted/50"
              >
                {obsoletedExpanded ? (
                  <ChevronDown className="size-3.5" />
                ) : (
                  <ChevronRight className="size-3.5" />
                )}
                <span>{sortedObsoleted.length} 笔已随终止失效</span>
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-2">
              {sortedObsoleted.map((p) => (
                <div
                  key={p.id}
                  className="rounded-lg bg-muted/30 p-3 text-sm line-through text-muted-foreground"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">
                      第{p.periodNumber}期
                      <span className="ml-2">
                        <StatusBadge status={p.status} />
                      </span>
                    </span>
                  </div>
                  <div className="mt-1 space-y-1">
                    <div className="flex justify-between">
                      <span>应缴日期</span>
                      <span className="font-mono">{p.dueDate}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>金额</span>
                      <span>{formatCurrencyFull(p.amount)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>
        </div>
      )}

      {/* Empty state */}
      {sortedLive.length === 0 && sortedObsoleted.length === 0 && !addingForm && (
        <div className="rounded-lg bg-muted/30 p-4 text-center">
          <p className="text-sm text-muted-foreground">暂无缴费记录</p>
        </div>
      )}

      {/* Add form */}
      {addingForm && (
        <div className={cn(sortedLive.length > 0 && "mt-3")}>
          <PaymentForm
            form={addingForm}
            onChange={setAddingForm}
            onSave={handleAdd}
            onCancel={() => setAddingForm(null)}
            saving={saving}
            saveLabel="添加"
          />
        </div>
      )}

      {/* Generate confirmation */}
      <AlertDialog
        open={generateConfirmOpen}
        onOpenChange={setGenerateConfirmOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>生成缴费记录</AlertDialogTitle>
            <AlertDialogDescription>
              将按保单的缴费周期和总期数，补齐到今年底为止应缴的所有期数（含今年内尚未到期的），全部标记为&ldquo;待缴&rdquo;。已有期数不会被修改或重复。是否继续？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={generating}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleGenerate}
              disabled={generating}
            >
              {generating ? "生成中..." : "确认生成"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirmation */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>删除缴费记录</AlertDialogTitle>
            <AlertDialogDescription>
              确定删除该缴费记录吗？此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (deleteTarget !== null) void handleDelete(deleteTarget);
              }}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}


import { useState } from "react";
import { Plus, Trash2, Wand2, Check, X, Pencil, Banknote } from "lucide-react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { formatCurrencyFull } from "@surety/api/lib/format";
import type { Payment } from "@/lib/types/policy";

interface PaymentsSectionProps {
  policyId: number;
  payments: Payment[];
  paymentFrequency: string;
  onPaymentsChange: (payments: Payment[]) => void;
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
}: {
  form: PaymentFormData;
  onChange: (f: PaymentFormData) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  saveLabel: string;
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
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">应缴日期 *</Label>
          <Input
            type="date"
            value={form.dueDate}
            onChange={(e) => update("dueDate", e.target.value)}
            className="h-8 text-sm"
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
              <SelectItem value="Pending">待缴</SelectItem>
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

  const sorted = [...payments].sort(
    (a, b) => a.periodNumber - b.periodNumber,
  );

  // --- summary ---
  const paidCount = payments.filter((p) => p.status === "Paid").length;
  const totalCount = payments.length;
  const paidAmount = payments
    .filter((p) => p.status === "Paid")
    .reduce((sum, p) => sum + (p.paidAmount ?? p.amount), 0);
  const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);

  // --- mutual exclusion ---
  const startAdd = () => {
    setAddingForm({ ...emptyPaymentForm });
    setEditingId(null);
  };
  const startEdit = (payment: Payment) => {
    setEditingId(payment.id);
    setEditingForm(paymentToForm(payment));
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
      // Determine the status to submit:
      // - If user changed to Paid, use Paid
      // - If user kept as Pending but original was Overdue, preserve Overdue
      // - Otherwise use the form status
      let submitStatus: "Pending" | "Paid" | "Overdue" = editingForm.status;
      if (editingForm.status === "Pending" && editingForm.originalStatus === "Overdue") {
        submitStatus = "Overdue";
      }

      const body: Record<string, unknown> = {
        periodNumber: Number(editingForm.periodNumber),
        dueDate: editingForm.dueDate,
        amount: Number(editingForm.amount),
        status: submitStatus,
      };
      if (editingForm.status === "Paid") {
        body.paidDate = editingForm.paidDate || today();
        body.paidAmount = Number(editingForm.amount);
      } else {
        body.paidDate = null;
        body.paidAmount = null;
      }
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
          {payments.length > 0 && (
            <Badge variant="secondary" className="ml-2 text-xs">
              {payments.length}
            </Badge>
          )}
        </h3>
        <div className="flex gap-2">
          {paymentFrequency !== "Single" && (
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
          {!addingForm && editingId === null && (
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

      {/* Summary bar */}
      {payments.length > 0 && (
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
              ? "text-success"
              : "text-destructive",
          )}
        >
          {resultMessage}
        </p>
      )}

      {/* Payment list */}
      {sorted.length > 0 && (
        <div className="space-y-3">
          {sorted.map((p) => (
            <div key={p.id}>
              {editingId === p.id ? (
                <PaymentForm
                  form={editingForm}
                  onChange={setEditingForm}
                  onSave={handleUpdate}
                  onCancel={() => setEditingId(null)}
                  saving={saving}
                  saveLabel="保存"
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
                      {p.status !== "Paid" && (
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
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-6 text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget(p.id)}
                      >
                        <Trash2 className="size-3" />
                      </Button>
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

      {/* Empty state */}
      {sorted.length === 0 && !addingForm && (
        <div className="rounded-lg bg-muted/30 p-4 text-center">
          <p className="text-sm text-muted-foreground">暂无缴费记录</p>
        </div>
      )}

      {/* Add form */}
      {addingForm && (
        <div className={cn(sorted.length > 0 && "mt-3")}>
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
              将根据保单信息自动生成所有缴费记录（含未来期数）。已缴期标记为&ldquo;已缴&rdquo;，未来期标记为&ldquo;待缴&rdquo;。已有记录不会重复。是否继续？
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

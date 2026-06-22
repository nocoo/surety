import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  formatLocalDate,
  parseLocalDate,
  todayInTimeZone,
} from "@surety/db/lib/date-utils";
import type { PolicyDetail } from "@/lib/types/policy";

export type TerminationTarget = "Surrendered" | "Claimed" | "Lapsed";

interface TerminationDialogProps {
  policy: PolicyDetail;
  open: boolean;
  targetStatus: TerminationTarget;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const TITLE_BY_TARGET: Record<TerminationTarget, string> = {
  Surrendered: "退保",
  Claimed: "理赔结案",
  Lapsed: "标记失效",
};

const MAX_REASON_LEN = 500;

export function isValidIsoDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return formatLocalDate(parseLocalDate(s)) === s;
}

/**
 * Pure validator surfaced for unit testing. Returns null on success, or a
 * Chinese error label suitable for inline display. Mirrors the server-side
 * checks in `apps/worker/src/routes/policies.ts` POST /terminate so the
 * client surfaces the same boundaries the API would reject.
 */
export function validateTerminationForm(input: {
  terminatedAt: string;
  terminationReason: string;
  effectiveDate: string;
  today: string;
}): string | null {
  if (!input.terminatedAt) return "请填写终止日期";
  if (!isValidIsoDate(input.terminatedAt)) return "终止日期格式不正确";
  if (input.terminatedAt < input.effectiveDate) {
    return "终止日期不能早于保单生效日";
  }
  if (input.terminatedAt > input.today) {
    return "终止日期不能晚于今天";
  }
  if (input.terminationReason.length > MAX_REASON_LEN) {
    return `终止原因不能超过 ${MAX_REASON_LEN} 字`;
  }
  return null;
}

export function buildTerminationPayload(input: {
  targetStatus: TerminationTarget;
  terminatedAt: string;
  terminationReason: string;
}): {
  status: TerminationTarget;
  terminatedAt: string;
  terminationReason?: string;
} {
  const payload: ReturnType<typeof buildTerminationPayload> = {
    status: input.targetStatus,
    terminatedAt: input.terminatedAt,
  };
  if (input.terminationReason.length > 0) {
    payload.terminationReason = input.terminationReason;
  }
  return payload;
}

/**
 * Produce the initial form state for the termination dialog. Legacy rows
 * (terminal status + null `terminatedAt`) must NOT auto-fill today —
 * forcing the user to type the date keeps the backfill explicit. A row
 * that already carries a `terminatedAt` is being edited; reuse the value.
 */
export function getInitialTerminationForm(
  policy: { terminatedAt: string | null; terminationReason: string | null },
): { terminatedAt: string; terminationReason: string } {
  return {
    terminatedAt: policy.terminatedAt ?? "",
    terminationReason: policy.terminationReason ?? "",
  };
}

export function TerminationDialog({
  policy,
  open,
  targetStatus,
  onOpenChange,
  onSuccess,
}: TerminationDialogProps) {
  const today = todayInTimeZone();
  // Prefill from existing termination metadata when the user re-opens the
  // dialog on an already-terminated row. Legacy rows (terminal status but
  // null terminatedAt) intentionally leave the date blank so the user must
  // type it — auto-filling today would silently rewrite history.
  const initial = getInitialTerminationForm(policy);
  const [terminatedAt, setTerminatedAt] = useState(initial.terminatedAt);
  const [terminationReason, setTerminationReason] = useState(
    initial.terminationReason,
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Re-sync local state whenever the dialog is (re)opened against a different
  // policy or after a successful submission resets the parent's state.
  useEffect(() => {
    if (open) {
      const next = getInitialTerminationForm(policy);
      setTerminatedAt(next.terminatedAt);
      setTerminationReason(next.terminationReason);
      setError(null);
    }
  }, [open, policy]);

  const title = `${TITLE_BY_TARGET[targetStatus]} - ${policy.productName}`;

  async function handleConfirm() {
    const validationError = validateTerminationForm({
      terminatedAt,
      terminationReason,
      effectiveDate: policy.effectiveDate,
      today,
    });
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/policies/${policy.id}/terminate`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          buildTerminationPayload({
            targetStatus,
            terminatedAt,
            terminationReason,
          }),
        ),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError((body as { error?: string } | null)?.error ?? "提交失败");
        return;
      }
      onOpenChange(false);
      onSuccess();
    } catch {
      setError("网络错误，请重试");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="terminated-at">终止日期</Label>
            <Input
              id="terminated-at"
              type="date"
              value={terminatedAt}
              min={policy.effectiveDate}
              max={today}
              onChange={(e) => setTerminatedAt(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="termination-reason">原因（可选）</Label>
            <Textarea
              id="termination-reason"
              value={terminationReason}
              maxLength={MAX_REASON_LEN}
              onChange={(e) => setTerminationReason(e.target.value)}
              placeholder={`最多 ${MAX_REASON_LEN} 字`}
            />
          </div>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            取消
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={submitting}
          >
            确认
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

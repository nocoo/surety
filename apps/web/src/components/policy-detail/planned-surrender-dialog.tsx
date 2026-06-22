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
} from "@surety/db/lib/date-utils";
import type { PolicyDetail } from "@/lib/types/policy";

interface PlannedSurrenderDialogProps {
  policy: PolicyDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const MAX_NOTE_LEN = 500;

export function isValidIsoDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return formatLocalDate(parseLocalDate(s)) === s;
}

/**
 * Pure validator surfaced for unit testing. Returns null on success, or a
 * Chinese error label suitable for inline display. Mirrors the server-side
 * checks in `apps/worker/src/routes/policies.ts` PUT /planned-surrender:
 * date is required, must round-trip ISO, must be on/after effectiveDate;
 * future dates are explicitly allowed; note is capped at 500 chars.
 */
export function validatePlannedSurrenderForm(input: {
  plannedSurrenderAt: string;
  plannedSurrenderNote: string;
  effectiveDate: string;
}): string | null {
  if (!input.plannedSurrenderAt) return "请填写拟退保日期";
  if (!isValidIsoDate(input.plannedSurrenderAt)) {
    return "拟退保日期格式不正确";
  }
  if (input.plannedSurrenderAt < input.effectiveDate) {
    return "拟退保日期不能早于保单生效日";
  }
  if (input.plannedSurrenderNote.length > MAX_NOTE_LEN) {
    return `备注不能超过 ${MAX_NOTE_LEN} 字`;
  }
  return null;
}

export function buildPlannedSurrenderPayload(input: {
  plannedSurrenderAt: string;
  plannedSurrenderNote: string;
}): { plannedSurrenderAt: string; plannedSurrenderNote: string | null } {
  return {
    plannedSurrenderAt: input.plannedSurrenderAt,
    plannedSurrenderNote:
      input.plannedSurrenderNote.length > 0
        ? input.plannedSurrenderNote
        : null,
  };
}

export function buildClearPlannedSurrenderPayload(): {
  plannedSurrenderAt: null;
  plannedSurrenderNote: null;
} {
  return { plannedSurrenderAt: null, plannedSurrenderNote: null };
}

export function PlannedSurrenderDialog({
  policy,
  open,
  onOpenChange,
  onSuccess,
}: PlannedSurrenderDialogProps) {
  const [plannedSurrenderAt, setPlannedSurrenderAt] = useState(
    policy.plannedSurrenderAt ?? "",
  );
  const [plannedSurrenderNote, setPlannedSurrenderNote] = useState(
    policy.plannedSurrenderNote ?? "",
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setPlannedSurrenderAt(policy.plannedSurrenderAt ?? "");
      setPlannedSurrenderNote(policy.plannedSurrenderNote ?? "");
      setError(null);
    }
  }, [open, policy.plannedSurrenderAt, policy.plannedSurrenderNote]);

  async function submit(payload: object) {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/policies/${policy.id}/planned-surrender`,
        {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError((body as { error?: string } | null)?.error ?? "提交失败");
        return false;
      }
      return true;
    } catch {
      setError("网络错误，请重试");
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSave() {
    const validationError = validatePlannedSurrenderForm({
      plannedSurrenderAt,
      plannedSurrenderNote,
      effectiveDate: policy.effectiveDate,
    });
    if (validationError) {
      setError(validationError);
      return;
    }
    const ok = await submit(
      buildPlannedSurrenderPayload({
        plannedSurrenderAt,
        plannedSurrenderNote,
      }),
    );
    if (ok) {
      onOpenChange(false);
      onSuccess();
    }
  }

  async function handleClear() {
    const ok = await submit(buildClearPlannedSurrenderPayload());
    if (ok) {
      onOpenChange(false);
      onSuccess();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>标记拟退保 - {policy.productName}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="planned-surrender-at">拟退保日期</Label>
            <Input
              id="planned-surrender-at"
              type="date"
              value={plannedSurrenderAt}
              min={policy.effectiveDate}
              onChange={(e) => setPlannedSurrenderAt(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="planned-surrender-note">备注（可选）</Label>
            <Textarea
              id="planned-surrender-note"
              value={plannedSurrenderNote}
              maxLength={MAX_NOTE_LEN}
              onChange={(e) => setPlannedSurrenderNote(e.target.value)}
              placeholder={`最多 ${MAX_NOTE_LEN} 字`}
            />
          </div>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>
        <DialogFooter className="sm:justify-between">
          <Button
            variant="ghost"
            onClick={handleClear}
            disabled={submitting || !policy.plannedSurrenderAt}
          >
            清除拟退保标记
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              取消
            </Button>
            <Button onClick={handleSave} disabled={submitting}>
              保存
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

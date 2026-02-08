"use client";

import { useState, useCallback } from "react";
import { Receipt } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Payment {
  id: number;
  periodNumber: number;
  dueDate: string;
  amount: number;
  status: "Pending" | "Paid" | "Overdue";
  paidDate: string | null;
}

interface PaymentsDialogProps {
  policyId: number | null;
  productName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function PaymentsDialog({ policyId, productName, open, onOpenChange }: PaymentsDialogProps) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadedPolicyId, setLoadedPolicyId] = useState<number | null>(null);

  const fetchPayments = useCallback(async (id: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/policies/${id}/payments`);
      if (res.ok) {
        const data = await res.json();
        setPayments(data);
      }
      setLoadedPolicyId(id);
    } catch {
      // Failed to load
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch when needed
  if (open && policyId && policyId !== loadedPolicyId && !loading) {
    fetchPayments(policyId);
  }

  // Reset when closed
  if (!open && loadedPolicyId !== null) {
    setPayments([]);
    setLoadedPolicyId(null);
  }

  if (!open) return null;

  // Calculate totals
  const totalPaid = payments
    .filter((p) => p.status === "Paid")
    .reduce((sum, p) => sum + p.amount, 0);
  const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            <span>缴费记录</span>
          </DialogTitle>
          <p className="text-sm text-muted-foreground">{productName}</p>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="text-muted-foreground">加载中...</div>
          </div>
        )}

        {!loading && payments.length === 0 && (
          <div className="flex items-center justify-center py-8">
            <div className="text-muted-foreground">暂无缴费记录</div>
          </div>
        )}

        {!loading && payments.length > 0 && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="text-sm">
                <span className="text-muted-foreground">已缴费</span>
                <span className="ml-2 font-medium">{payments.filter((p) => p.status === "Paid").length}</span>
                <span className="text-muted-foreground ml-1">/ {payments.length} 期</span>
              </div>
              <div className="text-sm font-medium">
                {formatCurrency(totalPaid)}
                {totalPaid < totalAmount && (
                  <span className="text-muted-foreground ml-1">/ {formatCurrency(totalAmount)}</span>
                )}
              </div>
            </div>

            {/* Payment List */}
            <div className="space-y-2">
              {payments.map((payment) => (
                <div
                  key={payment.id}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-lg border",
                    payment.status === "Paid" && "bg-success/5 border-success/20",
                    payment.status === "Pending" && "bg-muted/30",
                    payment.status === "Overdue" && "bg-destructive/5 border-destructive/20"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">第 {payment.periodNumber} 期</span>
                      <span className="text-xs text-muted-foreground font-mono">
                        {payment.status === "Paid" && payment.paidDate
                          ? `${payment.paidDate} 已缴`
                          : `${payment.dueDate} 到期`}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium">{formatCurrency(payment.amount)}</span>
                    <Badge
                      variant={
                        payment.status === "Paid"
                          ? "success"
                          : payment.status === "Overdue"
                          ? "destructive"
                          : "secondary"
                      }
                      className="w-12 justify-center"
                    >
                      {payment.status === "Paid" ? "已缴" : payment.status === "Overdue" ? "逾期" : "待缴"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

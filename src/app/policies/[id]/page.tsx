"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/layout";
import { PageLoading } from "@/components/page-loading";
import { Button } from "@/components/ui/button";
import { MetaColumn } from "@/components/policy-detail/meta-column";
import { TimelineColumn } from "@/components/policy-detail/timeline-column";
import { CoverageSection } from "@/components/policy-detail/coverage-section";
import { PaymentsSection } from "@/components/policy-detail/payments-section";
import { PolicyEditButton } from "@/components/policy-detail/policy-edit-dialog";
import type { PolicyDetail, CoverageItem, Beneficiary, Payment } from "@/lib/types/policy";

export default function PolicyDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const policyId = parseInt(params.id, 10);

  const [policy, setPolicy] = useState<PolicyDetail | null>(null);
  const [coverageItems, setCoverageItems] = useState<CoverageItem[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async (id: number) => {
    setLoading(true);
    setError(null);
    try {
      const [policyRes, coverageRes, paymentsRes, beneficiariesRes] = await Promise.all([
        fetch(`/api/policies/${id}`),
        fetch(`/api/policies/${id}/coverage-items`).catch(() => null),
        fetch(`/api/policies/${id}/payments`).catch(() => null),
        fetch(`/api/policies/${id}/beneficiaries`).catch(() => null),
      ]);

      if (!policyRes.ok) {
        setError(policyRes.status === 404 ? "保单不存在" : "加载失败");
        return;
      }

      const policyData = await policyRes.json();
      setPolicy(policyData);
      setCoverageItems(coverageRes?.ok ? await coverageRes.json() : []);
      setPayments(paymentsRes?.ok ? await paymentsRes.json() : []);
      setBeneficiaries(beneficiariesRes?.ok ? await beneficiariesRes.json() : []);
    } catch {
      setError("网络错误");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isNaN(policyId)) {
      void fetchAll(policyId);
    } else {
      setError("无效的保单 ID");
      setLoading(false);
    }
  }, [policyId, fetchAll]);

  const refreshCoverage = useCallback(async () => {
    const res = await fetch(`/api/policies/${policyId}/coverage-items`).catch(() => null);
    if (res?.ok) setCoverageItems(await res.json());
  }, [policyId]);

  const refreshPayments = useCallback(async () => {
    const res = await fetch(`/api/policies/${policyId}/payments`).catch(() => null);
    if (res?.ok) setPayments(await res.json());
  }, [policyId]);

  const refreshPolicy = useCallback(async () => {
    const res = await fetch(`/api/policies/${policyId}`);
    if (res?.ok) setPolicy(await res.json());
  }, [policyId]);

  if (loading) {
    return (
      <AppShell breadcrumbs={[{ label: "保单管理", href: "/policies" }, { label: "加载中..." }]}>
        <PageLoading />
      </AppShell>
    );
  }

  if (error || !policy) {
    return (
      <AppShell breadcrumbs={[{ label: "保单管理", href: "/policies" }, { label: "错误" }]}>
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <p className="text-muted-foreground">{error ?? "保单不存在"}</p>
          <Button variant="outline" onClick={() => router.push("/policies")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            返回保单列表
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell breadcrumbs={[{ label: "保单管理", href: "/policies" }, { label: policy.productName }]}>
      <div className="mb-4 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => router.push("/policies")}>
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          返回保单列表
        </Button>
        <PolicyEditButton
          policy={policy}
          onSuccess={() => {
            void refreshPolicy();
          }}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {/* Col 1: Meta */}
        <div className="rounded-xl border bg-card p-5">
          <MetaColumn policy={policy} beneficiaries={beneficiaries} />
        </div>

        {/* Col 2: Timeline */}
        <div className="rounded-xl border bg-card p-5">
          <TimelineColumn policy={policy} />
        </div>

        {/* Col 3: Coverage Items */}
        <div className="rounded-xl border bg-card p-5">
          <CoverageSection
            policyId={policy.id}
            items={coverageItems}
            onItemsChange={(items) => {
              setCoverageItems(items);
              void refreshCoverage();
            }}
          />
        </div>

        {/* Col 4: Payments */}
        <div className="rounded-xl border bg-card p-5">
          <PaymentsSection
            policyId={policy.id}
            payments={payments}
            paymentFrequency={policy.paymentFrequency}
            onPaymentsChange={(p) => {
              setPayments(p);
              void refreshPayments();
            }}
          />
        </div>
      </div>
    </AppShell>
  );
}


import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate, useLocation } from "react-router";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/layout";
import { PolicyDetailSkeleton } from "@/components/skeletons";
import { Button } from "@/components/ui/button";
import { MetaColumn } from "@/components/policy-detail/meta-column";
import { TimelineColumn } from "@/components/policy-detail/timeline-column";
import { CoverageSection } from "@/components/policy-detail/coverage-section";
import { PaymentsSection } from "@/components/policy-detail/payments-section";
import type { PolicyDetail, CoverageItem, Beneficiary, Payment } from "@/lib/types/policy";

/**
 * Optional referrer info attached to navigate(state) when the user
 * enters this page from a list/dialog that wants the back button to
 * round-trip them home (e.g. the renewal calendar's day-events dialog
 * passes { pathname, search, label: "返回续保日历" } so closing the
 * detail returns to the same open dialog).
 */
interface BackRef {
  pathname: string;
  search?: string;
  label: string;
}

export default function PolicyDetailPage() {
  const params = useParams<"id">();
  const navigate = useNavigate();
  const location = useLocation();
  const policyId = parseInt(params.id ?? "0", 10);

  // The back-link target: explicit referrer from navigate-state wins,
  // else fall back to /policies. useMemo so consumers don't re-resolve
  // each render.
  const back = useMemo<BackRef>(() => {
    const state = location.state as { from?: BackRef } | null;
    if (state?.from?.pathname && state.from.label) return state.from;
    return { pathname: "/policies", label: "返回保单列表" };
  }, [location.state]);

  const goBack = useCallback(() => {
    navigate(`${back.pathname}${back.search ?? ""}`);
  }, [navigate, back]);

  const [policy, setPolicy] = useState<PolicyDetail | null>(null);
  const [coverageItems, setCoverageItems] = useState<CoverageItem[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [members, setMembers] = useState<{ id: number; name: string }[]>([]);
  const [assets, setAssets] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async (id: number) => {
    setLoading(true);
    setError(null);
    try {
      const [policyRes, coverageRes, paymentsRes, beneficiariesRes, membersRes, assetsRes] = await Promise.all([
        fetch(`/api/policies/${id}`),
        fetch(`/api/policies/${id}/coverage-items`).catch(() => null),
        fetch(`/api/policies/${id}/payments`).catch(() => null),
        fetch(`/api/policies/${id}/beneficiaries`).catch(() => null),
        fetch("/api/members").catch(() => null),
        fetch("/api/assets").catch(() => null),
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
      setMembers(membersRes?.ok ? await membersRes.json() : []);
      setAssets(assetsRes?.ok ? await assetsRes.json() : []);
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
        <PolicyDetailSkeleton />
      </AppShell>
    );
  }

  if (error || !policy) {
    return (
      <AppShell breadcrumbs={[{ label: "保单管理", href: "/policies" }, { label: "错误" }]}>
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <p className="text-muted-foreground">{error ?? "保单不存在"}</p>
          <Button variant="outline" onClick={goBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {back.label}
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell breadcrumbs={[{ label: "保单管理", href: "/policies" }, { label: policy.productName }]}>
      <div className="mb-4">
        <Button variant="ghost" size="sm" onClick={goBack}>
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          {back.label}
        </Button>
      </div>

      {/*
       * Layout: on lg+, split into a primary column (Meta + Coverage —
       * "what is this policy") and a secondary column (Timeline +
       * Payments — "when does anything happen"). 7/5 of a 12-grid puts
       * the denser content (Meta is by far the longest) on the left
       * without making it feel crowded. Below lg, single column so the
       * narrative reads top-to-bottom.
       */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-7">
          <div className="rounded-card bg-secondary p-5">
            <MetaColumn
              policy={policy}
              beneficiaries={beneficiaries}
              members={members}
              assets={assets}
              onPolicyUpdate={refreshPolicy}
            />
          </div>

          <div className="rounded-card bg-secondary p-5">
            <CoverageSection
              policyId={policy.id}
              items={coverageItems}
              onItemsChange={(items) => {
                setCoverageItems(items);
                void refreshCoverage();
              }}
            />
          </div>
        </div>

        <div className="space-y-6 lg:col-span-5">
          <div className="rounded-card bg-secondary p-5">
            <TimelineColumn policy={policy} />
          </div>

          <div className="rounded-card bg-secondary p-5">
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
      </div>
    </AppShell>
  );
}

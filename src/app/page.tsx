"use client";

import { useState, useEffect } from "react";
import { FileText, Users, TrendingUp, Calendar } from "lucide-react";
import { AppShell } from "@/components/layout";

interface DashboardData {
  stats: {
    policyCount: number;
    memberCount: number;
    totalPremium: number;
  };
  upcomingRenewals: {
    id: number;
    productName: string;
    insuredName: string;
    dueDate: string;
  }[];
}

function formatCurrency(value: number): string {
  if (value >= 10000) {
    return `¥${(value / 10000).toFixed(value % 10000 === 0 ? 0 : 1)}万`;
  }
  return `¥${value.toLocaleString()}`;
}

export default function Home() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((res) => res.json())
      .then((d: DashboardData) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading || !data) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">加载中...</div>
        </div>
      </AppShell>
    );
  }

  const stats = [
    { label: "保单总数", value: String(data.stats.policyCount), icon: FileText },
    { label: "家庭成员", value: String(data.stats.memberCount), icon: Users },
    { label: "年保费", value: formatCurrency(data.stats.totalPremium), icon: TrendingUp },
    { label: "待续费", value: String(data.upcomingRenewals.length), icon: Calendar },
  ];

  return (
    <AppShell>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">仪表盘</h1>
          <p className="text-sm text-muted-foreground">
            家庭保障概览
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-lg border border-border bg-card p-6"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{stat.label}</span>
                <stat.icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="mt-2">
                <span className="text-2xl font-bold">{stat.value}</span>
              </div>
            </div>
          ))}
        </div>

        {data.upcomingRenewals.length > 0 && (
          <div className="rounded-lg border border-border bg-card p-6">
            <h2 className="text-lg font-semibold">近期保单</h2>
            <div className="mt-4 space-y-3">
              {data.upcomingRenewals.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-md bg-muted/50 p-3"
                >
                  <div>
                    <p className="text-sm font-medium">{item.productName}</p>
                    <p className="text-xs text-muted-foreground">被保人: {item.insuredName}</p>
                  </div>
                  <span className="text-xs font-mono text-muted-foreground">
                    {item.dueDate}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

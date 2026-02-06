"use client";

import { FileText, Users, TrendingUp, AlertCircle } from "lucide-react";
import { AppShell } from "@/components/layout";

const stats = [
  { label: "保单总数", value: "8", icon: FileText, change: "+2 本月" },
  { label: "家庭成员", value: "7", icon: Users, change: "已全覆盖" },
  { label: "年保费", value: "¥81,660", icon: TrendingUp, change: "占收入 13.6%" },
  { label: "待续费", value: "2", icon: AlertCircle, change: "30天内到期" },
];

export default function Home() {
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
              <p className="mt-1 text-xs text-muted-foreground">{stat.change}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-lg border border-border bg-card p-6">
            <h2 className="text-lg font-semibold">近期待办</h2>
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between rounded-md bg-muted/50 p-3">
                <div>
                  <p className="text-sm font-medium">尊享e生百万医疗险</p>
                  <p className="text-xs text-muted-foreground">被保人: 张小明</p>
                </div>
                <span className="text-xs font-medium text-orange-600 dark:text-orange-400">
                  7天后到期
                </span>
              </div>
              <div className="flex items-center justify-between rounded-md bg-muted/50 p-3">
                <div>
                  <p className="text-sm font-medium">国寿福终身寿险</p>
                  <p className="text-xs text-muted-foreground">被保人: 张伟</p>
                </div>
                <span className="text-xs font-medium text-muted-foreground">
                  15天后缴费
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-6">
            <h2 className="text-lg font-semibold">保障缺口提醒</h2>
            <div className="mt-4 space-y-3">
              <div className="rounded-md border border-orange-200 bg-orange-50 p-3 dark:border-orange-900 dark:bg-orange-950">
                <p className="text-sm font-medium text-orange-800 dark:text-orange-200">
                  王秀英 医疗险已失效
                </p>
                <p className="mt-1 text-xs text-orange-600 dark:text-orange-400">
                  建议尽快续保或更换产品
                </p>
              </div>
              <div className="rounded-md border border-blue-200 bg-blue-50 p-3 dark:border-blue-900 dark:bg-blue-950">
                <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                  李娜 缺少意外险
                </p>
                <p className="mt-1 text-xs text-blue-600 dark:text-blue-400">
                  建议配置综合意外险
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

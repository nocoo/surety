"use client";

import { type LucideIcon } from "lucide-react";

interface ChartCardProps {
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
  height?: string;
}

/**
 * Unified chart card wrapper with icon in title
 */
export function ChartCard({ title, icon: Icon, children, height = "h-[280px]" }: ChartCardProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-4">
        <Icon className="h-4 w-4 text-primary" />
        <h3 className="text-base font-semibold">{title}</h3>
      </div>
      <div className={height}>{children}</div>
    </div>
  );
}

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Lightweight inline notice for showing import/save/test/push outcomes
 * inside settings panels. Uses semantic color tokens so light/dark mode
 * and future theme changes apply uniformly — replaces the per-instance
 * `border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950` blocks
 * that were duplicated across settings/backy/database panels.
 *
 * For confirm/destructive flows, keep using AlertDialog (Radix) — this is
 * for non-modal status messages only.
 */
const noticeVariants = cva(
  "rounded-widget border p-3 text-sm",
  {
    variants: {
      variant: {
        info: "border-info/30 bg-info/10 text-info-text",
        success: "border-success/30 bg-success/10 text-success-text",
        warning: "border-warning/30 bg-warning/10 text-warning-text",
        destructive:
          "border-destructive/30 bg-destructive/10 text-destructive-text",
      },
    },
    defaultVariants: {
      variant: "info",
    },
  },
);

export interface NoticeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof noticeVariants> {}

function Notice({ className, variant, ...props }: NoticeProps) {
  return (
    <div
      role="status"
      data-slot="notice"
      className={cn(noticeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Notice, noticeVariants };

import { cn } from "@/lib/utils";

/**
 * Section divider for dashboard-style page layouts.
 *
 * Visual: small CJK-friendly label on the left + a thin separator line
 * extending to the right edge + an optional action slot. No card / no
 * background — children keep their own styling. Use this to break a
 * long page into named segments without nesting another rounded box.
 *
 * Inspired by ../pew's DashboardSegment, with the uppercase + tracking-
 * wider treatment dropped (those are typewriter affectations that hurt
 * Chinese readability).
 *
 * The default content gap (`space-y-4`) matches what the body of each
 * segment usually needs. For a denser layout pass `bodyClassName="space-y-3"`.
 */
export interface SectionDividerProps {
  title: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** Override the default `space-y-4` between section title and body. */
  bodyClassName?: string;
}

export function SectionDivider({
  title,
  action,
  children,
  className,
  bodyClassName,
}: SectionDividerProps) {
  return (
    <section className={cn("space-y-4", className)}>
      <div className="flex items-center gap-3">
        <h2 className="shrink-0 text-sm font-medium text-muted-foreground">
          {title}
        </h2>
        <div aria-hidden="true" className="h-px flex-1 bg-border/60" />
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className={cn(bodyClassName)}>{children}</div>
    </section>
  );
}

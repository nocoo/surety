import type { LucideIcon } from "@nocoo/basalt/icons";
import { cn } from "@/lib/utils";

/**
 * Branded empty-state shell. Replaces the recurring "lucide icon with
 * text-basalt-muted-foreground/50 + h3 + muted p" snippet duplicated across
 * pages with a warmer presentation:
 *
 * - icon sits inside a soft gradient circle in the brand vermilion,
 *   not a flat gray glyph
 * - a primary CTA slot lets the page suggest the next action right
 *   from the empty card
 *
 * Use `tone="error"` for failure states (recolors the gradient and
 * keeps the icon destructive-toned). Tone defaults to "default".
 */
interface EmptyStateProps {
	icon: LucideIcon;
	title: string;
	description?: string;
	action?: React.ReactNode;
	tone?: "default" | "error";
	className?: string;
}

export function EmptyState({
	icon: Icon,
	title,
	description,
	action,
	tone = "default",
	className,
}: EmptyStateProps) {
	return (
		<div
			className={cn(
				"rounded-basalt-card bg-basalt-secondary ring-1 ring-basalt-border/80 shadow-basalt-card p-10 text-center",
				className,
			)}
		>
			<div
				aria-hidden="true"
				className={cn(
					"mx-auto flex h-20 w-20 items-center justify-center rounded-full",
					tone === "error"
						? "bg-gradient-to-br from-basalt-destructive/15 to-basalt-destructive/5"
						: "bg-gradient-to-br from-basalt-primary/15 to-basalt-primary/5",
				)}
			>
				<Icon
					className={cn(
						"h-10 w-10",
						tone === "error" ? "text-basalt-destructive" : "text-basalt-primary",
					)}
					strokeWidth={1.5}
				/>
			</div>
			<h3 className="mt-5 text-lg font-medium">{title}</h3>
			{description && (
				<p className="mx-auto mt-2 max-w-md text-sm text-basalt-muted-foreground">{description}</p>
			)}
			{action && <div className="mt-5 flex justify-center">{action}</div>}
		</div>
	);
}

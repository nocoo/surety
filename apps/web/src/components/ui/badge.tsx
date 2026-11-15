import { Badge as BasaltBadge } from "@nocoo/basalt";
import type { BadgeProps as BasaltBadgeProps } from "@nocoo/basalt/components/badge";

export type BadgeVariant =
	| "default"
	| "secondary"
	| "destructive"
	| "outline"
	| "success"
	| "warning"
	| "info"
	| "purple"
	| "teal"
	| "red"
	| "orange"
	| "blue"
	| "rose"
	| "indigo";

interface BadgeProps extends Omit<BasaltBadgeProps, "variant"> {
	variant?: BadgeVariant;
}

export function Badge({ variant = "default", ...props }: BadgeProps) {
	const mappedVariant: BasaltBadgeProps["variant"] =
		variant === "rose" ? "red" : variant === "indigo" ? "blue" : variant;

	return (
		<BasaltBadge
			data-slot="badge"
			data-variant={variant}
			variant={mappedVariant}
			{...props}
		/>
	);
}

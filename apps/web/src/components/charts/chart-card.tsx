import { LayerCard } from "@nocoo/basalt";
import { ChartFrame } from "@nocoo/basalt/components/chart";
import type { LucideIcon } from "@nocoo/basalt/icons";

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
		<LayerCard className="p-basalt-card">
			<div className="mb-basalt-space-lg flex items-center gap-basalt-space-lg">
				<Icon className="size-basalt-icon text-basalt-primary" strokeWidth={1.5} />
				<h3 className="text-basalt-md font-semibold">{title}</h3>
			</div>
			<ChartFrame ariaLabel={title} size={`${height} w-full`}>
				{children}
			</ChartFrame>
		</LayerCard>
	);
}

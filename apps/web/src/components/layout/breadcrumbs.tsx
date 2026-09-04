import { Breadcrumbs as BasaltBreadcrumbs } from "@nocoo/basalt/components/breadcrumbs";
import type { ReactNode } from "react";

export interface BreadcrumbItem {
	label: ReactNode;
	href?: string;
	icon?: ReactNode;
}

export interface BreadcrumbsProps {
	items: BreadcrumbItem[];
	className?: string;
}

export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
	return <BasaltBreadcrumbs items={items} {...(className !== undefined ? { className } : {})} />;
}

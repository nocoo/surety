import { PageHeader as BasaltPageHeader, type PageHeaderProps } from "@nocoo/basalt/components/page-header";

export type { PageHeaderProps };

export function PageHeader(props: PageHeaderProps) {
	return <BasaltPageHeader {...props} />;
}

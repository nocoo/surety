import * as React from "react";
import { cn } from "@/lib/utils";
import {
	Table as BasaltTable,
	TableBody,
	TableCaption,
	TableCell,
	TableFooter,
	TableHead,
	TableHeader,
	TableRow,
	TableSortableHeader,
} from "@nocoo/basalt/components/table";

const Table = React.forwardRef<
	HTMLTableElement,
	React.ComponentProps<typeof BasaltTable>
>(({ className, ...props }, ref) => (
	<div data-slot="table-container" className="relative w-full overflow-x-auto">
		<BasaltTable ref={ref} data-slot="table" className={cn("min-w-[660px]", className)} {...props} />
	</div>
));
Table.displayName = "Table";

export {
	Table,
	TableBody,
	TableCaption,
	TableCell,
	TableFooter,
	TableHead,
	TableHeader,
	TableRow,
	TableSortableHeader,
};

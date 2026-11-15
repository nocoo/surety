import { Button } from "@nocoo/basalt";
import { XIcon } from "lucide-react";
import * as React from "react";
import {
	SheetClose as BasaltSheetClose,
	SheetContent as BasaltSheetContent,
	Sheet as BasaltSheet,
	SheetDescription as BasaltSheetDescription,
	SheetFooter as BasaltSheetFooter,
	SheetHeader as BasaltSheetHeader,
	SheetTitle as BasaltSheetTitle,
	SheetTrigger as BasaltSheetTrigger,
} from "@nocoo/basalt/components/sheet";
import { cn } from "@/lib/utils";

export const Sheet = BasaltSheet;
export const SheetTrigger = BasaltSheetTrigger;
export const SheetClose = BasaltSheetClose;
export const SheetDescription = BasaltSheetDescription;
export const SheetFooter = BasaltSheetFooter;
export const SheetHeader = BasaltSheetHeader;
export const SheetTitle = BasaltSheetTitle;

export const SheetContent = React.forwardRef<
	HTMLDivElement,
	React.ComponentProps<typeof BasaltSheetContent> & { showCloseButton?: boolean }
>(({ className, children, showCloseButton = true, ...props }, ref) => (
	<BasaltSheetContent
		ref={ref}
		className={cn("gap-basalt-space-lg", className)}
		{...props}
	>
		{children}
		{showCloseButton && (
			<BasaltSheetClose asChild>
				<Button
					variant="ghost"
					size="icon-sm"
					aria-label="关闭"
					className="absolute top-basalt-card right-basalt-card"
				>
					<XIcon className="size-basalt-icon" />
				</Button>
			</BasaltSheetClose>
		)}
	</BasaltSheetContent>
));
SheetContent.displayName = "SheetContent";

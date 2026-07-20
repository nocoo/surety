import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type InputType = "text" | "number" | "date" | "select";

interface EditableInfoRowProps {
	label: string;
	value: React.ReactNode;
	type?: InputType;
	editValue?: string;
	onEditChange?: ((value: string) => void) | undefined;
	options?: readonly { value: string; label: string; disabled?: boolean }[];
}

export function EditableInfoRow({
	label,
	value,
	type = "text",
	editValue,
	onEditChange,
	options,
}: EditableInfoRowProps) {
	// Display mode - show placeholder for empty values so users always see the field
	const displayValue = value == null || value === "" ? "—" : value;

	// Edit mode
	if (onEditChange) {
		const inputValue = editValue ?? (typeof value === "string" ? value : "");

		return (
			<div className="flex items-center justify-between text-sm gap-2">
				<span className="text-muted-foreground shrink-0">{label}</span>
				{type === "select" && options ? (
					<Select value={inputValue} onValueChange={onEditChange}>
						<SelectTrigger className="h-7 w-64">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{options.map((opt) => (
								<SelectItem key={opt.value} value={opt.value} disabled={opt.disabled ?? false}>
									{opt.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				) : (
					<Input
						type={type}
						value={inputValue}
						onChange={(e) => onEditChange(e.target.value)}
						className="h-7 w-64"
					/>
				)}
			</div>
		);
	}

	// Display mode
	return (
		<div className="flex items-center justify-between text-sm">
			<span className="text-muted-foreground">{label}</span>
			<span className={cn("font-medium", displayValue === "—" && "text-muted-foreground/50")}>
				{displayValue}
			</span>
		</div>
	);
}

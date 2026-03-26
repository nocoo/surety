"use client";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type InputType = "text" | "number" | "date" | "select";

interface EditableInfoRowProps {
  label: string;
  value: React.ReactNode;
  type?: InputType;
  editValue?: string;
  onEditChange?: ((value: string) => void) | undefined;
  options?: readonly { value: string; label: string }[];
}

export function EditableInfoRow({
  label,
  value,
  type = "text",
  editValue,
  onEditChange,
  options,
}: EditableInfoRowProps) {
  // Display mode - null/empty values hide the row (but edit mode always shows)
  if (!onEditChange && (value == null || value === "")) return null;

  // Edit mode
  if (onEditChange) {
    const inputValue = editValue ?? (typeof value === "string" ? value : "");

    return (
      <div className="flex items-center justify-between text-sm gap-2">
        <label className="text-muted-foreground shrink-0">{label}</label>
        {type === "select" && options ? (
          <Select
            value={inputValue}
            onValueChange={onEditChange}
          >
            <SelectTrigger className="h-7 w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {options.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
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
            className="h-7 w-32"
          />
        )}
      </div>
    );
  }

  // Display mode
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

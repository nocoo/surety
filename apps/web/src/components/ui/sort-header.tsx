
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface SortHeaderProps {
  label: string;
  sortKey: string;
  currentSort: string;
  currentDir: "asc" | "desc";
  onSort: (key: string) => void;
  className?: string;
}

export function SortHeader({
  label,
  sortKey,
  currentSort,
  currentDir,
  onSort,
  className,
}: SortHeaderProps) {
  const isActive = currentSort === sortKey;
  const ariaSort = isActive
    ? currentDir === "asc"
      ? "ascending"
      : "descending"
    : "none";

  const Icon = isActive
    ? currentDir === "asc"
      ? ArrowUp
      : ArrowDown
    : ArrowUpDown;

  return (
    <th
      className={cn(
        "px-2 py-3 text-left align-middle text-xs font-medium text-muted-foreground whitespace-nowrap",
        className,
      )}
      aria-sort={ariaSort}
    >
      <button
        onClick={() => onSort(sortKey)}
        className={cn(
          "inline-flex items-center gap-1 transition-colors hover:text-foreground",
          isActive && "text-foreground",
          className?.includes("text-right") && "w-full justify-end",
        )}
      >
        {label}
        <Icon className="h-3 w-3" strokeWidth={1.5} />
      </button>
    </th>
  );
}

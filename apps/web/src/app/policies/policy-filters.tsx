import { useState } from "react";
import { ListFilter, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { statusConfig } from "@/lib/constants/policy";
import { getCategoryConfig } from "@surety/api/lib/category-config";
import type { PolicyStatus } from "@/lib/types/policy";

export interface PolicyFilterState {
  applicant: string;
  insured: string;
  category: string;
  asset: string;
  status: string;
}

export const EMPTY_FILTERS: PolicyFilterState = {
  applicant: "all",
  insured: "all",
  category: "all",
  asset: "all",
  status: "all",
};

export interface PolicyFilterOptions {
  applicantNames: string[];
  insuredNames: string[];
  categories: string[];
  assetNames: string[];
  statuses: PolicyStatus[];
}

interface ChipDescriptor {
  key: keyof PolicyFilterState;
  label: string;
  /** Resolves a filter value to its user-facing label. */
  display: (value: string) => string;
}

const CHIP_LABELS: Record<keyof PolicyFilterState, string> = {
  applicant: "投保人",
  insured: "被保人",
  category: "类型",
  asset: "资产",
  status: "状态",
};

/**
 * Returns the count of currently-applied filter dimensions (excluding "all").
 * The trigger button uses this to render a count badge so the user can see at
 * a glance whether any filter is active without expanding the sheet.
 */
export function countActiveFilters(filters: PolicyFilterState): number {
  return (Object.values(filters) as string[]).filter((v) => v !== "all").length;
}

interface PolicyFiltersProps {
  filters: PolicyFilterState;
  onChange: (next: PolicyFilterState) => void;
  options: PolicyFilterOptions;
}

export function PolicyFilters({ filters, onChange, options }: PolicyFiltersProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<PolicyFilterState>(filters);
  const activeCount = countActiveFilters(filters);

  // Whenever the sheet opens, sync the draft to the live filters so that
  // a previous unconfirmed edit (cancel without "应用") doesn't persist.
  function handleOpen(next: boolean) {
    if (next) setDraft(filters);
    setOpen(next);
  }

  function apply() {
    onChange(draft);
    setOpen(false);
  }

  function clearAll() {
    onChange(EMPTY_FILTERS);
    setDraft(EMPTY_FILTERS);
  }

  function clearOne(key: keyof PolicyFilterState) {
    onChange({ ...filters, [key]: "all" });
  }

  const chips = buildChips(filters, options);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleOpen(true)}
        className="gap-1.5"
      >
        <ListFilter className="h-4 w-4" />
        筛选
        {activeCount > 0 && (
          <Badge variant="default" className="ml-1 h-5 px-1.5 text-xs">
            {activeCount}
          </Badge>
        )}
      </Button>

      {chips.map((chip) => (
        <Badge
          key={chip.key}
          variant="outline"
          className="gap-1.5 pl-2.5 pr-1 py-1 text-xs"
        >
          <span className="text-muted-foreground">{CHIP_LABELS[chip.key]}:</span>
          <span>{chip.display(filters[chip.key])}</span>
          <button
            type="button"
            onClick={() => clearOne(chip.key)}
            aria-label={`清除${CHIP_LABELS[chip.key]}筛选`}
            className="inline-flex items-center justify-center rounded-sm p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}

      {activeCount > 0 && (
        <Button variant="ghost" size="sm" onClick={clearAll} className="text-xs">
          清除全部
        </Button>
      )}

      <Sheet open={open} onOpenChange={handleOpen}>
        <SheetContent side="right" className="w-full sm:max-w-sm">
          <SheetHeader>
            <SheetTitle>筛选保单</SheetTitle>
          </SheetHeader>

          <div className="grid gap-4 px-4 py-2">
            <FilterField label="投保人">
              <Select
                value={draft.applicant}
                onValueChange={(v) => setDraft((d) => ({ ...d, applicant: v }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  {options.applicantNames.map((name) => (
                    <SelectItem key={name} value={name}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>

            <FilterField label="被保人">
              <Select
                value={draft.insured}
                onValueChange={(v) => setDraft((d) => ({ ...d, insured: v }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  {options.insuredNames.map((name) => (
                    <SelectItem key={name} value={name}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>

            <FilterField label="类型">
              <Select
                value={draft.category}
                onValueChange={(v) => setDraft((d) => ({ ...d, category: v }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  {options.categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {getCategoryConfig(cat).label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>

            {options.assetNames.length > 0 && (
              <FilterField label="资产">
                <Select
                  value={draft.asset}
                  onValueChange={(v) => setDraft((d) => ({ ...d, asset: v }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部</SelectItem>
                    {options.assetNames.map((name) => (
                      <SelectItem key={name} value={name}>{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FilterField>
            )}

            <FilterField label="状态">
              <Select
                value={draft.status}
                onValueChange={(v) => setDraft((d) => ({ ...d, status: v }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  {options.statuses.map((s) => (
                    <SelectItem key={s} value={s}>
                      {statusConfig[s].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>
          </div>

          <SheetFooter>
            <Button variant="ghost" onClick={() => setDraft(EMPTY_FILTERS)}>
              重置
            </Button>
            <SheetClose asChild>
              <Button variant="outline">取消</Button>
            </SheetClose>
            <Button onClick={apply}>应用</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

/**
 * Build chip descriptors for currently-applied filters. Exported separately so
 * non-rendering code (tests, summary text, URL persistence) can use the same
 * label resolution without depending on React.
 */
export function buildChips(
  filters: PolicyFilterState,
  options: PolicyFilterOptions,
): ChipDescriptor[] {
  const chips: ChipDescriptor[] = [];
  if (filters.applicant !== "all") {
    chips.push({ key: "applicant", label: filters.applicant, display: (v) => v });
  }
  if (filters.insured !== "all") {
    chips.push({ key: "insured", label: filters.insured, display: (v) => v });
  }
  if (filters.category !== "all") {
    chips.push({
      key: "category",
      label: filters.category,
      display: (v) => getCategoryConfig(v).label,
    });
  }
  if (filters.asset !== "all") {
    chips.push({ key: "asset", label: filters.asset, display: (v) => v });
  }
  if (filters.status !== "all") {
    chips.push({
      key: "status",
      label: filters.status,
      display: (v) => statusConfig[v as PolicyStatus]?.label ?? v,
    });
  }
  // Discourage unused-options warnings — options is used by rendering only.
  void options;
  return chips;
}

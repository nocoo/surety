import type {
  CategoryGroup,
  PolicyCoverageCard,
} from "@surety/api/coverage-lookup";
import { formatCurrency } from "@surety/api/lib/format";

export interface EmergencyContact {
  insurerName: string;
  phone: string;
}

/**
 * Deduplicate (insurer, phone) pairs across all visible (active) policies
 * for the currently selected member/asset. Returns at most one entry per
 * insurer — emergency situations call insurer customer service, and the
 * same insurer answers for all of that insurer's policies.
 *
 * Inactive policies are intentionally excluded: the user is asking
 * "who do I call right now", not "what was my history".
 */
export function buildEmergencyContacts(
  groups: readonly CategoryGroup[],
): EmergencyContact[] {
  const seen = new Set<string>();
  const out: EmergencyContact[] = [];
  for (const group of groups) {
    for (const policy of group.policies) {
      if (!policy.isActive) continue;
      const phone = (policy.insurerPhone ?? "").trim();
      if (!phone) continue;
      const key = `${policy.insurerName}|${phone}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ insurerName: policy.insurerName, phone });
    }
  }
  out.sort((a, b) => a.insurerName.localeCompare(b.insurerName, "zh-CN"));
  return out;
}

/**
 * Build a single plain-text block summarising every visible policy.
 * Intended for the "复制全部到剪贴板" action — paste into IM / a phone
 * call form / a notebook. One header line per category + one indented
 * line per policy. Format is intentionally human-friendly, not CSV.
 */
export function buildCoverageClipboardText(
  subjectLabel: string,
  groups: readonly CategoryGroup[],
): string {
  const lines: string[] = [];
  lines.push(`【${subjectLabel} · 保障速查】`);
  const visible = groups
    .map((g) => ({
      ...g,
      policies: g.policies.filter((p) => p.isActive),
    }))
    .filter((g) => g.policies.length > 0);

  if (visible.length === 0) {
    lines.push("（暂无生效保单）");
    return lines.join("\n");
  }

  let grandTotal = 0;
  for (const group of visible) {
    const groupTotal = group.policies.reduce((sum, p) => sum + p.sumAssured, 0);
    grandTotal += groupTotal;
    lines.push("");
    lines.push(`▎${group.categoryLabel}（${group.policies.length} 份 · 总保额 ${formatCurrency(groupTotal)}）`);
    for (const policy of group.policies) {
      lines.push(formatPolicyLine(policy));
    }
  }

  lines.push("");
  lines.push(`合计保额：${formatCurrency(grandTotal)}`);
  return lines.join("\n");
}

function formatPolicyLine(p: PolicyCoverageCard): string {
  const phone = p.insurerPhone ? ` ☎ ${p.insurerPhone}` : "";
  return `  · ${p.productName}（${p.insurerName}）保额 ${p.sumAssuredFormatted}${phone}`;
}

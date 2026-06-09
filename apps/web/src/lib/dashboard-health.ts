/**
 * Pure logic for the dashboard "家庭保障健康度" header card.
 *
 * Inputs:
 *   - annualPremium: 当前年度保费支出（CNY）
 *   - annualIncome:  家庭年收入（CNY），来自 /api/settings/annualIncome；
 *                    可能为 0/null/missing — 调用方传 0 时返回 unknown 档位
 *
 * Output:
 *   - ratio:   premium / income, fraction（0..1+），未知收入时为 null
 *   - level:   "unknown" | "underinsured" | "healthy" | "overspent"
 *   - title:   一句话结论
 *   - detail:  ratio 的人话格式 + 推荐区间
 *
 * 行业经验区间（保费占年收入）：
 *   - <  5%   → underinsured （保障可能不足）
 *   - 5..15%  → healthy        （建议区间）
 *   - > 15%   → overspent      （保费占比偏高）
 */

export type CoverageLevel = "unknown" | "underinsured" | "healthy" | "overspent";

export interface CoverageHealth {
  ratio: number | null;
  level: CoverageLevel;
  title: string;
  detail: string;
}

const LOW = 0.05;
const HIGH = 0.15;

export function computeCoverageHealth(
  annualPremium: number,
  annualIncome: number,
): CoverageHealth {
  if (!annualIncome || annualIncome <= 0) {
    return {
      ratio: null,
      level: "unknown",
      title: "尚未设置家庭年收入",
      detail: "在「系统设置」中填写年收入，可以看到保费占比是否处于建议区间",
    };
  }

  const ratio = annualPremium / annualIncome;
  const pct = (ratio * 100).toFixed(1);
  const recommend = `建议区间 ${LOW * 100}% ~ ${HIGH * 100}%`;

  if (ratio < LOW) {
    return {
      ratio,
      level: "underinsured",
      title: `保费占年收入 ${pct}%，可能偏低`,
      detail: `${recommend}。家庭可能存在保障缺口，建议补充重疾、医疗、寿险等核心险种`,
    };
  }
  if (ratio > HIGH) {
    return {
      ratio,
      level: "overspent",
      title: `保费占年收入 ${pct}%，偏高`,
      detail: `${recommend}。可以审视储蓄型保险占比，避免挤压日常现金流`,
    };
  }
  return {
    ratio,
    level: "healthy",
    title: `保费占年收入 ${pct}%，处于健康区间`,
    detail: `${recommend}。继续保持当前配置`,
  };
}

/**
 * Action items for the "未来 30 天" panel. Reads from the dashboard's
 * renewalTimeline (which groups upcoming renewals by month bucket
 * 0/1/3/6/12) — anything in the first bucket (0..1 month) becomes a
 * card row. expiryTimeline contributes the "X 天后到期" hint when the
 * same product also expires within 30 days.
 *
 * Returns at most `limit` items, sorted by urgency: bucket-0 first,
 * then bucket-1.
 */

export interface ActionItem {
  key: string;
  title: string;
  detail: string;
  tone: "warning" | "info";
}

interface TimelineCategoryMap {
  data: Array<{ label: string; [category: string]: string | number }>;
  categories: string[];
}

export function buildActionItems(
  renewal: TimelineCategoryMap,
  expiry: TimelineCategoryMap,
  limit = 6,
): ActionItem[] {
  // The bar labels look like "0月内", "1-3月", "3-6月" — the first
  // bucket label varies between API versions, so we just take the
  // first row regardless of label.
  const renewalFirst = renewal.data[0];
  const expiryFirst = expiry.data[0];

  const items: ActionItem[] = [];

  if (renewalFirst) {
    for (const cat of renewal.categories) {
      const count = Number(renewalFirst[cat]);
      if (count > 0) {
        items.push({
          key: `renew-${cat}`,
          title: `${cat}有 ${count} 份保单即将续费`,
          detail: `30 天内 · 提前确认账户余额避免失效`,
          tone: "warning",
        });
      }
    }
  }

  if (expiryFirst) {
    for (const cat of expiry.categories) {
      const count = Number(expiryFirst[cat]);
      if (count > 0) {
        items.push({
          key: `expire-${cat}`,
          title: `${cat}有 ${count} 份保单即将到期`,
          detail: `30 天内 · 提前评估是否需要续保或更换`,
          tone: "info",
        });
      }
    }
  }

  return items.slice(0, limit);
}

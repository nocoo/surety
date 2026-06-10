/**
 * Pure logic for the dashboard "家庭保障健康度" header card.
 *
 * Inputs:
 *   - protectionPremium: 当前年度保障型保费（CNY），剔除年金险 /
 *                        增额终身寿等储蓄型产品；后端聚合于 stats
 *   - annualIncome:      家庭年收入（CNY），来自 /api/settings/annualIncome；
 *                        可能为 0/null/missing — 调用方传 0 时返回 unknown 档位
 *
 * Output:
 *   - ratio:   protection / income, fraction（0..1+），未知收入时为 null
 *   - level:   "unknown" | "underinsured" | "healthy" | "overspent"
 *   - title:   一句话结论
 *   - detail:  ratio 的人话格式 + 推荐区间
 *
 * 行业经验区间（保障型保费占年收入）：
 *   - <  5%   → underinsured （保障可能不足）
 *   - 5..15%  → healthy        （建议区间）
 *   - > 15%   → overspent      （保费占比偏高）
 *
 * 储蓄型保险（年金、增额终身寿）是强制储蓄工具，不属于风险对冲支出，
 * 不应进入这个比例。后端 packages/api/src/dashboard.ts 用
 * isSavingsPolicy() 在源头剔除，前端只接 protectionPremium。
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
  protectionPremium: number,
  annualIncome: number,
): CoverageHealth {
  if (!annualIncome || annualIncome <= 0) {
    return {
      ratio: null,
      level: "unknown",
      title: "尚未设置家庭年收入",
      detail: "在「系统设置」中填写年收入，可以看到保障型保费占比是否处于建议区间",
    };
  }

  const ratio = protectionPremium / annualIncome;
  const pct = (ratio * 100).toFixed(1);
  const recommend = `建议区间 ${LOW * 100}% ~ ${HIGH * 100}%（不含储蓄型）`;

  if (ratio < LOW) {
    return {
      ratio,
      level: "underinsured",
      title: `保障型保费占年收入 ${pct}%，可能偏低`,
      detail: `${recommend}。家庭可能存在保障缺口，建议补充重疾、医疗、定期寿等核心险种`,
    };
  }
  if (ratio > HIGH) {
    return {
      ratio,
      level: "overspent",
      title: `保障型保费占年收入 ${pct}%，偏高`,
      detail: `${recommend}。即使已剔除储蓄型，保障支出仍偏高，注意挤压日常现金流`,
    };
  }
  return {
    ratio,
    level: "healthy",
    title: `保障型保费占年收入 ${pct}%，处于健康区间`,
    detail: `${recommend}。继续保持当前配置`,
  };
}

/**
 * Action items for the "本月" panel. The dashboard's renewalTimeline /
 * expiryTimeline are bucketed by **calendar month**, not a rolling
 * 30-day window — see packages/api/src/dashboard.ts:153, where the
 * first bucket is the current natural month, the second is the next,
 * etc. So `renewal.data[0]` is "events landing in this calendar month",
 * which:
 *   - misses an event in the next month even if it's only 5 days out
 *     (the user sees "可以喘口气" on the 28th when in fact a payment
 *     is due on the 3rd)
 *   - includes events earlier in the same month even if 30+ days have
 *     passed since the start of the month
 *
 * Until the API exposes a true rolling window, the front-end labels
 * what we actually have ("本月") rather than over-promising "未来 30 天".
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
  const renewalFirst = renewal.data[0];
  const expiryFirst = expiry.data[0];

  const items: ActionItem[] = [];

  if (renewalFirst) {
    for (const cat of renewal.categories) {
      const count = Number(renewalFirst[cat]);
      if (count > 0) {
        items.push({
          key: `renew-${cat}`,
          title: `${cat}有 ${count} 份保单本月需续费`,
          detail: `提前确认账户余额避免失效`,
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
          title: `${cat}有 ${count} 份保单本月到期`,
          detail: `提前评估是否需要续保或更换`,
          tone: "info",
        });
      }
    }
  }

  return items.slice(0, limit);
}

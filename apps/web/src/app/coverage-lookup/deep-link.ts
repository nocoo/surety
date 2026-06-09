import type { SelectionType } from "@surety/api/coverage-lookup";

export interface CoverageDeepLink {
  type: SelectionType;
  id: number | null;
}

/**
 * Read the deep-link target from URL search params.
 *
 * `?member=<id>` and `?asset=<id>` are emitted by the global command
 * palette and any future deep-link share. If both are present, asset
 * wins (defensive: only one should ever be set, but we should not
 * silently merge them).
 *
 * Returns { type: "member", id: null } when neither key is present —
 * the previous default for landing on the page without a deep link.
 */
export function readCoverageDeepLink(
  params: URLSearchParams,
): CoverageDeepLink {
  const memberRaw = params.get("member");
  const assetRaw = params.get("asset");
  if (assetRaw) {
    const id = Number(assetRaw);
    return { type: "asset", id: Number.isFinite(id) && id > 0 ? id : null };
  }
  if (memberRaw) {
    const id = Number(memberRaw);
    return { type: "member", id: Number.isFinite(id) && id > 0 ? id : null };
  }
  return { type: "member", id: null };
}

import type { SelectionType } from "@surety/api/coverage-lookup";

export interface CoverageDeepLink {
  type: SelectionType;
  id: number | null;
}

/**
 * Read the deep-link target from URL search params.
 *
 * Wire format:
 *   ?member        → member tab, no specific id (auto-pick first)
 *   ?member=<id>   → member tab, that specific id
 *   ?asset         → asset tab, no specific id
 *   ?asset=<id>    → asset tab, that specific id
 *   (none)         → member tab, no id (default landing)
 *
 * The presence of the `asset` key alone — even with no value — is what
 * keeps the user on the asset tab after they switch tabs but before
 * they pick a specific asset. Earlier versions only wrote the key when
 * an id was set, which made `writeDeepLink("asset", null)` produce an
 * empty querystring that read back as the member tab.
 *
 * If both keys appear, asset wins (defensive: only one should ever be
 * set, but we should not silently merge them).
 */
export function readCoverageDeepLink(
  params: URLSearchParams,
): CoverageDeepLink {
  if (params.has("asset")) {
    const raw = params.get("asset");
    return { type: "asset", id: parseId(raw) };
  }
  if (params.has("member")) {
    const raw = params.get("member");
    return { type: "member", id: parseId(raw) };
  }
  return { type: "member", id: null };
}

function parseId(raw: string | null): number | null {
  if (raw === null || raw === "") return null;
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? id : null;
}

/**
 * "Which selector should the page render right now" — derived purely
 * from the deep-link result. Extracted so tests can pin the
 * URL → component-choice mapping without spinning up the full page.
 */
export function selectorKindForDeepLink(
  link: CoverageDeepLink,
): "member-selector" | "asset-selector" {
  return link.type === "asset" ? "asset-selector" : "member-selector";
}

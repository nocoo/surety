import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router";

/**
 * Watches the URL for a `?new=1` flag (the convention the global
 * command palette uses for "create" shortcuts), calls `open` once,
 * then strips the flag from the URL so a refresh doesn't reopen
 * the sheet.
 *
 * Pages register this with their own setSheetOpen / setEditing
 * callback — keeping the wiring per-page rather than via a global
 * event bus, because each page's "create" path needs to also reset
 * its local "editing" / "currentItem" state before opening.
 */
export function useOpenSheetOnNewParam(open: () => void) {
  const [params, setParams] = useSearchParams();
  // Pin the latest open callback in a ref so the effect can stay
  // keyed on `params` only — re-running just because the caller
  // redefined the callback inline would burn cycles for no reason.
  const openRef = useRef(open);
  openRef.current = open;

  useEffect(() => {
    if (params.get("new") !== "1") return;
    openRef.current();
    const next = new URLSearchParams(params);
    next.delete("new");
    setParams(next, { replace: true });
  }, [params, setParams]);
}

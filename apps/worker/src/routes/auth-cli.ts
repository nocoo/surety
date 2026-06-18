import { Hono } from "hono";
import type { AppEnv } from "../lib/types";

const app = new Hono<AppEnv>();

/**
 * Reject callback URLs that are not http://127.0.0.1:* or http://localhost:*.
 * CLI loopback servers cannot present a valid TLS certificate, so only http
 * is allowed and only on the loopback hostnames.
 */
export function isLocalhostUrl(value: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }
  if (parsed.protocol !== "http:") return false;
  return parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost";
}

/**
 * CLI token mint endpoint.
 *
 * Flow:
 *   1. CLI opens GET /api/auth/cli?callback_url=http://127.0.0.1:PORT/cb&state=NONCE
 *      (`?callback=` is accepted as an alias for `?callback_url=` to match
 *      the convention used by @nocoo/cli-base's performLogin helper.)
 *   2. CF Access intercepts; user authenticates via Google and is bounced back
 *      with a Cf-Access-Jwt-Assertion header. accessAuth middleware verifies
 *      the JWT and writes payload.email into context as `accessEmail`.
 *   3. This handler mints a fresh API token bound to that email and 302s to
 *      callback_url?api_key=...&state=...&email=...
 *
 * Security:
 *   - callback_url must point to http://127.0.0.1:* or http://localhost:*.
 *   - `state` is echoed back unchanged. The CLI side (@nocoo/cli-base's
 *     performLogin) generates the nonce, stores it in the local loopback
 *     listener, and compares it against the `state` query param on the
 *     callback hit — that is where CSRF binding lives. The server has no
 *     persisted record of the nonce and cannot validate it on its own.
 *   - An authenticated Access session OR a valid Bearer token is required to
 *     reach this handler (middleware enforces). If neither is present the
 *     request is already rejected upstream.
 *   - Minting requires a verified Access email. Bearer-only callers (who
 *     already have a token) have no reason to call this endpoint and are
 *     rejected with 400 to avoid issuing a token without a known owner.
 *   - The handler also requires the request to look like a real top-level
 *     navigation (Sec-Fetch-Mode: navigate AND Sec-Fetch-Dest: document) AND
 *     to NOT originate from a cross-site or same-site context (Sec-Fetch-Site
 *     must be `none` or `same-origin`). Without the mode/dest check, a
 *     malicious cross-origin page could embed the mint URL via
 *     <img>/<script>/<iframe>; without the site check, an attacker page
 *     could still cause a top-level cross-site navigation via window.open /
 *     <a target="_blank"> / form POST, and the victim's CF Access cookie
 *     would auto-attach. Real entry points (CLI openBrowser, user typing
 *     URL, bookmark) all produce Sec-Fetch-Site: none; an in-app SPA link
 *     produces same-origin. `same-site` is rejected because there is no
 *     legitimate cousin-host initiator. The CF Access redirect chain
 *     preserves the original navigation's Sec-Fetch-Site per the fetch
 *     spec, so legitimate flows still pass. Requests without Sec-Fetch
 *     headers are also rejected: this endpoint has no legitimate non-
 *     browser caller (CLI shells out to the OS browser; it does not call
 *     this URL directly), and every modern browser since Chrome 76 /
 *     Firefox 90 / Safari 16.4 sends Sec-Fetch-*. Fail-closed eliminates
 *     the downgrade path through old webviews and header-stripping
 *     intermediaries.
 */
const SAFE_FETCH_MODES = new Set(["navigate"]);
const SAFE_FETCH_DESTS = new Set(["document"]);
// Only the entry points that actually drive `/api/auth/cli` produce these
// values: `none` for CLI openBrowser / address-bar / bookmark, and
// `same-origin` for a click from the surety SPA itself. `same-site` is not
// enumerated because there is no legitimate same-site initiator (no other
// hexly.ai subdomain links here), and admitting it would widen the surface
// to whatever cousin host an attacker could plant on the registrable
// domain. Tightened from a prior `same-site`-inclusive list per review.
const SAFE_FETCH_SITES = new Set(["none", "same-origin"]);

app.get("/api/auth/cli", async (c) => {
  const callbackUrl =
    c.req.query("callback_url") ?? c.req.query("callback");
  const state = c.req.query("state") ?? "";

  if (!callbackUrl) {
    return c.json({ error: "callback_url is required" }, 400);
  }
  if (!isLocalhostUrl(callbackUrl)) {
    return c.json({ error: "callback_url must be a localhost URL" }, 400);
  }

  // Require all three Sec-Fetch-* signals to be present and safe. There is
  // no legitimate non-browser caller of this endpoint — the CLI opens the
  // URL in the OS default browser, it does not call this directly. Missing
  // headers (curl, old webviews, header-stripping intermediaries) are
  // rejected rather than fall through, removing the only remaining
  // downgrade path.
  const fetchMode = c.req.header("Sec-Fetch-Mode") ?? "";
  const fetchDest = c.req.header("Sec-Fetch-Dest") ?? "";
  const fetchSite = c.req.header("Sec-Fetch-Site") ?? "";
  if (!SAFE_FETCH_MODES.has(fetchMode)) {
    return c.json(
      { error: "CLI token mint requires a top-level navigation" },
      400,
    );
  }
  if (!SAFE_FETCH_DESTS.has(fetchDest)) {
    return c.json(
      { error: "CLI token mint requires a top-level navigation" },
      400,
    );
  }
  if (!SAFE_FETCH_SITES.has(fetchSite)) {
    return c.json(
      { error: "CLI token mint cannot be triggered cross-site" },
      400,
    );
  }

  const email = c.get("accessEmail");
  if (!email) {
    return c.json(
      { error: "CF Access session required to mint a CLI token" },
      400,
    );
  }

  const repos = c.get("repos");
  const { token } = await repos.apiTokens.create(email, "CLI");

  const redirect = new URL(callbackUrl);
  redirect.searchParams.set("api_key", token);
  if (state) redirect.searchParams.set("state", state);
  redirect.searchParams.set("email", email);

  return c.redirect(redirect.toString(), 302);
});

export default app;

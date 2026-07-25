/**
 * Browser network layer for the link resolver. Kept apart from the pure
 * resolver/mappers (which are unit-tested with a stub) so the untestable bits —
 * global fetch, CORS handling — live in one small, obvious place.
 *
 * Crossref and Open Library send permissive CORS headers, so they are called
 * directly. An arbitrary page cannot be fetched cross-origin from a static
 * site, so its HTML is retrieved through a free, no-key CORS proxy, with a
 * second proxy as a fallback if the first is down.
 */
import type { Fetchers } from "./linkResolve";
import { CITATION_PROXY } from "../config";

// Ways to fetch a third-party page's HTML from a static site. The page is tried
// directly first (some sites send permissive CORS headers), then through free,
// keyless CORS proxies. `json` proxies wrap the body in a JSON envelope.
type Route = { build: (url: string) => string; json?: "contents" };
const ROUTES: Route[] = [
  // Your own Cloudflare Worker first, if configured — it reads the most sites.
  ...(CITATION_PROXY
    ? [
        {
          build: (url: string) =>
            `${CITATION_PROXY.replace(/\/$/, "")}/?url=${encodeURIComponent(url)}`,
        } as Route,
      ]
    : []),
  { build: (url) => url }, // direct — works when the site allows CORS
  { build: (url) => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`, json: "contents" },
  { build: (url) => `https://corsproxy.io/?url=${encodeURIComponent(url)}` },
  { build: (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}` },
  { build: (url) => `https://thingproxy.freeboard.io/fetch/${url}` },
];

const withTimeout = (ms: number): AbortSignal => {
  // AbortSignal.timeout isn't everywhere; fall back to a manual controller.
  if (typeof AbortSignal !== "undefined" && "timeout" in AbortSignal) {
    return (AbortSignal as unknown as { timeout: (n: number) => AbortSignal }).timeout(ms);
  }
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
};

export const browserFetchers: Fetchers = {
  async fetchJson(url) {
    // A contact param is polite to Crossref and does not affect Open Library.
    const withContact = url.includes("crossref.org")
      ? `${url}${url.includes("?") ? "&" : "?"}mailto=nzlaw-cite@users.noreply.github.com`
      : url;
    const response = await fetch(withContact, {
      headers: { Accept: "application/json" },
      signal: withTimeout(12000),
    });
    if (!response.ok) throw new Error(`fetch failed: ${response.status}`);
    return response.json();
  },

  async fetchText(url) {
    let lastError: unknown = null;
    for (const route of ROUTES) {
      try {
        const response = await fetch(route.build(url), { signal: withTimeout(12000) });
        if (!response.ok) {
          lastError = new Error(`fetch ${response.status}`);
          continue;
        }
        const body = await response.text();
        const html = route.json ? JSON.parse(body)?.[route.json] ?? "" : body;
        // A proxy can return a success status with an error/empty body; only
        // accept something that actually looks like an HTML page.
        if (html && /<\/?[a-z!]/i.test(html)) return html;
        lastError = new Error("empty or non-HTML response");
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError ?? new Error("could not load the page");
  },
};

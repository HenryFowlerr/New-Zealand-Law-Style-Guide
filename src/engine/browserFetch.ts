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

// Free, keyless CORS proxies that return the target body verbatim. Tried in
// order; if one is unavailable the next is attempted.
const PROXIES = [
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url: string) => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
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
    for (const proxy of PROXIES) {
      try {
        const response = await fetch(proxy(url), { signal: withTimeout(12000) });
        if (!response.ok) {
          lastError = new Error(`proxy ${response.status}`);
          continue;
        }
        return await response.text();
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError ?? new Error("all proxies failed");
  },
};

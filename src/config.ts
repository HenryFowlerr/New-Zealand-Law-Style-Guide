/**
 * Site configuration.
 *
 * CITATION_PROXY — the URL of your own Cloudflare Worker (see worker/README.md).
 * When set, the "paste a link" feature uses it first to read pages that the free
 * public proxies can't (bot-protected sites, etc.). Leave it as an empty string
 * to run with no proxy of your own — the tool still works, just on fewer sites.
 *
 * Example after deploying the Worker:
 *   export const CITATION_PROXY = "https://citation-proxy.yourname.workers.dev";
 */
export const CITATION_PROXY = "https://citation-proxy.henryfowler10.workers.dev";

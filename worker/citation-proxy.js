/**
 * Cloudflare Worker — citation link proxy.
 *
 * A static site can't fetch other websites from the browser (CORS), and the
 * free public proxies are often blocked. This tiny Worker fetches a page
 * server-side with a real browser User-Agent and returns the HTML with
 * permissive CORS headers, so the citation tool can read the page's metadata.
 *
 * Deploy it once to your own free Cloudflare account (see worker/README.md),
 * then paste the Worker URL into src/config.ts. Students never see it — their
 * browser just calls this fast endpoint.
 *
 * Usage:  https://<your-worker>.workers.dev/?url=https://example.com/article
 */

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/125.0 Safari/537.36";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS });
    }

    const target = new URL(request.url).searchParams.get("url");
    if (!target) {
      return json({ error: "Pass a ?url= parameter." }, 400);
    }

    let parsed;
    try {
      parsed = new URL(target);
    } catch {
      return json({ error: "That is not a valid URL." }, 400);
    }
    // Only proxy public web pages.
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return json({ error: "Only http(s) URLs are allowed." }, 400);
    }

    try {
      const upstream = await fetch(parsed.toString(), {
        headers: {
          "User-Agent": BROWSER_UA,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-NZ,en;q=0.9",
        },
        redirect: "follow",
        // Cloudflare caches identical requests, keeping repeat look-ups fast.
        cf: { cacheTtl: 600, cacheEverything: true },
      });

      const body = await upstream.text();
      return new Response(body, {
        status: upstream.status,
        headers: {
          ...CORS,
          "Content-Type": upstream.headers.get("Content-Type") ?? "text/html; charset=utf-8",
        },
      });
    } catch (error) {
      return json({ error: `Could not fetch the page: ${String(error)}` }, 502);
    }
  },
};

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

# Citation link proxy (Cloudflare Worker)

A tiny helper that lets the "paste a link" feature read pages the free public
proxies can't. It fetches a page server-side with a real browser User-Agent and
returns the HTML to the tool. It's **free**, you deploy it **once**, and
students never see it — their browser just calls a fast endpoint.

You do **not** need this for the tool to work; it just widens the range of links
that auto-fill. Skip it to stay purely browser-based.

## Deploy in ~5 minutes (no command line)

1. Go to **https://dash.cloudflare.com** and sign up / log in (free).
2. In the left menu: **Workers & Pages** → **Create** → **Create Worker**.
3. Give it a name, e.g. `citation-proxy`, and click **Deploy** (it deploys a
   placeholder first).
4. Click **Edit code**. Delete everything in the editor, then paste the entire
   contents of [`citation-proxy.js`](./citation-proxy.js). Click **Deploy**.
5. Copy your Worker URL from the top of the page — it looks like
   `https://citation-proxy.YOURNAME.workers.dev`.
6. In this repo, open **`src/config.ts`** and set:
   ```ts
   export const CITATION_PROXY = "https://citation-proxy.YOURNAME.workers.dev";
   ```
7. Commit and push to `main`. GitHub Pages rebuilds and the link feature now
   uses your Worker first (then falls back to the public proxies, then to
   reading the URL itself).

### Test it

Open this in your browser (replace with your URL):
```
https://citation-proxy.YOURNAME.workers.dev/?url=https://example.com
```
You should see the raw HTML of example.com.

## Deploy with the command line (optional)

If you prefer Wrangler:
```sh
npm install -g wrangler
wrangler login
cd worker
wrangler deploy        # uses wrangler.toml
```

## Notes and limits

- **Free tier:** Cloudflare Workers include 100,000 requests/day free — far more
  than a citation tool needs.
- **Speed:** responses are cached for 10 minutes, so repeat look-ups are instant.
- **Not magic:** a few sites with the most aggressive bot-protection (or that
  need JavaScript to render) can still refuse even a Worker. For those, the tool
  falls back to filling the title from the URL for you to complete. Reading such
  sites reliably would need a headless-browser service (a paid step) — the same
  thing commercial citation tools pay for.
- **Cost control:** the Worker only fetches `http(s)` URLs and only responds to
  GET, keeping it a simple, safe read-only proxy.

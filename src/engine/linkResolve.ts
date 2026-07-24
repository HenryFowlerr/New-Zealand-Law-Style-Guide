/**
 * Resolve a pasted link (or DOI/ISBN) into citation fields, using free,
 * browser-accessible infrastructure — no API key, no backend of our own:
 *
 *  - Crossref (api.crossref.org) — the scholarly metadata registry Google
 *    Scholar and Zotero read. CORS-enabled, so a DOI resolves to full,
 *    structured citation data straight from the browser. This is the reliable
 *    path for journal articles.
 *  - Open Library (openlibrary.org) — CORS-enabled book metadata by ISBN.
 *  - A public CORS proxy as a last resort for an arbitrary page, whose embedded
 *    citation <meta> tags are then read by parseCitationMetadata.
 *
 * The network call is injected (fetchJson / fetchText), so every mapper and the
 * resolver itself are unit-testable offline with recorded API responses.
 */
import {
  joinAuthors,
  metadataToFields,
  parseCitationMetadata,
  type CitationMetadata,
} from "./metadata";

const firstYear = (s?: string): string | undefined => s?.match(/\b(\d{4})\b/)?.[1];

/** Strip markup and decode the entities Crossref titles sometimes carry. */
function cleanText(value?: string): string | undefined {
  if (!value) return undefined;
  const text = value
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;|&apos;|&rsquo;/g, "’")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/\s+/g, " ")
    .trim();
  return text || undefined;
}

/** Pull a DOI out of a raw string, a doi.org URL, or page text. */
export function extractDoi(input: string): string | null {
  const m = input.match(/10\.\d{4,9}\/[^\s"'<>&]+/i);
  return m ? m[0].replace(/[.,;:)\]]+$/, "") : null;
}

/** Pull an ISBN (10 or 13 digits, optional hyphens) out of a string. */
export function extractIsbn(input: string): string | null {
  const m = input.match(/\b(?:97[89][- ]?)?(?:\d[- ]?){9}[\dxX]\b/);
  return m ? m[0].replace(/[- ]/g, "") : null;
}

export function looksLikeLink(input: string): boolean {
  const t = input.trim();
  return (
    /^https?:\/\//i.test(t) ||
    /^www\./i.test(t) ||
    extractDoi(t) != null ||
    extractIsbn(t) != null
  );
}

/** Map a Crossref `work` message to neutral citation metadata. */
export function crossrefToMetadata(work: any): CitationMetadata {
  const authors: string[] = Array.isArray(work?.author)
    ? work.author
        .map((a: any) =>
          a?.given && a?.family
            ? `${a.given} ${a.family}`
            : a?.family || a?.name || "", // organisation authors carry `name`
        )
        .map((s: string) => cleanText(s) ?? "")
        .filter(Boolean)
    : [];
  const container = cleanText(
    work?.["short-container-title"]?.[0] || work?.["container-title"]?.[0],
  );
  const dateParts =
    work?.issued?.["date-parts"]?.[0] ||
    work?.published?.["date-parts"]?.[0] ||
    work?.["published-print"]?.["date-parts"]?.[0] ||
    work?.["published-online"]?.["date-parts"]?.[0];
  const type: string = work?.type || "";
  return {
    authors,
    title: cleanText(Array.isArray(work?.title) ? work.title[0] : work?.title),
    journal: /journal|article/.test(type) ? container : undefined,
    volume: work?.volume ? String(work.volume) : undefined,
    issue: work?.issue ? String(work.issue) : undefined,
    firstPage: work?.page ? String(work.page).split(/[-–]/)[0].trim() : undefined,
    year: Array.isArray(dateParts) ? String(dateParts[0]) : undefined,
    publisher: work?.publisher,
    doi: work?.DOI,
    kind: /journal|article/.test(type) ? "journal" : "book",
  };
}

/** Map an Open Library `jscmd=data` record to neutral citation metadata. */
export function openLibraryToMetadata(record: any): CitationMetadata {
  return {
    authors: Array.isArray(record?.authors)
      ? record.authors.map((a: any) => a?.name).filter(Boolean)
      : [],
    title: record?.title,
    publisher: Array.isArray(record?.publishers)
      ? record.publishers[0]?.name
      : undefined,
    place: Array.isArray(record?.publish_places)
      ? record.publish_places[0]?.name
      : undefined,
    year: firstYear(record?.publish_date),
    kind: "book",
  };
}

export type ResolvedLink = {
  source: "citoid" | "crossref" | "openlibrary" | "page-metadata" | "url-only";
  metadata: CitationMetadata;
  typeId: string;
  fields: Record<string, string>;
};

/** ISO ("2019-05-03") → "3 May 2019"; other date strings pass through. */
const MONTHS_ = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
function readableDate(raw?: string): string | undefined {
  if (!raw) return undefined;
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const day = Number(iso[3]);
    const month = MONTHS_[Number(iso[2]) - 1];
    if (month && day) return `${day} ${month} ${iso[1]}`;
  }
  return raw.trim();
}

/**
 * Map a Zotero-format item (as returned by the Citoid / Zotero translation
 * server) onto a Style Guide type and its fields. Citoid runs Zotero's
 * translators server-side, so this is the most reliable "link → citation" path.
 */
export function citoidItemToResolved(item: any, sourceUrl?: string): ResolvedLink | null {
  if (!item || typeof item !== "object") return null;
  const creators: any[] = Array.isArray(item.creators) ? item.creators : [];
  const nameOf = (c: any): string =>
    c?.firstName && c?.lastName ? `${c.firstName} ${c.lastName}` : c?.name || c?.lastName || "";
  const authors = creators
    .filter((c) => (c.creatorType ?? "author") === "author")
    .map(nameOf)
    .filter(Boolean);
  const editors = creators.filter((c) => c.creatorType === "editor").map(nameOf).filter(Boolean);
  const author = joinAuthors(authors);
  const year = firstYear(item.date);
  const firstPage = item.pages ? String(item.pages).split(/[-–]/)[0].trim() : undefined;
  const url = item.url ?? sourceUrl;

  const f: Record<string, string> = {};
  const put = (k: string, v?: string) => {
    if (v && v.trim()) f[k] = v.trim();
  };

  let typeId: string;
  switch (item.itemType) {
    case "journalArticle":
      typeId = "journal-article";
      put("author", author);
      put("title", item.title);
      if (year) put("year", `(${year})`);
      put("volume", item.volume);
      put("journalAbbrev", item.publicationTitle);
      put("startingPage", firstPage);
      break;
    case "book":
      typeId = "text-book";
      put("author", author);
      put("title", item.title);
      put("publisher", item.publisher);
      put("placeOfPublication", item.place);
      put("year", year);
      break;
    case "bookSection":
      typeId = "essay-in-edited-book";
      put("author", author);
      put("essayTitle", item.title);
      put("editor", editors.join(" and "));
      put("bookTitle", item.bookTitle);
      put("publisher", item.publisher);
      put("place", item.place);
      put("year", year);
      break;
    case "newspaperArticle":
    case "magazineArticle":
      typeId = "newspaper-magazine-article";
      put("author", author);
      put("articleTitle", item.title);
      put("newspaperTitle", item.publicationTitle);
      put("place", item.place);
      put("date", readableDate(item.date));
      break;
    case "report":
      typeId = "paper-or-report";
      put("author", author);
      put("title", item.title);
      put("publisher", item.publisher || item.institution);
      put("date", readableDate(item.date));
      break;
    default:
      // webpage, blogPost, document, and anything else → internet material.
      typeId = "internet-material";
      put("author", author);
      put("title", item.title);
      put("date", readableDate(item.date));
      put("websiteName", item.websiteTitle || item.publicationTitle);
      put("url", url);
  }
  if (Object.keys(f).length === 0) return null;
  return {
    source: "citoid",
    metadata: { authors, title: item.title, year, url },
    typeId,
    fields: f,
  };
}

/**
 * Last-resort fields derived from the URL alone, for pages that block automated
 * reading (Cloudflare/bot protection returns 403 to every proxy). The slug
 * gives a rough title and the host a website name, so the student still starts
 * with the URL, a title to correct, and the site — and fills author/date.
 */
export function fieldsFromUrl(rawUrl: string): {
  typeId: string;
  fields: Record<string, string>;
} {
  let host = "";
  let slug = "";
  try {
    const u = new URL(/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`);
    host = u.hostname.replace(/^www\./, "");
    const segments = u.pathname.split("/").filter((s) => s && !/^\d+$/.test(s));
    slug = segments[segments.length - 1] ?? "";
  } catch {
    // Not a parseable URL; fall through with what we have.
  }
  const fields: Record<string, string> = { url: rawUrl.trim() };
  const title = slug
    .replace(/\.\w+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
  if (title) fields.title = title;
  if (host) fields.websiteName = host;
  return { typeId: "internet-material", fields };
}

export type Fetchers = {
  fetchJson: (url: string) => Promise<any>;
  fetchText: (url: string) => Promise<string>;
};

const finish = (
  source: ResolvedLink["source"],
  metadata: CitationMetadata,
  sourceUrl?: string,
): ResolvedLink | null => {
  const mapped = metadataToFields(metadata, sourceUrl);
  return mapped ? { source, metadata, ...mapped } : null;
};

/**
 * Resolve an input to a citation. Tries the highest-confidence source first: a
 * DOI (Crossref), then an ISBN (Open Library), then an arbitrary page whose
 * metadata is fetched through a proxy and read for meta tags — and if that page
 * turns out to carry a DOI, one more Crossref lookup.
 */
export async function resolveLink(
  input: string,
  fetchers: Fetchers,
): Promise<ResolvedLink | null> {
  const trimmed = input.trim();

  const doi = extractDoi(trimmed);
  if (doi) {
    const json = await fetchers.fetchJson(
      `https://api.crossref.org/works/${encodeURIComponent(doi)}`,
    );
    if (json?.message) return finish("crossref", crossrefToMetadata(json.message));
  }

  const isbn = extractIsbn(trimmed);
  if (isbn) {
    const json = await fetchers.fetchJson(
      `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`,
    );
    const record = json?.[`ISBN:${isbn}`];
    if (record) return finish("openlibrary", openLibraryToMetadata(record));
  }

  if (/^https?:\/\//i.test(trimmed) || /^www\./i.test(trimmed)) {
    const url = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

    // Citoid (Zotero's translators, hosted free by Wikimedia) is the most
    // capable link reader — try it first.
    try {
      const citoid = await fetchers.fetchJson(
        `https://en.wikipedia.org/api/rest_v1/data/citation/zotero/${encodeURIComponent(url)}`,
      );
      const item = Array.isArray(citoid) ? citoid[0] : null;
      const resolved = citoidItemToResolved(item, url);
      if (resolved && (resolved.fields.title || resolved.fields.author)) return resolved;
    } catch {
      // Citoid unavailable or couldn't read the page — fall through.
    }

    let html: string | null = null;
    try {
      html = await fetchers.fetchText(url);
    } catch {
      html = null; // page blocked the proxy — fall back to URL-derived fields
    }
    if (html) {
      const meta = parseCitationMetadata(html);
      if (meta.title || meta.authors.length) return finish("page-metadata", meta, url);
      // The page had no citation tags but may reference a DOI.
      const pageDoi = extractDoi(html);
      if (pageDoi) {
        const json = await fetchers.fetchJson(
          `https://api.crossref.org/works/${encodeURIComponent(pageDoi)}`,
        );
        if (json?.message) return finish("crossref", crossrefToMetadata(json.message));
      }
    }
    // Could not read the page — derive what we can from the URL so the student
    // always gets a starting point rather than an empty result.
    const derived = fieldsFromUrl(url);
    return { source: "url-only", metadata: { authors: [] }, ...derived };
  }

  return null;
}

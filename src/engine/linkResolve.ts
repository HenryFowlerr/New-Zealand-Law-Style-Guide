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
  metadataToFields,
  parseCitationMetadata,
  type CitationMetadata,
} from "./metadata";

const firstYear = (s?: string): string | undefined => s?.match(/\b(\d{4})\b/)?.[1];

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
            : a?.family || a?.name || "",
        )
        .filter(Boolean)
    : [];
  const container =
    work?.["short-container-title"]?.[0] || work?.["container-title"]?.[0];
  const dateParts =
    work?.issued?.["date-parts"]?.[0] ||
    work?.published?.["date-parts"]?.[0] ||
    work?.["published-print"]?.["date-parts"]?.[0] ||
    work?.["published-online"]?.["date-parts"]?.[0];
  const type: string = work?.type || "";
  return {
    authors,
    title: Array.isArray(work?.title) ? work.title[0] : work?.title,
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
  source: "crossref" | "openlibrary" | "page-metadata";
  metadata: CitationMetadata;
  typeId: string;
  fields: Record<string, string>;
};

export type Fetchers = {
  fetchJson: (url: string) => Promise<any>;
  fetchText: (url: string) => Promise<string>;
};

const finish = (
  source: ResolvedLink["source"],
  metadata: CitationMetadata,
): ResolvedLink | null => {
  const mapped = metadataToFields(metadata);
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
    const html = await fetchers.fetchText(url);
    const meta = parseCitationMetadata(html);
    if (meta.title || meta.authors.length) return finish("page-metadata", meta);
    // The page had no citation tags but may reference a DOI.
    const pageDoi = extractDoi(html);
    if (pageDoi) {
      const json = await fetchers.fetchJson(
        `https://api.crossref.org/works/${encodeURIComponent(pageDoi)}`,
      );
      if (json?.message) return finish("crossref", crossrefToMetadata(json.message));
    }
  }

  return null;
}

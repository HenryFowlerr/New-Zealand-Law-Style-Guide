/**
 * Citation metadata parser for the "paste a link" flow.
 *
 * Most journal, court and publisher pages embed machine-readable citation
 * metadata in the document head — the Highwire Press tags Google Scholar reads
 * (`citation_title`, `citation_author`, `citation_journal_title`,
 * `citation_volume`, `citation_firstpage`, `citation_publication_date`, …),
 * Dublin Core (`DC.title`, `DC.creator`, `DC.date`), and Open Graph as a last
 * resort. This module reads that metadata out of raw HTML — no DOM, so it runs
 * the same in a test and in the browser — and maps it onto the engine's fields.
 *
 * The network fetch that obtains the HTML is a separate concern: a static site
 * cannot fetch a third-party page directly (CORS), so the caller supplies the
 * HTML (via a small proxy/serverless endpoint, or a paste of the page source).
 * Keeping the parser pure means it is fully testable offline and reusable
 * whatever the fetch story becomes.
 */

/** Neutral metadata read from a page, before mapping to a specific type. */
export type CitationMetadata = {
  authors: string[];
  title?: string;
  journal?: string;
  volume?: string;
  issue?: string;
  firstPage?: string;
  date?: string;
  year?: string;
  publisher?: string;
  place?: string;
  siteName?: string;
  url?: string;
  doi?: string;
  /** Inferred from which signals are present. */
  kind?: "journal" | "book" | "web";
};

const decodeEntities = (s: string): string =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;|&apos;|&rsquo;/g, "’")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .trim();

/**
 * Pull every `<meta name=… content=…>` (or `property=…`) pair out of HTML,
 * tolerant of attribute order and of single or double quotes. Returns a map of
 * lower-cased name → list of contents (a page may repeat `citation_author`).
 */
export function readMetaTags(html: string): Map<string, string[]> {
  const tags = new Map<string, string[]>();
  const metaRe = /<meta\b[^>]*>/gi;
  const attrRe = /(name|property)\s*=\s*("([^"]*)"|'([^']*)')/i;
  const contentRe = /content\s*=\s*("([^"]*)"|'([^']*)')/i;
  for (const tag of html.match(metaRe) ?? []) {
    const nameMatch = tag.match(attrRe);
    const contentMatch = tag.match(contentRe);
    if (!nameMatch || !contentMatch) continue;
    const name = (nameMatch[3] ?? nameMatch[4] ?? "").toLowerCase().trim();
    const content = decodeEntities(contentMatch[2] ?? contentMatch[3] ?? "");
    if (!name || !content) continue;
    const list = tags.get(name) ?? [];
    list.push(content);
    tags.set(name, list);
  }
  return tags;
}

const firstOf = (tags: Map<string, string[]>, ...names: string[]): string | undefined => {
  for (const name of names) {
    const list = tags.get(name);
    if (list && list.length && list[0].trim()) return list[0].trim();
  }
  return undefined;
};

/** Collect all values for the first name that has any (e.g. every author tag). */
const allOf = (tags: Map<string, string[]>, ...names: string[]): string[] => {
  for (const name of names) {
    const list = tags.get(name);
    if (list && list.length) return list.map((s) => s.trim()).filter(Boolean);
  }
  return [];
};

/** Join a list of author names into a single NZLSG-style author string. */
export function joinAuthors(authors: string[]): string {
  // Highwire authors are often "Surname, Given"; flip to "Given Surname".
  const flip = (name: string): string => {
    const parts = name.split(",");
    if (parts.length === 2) return `${parts[1].trim()} ${parts[0].trim()}`.trim();
    return name.trim();
  };
  const flipped = authors.map(flip).filter(Boolean);
  if (flipped.length === 0) return "";
  if (flipped.length === 1) return flipped[0];
  if (flipped.length === 2) return `${flipped[0]} and ${flipped[1]}`;
  return `${flipped.slice(0, -1).join(", ")} and ${flipped[flipped.length - 1]}`;
}

const yearFrom = (date?: string): string | undefined => {
  const m = date?.match(/\b(\d{4})\b/);
  return m ? m[1] : undefined;
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Render an ISO date ("2019-05-03T…") as "3 May 2019"; pass others through. */
export function formatDate(raw?: string): string | undefined {
  if (!raw) return undefined;
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const day = Number(iso[3]);
    const month = MONTHS[Number(iso[2]) - 1];
    if (month && day) return `${day} ${month} ${iso[1]}`;
  }
  return raw.trim();
}

/** A schema.org node's author(s) may be a string, an object, or an array. */
function jsonLdAuthors(author: unknown): string[] {
  const one = (a: unknown): string =>
    typeof a === "string" ? a : a && typeof a === "object" ? String((a as any).name ?? "") : "";
  if (Array.isArray(author)) return author.map(one).filter(Boolean);
  const s = one(author);
  return s ? [s] : [];
}

const ARTICLE_TYPES =
  /article|newsarticle|blogposting|report|scholarly|techarticle|webpage|creativework|book/i;

/**
 * Read schema.org metadata from JSON-LD blocks — where most news, blog and many
 * publisher pages actually keep author/title/date, absent the academic
 * `citation_*` tags. Returns the first article-like node found.
 */
export function parseJsonLd(html: string): Partial<CitationMetadata> {
  const blocks = html.match(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );
  if (!blocks) return {};
  const nodes: any[] = [];
  for (const block of blocks) {
    const json = block.replace(/^<script[^>]*>/i, "").replace(/<\/script>$/i, "").trim();
    try {
      const parsed = JSON.parse(json);
      const list = Array.isArray(parsed) ? parsed : parsed["@graph"] ? parsed["@graph"] : [parsed];
      for (const n of list) if (n && typeof n === "object") nodes.push(n);
    } catch {
      // Ignore malformed JSON-LD; other blocks or meta tags may still work.
    }
  }
  const typeOf = (n: any): string =>
    Array.isArray(n["@type"]) ? n["@type"].join(" ") : String(n["@type"] ?? "");
  const node =
    nodes.find((n) => ARTICLE_TYPES.test(typeOf(n))) ??
    nodes.find((n) => n.headline || n.name);
  if (!node) return {};
  const partOf = node.isPartOf ?? node.publication;
  return {
    title: decodeEntities(String(node.headline ?? node.name ?? "")) || undefined,
    authors: jsonLdAuthors(node.author).map(decodeEntities),
    date: formatDate(node.datePublished ?? node.dateCreated ?? node.dateModified),
    publisher:
      typeof node.publisher === "object" ? node.publisher?.name : node.publisher,
    journal: partOf && typeof partOf === "object" ? partOf.name : undefined,
    siteName:
      (typeof node.publisher === "object" ? node.publisher?.name : undefined) || undefined,
  };
}

/** Read neutral citation metadata from raw HTML. */
export function parseCitationMetadata(html: string): CitationMetadata {
  const tags = readMetaTags(html);
  const ld = parseJsonLd(html);
  const journal =
    firstOf(tags, "citation_journal_title", "prism.publicationname") || ld.journal;
  // Meta tags win where present (academic pages are authoritative); JSON-LD and
  // Open Graph fill the gaps for news/blog pages that lack citation_* tags.
  const md: CitationMetadata = {
    authors: firstNonEmpty(
      allOf(tags, "citation_author", "dc.creator", "citation_authors", "author"),
      allOf(tags, "article:author", "parsely-author", "sailthru.author"),
      ld.authors ?? [],
    ),
    title:
      firstOf(tags, "citation_title", "dc.title") ||
      ld.title ||
      firstOf(tags, "og:title", "twitter:title") ||
      titleTag(html),
    journal,
    volume: firstOf(tags, "citation_volume", "prism.volume"),
    issue: firstOf(tags, "citation_issue", "prism.number"),
    firstPage: firstOf(tags, "citation_firstpage", "prism.startingpage"),
    date:
      firstOf(
        tags,
        "citation_publication_date",
        "citation_date",
        "dc.date",
        "prism.publicationdate",
        "article:published_time",
        "dc.date.issued",
      ) || ld.date,
    publisher: firstOf(tags, "citation_publisher", "dc.publisher") || ld.publisher,
    siteName: firstOf(tags, "og:site_name") || ld.siteName,
    url: firstOf(tags, "og:url", "citation_public_url"),
    doi: firstOf(tags, "citation_doi", "dc.identifier.doi"),
  };
  md.date = formatDate(md.date);
  md.year = yearFrom(md.date);
  // A single author tag may itself hold several names joined by ";" or "and".
  // A lone comma is left intact — Highwire authors are "Surname, Given".
  if (md.authors.length === 1 && /;|\band\b/.test(md.authors[0])) {
    md.authors = md.authors[0].split(/\s*;\s*|\s+and\s+/).map((s) => s.trim()).filter(Boolean);
  }
  md.kind = journal
    ? "journal"
    : firstOf(tags, "citation_isbn", "citation_book_title")
      ? "book"
      : md.title
        ? "web"
        : undefined;
  return md;
}

const firstNonEmpty = (...lists: string[][]): string[] =>
  lists.find((l) => l.length > 0) ?? [];

/** The document <title>, minus a trailing " | Site" / " - Site" suffix. */
function titleTag(html: string): string | undefined {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!m) return undefined;
  const text = decodeEntities(m[1].replace(/\s+/g, " ")).replace(/\s*[|–—-]\s*[^|–—-]{2,40}$/, "");
  return text.trim() || undefined;
}

/**
 * Map neutral metadata onto a suggested engine type and its fields. Chooses a
 * journal article when a journal title is present, otherwise a book. Only the
 * fields the metadata actually supports are returned; the user fills the rest.
 */
export function metadataToFields(
  md: CitationMetadata,
  sourceUrl?: string,
): { typeId: string; fields: Record<string, string> } | null {
  const author = joinAuthors(md.authors);
  if (md.kind === "journal" || md.journal) {
    const fields: Record<string, string> = {};
    if (author) fields.author = author;
    if (md.title) fields.title = md.title;
    if (md.year) fields.year = `(${md.year})`;
    if (md.volume) fields.volume = md.volume;
    if (md.journal) fields.journalAbbrev = md.journal;
    if (md.firstPage) fields.startingPage = md.firstPage;
    return Object.keys(fields).length ? { typeId: "journal-article", fields } : null;
  }
  if (md.kind === "book") {
    const fields: Record<string, string> = {};
    if (author) fields.author = author;
    if (md.title) fields.title = md.title;
    if (md.publisher) fields.publisher = md.publisher;
    if (md.place) fields.placeOfPublication = md.place;
    if (md.year) fields.year = md.year;
    return Object.keys(fields).length ? { typeId: "text-book", fields } : null;
  }
  // A general web article/blog/working paper → internet material.
  const fields: Record<string, string> = {};
  if (author) fields.author = author;
  if (md.title) fields.title = md.title;
  if (md.date) fields.date = md.date;
  if (md.siteName) fields.websiteName = md.siteName;
  const url = md.url ?? sourceUrl;
  if (url) fields.url = url;
  return Object.keys(fields).length ? { typeId: "internet-material", fields } : null;
}

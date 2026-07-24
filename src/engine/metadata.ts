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
  doi?: string;
  /** "journal" | "book" | undefined — inferred from which tags are present. */
  kind?: "journal" | "book";
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

/** Read neutral citation metadata from raw HTML. */
export function parseCitationMetadata(html: string): CitationMetadata {
  const tags = readMetaTags(html);
  const journal = firstOf(tags, "citation_journal_title", "prism.publicationname");
  const md: CitationMetadata = {
    authors: allOf(tags, "citation_author", "dc.creator", "citation_authors", "author"),
    title: firstOf(tags, "citation_title", "dc.title", "og:title", "twitter:title"),
    journal,
    volume: firstOf(tags, "citation_volume", "prism.volume"),
    issue: firstOf(tags, "citation_issue", "prism.number"),
    firstPage: firstOf(tags, "citation_firstpage", "prism.startingpage"),
    date: firstOf(tags, "citation_publication_date", "citation_date", "dc.date", "prism.publicationdate"),
    publisher: firstOf(tags, "citation_publisher", "dc.publisher"),
    doi: firstOf(tags, "citation_doi", "dc.identifier.doi"),
  };
  md.year = yearFrom(md.date);
  // A single author tag may itself hold several names.
  if (md.authors.length === 1 && /;|\band\b/.test(md.authors[0])) {
    md.authors = md.authors[0].split(/\s*;\s*|\s+and\s+/).map((s) => s.trim()).filter(Boolean);
  }
  md.kind = journal ? "journal" : firstOf(tags, "citation_isbn", "citation_publisher") ? "book" : undefined;
  return md;
}

/**
 * Map neutral metadata onto a suggested engine type and its fields. Chooses a
 * journal article when a journal title is present, otherwise a book. Only the
 * fields the metadata actually supports are returned; the user fills the rest.
 */
export function metadataToFields(md: CitationMetadata): {
  typeId: string;
  fields: Record<string, string>;
} | null {
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
  // Fall back to a book/authored text.
  const fields: Record<string, string> = {};
  if (author) fields.author = author;
  if (md.title) fields.title = md.title;
  if (md.publisher) fields.publisher = md.publisher;
  if (md.place) fields.placeOfPublication = md.place;
  if (md.year) fields.year = md.year;
  return Object.keys(fields).length ? { typeId: "text-book", fields } : null;
}

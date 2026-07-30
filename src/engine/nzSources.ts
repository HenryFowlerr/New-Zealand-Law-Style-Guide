/**
 * Recognise the places New Zealand law actually lives online.
 *
 * The generic link resolvers — Crossref for a DOI, Open Library for an ISBN,
 * Citoid for an arbitrary page — are built for scholarship, and they read a
 * judgment or an Act as a *web page*. So pasting the official source of the
 * Evidence Act produced
 *
 *   “DLM393463” legislation.govt.nz <https://www.legislation.govt.nz/act/…>.
 *
 * which is a correctly formatted citation of the wrong kind. Rule 4.1.1 cites an
 * Act by short title and year and gives it no URL at all; a student who copied
 * that into an essay would be marked down for every statute they cited, and
 * nothing about the output would look wrong.
 *
 * A New Zealand legal URL is far more informative than a generic one, because
 * these two sites encode the citation in the path:
 *
 *   legislation.govt.nz/act/public/2006/0069/latest/DLM393463.html
 *      → an Act of 2006; the short title comes from the page's own <title>
 *   nzlii.org/nz/cases/NZSC/2008/55.html
 *      → [2008] NZSC 55; the case name comes from the page's <title>
 *
 * So this module reads the URL first, deterministically and offline, and then
 * takes only what it still needs from the page title. Two consequences worth
 * stating: the type is decided by the URL, never guessed from page text, and a
 * page that cannot be fetched still yields a real citation skeleton of the right
 * kind rather than a webpage citation of the wrong one.
 */

export type NzSourceMatch = {
  typeId: string;
  /** What the URL alone establishes. */
  fields: Record<string, string>;
  /** Which site matched, for the message shown to the reader. */
  source: string;
  /**
   * How to fold in the page's <title> when one can be read. Returns the fields
   * to merge; never removes what the URL already established.
   */
  fromTitle?: (title: string) => Record<string, string>;
  /**
   * Does this page title corroborate what the URL already established? A title
   * that does not is not this document's title, and must be discarded.
   */
  corroborates?: (title: string) => boolean;
  /** Components the reader must still supply, named for the interface. */
  stillNeeded?: string[];
  /**
   * Set where the site is recognised but a link to it can never yield a citation:
   * a subscription database whose URL is a session token and whose page cannot be
   * read. The right answer is to say so, not to produce something.
   */
  unresolvable?: string;
};

/**
 * Subscription databases. A student doing an assignment lives in these, and will
 * paste one of their links.
 *
 * Their URLs carry no citation — westlaw.co.nz/maf/wlnz/app/document?docguid=…
 * is a session-scoped document id — and the page is behind a login, so nothing
 * can be read from either. Every one of them therefore came out as "internet
 * material": a case or an article cited as a web page, with a database URL in it,
 * which no rule of the Guide permits.
 *
 * There is nothing to extract, so the honest answer is to name the database and
 * ask for the reference text, which is sitting on the student's screen. That is
 * strictly more useful than a citation they would have to throw away.
 */
const SUBSCRIPTION_DATABASES: { pattern: RegExp; name: string }[] = [
  { pattern: /(^|\.)westlaw\.(co\.nz|com)$/i, name: "Westlaw" },
  { pattern: /(^|\.)(lexisnexis|lexis)\.(co\.nz|com)$/i, name: "LexisNexis" },
  { pattern: /(^|\.)advance\.lexis\.com$/i, name: "Lexis Advance" },
  { pattern: /(^|\.)cch\.co\.nz$/i, name: "CCH" },
  { pattern: /(^|\.)checkpoint(nz)?\.thomsonreuters\.com$/i, name: "Checkpoint" },
  { pattern: /(^|\.)brookersonline\.co\.nz$/i, name: "Brookers Online" },
  { pattern: /(^|\.)thomsonreuters\.co\.nz$/i, name: "Thomson Reuters" },
];

/**
 * A title that belongs to a challenge, error or consent page rather than to the
 * document. Fetching through a public CORS proxy hits these routinely.
 *
 * This list is a courtesy, not the defence. The defence is corroboration: a title
 * is only used when it agrees with what the URL already told us. Without that, a
 * Cloudflare interstitial served in place of an NZLII judgment produced
 *
 *   Just a moment... [2008] NZSC 55.
 *
 * — the neutral citation correct, the parties replaced by the name of a holding
 * page, and nothing about it looking wrong.
 */
const INTERSTITIAL_TITLE =
  /^\s*(just a moment|attention required|access denied|are you a robot|please wait|checking your browser|error|not found|forbidden|\d{3}\b|captcha|security check|one more step|redirecting)/i;

/** The court codes NZLII and courtsofnz.govt.nz use in a neutral citation. */
const NZ_COURT_CODES = new Set([
  "NZSC",
  "NZCA",
  "NZHC",
  "NZDC",
  "NZFC",
  "NZEnvC",
  "NZEmpC",
  "NZERA",
  "NZACC",
  "NZHRRT",
  "NZLCDT",
  "NZLVT",
  "NZTRA",
  "NZIACDT",
  "NZREADT",
  "NZCOP",
  "NZSSAA",
  "NZIPT",
]);

/**
 * Strip a site's own name from a page title. Every one of these sites appends
 * it, and the separator differs, so the title is cut at the last one.
 */
function pageTitleOnly(title: string): string {
  return title
    .replace(/\s*[|–—]\s*(New Zealand Legislation|New Zealand Gazette|NZLII|Courts of New Zealand)\s*$/i, "")
    .replace(/\s*[|–—]\s*[^|–—]{0,40}$/, (match, offset: number) =>
      // Only drop a trailing segment that looks like a site name, never part of
      // a case name or an Act's title.
      /legislation|nzlii|court|govt\.nz|\.org/i.test(match) ? "" : match,
    )
    .trim();
}

/** Split "Evidence Act 2006" into its short title and the year that closes it. */
function splitTrailingYear(title: string): { name: string; year: string } | null {
  // The LAST four-digit year, because an amending instrument names the Act it
  // amends inside its own title: "District Courts (Lawyers and Conveyancers Act
  // 2006) Amendment Rules 2008" is a 2008 instrument, not a 2006 one.
  const match = title.match(/^(.*?)\s+((?:1[6-9]|20)\d{2})\s*$/);
  if (!match) return null;
  const name = match[1].trim().replace(/[,:]$/, "");
  return name ? { name, year: match[2] } : null;
}

/**
 * Read a New Zealand Legislation URL.
 *
 * The path says what kind of instrument it is and what year it belongs to:
 *   /act/public/2006/0069/…        an Act
 *   /regulation/public/2008/0197/… a legislative instrument
 *   /bill/government/2020/0271/…   a Bill
 */
function legislationGovtNz(pathname: string): NzSourceMatch | null {
  const match = pathname.match(
    /^\/(act|regulation|bill)\/(?:public|local|private|government|member|imperial)\/((?:1[6-9]|20)\d{2})\b/i,
  );
  if (!match) return null;
  const kind = match[1].toLowerCase();
  const year = match[2];

  if (kind === "bill") {
    return {
      typeId: "bill",
      fields: { year },
      source: "New Zealand Legislation",
      // A Bill's citation needs the number it was introduced under, which the
      // path's internal id is not — so it is asked for rather than invented.
      stillNeeded: ["shortTitle", "billNumber"],
      corroborates: (title) => splitTrailingYear(pageTitleOnly(title))?.year === year,
      fromTitle: (title): Record<string, string> => {
        const split = splitTrailingYear(pageTitleOnly(title));
        return split ? { shortTitle: split.name, year: split.year } : {};
      },
    };
  }

  // A regulation, rule or order is a legislative instrument under rule 4.3.1.
  const typeId = kind === "act" ? "nz-statute" : "legislative-instrument";
  const titleField = kind === "act" ? "shortTitle" : "title";
  return {
    typeId,
    fields: { year },
    source: "New Zealand Legislation",
    stillNeeded: [titleField],
    // The title must end with the same year the path gave. A holding page, a
    // search page or a redirect does not, and is discarded rather than believed.
    corroborates: (title) => splitTrailingYear(pageTitleOnly(title))?.year === year,
    fromTitle: (title): Record<string, string> => {
      const split = splitTrailingYear(pageTitleOnly(title));
      if (!split) return {};
      return { [titleField]: split.name, year: split.year };
    },
  };
}

/**
 * Read a New Zealand Gazette notice: gazette.govt.nz/notice/id/2018-go941
 *
 * The path's id IS the notice number rule 5.2.4 requires from October 2017
 * onwards, and the page title carries the notice's own title in front of it:
 *
 *   Declaration of State of Local Emergency - 2018-go941 | New Zealand Gazette
 *
 * The publication DATE is not in either. The date printed in the page body is the
 * date of the thing declared, not the date the Gazette published it, so it is
 * asked for rather than taken from the body and quietly got wrong.
 */
function gazetteGovtNz(pathname: string): NzSourceMatch | null {
  const match = pathname.match(/\/notice\/id\/([\w-]+)/i);
  if (!match) return null;
  const id = match[1];
  return {
    typeId: "nz-gazette",
    fields: { noticeNumber: `No ${id}` },
    source: "New Zealand Gazette",
    stillNeeded: ["title", "date"],
    corroborates: (title) => title.toLowerCase().includes(id.toLowerCase()),
    fromTitle: (title): Record<string, string> => {
      const name = pageTitleOnly(title)
        .replace(new RegExp(`\\s*[-–—]\\s*${escapeForRegExp(id)}\\s*$`, "i"), "")
        .trim();
      return name ? { title: name } : {};
    },
  };
}

const escapeForRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Read the citation out of an NZLII page title.
 *
 * NZLII titles carry the whole reference, and where a case is also reported they
 * carry the parallel citation too:
 *
 *   Z v Dental Complaints Assessment Committee [2008] NZSC 55; [2009] 1 NZLR 1 (25 July 2008)
 *   Erwood v Ministry of Social Development [2010] NZCA 619 (16 December 2010)
 *
 * Rule 3.2 prefers the reported citation where one exists, with the neutral
 * citation in front of it; rule 3.3 covers the unreported case.
 */
export function nzliiTitleToFields(
  title: string,
  fallback: { year: string; court: string; number: string },
): { typeId: string; fields: Record<string, string> } {
  const cleaned = title
    .replace(/\s*\((?:\d{1,2}\s+\w+\s+\d{4})\)\s*$/, "") // the judgment date
    .trim();
  const neutral = `[${fallback.year}] ${fallback.court} ${fallback.number}`;
  const caseName = cleaned
    .split(/\s*\[\d{4}\]/)[0]
    .replace(/[;,]\s*$/, "")
    .trim();

  // A parallel reported citation, after the semicolon NZLII uses: "[2009] 1 NZLR 1".
  const reported = cleaned.match(
    /;\s*([[(]\d{4}[\])])\s+(\d+)\s+([A-Z][A-Za-z]*(?:\s[A-Z][A-Za-z]*)*)\s+(\d+)/,
  );
  if (reported && caseName) {
    return {
      typeId: "reported-case-nz",
      fields: {
        caseName,
        neutralCitation: neutral,
        year: reported[1],
        volume: reported[2],
        reportSeries: reported[3].trim(),
        startingPage: reported[4],
      },
    };
  }
  return {
    typeId: "neutral-citation-case-nz",
    fields: {
      ...(caseName ? { caseName } : {}),
      year: fallback.year,
      courtIdentifier: fallback.court,
      judgmentNumber: fallback.number,
    },
  };
}

/** Read an NZLII judgment URL: /nz/cases/{COURT}/{year}/{number}.html */
function nzlii(pathname: string): NzSourceMatch | null {
  const match = pathname.match(
    /\/(?:nz|au|uk|ie|ca)\/cases\/([A-Za-z]+)\/((?:1[6-9]|20)\d{2})\/(\d+)\b/,
  );
  if (!match) return null;
  const court = match[1];
  const fallback = { year: match[2], court, number: match[3] };
  const bare = nzliiTitleToFields("", fallback);
  return {
    typeId: bare.typeId,
    fields: bare.fields,
    source: "NZLII",
    stillNeeded: ["caseName"],
    // The path already IS the neutral citation, so the page title has to contain
    // it. Anything else — a Cloudflare interstitial, a search result, the site's
    // front page — is not this judgment's title.
    corroborates: (title) =>
      new RegExp(`\\[\\s*${fallback.year}\\s*\\]\\s*${fallback.court}\\s+${fallback.number}\\b`, "i").test(title),
    fromTitle: (title) => nzliiTitleToFields(title, fallback).fields,
  };
}

/**
 * Read a judgment published on the Courts of New Zealand site, whose file name
 * is the neutral citation: /assets/cases/2019/2019-NZSC-40.pdf
 */
function courtsOfNz(pathname: string): NzSourceMatch | null {
  const match = pathname.match(/\b((?:1[6-9]|20)\d{2})[-_ ]?(NZ[A-Za-z]+)[-_ ]?(\d+)\b/);
  if (!match) return null;
  const court = match[2];
  if (!NZ_COURT_CODES.has(court)) return null;
  return {
    typeId: "neutral-citation-case-nz",
    fields: { year: match[1], courtIdentifier: court, judgmentNumber: match[3] },
    source: "Courts of New Zealand",
    // The file name gives the citation but not the parties, and a PDF's title is
    // not reliable, so the case name is asked for.
    stillNeeded: ["caseName"],
  };
}

/** Read a Law Commission publication: the author and series are fixed. */
function lawCommission(): NzSourceMatch {
  return {
    typeId: "law-commission-report",
    fields: { author: "Law Commission" },
    source: "Law Commission",
    stillNeeded: ["title", "officialCitation", "year"],
    fromTitle: (title) => {
      const cleaned = pageTitleOnly(title).replace(/\s*[|–—]\s*Law Commission\s*$/i, "").trim();
      // A report names its series designation in brackets or after a dash:
      // "Review of the Law of Trusts (NZLC R130)".
      const series = cleaned.match(/\b(NZLC\s+(?:R|SP|IP|PP|OP)?\d+)\b/i);
      const name = cleaned.replace(/\s*\(?\bNZLC\s+\w*\d+\)?/i, "").replace(/[(),\s]+$/, "").trim();
      return {
        ...(name ? { title: name } : {}),
        ...(series ? { officialCitation: series[1].replace(/\s+/g, " ") } : {}),
      };
    },
  };
}

/** Read a Waitangi Tribunal report: the author is fixed, the Wai number is not. */
function waitangiTribunal(): NzSourceMatch {
  return {
    typeId: "waitangi-tribunal-report",
    fields: { author: "Waitangi Tribunal" },
    source: "Waitangi Tribunal",
    stillNeeded: ["title", "waiNumber", "year"],
    fromTitle: (title) => {
      const cleaned = pageTitleOnly(title);
      const wai = cleaned.match(/\bWai\s+(\d+)\b/i);
      const name = cleaned.replace(/\s*\(?\bWai\s+\d+\)?/i, "").replace(/[(),\s]+$/, "").trim();
      return {
        ...(name ? { title: name } : {}),
        ...(wai ? { waiNumber: wai[1] } : {}),
      };
    },
  };
}

/**
 * Recognise a New Zealand legal source from its URL alone.
 *
 * Returns null for anything unrecognised, so the generic resolvers keep the
 * whole of the rest of the web.
 */
export function recogniseNzSource(rawUrl: string): NzSourceMatch | null {
  let host = "";
  let pathname = "";
  try {
    const url = new URL(/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`);
    host = url.hostname.replace(/^www\./i, "").toLowerCase();
    pathname = decodeURIComponent(url.pathname);
  } catch {
    return null;
  }

  for (const database of SUBSCRIPTION_DATABASES) {
    if (database.pattern.test(host)) {
      return {
        typeId: "",
        fields: {},
        source: database.name,
        unresolvable: `${database.name} needs a login, and its web address is a session id rather than a citation — there is nothing in the link to read.`,
      };
    }
  }
  if (host === "legislation.govt.nz") return legislationGovtNz(pathname);
  if (host === "gazette.govt.nz") return gazetteGovtNz(pathname);
  if (host.endsWith("nzlii.org") || host.endsWith("austlii.edu.au") || host.endsWith("bailii.org")) {
    return nzlii(pathname);
  }
  if (host === "courtsofnz.govt.nz") return courtsOfNz(pathname);
  if (host === "lawcom.govt.nz") return lawCommission();
  if (host === "waitangitribunal.govt.nz") return waitangiTribunal();
  return null;
}

/** Fold a page title into a URL match, keeping everything the URL established. */
export function applyPageTitle(
  match: NzSourceMatch,
  pageTitle: string,
): { typeId: string; fields: Record<string, string>; stillNeeded: string[] } {
  const merged = { ...match.fields };
  const title = pageTitle.trim();
  const trustworthy =
    Boolean(title) &&
    !INTERSTITIAL_TITLE.test(title) &&
    (match.corroborates ? match.corroborates(title) : true);
  if (match.fromTitle && trustworthy) {
    for (const [id, value] of Object.entries(match.fromTitle(title))) {
      if (value?.trim()) merged[id] = value.trim();
    }
  }
  // An NZLII title can turn an unreported case into a reported one, so the type
  // is re-read from the merged fields rather than fixed by the URL alone.
  const typeId =
    match.source === "NZLII" && merged.reportSeries ? "reported-case-nz" : match.typeId;
  return {
    typeId,
    fields: merged,
    stillNeeded: (match.stillNeeded ?? []).filter((id) => !merged[id]?.trim()),
  };
}

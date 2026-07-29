/**
 * Shape-based anchor scanner for pasted references.
 *
 * Template extraction (render.ts) is positional: it threads one regex through a
 * type's template and, for a plain-text paste with no italics, cannot reliably
 * tell where a case name ends and a citation begins — so values land in the
 * wrong boxes even when the whole string round-trips.
 *
 * This module takes the opposite, complementary approach: it recognises the
 * fields that have a DISTINCTIVE, self-identifying shape — a neutral citation,
 * a reporter locus, a pinpoint, an edition, a quoted title, an "X v Y" case
 * name — anywhere in the text, independent of any one type's template. Those
 * high-confidence anchors are then mapped onto whichever components a given
 * type actually has, and the free text left over (author / title / case name)
 * is carved from the region before the first anchor.
 *
 * The scanner never fabricates: it only reports a field when the text shows its
 * shape. Callers overlay these anchors on top of positional extraction, so a
 * confident anchor corrects a mis-split while everything else is left alone.
 */
import type { GuideType } from "../data/styleGuide.ts";
import { splitAuthor } from "./names.ts";

export type Anchor = {
  kind:
    | "neutral"
    | "reporter"
    | "pinpoint"
    | "edition"
    | "year"
    | "date"
    | "caseName"
    | "quotedTitle";
  /** Sub-values a structured anchor yields, keyed by a neutral role name. */
  parts: Record<string, string>;
  /** Character span in the source text, used to locate the free-text head. */
  start: number;
  end: number;
};

// A neutral citation: [year] COURT [division] number — letters immediately
// after the year, then a number (e.g. "[2008] NZSC 55", "[2019] EWCA Civ 20").
const NEUTRAL = /\[\d{4}\]\s+[A-Z][A-Za-z]{1,6}(?:\s+[A-Z][A-Za-z]{1,6})*\s+\d+[A-Za-z]?/;

// A reporter / journal locus: (year) volume SERIES page — a DIGIT volume
// between the year and a letters series (e.g. "[2009] 1 NZLR 1", "(2005) 121
// LQR 163"). The bracket style of the year is preserved for the caller.
const REPORTER =
  /([[(]\d{4}[\])])\s+(\d+)\s+([A-Z][A-Za-z]*(?:\s[A-Z][A-Za-z]*)*)\s+(\d+)/;

// The same locus without a volume number — "[1932] AC 562". Restricted to named
// law report series so a case name can never be mistaken for a series.
const REPORT_SERIES_NO_VOLUME =
  /([[(]\d{4}[\])])\s+(AC|QB|KB|Ch|WLR|All ER|ER|App Cas|NZLR|CLR|SLT|SC|DLR|SCR|Fam|P|Lloyd's Rep)\s+(\d+)/;

// A pinpoint introduced by "at". Beyond a plain page or paragraph — "at [26]",
// "at 165", "at 9.60", "at 12–14" — the Guide's own examples attach a footnote
// ("at 189, n 92"), a chapter ("at ch 1") and bracketed locators that are not
// purely numeric ("at [ED1.01(2)]", "at [38–033]"). Requiring digits alone
// silently dropped the footnote from Burrows on Restitution.
const PINPOINT_AT =
  /\bat\s+(\[[\dA-Za-z.()\u2013\u2014-]+\]|ch\s+\d+|\d+(?:[-\u2013]\d+)?(?:\.\d+)?(?:,\s*n\s*\d+)?)/;

// A legislation pinpoint: a trailing division reference — "s 8", "ss 3–5",
// "sch 2", "pt 1", "art 5", "reg 4", "cl 2" — usually after a comma.
const PINPOINT_DIV =
  /,\s*((?:ss?|sch|pt|arts?|regs?|cls?|ch|SO)\s+[\dA-Za-z]+(?:[-–(][\dA-Za-z)]+)*.*?|long title|preamble|schedule)\s*\.?\s*$/i;

// An edition: "2nd ed", "3rd ed", "rev ed", and the standing editions a
// looseleaf service or an online commentary carries instead of a number —
// without those, rule 6.3 could never be completed and the tool simply refused
// to generate a citation for any looseleaf or online text.
const EDITION =
  /\b(\d{1,2}(?:st|nd|rd|th)\s+ed|rev\s+ed|looseleaf\s+ed|online\s+ed|eBook\s+ed)\b/i;

// A court file / docket number: "CA339/03", "CRI-2007-020-2820",
// "CIV-2007-409-2659", "CIV 7/2004", "AA506/10".
const DOCKET =
  /\b[A-Z]{2,4}[\s-]?\d+(?:[-/]\d+)+\b/;

const escapeReg = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const MONTHS =
  "January|February|March|April|May|June|July|August|September|October|November|December";

// A full date: "3 August 2004", "21 September 2010".
const DATE = new RegExp(`\\b(\\d{1,2}\\s+(?:${MONTHS})\\s+\\d{4})\\b`);

// Where a citation begins after a case name: a bracketed year, a court/report
// abbreviation immediately followed by a number ("NZSC 55", "CA339"), or a
// full date. Used to cut "R v Reekie" out of "R v Reekie CA339/03, 3 August
// 2004" when no bracketed report locus is present to anchor the boundary.
const CITE_START = new RegExp(
  "\\s+(?:" +
    "\\[\\d{4}\\]|\\(\\d{4}\\)|" + // a bracketed year
    "[A-Z]{2,}\\d|[A-Z]{2,}\\s+\\d|" + // a court/report abbreviation + number
    "(?:HC|CA|SC|DC|FC|ERA|EmpC|CoA|PC)\\b|" + // an unreported-case court token
    "Transcript\\b|" + // a Supreme Court transcript designator
    "[A-Z]{2,4}[\\s-]?\\d+(?:[-/]\\d+)+|" + // a docket / file number
    `\\d{1,2}\\s+(?:${MONTHS})\\s+\\d{4}` + // a full date
    ")",
);

/** Find every self-identifying anchor in the pasted text, earliest first. */
export function scanAnchors(text: string): Anchor[] {
  const anchors: Anchor[] = [];
  const push = (kind: Anchor["kind"], m: RegExpMatchArray, parts: Record<string, string>) => {
    if (m.index == null) return;
    anchors.push({ kind, parts, start: m.index, end: m.index + m[0].length });
  };

  const neutral = text.match(NEUTRAL);
  if (neutral) push("neutral", neutral, { value: neutral[0].trim() });

  // A quoted title marks an article/essay rather than a case, and is required
  // before the volume-less journal fallback below can safely fire.
  const hasQuote = /[“"][^“”"]{3,}[”"]/.test(text);

  const reporter = text.match(REPORTER);
  if (reporter) {
    push("reporter", reporter, {
      year: reporter[1],
      volume: reporter[2],
      series: reporter[3].trim(),
      page: reporter[4],
    });
  } else if (hasQuote) {
    // A year-as-volume journal has no volume number: "(2014) NZ Law Review 547".
    // Only attempted for a quoted-title source, so a case can never match it.
    const noVol = text.match(
      /([[(]\d{4}[\])])\s+([A-Z][A-Za-z][A-Za-z.&]*(?:\s+[A-Za-z.&]+){0,3}?)\s+(\d+)\b/,
    );
    if (noVol) {
      push("reporter", noVol, {
        year: noVol[1],
        volume: "",
        series: noVol[2].trim(),
        page: noVol[3],
      });
    }
  } else {
    // A law report can be volume-less too — "Donoghue v Stevenson [1932] AC
    // 562" — and without an anchor the year and series were dropped outright,
    // rebuilding the case as "Donoghue v Stevenson 562 (HL)". The general
    // no-volume pattern above is unsafe for a case (it would read a case name
    // as a series), so this one is keyed on the named report series instead.
    const namedSeries = text.match(REPORT_SERIES_NO_VOLUME);
    if (namedSeries) {
      push("reporter", namedSeries, {
        year: namedSeries[1],
        volume: "",
        series: namedSeries[2].trim(),
        page: namedSeries[3],
      });
    }
  }

  const pinpoint = text.match(PINPOINT_AT);
  if (pinpoint) push("pinpoint", pinpoint, { value: pinpoint[1] });
  else {
    const div = text.match(PINPOINT_DIV);
    if (div) push("pinpoint", div, { value: div[1].trim() });
  }

  const edition = text.match(EDITION);
  if (edition) push("edition", edition, { value: edition[1] });

  const date = text.match(DATE);
  if (date) push("date", date, { value: date[1] });

  // A year, only if no reporter/neutral already claimed one (they are more
  // specific). Prefer a year on its own in brackets, then a publication year
  // that closes a parenthesis ("…, 1994)" — chosen over a year embedded in the
  // title like "Property Law Act 1952"), then any standalone four digits.
  if (!neutral && !reporter) {
    const bracket = text.match(/\[\d{4}\]|\(\d{4}\)/);
    const pubYear = text.match(/[,(]\s*(\d{4})\s*[)\]]/);
    const bare = text.match(/\b\d{4}\b/);
    if (bracket && bracket.index != null) {
      push("year", bracket, { value: bracket[0] });
    } else if (pubYear && pubYear.index != null) {
      anchors.push({
        kind: "year",
        parts: { value: pubYear[1] },
        start: pubYear.index,
        end: pubYear.index + pubYear[0].length,
      });
    } else if (bare) {
      push("year", bare, { value: bare[0] });
    }
  }

  // A quoted title: the first "..."/“...” run.
  const quoted = text.match(/[“"]([^”"]+)[”"]/);
  if (quoted) push("quotedTitle", quoted, { value: quoted[1].trim() });

  // A case name: "X v Y" from the start up to the first citation token. If a
  // citation boundary is present, cut there (so "R v Reekie CA339/03, 3 August
  // 2004" yields "R v Reekie"); otherwise take the whole "X v Y" string.
  if (/\sv\s/.test(text)) {
    const boundary = text.match(CITE_START);
    const value = (boundary && boundary.index != null
      ? text.slice(0, boundary.index)
      : text
    ).trim();
    if (value.includes(" v ")) {
      anchors.push({ kind: "caseName", parts: { value }, start: 0, end: value.length });
    }
  }

  return anchors.sort((a, b) => a.start - b.start);
}

/** The set of component ids a type actually defines. */
function idsOf(type: GuideType): Set<string> {
  return new Set(type.components.map((c) => c.id));
}

// Fields with a distinctive shape that the scanner is authoritative for. If the
// text does not show the shape, a positional guess for one of these is almost
// always wrong, so it is cleared rather than left to mislead the student — it
// is better to leave a box empty for them to fill than to fill it incorrectly.
const SCANNER_OWNED = new Set([
  "neutralCitation",
  "reportSeries",
  "journalAbbrev",
  "volume",
  "startingPage",
  "year",
  "pinpoint",
  "edition",
]);

/**
 * Whether an un-anchored positional value still looks like the field it landed
 * in. Numeric/dated fields have a checkable shape, so a real value is kept;
 * fields whose shape is easy to imitate must be anchored to be trusted.
 */
function positionalValueLooksValid(id: string, value: string): boolean {
  const v = value.trim();
  switch (id) {
    case "year":
      return /^[[(]?\d{4}[\])]?$/.test(v);
    case "volume":
    case "startingPage":
      return /^\d+[A-Za-z]?$/.test(v);
    case "pinpoint":
      return /\d/.test(v); // "[26]", "398", "s 8", "14104", "9.60" — all have a digit
    default:
      // neutralCitation, reportSeries, journalAbbrev, edition: anchor-only.
      return false;
  }
}

/**
 * Overlay shape-based anchors onto a type's fields. Only anchors whose target
 * component exists on the type are applied, and only the free-text head is
 * re-derived — so this corrects the boxes a positional pass gets wrong without
 * disturbing the ones it (or a rich-paste italic run) already got right.
 */
export function refineFields(
  type: GuideType,
  base: Record<string, string>,
  text: string,
): Record<string, string> {
  const ids = idsOf(type);
  const fields = { ...base };
  const anchors = scanAnchors(text);
  const anchored = new Set<string>();
  let earliestCitation = text.length;

  const set = (id: string, value: string) => {
    if (ids.has(id) && value.trim()) {
      fields[id] = value.trim();
      anchored.add(id);
    }
  };

  for (const anchor of anchors) {
    switch (anchor.kind) {
      case "neutral":
        set("neutralCitation", anchor.parts.value);
        earliestCitation = Math.min(earliestCitation, anchor.start);
        break;
      case "reporter": {
        set("year", anchor.parts.year);
        set("volume", anchor.parts.volume);
        // A reporter series maps to reportSeries; a journal to journalAbbrev.
        if (ids.has("reportSeries")) set("reportSeries", anchor.parts.series);
        else set("journalAbbrev", anchor.parts.series);
        set("startingPage", anchor.parts.page);
        earliestCitation = Math.min(earliestCitation, anchor.start);
        break;
      }
      case "pinpoint":
        set("pinpoint", anchor.parts.value);
        break;
      case "edition":
        set("edition", anchor.parts.value);
        break;
      case "date":
        if (ids.has("date")) set("date", anchor.parts.value);
        else if (ids.has("dateOfJudgment")) set("dateOfJudgment", anchor.parts.value);
        else if (ids.has("dateOfDebate")) set("dateOfDebate", anchor.parts.value);
        break;
      case "year":
        set("year", anchor.parts.value);
        earliestCitation = Math.min(earliestCitation, anchor.start);
        break;
      case "quotedTitle":
        // The quoted run is the article/essay/chapter title, under whichever id
        // this type uses for it.
        if (ids.has("title")) set("title", anchor.parts.value);
        else if (ids.has("articleTitle")) set("articleTitle", anchor.parts.value);
        else if (ids.has("essayTitle")) set("essayTitle", anchor.parts.value);
        else if (ids.has("chapterTitle")) set("chapterTitle", anchor.parts.value);
        earliestCitation = Math.min(earliestCitation, anchor.start);
        break;
      case "caseName":
        set("caseName", anchor.parts.value);
        break;
    }
  }

  // Carve the free-text head (author / creator / title) from what precedes the
  // citation, when the type leads with such a field and it wasn't already
  // placed by a rich-paste italic run.
  let head = text.slice(0, earliestCitation).trim();
  // An anchor inside the publication parenthesis — an edition, a year — leaves
  // the head holding the unclosed bracket that opened it, so the title came out
  // as "Halsbury's Laws of England (5th ed" and the bracket was then written
  // again by the template.
  const openParen = head.lastIndexOf("(");
  if (openParen >= 0 && !head.slice(openParen).includes(")")) {
    head = head.slice(0, openParen).trim();
  }
  const quotedTitleFound = anchors.some((a) => a.kind === "quotedTitle");
  const hasHead = Boolean(head) && earliestCitation < text.length;

  if (ids.has("caseName") && !fields.caseName && hasHead) {
    set("caseName", head);
  } else if (ids.has("author") && ids.has("title") && !quotedTitleFound) {
    // Book / authored text with no quoted title: the front matter is
    // "Author Title" up to the publication parenthesis. Split it determinist
    // -ally by the author's name shape (runs on any browser, no model).
    const pubStart = text.indexOf("(");
    const cut =
      pubStart >= 0 ? pubStart : earliestCitation < text.length ? earliestCitation : text.length;
    const front = text.slice(0, cut).trim();
    const split = splitAuthor(front);
    if (split) {
      set("author", split.author);
      if (split.rest) set("title", split.rest);
    } else if (hasHead && !fields.author) {
      set("author", head);
    }
  } else if (ids.has("author") && !fields.author && hasHead) {
    // Quoted-title path (e.g. a journal article): the author is the text
    // before the quote, which `head` already isolates.
    set("author", head);
  } else if (ids.has("shortTitle") && hasHead) {
    // Legislation: the short title is everything before the year.
    set("shortTitle", head);
  } else if (ids.has("title") && !quotedTitleFound && hasHead) {
    // A type whose leading free-text field is plainly "title" — a treaty, an
    // ordinance, a legislative instrument. Without this these fell through
    // every branch above and kept whatever the lazy positional regex had cut,
    // which is the FIRST WORD only: "Te Tiriti o Waitangi 1840, art 3" built
    // as "Te 1840, art 3." A confident, badly wrong citation is the one
    // outcome this tool is supposed to make impossible.
    set("title", head);
  }

  // The publication parenthesis — "(2nd ed, Thomson Reuters, Wellington, 2009)"
  // — is a comma-separated list read from the right: the year closes it, then
  // the place, then the publisher, with an edition in front if one is given.
  // Positional extraction cannot count backwards like that, so it shifted every
  // part left whenever the edition was absent, publishing Robin Cooke's essay
  // in "(Sydney, 1987, 1987)" instead of "(Law Book Company, Sydney, 1987)".
  const placeId = ids.has("placeOfPublication")
    ? "placeOfPublication"
    : ids.has("place")
      ? "place"
      : "";
  if (ids.has("publisher") || placeId) {
    const pub = text.match(/\(([^()]*\b(?:1[6-9]|20)\d{2})\)/);
    if (pub) {
      const parts = pub[1].split(/\s*,\s*/).map((part) => part.trim()).filter(Boolean);
      // A parenthesis holding nothing but a year — "(2016)" — gives the year
      // and nothing else. Any publisher or place a positional guess put there
      // is that same year read twice.
      if (parts.length === 1 && /^\(?(1[6-9]|20)\d{2}\)?$/.test(parts[0])) {
        if (ids.has("year")) set("year", parts[0]);
        for (const id of ["publisher", "place", "placeOfPublication"]) {
          if (fields[id] && parts[0].includes(fields[id])) delete fields[id];
        }
      }
      if (parts.length >= 2) {
        const year = parts[parts.length - 1];
        let rest = parts.slice(0, -1);
        if (rest.length && /\bed\b|\breissue\b|\blooseleaf\b|\bonline\b/i.test(rest[0])) {
          if (ids.has("edition")) set("edition", rest[0]);
          rest = rest.slice(1);
        }
        if (ids.has("year")) set("year", year);
        // Whatever remains is publisher then place, in that order.
        if (rest.length >= 2) {
          if (ids.has("publisher")) set("publisher", rest[0]);
          if (placeId) set(placeId, rest[rest.length - 1]);
        } else if (rest.length === 1) {
          if (ids.has("publisher")) set("publisher", rest[0]);
          else if (placeId) set(placeId, rest[0]);
        }
      }
    }
  }

  // Hansard names the debate instead of a column: "(16 August 2017) 724 NZPD
  // (Maritime Transport Amendment Bill – Second Reading, Julie Anne Genter)."
  // That trailing parenthesis IS the pinpoint, and requiring a number meant the
  // tool refused to cite any debate reported this way. Restricted to types with
  // no publication parenthesis of their own, so a book's "(2nd ed, LexisNexis,
  // Wellington, 2015)" can never be mistaken for one.
  if (
    ids.has("pinpoint") &&
    !fields.pinpoint &&
    !ids.has("publisher") &&
    !ids.has("place") &&
    !ids.has("placeOfPublication") &&
    !ids.has("edition") &&
    !ids.has("officialCitation") &&
    !ids.has("citation")
  ) {
    const trailing = text.match(/\s(\([^()]*\))\s*\.?\s*$/);
    const inner = trailing?.[1] ?? "";
    const words = (inner.match(/[A-Za-z]{3,}/g) ?? []).length;
    if (inner && words >= 3 && !/\b(1[6-9]|20)\d{2}\b/.test(inner)) {
      set("pinpoint", inner);
    }
  }

  // A Māori Land Court decision names the block of land after an en dash:
  // "Pacey v Adlam – Matata Parish 39A 2B 2B 2A (2017) 178 Waiariki MB 32".
  // The dash is the only boundary there is, and without it the case name
  // swallowed the block, leaving a required field empty so that the tool
  // refused to generate anything at all.
  if (ids.has("blockName")) {
    const dash = text.match(/^(.+?)\s+[–—]\s+(.+?)(?=\s+[[(]\d{4}[\])]|\s*$)/);
    if (dash) {
      set("caseName", dash[1]);
      set("blockName", dash[2]);
    }
    // What follows the year is the minute book reference, up to the abbreviated
    // citation the Guide puts in brackets at the very end: "… (2017) 178
    // Waiariki MB 32 (178 WAR 32)".
    const book = text.match(
      /[[(]\d{4}[\])]\s+(.+?)\s*\(([^()]+)\)\s*\.?\s*$/,
    );
    if (book) {
      set("minuteBookReference", book[1]);
      if (ids.has("citation")) set("citation", book[2]);
    }
  }

  // A pre-1854 Ordinance is dated by regnal year: "1841 4 Vict 5" is the
  // calendar year, then the regnal year, then the ordinance number.
  if (ids.has("regnalYear")) {
    const regnal = text.match(
      /\b(\d{1,2}\s+(?:Vict|Geo|Will|Eliz|Edw|Anne|Car|Jac|Hen)[A-Za-z]*\.?(?:\s+[IVX]+)?)\s+(\d+)\b/,
    );
    if (regnal) {
      set("regnalYear", regnal[1]);
      if (ids.has("ordinanceNumber")) set("ordinanceNumber", regnal[2]);
    }
  }

  // Edited collection: "… in {editor} (ed) {bookTitle} (…" — the "(ed)"/"(eds)"
  // marker cleanly separates the editor from the book title, which positional
  // extraction (no "(ed)" in the template) cannot.
  if (ids.has("editor")) {
    // "… in PD Finn (ed) Essays on Contract (…" for a chapter, but also
    // "Mathew Downs (ed) Cross on Evidence (…" for a looseleaf service, where
    // the editor opens the reference and there is no "in" to key on. Without
    // the second form the split fell to the positional pass, which cut on the
    // first space: editor "Mathew", title "Downs".
    const edited =
      text.match(/\bin\s+(.+?)\s+\(eds?\)\s+(.+?)\s*[([]/) ??
      text.match(/^(.+?)\s+\(eds?\)\s+(.+?)\s*\(/);
    if (edited) {
      set("editor", edited[1]);
      if (ids.has("bookTitle")) set("bookTitle", edited[2]);
      else if (ids.has("title")) set("title", edited[2]);
      // Positional extraction can mistake the "(ed)" marker itself for a
      // publisher; clear that artefact.
      if (/^eds?\.?$/i.test(fields.publisher ?? "")) delete fields.publisher;
    }
  }

  // Treaty series citation ("1577 UNTS 3"): a volume, a series (UNTS/LNTS/ETS/
  // CTS), and a page. Its shape cleanly separates it from the treaty name that
  // precedes it, which positional extraction splits in the wrong place.
  if (ids.has("treatySeriesCitation")) {
    const series = text.match(/\b(\d+\s+(?:[LU]NTS|ETS|CTS)\s+\d+)\b/);
    if (series && series.index != null) {
      set("treatySeriesCitation", series[1]);
      if (ids.has("treatyName")) set("treatyName", text.slice(0, series.index).trim());
    }
  }

  // Newspaper / magazine: the masthead sits between the quoted article title
  // and the publication parenthesis — "… “Article” The New Zealand Herald (…".
  if (ids.has("newspaperTitle")) {
    const masthead = text.match(/[”"]\s*(.+?)\s*\(/);
    if (masthead) set("newspaperTitle", masthead[1].trim());
    const onlineEd = text.match(/\(\s*(online ed)\b/i);
    if (onlineEd && ids.has("onlineEd")) set("onlineEd", onlineEd[1]);
  }

  // Unreported case: a court file number ("CA339/03", "CRI-2007-020-2820",
  // "CIV 7/2004") is distinctive, so map it to fileNumber directly.
  if (ids.has("fileNumber")) {
    const docket = text.match(DOCKET);
    if (docket) set("fileNumber", docket[0].trim());
  }

  // A starting page that follows the publication parenthesis before the
  // pinpoint — "…(2016) 25 at 30" (essay/conference) — the "25". Overrides a
  // non-numeric positional guess (which over-captures the book title).
  if (ids.has("startingPage") && !/^\d+$/.test(fields.startingPage ?? "")) {
    const sp = text.match(/\)\s+(\d+)\s+at\b/);
    if (sp) set("startingPage", sp[1]);
  }

  // When the case name was placed from the "X v Y" anchor, drop any other field
  // whose value is just a fragment carved out of that name by positional
  // extraction (e.g. courtAbbreviation "v", registry "Reekie" from "R v Reekie").
  if (fields.caseName) {
    const name = fields.caseName;
    for (const key of Object.keys(fields)) {
      if (key === "caseName" || anchored.has(key)) continue; // never a scanner value
      const v = fields[key];
      if (v && v !== name && new RegExp(`\\b${escapeReg(v)}\\b`).test(name)) {
        delete fields[key];
      }
    }
  }

  // An unreported judgment names its court and registry between the case name
  // and the file number — "R v Tuhou HC Napier CRI-2007-020-2820, 11 September
  // 2008". Positional extraction cuts the case name too early, so those two
  // words land inside the name and are then dropped as duplicates by the pass
  // above; the citation rebuilds as "R v Tuhou CRI-2007-020-2820, …", silently
  // short of the court that decided it. Recover them from the gap the anchors
  // leave between the name and the docket (or, for a historic judgment with no
  // docket, the date).
  if (fields.caseName) {
    const courtId = ids.has("courtAbbreviation")
      ? "courtAbbreviation"
      : ids.has("courtAbbrev")
        ? "courtAbbrev"
        : "";
    const placeId = ids.has("registry")
      ? "registry"
      : ids.has("location")
        ? "location"
        : "";
    if (courtId && !fields[courtId]) {
      const nameAt = text.indexOf(fields.caseName);
      const after = nameAt >= 0 ? nameAt + fields.caseName.length : -1;
      const docket = text.match(DOCKET);
      const date = text.match(DATE);
      const stop =
        docket?.index != null
          ? docket.index
          : date?.index != null
            ? date.index
            : -1;
      if (after >= 0 && stop > after) {
        const gap = text.slice(after, stop).replace(/[,\s]+$/, "").trim();
        const words = gap ? gap.split(/\s+/) : [];
        // The court is the leading abbreviation; the registry is the town that
        // follows it. Anything else in the gap is not one of these two fields,
        // so nothing is claimed rather than guessed.
        if (words.length && /^(HC|CA|SC|DC|FC|ERA|EmpC|CoA|PC|EnvC|MLC)$/.test(words[0])) {
          set(courtId, words[0]);
          // The gap is authoritative for both fields, so overwrite the place
          // rather than leaving a positional value that still begins with the
          // court token — that rendered the court twice, "SC SC Wellington".
          if (placeId) {
            const rest = words.slice(1).join(" ");
            if (rest) set(placeId, rest);
            else delete fields[placeId];
          }
        }
      }
    }
  }

  // Clean up positional guesses for shape-typed fields the scanner didn't set.
  // A value is kept only if it still looks like that field (a numeric volume, a
  // year-shaped year, a pinpoint with a digit) — so a correct positional value
  // (e.g. Hansard's volume "666" and pinpoint "14104", which have no anchor of
  // their own) survives, while garbage from forcing a template onto unrelated
  // text ("year": "Some") is removed. Fields whose shape is easy to imitate
  // (a report series, a neutral citation) are trusted only when anchored.
  for (const id of SCANNER_OWNED) {
    if (anchored.has(id)) continue;
    const value = fields[id];
    if (value == null) continue;
    if (!positionalValueLooksValid(id, value)) delete fields[id];
  }

  dropOverlapWithAnchoredName(fields, anchored);

  return stripBracketsSuppliedByTemplate(type, fields);
}

/**
 * Remove text a neighbouring field duplicates from the anchored case name.
 *
 * The positional regex cuts on the first plausible space, so for "Jones v Smith
 * SC Wellington, 2 April 1844 …" it reads the case name as "Jones", the court
 * as "v", and the location as "Smith SC Wellington". The case-name anchor then
 * correctly rewrites the name to "Jones v Smith" — but the stale fields still
 * hold its tail, and the citation is rendered with the name twice over:
 * "Jones v Smith Smith SC Wellington …".
 *
 * Whatever a following field repeats from the end of the anchored name belongs
 * to the name, not to that field, so it is stripped.
 */
function dropOverlapWithAnchoredName(
  fields: Record<string, string>,
  anchored: Set<string>,
): void {
  if (!anchored.has("caseName")) return;
  const nameWords = (fields.caseName ?? "").trim().split(/\s+/);
  if (nameWords.length < 2) return;
  for (const [id, raw] of Object.entries(fields)) {
    if (id === "caseName") continue;
    const value = (raw ?? "").trim();
    if (!value) continue;
    const words = value.split(/\s+/);
    // The longest run of leading words that is also a tail of the case name.
    let overlap = 0;
    for (let n = Math.min(words.length, nameWords.length - 1); n > 0; n--) {
      const lead = words.slice(0, n).join(" ");
      const tail = nameWords.slice(nameWords.length - n).join(" ");
      if (lead === tail) {
        overlap = n;
        break;
      }
    }
    if (!overlap) continue;
    const remainder = words.slice(overlap).join(" ").trim();
    if (remainder) fields[id] = remainder;
    else delete fields[id];
  }
}

/**
 * Drop brackets from a value when the template already writes them.
 *
 * The year anchor deliberately keeps its brackets, because for most types the
 * Guide's bracket style is itself the information (a "[2009]" year-organised
 * report versus a "(1992)" volume-organised one). But a handful of templates
 * write the brackets themselves — "[{year}] {courtIdentifier}" — and for those
 * the anchored value arrived pre-bracketed and rendered as "[[2011]]".
 *
 * That is not only wrong on the page: it also meant the correct type failed to
 * reproduce the reference it had just read, losing the reconstruction bonus
 * that detection leans on, so the paste was misclassified as well.
 */
function stripBracketsSuppliedByTemplate(
  type: GuideType,
  fields: Record<string, string>,
): Record<string, string> {
  const result = { ...fields };
  for (const [id, raw] of Object.entries(result)) {
    const value = (raw ?? "").trim();
    if (!value) continue;
    if (type.outputTemplate.includes(`[{${id}}]`) && /^\[.*\]$/.test(value)) {
      result[id] = value.slice(1, -1).trim();
    } else if (type.outputTemplate.includes(`({${id}})`) && /^\(.*\)$/.test(value)) {
      result[id] = value.slice(1, -1).trim();
    }
  }
  return result;
}

/**
 * A confidence signal for detection ranking: how many of a type's components
 * are corroborated by a self-identifying anchor of the right shape. This lets a
 * specific type (a reported case, with a neutral citation AND a reporter locus)
 * outrank a permissive one that merely matched the string positionally.
 */
export function anchorSupport(type: GuideType, text: string): number {
  const ids = idsOf(type);
  const anchors = scanAnchors(text);
  let support = 0;
  for (const anchor of anchors) {
    if (anchor.kind === "neutral" && ids.has("neutralCitation")) support += 2;
    if (anchor.kind === "reporter" && (ids.has("reportSeries") || ids.has("journalAbbrev"))) {
      support += 2;
    }
    if (anchor.kind === "quotedTitle" && (ids.has("title") || ids.has("essayTitle"))) {
      support += 1;
    }
    if (anchor.kind === "caseName" && ids.has("caseName")) support += 1;
    if (anchor.kind === "edition" && ids.has("edition")) support += 1;
  }
  // Distinctive literal markers that all but name their source type. A Hansard
  // "NZPD" or an "(ed)" editor marker is a far stronger signal than a positional
  // match, so they decisively confirm the parliamentary-debate / edited-book
  // types over a permissive template that merely absorbed the same words.
  if (/\bNZPD\b/.test(text) && ids.has("abbreviatedTitle")) support += 4;
  if (DOCKET.test(text) && ids.has("fileNumber")) support += 9;
  if (/\(eds?\)/.test(text) && ids.has("editor")) support += 4;
  if (/\b[LU]NTS\b|\bETS\b|\bCTS\b/.test(text) && ids.has("treatySeriesCitation")) {
    support += 4;
  }
  if (
    /opened for signature|entered into force|signed at/i.test(text) &&
    (ids.has("signatureDetails") || ids.has("dateOpened"))
  ) {
    support += 4;
  }
  // NZLC is the Law Commission's series; steer to the commission report type
  // over another official-paper type that also carries an officialCitation.
  if (/\bNZLC\b/.test(text) && ids.has("officialCitation")) {
    support += /commission/i.test(type.name) ? 9 : 1;
  }
  // Newspaper / magazine: a masthead followed by a "(… date)" block, marked by
  // a quoted article title and often an "online ed".
  if (ids.has("newspaperTitle") && /[“"][^“”"]{3,}[”"]/.test(text) && DATE.test(text)) {
    support += 3;
  }
  if (/\(\s*online ed\b/i.test(text) && ids.has("onlineEd")) support += 3;
  return support;
}

/**
 * The negative counterpart to {@link anchorSupport}: structure the text plainly
 * carries that this type has nowhere to put.
 *
 * A reference containing a docket number, a neutral citation, a reporter locus
 * or a year is telling us a great deal about what it is. A type with no
 * component capable of holding that evidence has not explained the reference —
 * it has absorbed the evidence into some free-text field and quietly discarded
 * its meaning. Without this, the loosest templates in the Guide (an
 * encyclopaedia entry, a bare cross-reference) win almost every paste, because
 * a template that is nothing but free text can "match" anything at all.
 */
export function anchorMismatch(type: GuideType, text: string): number {
  const ids = idsOf(type);
  const holds = (...needles: string[]): boolean =>
    [...ids].some((id) => {
      const lower = id.toLowerCase();
      return needles.some((needle) => lower.includes(needle));
    });
  let mismatch = 0;
  // Deliberately generous id matching: a compound component such as
  // "courtAndYear" or "publicationDetails" legitimately carries a year, so it
  // counts as a home for one. Only a type with no such component is penalised.
  if (/\b(19|20)\d{2}\b|\b1[0-8]\d{2}\b/.test(text) && !holds("year", "date", "citation", "publication", "details", "reference", "laws")) {
    mismatch += 1;
  }
  if (NEUTRAL.test(text) && !holds("citation", "neutral", "number", "court", "report")) {
    mismatch += 1;
  }
  if (REPORTER.test(text) && !holds("series", "report", "journal", "volume", "publication", "citation", "page")) {
    mismatch += 1;
  }
  if (DOCKET.test(text) && !holds("number", "citation", "file", "docket", "reference")) {
    mismatch += 1;
  }
  if (EDITION.test(text) && !holds("edition", "ed", "reissue", "publication")) {
    mismatch += 1;
  }
  return mismatch;
}

/**
 * Court, report-series and statute markers that name a jurisdiction outright.
 * The Guide is organised jurisdiction-first, so these are the single most
 * decisive signal available — "NZLR" settles New Zealand as surely as "EWCA"
 * settles England, and nothing else in a citation competes with them.
 */
const JURISDICTION_MARKERS: { jurisdiction: string; pattern: RegExp }[] = [
  {
    jurisdiction: "nz",
    pattern:
      /\bNZ(LR|SC|CA|HC|DC|FC|ERA|EnvC|AR|FLR|BLC|RMA|CC|PD|LC|Gaz)\b|\bNew Zealand\b|\bAotearoa\b|\bWaitangi\b|\bNZPD\b/,
  },
  { jurisdiction: "uk", pattern: /\bEW(CA|HC)\b|\bUK(SC|HL|PC)\b|\b(AC|WLR|QB|KB|Ch)\b|\bEngland\b/ },
  { jurisdiction: "scotland", pattern: /\bCSIH\b|\bCSOH\b|\bSLT\b|\bSC \(HL\)\b/ },
  { jurisdiction: "australia", pattern: /\bHCA\b|\bFCA\b|\bCLR\b|\bALR\b|\bNSWLR\b|\bVR\b/ },
  { jurisdiction: "canada", pattern: /\bSCC\b|\bSCR\b|\bDLR\b|\bRSC\b|\bONCA\b/ },
  { jurisdiction: "us", pattern: /\bUSC\b|\bF (2d|3d)\b|\bS Ct\b|\bUS\b|\bStat\b/ },
  { jurisdiction: "eu", pattern: /\bECLI\b|\bECR\b|\bCJEU\b|\bECJ\b/ },
  { jurisdiction: "echr", pattern: /\bECHR\b|\bEHRR\b/ },
];

/** Which jurisdiction a source type belongs to, from its id. */
function typeJurisdiction(type: GuideType): string {
  const id = type.id;
  if (/^australia-/.test(id)) return "australia";
  if (/^canada-/.test(id)) return "canada";
  if (/^(england-wales|uk-)/.test(id)) return "uk";
  if (/^scotland-/.test(id)) return "scotland";
  if (/^us-/.test(id)) return "us";
  if (/^eu-/.test(id)) return "eu";
  if (/^(echr|european-commission)/.test(id)) return "echr";
  if (
    /^(treaty$|icj|international|un-|wto|gatt)/.test(id) ||
    type.group === "International & foreign"
  ) {
    return "international";
  }
  if (type.group === "Subsequent references") return "any";
  // Everything else in the Guide — cases, legislation, parliamentary material,
  // and the secondary sources — is New Zealand material.
  return "nz";
}

/**
 * Does the reference name a jurisdiction this type does not belong to?
 *
 * Without this, "Taylor v New Zealand Poultry Board [1984] 1 NZLR 394 (CA)"
 * scored identically as a New Zealand reported case and as an English one: both
 * templates are "case name, year, volume, series, page, court", and every other
 * signal is blind to the fact that NZLR is a New Zealand series. The tie then
 * fell to whichever type the loop happened to reach first.
 */
export function jurisdictionConflict(type: GuideType, text: string): number {
  const own = typeJurisdiction(type);
  if (own === "any") return 0;
  const found = JURISDICTION_MARKERS.filter((m) => m.pattern.test(text)).map(
    (m) => m.jurisdiction,
  );
  if (!found.length) return 0;
  if (found.includes(own)) return 0;
  // A treaty or UN document need not carry a national marker; only penalise an
  // international type when the text is unambiguously domestic to one country.
  if (own === "international" && found.length > 1) return 0;
  return 1;
}

const MONTH =
  /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/i;
const FOUR_DIGIT_YEAR = /\b\d{4}\b/;

/** Components whose value is only ever a date. */
const DATE_FIELDS = new Set([
  "date",
  "dateOfJudgment",
  "dateOfDebate",
  "hearingDate",
  "dateOpened",
  "dateInForce",
  "newspaperDate",
  "interviewDetails",
]);

/** Components whose value is only ever (or contains) a four-digit year. */
const YEAR_FIELDS = new Set(["year", "neutralYear", "yearOfJournal", "regnalYear"]);

/** Components whose value is a page or page range. */
const PAGE_FIELDS = new Set(["startingPage", "page", "pageOrNoticeNumber"]);

/** Components whose value must contain a digit somewhere. */
const NUMERIC_FIELDS = new Set([
  "volume",
  "issueNumber",
  "number",
  "judgmentNumber",
  "caseNumber",
  "billNumber",
  "barNumber",
  "fileNumber",
  "waiNumber",
  "resolutionNumber",
  "sessionNumber",
  "documentNumber",
  "ordinanceNumber",
  "noticeNumber",
  "orderNumber",
  "sopNumber",
]);

/** Types whose case name really is an "X v Y" (or "Re X") party string. */
const PARTY_STYLE_CASE_TYPES = new Set([
  "reported-case-nz",
  "neutral-citation-case-nz",
  "unreported-case-file-number-nz",
  "australia-case",
  "canada-case",
  "england-wales-case-modern",
  "england-wales-nominate-report",
  "scotland-case",
  "us-federal-case",
  "us-state-case",
]);

const PARTY_STYLE =
  /(\sv\s|\sv\.\s)|^(re|in re|ex parte|application|the queen|police)\b/i;

/**
 * How badly a set of extracted values contradicts the shape each component is
 * defined to have.
 *
 * Detection matches every one of the 86 templates positionally, so a permissive
 * template — "{caseName} {courtAbbreviation} {registry} {fileNumber},
 * {dateOfJudgment}" — will happily "read" a statute, landing "Crimes" in the
 * case name and "s 167(a)" in the date of judgment. The positional match cannot
 * see anything wrong with that, and because the loose type has MORE required
 * fields it then outscores the statute type that actually models the source.
 *
 * This is the check that notices. A date field holding "s 167(a)", a page field
 * holding "!!!", or a case name with no parties in it are all evidence that the
 * type has mis-read the reference rather than explained it.
 */
export function fieldShapeViolations(
  type: GuideType,
  fields: Record<string, string>,
): number {
  let violations = 0;
  for (const [id, raw] of Object.entries(fields)) {
    const value = (raw ?? "").trim();
    if (!value) continue;
    if (DATE_FIELDS.has(id) && !MONTH.test(value) && !FOUR_DIGIT_YEAR.test(value)) {
      violations++;
    }
    if (YEAR_FIELDS.has(id) && !FOUR_DIGIT_YEAR.test(value)) violations++;
    if (PAGE_FIELDS.has(id) && !/\d|^[ivxlcdm]+$/i.test(value)) violations++;
    if (NUMERIC_FIELDS.has(id) && !/\d/.test(value)) violations++;
    if (id === "url" && !/:\/\/|^www\./i.test(value)) violations++;
    if (
      id === "caseName" &&
      PARTY_STYLE_CASE_TYPES.has(type.id) &&
      !PARTY_STYLE.test(value)
    ) {
      violations++;
    }
  }
  return violations;
}

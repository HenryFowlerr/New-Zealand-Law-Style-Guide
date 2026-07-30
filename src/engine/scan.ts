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
import { chooseForm, parseTemplate, renderFromTemplate, tokensToText } from "./render.ts";

export type Anchor = {
  kind:
    | "neutral"
    | "reporter"
    | "pinpoint"
    | "edition"
    | "year"
    | "yearFirst"
    | "datedLocus"
    | "date"
    | "caseName"
    | "quotedTitle";
  /** Sub-values a structured anchor yields, keyed by a neutral role name. */
  parts: Record<string, string>;
  /** Character span in the source text, used to locate the free-text head. */
  start: number;
  end: number;
};

const MONTHS =
  "January|February|March|April|May|June|July|August|September|October|November|December";

// A neutral citation: [year] COURT [division] number — letters immediately
// after the year, then a number (e.g. "[2008] NZSC 55", "[2019] EWCA Civ 20").
// The court is an ABBREVIATION — NZSC, NZCA, EWCA Civ, NZERA Christchurch —
// optionally followed by one division or registry word. Allowing a run of
// ordinary Title Case words let a journal locus match: "[1994] NZ Recent Law
// Review 245" read as a neutral citation, which both credited every case type
// and penalised the journal type for having nowhere to put one.
const NEUTRAL =
  /\[\d{4}\]\s+[A-Z]{2,}[A-Za-z]*(?:\s+[A-Z][A-Za-z]{1,11})?\s+\d+[A-Za-z]?/;

// A reporter / journal locus: (year) volume SERIES page — a DIGIT volume
// between the year and a letters series (e.g. "[2009] 1 NZLR 1", "(2005) 121
// LQR 163"). The bracket style of the year is preserved for the caller.
//
// A series can carry a numbered edition, and the Guide writes it two ways: in
// brackets for the Dominion Law Reports, "(1959) 19 DLR (2d) 262 (ONCA)" under
// rule 8.3, and bare for the American reporters, "546 F Supp 114" and "791 P 2d
// 1329" under rule 8.6. Without either, this pattern failed on the whole locus
// and Burke v Cory rebuilt as "Burke v Cory (1959) (2d) 262 (ONCA)".
const SERIES = "[A-Z][A-Za-z]*(?:\\s[A-Z][A-Za-z]*)*(?:\\s+\\(\\d+[A-Za-z]{1,2}\\)|\\s+\\d+[A-Za-z]{1,2}\\b)?";
const REPORTER = new RegExp(`([[(]\\d{4}[\\])])\\s+(\\d+)\\s+(${SERIES})\\s+(\\d+)`);

// The same locus, but opening with a bracketed DATE instead of a bracketed year.
// The New Zealand Gazette is cited "(19 February 2004) 18 New Zealand Gazette
// 379" under rule 5.2.4, and Hansard and the AJHR are cited the same way. With
// only the year form above, "18 New Zealand Gazette 379" was swallowed whole into
// the issue-number box while the template wrote its own "New Zealand Gazette"
// literal, so the publication was named twice: "18 New Zealand Gazette 379 New
// Zealand Gazette at 381".
const DATED_LOCUS = new RegExp(
  `\\((\\d{1,2}\\s+(?:${MONTHS})\\s+\\d{4})\\)\\s+(\\d+)\\s+(${SERIES})\\s+(\\d+)`,
  "i",
);

// The same locus without a volume number — "[1932] AC 562". Restricted to named
// law report series so a case name can never be mistaken for a series.
const REPORT_SERIES_NO_VOLUME =
  /([[(]\d{4}[\])])\s+(AC|QB|KB|Ch|WLR|All ER|ER|App Cas|NZLR|CLR|SLT|SC|DLR|SCR|Fam|P|Lloyd's Rep)\s+(\d+)/;

// A pinpoint introduced by "at". Beyond a plain page or paragraph — "at [26]",
// "at 165", "at 9.60", "at 12–14" — the Guide's own examples attach a footnote
// ("at 189, n 92"), a chapter ("at ch 1") and bracketed locators that are not
// purely numeric ("at [ED1.01(2)]", "at [38–033]"). Requiring digits alone
// silently dropped the footnote from Burrows on Restitution.
// Case-insensitive because a case list copied out of a database arrives in
// capitals \u2014 "TAYLOR V NEW ZEALAND POULTRY BOARD [1984] 1 NZLR 394 (CA) AT 398"
// \u2014 and a lowercase-only "at" left the pinpoint unrecognised. It was then
// dropped silently, which is the one outcome this tool must never produce.
const PINPOINT_AT =
  /\bat\s+(\[[\dA-Za-z.()\u2013\u2014-]+\]|ch\s+\d+|\d+(?:[-\u2013]\d+)?(?:\.\d+)?(?:,\s*n\s*\d+)?)/i;

// A legislation pinpoint: a trailing division reference — "s 8", "ss 3–5",
// "sch 2", "pt 1", "art 5", "reg 4", "cl 2" — usually after a comma.
// "rr?" matters: a rule is pinpointed "r 19.5" or "rr 4–6", the form court
// rules and deemed regulations always use. Leaving it out meant the title of
// every one of them collapsed to its first word — "Civil" for the Civil
// Aviation Rules.
const PINPOINT_DIV =
  /,\s*((?:ss?|sch|pt|arts?|regs?|rr?|cls?|ch|SO)\s+[\dA-Za-z]+(?:[-–(][\dA-Za-z)]+)*.*?|long title|preamble|schedule)\s*\.?\s*$/i;

// An edition: "2nd ed", "3rd ed", "rev ed", and the standing editions a
// looseleaf service or an online commentary carries instead of a number —
// without those, rule 6.3 could never be completed and the tool simply refused
// to generate a citation for any looseleaf or online text.
const EDITION =
  /\b(\d{1,2}(?:st|nd|rd|th)\s+ed|rev\s+ed|looseleaf\s+ed|online\s+ed|eBook\s+ed)\b/i;

// A citation that leads with an UNBRACKETED year — "2010 ONSC 6568",
// "2004 FC 1", "2004 SLT 623". Canada puts the year first in a neutral citation
// (rule 8.3) and Scotland does the same where the report series is organised by
// year rather than volume (rule 8.5). Every other anchor here expects the year in
// brackets, so both forms were invisible: a Canadian case rebuilt as "Bruni v
// Bruni 2010", losing the court and the judgment number outright.
//
// The court/series code must be capitalised and the number bare, which is what
// keeps this off "SC 2011 c 10, s 4" (lowercase "c"), "Cabinet Manual 2008 at
// [2.91]" (lowercase "at") and "Constitution Act 1982, being sch B" (a comma).
const YEAR_FIRST =
  /\b((?:1[6-9]|20)\d{2})\s+([A-Z]{2,}[A-Za-z]*(?:\s+[A-Z][A-Za-z]{1,11})?)\s+(\d+)\b/;

// A court file / docket number: "CA339/03", "CRI-2007-020-2820",
// "CIV-2007-409-2659", "CIV 7/2004", "AA506/10".
const DOCKET =
  /\b[A-Z]{2,4}[\s-]?\d+(?:[-/]\d+)+\b/;

const escapeReg = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// A full date: "3 August 2004", "21 September 2010".
const DATE = new RegExp(`\\b(\\d{1,2}\\s+(?:${MONTHS})\\s+\\d{4})\\b`, "i");

// Where a citation begins after a case name: a bracketed year, a court/report
// abbreviation immediately followed by a number ("NZSC 55", "CA339"), or a
// full date. Used to cut "R v Reekie" out of "R v Reekie CA339/03, 3 August
// 2004" when no bracketed report locus is present to anchor the boundary.
const CITE_START = new RegExp(
  "\\s+(?:" +
    "\\[\\d{4}\\]|\\(\\d{4}\\)|" + // a bracketed year
    "(?:1[6-9]|20)\\d{2}\\s+[A-Z]{2,}|" + // an unbracketed year leading a citation
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

  // Only where no bracketed locus already accounts for the citation, so
  // "(1905) 13 SLT 467" keeps its richer reading.
  if (!neutral && !reporter) {
    const yearFirst = text.match(YEAR_FIRST);
    if (yearFirst) {
      push("yearFirst", yearFirst, {
        value: yearFirst[0].trim(),
        year: yearFirst[1],
        code: yearFirst[2].trim(),
        number: yearFirst[3],
      });
    }
  }

  // A locus dated rather than year-numbered, once no bracketed-year locus has
  // already accounted for the citation.
  if (!reporter) {
    const dated = text.match(DATED_LOCUS);
    if (dated) {
      push("datedLocus", dated, {
        date: dated[1],
        issue: dated[2],
        series: dated[3].trim(),
        page: dated[4],
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
  //
  // The " v " test is case-insensitive: a case list copied out of a judgment
  // database comes in capitals, and requiring a lowercase "v" meant no case name
  // was recognised at all in "SMITH V JONES [2019] NZCA 123".
  if (/\sv\s/i.test(text)) {
    const boundary = text.match(CITE_START);
    const value = (boundary && boundary.index != null
      ? text.slice(0, boundary.index)
      : text
    ).trim();
    if (/\sv\s/i.test(value)) {
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
      // The AJHR numbers its volumes in Roman — "[1984–1985] I AJHR A6" — and
      // requiring digits dropped the volume from every citation of it.
      // Halsbury's subdivides a volume in brackets — rule 6.5's own example is
      // "vol 9(1) Contract" — and that shape was being discarded as garbage.
      return /^\d+(?:\([\dA-Za-z]+\))?[A-Za-z]?$/.test(v) || /^[IVXLC]{1,6}$/.test(v);
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
      case "yearFirst": {
        // Canada writes its neutral citation without brackets and keeps the
        // whole thing together — "Bruni v Bruni 2010 ONSC 6568" (rule 8.3).
        // Scotland splits the same shape into year, series and page, because for
        // a year-organised series the year IS part of the report reference —
        // "Musaj v Secretary of State for the Home Department 2004 SLT 623"
        // (rule 8.5). Which reading applies is settled by the components the
        // type has, not by anything in the text.
        if (ids.has("neutralCitationNoBrackets")) {
          set("neutralCitationNoBrackets", anchor.parts.value);
        } else if (ids.has("reportSeries") && ids.has("startingPage")) {
          set("year", anchor.parts.year);
          set("reportSeries", anchor.parts.code);
          set("startingPage", anchor.parts.number);
        }
        earliestCitation = Math.min(earliestCitation, anchor.start);
        break;
      }
      case "datedLocus": {
        // "(19 February 2004) 18 New Zealand Gazette 379" — the date, then the
        // issue number, then the publication, then the starting page. Which box
        // the issue goes in depends on the type: the Gazette numbers issues,
        // Hansard and the AJHR number volumes.
        if (ids.has("date")) set("date", anchor.parts.date);
        else if (ids.has("dateOfDebate")) set("dateOfDebate", anchor.parts.date);
        if (ids.has("issueNumber")) set("issueNumber", anchor.parts.issue);
        else if (ids.has("volume")) set("volume", anchor.parts.issue);
        if (ids.has("startingPage")) set("startingPage", anchor.parts.page);
        else if (ids.has("pageOrNoticeNumber")) set("pageOrNoticeNumber", anchor.parts.page);
        earliestCitation = Math.min(earliestCitation, anchor.start);
        break;
      }
      case "pinpoint":
        set("pinpoint", anchor.parts.value);
        // A pinpoint is citation apparatus just as a year is, so the free-text
        // head must stop before it. Without this a title ran on to swallow its
        // own pinpoint and the citation rendered it twice: "Cabinet Manual 2008
        // at [2.91]. at [2.91]."
        earliestCitation = Math.min(earliestCitation, anchor.start);
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
        // Only treat the year as the start of the citation apparatus when this
        // type actually has somewhere to put one. The Cabinet Manual is titled
        // "Cabinet Manual 2008" and has no year component, so cutting the head
        // at the year stripped the title down to "Cabinet Manual" and lost it.
        if (ids.has("year")) {
          earliestCitation = Math.min(earliestCitation, anchor.start);
        }
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

  // An encyclopaedia is cited by the work's name and then the topic inside it.
  // Rule 6.6's elements are "Author (if appropriate), Title, Topic name,
  // Pinpoint reference", and its own examples show the title is the
  // publication's own name: "Charles Rickett Laws of New Zealand Equity at
  // [98]." Nothing in the punctuation marks that boundary, so the positional
  // pass put the whole of "Laws of New Zealand Equity" in BOTH boxes and the
  // citation named the work twice over. The name to look for is the type's own —
  // a rule that cites one named work is named after it.
  if (ids.has("title") && ids.has("topic") && type.name.length >= 10) {
    const at = text.indexOf(type.name);
    if (at >= 0) {
      set("title", type.name);
      const topic = text
        .slice(at + type.name.length, Math.max(at + type.name.length, earliestCitation))
        .replace(/\s*[([].*$/, "")
        .trim();
      if (topic) set("topic", topic);
    }
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
        // A publication parenthesis can open with SEVERAL edition-like parts:
        // rule 6.1.9's own example is "(2nd ed, eBook ed, eBooks by Barb, 2011)",
        // where "eBook ed" is a fixed literal the template writes itself. Taking
        // only the first meant "eBook ed" was read as the publisher, and the
        // citation named the format twice and the publisher not at all.
        const editionLike = /\bed\b|\breissue\b|\blooseleaf\b|\bonline\b/i;
        for (let first = true; rest.length && editionLike.test(rest[0]); first = false) {
          if (first && ids.has("edition")) set("edition", rest[0]);
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
  }

  // "online ed" marks the online edition of a work — rule 6.5.2 for a legal
  // encyclopaedia, 6.6.2 for Laws of New Zealand, 7.2 for a newspaper. The
  // edition anchor takes the FIRST edition-shaped run in the text, which for
  // "(5th ed, 2012, online ed)" is the "5th ed", so the online marker was never
  // read and the citation came back as though it were the hardcopy.
  if (ids.has("onlineEd")) {
    const online = text.match(/\b(online ed)\b/i);
    if (online) set("onlineEd", online[1]);
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

/** Words of a value, for building prefixes and suffixes of it. */
const words = (value: string): string[] => value.trim().split(/\s+/).filter(Boolean);

/**
 * Trim separators and unmatched brackets a word-boundary cut leaves behind.
 *
 * A cut inside a bracketed run leaves half a pair, and half a pair is never
 * right: the template supplies its own brackets, so a stray one shows up in the
 * citation as "(9 ANZ Insurance Cases ¶61-336 (NSWCA)". A leading closer is
 * dropped; an opener with no closer after it takes the rest of the value with
 * it, because that tail belongs inside a bracket this fragment no longer has.
 */
function tidyFragment(value: string): string {
  let text = value.trim().replace(/^[,;:–—-]+\s*/, "").replace(/\s*[,;:–—-]+$/, "");
  for (const [open, close] of [["(", ")"], ["[", "]"]] as const) {
    // Drop closers with no opener before them, working left to right.
    let depth = 0;
    let out = "";
    for (const ch of text) {
      if (ch === open) depth++;
      else if (ch === close) {
        if (depth === 0) continue;
        depth--;
      }
      out += ch;
    }
    text = out;
    // An opener left unclosed. If the fragment BEGINS with it, the bracket is
    // the template's to supply and only the bracket goes — that is how "(248"
    // becomes the Bill number "248". Anywhere else, the run it opened has been
    // cut off mid-bracket, so it takes the rest of the fragment with it.
    while (depth > 0) {
      let at = -1;
      let closers = 0;
      for (let i = text.length - 1; i >= 0; i--) {
        if (text[i] === close) closers++;
        else if (text[i] === open) {
          if (closers === 0) {
            at = i;
            break;
          }
          closers--;
        }
      }
      if (at < 0) break;
      text = at === 0 ? text.slice(1) : text.slice(0, at);
      depth--;
    }
    text = text.trim().replace(/\s*[,;:–—-]+$/, "").trim();
  }
  return text.trim();
}

/** Enough of a value to be worth locating: a bare digit or letter is ambiguous. */
const locatable = (value: string): boolean => value.replace(/[^\p{L}\p{N}]/gu, "").length >= 2;

/**
 * How badly a field set fails to account for the paste, in words.
 *
 * A citation built from a paste should contain each word of that paste exactly
 * as often as the paste does. A word written twice is a duplicated field; a word
 * missing is a dropped one. Summing both differences gives one number that
 * ranks candidate readings of the same text without appealing to any Style Guide
 * rule — it only asks which reading loses or repeats least of what was pasted.
 *
 * The trailing full stop and the pinpoint apparatus are ignored, because the
 * template supplies those itself.
 */
function wordImbalance(rendered: string, source: string): number {
  const tally = (s: string): Map<string, number> => {
    const counts = new Map<string, number>();
    for (const word of s.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []) {
      counts.set(word, (counts.get(word) ?? 0) + 1);
    }
    return counts;
  };
  const out = tally(rendered);
  const src = tally(source);
  let penalty = 0;
  for (const word of new Set([...out.keys(), ...src.keys()])) {
    penalty += Math.abs((out.get(word) ?? 0) - (src.get(word) ?? 0));
  }
  return penalty;
}

/** Fields laid out in the order the chosen form writes them. */
function formOrder(type: GuideType, fields: Record<string, string>): { form: string; order: string[] } {
  const form = chooseForm(type.outputTemplate, fields);
  const order: string[] = [];
  for (const match of form.matchAll(/\{([^}]+)\}/g)) {
    if (!order.includes(match[1])) order.push(match[1]);
  }
  return { form, order };
}

/**
 * One pass of span reconciliation under a fixed policy for conflicts.
 *
 * A citation read back into its boxes is a partition of the pasted text: each
 * field holds a different run of it, and the runs appear in the order the
 * template writes them. So the fields are walked in template order behind a
 * cursor, each claiming the first occurrence of its value at or after the
 * cursor.
 *
 * When a field's value only appears BEHIND the cursor, two fields have claimed
 * the same run and one of them is wrong — but which one is not knowable from the
 * text alone. Either the later field over-reached backwards (cut it down to the
 * tail that is genuinely its own) or the earlier field swallowed it (cut the
 * earlier field back to where the later one starts). Both policies are tried;
 * the caller keeps whichever reading accounts for the paste better.
 *
 * A value of fewer than two letters or digits is left alone throughout: "3" or
 * "1" occurs all over a citation and locating it proves nothing.
 *
 * The template's own LITERALS take part in the walk, because the renderer writes
 * them whether or not the paste already contains them. "Transcript" under rule
 * 3.8 and "New Zealand Gazette" under 5.2.4 are both printed by the template, and
 * a field that swallowed the paste's copy of one had it written out twice:
 * "Couch v Attorney-General TRANSCRIPT Transcript SC49/2006". A literal cannot be
 * trimmed, so on a conflict it is always the neighbouring field that yields.
 *
 * Matching throughout ignores case. A citation copied out of a judgment database
 * is in capitals, and "TRANSCRIPT" is the same run of the paste as "Transcript".
 */
function reconcilePass(
  type: GuideType,
  fields: Record<string, string>,
  text: string,
  policy: "trimLater" | "shrinkEarlier",
): Record<string, string> {
  const { form, order } = formOrder(type, fields);
  const required = new Set(type.components.filter((c) => c.required).map((c) => c.id));
  const result = { ...fields };
  const claims: { id: string; start: number; end: number }[] = [];
  let cursor = 0;

  // Case-insensitive search, on a lowered copy so offsets still line up.
  const haystack = text.toLowerCase();
  const find = (needle: string, from = 0) => haystack.indexOf(needle.toLowerCase(), from);

  /** The longest tail of `value` that occurs at or after `from`. */
  const placeTail = (value: string, from: number): { text: string; at: number } | null => {
    const parts = words(value);
    for (let skip = 1; skip < parts.length; skip++) {
      const tail = tidyFragment(parts.slice(skip).join(" "));
      if (!tail || !locatable(tail)) continue;
      const at = find(tail, from);
      if (at >= 0) return { text: tail, at };
    }
    return null;
  };

  /** The longest head of `value` starting at `start` that ends at or before `before`. */
  const shrinkHead = (value: string, start: number, before: number): string | null => {
    const parts = words(value);
    for (let take = parts.length - 1; take >= 1; take--) {
      const head = parts.slice(0, take).join(" ");
      if (start + head.length > before) continue;
      const tidy = tidyFragment(head);
      if (tidy && locatable(tidy) && find(tidy, start) === start) return tidy;
    }
    return null;
  };

  // Interleave the form's literals with its placeholders, in written order. A
  // literal only joins the walk when it is distinctive enough to locate: a run of
  // at least four letters that appears exactly once in the paste. "at", "vol" and
  // "no" are far too common to prove anything about where they sit.
  const steps: { literal?: string; id?: string }[] = [];
  for (const token of parseTemplate(form)) {
    if (token.kind === "ph") {
      if (!steps.some((s) => s.id === token.id)) steps.push({ id: token.id });
      continue;
    }
    for (const run of token.text.match(/\p{L}[\p{L} ]{3,}/gu) ?? []) {
      const literal = run.trim();
      if (literal.replace(/\s/g, "").length < 4) continue;
      const lowered = literal.toLowerCase();
      if (haystack.indexOf(lowered) !== haystack.lastIndexOf(lowered)) continue;
      steps.push({ literal });
    }
  }

  for (const step of steps) {
    if (step.literal) {
      const at = find(step.literal, cursor);
      if (at >= 0) {
        cursor = at + step.literal.length;
        continue;
      }
      // The literal sits behind the cursor, so a field has taken the words the
      // template is about to write itself. Only the field can give ground.
      const behind = find(step.literal);
      const previous = claims[claims.length - 1];
      if (behind >= 0 && previous && behind >= previous.start && behind < previous.end) {
        const head = shrinkHead(result[previous.id] ?? "", previous.start, behind);
        if (head) {
          result[previous.id] = head;
          previous.end = previous.start + head.length;
          cursor = behind + step.literal.length;
        }
      }
      continue;
    }
    const id = step.id!;
    const value = (result[id] ?? "").trim();
    if (!value || !locatable(value)) continue;
    const ahead = find(value, cursor);
    if (ahead >= 0) {
      claims.push({ id, start: ahead, end: ahead + value.length });
      cursor = ahead + value.length;
      continue;
    }
    const behind = find(value);
    const previous = claims[claims.length - 1];
    // Cut the earlier field back to where this one starts. Always attempted when
    // the policy asks for it, and as a last resort under the other policy when a
    // required field would otherwise be lost.
    const yieldEarlier =
      behind >= 0 &&
      previous != null &&
      behind >= previous.start &&
      behind < previous.end &&
      (policy === "shrinkEarlier" || required.has(id));
    if (yieldEarlier && previous) {
      const head = shrinkHead(result[previous.id] ?? "", previous.start, behind);
      if (head) {
        result[previous.id] = head;
        previous.end = previous.start + head.length;
        claims.push({ id, start: behind, end: behind + value.length });
        cursor = behind + value.length;
        continue;
      }
    }
    const tail = placeTail(value, cursor);
    if (tail) {
      result[id] = tail.text;
      claims.push({ id, start: tail.at, end: tail.at + tail.text.length });
      cursor = tail.at + tail.text.length;
      continue;
    }
    // Nothing of this value is left unclaimed. Drop it if the citation can do
    // without it; keep it (duplication and all) if the Guide requires it.
    if (behind >= 0 && !required.has(id)) delete result[id];
  }
  return result;
}

/**
 * Stop a run of the paste being written into two boxes at once.
 *
 * The template's positional regex and the shape anchors extract independently,
 * and they routinely both claim the same run of text. The renderer then writes
 * it twice, which is how a third of the corpus's wrong outputs looked:
 *
 *   Arms Amendment Bill (No 3) 2005 (No 3) 2005 (248-1).
 *   Morissens v Belgium (1988) 56 DR (1988) 56 DR 127.
 *   Charles Rickett Laws of New Zealand Equity Laws of New Zealand Equity …
 *   Home Office Report … (Cmd 8932, Cmd 8932, 1953).
 *
 * A duplicated word makes a citation useless just as surely as a missing one.
 *
 * Which of the two claimants over-reached is genuinely ambiguous, and guessing
 * from the punctuation was wrong often enough to cost thirteen correct type
 * identifications. So both readings are built and compared against the paste by
 * word count, and the one that repeats and loses least of it wins. Doing nothing
 * is on the ballot too, and wins any tie — a reading is only adopted when it can
 * be shown to account for the reference better than leaving it alone.
 *
 * A reading that empties a field the Guide requires is discarded outright: a
 * citation with a word written twice is wrong, but one the tool refuses to build
 * at all is worse.
 */
export function reconcileAgainstSource(
  type: GuideType,
  fields: Record<string, string>,
  text: string,
): Record<string, string> {
  const { form } = formOrder(type, fields);
  const required = type.components.filter((c) => c.required).map((c) => c.id);
  const render = (values: Record<string, string>) =>
    tokensToText(renderFromTemplate(form, values));
  const keeps = (values: Record<string, string>) =>
    required.every((id) => !(fields[id] ?? "").trim() || (values[id] ?? "").trim());
  // A required field still empty is what makes the tool refuse to build at all,
  // so it outranks the word count. Cutting a swallowed year out of a Scottish
  // case name renders the same string either way — "Musaj v Secretary of State
  // for the Home Department 2004 SLT 623 (OH)" — but only one of the two
  // readings has a year in the year box, and without it nothing is generated.
  const gaps = (values: Record<string, string>) =>
    required.filter((id) => !(values[id] ?? "").trim()).length;

  let best = fields;
  let bestGaps = gaps(fields);
  let bestPenalty = wordImbalance(render(fields), text);
  for (const policy of ["trimLater", "shrinkEarlier"] as const) {
    const candidate = reconcilePass(type, fields, text, policy);
    if (!keeps(candidate)) continue;
    const candidateGaps = gaps(candidate);
    const penalty = wordImbalance(render(candidate), text);
    if (candidateGaps < bestGaps || (candidateGaps === bestGaps && penalty < bestPenalty)) {
      best = candidate;
      bestGaps = candidateGaps;
      bestPenalty = penalty;
    }
  }
  return best;
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

  // A statute and a regulation are written identically — "{title} {year},
  // {pinpoint}" — so nothing in the shape of the citation tells them apart.
  // The title does: an Act is an Act, and Regulations, Rules, an Order, a Code
  // or a Notice are secondary legislation. Without this every regulation a
  // student cited was offered as an Act.
  // A Bill announces itself, and carries its number as "(216-1)" or "(90)".
  if (/\bBill\b\s+(?:\(No \d+\)\s+)?\d{4}\b/.test(text) && ids.has("billNumber")) {
    support += 6;
  }
  const legislationKind = /\b(Act|Regulations?|Rules|Order|Code|Notice)\b\s+(?:\(No \d+\)\s+)?\d{4}\b/.exec(text);
  if (legislationKind) {
    const isAct = /^Act$/i.test(legislationKind[1]);
    // Any statute type, not only the New Zealand ones. Awarding this to the
    // domestic types alone meant the boost swamped the jurisdiction conflict,
    // and "Pensions Act 1995 (UK)" was offered as New Zealand provincial
    // legislation. Every statute type gets it; jurisdiction decides between
    // them.
    const statuteLike =
      type.id === "nz-statute" ||
      type.id === "nz-provincial-legislation" ||
      /^(uk-|australia-statute|canada-statute|us-code|us-session-law)/.test(type.id);
    const instrumentLike =
      type.id === "legislative-instrument" ||
      type.id === "court-rules" ||
      type.id === "other-instrument-dinli";
    if (isAct && statuteLike) support += 6;
    if (!isAct && instrumentLike) support += 6;
    // A rule of court says so outright.
    if (/\b(High Court|District Court|Supreme Court|Court of Appeal)\s+Rules\b/.test(text) &&
        type.id === "court-rules") {
      support += 4;
    }
  }
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
  // A web address is the plainest signal there is that a source is online, and
  // a type with nowhere to put one cannot be the right answer. Without this,
  // every webpage a student cited — the URL sitting there in angle brackets —
  // was offered first as a Cabinet document.
  if (/<[a-z]+[^>]*>|\bhttps?:\/\/|\bwww\./i.test(text) && !holds("url", "handle")) {
    mismatch += 2;
  }
  // A select committee report on a Bill, or an explanatory note, says which it
  // is. Its template is two free-text slots that will otherwise swallow any
  // Bill at all.
  if (
    /^(bill-select-committee|supplementary-order)/.test(type.id) &&
    !/\b(explanatory note|select committee report)\b/i.test(text)
  ) {
    mismatch += 2;
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
  {
    jurisdiction: "uk",
    // A statute of another country carries its jurisdiction in brackets under
    // rule 4.1.1(b) — "Pensions Act 1995 (UK)" — and without reading that tag
    // every United Kingdom Act was offered as New Zealand provincial
    // legislation, whose form is also "{title} {year} ({place})".
    pattern: /\bEW(CA|HC)\b|\bUK(SC|HL|PC)\b|\b(AC|WLR|QB|KB|Ch)\b|\bEngland\b|\((?:UK|Scotland|Northern Ireland|Wales)\)/,
  },
  { jurisdiction: "scotland", pattern: /\bCSIH\b|\bCSOH\b|\bSLT\b|\bSC \(HL\)\b/ },
  {
    jurisdiction: "australia",
    pattern: /\bHCA\b|\bFCA\b|\bCLR\b|\bALR\b|\bNSWLR\b|\bVR\b|\((?:Cth|NSW|Vic|Qld|SA|WA|Tas|ACT|NT)\)/,
  },
  { jurisdiction: "canada", pattern: /\bSCC\b|\bSCR\b|\bDLR\b|\bRSC\b|\bONCA\b/ },
  { jurisdiction: "us", pattern: /\bUSC\b|\bF (2d|3d|Supp)\b|\bS Ct\b|\bUS\b|\bStat\b|\b(?:SD|ED|ND|WD) NY\b|\b\d+th Cir\b/ },
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
  if (!found.length) {
    // Nothing in the reference names a jurisdiction at all. This is a New
    // Zealand style guide, used to cite New Zealand material: Parts 3 to 7 are
    // domestic and Parts 8 to 10 are headed "foreign and international". So an
    // unmarked reference is domestic by default, and a foreign type claiming it
    // is a weaker answer than a New Zealand one. Held at half weight, because
    // this is a prior rather than a conflict — a foreign source genuinely may
    // carry no marker we recognise.
    return own === "nz" ? 0 : 0.5;
  }
  if (found.includes(own)) return 0;
  // A treaty or UN document need not carry a national marker; only penalise an
  // international type when the text is unambiguously domestic to one country.
  if (own === "international" && found.length > 1) return 0;
  return 1;
}

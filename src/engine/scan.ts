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

export type Anchor = {
  kind:
    | "neutral"
    | "reporter"
    | "pinpoint"
    | "edition"
    | "year"
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

// A pinpoint introduced by "at": "at [26]", "at 165", "at 9.60", "at 12–14".
const PINPOINT_AT = /\bat\s+(\[[\d.]+\]|\d+(?:[-–]\d+)?(?:\.\d+)?)/;

// A legislation pinpoint: a trailing division reference — "s 8", "ss 3–5",
// "sch 2", "pt 1", "art 5", "reg 4", "cl 2" — usually after a comma.
const PINPOINT_DIV =
  /,\s*((?:ss?|sch|pt|arts?|regs?|cls?|ch)\s+[\dA-Za-z]+(?:[-–(][\dA-Za-z)]+)*)\s*$/;

// An edition: "2nd ed", "3rd ed", "rev ed".
const EDITION = /\b(\d{1,2}(?:st|nd|rd|th)\s+ed|rev\s+ed)\b/;

/** Find every self-identifying anchor in the pasted text, earliest first. */
export function scanAnchors(text: string): Anchor[] {
  const anchors: Anchor[] = [];
  const push = (kind: Anchor["kind"], m: RegExpMatchArray, parts: Record<string, string>) => {
    if (m.index == null) return;
    anchors.push({ kind, parts, start: m.index, end: m.index + m[0].length });
  };

  const neutral = text.match(NEUTRAL);
  if (neutral) push("neutral", neutral, { value: neutral[0].trim() });

  const reporter = text.match(REPORTER);
  if (reporter) {
    push("reporter", reporter, {
      year: reporter[1],
      volume: reporter[2],
      series: reporter[3].trim(),
      page: reporter[4],
    });
  }

  const pinpoint = text.match(PINPOINT_AT);
  if (pinpoint) push("pinpoint", pinpoint, { value: pinpoint[1] });
  else {
    const div = text.match(PINPOINT_DIV);
    if (div) push("pinpoint", div, { value: div[1].trim() });
  }

  const edition = text.match(EDITION);
  if (edition) push("edition", edition, { value: edition[1] });

  // A bare year only if no reporter/neutral already claimed one (they are more
  // specific). Prefer a bracketed year; fall back to a standalone four digits.
  if (!neutral && !reporter) {
    const year = text.match(/\[\d{4}\]|\(\d{4}\)/) ?? text.match(/\b\d{4}\b/);
    if (year) push("year", year, { value: year[0] });
  }

  // A quoted title: the first "..."/“...” run.
  const quoted = text.match(/[“"]([^”"]+)[”"]/);
  if (quoted) push("quotedTitle", quoted, { value: quoted[1].trim() });

  // A case name: "X v Y" from the start up to the first citation token
  // (a bracket or a run of capitals). Kept conservative: it must contain " v ".
  const caseName = text.match(/^(.*?\s+v\s+.*?)(?=\s+[[(]|\s+[A-Z]{2,}\b|$)/);
  if (caseName && caseName[1].includes(" v ")) {
    push("caseName", caseName, { value: caseName[1].trim() });
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
      case "year":
        set("year", anchor.parts.value);
        earliestCitation = Math.min(earliestCitation, anchor.start);
        break;
      case "quotedTitle":
        set("title", anchor.parts.value);
        earliestCitation = Math.min(earliestCitation, anchor.start);
        break;
      case "caseName":
        set("caseName", anchor.parts.value);
        break;
    }
  }

  // Carve the free-text head (author / creator) from what precedes the first
  // citation anchor, when the type leads with such a field and it wasn't
  // already placed by a rich-paste italic run.
  const head = text.slice(0, earliestCitation).trim();
  if (head && earliestCitation < text.length) {
    if (ids.has("caseName") && !fields.caseName) set("caseName", head);
    else if (ids.has("author") && !fields.author) {
      // If a quoted title was found, the author is the text before the quote;
      // the head already excludes the quote, so use it directly.
      set("author", head);
    } else if (ids.has("shortTitle")) {
      // Legislation: the short title is everything before the year.
      set("shortTitle", head);
    }
  }

  // Drop positional guesses for shape-typed fields the text gave no anchor for:
  // an unsupported neutral citation or reporter locus is noise, not a value.
  for (const id of SCANNER_OWNED) {
    if (!anchored.has(id) && fields[id] != null) delete fields[id];
  }

  return fields;
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
    if (anchor.kind === "quotedTitle" && ids.has("title")) support += 1;
    if (anchor.kind === "caseName" && ids.has("caseName")) support += 1;
    if (anchor.kind === "edition" && ids.has("edition")) support += 1;
  }
  return support;
}

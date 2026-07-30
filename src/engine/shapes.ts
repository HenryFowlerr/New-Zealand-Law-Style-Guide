/**
 * The shape each kind of component is defined to have.
 *
 * A citation's parts are not interchangeable: a date field holds a date, a page
 * field holds a page, a case name holds parties. Two separate passes need that
 * vocabulary and neither can own it — the anchor scanner (scan.ts) uses it to
 * judge whether a type has mis-read a reference, and the renderer (render.ts)
 * uses it to choose between the alternative forms a rule offers, and scan.ts
 * already depends on render.ts. So it lives here, where both can reach it.
 */
import type { GuideType } from "../data/styleGuide.ts";

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
  // An official citation is a numbered series designation — "NZLC R91",
  // "Occasional Paper 11/01". Without this, a book's place of publication landed
  // there and every text with a plain "(publisher, place, year)" was offered as
  // a government paper: "Lord Denning The Discipline of Law (Butterworths,
  // London, 1979)" read London as its official citation.
  "officialCitation",
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
      id === "province" &&
      !/^(Auckland|Canterbury|Hawke'?s Bay|Marlborough|Nelson|New Plymouth|Otago|Southland|Taranaki|Wellington|Westland)$/i.test(value)
    ) {
      // The provinces of New Zealand, 1852-1876, are a closed list. Without
      // this "(UK)" and "(Bermuda)" read as provinces.
      violations++;
    }
    if (id === "shortTitle" && type.id === "nz-statute" && !/\bAct\b/i.test(value)) {
      // Rule 4.1.1 is about Acts. Without this the statute type claimed the
      // Treaty of Waitangi, the Declaration of Independence and every ordinance.
      violations++;
    }
    if (
      id === "jurisdiction" &&
      /^(australia|canada|uk|us)-/.test(type.id) &&
      /^\(?NZ\)?$/i.test(value)
    ) {
      // A foreign statute names ITS OWN jurisdiction in brackets — "(NSW)",
      // "(UK)", "(Cth)". "NZ" is one thing it can never be, and a student who
      // writes "Evidence Act 2006 (NZ), s 8" (a habit carried over from
      // Australian style; rule 4.1.1 gives a New Zealand Act no tag at all) had
      // their Act offered as an AUSTRALIAN statute — because that format
      // reproduces the tag exactly and the correct one has to drop it.
      violations++;
    }
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

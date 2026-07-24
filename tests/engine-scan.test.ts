/**
 * Semantic extraction tests for the shape-based anchor scanner. Unlike the
 * accuracy gate (which only asks whether a citation round-trips), these assert
 * that fields land in the RIGHT boxes when a student pastes a plain-text
 * reference with no formatting — the case the positional extractor gets wrong
 * on its own. Each is a reference a law student would realistically paste.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { detectTypes, prefillFromPaste } from "../src/engine/build.ts";
import { guideTypeById } from "../src/data/styleGuide.ts";

const prefill = (id: string, text: string) =>
  prefillFromPaste(guideTypeById[id], text, []);

test("a reported NZ case splits into the correct fields", () => {
  const f = prefill(
    "reported-case-nz",
    "Z v Dental Complaints Assessment Committee [2008] NZSC 55, [2009] 1 NZLR 1 at [26]",
  );
  assert.equal(f.caseName, "Z v Dental Complaints Assessment Committee");
  assert.equal(f.neutralCitation, "[2008] NZSC 55");
  assert.equal(f.year, "[2009]");
  assert.equal(f.volume, "1");
  assert.equal(f.reportSeries, "NZLR");
  assert.equal(f.startingPage, "1");
  assert.equal(f.pinpoint, "[26]");
});

test("a journal article splits author, title, and locus correctly", () => {
  const f = prefill(
    "journal-article",
    "Peter Watts “Birks’ Unjust Enrichment” (2005) 121 LQR 163 at 165",
  );
  assert.equal(f.author, "Peter Watts");
  assert.equal(f.title, "Birks’ Unjust Enrichment");
  assert.equal(f.year, "(2005)");
  assert.equal(f.volume, "121");
  assert.equal(f.journalAbbrev, "LQR");
  assert.equal(f.startingPage, "163");
  assert.equal(f.pinpoint, "165");
});

test("a statute splits short title, year, and pinpoint correctly", () => {
  const f = prefill("nz-statute", "Evidence Act 2006, s 8");
  assert.equal(f.shortTitle, "Evidence Act");
  assert.equal(f.year, "2006");
  assert.equal(f.pinpoint, "s 8");
});

test("detection ranks the right type first for common student pastes", () => {
  const expectTop = [
    ["Z v Dental Complaints Assessment Committee [2008] NZSC 55, [2009] 1 NZLR 1 at [26]", "reported-case-nz"],
    ["Taylor v New Zealand Poultry Board [1984] 1 NZLR 394 (CA) at 398", "reported-case-nz"],
    ["Peter Watts “Birks’ Unjust Enrichment” (2005) 121 LQR 163 at 165", "journal-article"],
    ["Evidence Act 2006, s 8", "nz-statute"],
  ] as const;
  for (const [text, typeId] of expectTop) {
    const top = detectTypes(text, 1)[0];
    assert.ok(top, `no detection for: ${text}`);
    assert.equal(top.typeId, typeId, `wrong top type for: ${text}`);
  }
});

test("an unreported case cuts the case name before the docket and date", () => {
  const f = prefill("unreported-case-file-number-nz", "R v Reekie CA339/03, 3 August 2004");
  assert.equal(f.caseName, "R v Reekie");
  assert.equal(f.fileNumber, "CA339/03");
  assert.equal(f.dateOfJudgment, "3 August 2004");
});

test("a book's publication parenthesis splits into edition, publisher, place, year", () => {
  const f = prefill(
    "text-book",
    "Andrew Butler and Petra Butler The New Zealand Bill of Rights Act: A Commentary (2nd ed, LexisNexis, Wellington, 2015)",
  );
  assert.equal(f.edition, "2nd ed");
  assert.equal(f.publisher, "LexisNexis");
  assert.equal(f.placeOfPublication, "Wellington");
  assert.equal(f.year, "2015");
});

test("a Hansard debate is detected and split correctly", () => {
  const text = "(21 September 2010) 666 NZPD 14104";
  assert.equal(detectTypes(text, 1)[0].typeId, "hansard");
  const f = prefill("hansard", text);
  assert.equal(f.dateOfDebate, "21 September 2010");
  assert.equal(f.volume, "666");
  assert.equal(f.abbreviatedTitle, "NZPD");
  assert.equal(f.pinpoint, "14104");
});

test("an essay in an edited book is detected and split by the (ed) marker", () => {
  const text =
    "Jeremy Waldron “The Rule of Law” in Edward Zalta (ed) Stanford Encyclopedia of Philosophy (2016) 25 at 30";
  assert.equal(detectTypes(text, 1)[0].typeId, "essay-in-edited-book");
  const f = prefill("essay-in-edited-book", text);
  assert.equal(f.author, "Jeremy Waldron");
  assert.equal(f.essayTitle, "The Rule of Law");
  assert.equal(f.editor, "Edward Zalta");
  assert.equal(f.bookTitle, "Stanford Encyclopedia of Philosophy");
  assert.equal(f.publisher, undefined);
});

test("a year-as-volume journal (no volume number) still splits correctly", () => {
  const text = "Andrew Geddis “Electoral Law” (2014) NZ Law Review 547 at 550";
  assert.equal(detectTypes(text, 1)[0].typeId, "journal-article");
  const f = prefill("journal-article", text);
  assert.equal(f.author, "Andrew Geddis");
  assert.equal(f.title, "Electoral Law");
  assert.equal(f.year, "(2014)");
  assert.equal(f.volume, undefined);
  assert.equal(f.journalAbbrev, "NZ Law Review");
  assert.equal(f.startingPage, "547");
  assert.equal(f.pinpoint, "550");
});

test("a treaty is detected and split on its series citation", () => {
  const text =
    "Convention on the Rights of the Child 1577 UNTS 3 (opened for signature 20 November 1989, entered into force 2 September 1990), art 43";
  assert.equal(detectTypes(text, 1)[0].typeId, "treaty");
  const f = prefill("treaty", text);
  assert.equal(f.treatyName, "Convention on the Rights of the Child");
  assert.equal(f.treatySeriesCitation, "1577 UNTS 3");
  assert.equal(f.pinpoint, "art 43");
});

test("a newspaper article splits author, article title, masthead and date", () => {
  const text =
    "Claire Browning “Deep in the political weeds” The New Zealand Herald (online ed, Auckland, 3 May 2019)";
  assert.equal(detectTypes(text, 1)[0].typeId, "newspaper-magazine-article");
  const f = prefill("newspaper-magazine-article", text);
  assert.equal(f.author, "Claire Browning");
  assert.equal(f.articleTitle, "Deep in the political weeds");
  assert.equal(f.newspaperTitle, "The New Zealand Herald");
  assert.equal(f.place, "Auckland");
  assert.equal(f.date, "3 May 2019");
});

test("a Law Commission report uses the publication year, not a year in its title", () => {
  const text = "Law Commission Review of the Property Law Act 1952 (NZLC R9, 1994) at [3.2]";
  assert.equal(detectTypes(text, 1)[0].typeId, "law-commission-report");
  const f = prefill("law-commission-report", text);
  assert.equal(f.author, "Law Commission");
  assert.equal(f.officialCitation, "NZLC R9");
  assert.equal(f.year, "1994");
});

test("the scanner never invents a field the text does not contain", () => {
  // A bare title with no citation shape yields no neutral/reporter/pinpoint.
  const f = prefill("reported-case-nz", "Some Case Name With No Citation");
  assert.equal(f.neutralCitation, undefined);
  assert.equal(f.reportSeries, undefined);
  assert.equal(f.pinpoint, undefined);
});

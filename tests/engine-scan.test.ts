/**
 * Semantic extraction tests for the shape-based anchor scanner. Unlike the
 * accuracy gate (which only asks whether a citation round-trips), these assert
 * that fields land in the RIGHT boxes when a student pastes a plain-text
 * reference with no formatting — the case the positional extractor gets wrong
 * on its own. Each is a reference a law student would realistically paste.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { buildCitation, detectTypes, prefillFromPaste } from "../src/engine/build.ts";
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

test("straight (ASCII) quotes detect and split like curly quotes", () => {
  // A plain-text paste, PDF copy, or hand typing yields " and ', which must
  // work as well as the Guide's curly “ ” — this was a silent failure.
  const journal = 'Peter Watts "Birks’ Unjust Enrichment" (2005) 121 LQR 163 at 165';
  assert.equal(detectTypes(journal, 1)[0].typeId, "journal-article");
  const f = prefill("journal-article", journal);
  assert.equal(f.author, "Peter Watts");
  assert.equal(f.journalAbbrev, "LQR");

  const news = 'Claire Browning "Deep in the political weeds" The New Zealand Herald (online ed, Auckland, 3 May 2019)';
  assert.equal(detectTypes(news, 1)[0].typeId, "newspaper-magazine-article");
});

test("an essay in an edited book reads its starting page", () => {
  const text =
    'Jeremy Waldron "The Rule of Law" in Edward Zalta (ed) Stanford Encyclopedia of Philosophy (2016) 25 at 30';
  const f = prefill("essay-in-edited-book", text);
  assert.equal(f.startingPage, "25");
  assert.equal(f.pinpoint, "30");
});

test("unreported cases detect via the file number and split cleanly", () => {
  const reekie = prefill("unreported-case-file-number-nz", "R v Reekie CA339/03, 3 August 2004");
  assert.equal(detectTypes("R v Reekie CA339/03, 3 August 2004", 1)[0].typeId, "unreported-case-file-number-nz");
  assert.equal(reekie.caseName, "R v Reekie");
  assert.equal(reekie.fileNumber, "CA339/03");
  assert.equal(reekie.dateOfJudgment, "3 August 2004");
  // No fabricated court/registry fragments carved out of the case name.
  assert.equal(reekie.courtAbbreviation, undefined);
  assert.equal(reekie.registry, undefined);

  const tuhou = "R v Tuhou HC Napier CRI-2007-020-2820, 11 September 2008 at [13]";
  assert.equal(detectTypes(tuhou, 1)[0].typeId, "unreported-case-file-number-nz");
  const tf = prefill("unreported-case-file-number-nz", tuhou);
  assert.equal(tf.caseName, "R v Tuhou");
  assert.equal(tf.fileNumber, "CRI-2007-020-2820");
});

test("the scanner never invents a field the text does not contain", () => {
  // A bare title with no citation shape yields no neutral/reporter/pinpoint.
  const f = prefill("reported-case-nz", "Some Case Name With No Citation");
  assert.equal(f.neutralCitation, undefined);
  assert.equal(f.reportSeries, undefined);
  assert.equal(f.pinpoint, undefined);
});

test("a paste out of a PDF or Word survives its whitespace", () => {
  // Non-breaking spaces, a wrapped line and double spaces all defeated
  // detection outright, and any run of spaces that survived was carried into
  // the generated citation.
  const canonical =
    "Z v Dental Complaints Assessment Committee [2008] NZSC 55, [2009] 1 NZLR 1 at [26].";
  const pastes = [
    canonical.replace(/ /g, " "),
    canonical.replace(/ /g, "  "),
    canonical.replace("Committee [2008]", "Committee\n[2008]"),
    `   ${canonical}   `,
  ];
  for (const paste of pastes) {
    const top = detectTypes(paste, 1)[0];
    assert.ok(top, `no detection for: ${JSON.stringify(paste)}`);
    assert.equal(top.typeId, "reported-case-nz");
    const type = guideTypeById[top.typeId];
    const built = buildCitation(type.id, prefillFromPaste(type, paste, []));
    assert.equal(built.text, canonical);
  }
});

test("an unreported judgment keeps the court and registry that decided it", () => {
  const text = "R v Tuhou HC Napier CRI-2007-020-2820, 11 September 2008 at [13].";
  const type = guideTypeById["unreported-case-file-number-nz"];
  const fields = prefillFromPaste(type, text, []);
  assert.equal(fields.courtAbbreviation, "HC");
  assert.equal(fields.registry, "Napier");
  assert.equal(buildCitation(type.id, fields).text, text);
});

test("a title-led source keeps its whole title, not just the first word", () => {
  // "Te Tiriti o Waitangi 1840, art 3" once built as "Te 1840, art 3." — a
  // confident, badly wrong citation.
  for (const text of [
    "Te Tiriti o Waitangi 1840, art 3.",
    "Treaty of Waitangi 1840, art 3.",
    "Costs in Criminal Cases Regulations 1987, reg 3.",
  ]) {
    const top = detectTypes(text, 1)[0];
    const type = guideTypeById[top.typeId];
    const built = buildCitation(type.id, prefillFromPaste(type, text, []));
    assert.equal(built.text, text);
  }
});

test("a case name is never rendered twice over", () => {
  const text =
    "Jones v Smith SC Wellington, 2 April 1844 reported in The New Zealand Gazette and Wellington Spectator (Wellington, 17 April 1844) 3 at 3.";
  const type = guideTypeById["historic-judgment-newspaper"];
  const built = buildCitation(type.id, prefillFromPaste(type, text, []));
  assert.equal(built.text, text);
});

test("a report citation with no volume number keeps its year and series", () => {
  const text = "Donoghue v Stevenson [1932] AC 562 (HL) at 580.";
  const top = detectTypes(text, 1)[0];
  const type = guideTypeById[top.typeId];
  const built = buildCitation(type.id, prefillFromPaste(type, text, []));
  assert.equal(built.text, text);
});

test("a jurisdiction marker settles which country's type wins", () => {
  assert.equal(
    detectTypes("Taylor v New Zealand Poultry Board [1984] 1 NZLR 394 (CA) at 398.", 1)[0].typeId,
    "reported-case-nz",
  );
  assert.equal(
    detectTypes("Donoghue v Stevenson [1932] AC 562 (HL) at 580.", 1)[0].typeId,
    "england-wales-case-modern",
  );
  assert.equal(
    detectTypes("Mabo v Queensland (No 2) (1992) 175 CLR 1 (HCA) at 42.", 1)[0].typeId,
    "australia-case",
  );
});

test("the publication parenthesis is read from the right", () => {
  // "(publisher, place, year)" with no edition shifted every part one to the
  // left, publishing the essay in "(Sydney, 1987, 1987)".
  const text =
    "Robin Cooke “Tort and Contract” in PD Finn (ed) Essays on Contract (Law Book Company, Sydney, 1987) 222 at 229.";
  const type = guideTypeById["essay-in-edited-book"];
  const fields = prefillFromPaste(type, text, []);
  assert.equal(fields.publisher, "Law Book Company");
  assert.equal(fields.place, "Sydney");
  assert.equal(fields.year, "1987");
  assert.equal(fields.editor, "PD Finn");
  assert.equal(fields.bookTitle, "Essays on Contract");
});

test("an editor that opens the reference is split from the title", () => {
  const type = guideTypeById["looseleaf-online-commentary"];
  const fields = prefillFromPaste(
    type,
    "Mathew Downs (ed) Cross on Evidence (online ed, LexisNexis) at [1.2].",
    [],
  );
  assert.equal(fields.editor, "Mathew Downs");
  assert.equal(fields.title, "Cross on Evidence");
  assert.equal(fields.edition, "online ed");
});

test("a Māori Land Court decision keeps its block and minute book", () => {
  const text =
    "Pacey v Adlam – Matata Parish 39A 2B 2B 2A (2017) 178 Waiariki MB 32 (178 WAR 32).";
  const type = guideTypeById["maori-land-court"];
  const fields = prefillFromPaste(type, text, []);
  assert.equal(fields.caseName, "Pacey v Adlam");
  assert.equal(fields.blockName, "Matata Parish 39A 2B 2B 2A");
  assert.equal(fields.minuteBookReference, "178 Waiariki MB 32");
  assert.equal(buildCitation(type.id, fields).text, text);
});

test("a type with two formats renders the one the facts fit", () => {
  // Rendering always took the first alternate form, so a pre-2011 transcript
  // came out as the 2011+ skeleton with its own facts dropped.
  const text = "Couch v Attorney-General Transcript SC49/2006, 17 April 2007.";
  const type = guideTypeById["supreme-court-transcript"];
  const built = buildCitation(type.id, prefillFromPaste(type, text, []));
  assert.equal(built.text, text);
});

test("a title never runs into the publication bracket", () => {
  const text =
    "Halsbury’s Laws of England (5th ed, 2017) vol 9 Children and Young Persons at [651].";
  const type = guideTypeById["legal-encyclopaedia"];
  const fields = prefillFromPaste(type, text, []);
  assert.equal(fields.title, "Halsbury’s Laws of England");
  assert.equal(buildCitation(type.id, fields).text, text);
});

test("a pre-1854 Ordinance splits its regnal year from its number", () => {
  const text = "Distillation Prohibition Ordinance 1841 4 Vict 5, cl 1.";
  const type = guideTypeById["nz-pre-1854-ordinance"];
  const fields = prefillFromPaste(type, text, []);
  assert.equal(fields.regnalYear, "4 Vict");
  assert.equal(fields.ordinanceNumber, "5");
  assert.equal(buildCitation(type.id, fields).text, text);
});

test("a volume numbered in Roman is kept", () => {
  // The AJHR numbers volumes "I", "II"; requiring digits dropped it silently.
  const text =
    "Geoffrey Palmer “A Bill of Rights for New Zealand: A White Paper” [1984–1985] I AJHR A6 at 29.";
  const type = guideTypeById["ajhr"];
  const fields = prefillFromPaste(type, text, []);
  assert.equal(fields.volume, "I");
  assert.equal(buildCitation(type.id, fields).text, text);
});

test("a year inside a title survives when the type has no year field", () => {
  // The Cabinet Manual is titled "Cabinet Manual 2008"; cutting the free text
  // at the year stripped the title back to "Cabinet Manual".
  const text = "Cabinet Office Cabinet Manual 2008 at [2.91].";
  const type = guideTypeById["cabinet-manual"];
  const fields = prefillFromPaste(type, text, []);
  assert.equal(fields.title, "Cabinet Manual 2008");
  assert.equal(buildCitation(type.id, fields).text, text);
});

test("a rule pinpoint is recognised, so the title is not cut to one word", () => {
  const type = guideTypeById["court-rules"];
  const fields = prefillFromPaste(type, "High Court Rules 2016, r 14.3.", []);
  assert.equal(fields.pinpoint, "r 14.3");
  assert.equal(buildCitation(type.id, fields).text, "High Court Rules 2016, r 14.3.");
});

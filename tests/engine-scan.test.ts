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
import { pasteIsAllCaps, referencePrefixLength } from "../src/engine/render.ts";

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

test("a foreign statute is not read as New Zealand legislation", () => {
  // Rule 4.1.1(b) puts the jurisdiction in brackets, and New Zealand provincial
  // legislation has the same shape — "{title} {year} ({place})" — so "(UK)" was
  // read as a province and every United Kingdom Act came back as an ordinance
  // of Otago or Canterbury.
  for (const [text, typeId] of [
    ["Pensions Act 1995 (UK).", "uk-modern-statute"],
    ["Freedom of Information Act 2000 (UK).", "uk-modern-statute"],
    ["Judiciary and Courts (Scotland) Act 2008.", "uk-modern-statute"],
    ["Manawatu Racecourse Act 1869 (Wellington).", "nz-provincial-legislation"],
  ] as const) {
    assert.equal(detectTypes(text, 1)[0].typeId, typeId, text);
  }
});

test("a regulation is not offered as an Act", () => {
  // The two are written identically; only the title word tells them apart.
  for (const [text, typeId] of [
    ["Costs in Criminal Cases Regulations 1987, reg 3.", "legislative-instrument"],
    ["Personal Property Securities Regulations 2001, reg 18.", "legislative-instrument"],
    ["Evidence Act 2006, s 44.", "nz-statute"],
    ["Judicial Matters Bill 2008 (216-1), cl 3.", "bill"],
  ] as const) {
    assert.equal(detectTypes(text, 1)[0].typeId, typeId, text);
  }
});

test("a web address keeps a source online", () => {
  // A URL in angle brackets is the plainest signal a source is online; every
  // webpage was being offered first as a Cabinet document.
  assert.equal(
    detectTypes(
      "Dean Knight “Parliament and the Bill of Rights – a blasé attitude?” (6 April 2009) LAWS179 Elephants and the Law <www.laws179.co.nz>.",
      1,
    )[0].typeId,
    "internet-material",
  );
});

test("a journal locus is not mistaken for a neutral citation", () => {
  // "[1994] NZ Recent Law Review 245" matched the neutral-citation pattern,
  // which credited every case type and penalised the journal.
  assert.equal(
    detectTypes("J K Maxton “Equity” [1994] NZ Recent Law Review 245.", 1)[0].typeId,
    "journal-article",
  );
  assert.equal(
    detectTypes("Attorney-General v X [2007] NZCA 388 at [70].", 1)[0].typeId,
    "neutral-citation-case-nz",
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// No run of the paste is written twice
//
// Two extraction passes claim spans of the paste independently, and where they
// overlapped the renderer wrote the same words into two boxes. Each of these is
// a citation the tool used to produce with a word, a number or a whole clause
// duplicated.
// ─────────────────────────────────────────────────────────────────────────────

test("a Bill's number is not written along with its short title", () => {
  // Was: "Arms Amendment Bill (No 3) 2005 (No 3) 2005 (248-1)."
  const text = "Arms Amendment Bill (No 3) 2005 (248-1).";
  const built = buildCitation("bill", prefill("bill", text));
  assert.equal(built.text, text);
});

test("a report locus is not written twice over", () => {
  // Was: "Morissens v Belgium (1988) 56 DR (1988) 56 DR 127."
  const text = "Morissens v Belgium (1988) 56 DR 127.";
  const built = buildCitation(
    "european-commission-hr-case",
    prefill("european-commission-hr-case", text),
  );
  assert.equal(built.text, text);
});

test("an official citation is not repeated as the publisher", () => {
  // Was: "… (Cmd 8932, Cmd 8932, 1953)."
  const text =
    "Home Office Report of the Royal Commission on Capital Punishment 1949–1953 (Cmd 8932, 1953).";
  const built = buildCitation("paper-or-report", prefill("paper-or-report", text));
  assert.equal(built.text, text);
});

test("an encyclopaedia names the work it cites once", () => {
  // Rule 6.6's elements are author, title, topic name, pinpoint — the title
  // being the work's own name. Both boxes held the whole of "Laws of New
  // Zealand Equity", so the citation named it twice.
  const f = prefill("laws-of-new-zealand", "Charles Rickett Laws of New Zealand Equity at [98].");
  assert.equal(f.title, "Laws of New Zealand");
  assert.equal(f.topic, "Equity");
  assert.equal(
    buildCitation("laws-of-new-zealand", f).text,
    "Charles Rickett Laws of New Zealand Equity at [98].",
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Foreign citations that put the year first, or number their report series
// ─────────────────────────────────────────────────────────────────────────────

test("a Canadian neutral citation puts its year first (8.3)", () => {
  const f = prefill("canada-case", "Bruni v Bruni 2010 ONSC 6568.");
  assert.equal(f.caseName, "Bruni v Bruni");
  assert.equal(f.neutralCitationNoBrackets, "2010 ONSC 6568");
  assert.equal(buildCitation("canada-case", f).text, "Bruni v Bruni 2010 ONSC 6568.");
});

test("a year-organised Scottish report keeps its year (8.5)", () => {
  const f = prefill(
    "scotland-case",
    "Musaj v Secretary of State for the Home Department 2004 SLT 623 (OH).",
  );
  assert.equal(f.caseName, "Musaj v Secretary of State for the Home Department");
  assert.equal(f.year, "2004");
  assert.equal(f.reportSeries, "SLT");
  assert.equal(f.startingPage, "623");
});

test("a volume-organised Scottish report keeps its volume (8.5)", () => {
  // The ingestion dropped rule 8.5's volume element, so the "13" of the
  // Scottish Law Times had nowhere to go: "Glenday v Johnston (1905) SLT 467".
  const text = "Glenday v Johnston (1905) 13 SLT 467 (IH).";
  const f = prefill("scotland-case", text);
  assert.equal(f.volume, "13");
  assert.equal(buildCitation("scotland-case", f).text, text);
});

test("a numbered report series keeps its edition (8.3)", () => {
  // Was: "Burke v Cory (1959) (2d) 262 (ONCA)."
  const text = "Burke v Cory (1959) 19 DLR (2d) 262 (ONCA).";
  const f = prefill("canada-case", text);
  assert.equal(f.volume, "19");
  assert.equal(f.reportSeries, "DLR (2d)");
  assert.equal(buildCitation("canada-case", f).text, text);
});

// ─────────────────────────────────────────────────────────────────────────────
// Rules 6.5.1 and 6.5.2 are two forms, not one
// ─────────────────────────────────────────────────────────────────────────────

test("an online encyclopaedia edition reads year then 'online ed' (6.5.2)", () => {
  const text = "Halsbury’s Laws of England (5th ed, 2012, online ed) vol 22 Contract at [231].";
  const f = prefill("legal-encyclopaedia", text);
  assert.equal(f.edition, "5th ed");
  assert.equal(f.year, "2012");
  assert.equal(f.onlineEd, "online ed");
  assert.equal(buildCitation("legal-encyclopaedia", f).text, text);
});

test("a hardcopy encyclopaedia keeps its reissue and subdivided volume (6.5.1)", () => {
  const text = "Halsbury’s Laws of England (4th ed, reissue, 1998) vol 9(1) Contract at [859].";
  const f = prefill("legal-encyclopaedia", text);
  assert.equal(f.reissue, "reissue");
  assert.equal(f.volume, "9(1)");
  assert.equal(buildCitation("legal-encyclopaedia", f).text, text);
});

test("a type whose fields fail their shapes still reaches detection", () => {
  // The form-choice shape penalty can take a genuine match's score negative. A
  // sentinel a real score could fall under dropped the type from the ranking
  // altogether, and Mabo was offered as a Canadian case.
  assert.equal(
    detectTypes("Mabo v Queensland (No 2) (1992) 175 CLR 1 (HCA) at 42.", 1)[0].typeId,
    "australia-case",
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// A reference pasted in capitals
//
// Case lists and judgment databases render everything in capitals. Every pattern
// that keyed on a lowercase word — the pinpoint's "at", the parties' " v ", each
// literal in a template — failed on such a paste, and what those patterns would
// have placed was dropped without a word. That is the failure this tool exists
// to prevent, so it is tested directly rather than left to the corpus, which
// contains no capitalised example at all.
// ─────────────────────────────────────────────────────────────────────────────

test("a case pasted in capitals loses nothing", () => {
  const f = prefill(
    "reported-case-nz",
    "TAYLOR V NEW ZEALAND POULTRY BOARD [1984] 1 NZLR 394 (CA) AT 398",
  );
  // Was: the (CA) and the "AT 398" both vanished.
  assert.equal(f.courtIdentifier, "CA");
  assert.equal(f.pinpoint, "398");
  assert.equal(
    buildCitation("reported-case-nz", f).text,
    "TAYLOR v NEW ZEALAND POULTRY BOARD [1984] 1 NZLR 394 (CA) at 398.",
  );
});

test("the 'v' between parties is lowercased, the names are not touched", () => {
  // Rule 3.2 italicises the "v" with the case name and prints it lowercase, so
  // that much is determinable. The names are to be given "exactly as on the
  // first page of the report", which a capitalised paste does not say — "ANZ"
  // and "Anz" are the same string in capitals — so nothing else is re-cased.
  const f = prefill("neutral-citation-case-nz", "SMITH V JONES [2019] NZCA 123 AT [14]");
  assert.equal(f.caseName, "SMITH v JONES");
  assert.equal(
    buildCitation("neutral-citation-case-nz", f).text,
    "SMITH v JONES [2019] NZCA 123 at [14].",
  );
});

test("a capitalised paste is flagged as such", () => {
  assert.equal(pasteIsAllCaps("TAYLOR V NEW ZEALAND POULTRY BOARD [1984] 1 NZLR 394"), true);
  assert.equal(pasteIsAllCaps("Taylor v New Zealand Poultry Board [1984] 1 NZLR 394"), false);
  // A citation that merely contains abbreviations is not a shouted paste.
  assert.equal(pasteIsAllCaps("Erwood v Ministry of Social Development [2010] NZCA 619"), false);
  assert.equal(pasteIsAllCaps("[2010] NZCA 619"), false);
});

test("a template literal the paste already contains is not written twice", () => {
  // Was: "COUCH v ATTORNEY-GENERAL TRANSCRIPT Transcript SC49/2006, …" — the
  // template writes "Transcript" itself, and the case name had swallowed the
  // paste's own copy of it.
  const f = prefill("supreme-court-transcript", "COUCH V ATTORNEY-GENERAL TRANSCRIPT SC49/2006, 17 APRIL 2007.");
  assert.equal(f.caseName, "COUCH v ATTORNEY-GENERAL");
  assert.equal(
    buildCitation("supreme-court-transcript", f).text?.toLowerCase(),
    "couch v attorney-general transcript sc49/2006, 17 april 2007.",
  );
});

test("a Gazette notice reads its issue, publication and page apart (5.2.4)", () => {
  // Was: "… 18 New Zealand Gazette 379 New Zealand Gazette at 381." — the whole
  // locus went into the issue-number box and the template named the Gazette again.
  const text =
    "“Commission of Inquiry into Police Conduct” (19 February 2004) 18 New Zealand Gazette 379 at 381.";
  const f = prefill("nz-gazette", text);
  assert.equal(f.issueNumber, "18");
  assert.equal(f.startingPage, "379");
  assert.equal(f.pinpoint, "381");
  assert.equal(buildCitation("nz-gazette", f).text, text);
});

// ─────────────────────────────────────────────────────────────────────────────
// Pinpoints a student actually writes
//
// Rule 3.2.8: "ranges with en dash no spaces; multiples separated by commas with
// final 'and'". Reading only the first atom halved a pin cite and pointed the
// reader at the wrong paragraph, while looking entirely correct.
// ─────────────────────────────────────────────────────────────────────────────

test("a pinpoint range survives, and takes the en dash the rule requires", () => {
  const f = prefill(
    "reported-case-nz",
    "Taylor v New Zealand Poultry Board [1984] 1 NZLR 394 (CA) at [12]-[15]",
  );
  assert.equal(f.pinpoint, "[12]–[15]"); // typed with a hyphen, written with an en dash
  const g = prefill("reported-case-nz", "Taylor v New Zealand Poultry Board [1984] 1 NZLR 394 (CA) at 398 - 401");
  assert.equal(g.pinpoint, "398–401");
});

test("a list of pinpoints survives, including the final 'and'", () => {
  const f = prefill(
    "reported-case-nz",
    "Taylor v New Zealand Poultry Board [1984] 1 NZLR 394 (CA) at 398, 401 and 405",
  );
  assert.equal(f.pinpoint, "398, 401 and 405");
});

test("a hyphen INSIDE a bracketed locator is left alone", () => {
  // "[3-85]" is one paragraph number in Arlidge, Eady & Smith on Contempt, not
  // the range 3 to 85. Rewriting its hyphen turned a correct citation wrong.
  const text =
    "Patricia Londono, David Eady and ATH Smith Arlidge, Eady & Smith on Contempt (5th ed, Sweet & Maxwell, London, 2017) at [3-85].";
  assert.equal(prefill("text-book", text).pinpoint, "[3-85]");
});

test("a multi-part pinpoint is not truncated to its first two digits", () => {
  // Was "1.1" for Justinian's Digest, and "71" for a page written "71,716".
  assert.equal(
    prefill(
      "historical-edited-translated-text",
      "Justinian Digest (Alan Watson (translator), University of Pennsylvania Press, Philadelphia, 1985) at 1.1.1.2.",
    ).pinpoint,
    "1.1.1.2",
  );
  assert.equal(
    prefill(
      "australia-case",
      "Transfield Constructions Pty Ltd v GIO Australia Holdings Pty Ltd (1996) 9 ANZ Insurance Cases ¶61-336 (NSWCA) at 71,716.",
    ).pinpoint,
    "71,716",
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// A journal whose name is written out
// ─────────────────────────────────────────────────────────────────────────────

test("a journal name with an ampersand and lowercase words is read (6.4)", () => {
  // Both of these refused outright: the series pattern required every word
  // capitalised and letters only, so the journal and the starting page stayed
  // empty and no citation was produced at all.
  const text =
    "Ben Mathews and Kerryann Walsh “At the Cutting Edge: Issues in Mandatory Reporting of Child Sexual Abuse by Australian Teachers” (2004) 9(2) Australia & New Zealand Journal of Law & Education 3.";
  const f = prefill("journal-article", text);
  assert.equal(f.volume, "9(2)"); // rule 6.4 puts the issue in brackets after the volume
  assert.equal(f.journalAbbrev, "Australia & New Zealand Journal of Law & Education");
  assert.equal(f.startingPage, "3");
  assert.equal(buildCitation("journal-article", f).text, text);

  const short = "Kent Greenawalt “Moral and Religious Convictions as Categories for Special Treatment: The Exemption Strategy” (2007) 48 Wm & Mary L Rev 1605.";
  assert.equal(buildCitation("journal-article", prefill("journal-article", short)).text, short);
});

test("the looser journal pattern never reaches a case", () => {
  // It is gated on a quoted title. Without that gate an ampersand and a
  // lowercase "of" would let a report series swallow a party name.
  const text = "Dollars & Sense Finance Ltd v Nathan [2008] NZSC 20, [2008] 2 NZLR 557 at [4].";
  const f = prefill("reported-case-nz", text);
  assert.equal(f.caseName, "Dollars & Sense Finance Ltd v Nathan");
  assert.equal(f.reportSeries, "NZLR");
});

// ─────────────────────────────────────────────────────────────────────────────
// A reference is almost never copied on its own
//
// It comes out of a footnote with its marker attached, out of a sentence with the
// signal that introduced it, or off a reading list under a heading. Every one of
// those used to end up INSIDE the case name, so the citation named a party that
// does not exist and read as though it were correct.
// ─────────────────────────────────────────────────────────────────────────────

test("a footnote marker copied with the reference is not part of the case name", () => {
  const want = "Taylor v New Zealand Poultry Board [1984] 1 NZLR 394 (CA) at 398.";
  for (const prefix of ["12 ", "3. ", "7) ", "[4] "]) {
    const f = prefill("reported-case-nz", prefix + want);
    assert.equal(f.caseName, "Taylor v New Zealand Poultry Board", `prefix ${JSON.stringify(prefix)}`);
    assert.equal(buildCitation("reported-case-nz", f).text, want);
  }
});

test("an introductory signal is not part of the case name", () => {
  const want = "Taylor v New Zealand Poultry Board [1984] 1 NZLR 394 (CA) at 398.";
  for (const signal of ["See ", "See also ", "Cf ", "But see ", "Compare ", "12 See also "]) {
    assert.equal(
      buildCitation("reported-case-nz", prefill("reported-case-nz", signal + want)).text,
      want,
      `signal ${JSON.stringify(signal)}`,
    );
  }
});

test("a reading-list heading is not part of the case name", () => {
  const want = "Z v Dental Complaints Assessment Committee [2008] NZSC 55, [2009] 1 NZLR 1 at [26].";
  for (const heading of ["Week 4: ", "Topic 3: ", "Reading 2. ", "Seminar 1 – "]) {
    assert.equal(
      buildCitation("reported-case-nz", prefill("reported-case-nz", heading + want)).text,
      want,
      `heading ${JSON.stringify(heading)}`,
    );
  }
});

test("a citation that legitimately begins with a number keeps it", () => {
  // The bare leading number is the only ambiguous case: "16 US 610" is a volume,
  // not a footnote marker, and "2269th Meeting" is a document title. Neither is
  // followed by something a report series cannot be, so neither is touched.
  assert.equal(referencePrefixLength("16 US 610 (1818) at 631."), 0);
  assert.equal(
    referencePrefixLength(
      "2269th Meeting – International liability for injurious consequences [1992] vol 1 YILC 97 at [42].",
    ),
    0,
  );
  // And "Seebeck" is not the signal "See".
  assert.equal(referencePrefixLength("Seebeck v Attorney-General [2000] 1 NZLR 1."), 0);
});

test("stripping a prefix never eats the whole paste", () => {
  // If nothing recognisable is left, it was not a prefix.
  assert.equal(referencePrefixLength("See"), 0);
  assert.equal(referencePrefixLength("12"), 0);
  assert.equal(referencePrefixLength("Week 4:"), 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// A template must not assert a word the reference never contained
// ─────────────────────────────────────────────────────────────────────────────

test("a bare case name does not become a transcript that does not exist", () => {
  // Was: "Taylor v New Zealand Poultry Board Transcript." — a Supreme Court
  // transcript, invented out of nothing and formatted impeccably. Nineteen types
  // write a distinctive word of their own; missing one used to cost nothing.
  for (const text of ["Taylor v New Zealand Poultry Board", "R v Smith"]) {
    const top = detectTypes(text, 1)[0];
    const built = buildCitation(top.typeId, prefillFromPaste(guideTypeById[top.typeId], text, []));
    assert.ok(
      !/\bTranscript\b/i.test(built.text ?? ""),
      `invented a transcript for ${JSON.stringify(text)}: ${built.text}`,
    );
  }
});

test("a real transcript is still recognised", () => {
  const text = "Couch v Attorney-General Transcript SC49/2006, 17 April 2007.";
  assert.equal(detectTypes(text, 1)[0].typeId, "supreme-court-transcript");
  assert.equal(
    buildCitation("supreme-court-transcript", prefill("supreme-court-transcript", text)).text,
    text,
  );
});

test("a type whose form asserts nothing is not penalised for it", () => {
  // Rule 9.3.1's first form writes no distinctive word, so a Canadian statute
  // must not be marked down for the Charter wording its other form carries.
  const text = "Arctic Waters Pollution Prevention Act RSC 1985 c A-12, s 15.";
  assert.ok(
    detectTypes(text, 6).some((d) => d.typeId === "canada-statute"),
    "canada-statute fell out of the visible list",
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Noise a reference picks up on its way into the box
// ─────────────────────────────────────────────────────────────────────────────

test("a retrieval date is not part of a citation under this Guide", () => {
  // Not one of the Guide's 216 worked examples contains one. It did more than
  // add an unwanted phrase: the trailing bracket changed the shape the detector
  // keys on, so a perfectly good neutral citation was read as a REPORTED case and
  // then refused for want of a report series. The student got nothing.
  const want = "Attorney-General v X [2007] NZCA 388 at [70].";
  for (const tail of [
    " (accessed 4 May 2025)",
    " [Retrieved 4 May 2025]",
    " (last visited 4 May 2025).",
    " (last accessed 4 May 2025)",
  ]) {
    const text = "Attorney-General v X [2007] NZCA 388 at [70]" + tail;
    const top = detectTypes(text, 1)[0];
    assert.equal(top.typeId, "neutral-citation-case-nz", `tail ${JSON.stringify(tail)}`);
    assert.equal(
      buildCitation(top.typeId, prefillFromPaste(guideTypeById[top.typeId], text, [])).text,
      want,
    );
  }
});

test("a parenthesis a citation legitimately ends with is left alone", () => {
  for (const text of [
    "Taylor v New Zealand Poultry Board [1984] 1 NZLR 394 (CA) at 398.",
    "Supplementary Order Paper 2006 (79) Evidence Bill 2005 (256-1) (explanatory note) at 3.",
    "Halsbury’s Laws of England (5th ed, 2012, online ed) vol 22 Contract at [231].",
  ]) {
    const top = detectTypes(text, 1)[0];
    assert.equal(
      buildCitation(top.typeId, prefillFromPaste(guideTypeById[top.typeId], text, [])).text,
      text,
    );
  }
});

test("a New Zealand Act tagged “(NZ)” is not offered as an Australian one", () => {
  // Rule 4.1.1 gives a New Zealand Act no jurisdiction tag, so the correct format
  // has to DROP what the student typed — and the Australian format, which
  // reproduces it exactly, scored better for doing so. A foreign statute's
  // jurisdiction can never be "NZ".
  const text = "Evidence Act 2006 (NZ), s 8";
  assert.equal(detectTypes(text, 1)[0].typeId, "nz-statute");
  assert.equal(
    buildCitation("nz-statute", prefillFromPaste(guideTypeById["nz-statute"], text, [])).text,
    "Evidence Act 2006, s 8.",
  );
  // Real foreign tags still resolve to their own types.
  assert.equal(detectTypes("Chaffey Dam Act 1974 (NSW).", 1)[0].typeId, "australia-statute");
  assert.equal(detectTypes("Pensions Act 1995 (UK).", 1)[0].typeId, "uk-modern-statute");
});

// ─────────────────────────────────────────────────────────────────────────────
// The dash a student types is not evidence about which rule they meant
// ─────────────────────────────────────────────────────────────────────────────

test("a Māori Land Court block name is found whether the dash is typed or printed", () => {
  // Rule 3.5 separates the case name from the block with an en dash, and the
  // template demanded that exact character — so a hyphen meant the rule's own
  // type was not offered in the picker at all (rank -1).
  const want = "Faulkner v Hoete – Motiti North C No 1 [2018] Māori Appellate Court MB 17 (2018 APPEAL 17).";
  for (const text of [want, want.replace("–", "-")]) {
    const f = prefill("maori-land-court", text);
    assert.equal(f.caseName, "Faulkner v Hoete");
    assert.equal(f.blockName, "Motiti North C No 1");
    // The en dash the rule prints is restored on the way out.
    assert.equal(buildCitation("maori-land-court", f).text, want);
    assert.ok(
      detectTypes(text, 86).findIndex((d) => d.typeId === "maori-land-court") >= 0,
      "the type was not offered at all",
    );
  }
});

test("a span of years typed with a hyphen takes the en dash (3.2.8)", () => {
  const want =
    "Geoffrey Palmer “A Bill of Rights for New Zealand: A White Paper” [1984–1985] I AJHR A6 at 29.";
  assert.equal(buildCitation("ajhr", prefill("ajhr", want.replace("–", "-"))).text, want);
});

test("a hyphen that is not a range is left exactly as given", () => {
  // A docket number and a title keep every hyphen they were given. A title is
  // reproduced as its source printed it, and guessing at someone else's
  // punctuation is not this tool's business.
  const docket =
    "Wellington International Airport Ltd v Commerce Commission HC Wellington CIV-2011-485-249, 1 June 2011 at [2].";
  assert.equal(
    buildCitation("unreported-case-file-number-nz", prefill("unreported-case-file-number-nz", docket)).text,
    docket,
  );
  const title = "Simon France (ed) Adams on Criminal Law - Evidence (looseleaf ed, Thomson Reuters) at [ED1.01(2)].";
  assert.match(
    buildCitation("looseleaf-online-commentary", prefill("looseleaf-online-commentary", title)).text ?? "",
    /Adams on Criminal Law - Evidence/,
  );
});

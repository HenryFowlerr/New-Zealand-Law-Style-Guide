import assert from "node:assert/strict";
import test from "node:test";
import {
  analyseCitation,
  buildCitation,
  composeFootnote,
  extractedFields,
  missingRequiredFields,
  prefillCitation,
  sourceExamples,
  sourceTypes,
  type CitationTypeId,
} from "../src/citationEngine.ts";

test("every format has a worked example that builds to a ready citation", () => {
  const ids = sourceTypes.map((sourceType) => sourceType.id);
  for (const id of ids) {
    assert.ok(sourceExamples[id], `${id} is missing a worked example`);
    const result = buildCitation(id, sourceExamples[id]);
    assert.equal(result.status, "ready", `${id} example did not build`);
    assert.ok(result.text.endsWith("."), `${id} example lacks a final stop`);
  }
  // No example references a type that no longer exists.
  for (const key of Object.keys(sourceExamples) as CitationTypeId[]) {
    assert.ok(ids.includes(key), `example for unknown type ${key}`);
  }
});

test("every published format has unique fields and official rule provenance", () => {
  assert.equal(new Set(sourceTypes.map((item) => item.id)).size, sourceTypes.length);
  for (const sourceType of sourceTypes) {
    assert.match(sourceType.ruleUrl, /^https:\/\/lawfoundation\.org\.nz\/style-guide2019\//);
    const fieldIds = sourceType.fields.map((field) => field.id);
    assert.equal(
      new Set(fieldIds).size,
      fieldIds.length,
      `${sourceType.id} has duplicate fields`,
    );
  }
});

test("journal article uses round brackets for independent volumes", () => {
  const result = buildCitation("journal", {
    author: "Peter Watts",
    title: "Birks’ Unjust Enrichment",
    year: "2005",
    yearRole: "independent-volume",
    volume: "121",
    journal: "L.Q.R.",
    startPage: "163",
    pinpoint: "165",
  });
  assert.equal(result.status, "ready");
  assert.equal(
    result.text,
    "Peter Watts “Birks’ Unjust Enrichment” (2005) 121 LQR 163 at 165.",
  );
});

test("journal article uses square brackets when the year is the volume", () => {
  const result = buildCitation("journal", {
    author: "Jessica Palmer",
    title: "Theories of the Trust",
    year: "2010",
    yearRole: "year-is-volume",
    journal: "NZ L Rev",
    startPage: "541",
  });
  assert.equal(
    result.text,
    "Jessica Palmer “Theories of the Trust” [2010] NZ L Rev 541.",
  );
});

test("journal issue appears only when pages restart", () => {
  const result = buildCitation("journal", {
    author: "Ben Mathews and Kerryann Walsh",
    title: "At the Cutting Edge",
    year: "2004",
    yearRole: "independent-volume",
    volume: "9",
    pagesRestart: true,
    issue: "2",
    journal: "Australia & New Zealand Journal of Law & Education",
    startPage: "3",
  });
  assert.equal(
    result.text,
    "Ben Mathews and Kerryann Walsh “At the Cutting Edge” (2004) 9(2) Australia & New Zealand Journal of Law & Education 3.",
  );
});

test("journal generation fails closed without the volume decision", () => {
  const result = buildCitation("journal", {
    author: "A Author",
    title: "A Title",
    year: "2020",
    journal: "NZLJ",
    startPage: "12",
  });
  assert.equal(result.status, "incomplete");
  assert.equal(result.text, "");
  assert.ok(result.issues.some((issue) => issue.field === "yearRole"));
});

test("et al is normalised to and others with a visible note", () => {
  const result = buildCitation("journal", {
    author: "Smith et al.",
    title: "A Title",
    year: "2020",
    yearRole: "independent-volume",
    volume: "4",
    journal: "NZLJ",
    startPage: "12",
  });
  assert.equal(result.text, "Smith and others “A Title” (2020) 4 NZLJ 12.");
  assert.ok(result.issues.some((issue) => issue.level === "note"));
});

test("book output preserves an italic semantic token", () => {
  const result = buildCitation("book", {
    author: "Ross Carter",
    title: "Burrows and Carter Statute Law in New Zealand",
    edition: "5th",
    publisher: "LexisNexis",
    place: "Wellington",
    year: "2015",
    pinpoint: "311",
  });
  assert.equal(
    result.text,
    "Ross Carter Burrows and Carter Statute Law in New Zealand (5th ed, LexisNexis, Wellington, 2015) at 311.",
  );
  assert.match(
    result.html,
    /<em>Burrows and Carter Statute Law in New Zealand<\/em>/,
  );
});

test("first edition is omitted from a book and flagged with a note", () => {
  const result = buildCitation("book", {
    author: "Andrew Butler",
    title: "Equity and Trusts in New Zealand",
    edition: "1st",
    publisher: "Thomson Reuters",
    place: "Wellington",
    year: "2009",
  });
  assert.equal(
    result.text,
    "Andrew Butler Equity and Trusts in New Zealand (Thomson Reuters, Wellington, 2009).",
  );
  assert.doesNotMatch(result.text, /1st ed/);
  assert.ok(result.issues.some((issue) => issue.field === "edition" && issue.level === "note"));
});

test("later editions are still shown", () => {
  const result = buildCitation("book", {
    author: "Andrew Butler",
    title: "Equity and Trusts in New Zealand",
    edition: "2nd",
    publisher: "Thomson Reuters",
    place: "Wellington",
    year: "2009",
  });
  assert.match(result.text, /\(2nd ed, Thomson Reuters/);
});

test("chapter output adds in, editor designation, and starting page", () => {
  const result = buildCitation("chapter", {
    author: "Robin Cooke",
    title: "Tort and Contract",
    editor: "PD Finn",
    bookTitle: "Essays on Contract",
    publisher: "Law Book Company",
    place: "Sydney",
    year: "1987",
    startPage: "222",
    pinpoint: "229",
  });
  assert.equal(
    result.text,
    "Robin Cooke “Tort and Contract” in PD Finn (ed) Essays on Contract (Law Book Company, Sydney, 1987) 222 at 229.",
  );
});

test("looseleaf output uses only the guide-approved edition labels", () => {
  const result = buildCitation("looseleaf", {
    author: "Billie Little and others",
    title: "Personal Injury in New Zealand",
    editionType: "online",
    publisher: "Thomson Reuters",
    pinpoint: "[AC21.02]",
  });
  assert.equal(
    result.text,
    "Billie Little and others Personal Injury in New Zealand (online ed, Thomson Reuters) at [AC21.02].",
  );
});

test("report output omits absent publisher without leaving doubled punctuation", () => {
  const result = buildCitation("report", {
    author: "Labour Market Policy Group",
    title: "Cover for Mental Injury Arising from Witnessing a Traumatic Incident",
    officialCitation: "00/001872",
    date: "24 March 2000",
  });
  assert.equal(
    result.text,
    "Labour Market Policy Group Cover for Mental Injury Arising from Witnessing a Traumatic Incident (00/001872, 24 March 2000).",
  );
});

test("New Zealand legislation omits the country identifier", () => {
  const result = buildCitation("act", {
    title: "Evidence Act",
    year: "2006",
    jurisdiction: "NZ",
    referenceType: "s",
    reference: "43",
  });
  assert.equal(result.text, "Evidence Act 2006, s 43.");
  assert.ok(result.issues.some((issue) => issue.level === "note"));
});

test("delegated legislation cites like an Act with a regulation pinpoint", () => {
  const result = buildCitation("act", {
    title: "Health and Safety in Employment Regulations",
    year: "1995",
    referenceType: "reg",
    reference: "3",
  });
  assert.equal(result.text, "Health and Safety in Employment Regulations 1995, reg 3.");
});

test("detector and prefill handle a regulation title", () => {
  const suggestions = analyseCitation(
    "Health and Safety in Employment Regulations 1995, reg 3.",
  );
  assert.equal(suggestions[0]?.type, "act");
  const data = prefillCitation(
    "act",
    "Health and Safety in Employment Regulations 1995, reg 3.",
  );
  assert.equal(data.title, "Health and Safety in Employment Regulations");
  assert.equal(data.year, "1995");
  assert.equal(data.referenceType, "reg");
  assert.equal(data.reference, "3");
});

test("et al is normalised with a note on non-journal formats too", () => {
  const result = buildCitation("book", {
    author: "Andrew Smith et al",
    title: "A Treatise",
    publisher: "LexisNexis",
    place: "Wellington",
    year: "2015",
  });
  assert.match(result.text, /Andrew Smith and others A Treatise/);
  assert.ok(result.issues.some((issue) => issue.field === "author" && issue.level === "note"));
});

test("foreign legislation retains its jurisdiction identifier", () => {
  const result = buildCitation("act", {
    title: "Counter-Terrorism Act",
    year: "2008",
    jurisdiction: "UK",
    referenceType: "s",
    reference: "92",
  });
  assert.equal(result.text, "Counter-Terrorism Act 2008 (UK), s 92.");
});

test("reported case places neutral citation before the report citation", () => {
  const result = buildCitation("case-reported", {
    caseName: "Z v Dental Complaints Assessment Committee",
    neutralCitation: "[2008] NZSC 55",
    reportYear: "2009",
    yearRole: "essential",
    volume: "1",
    reportSeries: "NZLR",
    startPage: "1",
    pinpoint: "[26]",
  });
  assert.equal(
    result.text,
    "Z v Dental Complaints Assessment Committee [2008] NZSC 55, [2009] 1 NZLR 1 at [26].",
  );
  assert.match(
    result.html,
    /^<em>Z v Dental Complaints Assessment Committee<\/em>/,
  );
});

test("invalid neutral citation blocks reported-case output", () => {
  const result = buildCitation("case-reported", {
    caseName: "Example v Example",
    neutralCitation: "2008 NZSC 55",
    reportYear: "2009",
    yearRole: "essential",
    reportSeries: "NZLR",
    startPage: "1",
  });
  assert.equal(result.status, "incomplete");
  assert.equal(result.text, "");
});

test("neutral-only case follows year court judgment order", () => {
  const result = buildCitation("case-neutral", {
    caseName: "Attorney-General v X",
    year: "2007",
    court: "NZCA",
    judgmentNumber: "388",
    pinpoint: "[70]",
  });
  assert.equal(result.text, "Attorney-General v X [2007] NZCA 388 at [70].");
});

test("unreported case includes court, registry, file, and date", () => {
  const result = buildCitation("case-unreported", {
    caseName: "R v Tuhou",
    court: "HC",
    registry: "Napier",
    fileNumber: "CRI-2007-020-2820",
    date: "11 September 2008",
    pinpoint: "[13]",
  });
  assert.equal(
    result.text,
    "R v Tuhou HC Napier CRI-2007-020-2820, 11 September 2008 at [13].",
  );
});

test("non-obvious later text citation uses above n", () => {
  const result = buildCitation("subsequent", {
    sourceCategory: "text",
    context: "not-obvious",
    label: "Todd",
    earlierFootnote: "8",
    pinpoint: "50",
  });
  assert.equal(result.text, "Todd, above n 8, at 50.");
});

test("obvious later citation uses only the pinpoint and never ibid", () => {
  const result = buildCitation("subsequent", {
    sourceCategory: "text",
    context: "obvious",
    pinpoint: "92",
  });
  assert.equal(result.text, "At 92.");
  assert.doesNotMatch(result.text, /ibid/i);
});

test("later legislation never uses above n", () => {
  const result = buildCitation("subsequent", {
    sourceCategory: "legislation",
    context: "not-obvious",
    label: "Securities Act",
    referenceType: "s",
    pinpoint: "63",
  });
  assert.equal(result.text, "Securities Act, s 63.");
  assert.doesNotMatch(result.text, /above n/);
});

test("footnote composer applies semicolons, final and, and one full stop", () => {
  const first = buildCitation("journal", {
    author: "Simon Connell",
    title: "ACC infects the criminal law?",
    year: "2012",
    yearRole: "independent-volume",
    volume: "4",
    journal: "NZLJ",
    startPage: "135",
    pinpoint: "136",
  });
  const second = buildCitation("journal", {
    author: "Chris Gallavin",
    title: "Fraud vitiating consent",
    year: "2012",
    yearRole: "independent-volume",
    volume: "5",
    journal: "NZLJ",
    startPage: "156",
    pinpoint: "156",
  });
  const third = buildCitation("subsequent", {
    sourceCategory: "text",
    context: "not-obvious",
    label: "Todd",
    earlierFootnote: "8",
    pinpoint: "50",
  });
  const footnote = composeFootnote([first, second, third]);
  assert.equal(
    footnote.text,
    "Simon Connell “ACC infects the criminal law?” (2012) 4 NZLJ 135 at 136; Chris Gallavin “Fraud vitiating consent” (2012) 5 NZLJ 156 at 156; and Todd, above n 8, at 50.",
  );
  assert.equal((footnote.text.match(/\.$/g) ?? []).length, 1);
});

test("detector identifies the supplied journal structure", () => {
  const suggestions = analyseCitation(
    'Burrows “Liability for Psychiatric Illness: Where Should the Line be Drawn?” (1995) 3 Tort L Rev 220.',
  );
  assert.equal(suggestions[0]?.type, "journal");
  assert.equal(suggestions[0]?.confidence, "high");
});

test("detector refuses to guess from title and date alone", () => {
  const suggestions = analyseCitation("An uncertain title 24 March 2000");
  assert.deepEqual(suggestions, []);
});

test("prefill parses a journal but still leaves confirmation to the interface", () => {
  const data = prefillCitation(
    "journal",
    'Peter Watts “Birks’ Unjust Enrichment” (2005) 121 LQR 163 at 165.',
  );
  assert.deepEqual(data, {
    author: "Peter Watts",
    title: "Birks’ Unjust Enrichment",
    year: "2005",
    yearRole: "independent-volume",
    volume: "121",
    pagesRestart: false,
    issue: "",
    journal: "LQR",
    startPage: "163",
    pinpoint: "165",
  });
});

test("prefill reads a chapter and round-trips to the same citation", () => {
  const data = prefillCitation(
    "chapter",
    "Robin Cooke “Tort and Contract” in PD Finn (ed) Essays on Contract (2nd ed, Law Book Company, Sydney, 1987) 222 at 229.",
  );
  assert.deepEqual(data, {
    author: "Robin Cooke",
    title: "Tort and Contract",
    editor: "PD Finn",
    bookTitle: "Essays on Contract",
    edition: "2nd",
    publisher: "Law Book Company",
    place: "Sydney",
    year: "1987",
    startPage: "222",
    pinpoint: "229",
  });
  assert.equal(
    buildCitation("chapter", data).text,
    "Robin Cooke “Tort and Contract” in PD Finn (ed) Essays on Contract (2nd ed, Law Book Company, Sydney, 1987) 222 at 229.",
  );
});

test("prefill reads a reported case including the neutral citation", () => {
  const data = prefillCitation(
    "case-reported",
    "Z v Dental Complaints Assessment Committee [2008] NZSC 55, [2009] 1 NZLR 1 at [26].",
  );
  assert.equal(data.caseName, "Z v Dental Complaints Assessment Committee");
  assert.equal(data.neutralCitation, "[2008] NZSC 55");
  assert.equal(data.reportYear, "2009");
  assert.equal(data.yearRole, "essential");
  assert.equal(data.volume, "1");
  assert.equal(data.reportSeries, "NZLR");
  assert.equal(data.startPage, "1");
  assert.equal(
    buildCitation("case-reported", data).text,
    "Z v Dental Complaints Assessment Committee [2008] NZSC 55, [2009] 1 NZLR 1 at [26].",
  );
});

test("prefill reads an unreported case with registry and file number", () => {
  const data = prefillCitation(
    "case-unreported",
    "R v Tuhou HC Napier CRI-2007-020-2820, 11 September 2008 at [13].",
  );
  assert.deepEqual(data, {
    caseName: "R v Tuhou",
    court: "HC",
    registry: "Napier",
    fileNumber: "CRI-2007-020-2820",
    date: "11 September 2008",
    pinpoint: "[13]",
  });
});

test("prefill reads book publication details but leaves the ambiguous author and title", () => {
  const data = prefillCitation(
    "book",
    "Ross Carter Burrows and Carter Statute Law in New Zealand (5th ed, LexisNexis, Wellington, 2015) at 311.",
  );
  assert.equal(data.edition, "5th");
  assert.equal(data.publisher, "LexisNexis");
  assert.equal(data.place, "Wellington");
  assert.equal(data.year, "2015");
  assert.equal(data.pinpoint, "311");
  assert.equal(data.author, undefined);
  assert.equal(data.title, undefined);
});

test("prefill reads the looseleaf edition type and publisher", () => {
  const data = prefillCitation(
    "looseleaf",
    "Billie Little and others Personal Injury in New Zealand (online ed, Thomson Reuters) at [AC21.02].",
  );
  assert.equal(data.editionType, "online");
  assert.equal(data.publisher, "Thomson Reuters");
  assert.equal(data.pinpoint, "[AC21.02]");
});

test("missingRequiredFields reports only the parts a reference did not supply", () => {
  const data = prefillCitation(
    "book",
    "Ross Carter Some Title (LexisNexis, Wellington, 2015).",
  );
  const missing = missingRequiredFields("book", data).map((field) => field.id);
  assert.deepEqual(missing, ["author", "title"]);
  assert.ok(extractedFields("book", data).some((field) => field.id === "year"));
});

test("missingRequiredFields is empty once every required field is present", () => {
  const data = prefillCitation(
    "case-unreported",
    "R v Tuhou HC Napier CRI-2007-020-2820, 11 September 2008.",
  );
  assert.deepEqual(missingRequiredFields("case-unreported", data), []);
});

test("newspaper article italicises the masthead and keeps place and date", () => {
  const result = buildCitation("newspaper", {
    author: "Anne Smith",
    title: "New Court Rules Announced",
    newspaper: "The New Zealand Herald",
    place: "Auckland",
    date: "24 September 2009",
    pinpoint: "3",
  });
  assert.equal(
    result.text,
    "Anne Smith “New Court Rules Announced” The New Zealand Herald (Auckland, 24 September 2009) at 3.",
  );
  assert.match(result.html, /<em>The New Zealand Herald<\/em>/);
});

test("newspaper article without a named author starts with the title", () => {
  const result = buildCitation("newspaper", {
    title: "Editorial: Justice Delayed",
    newspaper: "The Dominion Post",
    place: "Wellington",
    date: "5 May 2018",
  });
  assert.equal(
    result.text,
    "“Editorial: Justice Delayed” The Dominion Post (Wellington, 5 May 2018).",
  );
});

test("internet material wraps the URL in angle brackets", () => {
  const result = buildCitation("internet", {
    author: "Ministry of Justice",
    title: "Annual Report 2018",
    date: "2018",
    url: "www.justice.govt.nz",
  });
  assert.equal(
    result.text,
    "Ministry of Justice “Annual Report 2018” (2018) <www.justice.govt.nz>.",
  );
});

test("internet material tolerates a URL already in angle brackets", () => {
  const result = buildCitation("internet", {
    title: "About the Courts",
    url: "<www.courtsofnz.govt.nz>",
  });
  assert.equal(result.text, "“About the Courts” <www.courtsofnz.govt.nz>.");
});

test("thesis lists the qualification, institution, and year", () => {
  const result = buildCitation("thesis", {
    author: "Jane Doe",
    title: "The Rule Against Perpetuities",
    qualification: "LLM Thesis",
    institution: "Victoria University of Wellington",
    year: "2016",
    pinpoint: "40",
  });
  assert.equal(
    result.text,
    "Jane Doe “The Rule Against Perpetuities” (LLM Thesis, Victoria University of Wellington, 2016) at 40.",
  );
});

test("conference paper uses the paper-presented-at form", () => {
  const result = buildCitation("conference", {
    author: "John Smith",
    title: "Reforming the Law of Trusts",
    conference: "New Zealand Law Conference",
    place: "Auckland",
    date: "October 2018",
  });
  assert.equal(
    result.text,
    "John Smith “Reforming the Law of Trusts” (paper presented at New Zealand Law Conference, Auckland, October 2018).",
  );
});

test("bill cites title, year, bill number, and clause", () => {
  const result = buildCitation("bill", {
    title: "Evidence Bill",
    year: "2005",
    billNumber: "256-1",
    clause: "5",
  });
  assert.equal(result.text, "Evidence Bill 2005 (256-1), cl 5.");
});

test("bill omits the clause when none is given", () => {
  const result = buildCitation("bill", {
    title: "Terrorism Suppression Bill",
    year: "2001",
    billNumber: "207-2",
  });
  assert.equal(result.text, "Terrorism Suppression Bill 2001 (207-2).");
});

test("hansard cites date, volume, NZPD, and page with an optional speaker", () => {
  const withSpeaker = buildCitation("hansard", {
    date: "21 September 2010",
    volume: "666",
    page: "14104",
    speaker: "Hon Simon Power",
  });
  assert.equal(withSpeaker.text, "(21 September 2010) 666 NZPD 14104 (Hon Simon Power).");
  const plain = buildCitation("hansard", {
    date: "3 March 2009",
    volume: "652",
    page: "1234",
  });
  assert.equal(plain.text, "(3 March 2009) 652 NZPD 1234.");
});

test("press release marks the source in parentheses", () => {
  const result = buildCitation("press-release", {
    author: "New Zealand Law Society",
    title: "Access to Justice",
    date: "5 May 2018",
  });
  assert.equal(
    result.text,
    "New Zealand Law Society “Access to Justice” (press release, 5 May 2018).",
  );
});

test("detector routes new source types to the right format", () => {
  assert.equal(
    analyseCitation("(21 September 2010) 666 NZPD 14104.")[0]?.type,
    "hansard",
  );
  assert.equal(
    analyseCitation("Evidence Bill 2005 (256-1), cl 5.")[0]?.type,
    "bill",
  );
  assert.equal(
    analyseCitation(
      "New Zealand Law Society “Access to Justice” (press release, 5 May 2018).",
    )[0]?.type,
    "press-release",
  );
  assert.equal(
    analyseCitation(
      "Ministry of Justice “Annual Report 2018” (2018) <www.justice.govt.nz>.",
    )[0]?.type,
    "internet",
  );
  assert.equal(
    analyseCitation(
      "Jane Doe “Title” (LLM Thesis, University of Otago, 2016).",
    )[0]?.type,
    "thesis",
  );
});

test("reported-case format handles a foreign House of Lords authority", () => {
  const result = buildCitation("case-reported", {
    caseName: "Donoghue v Stevenson",
    reportYear: "1932",
    yearRole: "essential",
    reportSeries: "AC",
    startPage: "562",
    court: "HL",
  });
  assert.equal(result.text, "Donoghue v Stevenson [1932] AC 562 (HL).");
});

test("reported-case format handles an Australian authority with a round-bracket year", () => {
  const result = buildCitation("case-reported", {
    caseName: "Mabo v Queensland (No 2)",
    reportYear: "1992",
    yearRole: "descriptive",
    volume: "175",
    reportSeries: "CLR",
    startPage: "1",
  });
  assert.equal(result.text, "Mabo v Queensland (No 2) (1992) 175 CLR 1.");
});

test("more than three authors are cited with the and-others form", () => {
  const result = buildCitation("journal", {
    author: "Andrew Smith et al",
    title: "A Study",
    year: "2020",
    yearRole: "independent-volume",
    volume: "4",
    journal: "NZLJ",
    startPage: "12",
  });
  assert.match(result.text, /Andrew Smith and others/);
});

test("a full worked footnote of mixed authorities is punctuated correctly", () => {
  const act = buildCitation("act", { title: "Evidence Act", year: "2006", referenceType: "s", reference: "8" });
  const caseCite = buildCitation("case-neutral", {
    caseName: "Attorney-General v X",
    year: "2007",
    court: "NZCA",
    judgmentNumber: "388",
    pinpoint: "[70]",
  });
  const book = buildCitation("book", {
    author: "Ross Carter",
    title: "Burrows and Carter Statute Law in New Zealand",
    edition: "5th",
    publisher: "LexisNexis",
    place: "Wellington",
    year: "2015",
    pinpoint: "311",
  });
  const footnote = composeFootnote([act, caseCite, book]);
  assert.equal(
    footnote.text,
    "Evidence Act 2006, s 8; Attorney-General v X [2007] NZCA 388 at [70]; and Ross Carter Burrows and Carter Statute Law in New Zealand (5th ed, LexisNexis, Wellington, 2015) at 311.",
  );
});

test("HTML output escapes user-supplied markup", () => {
  const result = buildCitation("book", {
    author: "<script>alert(1)</script>",
    title: "A & B",
    publisher: "Publisher",
    place: "Wellington",
    year: "2020",
  });
  assert.doesNotMatch(result.html, /<script>/);
  assert.match(result.html, /&lt;script&gt;/);
  assert.match(result.html, /A &amp; B/);
});

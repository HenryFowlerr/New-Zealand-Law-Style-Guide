/**
 * Ground truth for the guarantee that matters: the right values in the right
 * boxes must produce the Guide's citation exactly.
 *
 * Every `fields` set here is written out by hand against the type's template,
 * and every `want` is a worked example from the New Zealand Law Style Guide,
 * Third Edition, quoted verbatim. Nothing is derived from the extractor, so a
 * pass proves the RENDERER is right rather than proving the extractor and the
 * renderer agree with each other — which is all the older accuracy report ever
 * showed.
 *
 * Coverage is deliberately weighted to what a New Zealand law student cites in
 * an essay: cases, legislation, secondary sources and parliamentary material.
 */
export type FieldTruth = {
  typeId: string;
  /** What the student has in front of them, in the right boxes. */
  fields: Record<string, string>;
  /** The Guide's own worked example, verbatim (plus the footnote full stop). */
  want: string;
  /** Set when the Guide's form is one the ingested template cannot express. */
  knownGap?: string;
};

export const FIELD_TRUTH: FieldTruth[] = [
  // ---------------------------------------------------------------- 3.2 cases
  {
    typeId: "reported-case-nz",
    fields: {
      caseName: "Z v Dental Complaints Assessment Committee",
      neutralCitation: "[2008] NZSC 55",
      year: "[2009]",
      volume: "1",
      reportSeries: "NZLR",
      startingPage: "1",
      pinpoint: "[26]",
    },
    want: "Z v Dental Complaints Assessment Committee [2008] NZSC 55, [2009] 1 NZLR 1 at [26].",
  },
  {
    typeId: "reported-case-nz",
    // The court identifier is entered as well: a student reading the judgment
    // has it. Rule 3.2 requires it to be dropped when a neutral citation is
    // present, so the output must be identical to the entry above.
    fields: {
      caseName: "Z v Dental Complaints Assessment Committee",
      neutralCitation: "[2008] NZSC 55",
      year: "[2009]",
      volume: "1",
      reportSeries: "NZLR",
      startingPage: "1",
      courtIdentifier: "SC",
      pinpoint: "[26]",
    },
    want: "Z v Dental Complaints Assessment Committee [2008] NZSC 55, [2009] 1 NZLR 1 at [26].",
  },
  {
    typeId: "reported-case-nz",
    fields: {
      caseName: "Body Corporate 202254 v Taylor",
      neutralCitation: "[2008] NZCA 317",
      year: "[2009]",
      volume: "2",
      reportSeries: "NZLR",
      startingPage: "17",
      pinpoint: "[76(c)]",
    },
    want: "Body Corporate 202254 v Taylor [2008] NZCA 317, [2009] 2 NZLR 17 at [76(c)].",
  },
  {
    typeId: "reported-case-nz",
    fields: {
      caseName: "Taylor v New Zealand Poultry Board",
      year: "[1984]",
      volume: "1",
      reportSeries: "NZLR",
      startingPage: "394",
      courtIdentifier: "CA",
      pinpoint: "398",
    },
    want: "Taylor v New Zealand Poultry Board [1984] 1 NZLR 394 (CA) at 398.",
  },
  {
    typeId: "reported-case-nz",
    fields: {
      caseName: "Hawkins v Minister of Justice",
      year: "[1991]",
      volume: "2",
      reportSeries: "NZLR",
      startingPage: "530",
      courtIdentifier: "CA",
      pinpoint: "534",
    },
    want: "Hawkins v Minister of Justice [1991] 2 NZLR 530 (CA) at 534.",
  },
  {
    typeId: "reported-case-nz",
    fields: {
      caseName: "Commerce Commission v Progressive Enterprises Ltd",
      neutralCitation: "[2010] NZCA 374",
      year: "(2010)",
      volume: "12",
      reportSeries: "TCLR",
      startingPage: "736",
      pinpoint: "[38]",
    },
    want: "Commerce Commission v Progressive Enterprises Ltd [2010] NZCA 374, (2010) 12 TCLR 736 at [38].",
  },

  // ---------------------------------------------------------------- 3.3 cases
  {
    typeId: "neutral-citation-case-nz",
    fields: {
      caseName: "Attorney-General v X",
      year: "2007",
      courtIdentifier: "NZCA",
      judgmentNumber: "388",
      pinpoint: "[70]",
    },
    want: "Attorney-General v X [2007] NZCA 388 at [70].",
  },
  {
    typeId: "neutral-citation-case-nz",
    fields: {
      caseName: "North Shore City Council v Attorney-General",
      year: "2010",
      courtIdentifier: "NZSC",
      judgmentNumber: "125",
    },
    want: "North Shore City Council v Attorney-General [2010] NZSC 125.",
  },
  {
    typeId: "neutral-citation-case-nz",
    fields: {
      caseName: "Griffin v Citibus Ltd",
      year: "2011",
      courtIdentifier: "NZERA Christchurch",
      judgmentNumber: "137",
    },
    want: "Griffin v Citibus Ltd [2011] NZERA Christchurch 137.",
  },

  // ---------------------------------------------------------------- 3.4 cases
  {
    typeId: "unreported-case-file-number-nz",
    fields: {
      caseName: "R v Reekie",
      fileNumber: "CA339/03",
      dateOfJudgment: "3 August 2004",
      pinpoint: "[35]",
    },
    want: "R v Reekie CA339/03, 3 August 2004 at [35].",
  },
  {
    typeId: "unreported-case-file-number-nz",
    fields: {
      caseName: "R v Tuhou",
      courtAbbreviation: "HC",
      registry: "Napier",
      fileNumber: "CRI-2007-020-2820",
      dateOfJudgment: "11 September 2008",
      pinpoint: "[13]",
    },
    want: "R v Tuhou HC Napier CRI-2007-020-2820, 11 September 2008 at [13].",
  },
  {
    typeId: "unreported-case-file-number-nz",
    fields: {
      caseName: "Chirnside v Fay",
      courtAbbreviation: "SC",
      fileNumber: "CIV 7/2004",
      dateOfJudgment: "26 August 2004",
    },
    want: "Chirnside v Fay SC CIV 7/2004, 26 August 2004.",
  },
  {
    typeId: "unreported-case-file-number-nz",
    fields: {
      caseName: "Greenbaum v Waikato District Health Board",
      courtAbbreviation: "ERA",
      registry: "Auckland",
      fileNumber: "AA506/10",
      dateOfJudgment: "10 December 2010",
    },
    want: "Greenbaum v Waikato District Health Board ERA Auckland AA506/10, 10 December 2010.",
  },

  // ----------------------------------------------------------- 4.1.1 statutes
  {
    typeId: "nz-statute",
    fields: { shortTitle: "Gaming Duties Act", year: "1971", pinpoint: "s 9" },
    want: "Gaming Duties Act 1971, s 9.",
  },
  {
    typeId: "nz-statute",
    fields: { shortTitle: "Evidence Act", year: "2006", pinpoint: "s 44" },
    want: "Evidence Act 2006, s 44.",
  },
  {
    typeId: "nz-statute",
    fields: { shortTitle: "Income Tax Act", year: "2004", pinpoint: "s CE 10" },
    want: "Income Tax Act 2004, s CE 10.",
  },
  {
    typeId: "nz-statute",
    fields: {
      shortTitle: "New Zealand Bill of Rights Act",
      year: "1990",
      pinpoint: "long title",
    },
    want: "New Zealand Bill of Rights Act 1990, long title.",
  },
  {
    typeId: "nz-statute",
    fields: { shortTitle: "Property Law Act", year: "2007", pinpoint: "sch 3 cl 4" },
    want: "Property Law Act 2007, sch 3 cl 4.",
  },
  {
    typeId: "nz-statute",
    fields: {
      shortTitle: "Property (Relationships) Act",
      year: "1976",
      pinpoint: "s 2 definition of “family chattels”, para (b)",
    },
    want: "Property (Relationships) Act 1976, s 2 definition of “family chattels”, para (b).",
  },
  {
    typeId: "nz-statute",
    // No pinpoint: the comma that introduces it must go with it.
    fields: { shortTitle: "Evidence Act", year: "2006" },
    want: "Evidence Act 2006.",
  },

  // ------------------------------------------------------- 4.3.1 instruments
  {
    typeId: "legislative-instrument",
    fields: {
      title: "Costs in Criminal Cases Regulations",
      year: "1987",
      pinpoint: "reg 3",
    },
    want: "Costs in Criminal Cases Regulations 1987, reg 3.",
  },
  {
    typeId: "legislative-instrument",
    fields: { title: "Minimum Wage Order", year: "2010", pinpoint: "cl 4(a)" },
    want: "Minimum Wage Order 2010, cl 4(a).",
  },

  // ------------------------------------------------------------- 4.2.1 bills
  {
    typeId: "bill",
    fields: {
      shortTitle: "Judicial Matters Bill",
      year: "2008",
      billNumber: "216",
      barNumber: "1",
      pinpoint: "cl 3",
    },
    want: "Judicial Matters Bill 2008 (216-1), cl 3.",
  },
  {
    typeId: "bill",
    fields: {
      shortTitle: "Arms Amendment Bill (No 3)",
      year: "2005",
      billNumber: "248",
      barNumber: "1",
    },
    want: "Arms Amendment Bill (No 3) 2005 (248-1).",
  },
  {
    typeId: "bill",
    // No bar number: the hyphen that joined it must not survive.
    fields: { shortTitle: "Judicial Retirement Age Bill", year: "2006", billNumber: "90" },
    want: "Judicial Retirement Age Bill 2006 (90).",
  },

  // -------------------------------------------------------------- 6.1 books
  {
    typeId: "text-book",
    fields: {
      author: "Ross Carter",
      title: "Burrows and Carter Statute Law in New Zealand",
      edition: "5th ed",
      publisher: "LexisNexis",
      placeOfPublication: "Wellington",
      year: "2015",
      pinpoint: "311",
    },
    want: "Ross Carter Burrows and Carter Statute Law in New Zealand (5th ed, LexisNexis, Wellington, 2015) at 311.",
  },
  {
    typeId: "text-book",
    fields: {
      author: "Andrew Butler and Petra Butler",
      title: "The New Zealand Bill of Rights Act: A Commentary",
      edition: "2nd ed",
      publisher: "LexisNexis",
      placeOfPublication: "Wellington",
      year: "2015",
    },
    want: "Andrew Butler and Petra Butler The New Zealand Bill of Rights Act: A Commentary (2nd ed, LexisNexis, Wellington, 2015).",
  },
  {
    typeId: "text-book",
    fields: {
      author: "Roger Fenton",
      title: "Garrow and Fenton’s Law of Personal Property in New Zealand",
      edition: "7th ed",
      publisher: "LexisNexis",
      placeOfPublication: "Wellington",
      year: "2010",
      volume: "2",
      pinpoint: "[2.2.20]",
    },
    want: "Roger Fenton Garrow and Fenton’s Law of Personal Property in New Zealand (7th ed, LexisNexis, Wellington, 2010) vol 2 at [2.2.20].",
  },
  {
    typeId: "text-book",
    fields: {
      author: "Andrew Burrows",
      title: "The Law of Restitution",
      edition: "3rd ed",
      publisher: "Oxford University Press",
      placeOfPublication: "Oxford",
      year: "2011",
      pinpoint: "189, n 92",
    },
    want: "Andrew Burrows The Law of Restitution (3rd ed, Oxford University Press, Oxford, 2011) at 189, n 92.",
  },

  // ------------------------------------------------------ 6.2 edited books
  {
    typeId: "essay-in-edited-book",
    fields: {
      author: "Robin Cooke",
      essayTitle: "Tort and Contract",
      editor: "PD Finn",
      bookTitle: "Essays on Contract",
      publisher: "Law Book Company",
      place: "Sydney",
      year: "1987",
      startingPage: "222",
      pinpoint: "229",
    },
    want: "Robin Cooke “Tort and Contract” in PD Finn (ed) Essays on Contract (Law Book Company, Sydney, 1987) 222 at 229.",
  },
  {
    typeId: "essay-in-edited-book",
    fields: {
      author: "Jessica Palmer",
      essayTitle: "Constructive Trusts",
      editor: "Andrew Butler",
      bookTitle: "Equity and Trusts in New Zealand",
      edition: "2nd ed",
      publisher: "Thomson Reuters",
      place: "Wellington",
      year: "2009",
      startingPage: "335",
      pinpoint: "339",
    },
    want: "Jessica Palmer “Constructive Trusts” in Andrew Butler (ed) Equity and Trusts in New Zealand (2nd ed, Thomson Reuters, Wellington, 2009) 335 at 339.",
  },
  {
    typeId: "essay-in-edited-book",
    // No editor named: rule 6.2 gives the essay authors as the book's authors,
    // in the editor's position but without the "(ed)" marker.
    fields: {
      author: "Scott Optican",
      essayTitle: "Search and Seizure",
      bookAuthors: "Paul Rishworth and others",
      bookTitle: "The New Zealand Bill of Rights",
      publisher: "Oxford University Press",
      place: "Melbourne",
      year: "2003",
      startingPage: "418",
      pinpoint: "425",
    },
    want: "Scott Optican “Search and Seizure” in Paul Rishworth and others The New Zealand Bill of Rights (Oxford University Press, Melbourne, 2003) 418 at 425.",
  },
  {
    typeId: "essay-in-edited-book",
    fields: {
      author: "John Finnis",
      essayTitle: "Practical Reason’s Foundations",
      bookTitle: "Reason in Action: Collected Essays Volume 1",
      publisher: "Oxford University Press",
      place: "Oxford",
      year: "2011",
      startingPage: "19",
      pinpoint: "37",
    },
    want: "John Finnis “Practical Reason’s Foundations” in Reason in Action: Collected Essays Volume 1 (Oxford University Press, Oxford, 2011) 19 at 37.",
  },

  // ------------------------------------------------------------ 6.4 journals
  {
    typeId: "journal-article",
    fields: {
      author: "Peter Watts",
      title: "Birks’ Unjust Enrichment",
      year: "(2005)",
      volume: "121",
      journalAbbrev: "LQR",
      startingPage: "163",
      pinpoint: "165",
    },
    want: "Peter Watts “Birks’ Unjust Enrichment” (2005) 121 LQR 163 at 165.",
  },
  {
    typeId: "journal-article",
    // A year-as-volume journal: no volume number, square-bracket year.
    fields: {
      author: "Jessica Palmer",
      title:
        "Theories of the Trust and What They Might Mean for Beneficiary Rights to Information",
      year: "[2010]",
      journalAbbrev: "NZ L Rev",
      startingPage: "541",
    },
    want: "Jessica Palmer “Theories of the Trust and What They Might Mean for Beneficiary Rights to Information” [2010] NZ L Rev 541.",
  },
  {
    typeId: "journal-article",
    fields: {
      author: "Catriona MacLennan",
      title: "Radical criminal pre-trial changes",
      year: "(2009)",
      volume: "733",
      journalAbbrev: "LawTalk",
      startingPage: "7",
    },
    want: "Catriona MacLennan “Radical criminal pre-trial changes” (2009) 733 LawTalk 7.",
  },

  // ----------------------------------------------------------- 5.1.1 Hansard
  {
    typeId: "hansard",
    fields: {
      dateOfDebate: "6 April 2005",
      volume: "624",
      abbreviatedTitle: "NZPD",
      pinpoint: "19676",
    },
    want: "(6 April 2005) 624 NZPD 19676.",
  },

  // ------------------------------------------------- 5.2.3 Law Commission
  {
    typeId: "law-commission-report",
    fields: {
      author: "Law Commission",
      title: "The Prosecution of Offences",
      officialCitation: "NZLC PP12",
      year: "1990",
      pinpoint: "2",
    },
    want: "Law Commission The Prosecution of Offences (NZLC PP12, 1990) at 2.",
  },
  {
    typeId: "law-commission-report",
    fields: {
      author: "Law Commission",
      title: "Tribunal Reform",
      officialCitation: "NZLC SP20",
      year: "2008",
    },
    want: "Law Commission Tribunal Reform (NZLC SP20, 2008).",
  },

  // ---------------------------------------------------------- 7.2 newspapers
  {
    typeId: "newspaper-magazine-article",
    fields: {
      author: "Rob Hosking",
      articleTitle: "Messy Allowance Law Finally Gets Clarity",
      newspaperTitle: "The National Business Review",
      place: "New Zealand",
      date: "17 July 2009",
      pinpoint: "2",
    },
    want: "Rob Hosking “Messy Allowance Law Finally Gets Clarity” The National Business Review (New Zealand, 17 July 2009) at 2.",
  },
  {
    typeId: "newspaper-magazine-article",
    fields: {
      author: "Audrey Young",
      articleTitle: "Entire NZ China trade board resigns",
      newspaperTitle: "The New Zealand Herald",
      onlineEd: "online ed",
      place: "Auckland",
      date: "24 June 2011",
    },
    want: "Audrey Young “Entire NZ China trade board resigns” The New Zealand Herald (online ed, Auckland, 24 June 2011).",
  },

  // ------------------------------------------------------------ 7.1 internet
  {
    typeId: "internet-material",
    fields: {
      author: "Dean Knight",
      title: "Parliament and the Bill of Rights – a blasé attitude?",
      date: "6 April 2009",
      websiteName: "LAWS179 Elephants and the Law",
      url: "<www.laws179.co.nz>",
    },
    want: "Dean Knight “Parliament and the Bill of Rights – a blasé attitude?” (6 April 2009) LAWS179 Elephants and the Law <www.laws179.co.nz>.",
  },
  {
    typeId: "internet-material",
    // No author and no date: both introduced separators must disappear.
    fields: {
      title: "Frequently Asked Questions – Electoral Finance Reform",
      websiteName: "Ministry of Justice",
      url: "<www.justice.govt.nz>",
    },
    want: "“Frequently Asked Questions – Electoral Finance Reform” Ministry of Justice <www.justice.govt.nz>.",
  },

  // ------------------------------------------------ 2.3 subsequent references
  {
    typeId: "subsequent-references",
    fields: { identifier: "R v Wang", footnoteNumber: "49", pinpoint: "533" },
    want: "R v Wang, above n 49, at 533.",
  },
  {
    typeId: "subsequent-references",
    fields: {
      identifier: "Smith “Rethinking the Defence of Mistake”",
      footnoteNumber: "25",
      pinpoint: "431",
    },
    want: "Smith “Rethinking the Defence of Mistake”, above n 25, at 431.",
  },

  // ═══════════════════ Coverage of every remaining student-facing type ═══════
  // Fields written out by hand against each template; every `want` is a worked
  // example from the Guide, verbatim.

  {
    typeId: "maori-land-court",
    fields: {
      caseName: "Pacey v Adlam", blockName: "Matata Parish 39A 2B 2B 2A",
      year: "(2017)", minuteBookReference: "178 Waiariki MB 32",
      citation: "178 WAR 32",
    },
    want: "Pacey v Adlam – Matata Parish 39A 2B 2B 2A (2017) 178 Waiariki MB 32 (178 WAR 32).",
  },
  {
    typeId: "maori-land-court",
    fields: {
      caseName: "Faulkner v Hoete", blockName: "Motiti North C No 1",
      year: "[2018]", minuteBookReference: "Māori Appellate Court MB 17",
      citation: "2018 APPEAL 17",
    },
    want: "Faulkner v Hoete – Motiti North C No 1 [2018] Māori Appellate Court MB 17 (2018 APPEAL 17).",
  },
  {
    typeId: "waitangi-tribunal-report",
    fields: {
      author: "Waitangi Tribunal", title: "The East Coast Settlement Report",
      waiNumber: "2190", year: "2010", pinpoint: "51",
    },
    want: "Waitangi Tribunal The East Coast Settlement Report (Wai 2190, 2010) at 51.",
  },
  {
    typeId: "waitangi-tribunal-report",
    fields: {
      author: "Waitangi Tribunal",
      title: "Ko Aotearoa Tēnei: A Report into Claims Concerning New Zealand Law and Policy Affecting Māori Culture and Identity",
      waiNumber: "262", year: "2011", volume: "2", pinpoint: "500",
    },
    want: "Waitangi Tribunal Ko Aotearoa Tēnei: A Report into Claims Concerning New Zealand Law and Policy Affecting Māori Culture and Identity (Wai 262, 2011) vol 2 at 500.",
  },
  {
    typeId: "supreme-court-transcript",
    fields: { caseName: "Westpac New Zealand Ltd v Map & Associates Ltd", year: "2011", number: "15", pinpoint: "7" },
    want: "Westpac New Zealand Ltd v Map & Associates Ltd [2011] NZSC Trans 15 at 7.",
  },
  {
    typeId: "supreme-court-transcript",
    fields: { caseName: "Dollars & Sense Ltd v Nathan", fileNumber: "SC31/2007", hearingDate: "22 November 2007" },
    want: "Dollars & Sense Ltd v Nathan Transcript SC31/2007, 22 November 2007.",
  },
  {
    typeId: "nz-provincial-legislation",
    fields: { shortTitle: "Manawatu Racecourse Act", year: "1869", province: "Wellington" },
    want: "Manawatu Racecourse Act 1869 (Wellington).",
  },
  {
    typeId: "nz-pre-1854-ordinance",
    fields: { title: "Distillation Prohibition Ordinance", year: "1841", regnalYear: "4 Vict", ordinanceNumber: "5", pinpoint: "cl 1" },
    want: "Distillation Prohibition Ordinance 1841 4 Vict 5, cl 1.",
  },
  {
    typeId: "nz-pre-1854-ordinance",
    fields: { title: "Scab Ordinance of New Munster", year: "1849", regnalYear: "13 Vict", ordinanceNumber: "4" },
    want: "Scab Ordinance of New Munster 1849 13 Vict 4.",
  },
  {
    typeId: "treaty-of-waitangi",
    fields: { title: "Te Tiriti o Waitangi", year: "1840", pinpoint: "art 3" },
    want: "Te Tiriti o Waitangi 1840, art 3.",
  },
  {
    typeId: "court-rules",
    fields: { title: "High Court Rules", year: "2016", rule: "14.3" },
    want: "High Court Rules 2016, r 14.3.",
  },
  {
    typeId: "other-instrument-dinli",
    fields: { title: "Electricity Industry Participation Code", year: "2010", pinpoint: "cl 10.15" },
    want: "Electricity Industry Participation Code 2010, cl 10.15.",
  },
  {
    typeId: "other-instrument-dinli",
    // No year: rule 4.3.4 still puts a comma before the pinpoint.
    fields: { title: "Civil Aviation Rules", pinpoint: "r 19.5" },
    want: "Civil Aviation Rules, r 19.5.",
  },
  {
    typeId: "ajhr",
    fields: {
      author: "Geoffrey Palmer", title: "A Bill of Rights for New Zealand: A White Paper",
      yearOfJournal: "1984–1985", volume: "I", referenceNumber: "A6", pinpoint: "29",
    },
    want: "Geoffrey Palmer “A Bill of Rights for New Zealand: A White Paper” [1984–1985] I AJHR A6 at 29.",
  },
  {
    typeId: "standing-orders",
    fields: { title: "Standing Orders of the House of Representatives", year: "2017", orderNumber: "265(5)" },
    want: "Standing Orders of the House of Representatives 2017, SO 265(5).",
  },
  {
    typeId: "cabinet-manual",
    fields: { author: "Cabinet Office", title: "Cabinet Manual 2008", pinpoint: "[2.91]" },
    want: "Cabinet Office Cabinet Manual 2008 at [2.91].",
  },
  {
    typeId: "select-committee-report-other",
    fields: {
      committeeName: "Foreign Affairs, Defence and Trade Committee",
      title: "Briefing on Egypt and the Middle East", date: "18 March 2011", pinpoint: "2",
    },
    want: "Foreign Affairs, Defence and Trade Committee Briefing on Egypt and the Middle East (18 March 2011) at 2.",
  },
  {
    typeId: "paper-or-report",
    fields: {
      author: "Roger Procter", title: "Enhancing Productivity: Towards an Updated Action Agenda",
      publisher: "Ministry of Economic Development", officialCitation: "Occasional Paper 11/01",
      date: "March 2011", pinpoint: "10",
    },
    want: "Roger Procter Enhancing Productivity: Towards an Updated Action Agenda (Ministry of Economic Development, Occasional Paper 11/01, March 2011) at 10.",
  },
  {
    typeId: "paper-or-report",
    fields: { author: "Ministry of Education", title: "Briefing to the Incoming Minister", date: "November 2008" },
    want: "Ministry of Education Briefing to the Incoming Minister (November 2008).",
  },
  {
    typeId: "ebook-electronic-only",
    fields: {
      author: "Paul Grussendorf",
      title: "My Trials: What I Learned in Immigration Court – Inside America’s Deportation Factories",
      edition: "2nd ed", ebookEd: "eBook ed", publisher: "eBooks by Barb", year: "2011",
    },
    want: "Paul Grussendorf My Trials: What I Learned in Immigration Court – Inside America’s Deportation Factories (2nd ed, eBook ed, eBooks by Barb, 2011).",
  },
  {
    typeId: "looseleaf-online-commentary",
    fields: {
      editor: "Simon France", title: "Adams on Criminal Law – Evidence",
      edition: "looseleaf ed", publisher: "Thomson Reuters", pinpoint: "[ED1.01(2)]",
    },
    want: "Simon France (ed) Adams on Criminal Law – Evidence (looseleaf ed, Thomson Reuters) at [ED1.01(2)].",
  },
  {
    typeId: "legal-encyclopaedia",
    fields: {
      title: "Halsbury’s Laws of England", edition: "5th ed", year: "2017",
      volume: "9", topic: "Children and Young Persons", pinpoint: "[651]",
    },
    want: "Halsbury’s Laws of England (5th ed, 2017) vol 9 Children and Young Persons at [651].",
  },
  {
    typeId: "legal-encyclopaedia",
    fields: {
      title: "Halsbury’s Laws of England", edition: "4th ed", reissue: "reissue",
      year: "1998", volume: "9(1)", topic: "Contract", pinpoint: "[859]",
    },
    want: "Halsbury’s Laws of England (4th ed, reissue, 1998) vol 9(1) Contract at [859].",
  },
  {
    typeId: "laws-of-new-zealand",
    fields: { author: "Charles Rickett", title: "Laws of New Zealand", topic: "Equity", pinpoint: "[98]" },
    want: "Charles Rickett Laws of New Zealand Equity at [98].",
  },
  {
    typeId: "laws-of-new-zealand",
    fields: {
      author: "Colin Pidgeon", title: "Laws of New Zealand",
      topic: "Civil Procedure: Supreme Court and Court of Appeal",
      reissue: "Reissue 1", pinpoint: "[59]",
    },
    want: "Colin Pidgeon Laws of New Zealand Civil Procedure: Supreme Court and Court of Appeal (Reissue 1) at [59].",
  },
  {
    typeId: "podcast",
    fields: {
      host: "Russ Roberts", title: "Richard Epstein on Regulation", podcastMarker: "podcast",
      date: "30 August 2010", websiteName: "EconTalk", url: "<www.econtalk.org>",
    },
    want: "Russ Roberts “Richard Epstein on Regulation” (podcast, 30 August 2010) EconTalk <www.econtalk.org>.",
  },
  {
    typeId: "press-release",
    fields: { author: "Air New Zealand", title: "Lock-out notice issued to EPMU", description: "press release", date: "21 April 2009" },
    want: "Air New Zealand “Lock-out notice issued to EPMU” (press release, 21 April 2009).",
  },

  // Foreign authority a New Zealand court reasons from.
  {
    typeId: "australia-case",
    fields: {
      caseName: "South Australia v Johnson", year: "(1982)", volume: "26",
      reportSeries: "SASR", startingPage: "41", jurisdictionCourt: "SC",
      reportCitation: "(1982) 26 SASR 41",
    },
    want: "South Australia v Johnson (1982) 26 SASR 41 (SC).",
  },
  {
    typeId: "england-wales-case-modern",
    fields: {
      caseName: "Universal Thermosensors Ltd v Hibben", year: "[1992]", volume: "1",
      reportSeries: "WLR", startingPage: "840", court: "Ch",
      reportCitation: "[1992] 1 WLR 840",
    },
    want: "Universal Thermosensors Ltd v Hibben [1992] 1 WLR 840 (Ch).",
  },
  {
    typeId: "england-wales-case-modern",
    fields: {
      caseName: "Foskett v McKeown", year: "[2001]", volume: "1",
      reportSeries: "AC", startingPage: "102", court: "HL",
      reportCitation: "[2001] 1 AC 102",
    },
    want: "Foskett v McKeown [2001] 1 AC 102 (HL).",
  },
  {
    typeId: "canada-case",
    fields: { caseName: "Bruni v Bruni", neutralCitationNoBrackets: "2010 ONSC 6568", reportCitation: "2010 ONSC 6568" },
    want: "Bruni v Bruni 2010 ONSC 6568.",
  },
  {
    typeId: "scotland-case",
    fields: {
      caseName: "Musaj v Secretary of State for the Home Department",
      year: "2004", reportSeries: "SLT", startingPage: "623", court: "OH",
    },
    want: "Musaj v Secretary of State for the Home Department 2004 SLT 623 (OH).",
  },
  {
    typeId: "treaty",
    fields: {
      treatyName: "United Nations Convention against Illicit Traffic in Narcotic Drugs and Psychotropic Substances",
      treatySeriesCitation: "1582 UNTS 95",
      signatureDetails: "opened for signature 20 December 1988, entered into force 11 November 1990",
      date: "20 December 1988",
      pinpoint: "art 5",
    },
    want: "United Nations Convention against Illicit Traffic in Narcotic Drugs and Psychotropic Substances 1582 UNTS 95 (opened for signature 20 December 1988, entered into force 11 November 1990), art 5.",
  },
];

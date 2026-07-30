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
    },
    want: "South Australia v Johnson (1982) 26 SASR 41 (SC).",
  },
  {
    typeId: "england-wales-case-modern",
    fields: {
      caseName: "Universal Thermosensors Ltd v Hibben", year: "[1992]", volume: "1",
      reportSeries: "WLR", startingPage: "840", court: "Ch",
    },
    want: "Universal Thermosensors Ltd v Hibben [1992] 1 WLR 840 (Ch).",
  },
  {
    typeId: "england-wales-case-modern",
    fields: {
      caseName: "Foskett v McKeown", year: "[2001]", volume: "1",
      reportSeries: "AC", startingPage: "102", court: "HL",
    },
    want: "Foskett v McKeown [2001] 1 AC 102 (HL).",
  },
  {
    typeId: "canada-case",
    fields: { caseName: "Bruni v Bruni", neutralCitationNoBrackets: "2010 ONSC 6568" },
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

  // ═══════════════════════════════════════════════════════════════════════════
  // The rest of the Guide.
  //
  // Everything above was written when coverage was deliberately weighted to what
  // a New Zealand essay cites. That left 48 of the 86 types with no hand-written
  // truth at all, so the guarantee — right boxes in, right citation out — was
  // simply unmeasured for more than half the Guide. A student citing a United
  // States case or a UN resolution got whatever the template happened to do.
  //
  // These fill the gap. Each `fields` set is what the person in front of the form
  // would actually type, read off the type's own template; each `want` is the
  // Guide's worked example. Where the ingested template cannot express the
  // Guide's form, that is recorded as a knownGap rather than papered over by
  // contorting the fields to suit the code.
  // ═══════════════════════════════════════════════════════════════════════════

  // ────────────────────────────────────────────────── 3.7 historic and lost cases
  {
    typeId: "historic-judgment-newspaper",
    fields: {
      caseName: "R v Hipu",
      courtAbbrev: "SC",
      location: "Wellington",
      dateOfJudgment: "1 December 1845",
      newspaper: "The New Zealand Spectator and Cook’s Straits Guardian",
      newspaperPlace: "Wellington",
      newspaperDate: "6 December 1845",
      startingPage: "3",
      pinpoint: "3",
    },
    want:
      "R v Hipu SC Wellington, 1 December 1845 reported in The New Zealand Spectator and Cook’s Straits Guardian (Wellington, 6 December 1845) 3 at 3.",
  },
  {
    typeId: "lost-cases-project",
    fields: {
      caseName: "Butler v Flavell",
      courtAbbrev: "SC",
      location: "Auckland",
      date: "7 March 1849",
      url: "<www.victoria.ac.nz/law/nzlostcases/>",
    },
    want: "Butler v Flavell SC Auckland, 7 March 1849 available at <www.victoria.ac.nz/law/nzlostcases/>.",
  },

  // ─────────────────────────────────────────────── 4.2–4.3 Bills and instruments
  {
    typeId: "bill-select-committee-report-explanatory-note",
    fields: {
      billCitation: "Judicial Matters Bill 2008 (216-1)",
      locator: "explanatory note",
      pinpoint: "5",
    },
    want: "Judicial Matters Bill 2008 (216-1) (explanatory note) at 5.",
  },
  {
    typeId: "bill-select-committee-report-explanatory-note",
    fields: {
      billCitation: "Unit Titles Bill 2008 (212-2)",
      locator: "select committee report",
      pinpoint: "4",
    },
    want: "Unit Titles Bill 2008 (212-2) (select committee report) at 4.",
  },
  {
    typeId: "supplementary-order-paper",
    fields: {
      year: "2006",
      sopNumber: "79",
      billCitation: "Evidence Bill 2005 (256-1) (explanatory note)",
      pinpoint: "3",
    },
    want: "Supplementary Order Paper 2006 (79) Evidence Bill 2005 (256-1) (explanatory note) at 3.",
  },
  {
    typeId: "instrument-in-own-right-gazette",
    fields: {
      title: "Royal Commission on the Pike River Coal Mine Tragedy",
      date: "16 December 2010",
      issueNumber: "173",
      startingPage: "4261",
      pinpoint: "4262",
    },
    want:
      "“Royal Commission on the Pike River Coal Mine Tragedy” (16 December 2010) 173 New Zealand Gazette 4261 at 4262.",
  },
  {
    typeId: "letters-patent",
    fields: {
      title: "Letters Patent Constituting the Office of the Governor-General of New Zealand",
      year: "1983",
      clause: "12",
    },
    want: "Letters Patent Constituting the Office of the Governor-General of New Zealand 1983, cl 12.",
  },
  {
    typeId: "proclamation",
    fields: {
      title: "Proclamation Dissolving the Parliament of New Zealand",
      date: "12 August 2005",
      issueNumber: "124",
      startingPage: "3031",
    },
    want: "“Proclamation Dissolving the Parliament of New Zealand” (12 August 2005) 124 New Zealand Gazette 3031.",
  },

  // ──────────────────────────────────────────── 5 parliamentary and official
  {
    typeId: "select-committee-submission",
    fields: {
      author: "New Zealand Law Society",
      title: "Submission to the Justice and Electoral Committee on the Arbitration Amendment Bill 2017",
      pinpoint: "[3]",
    },
    want:
      "New Zealand Law Society “Submission to the Justice and Electoral Committee on the Arbitration Amendment Bill 2017” at [3].",
  },
  {
    typeId: "cabinet-document",
    fields: {
      documentIdentifier: "Cabinet Office Circular",
      title: "Conduct During Periods of Caretaker Government",
      date: "21 April 1999",
      referenceNumber: "CO 99/5",
      pinpoint: "[4]",
    },
    want:
      "Cabinet Office Circular “Conduct During Periods of Caretaker Government” (21 April 1999) CO 99/5 at [4].",
  },
  {
    // Rule 5.2.4, the form used before October 2017: issue number, then the
    // publication, then the starting page.
    typeId: "nz-gazette",
    fields: {
      title: "Commission of Inquiry into Police Conduct",
      date: "19 February 2004",
      issueNumber: "18",
      startingPage: "379",
      pinpoint: "381",
    },
    want: "“Commission of Inquiry into Police Conduct” (19 February 2004) 18 New Zealand Gazette 379 at 381.",
  },
  {
    // The same rule from October 2017: no issue number and no page, a notice
    // number instead.
    typeId: "nz-gazette",
    fields: {
      title: "Declaration of State of Local Emergency",
      date: "23 March 2018",
      noticeNumber: "No 2018-go941",
    },
    want: "“Declaration of State of Local Emergency” (23 March 2018) New Zealand Gazette No 2018-go941.",
  },
  {
    typeId: "oia-request",
    fields: {
      baseCitation:
        "Cabinet Strategy Committee Minute “Introducing Competition to Delivery of the ACC Scheme: Summary” (22 April 1998) STR (98) M 9/4 at [2]",
      body: "the Labour Market Policy Group, Department of Labour",
    },
    want:
      "Cabinet Strategy Committee Minute “Introducing Competition to Delivery of the ACC Scheme: Summary” (22 April 1998) STR (98) M 9/4 at [2] (obtained under Official Information Act 1982 request to the Labour Market Policy Group, Department of Labour).",
  },

  // ──────────────────────────────────────── 6.7–6.9 unpublished and secondary
  {
    typeId: "thesis-dissertation",
    fields: {
      author: "Marcus Roberts",
      title: "Reforming New Zealand’s Legislative Council: A Study of Constitutional Change, 1891 and 1912–1920",
      typeOfPaper: "LLB (Hons) Dissertation",
      university: "University of Auckland",
      year: "2008",
    },
    want:
      "Marcus Roberts “Reforming New Zealand’s Legislative Council: A Study of Constitutional Change, 1891 and 1912–1920” (LLB (Hons) Dissertation, University of Auckland, 2008).",
  },
  {
    typeId: "conference-paper-seminar",
    fields: {
      speaker: "Tracey Epps",
      title: "Merchants in the Temple? The Implications of the GATS for Canada’s Health Care System",
      conference: "National Health Law Conference",
      location: "Toronto",
      date: "January 2004",
    },
    want:
      "Tracey Epps “Merchants in the Temple? The Implications of the GATS for Canada’s Health Care System” (paper presented to National Health Law Conference, Toronto, January 2004).",
  },
  {
    // The second form under 6.7.2: a paper published inside a named collection.
    typeId: "conference-paper-seminar",
    fields: {
      speaker: "Sean Brennan and Geoff McLay",
      title: "Non-Delegable Duties and Vicarious Liability",
      collection: "Torts Update",
      conference: "New Zealand Law Society seminar",
      date: "2016",
      startingPage: "19",
      pinpoint: "23",
    },
    want:
      "Sean Brennan and Geoff McLay “Non-Delegable Duties and Vicarious Liability” in Torts Update (New Zealand Law Society seminar, 2016) 19 at 23.",
  },
  {
    typeId: "forthcoming-work",
    fields: {
      baseCitation: "Dennis Denuto Compulsory Acquisition: It’s the Vibe (The Castle Press, Bonnie Doon)",
    },
    want: "Dennis Denuto Compulsory Acquisition: It’s the Vibe (The Castle Press, Bonnie Doon) (forthcoming).",
  },
  {
    typeId: "work-cited-in-another",
    fields: {
      originalWork:
        "AV Dicey Introduction to the Study of the Law of the Constitution (10th ed, Macmillan, London, 1965) at 68, n 1",
      citingWork:
        "Philip A Joseph Constitutional and Administrative Law in New Zealand (4th ed, Thomson Reuters, Wellington, 2014) at [6.5.2], n 92",
    },
    want:
      "AV Dicey Introduction to the Study of the Law of the Constitution (10th ed, Macmillan, London, 1965) at 68, n 1 as cited in Philip A Joseph Constitutional and Administrative Law in New Zealand (4th ed, Thomson Reuters, Wellington, 2014) at [6.5.2], n 92.",
  },

  // ──────────────────────────────────────────────── 7 unpublished and personal
  {
    typeId: "social-media-tweet",
    fields: {
      author: "Donald J Trump",
      handle: "@realDonaldTrump",
      firstSentence: "We need a 21st century MERIT-BASED immigration system",
      url: "<https://twitter.com/realDonaldTrump/status/960907362109452288>",
    },
    want:
      "Donald J Trump (@realDonaldTrump) “We need a 21st century MERIT-BASED immigration system” <https://twitter.com/realDonaldTrump/status/960907362109452288>.",
  },
  {
    typeId: "interview",
    fields: {
      interviewee: "William Birch",
      position: "Finance Minister",
      interviewer: "Sean Plunket",
      interviewDetails: "Morning Report, National Radio",
      date: "5 July 1999",
      transcriptDetails: "transcript provided by Audio Monitor Services (Wellington)",
    },
    want:
      "Interview with William Birch, Finance Minister (Sean Plunket, Morning Report, National Radio, 5 July 1999) transcript provided by Audio Monitor Services (Wellington).",
  },
  {
    typeId: "speech",
    fields: {
      speaker: "Sian Elias, Chief Justice of New Zealand",
      title: "First Peoples and Human Rights, a South Seas Perspective",
      location: "Ramo Lecture 2008, New Mexico School of Law, Albuquerque",
      date: "23 October 2008",
    },
    want:
      "Sian Elias, Chief Justice of New Zealand “First Peoples and Human Rights, a South Seas Perspective” (Ramo Lecture 2008, New Mexico School of Law, Albuquerque, 23 October 2008).",
  },
  {
    typeId: "letter-email",
    fields: {
      author: "CI Patterson (Chairman of the Securities Commission)",
      recipient: "Geoffrey Palmer (Minister of Justice)",
      subject: "regarding the Corporations (Investigation and Management) Bill 1988",
      date: "8 February 1989",
    },
    want:
      "Letter from CI Patterson (Chairman of the Securities Commission) to Geoffrey Palmer (Minister of Justice) regarding the Corporations (Investigation and Management) Bill 1988 (8 February 1989).",
  },
  {
    typeId: "historical-edited-translated-text",
    fields: {
      author: "Thomas Hobbes",
      title: "Leviathan",
      editorOrTranslator: "JCA Gaskin (ed)",
      publisher: "Oxford University Press",
      place: "Oxford",
      year: "1998",
      pinpoint: "84",
    },
    want: "Thomas Hobbes Leviathan (JCA Gaskin (ed), Oxford University Press, Oxford, 1998) at 84.",
  },
  {
    typeId: "archived-material",
    fields: {
      documentTitle:
        "Compilation of Summary Convictions at the Police Office Auckland in the years 1844, 1843, 1842",
      archivingInstitution: "Archives New Zealand",
      locatingDetails: "IA1/41, 45/394",
    },
    want:
      "“Compilation of Summary Convictions at the Police Office Auckland in the years 1844, 1843, 1842” Archives New Zealand, IA1/41, 45/394.",
  },

  // ──────────────────────────────────────────────────── 8 foreign case law
  {
    typeId: "england-wales-nominate-report",
    fields: {
      caseName: "Saunders v Vautier",
      year: "1841",
      nominateCitation: "4 Beav 115",
      nominatePinpoint: "116",
      reprintCitation: "49 ER 282",
      court: "Ch",
      reprintPinpoint: "282",
    },
    want: "Saunders v Vautier (1841) 4 Beav 115 at 116, 49 ER 282 (Ch) at 282.",
  },
  {
    typeId: "england-wales-nominate-report",
    fields: {
      caseName: "Re Beloved Wilkes’s Charity",
      year: "1851",
      nominateCitation: "3 Mac & G 440",
      reprintCitation: "42 ER 330",
      court: "Ch",
    },
    want: "Re Beloved Wilkes’s Charity (1851) 3 Mac & G 440, 42 ER 330 (Ch).",
  },
  {
    typeId: "us-federal-case",
    fields: {
      caseName: "Dow Jones & Co v Board of Trade",
      volume: "546",
      reportSeries: "F Supp",
      startingPage: "114",
      courtAndYear: "SD NY 1982",
      pinpoint: "117",
    },
    want: "Dow Jones & Co v Board of Trade 546 F Supp 114 (SD NY 1982) at 117.",
  },
  {
    typeId: "us-federal-case",
    fields: {
      caseName: "United States v Palmer",
      volume: "16",
      reportSeries: "US",
      startingPage: "610",
      courtAndYear: "1818",
      pinpoint: "631",
    },
    want: "United States v Palmer 16 US 610 (1818) at 631.",
  },
  {
    typeId: "us-state-case",
    fields: {
      caseName: "Gregory v Carey",
      volume: "791",
      reportSeries: "P 2d",
      startingPage: "1329",
      stateCourtAndYear: "Kan 1990",
      pinpoint: "1336",
    },
    want: "Gregory v Carey 791 P 2d 1329 (Kan 1990) at 1336.",
  },
  {
    typeId: "us-state-case",
    fields: {
      caseName: "Elisabeth N v Riverside Group Inc",
      volume: "585",
      reportSeries: "So 2d",
      startingPage: "376",
      stateCourtAndYear: "Fla Dist Ct App 1991",
      pinpoint: "378–381",
    },
    want: "Elisabeth N v Riverside Group Inc 585 So 2d 376 (Fla Dist Ct App 1991) at 378–381.",
  },

  // ──────────────────────────────────────────────────── 9 foreign legislation
  {
    typeId: "australia-statute",
    fields: { shortTitle: "Chaffey Dam Act", year: "1974", jurisdiction: "NSW" },
    want: "Chaffey Dam Act 1974 (NSW).",
  },
  {
    // Rule 9.3.1 makes the volume and the jurisdiction two elements, joined with
    // no space between them: "RS" (Revised Statutes) + "C" (Canada) = "RSC",
    // "S" (sessional volume) + "C" = "SC". Read off chapter-pt.9.3.html.
    typeId: "canada-statute",
    fields: {
      shortTitle: "Arctic Waters Pollution Prevention Act",
      volume: "RS",
      jurisdiction: "C",
      year: "1985",
      chapter: "A-12",
      pinpoint: "s 15",
    },
    want: "Arctic Waters Pollution Prevention Act RSC 1985 c A-12, s 15.",
  },
  {
    typeId: "canada-statute",
    fields: {
      shortTitle: "Freezing Assets of Corrupt Foreign Officials Act",
      volume: "S",
      jurisdiction: "C",
      year: "2011",
      chapter: "10",
      pinpoint: "s 4",
    },
    want: "Freezing Assets of Corrupt Foreign Officials Act SC 2011 c 10, s 4.",
  },
  {
    typeId: "uk-pre-1963-statute",
    fields: {
      shortTitle: "Interpretation Act",
      year: "1889",
      jurisdiction: "UK",
      regnalYear: "52 & 53 Vict",
      chapter: "63",
      pinpoint: "s 1",
    },
    want: "Interpretation Act 1889 (UK) 52 & 53 Vict c 63, s 1.",
  },
  {
    typeId: "uk-modern-statute",
    fields: { shortTitle: "Pensions Act", year: "1995", jurisdiction: "UK" },
    want: "Pensions Act 1995 (UK).",
  },
  {
    // A devolved parliament names its jurisdiction inside the short title, so the
    // jurisdiction box stays empty (rule 9.4.3).
    typeId: "uk-modern-statute",
    fields: { shortTitle: "Judiciary and Courts (Scotland) Act", year: "2008" },
    want: "Judiciary and Courts (Scotland) Act 2008.",
  },
  {
    typeId: "us-code",
    fields: { title: "Freedom of Information Act", citation: "5 USC", section: "552" },
    want: "Freedom of Information Act 5 USC § 552.",
  },
  {
    typeId: "us-code",
    fields: { citation: "Wash Rev Code Ann", section: "4.24.240", supplement: "Supp 1987" },
    want: "Wash Rev Code Ann § 4.24.240 (Supp 1987).",
  },
  {
    typeId: "us-session-law",
    fields: {
      shortTitle: "National Environmental Policy Act of 1969",
      publicLawOrChapter: "Pub L No 91-90",
      section: "102",
      volume: "100",
      sessionLaws: "Stat",
      page: "852",
      pinpoint: "853",
      year: "1970",
    },
    want: "National Environmental Policy Act of 1969 Pub L No 91-90, § 102, 100 Stat 852 at 853 (1970).",
  },
  {
    // No section and no pinpoint: the "§" and the "at" must both go, and the
    // commas that attached them with.
    typeId: "us-session-law",
    fields: {
      shortTitle: "Federal Trademark Act",
      publicLawOrChapter: "Ch 79-540",
      volume: "60",
      sessionLaws: "Stat",
      page: "427",
      year: "1946",
    },
    want: "Federal Trademark Act Ch 79-540, 60 Stat 427 (1946).",
  },
  {
    typeId: "us-model-law",
    fields: {
      author: "American Law Institute",
      shortTitle: "Model Code of Evidence",
      publisher: "American Law Institute",
      place: "Philadelphia",
      year: "1942",
      pinpoint: "r 10",
    },
    want: "American Law Institute Model Code of Evidence (American Law Institute, Philadelphia, 1942) r 10.",
  },
  {
    typeId: "us-restatement",
    fields: {
      author: "American Law Institute",
      shortTitle: "Restatement of the Law of Conflict of Laws",
      edition: "2nd ed",
      place: "St Paul",
      stateOrRegion: "Minnesota",
      year: "1971",
      pinpoint: "220",
    },
    want:
      "American Law Institute Restatement of the Law of Conflict of Laws (2nd ed, St Paul, Minnesota, 1971) § 220.",
  },
  {
    typeId: "us-constitution",
    fields: { pinpoint: "amend XIV, § 2" },
    want: "United States Constitution, amend XIV, § 2.",
  },
  {
    typeId: "us-constitution",
    fields: { pinpoint: "art I, § 9, cl 2" },
    want: "United States Constitution, art I, § 9, cl 2.",
  },

  // ──────────────────────────────────────────────────── 10 international
  {
    typeId: "icj-pcij-decision",
    fields: {
      caseName: "Military and Paramilitary Activities in and against Nicaragua",
      parties: "Nicaragua v United States of America",
      phase: "Merits",
      // Square brackets: ICJ Rep is organised by year (rule 10.2.1).
      year: "[1986]",
      publication: "ICJ Rep",
      pageOrCaseNumber: "14",
      pinpoint: "55",
    },
    want:
      "Military and Paramilitary Activities in and against Nicaragua (Nicaragua v United States of America) (Merits) [1986] ICJ Rep 14 at 55.",
  },
  {
    typeId: "icj-pcij-decision",
    fields: {
      caseName: "Gabčikovo-Nagymaros Project",
      parties: "Hungary v Slovakia",
      year: "[1997]",
      publication: "ICJ Rep",
      pageOrCaseNumber: "7",
    },
    want: "Gabčikovo-Nagymaros Project (Hungary v Slovakia) [1997] ICJ Rep 7.",
  },
  {
    typeId: "icj-pcij-decision",
    fields: {
      caseName: "Competence of General Assembly Regarding Admission to the United Nations",
      phase: "Advisory Opinion",
      year: "[1950]",
      publication: "ICJ Rep",
      pageOrCaseNumber: "4",
    },
    want:
      "Competence of General Assembly Regarding Admission to the United Nations (Advisory Opinion) [1950] ICJ Rep 4.",
  },
  {
    typeId: "international-criminal-tribunal",
    fields: {
      parties: "Prosecutor v Aleksovski",
      phase: "Judgment",
      courtTribunal: "ICTY",
      chamber: "Appeals Chamber",
      caseNumber: "IT-95-14/1-A",
      date: "24 March 2000",
      pinpoint: "[63]",
    },
    want: "Prosecutor v Aleksovski (Judgment) ICTY Appeals Chamber IT-95-14/1-A, 24 March 2000 at [63].",
  },
  {
    typeId: "international-arbitral-reported",
    fields: {
      caseName: "Southern Bluefin Tuna",
      parties: "Australia v Japan",
      phase: "Jurisdiction and Admissibility",
      year: "2000",
      citation: "39 ILM 1539",
    },
    want: "Southern Bluefin Tuna (Australia v Japan) (Jurisdiction and Admissibility) (2000) 39 ILM 1539.",
  },
  {
    typeId: "international-arbitral-unreported",
    fields: {
      caseName: "Arrest and Return of Savarkar",
      parties: "France v Great Britain",
      phase: "Award",
      arbitralBody: "PCA",
      date: "24 February 1911",
    },
    want: "Arrest and Return of Savarkar (France v Great Britain) (Award) PCA 24 February 1911.",
  },
  {
    typeId: "international-arbitral-unreported",
    fields: {
      caseName: "Abaclat",
      parties: "Abaclat v Argentina",
      phase: "Jurisdiction and Admissibility",
      arbitralBody: "ICSID",
      caseNumber: "ARB/07/5",
      date: "4 August 2011",
      pinpoint: "[293]",
    },
    want: "Abaclat v Argentina (Jurisdiction and Admissibility) ICSID ARB/07/5, 4 August 2011 at [293].",
    knownGap:
      "The Guide gives no separate case name here — the parties ARE the name — but the template writes both, so the name is repeated.",
  },
  {
    typeId: "un-constitutive-document",
    fields: { fullName: "Charter of the United Nations", article: "27" },
    want: "Charter of the United Nations, art 27.",
  },
  {
    typeId: "un-resolution",
    fields: {
      title: "Universal Declaration of Human Rights",
      resolutionNumber: "GA Res 217A",
      year: "1948",
      pinpoint: "art 2",
    },
    want: "Universal Declaration of Human Rights GA Res 217A (1948), art 2.",
  },
  {
    // A resolution cited by number alone, with no title.
    typeId: "un-resolution",
    fields: { resolutionNumber: "SC Res 2397", year: "2017", pinpoint: "preamble" },
    want: "SC Res 2397 (2017), preamble.",
  },
  {
    typeId: "un-other-material",
    fields: {
      title: "Report of the Economic and Social Council for 2005",
      documentNumber: "A/60/3",
      date: "15 August 2005",
      pinpoint: "5",
    },
    want: "Report of the Economic and Social Council for 2005 UN Doc A/60/3 (15 August 2005) at 5.",
  },
  {
    typeId: "un-other-material",
    fields: {
      author: "Fatma Zohra Ksentini",
      title: "Report of the Special Rapporteur on Human Rights and the Environment",
      documentNumber: "E/CN.4/Sub.2/1994/9",
      date: "6 July 1994",
    },
    want:
      "Fatma Zohra Ksentini Report of the Special Rapporteur on Human Rights and the Environment UN Doc E/CN.4/Sub.2/1994/9 (6 July 1994).",
  },
  {
    typeId: "international-law-commission-yilc",
    fields: {
      documentTitle:
        "2269th Meeting – International liability for injurious consequences arising out of acts prohibited by international law",
      year: "1992",
      volume: "1",
      page: "97",
      pinpoint: "[42]",
    },
    want:
      "2269th Meeting – International liability for injurious consequences arising out of acts prohibited by international law [1992] vol 1 YILC 97 at [42].",
  },
  {
    typeId: "international-law-commission-yilc",
    fields: {
      documentTitle:
        "Diplomatic Protection – First report on diplomatic protection, by Mr John R Dugard, Special Rapporteur",
      year: "2000",
      volume: "2",
      part: "1",
      page: "205",
      pinpoint: "[31]",
    },
    want:
      "Diplomatic Protection – First report on diplomatic protection, by Mr John R Dugard, Special Rapporteur [2000] vol 2, pt 1 YILC 205 at [31].",
  },
  {
    typeId: "eu-case-pre-2012",
    fields: {
      caseNumber: "C-34/89",
      caseName: "Smith v EC Commission",
      year: "1993",
      reportSeries: "ECR",
      volumePage: "I-454",
    },
    want: "Case C-34/89 Smith v EC Commission [1993] ECR I-454.",
  },
  {
    typeId: "eu-case-pre-2012",
    fields: {
      caseNumber: "19/84",
      caseName: "Pharmon BV v Hoechst AG",
      year: "1985",
      reportSeries: "ECR",
      volumePage: "2281",
      courtIdentifier: "ECJ",
    },
    want: "Case 19/84 Pharmon BV v Hoechst AG [1985] ECR 2281 (ECJ).",
  },
  {
    typeId: "eu-case-post-2012",
    fields: {
      caseNumber: "C-363/16",
      caseName: "European Commission v Hellenic Republic",
      ecliNumber: "ECLI:EU:C:2018:12",
      pinpoint: "[34]–[35]",
    },
    want: "Case C-363/16 European Commission v Hellenic Republic ECLI:EU:C:2018:12 at [34]–[35].",
  },
  {
    typeId: "eu-legislation",
    fields: {
      legislationType: "Regulation",
      numberAndTitle: "1605/2002 on the Financial Regulations",
      year: "2002",
      seriesNumberPage: "L248/1",
    },
    want: "Regulation 1605/2002 on the Financial Regulations [2002] OJ L248/1.",
  },
  {
    typeId: "echr-case",
    fields: {
      caseName: "Mauer v Austria",
      year: "(1997)",
      volume: "25",
      reportSeries: "EHRR",
      page: "91",
      courtIdentifier: "ECHR",
      pinpoint: "92",
    },
    want: "Mauer v Austria (1997) 25 EHRR 91 (ECHR) at 92.",
  },
  {
    // A year-organised series takes square brackets; the year box carries the
    // brackets the Guide prints, because this template does not supply them.
    typeId: "echr-case",
    fields: {
      caseName: "Svinarenko v Russia",
      year: "[2014]",
      volume: "5",
      reportSeries: "ECHR",
      page: "181",
      courtIdentifier: "Grand Chamber",
    },
    want: "Svinarenko v Russia [2014] 5 ECHR 181 (Grand Chamber).",
  },
  {
    typeId: "european-commission-hr-case",
    fields: {
      caseName: "Morissens v Belgium",
      year: "1988",
      volume: "56",
      reportSeries: "DR",
      page: "127",
    },
    want: "Morissens v Belgium (1988) 56 DR 127.",
  },
  {
    typeId: "european-commission-hr-case",
    fields: {
      caseName: "Denmark, Norway, Sweden and the Netherlands v Greece",
      year: "1969",
      volume: "12",
      reportSeries: "Yearbook",
      page: "186",
      courtIdentifier: "EComHR",
      pinpoint: "[186]",
    },
    want: "Denmark, Norway, Sweden and the Netherlands v Greece (1969) 12 Yearbook 186 (EComHR) at [186].",
  },
  {
    typeId: "wto-document",
    fields: {
      title:
        "United States – Safeguard Measures on Imports of Fresh, Chilled or Frozen Lamb Meat from New Zealand and Australia",
      documentNumber: "WT/DS177/AB/R",
      date: "1 May 2001",
      description: "Report of the Appellate body",
      pinpoint: "[21]",
    },
    want:
      "United States – Safeguard Measures on Imports of Fresh, Chilled or Frozen Lamb Meat from New Zealand and Australia WT/DS177/AB/R, 1 May 2001 (Report of the Appellate body) at [21].",
  },
  {
    typeId: "gatt-document",
    fields: {
      title:
        "United States – Denial of Most-Favoured-Nation Treatment as to Non-Rubber Footwear from Brazil",
      supplement: "39th Supp",
      page: "128",
      gattDocumentNumber: "DS18/R",
      date: "10 June 1992",
      description: "Report by the Panel Adopted on 19 June 1992",
      pinpoint: "[4.20]",
    },
    want:
      "United States – Denial of Most-Favoured-Nation Treatment as to Non-Rubber Footwear from Brazil 39th Supp GATT BISD 128, DS18/R, 10 June 1992 (Report by the Panel Adopted on 19 June 1992) at [4.20].",
  },
  {
    // The shorter form, with no BISD supplement reference.
    typeId: "gatt-document",
    fields: {
      title: "Generalized System of Preferences",
      gattDocumentNumber: "L/7073",
      date: "4 September 1992",
      description: "Notification by New Zealand",
      pinpoint: "3",
    },
    want: "Generalized System of Preferences L/7073, 4 September 1992 (Notification by New Zealand) at 3.",
  },
];

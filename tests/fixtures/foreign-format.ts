/**
 * The same source, written the way something OTHER than the Style Guide writes
 * it — which is what a student actually has on their screen.
 *
 * A reference arrives from Zotero or EndNote in APA, from a US casebook in
 * Bluebook, from a library record in Chicago, or as a line scraped off a
 * judgment database with hyphens between its parts. None of those is the
 * Guide's shape, and the paste layer was built entirely against the Guide's
 * shape.
 *
 * ------------------------------------------------------------------------
 * WHY THE EXPECTED FIELDS ARE NOT ALWAYS THE GUIDE'S OWN STRING
 * ------------------------------------------------------------------------
 * Every `paste` here is a real source that the Guide itself cites, so the
 * Guide's published citation is the ground truth for the SHAPE. But a foreign
 * format can lose information the Guide requires, and the tool must not invent
 * it back:
 *
 *   APA initialises given names. "Carter, R." cannot become "Ross Carter"
 *   without guessing at a person's name, so the honest answer is "R Carter"
 *   and a note that the given name needs completing. Filling it in from a
 *   guess is the one failure this project refuses — a confident wrong answer.
 *
 *   APA spells a journal's name out. The Guide abbreviates it from a table in
 *   its appendix that this repo does not hold, so "Law Quarterly Review"
 *   cannot become "LQR" here.
 *
 * So `fields` records what the paste HONESTLY carries, in the Guide's form,
 * and `lossy` records what it cannot. A case whose `lossy` is empty must
 * reproduce the Guide's citation exactly.
 */

export type ForeignCase = {
  /** Which citation style the paste is written in. */
  style: string;
  /** The type the tool must rank FIRST. */
  typeId: string;
  /** What the student pastes. */
  paste: string;
  /** Every field the paste honestly carries, written the Guide's way. */
  fields: Record<string, string>;
  /**
   * The citation derivable from the paste alone — or absent where the format
   * omits something the Guide REQUIRES, in which case the tool must fail closed
   * and `mustAsk` names what the reader has to supply. APA 7 dropped the place
   * of publication that rule 6.1.6 demands, so most modern APA lands here: a
   * box left empty and a question asked is the right outcome, and inventing a
   * plausible city is the wrong one.
   */
  want?: string;
  /** Required components the paste cannot fill, which the tool must ask for. */
  mustAsk?: string[];
  /** What this format cannot carry, and the reader must therefore supply. */
  lossy?: string[];
  /** The Guide's own published citation of this source, for reference. */
  guide: string;
};

export const FOREIGN_FORMAT: ForeignCase[] = [
  // ---------------------------------------------------------------- APA books
  {
    style: "APA 7",
    typeId: "text-book",
    paste:
      "Carter, R. (2015). Burrows and Carter statute law in New Zealand (5th ed.). Wellington, New Zealand: LexisNexis.",
    fields: {
      author: "R Carter",
      title: "Burrows and Carter Statute Law in New Zealand",
      edition: "5th ed",
      publisher: "LexisNexis",
      placeOfPublication: "Wellington",
      year: "2015",
    },
    want: "R Carter Burrows and Carter Statute Law in New Zealand (5th ed, LexisNexis, Wellington, 2015).",
    lossy: ["author's given name — APA initialises it"],
    guide:
      "Ross Carter Burrows and Carter Statute Law in New Zealand (5th ed, LexisNexis, Wellington, 2015) at 311.",
  },
  {
    // Two authors: APA joins them with ", &" and the Guide joins them with
    // "and" (rule 6.1.2).
    style: "APA 7",
    typeId: "text-book",
    paste:
      "Butler, A., & Butler, P. (2015). The New Zealand Bill of Rights Act: A commentary (2nd ed.). Wellington, New Zealand: LexisNexis.",
    fields: {
      author: "A Butler and P Butler",
      title: "The New Zealand Bill of Rights Act: A Commentary",
      edition: "2nd ed",
      publisher: "LexisNexis",
      placeOfPublication: "Wellington",
      year: "2015",
    },
    want: "A Butler and P Butler The New Zealand Bill of Rights Act: A Commentary (2nd ed, LexisNexis, Wellington, 2015).",
    lossy: ["both authors' given names — APA initialises them"],
    guide:
      "Andrew Butler and Petra Butler The New Zealand Bill of Rights Act: A Commentary (2nd ed, LexisNexis, Wellington, 2015).",
  },
  {
    // More than three authors: rule 6.1.2 names the first and writes "and
    // others". APA lists them all, so the tool must CUT rather than keep.
    style: "APA 7",
    typeId: "text-book",
    paste:
      "Mahoney, R., McDonald, E., Optican, S., & Tinsley, Y. (2014). The Evidence Act 2006: Act & analysis (3rd ed.). Wellington, New Zealand: Brookers.",
    fields: {
      author: "R Mahoney and others",
      title: "The Evidence Act 2006: Act & Analysis",
      edition: "3rd ed",
      publisher: "Brookers",
      placeOfPublication: "Wellington",
      year: "2014",
    },
    want: "R Mahoney and others The Evidence Act 2006: Act & Analysis (3rd ed, Brookers, Wellington, 2014).",
    lossy: ["the first author's given name — APA initialises it"],
    guide:
      "Richard Mahoney and others The Evidence Act 2006: Act & Analysis (3rd ed, Brookers, Wellington, 2014).",
  },
  {
    // No edition, and a publisher whose name is also a place.
    style: "APA 7",
    typeId: "text-book",
    paste:
      "Burrows, A. (2011). The law of restitution (3rd ed.). Oxford, England: Oxford University Press.",
    fields: {
      author: "A Burrows",
      title: "The Law of Restitution",
      edition: "3rd ed",
      publisher: "Oxford University Press",
      placeOfPublication: "Oxford",
      year: "2011",
    },
    want: "A Burrows The Law of Restitution (3rd ed, Oxford University Press, Oxford, 2011).",
    lossy: ["author's given name — APA initialises it"],
    guide:
      "Andrew Burrows The Law of Restitution (3rd ed, Oxford University Press, Oxford, 2011) at 189, n 92.",
  },

  // ------------------------------------------------------- APA journal article
  {
    // The Guide spells this journal's name out too, so nothing is lost but the
    // given names — the closest an APA paste gets to the Guide exactly.
    style: "APA 7",
    typeId: "journal-article",
    paste:
      "Mathews, B., & Walsh, K. (2004). At the cutting edge: Issues in mandatory reporting of child sexual abuse by Australian teachers. Australia & New Zealand Journal of Law & Education, 9(2), 3-18.",
    fields: {
      author: "B Mathews and K Walsh",
      title:
        "At the Cutting Edge: Issues in Mandatory Reporting of Child Sexual Abuse by Australian Teachers",
      year: "(2004)",
      volume: "9(2)",
      journalAbbrev: "Australia & New Zealand Journal of Law & Education",
      startingPage: "3",
    },
    want: "B Mathews and K Walsh “At the Cutting Edge: Issues in Mandatory Reporting of Child Sexual Abuse by Australian Teachers” (2004) 9(2) Australia & New Zealand Journal of Law & Education 3.",
    lossy: ["both authors' given names — APA initialises them"],
    guide:
      "Ben Mathews and Kerryann Walsh “At the Cutting Edge: Issues in Mandatory Reporting of Child Sexual Abuse by Australian Teachers” (2004) 9(2) Australia & New Zealand Journal of Law & Education 3.",
  },
  {
    // The journal's name must be ABBREVIATED by the Guide's appendix, which
    // this repo does not hold — so the spelled-out name is the honest answer.
    style: "APA 7",
    typeId: "journal-article",
    paste:
      "Watts, P. (2005). Birks' unjust enrichment. Law Quarterly Review, 121, 163-175.",
    fields: {
      author: "P Watts",
      title: "Birks’ Unjust Enrichment",
      year: "(2005)",
      volume: "121",
      journalAbbrev: "Law Quarterly Review",
      startingPage: "163",
    },
    want: "P Watts “Birks’ Unjust Enrichment” (2005) 121 Law Quarterly Review 163.",
    lossy: [
      "author's given name — APA initialises it",
      "the journal abbreviation 'LQR' — APA spells the name out",
    ],
    guide: "Peter Watts “Birks’ Unjust Enrichment” (2005) 121 LQR 163 at 165.",
  },

  // ------------------------------------------------------------ APA thesis
  {
    style: "APA 7",
    typeId: "thesis-dissertation",
    paste:
      // The en dash is left as the record holds it: a dash inside a TITLE is
      // the author's punctuation, not the citation's, so this case is about
      // APA's structure and not about rule 3.2.8.
      "Roberts, M. (2008). Reforming New Zealand's Legislative Council: A study of constitutional change, 1891 and 1912–1920 [LLB (Hons) dissertation]. University of Auckland.",
    fields: {
      author: "M Roberts",
      title:
        "Reforming New Zealand’s Legislative Council: A Study of Constitutional Change, 1891 and 1912–1920",
      typeOfPaper: "LLB (Hons) Dissertation",
      university: "University of Auckland",
      year: "2008",
    },
    want: "M Roberts “Reforming New Zealand’s Legislative Council: A Study of Constitutional Change, 1891 and 1912–1920” (LLB (Hons) Dissertation, University of Auckland, 2008).",
    lossy: ["author's given name — APA initialises it"],
    guide:
      "Marcus Roberts “Reforming New Zealand’s Legislative Council: A Study of Constitutional Change, 1891 and 1912–1920” (LLB (Hons) Dissertation, University of Auckland, 2008).",
  },

  // ------------------------------------------------------ Bluebook — US cases
  {
    // Bluebook puts a full stop in every abbreviation; the Guide uses none
    // (rule 1.4). Nothing else differs, so this must come out EXACTLY.
    style: "Bluebook",
    typeId: "us-federal-case",
    paste: "United States v. Palmer, 16 U.S. 610 (1818).",
    fields: {
      caseName: "United States v Palmer",
      volume: "16",
      reportSeries: "US",
      startingPage: "610",
      courtAndYear: "1818",
    },
    want: "United States v Palmer 16 US 610 (1818).",
    guide: "United States v Palmer 16 US 610 (1818) at 631.",
  },
  {
    style: "Bluebook",
    typeId: "us-federal-case",
    paste:
      "Rockford Map Publishing, Inc. v. Directory Service Co., 768 F.2d 145 (7th Cir. 1986).",
    fields: {
      caseName: "Rockford Map Publishing Inc v Directory Service Co",
      volume: "768",
      reportSeries: "F 2d",
      startingPage: "145",
      courtAndYear: "7th Cir 1986",
    },
    want: "Rockford Map Publishing Inc v Directory Service Co 768 F 2d 145 (7th Cir 1986).",
    guide:
      "Rockford Map Publishing Inc v Directory Service Co 768 F 2d 145 (7th Cir 1986) at 151.",
  },

  // ------------------------------------------------- OSCOLA — already Guide-ish
  {
    // OSCOLA and the Guide agree on a reported English case, so this is the
    // control: it passed before any of this existed and must keep passing.
    style: "OSCOLA",
    typeId: "england-wales-case-modern",
    paste: "Donoghue v Stevenson [1932] AC 562 (HL).",
    fields: {
      caseName: "Donoghue v Stevenson",
      reportSeries: "AC",
      startingPage: "562",
    },
    want: "Donoghue v Stevenson [1932] AC 562 (HL).",
    guide: "Donoghue v Stevenson [1932] AC 562 (HL).",
  },

  // ------------------------------------------- a line scraped off a database
  {
    // A judgment database lists a case with hyphens between its parts. The
    // hyphens are furniture, not punctuation of the citation.
    style: "database listing",
    typeId: "reported-case-nz",
    paste:
      "Taylor v New Zealand Poultry Board - [1984] 1 NZLR 394 - Court of Appeal of New Zealand",
    fields: {
      caseName: "Taylor v New Zealand Poultry Board",
      year: "[1984]",
      volume: "1",
      reportSeries: "NZLR",
      startingPage: "394",
      courtIdentifier: "CA",
    },
    want: "Taylor v New Zealand Poultry Board [1984] 1 NZLR 394 (CA).",
    guide: "Taylor v New Zealand Poultry Board [1984] 1 NZLR 394 (CA) at 398.",
  },

  // ------------------------------------------ APA 7 — what Zotero actually emits
  {
    // APA 7 dropped the place of publication, and rule 6.1.6 requires it. The
    // tool must fill everything else and ASK for the place, not invent one.
    style: "APA 7 (no place)",
    typeId: "text-book",
    paste:
      "Carter, R. (2015). Burrows and Carter statute law in New Zealand (5th ed.). LexisNexis.",
    fields: {
      author: "R Carter",
      title: "Burrows and Carter Statute Law in New Zealand",
      edition: "5th ed",
      publisher: "LexisNexis",
      year: "2015",
    },
    mustAsk: ["placeOfPublication"],
    lossy: [
      "author's given name — APA initialises it",
      "the place of publication — APA 7 omits it",
    ],
    guide:
      "Ross Carter Burrows and Carter Statute Law in New Zealand (5th ed, LexisNexis, Wellington, 2015) at 311.",
  },
  {
    // A DOI is how APA 7 ends a journal reference. Rule 6.4 cites an article by
    // its volume and page and gives it no URL, so the DOI is dropped.
    style: "APA 7 (DOI)",
    typeId: "journal-article",
    paste:
      "Mathews, B., & Walsh, K. (2004). At the cutting edge: Issues in mandatory reporting of child sexual abuse by Australian teachers. Australia & New Zealand Journal of Law & Education, 9(2), 3-18. https://doi.org/10.1017/S0008197300000000",
    fields: {
      author: "B Mathews and K Walsh",
      title:
        "At the Cutting Edge: Issues in Mandatory Reporting of Child Sexual Abuse by Australian Teachers",
      year: "(2004)",
      volume: "9(2)",
      journalAbbrev: "Australia & New Zealand Journal of Law & Education",
      startingPage: "3",
    },
    want: "B Mathews and K Walsh “At the Cutting Edge: Issues in Mandatory Reporting of Child Sexual Abuse by Australian Teachers” (2004) 9(2) Australia & New Zealand Journal of Law & Education 3.",
    lossy: ["both authors' given names — APA initialises them"],
    guide:
      "Ben Mathews and Kerryann Walsh “At the Cutting Edge: Issues in Mandatory Reporting of Child Sexual Abuse by Australian Teachers” (2004) 9(2) Australia & New Zealand Journal of Law & Education 3.",
  },
  {
    // A reference copied out of a footnote brings its number with it.
    style: "APA 7 (footnote number)",
    typeId: "text-book",
    paste:
      "12. Butler, A., & Butler, P. (2015). The New Zealand Bill of Rights Act: A commentary (2nd ed.). Wellington, New Zealand: LexisNexis.",
    fields: {
      author: "A Butler and P Butler",
      title: "The New Zealand Bill of Rights Act: A Commentary",
      edition: "2nd ed",
      publisher: "LexisNexis",
      placeOfPublication: "Wellington",
      year: "2015",
    },
    want: "A Butler and P Butler The New Zealand Bill of Rights Act: A Commentary (2nd ed, LexisNexis, Wellington, 2015).",
    lossy: ["both authors' given names — APA initialises them"],
    guide:
      "Andrew Butler and Petra Butler The New Zealand Bill of Rights Act: A Commentary (2nd ed, LexisNexis, Wellington, 2015).",
  },
  {
    // Rule 6.2: an essay in an edited book. APA writes the editor forename-first
    // after "In", and gives the chapter's page span as "pp. 335-360".
    style: "APA 7 (chapter)",
    typeId: "essay-in-edited-book",
    paste:
      "Palmer, J. (2009). Constructive trusts. In A. Butler (Ed.), Equity and trusts in New Zealand (2nd ed., pp. 335-360). Thomson Reuters.",
    fields: {
      author: "J Palmer",
      essayTitle: "Constructive Trusts",
      editor: "A Butler",
      bookTitle: "Equity and Trusts in New Zealand",
      edition: "2nd ed",
      publisher: "Thomson Reuters",
      year: "2009",
      startingPage: "335",
    },
    // Rule 6.2 does not mark the place REQUIRED the way rule 6.1 does, so this
    // builds without it rather than refusing — and the reader is told the place
    // is missing instead. Whether 6.2 inherits 6.1.6's "always" is a question
    // about the Guide, not about this code, so it is recorded in the open list
    // rather than settled here by making the box required.
    want: "J Palmer “Constructive Trusts” in A Butler (ed) Equity and Trusts in New Zealand (2nd ed, Thomson Reuters, 2009) 335.",
    lossy: [
      "author's given name — APA initialises it",
      "the place of publication — APA 7 omits it",
    ],
    guide:
      "Jessica Palmer “Constructive Trusts” in Andrew Butler (ed) Equity and Trusts in New Zealand (2nd ed, Thomson Reuters, Wellington, 2009) 335 at 339.",
  },

  // ---------------------------------------------------------------- Harvard
  {
    // Harvard keeps the place, so unlike APA 7 this one completes — but it
    // still initialises the given name, and writes "edn" where the Guide has
    // "ed".
    style: "Harvard",
    typeId: "text-book",
    paste:
      "Burrows, A. (2011) The Law of Restitution. 3rd edn. Oxford: Oxford University Press.",
    fields: {
      author: "A Burrows",
      title: "The Law of Restitution",
      edition: "3rd ed",
      publisher: "Oxford University Press",
      placeOfPublication: "Oxford",
      year: "2011",
    },
    want: "A Burrows The Law of Restitution (3rd ed, Oxford University Press, Oxford, 2011).",
    lossy: ["author's given name — Harvard initialises it"],
    guide:
      "Andrew Burrows The Law of Restitution (3rd ed, Oxford University Press, Oxford, 2011) at 189, n 92.",
  },

  // -------------------------------------------------------------------- MLA
  {
    // MLA keeps the given name in full and drops the place.
    style: "MLA 9",
    typeId: "text-book",
    paste:
      "Burrows, Andrew. The Law of Restitution. 3rd ed., Oxford University Press, 2011.",
    fields: {
      author: "Andrew Burrows",
      title: "The Law of Restitution",
      edition: "3rd ed",
      publisher: "Oxford University Press",
      year: "2011",
    },
    mustAsk: ["placeOfPublication"],
    lossy: ["the place of publication — MLA omits it"],
    guide:
      "Andrew Burrows The Law of Restitution (3rd ed, Oxford University Press, Oxford, 2011) at 189, n 92.",
  },

  // ------------------------------------------------------------ Chicago book
  {
    style: "Chicago (notes-bibliography)",
    typeId: "text-book",
    paste:
      "Burrows, Andrew. The Law of Restitution. 3rd ed. Oxford: Oxford University Press, 2011.",
    fields: {
      author: "Andrew Burrows",
      title: "The Law of Restitution",
      edition: "3rd ed",
      publisher: "Oxford University Press",
      placeOfPublication: "Oxford",
      year: "2011",
    },
    // Chicago keeps the given name, so this one CAN reach the Guide exactly.
    want: "Andrew Burrows The Law of Restitution (3rd ed, Oxford University Press, Oxford, 2011).",
    guide:
      "Andrew Burrows The Law of Restitution (3rd ed, Oxford University Press, Oxford, 2011) at 189, n 92.",
  },
];

/**
 * PART of a reference — what a student types when they half-remember a source.
 *
 * Not a citation with its tail cut off (that is `partial-report`), but the
 * fragments people actually type into a box: a case name with no citation, an
 * author's name, a page number, an Act with no year.
 *
 * ------------------------------------------------------------------------
 * WHY THIS IS A SAFETY MEASURE, NOT A CONVENIENCE ONE
 * ------------------------------------------------------------------------
 * A handful of the Guide's types require exactly one free-text box —
 * rule 2.3's `{identifier}, {pinpoint}`, Laws of New Zealand, the Cabinet
 * Manual. Their templates are close to the identity function: they reproduce
 * ANY input by cutting it at spaces, so every one of these fragments "built
 * successfully" as one of them.
 *
 *   "Andrew Burrows"                    → "Andrew Burrows."
 *   "394"                               → "394."
 *   "Taylor v New Zealand Poultry Board" → "Taylor v New Zealand Poultry Board."
 *
 * Each is a finished citation under a rule that has nothing to do with the
 * source, and each looks exactly like a correct one. That is the single outcome
 * this project treats as unacceptable, and a fragment is the commonest way to
 * reach it.
 *
 * So each case below records what the tool OWES the reader:
 *   `want`    the citation, where the fragment really is a complete one;
 *   absent    it must refuse, and `mustAsk` names what it has to ask for.
 */

export type FragmentCase = {
  /** What the student types. */
  fragment: string;
  /** Plain description, for the report. */
  what: string;
  /** The type the tool should offer — in the visible top six at worst. */
  typeId: string;
  /** What the fragment honestly carries, in the Guide's form. */
  fields: Record<string, string>;
  /** The citation, where the fragment is genuinely a complete one. */
  want?: string;
  /** Required components the fragment cannot fill, which must be asked for. */
  mustAsk?: string[];
};

export const FRAGMENTS: FragmentCase[] = [
  // ------------------------------------------------- genuinely complete already
  {
    fragment: "Evidence Act 2006",
    what: "an Act with no pinpoint — rule 4.1.1 needs nothing else",
    typeId: "nz-statute",
    fields: { shortTitle: "Evidence Act", year: "2006" },
    want: "Evidence Act 2006.",
  },
  {
    fragment: "Evidence Act 2006, s 8",
    what: "an Act with a section",
    typeId: "nz-statute",
    fields: { shortTitle: "Evidence Act", year: "2006", pinpoint: "s 8" },
    want: "Evidence Act 2006, s 8.",
  },
  {
    // Rule 2.3's own worked example. The capital opens the form.
    fragment: "at 398",
    what: "a bare pinpoint — rule 2.3's short form",
    typeId: "subsequent-references",
    fields: { pinpoint: "398" },
    want: "At 398.",
  },
  {
    fragment: "Z v Dental Complaints Assessment Committee [2008] NZSC 55",
    what: "a case name and its neutral citation",
    typeId: "neutral-citation-case-nz",
    fields: {
      caseName: "Z v Dental Complaints Assessment Committee",
      year: "2008",
      courtIdentifier: "NZSC",
      judgmentNumber: "55",
    },
    want: "Z v Dental Complaints Assessment Committee [2008] NZSC 55.",
  },

  // ------------------------------------------------ fragments that MUST refuse
  {
    fragment: "Taylor v New Zealand Poultry Board",
    what: "a case name with no citation at all",
    typeId: "reported-case-nz",
    fields: { caseName: "Taylor v New Zealand Poultry Board" },
    mustAsk: ["reportCitation"],
  },
  {
    fragment: "Andrew Burrows",
    what: "an author's name and nothing else",
    typeId: "text-book",
    fields: {},
    mustAsk: ["title"],
  },
  {
    fragment: "394",
    what: "a page number on its own",
    typeId: "reported-case-nz",
    fields: {},
    mustAsk: ["caseName", "reportCitation"],
  },
  {
    fragment: "Evidence Act",
    what: "an Act with no year — rule 4.1.1 requires one",
    typeId: "nz-statute",
    fields: { shortTitle: "Evidence Act" },
    mustAsk: ["year"],
  },
  {
    fragment: "Burrows The Law of Restitution",
    what: "an author and a book title, no publication details",
    typeId: "text-book",
    fields: { author: "Burrows", title: "The Law of Restitution" },
    mustAsk: ["publisher", "placeOfPublication", "year"],
  },
  {
    fragment: "[1984] 1 NZLR 394",
    what: "a report locus with no case name",
    typeId: "reported-case-nz",
    fields: { year: "[1984]", volume: "1", reportSeries: "NZLR", startingPage: "394" },
    mustAsk: ["caseName"],
  },
  {
    fragment: "Taylor v New Zealand Poultry Board [1984] 1 NZLR 394",
    what: "a case and its report, with no court identifier",
    typeId: "reported-case-nz",
    fields: {
      caseName: "Taylor v New Zealand Poultry Board",
      year: "[1984]",
      volume: "1",
      reportSeries: "NZLR",
      startingPage: "394",
    },
    // Rule 3.2 needs the court only where the series does not imply it, and
    // NZLR does not — so this one is genuinely complete.
    want: "Taylor v New Zealand Poultry Board [1984] 1 NZLR 394.",
  },
];

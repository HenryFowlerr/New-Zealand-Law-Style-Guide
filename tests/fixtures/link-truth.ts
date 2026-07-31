/**
 * Ground truth for the link layer: a real URL a New Zealand law student would
 * paste, the page title that URL actually serves, and the citation the Style
 * Guide requires for it.
 *
 * The URLs and titles were read off the live sites, so this fixture records what
 * those sites really return rather than what would be convenient. It runs
 * offline: the title is supplied here, so no test depends on a network call or on
 * a site staying up.
 *
 * An absent `pageTitle` marks the case that matters most for fail-closed behaviour —
 * a page that blocks reading, or a PDF with no useful title. The tool must still
 * produce a citation of the RIGHT KIND with the parts the URL establishes, and
 * name what it could not determine, rather than fall back to citing the thing as
 * a web page.
 */
export type LinkTruth = {
  /** What the student pastes. */
  url: string;
  /** The page's <title>, verbatim, or undefined where it cannot be read. */
  pageTitle?: string;
  /** The type the Guide requires — never "internet material" for a legal source. */
  typeId: string;
  /** The finished citation, where the URL and title together determine one. */
  want?: string;
  /** Components the reader must still supply, where the source cannot give them. */
  stillNeeded?: string[];
  /**
   * Set where the site is recognised in order to DECLINE: a subscription database
   * whose URL is a session id behind a login. Producing anything would put a
   * database address into a citation, which no rule of the Guide permits.
   */
  declined?: true;
  note?: string;
};

export const LINK_TRUTH: LinkTruth[] = [
  // ─────────────────────────────────────────── legislation.govt.nz — rule 4.1.1
  {
    url: "https://www.legislation.govt.nz/act/public/2006/0069/latest/DLM393463.html",
    pageTitle: "Evidence Act 2006 | New Zealand Legislation",
    typeId: "nz-statute",
    want: "Evidence Act 2006.",
  },
  {
    url: "https://www.legislation.govt.nz/act/public/1990/0109/latest/DLM224791.html",
    pageTitle: "New Zealand Bill of Rights Act 1990 | New Zealand Legislation",
    typeId: "nz-statute",
    want: "New Zealand Bill of Rights Act 1990.",
  },
  {
    // The Act named INSIDE the title is 2006; the instrument itself is 2008. The
    // year has to be the one that closes the title, not the first one in it.
    url: "https://www.legislation.govt.nz/regulation/public/2008/0197/latest/DLM1382100.html",
    pageTitle:
      "District Courts (Lawyers and Conveyancers Act 2006) Amendment Rules 2008 | New Zealand Legislation",
    typeId: "legislative-instrument",
    want: "District Courts (Lawyers and Conveyancers Act 2006) Amendment Rules 2008.",
  },
  {
    // The page cannot be read. The kind of instrument and its year are still
    // known from the path, so the short title is the only thing to ask for.
    url: "https://www.legislation.govt.nz/act/public/2006/0069/latest/DLM393463.html",
    typeId: "nz-statute",
    stillNeeded: ["shortTitle"],
    note: "A blocked page must still give an Act, not a webpage.",
  },

  // ───────────────────────────────────────────────── nzlii.org — rules 3.2, 3.3
  {
    // NZLII carries the parallel reported citation, which rule 3.2 prefers.
    url: "http://www.nzlii.org/nz/cases/NZSC/2008/55.html",
    pageTitle:
      "Z v Dental Complaints Assessment Committee [2008] NZSC 55; [2009] 1 NZLR 1 (25 July 2008)",
    typeId: "reported-case-nz",
    want: "Z v Dental Complaints Assessment Committee [2008] NZSC 55, [2009] 1 NZLR 1.",
  },
  {
    // Unreported, so rule 3.3's neutral citation stands alone.
    url: "http://www.nzlii.org/nz/cases/NZCA/2010/619.html",
    pageTitle: "Erwood v Ministry of Social Development [2010] NZCA 619 (16 December 2010)",
    typeId: "neutral-citation-case-nz",
    want: "Erwood v Ministry of Social Development [2010] NZCA 619.",
  },
  {
    url: "https://www.nzlii.org/nz/cases/NZHC/2019/1508.html",
    pageTitle: "Smith v Fonterra Co-operative Group Ltd [2019] NZHC 1508 (28 June 2019)",
    typeId: "neutral-citation-case-nz",
    want: "Smith v Fonterra Co-operative Group Ltd [2019] NZHC 1508.",
  },
  {
    // Unreadable page: the citation is fully in the path, only the parties are not.
    url: "http://www.nzlii.org/nz/cases/NZSC/2008/55.html",
    typeId: "neutral-citation-case-nz",
    stillNeeded: ["caseName"],
    note: "The court, year and number come from the path even with no page.",
  },

  // ─────────────────────────────────────── courtsofnz.govt.nz — the file name is
  //                                        the neutral citation
  {
    url: "https://www.courtsofnz.govt.nz/assets/cases/2019/2019-NZSC-40.pdf",
    typeId: "neutral-citation-case-nz",
    stillNeeded: ["caseName"],
    note: "A PDF has no readable title, but 2019-NZSC-40 is [2019] NZSC 40.",
  },

  // ─────────────────────────────────────────────── the rest of the web is generic
  {
    url: "https://www.stuff.co.nz/national/politics/300123456/some-article",
    typeId: "internet-material",
    note: "Not a legal source: the generic resolvers keep this.",
  },

  // ──────────────────────────── a page title has to earn being believed
  //
  // Fetching through a public CORS proxy routinely returns a challenge page
  // instead of the document. Trusting its <title> produced the worst output this
  // tool can produce — the citation right in every part except the one that
  // names the case:
  //
  //   Just a moment... [2008] NZSC 55.
  //
  // A title is now used only where it corroborates what the URL already
  // established: an NZLII title must contain the neutral citation the path gave,
  // and a legislation.govt.nz title must end with the path's year.
  {
    url: "http://www.nzlii.org/nz/cases/NZSC/2008/55.html",
    pageTitle: "Just a moment...",
    typeId: "neutral-citation-case-nz",
    stillNeeded: ["caseName"],
    note: "Cloudflare's interstitial, served in place of the judgment.",
  },
  {
    url: "http://www.nzlii.org/nz/cases/NZSC/2008/55.html",
    pageTitle: "NZLII - New Zealand Legal Information Institute",
    typeId: "neutral-citation-case-nz",
    stillNeeded: ["caseName"],
    note: "The site's own front page: a real title, but not this document's.",
  },
  {
    url: "https://www.legislation.govt.nz/act/public/2006/0069/latest/DLM393463.html",
    pageTitle: "Attention Required! | Cloudflare",
    typeId: "nz-statute",
    stillNeeded: ["shortTitle"],
  },
  {
    url: "https://www.legislation.govt.nz/act/public/2006/0069/latest/DLM393463.html",
    pageTitle: "Search results | New Zealand Legislation",
    typeId: "nz-statute",
    stillNeeded: ["shortTitle"],
    note: "A redirect to search: the title does not end with the path's year.",
  },

  // ─────────────────────────────── subscription databases: recognised, declined
  //
  // A student doing an assignment lives in these and will paste one of their
  // links. The URL is a session-scoped document id and the page needs a login, so
  // there is nothing to read from either — and every one of them used to come back
  // as "internet material", putting a Westlaw session address into a case
  // citation. Naming the database and asking for the reference text is strictly
  // more useful than a citation the student would have to throw away.
  {
    url: "https://www.westlaw.co.nz/maf/wlnz/app/document?docguid=Ie1b2c3d4",
    typeId: "",
    declined: true,
  },
  {
    url: "https://advance.lexis.com/api/document?collection=cases&id=urn:contentItem:XYZ",
    typeId: "",
    declined: true,
  },
  {
    url: "https://iknow.cch.co.nz/document/atagUio1234",
    typeId: "",
    declined: true,
  },

  // ──────────────────────────────────── gazette.govt.nz — rule 5.2.4, Oct 2017 on
  //
  // The path's id IS the notice number the rule requires. The publication date is
  // in neither the path nor the title — the date printed in the page body is the
  // date of the thing declared, not the date the Gazette published it — so it is
  // asked for rather than quietly got wrong.
  {
    url: "https://gazette.govt.nz/notice/id/2018-go941",
    pageTitle: "Declaration of State of Local Emergency - 2018-go941 | New Zealand Gazette",
    typeId: "nz-gazette",
    stillNeeded: ["date"],
  },
  {
    url: "https://gazette.govt.nz/notice/id/2018-go941",
    typeId: "nz-gazette",
    stillNeeded: ["title", "date"],
    note: "Unreadable page: the notice number still comes from the path.",
  },

  // ────────────────── AustLII and BAILII — rules 8.2, 8.4.1, and the jurisdiction
  //
  // These were all read as NEW ZEALAND unreported cases, because the parser took
  // the court code and ignored the jurisdiction segment that precedes it. A UK
  // Supreme Court judgment came out under rule 3.3. The jurisdiction in the path
  // is what settles which rule applies, and it is now what decides the type.
  {
    // AustLII's ordinary link goes through /cgi-bin/viewdoc/, and the path
    // carries a sub-jurisdiction ("cth") between "cases" and the court.
    url: "http://www.austlii.edu.au/cgi-bin/viewdoc/au/cases/cth/HCA/1992/23.html",
    pageTitle: "Mabo v Queensland (No 2) [1992] HCA 23 (3 June 1992)",
    typeId: "australia-case",
    want: "Mabo v Queensland (No 2) [1992] HCA 23.",
  },
  {
    url: "https://www.bailii.org/uk/cases/UKSC/2019/41.html",
    pageTitle: "R (Miller) v The Prime Minister [2019] UKSC 41 (24 September 2019)",
    typeId: "england-wales-case-modern",
    want: "R (Miller) v The Prime Minister [2019] UKSC 41.",
  },
  {
    // Rule 8.4.1 writes the Court of Appeal's division after the court —
    // "[2020] EWCA Civ 1058" — and BAILII puts it in its own path segment.
    url: "https://www.bailii.org/ew/cases/EWCA/Civ/2020/1058.html",
    typeId: "england-wales-case-modern",
    stillNeeded: ["caseName"],
    note: "The division is part of the citation and must survive the path.",
  },
  {
    // The same division segment, but rule 8.4.1 puts a High Court division in
    // BRACKETS AFTER the judgment number instead.
    url: "https://www.bailii.org/ew/cases/EWHC/Comm/2009/254.html",
    typeId: "england-wales-case-modern",
    stillNeeded: ["caseName"],
    note: "EWHC takes its division in brackets after the number, EWCA does not.",
  },

  // ─────────────────────────────────────────── parliament.nz — rule 5.1.1
  {
    // The sitting date is in the path. The volume and column are on the page, so
    // they are asked for rather than guessed.
    url: "https://www.parliament.nz/en/pb/hansard-debates/rhr/combined/HansD_20170816_20170816",
    typeId: "hansard",
    stillNeeded: ["volume", "pinpoint"],
    note: "A debate must not be cited as internet material.",
  },
];

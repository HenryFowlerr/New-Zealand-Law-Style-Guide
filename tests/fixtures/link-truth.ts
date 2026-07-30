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
];

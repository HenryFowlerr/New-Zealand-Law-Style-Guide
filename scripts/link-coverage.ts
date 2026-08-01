/**
 * Which links does the tool actually recognise?
 *
 * `link-truth.ts` records 20 URLs that were read off the live sites, and the
 * link report scores them. But a fixture can only fail on what someone thought
 * to put in it, and the question a student's paste asks is broader: of the
 * places New Zealand law is actually read online, how many does
 * `recogniseNzSource` know?
 *
 * This enumerates URL SHAPES rather than pages, so it needs no network. A shape
 * is "recognised" when the URL alone settles the source type — which is the
 * whole design of the link layer: the path is trusted, the page is not.
 *
 * Nothing here asserts. It reports, so that the next site is chosen by what
 * students paste rather than by what is easy.
 */
import { recogniseNzSource } from "../src/engine/nzSources";

type Probe = { url: string; what: string; expect: string };

const PROBES: Probe[] = [
  // ---------------------------------------------------------- legislation
  { url: "https://www.legislation.govt.nz/act/public/2006/0069/latest/DLM393463.html", what: "Act", expect: "nz-statute" },
  { url: "https://www.legislation.govt.nz/regulation/public/2008/0197/latest/DLM1382100.html", what: "regulation", expect: "legislative-instrument" },
  { url: "https://www.legislation.govt.nz/bill/government/2023/0244/latest/LMS877725.html", what: "Bill", expect: "bill" },
  { url: "https://www.legislation.govt.nz/act/public/1852/0072/latest/DLM1234.html", what: "imperial/old Act", expect: "nz-statute" },

  // --------------------------------------------------------------- cases
  { url: "http://www.nzlii.org/nz/cases/NZSC/2008/55.html", what: "NZLII NZSC", expect: "case" },
  { url: "http://www.nzlii.org/nz/cases/NZCA/2010/619.html", what: "NZLII NZCA", expect: "case" },
  { url: "https://www.nzlii.org/nz/cases/NZHC/2019/1508.html", what: "NZLII NZHC", expect: "case" },
  { url: "https://www.courtsofnz.govt.nz/assets/cases/2019/2019-NZSC-40.pdf", what: "Courts of NZ PDF", expect: "case" },
  { url: "http://www.austlii.edu.au/cgi-bin/viewdoc/au/cases/cth/HCA/1992/23.html", what: "AustLII HCA", expect: "case" },
  { url: "https://www.bailii.org/uk/cases/UKSC/2019/41.html", what: "BAILII UKSC", expect: "case" },
  { url: "https://www.bailii.org/ew/cases/EWCA/Civ/2020/1058.html", what: "BAILII EWCA Civ", expect: "case" },
  { url: "https://www.canlii.org/en/ca/scc/doc/2010/2010scc2/2010scc2.html", what: "CanLII SCC", expect: "case" },
  { url: "https://www.canlii.org/en/on/onca/doc/2015/2015onca100/2015onca100.html", what: "CanLII ONCA", expect: "case" },
  // Rule 8.3.3 forbids CanLII's own pseudo-neutral citation, so this one is a
  // Canadian case with the citation left for the reader — recognised, not filled.
  { url: "https://www.canlii.org/en/ca/scc/doc/1959/1959canlii45/1959canlii45.html", what: "CanLII pre-neutral", expect: "case" },
  { url: "https://www.canlii.org/en/ca/laws/stat/rsc-1985-c-c-46/latest/rsc-1985-c-c-46.html", what: "CanLII federal statute", expect: "canada-statute" },
  { url: "https://www.canlii.org/en/on/laws/stat/rso-1990-c-h-8/latest/rso-1990-c-h-8.html", what: "CanLII provincial statute", expect: "canada-statute" },
  // CanLII's short link is an opaque token with no citation in it.
  { url: "https://canlii.ca/t/2bfxd", what: "CanLII short link", expect: "generic (fine)" },

  // ------------------------------------------------- non-/cases/ AustLII paths
  { url: "http://www.nzlii.org/nz/legis/consol_act/ea20062006n69/", what: "NZLII legislation", expect: "legislation" },
  { url: "http://www.austlii.edu.au/au/journals/SydLawRw/2005/1.html", what: "AustLII journal", expect: "journal-article" },
  { url: "http://www.nzlii.org/nz/journals/VUWLawRw/2010/3.html", what: "NZLII journal", expect: "journal-article" },

  // ------------------------------------------------ parliamentary & official
  { url: "https://gazette.govt.nz/notice/id/2019-au1234", what: "NZ Gazette notice", expect: "nz-gazette" },
  { url: "https://www.parliament.nz/en/pb/hansard-debates/rhr/combined/HansD_20170816_20170816", what: "Hansard debate", expect: "hansard" },
  { url: "https://www.lawcom.govt.nz/our-work/some-report/", what: "Law Commission", expect: "law-commission-report" },
  { url: "https://waitangitribunal.govt.nz/some-report", what: "Waitangi Tribunal", expect: "waitangi-tribunal-report" },

  // ------------------------------------------------------------- databases
  { url: "https://www.westlaw.co.nz/maf/wlnz/app/document?docguid=Ideadbeef", what: "Westlaw", expect: "DECLINE" },
  { url: "https://advance.lexis.com/document/?pdmfid=1&crid=abc", what: "Lexis Advance", expect: "DECLINE" },

  // --------------------------------------------------------- not legal NZ
  { url: "https://www.nzherald.co.nz/nz/some-story/ABCDEF/", what: "news site", expect: "generic (fine)" },
  { url: "https://doi.org/10.1017/S0008197300000000", what: "DOI", expect: "generic (fine)" },
];

let known = 0;
let declined = 0;
let unknown = 0;
const gaps: Probe[] = [];

console.log("=".repeat(78));
console.log("LINK COVERAGE — what the URL alone settles");
console.log("=".repeat(78));

for (const probe of PROBES) {
  const match = recogniseNzSource(probe.url);
  const generic = probe.expect.startsWith("generic");
  if (match?.unresolvable) {
    declined++;
    console.log(`  DECLINE  ${probe.what.padEnd(22)} ${match.source}`);
    continue;
  }
  if (match) {
    known++;
    const fields = Object.entries(match.fields)
      .map(([k, v]) => `${k}=${v}`)
      .join(" ");
    console.log(`  OK       ${probe.what.padEnd(22)} ${match.typeId || "(type from title)"}  ${fields}`);
    continue;
  }
  if (generic) {
    console.log(`  generic  ${probe.what.padEnd(22)} falls through to the generic resolvers, which is correct`);
    continue;
  }
  unknown++;
  gaps.push(probe);
  console.log(`  MISS     ${probe.what.padEnd(22)} expected ${probe.expect}`);
}

console.log(`\n  recognised ${known}   declined ${declined}   MISSED ${unknown}`);
if (gaps.length) {
  console.log("\n--- NOT RECOGNISED (a legal source read as a web page) ---");
  for (const g of gaps) console.log(`  ${g.what}\n    ${g.url}`);
}

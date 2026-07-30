/**
 * Tests for the paste-a-link resolver: DOI/ISBN detection, the Crossref and
 * Open Library response mappers, and the resolver's source selection — all with
 * a stubbed fetcher so no network is touched.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  citoidItemToResolved,
  crossrefToMetadata,
  extractDoi,
  extractIsbn,
  looksLikeLink,
  openLibraryToMetadata,
  resolveLink,
  type Fetchers,
} from "../src/engine/linkResolve.ts";
import { buildCitation } from "../src/engine/build.ts";

const crossrefWork = {
  message: {
    type: "journal-article",
    author: [{ given: "Peter", family: "Watts" }],
    title: ["Birks’ Unjust Enrichment"],
    "container-title": ["Law Quarterly Review"],
    "short-container-title": ["LQR"],
    volume: "121",
    page: "163-180",
    issued: { "date-parts": [[2005, 1, 1]] },
    DOI: "10.1000/xyz123",
  },
};

const openLibraryData = {
  "ISBN:9780000000000": {
    title: "The Law of Torts in New Zealand",
    authors: [{ name: "Stephen Todd" }],
    publishers: [{ name: "Thomson Reuters" }],
    publish_places: [{ name: "Wellington" }],
    publish_date: "2019",
  },
};

test("detects DOIs and ISBNs and link-shaped input", () => {
  assert.equal(extractDoi("https://doi.org/10.1000/xyz123"), "10.1000/xyz123");
  assert.equal(extractDoi("see doi:10.1093/oxfordjournals.123 here."), "10.1093/oxfordjournals.123");
  assert.equal(extractIsbn("ISBN 978-0-00-000000-0"), "9780000000000");
  assert.ok(looksLikeLink("https://example.com/article"));
  assert.ok(!looksLikeLink("Evidence Act 2006, s 8"));
});

test("maps a Crossref journal work to fields that build correctly", () => {
  const md = crossrefToMetadata(crossrefWork.message);
  assert.equal(md.journal, "LQR");
  assert.equal(md.year, "2005");
  assert.equal(md.firstPage, "163");
  const result = buildCitation("journal-article", {
    author: "Peter Watts",
    title: md.title!,
    year: `(${md.year})`,
    volume: md.volume!,
    journalAbbrev: md.journal!,
    startingPage: md.firstPage!,
    pinpoint: "165",
  });
  assert.equal(result.text, "Peter Watts “Birks’ Unjust Enrichment” (2005) 121 LQR 163 at 165.");
});

test("cleans HTML entities and tags from a Crossref title", () => {
  const md = crossrefToMetadata({
    type: "journal-article",
    title: ["Contract &amp; the <i>Bona Fide</i> Purchaser"],
    "short-container-title": ["NZ&nbsp;LJ"],
  });
  assert.equal(md.title, "Contract & the Bona Fide Purchaser");
});

test("handles an organisation author with only a name field", () => {
  const md = crossrefToMetadata({
    type: "report",
    author: [{ name: "World Health Organization" }],
    title: ["Global Report"],
  });
  assert.equal(md.authors[0], "World Health Organization");
});

test("takes the first page of an en-dash page range", () => {
  const md = crossrefToMetadata({
    type: "journal-article",
    title: ["X"],
    "short-container-title": ["LQR"],
    page: "163–180",
  });
  assert.equal(md.firstPage, "163");
});

test("maps an Open Library record to a book", () => {
  const md = openLibraryToMetadata(openLibraryData["ISBN:9780000000000"]);
  assert.equal(md.authors[0], "Stephen Todd");
  assert.equal(md.publisher, "Thomson Reuters");
  assert.equal(md.place, "Wellington");
  assert.equal(md.year, "2019");
});

const stubFetchers = (jsonByUrl: Record<string, any>, textByUrl: Record<string, string> = {}): Fetchers => ({
  fetchJson: async (url) => {
    const key = Object.keys(jsonByUrl).find((k) => url.includes(k));
    if (!key) throw new Error(`unexpected json fetch: ${url}`);
    return jsonByUrl[key];
  },
  fetchText: async (url) => {
    const key = Object.keys(textByUrl).find((k) => url.includes(k));
    if (!key) throw new Error(`unexpected text fetch: ${url}`);
    return textByUrl[key];
  },
});

test("resolves a DOI link through Crossref to a journal-article", async () => {
  const resolved = await resolveLink(
    "https://doi.org/10.1000/xyz123",
    stubFetchers({ "api.crossref.org": crossrefWork }),
  );
  assert.ok(resolved);
  assert.equal(resolved.source, "crossref");
  assert.equal(resolved.typeId, "journal-article");
  assert.equal(resolved.fields.journalAbbrev, "LQR");
  assert.equal(resolved.fields.author, "Peter Watts");
});

test("resolves an ISBN through Open Library to a book", async () => {
  const resolved = await resolveLink(
    "ISBN 978-0-00-000000-0",
    stubFetchers({ "openlibrary.org": openLibraryData }),
  );
  assert.ok(resolved);
  assert.equal(resolved.source, "openlibrary");
  assert.equal(resolved.typeId, "text-book");
  assert.equal(resolved.fields.placeOfPublication, "Wellington");
});

test("resolves a plain page via its embedded citation meta tags", async () => {
  const html = `<head>
    <meta name="citation_title" content="A Note on Vicarious Liability">
    <meta name="citation_author" content="Smith, Jane">
    <meta name="citation_journal_title" content="NZLJ">
    <meta name="citation_volume" content="7">
    <meta name="citation_firstpage" content="42">
    <meta name="citation_publication_date" content="2020"></head>`;
  const resolved = await resolveLink(
    "https://www.example.com/article",
    stubFetchers({}, { "example.com": html }),
  );
  assert.ok(resolved);
  assert.equal(resolved.source, "page-metadata");
  assert.equal(resolved.fields.journalAbbrev, "NZLJ");
});

test("maps Citoid Zotero items to the right Style Guide type and fields", () => {
  const journal = citoidItemToResolved({
    itemType: "journalArticle",
    title: "Unjust Enrichment",
    creators: [{ firstName: "Peter", lastName: "Watts", creatorType: "author" }],
    date: "2005",
    publicationTitle: "Law Quarterly Review",
    volume: "121",
    pages: "163-180",
  });
  assert.equal(journal?.typeId, "journal-article");
  assert.equal(journal?.fields.author, "Peter Watts");
  assert.equal(journal?.fields.year, "(2005)");
  assert.equal(journal?.fields.startingPage, "163");

  const web = citoidItemToResolved(
    {
      itemType: "webpage",
      title: "AI for legal practitioners",
      creators: [{ firstName: "Jane", lastName: "Doe", creatorType: "author" }],
      websiteTitle: "LawNews",
      date: "2025-03-10",
    },
    "https://lawnews.nz/x",
  );
  assert.equal(web?.typeId, "internet-material");
  assert.equal(web?.fields.websiteName, "LawNews");
  assert.equal(web?.fields.date, "10 March 2025");
  assert.equal(web?.fields.url, "https://lawnews.nz/x");
});

test("resolveLink uses Citoid first for a web page", async () => {
  const resolved = await resolveLink("https://lawnews.nz/some-article", {
    fetchJson: async (url) => {
      if (url.includes("/data/citation/")) {
        return [
          {
            itemType: "newspaperArticle",
            title: "Some Article",
            creators: [{ firstName: "A", lastName: "Writer", creatorType: "author" }],
            publicationTitle: "LawNews",
            date: "2025-01-05",
          },
        ];
      }
      throw new Error(`unexpected: ${url}`);
    },
    fetchText: async () => { throw new Error("should not reach the proxy"); },
  });
  assert.equal(resolved?.source, "citoid");
  assert.equal(resolved?.typeId, "newspaper-magazine-article");
  assert.equal(resolved?.fields.newspaperTitle, "LawNews");
});

test("falls back to URL-derived fields when a page cannot be read", async () => {
  // A blocked/empty page still yields a starting point from the URL itself.
  const resolved = await resolveLink(
    "https://lawnews.nz/technology/ai-for-legal-practitioners-why-fear-is-not-a-strategy/",
    { fetchJson: async () => ({}), fetchText: async () => { throw new Error("403"); } },
  );
  assert.ok(resolved);
  assert.equal(resolved.source, "url-only");
  assert.equal(resolved.typeId, "internet-material");
  assert.equal(resolved.fields.websiteName, "lawnews.nz");
  assert.equal(resolved.fields.title, "Ai For Legal Practitioners Why Fear Is Not A Strategy");
  assert.match(resolved.fields.url, /^https:\/\/lawnews\.nz\//);
});

test("returns null for a non-link that matches nothing", async () => {
  const resolved = await resolveLink(
    "not a link at all",
    { fetchJson: async () => ({}), fetchText: async () => "" },
  );
  assert.equal(resolved, null);
});

// ─────────────────────────────────────────────────────────────────────────────
// New Zealand legal sources
//
// The generic resolvers read a judgment or an Act as a web page, so the official
// text of the Evidence Act came back as “DLM393463” legislation.govt.nz <…> — a
// correctly formatted citation of a kind rule 4.1.1 does not permit at all. The
// URL settles the type; the page title fills in the rest, and where it cannot be
// read the citation is still of the right kind.
// ─────────────────────────────────────────────────────────────────────────────

import { LINK_TRUTH } from "./fixtures/link-truth.ts";
import { applyPageTitle, recogniseNzSource } from "../src/engine/nzSources.ts";

for (const truth of LINK_TRUTH) {
  const label = `${truth.url.replace(/^https?:\/\/(www\.)?/, "")}${truth.pageTitle ? "" : " (page unreadable)"}`;
  test(`[link] ${label}`, () => {
    const match = recogniseNzSource(truth.url);
    if (truth.typeId === "internet-material") {
      // Not a legal source: the generic resolvers must keep it.
      assert.equal(match, null);
      return;
    }
    assert.ok(match, "a New Zealand legal source was not recognised");
    const applied = applyPageTitle(match, truth.pageTitle ?? "");
    assert.equal(applied.typeId, truth.typeId);
    if (truth.want) {
      assert.equal(buildCitation(applied.typeId, applied.fields).text, truth.want);
    }
    for (const id of truth.stillNeeded ?? []) {
      assert.ok(
        applied.stillNeeded.includes(id),
        `should have asked the reader for "${id}", asked for: ${applied.stillNeeded.join(", ") || "(nothing)"}`,
      );
    }
  });
}

test("an Act is an Act whether or not the page can be read", () => {
  // The whole point of reading the URL first: a blocked page must not downgrade a
  // statute to a webpage citation. Rule 4.1.1 gives an Act no URL at all, so
  // "internet material" is not a lesser answer here — it is a wrong one.
  const match = recogniseNzSource(
    "https://www.legislation.govt.nz/act/public/2006/0069/latest/DLM393463.html",
  )!;
  const blind = applyPageTitle(match, "");
  const read = applyPageTitle(match, "Evidence Act 2006 | New Zealand Legislation");
  assert.equal(blind.typeId, "nz-statute");
  assert.equal(read.typeId, "nz-statute");
  // The year is in the path, so it survives the page being unreadable; only the
  // short title is asked for.
  assert.equal(blind.fields.year, "2006");
  assert.deepEqual(blind.stillNeeded, ["shortTitle"]);
  assert.deepEqual(read.stillNeeded, []);
});

test("a judgment's court, year and number come from the path alone", () => {
  const match = recogniseNzSource("http://www.nzlii.org/nz/cases/NZCA/2010/619.html")!;
  const blind = applyPageTitle(match, "");
  assert.equal(blind.typeId, "neutral-citation-case-nz");
  assert.equal(blind.fields.year, "2010");
  assert.equal(blind.fields.courtIdentifier, "NZCA");
  assert.equal(blind.fields.judgmentNumber, "619");
  assert.deepEqual(blind.stillNeeded, ["caseName"]);
});

test("a reported case takes the parallel citation NZLII carries", () => {
  // Rule 3.2 prefers the reported citation with the neutral one in front of it,
  // and NZLII's title gives both. Reading only the neutral citation would cite
  // the case as unreported when it is not.
  const match = recogniseNzSource("http://www.nzlii.org/nz/cases/NZSC/2008/55.html")!;
  const applied = applyPageTitle(
    match,
    "Z v Dental Complaints Assessment Committee [2008] NZSC 55; [2009] 1 NZLR 1 (25 July 2008)",
  );
  assert.equal(applied.typeId, "reported-case-nz");
  assert.equal(applied.fields.neutralCitation, "[2008] NZSC 55");
  assert.equal(applied.fields.reportSeries, "NZLR");
  assert.equal(applied.fields.caseName, "Z v Dental Complaints Assessment Committee");
});

test("an amending instrument takes the year that closes its title", () => {
  // "District Courts (Lawyers and Conveyancers Act 2006) Amendment Rules 2008"
  // is a 2008 instrument. Taking the first year in the title made it 2006.
  const match = recogniseNzSource(
    "https://www.legislation.govt.nz/regulation/public/2008/0197/latest/DLM1382100.html",
  )!;
  const applied = applyPageTitle(
    match,
    "District Courts (Lawyers and Conveyancers Act 2006) Amendment Rules 2008 | New Zealand Legislation",
  );
  assert.equal(applied.fields.year, "2008");
  assert.equal(applied.fields.title, "District Courts (Lawyers and Conveyancers Act 2006) Amendment Rules");
});

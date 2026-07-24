/**
 * Tests for the paste-a-link resolver: DOI/ISBN detection, the Crossref and
 * Open Library response mappers, and the resolver's source selection — all with
 * a stubbed fetcher so no network is touched.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
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

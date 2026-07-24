/**
 * Tests for the "paste a link" metadata parser: reading Highwire/Dublin Core
 * citation meta tags out of page HTML and mapping them onto engine fields.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  joinAuthors,
  metadataToFields,
  parseCitationMetadata,
  readMetaTags,
} from "../src/engine/metadata.ts";
import { buildCitation } from "../src/engine/build.ts";

const journalHtml = `
<html><head>
<meta name="citation_title" content="Birks&#8217; Unjust Enrichment">
<meta name="citation_author" content="Watts, Peter">
<meta name="citation_journal_title" content="LQR">
<meta name="citation_volume" content="121">
<meta name="citation_firstpage" content="163">
<meta name="citation_publication_date" content="2005/01/01">
</head></html>`;

test("reads repeated and entity-encoded meta tags", () => {
  const tags = readMetaTags(journalHtml);
  assert.equal(tags.get("citation_title")?.[0], "Birks’ Unjust Enrichment");
  assert.equal(tags.get("citation_volume")?.[0], "121");
});

test("parses journal metadata and maps to a journal-article", () => {
  const md = parseCitationMetadata(journalHtml);
  assert.equal(md.title, "Birks’ Unjust Enrichment");
  assert.equal(md.journal, "LQR");
  assert.equal(md.year, "2005");
  const mapped = metadataToFields(md);
  assert.ok(mapped);
  assert.equal(mapped.typeId, "journal-article");
  assert.equal(mapped.fields.author, "Peter Watts");
  assert.equal(mapped.fields.year, "(2005)");
  assert.equal(mapped.fields.journalAbbrev, "LQR");
});

test("mapped journal fields build a valid citation once the pinpoint is added", () => {
  const md = parseCitationMetadata(journalHtml);
  const mapped = metadataToFields(md)!;
  const result = buildCitation(mapped.typeId, { ...mapped.fields, pinpoint: "165" });
  assert.equal(result.status, "ready");
  assert.equal(
    result.text,
    "Peter Watts “Birks’ Unjust Enrichment” (2005) 121 LQR 163 at 165.",
  );
});

test("joins multiple authors in NZLSG style", () => {
  assert.equal(joinAuthors(["Butler, Andrew", "Butler, Petra"]), "Andrew Butler and Petra Butler");
  assert.equal(
    joinAuthors(["A One", "B Two", "C Three"]),
    "A One, B Two and C Three",
  );
});

test("falls back to a book when there is no journal title", () => {
  const html = `<head>
    <meta name="citation_title" content="The Law of Torts">
    <meta name="citation_author" content="Todd, Stephen">
    <meta name="citation_publisher" content="Thomson Reuters">
    <meta name="citation_publication_date" content="2019">
    <meta name="citation_isbn" content="9780000000000"></head>`;
  const mapped = metadataToFields(parseCitationMetadata(html));
  assert.ok(mapped);
  assert.equal(mapped.typeId, "text-book");
  assert.equal(mapped.fields.author, "Stephen Todd");
  assert.equal(mapped.fields.publisher, "Thomson Reuters");
});

test("returns null when a page carries no usable citation metadata", () => {
  assert.equal(metadataToFields(parseCitationMetadata("<html><head></head></html>")), null);
});

/**
 * Tests for the deterministic author/title boundary parser — the any-browser
 * engine that splits "Author Title" when a reference has no italics or quotes.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { splitAuthor } from "../src/engine/names.ts";
import { prefillFromPaste } from "../src/engine/build.ts";
import { guideTypeById } from "../src/data/styleGuide.ts";

test("splits a two-author book front matter", () => {
  const split = splitAuthor(
    "Andrew Butler and Petra Butler The New Zealand Bill of Rights Act: A Commentary",
  );
  assert.equal(split?.author, "Andrew Butler and Petra Butler");
  assert.equal(split?.rest, "The New Zealand Bill of Rights Act: A Commentary");
});

test("splits a single Given-Surname author from the title", () => {
  const split = splitAuthor("Stephen Todd The Law of Torts in New Zealand");
  assert.equal(split?.author, "Stephen Todd");
  assert.equal(split?.rest, "The Law of Torts in New Zealand");
});

test("stops an initialled author at the surname, not the next title word", () => {
  const split = splitAuthor("R P Boast The Foreshore and Seabed");
  assert.equal(split?.author, "R P Boast");
  assert.equal(split?.rest, "The Foreshore and Seabed");
});

test("handles a comma-and mixed author list", () => {
  const split = splitAuthor("John Smith, Jane Doe and A B Carter Contract Law");
  assert.equal(split?.author, "John Smith, Jane Doe and A B Carter");
  assert.equal(split?.rest, "Contract Law");
});

test("declines an organisation-led head rather than mis-splitting", () => {
  // "Ministry of Education …" must not become author "Ministry".
  assert.equal(splitAuthor("Ministry of Education Briefing to the Incoming Minister"), null);
});

test("declines text that does not begin with a name", () => {
  assert.equal(splitAuthor("The Law of Contract"), null);
  assert.equal(splitAuthor(""), null);
});

test("an unformatted book paste splits author from title end to end", () => {
  const fields = prefillFromPaste(
    guideTypeById["text-book"],
    "Andrew Butler and Petra Butler The New Zealand Bill of Rights Act: A Commentary (2nd ed, LexisNexis, Wellington, 2015)",
    [],
  );
  assert.equal(fields.author, "Andrew Butler and Petra Butler");
  assert.equal(fields.title, "The New Zealand Bill of Rights Act: A Commentary");
  assert.equal(fields.edition, "2nd ed");
  assert.equal(fields.publisher, "LexisNexis");
  assert.equal(fields.placeOfPublication, "Wellington");
  assert.equal(fields.year, "2015");
});

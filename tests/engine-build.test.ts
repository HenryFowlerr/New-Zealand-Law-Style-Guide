/**
 * Tests for the interactive build pipeline over the data-driven engine: correct
 * output for representative types, a final full stop, fail-closed behaviour on
 * missing required components, and html escaping.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { buildCitation, visibleComponents } from "../src/engine/build.ts";
import { guideTypeById } from "../src/data/styleGuide.ts";

test("builds a reported NZ case with a neutral citation", () => {
  const result = buildCitation("reported-case-nz", {
    caseName: "Z v Dental Complaints Assessment Committee",
    neutralCitation: "[2008] NZSC 55",
    year: "[2009]",
    volume: "1",
    reportSeries: "NZLR",
    startingPage: "1",
    pinpoint: "[26]",
  });
  assert.equal(result.status, "ready");
  assert.equal(
    result.text,
    "Z v Dental Complaints Assessment Committee [2008] NZSC 55, [2009] 1 NZLR 1 at [26].",
  );
  assert.match(result.html, /<em>Z v Dental Complaints Assessment Committee<\/em>/);
});

test("builds a reported case with a court identifier and no neutral citation", () => {
  const result = buildCitation("reported-case-nz", {
    caseName: "Taylor v New Zealand Poultry Board",
    year: "[1984]",
    volume: "1",
    reportSeries: "NZLR",
    startingPage: "394",
    courtIdentifier: "CA",
    pinpoint: "398",
  });
  assert.equal(
    result.text,
    "Taylor v New Zealand Poultry Board [1984] 1 NZLR 394 (CA) at 398.",
  );
});

test("builds an NZ statute and ends with a single full stop", () => {
  const result = buildCitation("nz-statute", {
    shortTitle: "Evidence Act",
    year: "2006",
    pinpoint: "s 8",
  });
  assert.equal(result.text, "Evidence Act 2006, s 8.");
  assert.equal((result.text.match(/\.$/g) ?? []).length, 1);
});

test("builds a journal article", () => {
  const result = buildCitation("journal-article", {
    author: "Peter Watts",
    title: "Birks’ Unjust Enrichment",
    year: "(2005)",
    volume: "121",
    journalAbbrev: "LQR",
    startingPage: "163",
    pinpoint: "165",
  });
  assert.equal(
    result.text,
    "Peter Watts “Birks’ Unjust Enrichment” (2005) 121 LQR 163 at 165.",
  );
});

test("is fail-closed when a required component is missing", () => {
  const result = buildCitation("nz-statute", { shortTitle: "Evidence Act" });
  assert.equal(result.status, "incomplete");
  assert.equal(result.text, "");
  assert.ok(result.issues.some((issue) => issue.level === "error" && issue.field === "year"));
});

test("dropping any single required component fails closed across every type", () => {
  for (const type of Object.values(guideTypeById)) {
    const components = visibleComponents(type);
    const required = components.filter((c) => c.required);
    if (required.length === 0) continue;
    // Fill every required field with a placeholder, then remove one.
    const full: Record<string, string> = {};
    for (const c of required) full[c.id] = "x";
    for (const c of required) {
      const broken = { ...full };
      delete broken[c.id];
      const result = buildCitation(type.id, broken);
      assert.equal(
        result.status,
        "incomplete",
        `${type.id} stayed ready without required ${c.id}`,
      );
      assert.equal(result.text, "", `${type.id} leaked text without ${c.id}`);
    }
  }
});

test("html output escapes user-supplied markup", () => {
  const result = buildCitation("nz-statute", {
    shortTitle: "<script>alert(1)</script> Act",
    year: "2006",
  });
  assert.doesNotMatch(result.html, /<script>/);
  assert.match(result.html, /&lt;script&gt;/);
});

test("book and report titles render italic even when the template omits markup", () => {
  const book = buildCitation("text-book", {
    author: "Andrew Butler and Petra Butler",
    title: "The New Zealand Bill of Rights Act: A Commentary",
    edition: "2nd ed",
    publisher: "LexisNexis",
    placeOfPublication: "Wellington",
    year: "2015",
  });
  assert.match(
    book.html,
    /<em>The New Zealand Bill of Rights Act: A Commentary<\/em>/,
  );
  assert.equal(
    book.text,
    "Andrew Butler and Petra Butler The New Zealand Bill of Rights Act: A Commentary (2nd ed, LexisNexis, Wellington, 2015).",
  );
});

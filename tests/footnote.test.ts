/**
 * The footnote composer, against the Guide's own worked example.
 *
 * NZLSG 2.2: several authorities in one footnote are separated by semicolons,
 * "and" precedes the last, and the footnote ends with a single full stop — the
 * individual citations do not keep their own.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { buildCitation, composeFootnote } from "../src/engine/build.ts";

const edwards = () =>
  buildCitation("reported-case-nz", {
    caseName: "Edwards v O’Connor", year: "[1991]", volume: "2",
    reportSeries: "NZLR", startingPage: "543", courtIdentifier: "CA",
  });
const thorne = () =>
  buildCitation("reported-case-nz", {
    caseName: "L G Thorne & Co v Thomas Borthwick & Sons", year: "[1956]",
    reportSeries: "SR (NSW)", startingPage: "81", courtIdentifier: "SC",
  });
const stateRail = () =>
  buildCitation("australia-case", {
    caseName: "State Rail Authority v Heath Outdoor Ltd", year: "(1986)",
    volume: "7", reportSeries: "NSWLR", startingPage: "170",
    jurisdictionCourt: "CA",
  });

test("three authorities compose exactly as the Guide prints them", () => {
  assert.equal(
    composeFootnote([edwards(), thorne(), stateRail()]).text,
    "Edwards v O’Connor [1991] 2 NZLR 543 (CA); " +
      "L G Thorne & Co v Thomas Borthwick & Sons [1956] SR (NSW) 81 (SC); " +
      "and State Rail Authority v Heath Outdoor Ltd (1986) 7 NSWLR 170 (CA).",
  );
});

test("a composed footnote keeps each case name italic", () => {
  const html = composeFootnote([edwards(), stateRail()]).html;
  assert.ok(html.includes("<em>Edwards v O’Connor</em>"));
  assert.ok(html.includes("<em>State Rail Authority v Heath Outdoor Ltd</em>"));
});

test("one authority is just that authority, with one full stop", () => {
  const text = composeFootnote([edwards()]).text;
  assert.equal(text, "Edwards v O’Connor [1991] 2 NZLR 543 (CA).");
  assert.equal(text.match(/\.$/g)?.length, 1);
});

test("a year typed with its brackets is not bracketed twice", () => {
  // A student copies the year exactly as printed — "(1986)", "[2009]" — and
  // several templates supply those brackets themselves.
  assert.equal(
    stateRail().text,
    "State Rail Authority v Heath Outdoor Ltd (1986) 7 NSWLR 170 (CA).",
  );
  assert.equal(
    buildCitation("reported-case-nz", {
      caseName: "Hawkins v Minister of Justice", year: "[1991]", volume: "2",
      reportSeries: "NZLR", startingPage: "530", courtIdentifier: "CA",
      pinpoint: "534",
    }).text,
    "Hawkins v Minister of Justice [1991] 2 NZLR 530 (CA) at 534.",
  );
});

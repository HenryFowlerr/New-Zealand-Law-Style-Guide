/**
 * The guarantee: the right values in the right boxes produce the Style Guide's
 * citation exactly — every comma, bracket, dash and full stop.
 *
 * Fields are written out by hand (tests/fixtures/field-truth.ts) and the
 * expected strings are the Guide's own worked examples, so this tests the
 * renderer against the Guide rather than against the extractor.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { buildCitation } from "../src/engine/build.ts";
import { FIELD_TRUTH } from "./fixtures/field-truth.ts";

for (const truth of FIELD_TRUTH) {
  const label = truth.want.length > 68 ? `${truth.want.slice(0, 65)}…` : truth.want;
  test(`[${truth.typeId}] ${label}`, { skip: truth.knownGap }, () => {
    const built = buildCitation(truth.typeId, truth.fields);
    assert.equal(built.status, "ready", `refused to build: ${JSON.stringify(built.issues)}`);
    assert.equal(built.text, truth.want);
  });
}

/**
 * The conditional rules must fire on an actual neutral citation, never on a
 * box that merely holds something. Positional extraction fills the neutral
 * fields with case-name words when it mis-splits, and acting on that deleted
 * the court from citations that were perfectly correct.
 */
test("a mis-split neutral field never deletes a real court identifier", () => {
  const built = buildCitation("australia-case", {
    caseName: "South Australia v Johnson",
    // What a bad split leaves behind: words, not a neutral citation.
    neutralCourt: "Australia",
    number: "v",
    year: "(1982)",
    volume: "26",
    reportSeries: "SASR",
    startingPage: "41",
    jurisdictionCourt: "SC",
  });
  assert.match(built.text, /\(SC\)\.$/);
});

test("a real neutral citation still drops the court under rule 3.2", () => {
  const built = buildCitation("reported-case-nz", {
    caseName: "Z v Dental Complaints Assessment Committee",
    neutralCitation: "[2008] NZSC 55",
    year: "[2009]",
    volume: "1",
    reportSeries: "NZLR",
    startingPage: "1",
    courtIdentifier: "SC",
    pinpoint: "[26]",
  });
  assert.equal(
    built.text,
    "Z v Dental Complaints Assessment Committee [2008] NZSC 55, [2009] 1 NZLR 1 at [26].",
  );
});

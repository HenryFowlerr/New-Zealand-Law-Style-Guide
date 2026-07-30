/**
 * Splitting a paste into the separate references it contains.
 *
 * Pasting a reading list produced a citation for the FIRST reference and
 * silently dropped the rest — the worst kind of failure, because the student
 * gets an answer back and no sign anything is missing.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { splitReferences } from "../src/engine/render.ts";
import { detectTypes } from "../src/engine/build.ts";

test("separate lines are separate references", () => {
  const parts = splitReferences(
    "Z v Dental Complaints Assessment Committee [2008] NZSC 55, [2009] 1 NZLR 1 at [26].\nEvidence Act 2006, s 8.",
  );
  assert.equal(parts.length, 2);
  assert.equal(parts[1], "Evidence Act 2006, s 8.");
});

test("a numbered or bulleted list loses its markers", () => {
  for (const paste of [
    "1. Attorney-General v X [2007] NZCA 388 at [70].\n2. Evidence Act 2006, s 44.",
    "• Attorney-General v X [2007] NZCA 388 at [70].\n• Evidence Act 2006, s 44.",
    "[1] Attorney-General v X [2007] NZCA 388 at [70].\n[2] Evidence Act 2006, s 44.",
  ]) {
    const parts = splitReferences(paste);
    assert.equal(parts.length, 2, paste);
    assert.equal(parts[0], "Attorney-General v X [2007] NZCA 388 at [70].");
    assert.equal(parts[1], "Evidence Act 2006, s 44.");
  }
});

test("a single citation wrapped across lines stays one reference", () => {
  // The line break here is a PDF wrap, not a new source — and the second line
  // opens with a bracketed YEAR, which must not be read as a footnote marker.
  const parts = splitReferences(
    "Taylor v New Zealand Poultry Board\n[1984] 1 NZLR 394 (CA) at 398.",
  );
  assert.equal(parts.length, 1);
  assert.equal(parts[0], "Taylor v New Zealand Poultry Board [1984] 1 NZLR 394 (CA) at 398.");
});

test("blank lines separate references", () => {
  const parts = splitReferences(
    "Taylor v New Zealand Poultry Board [1984] 1 NZLR 394 (CA) at 398.\n\nCrimes Act 1961, s 167.\n\nPeter Watts “Birks’ Unjust Enrichment” (2005) 121 LQR 163 at 165.",
  );
  assert.equal(parts.length, 3);
});

test("each reference in a list detects as its own type", () => {
  const parts = splitReferences(
    "1. Attorney-General v X [2007] NZCA 388 at [70].\n2. Evidence Act 2006, s 44.",
  );
  assert.equal(detectTypes(parts[0], 1)[0].typeId, "neutral-citation-case-nz");
  assert.equal(detectTypes(parts[1], 1)[0].typeId, "nz-statute");
});

test("a lone reference and an empty paste behave", () => {
  assert.deepEqual(splitReferences("Evidence Act 2006, s 8."), ["Evidence Act 2006, s 8."]);
  assert.deepEqual(splitReferences("   "), []);
  assert.deepEqual(splitReferences(""), []);
});

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
import { buildCitation, composeFootnote, detectTypes, prefillFromPaste } from "../src/engine/build.ts";
import { guideTypeById } from "../src/data/styleGuide.ts";

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

// ─────────────────────────────────────────────────────────────────────────────
// One footnote, several authorities
//
// Rule 2.2.4 joins authorities in a single footnote with semicolons and an "and"
// before the last — which is what composeFootnote writes. Being unable to read one
// back meant a student pasting a footnote out of their own draft got all of its
// authorities mashed into a single citation.
// ─────────────────────────────────────────────────────────────────────────────

test("a footnote citing three authorities splits into three", () => {
  const footnote =
    "Taylor v New Zealand Poultry Board [1984] 1 NZLR 394 (CA) at 398; Evidence Act 2006, s 8; and Peter Watts “Birks’ Unjust Enrichment” (2005) 121 LQR 163 at 165.";
  const parts = splitReferences(footnote);
  assert.equal(parts.length, 3);
  assert.equal(parts[0], "Taylor v New Zealand Poultry Board [1984] 1 NZLR 394 (CA) at 398");
  assert.equal(parts[1], "Evidence Act 2006, s 8");
  assert.ok(parts[2].startsWith("Peter Watts"));
});

test("a footnote read apart and recomposed is the footnote again", () => {
  const footnote =
    "Taylor v New Zealand Poultry Board [1984] 1 NZLR 394 (CA) at 398; Evidence Act 2006, s 8; and Peter Watts “Birks’ Unjust Enrichment” (2005) 121 LQR 163 at 165.";
  const built = splitReferences(footnote).map((text) => {
    const type = guideTypeById[detectTypes(text, 1)[0].typeId];
    return buildCitation(type.id, prefillFromPaste(type, text, []));
  });
  assert.equal(composeFootnote(built).text, footnote);
});

test("a semicolon that is not separating authorities leaves the footnote whole", () => {
  // Every part has to look like the start of a reference. None of the Guide's 216
  // worked examples contains a semicolon inside one citation, but a stray one in
  // a pasted sentence must not shatter the reference.
  assert.equal(splitReferences("Taylor v New Zealand Poultry Board [1984] 1 NZLR 394; at 398").length, 1);
  assert.equal(splitReferences("Evidence Act 2006, s 8; ss 9–10").length, 1);
});

// ─────────────────────────────────────────────────────────────────────────────
// A reading list pasted whole
//
// This was the worst output the tool produced. A reading list does not punctuate
// its entries, and the list-marker rule was gated behind the previous line having
// finished a sentence — so the whole list collapsed into ONE reference and the
// citation mixed facts from different authorities:
//
//   Bowen v Paramount Builders (Hamilton) Ltd [2024] NZSC 5, [1977] 1 NZLR 394 at [5.2].
//
// One case's name, another's neutral citation, a third's pinpoint: a fabricated
// authority that looks entirely plausible.
// ─────────────────────────────────────────────────────────────────────────────

const READING_LIST = `Week 4 — Duty of care
1. Bowen v Paramount Builders (Hamilton) Ltd [1977] 1 NZLR 394 (CA)
2. Smith v Fonterra Co-operative Group Ltd [2024] NZSC 5, [2024] 1 NZLR 1
3. Stephen Todd (ed) The Law of Torts in New Zealand (8th ed, Thomson Reuters, Wellington, 2019) at [5.2]
Evidence Act 2006, ss 7-8`;

test("an unpunctuated reading list is four references, not one", () => {
  const parts = splitReferences(READING_LIST);
  assert.equal(parts.length, 4);
  assert.ok(parts[0].startsWith("Bowen v Paramount Builders"));
  assert.ok(parts[1].startsWith("Smith v Fonterra"));
  assert.ok(parts[2].startsWith("Stephen Todd"));
  assert.equal(parts[3], "Evidence Act 2006, ss 7-8");
});

test("no reference in a list takes another's facts", () => {
  const built = splitReferences(READING_LIST).map((text) => {
    const type = guideTypeById[detectTypes(text, 1)[0].typeId];
    return buildCitation(type.id, prefillFromPaste(type, text, [])).text ?? "";
  });
  // Bowen is a 1977 case and must carry no part of Smith's 2024 citation.
  assert.match(built[0], /^Bowen v Paramount Builders \(Hamilton\) Ltd \[1977\] 1 NZLR 394 \(CA\)\.$/);
  assert.ok(!built[0].includes("2024"), `Bowen took Smith's year: ${built[0]}`);
  assert.ok(!built[0].includes("[5.2]"), `Bowen took Todd's pinpoint: ${built[0]}`);
});

test("a heading is not a reference", () => {
  // "Week 4 — Duty of care" has a digit in it, so length alone would keep it.
  assert.ok(!splitReferences(READING_LIST).some((p) => /Duty of care/.test(p)));
});

test("an entry whose marker the student forgot is still its own reference", () => {
  // Two or more marked lines mean the paste IS a list. Without that, the last
  // line here joined the entry above it and the Act was silently lost.
  assert.ok(splitReferences(READING_LIST).includes("Evidence Act 2006, ss 7-8"));
});

test("a citation wrapped across lines by a PDF stays one reference", () => {
  // The sentence-end test still governs where there are no markers, which is
  // what keeps this in one piece.
  assert.deepEqual(
    splitReferences("Taylor v New Zealand Poultry\nBoard [1984] 1 NZLR 394\n(CA) at 398."),
    ["Taylor v New Zealand Poultry Board [1984] 1 NZLR 394 (CA) at 398."],
  );
});

test("a bibliography's section headings are not glued to the references", () => {
  // Copied out of Word these carry no punctuation, so the line below joined them:
  // "Cases Attorney-General v X [2007] NZCA 388." — the heading inside the case
  // name — and "Books and chapters" even displaced the book's author.
  const bibliography = `Cases
Attorney-General v X [2007] NZCA 388.
Bowen v Paramount Builders (Hamilton) Ltd [1977] 1 NZLR 394 (CA).

Legislation
Evidence Act 2006.
Crimes Act 1961, s 167.

Books and chapters
Stephen Todd (ed) The Law of Torts in New Zealand (8th ed, Thomson Reuters, Wellington, 2019).`;
  const parts = splitReferences(bibliography);
  assert.equal(parts.length, 5);
  assert.ok(parts[0].startsWith("Attorney-General v X"), parts[0]);
  assert.ok(parts[2].startsWith("Evidence Act"), parts[2]);
  assert.ok(parts[4].startsWith("Stephen Todd"), parts[4]);
  assert.ok(!parts.some((p) => /^(Cases|Legislation|Books)/.test(p)));
});

test("a wrapped line is not mistaken for a heading", () => {
  // A heading carries no citation signal at all. These two carry theirs — a " v "
  // and a bracket — which is what keeps them attached to what follows.
  assert.equal(splitReferences("Taylor v New Zealand Poultry\nBoard [1984] 1 NZLR 394 (CA) at 398.").length, 1);
  assert.equal(
    splitReferences("Home Office Report of the Royal\nCommission on Capital Punishment 1949–1953 (Cmd 8932, 1953).").length,
    1,
  );
});

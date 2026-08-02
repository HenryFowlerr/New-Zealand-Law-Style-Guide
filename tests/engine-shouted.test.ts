/**
 * Reading a paste that arrived in FULL CAPITALS.
 *
 * A case list out of a judgment database is shouted, and the capitals destroy
 * the very distinction most shape anchors rest on — an abbreviation is Title
 * Case or all caps, a word is neither, and in a shouted paste everything is
 * both. This was 26 of the 34 robustness failures.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { restoreCaseForDetection } from "../src/engine/shouted.ts";
import { prefillFromPaste, buildCitation, detectTypes } from "../src/engine/build.ts";
import { guideTypeById, guideTypes } from "../src/data/styleGuide.ts";
import { referencePrefixLength } from "../src/engine/render.ts";

/** An ordinary paste must never pass through any of this. */
test("a paste that is not shouted is untouched", () => {
  for (const text of [
    "Taylor v New Zealand Poultry Board [1984] 1 NZLR 394 (CA) at 398.",
    "Evidence Act 2006, s 8.",
    "At 535.",
  ]) {
    assert.equal(restoreCaseForDetection(text), text);
  }
});

/** The Guide's own casing wins over ordinary headline case. */
test("the Guide's abbreviations survive case restoration", () => {
  const out = restoreCaseForDetection(
    "TAYLOR V NEW ZEALAND POULTRY BOARD [1984] 1 NZLR 394 (CA) AT 398.",
  );
  assert.match(out, /\bNZLR\b/, "a report series is an abbreviation, not a word");
  assert.match(out, /\(CA\)/, "a court identifier is an abbreviation");
  assert.match(out, /Taylor v New Zealand Poultry Board/);
  // Rule 9.3.1's division markers are lowercase, not headline case.
  assert.match(
    restoreCaseForDetection("ARCTIC WATERS POLLUTION PREVENTION ACT RSC 1985 C A-12, S 15."),
    /RSC 1985 c A-12, s 15/,
  );
});

/**
 * The whole point: a shouted paste reaches the RIGHT TYPE. Every worked example
 * the tool classifies correctly in ordinary case must still classify correctly
 * when shouted.
 */
test("a shouted paste still reaches its own type", () => {
  const wrong: string[] = [];
  let eligible = 0;
  for (const type of guideTypes) {
    for (const ex of type.examples ?? []) {
      const text = ex.correct_citation;
      if (!text?.trim()) continue;
      if (detectTypes(text, 86)[0]?.typeId !== type.id) continue;
      eligible++;
      if (detectTypes(text.toUpperCase(), 86)[0]?.typeId !== type.id) {
        wrong.push(`[${type.rule}] ${text.slice(0, 70)}`);
      }
    }
  }
  assert.ok(eligible > 140, "the eligible set collapsed — check detection");
  assert.ok(
    wrong.length <= 1,
    `${wrong.length}/${eligible} shouted pastes lost their type:\n${wrong.join("\n")}`,
  );
});

/**
 * Rule 3.2 wants the parties' names exactly as printed on the first page of the
 * report, and a shouted paste cannot say what that is — "ANZ" and "Anz" are the
 * same string in capitals. So the citation KEEPS the reader's capitals and the
 * interface asks them to check. Only the ranking and the field split use the
 * restored case.
 */
test("the reader's capitals are kept in the citation, and only the 'v' is not", () => {
  const text = "TAYLOR V NEW ZEALAND POULTRY BOARD [1984] 1 NZLR 394 (CA) AT 398.";
  const fields = prefillFromPaste(guideTypeById["reported-case-nz"], text, []);
  assert.equal(fields.caseName, "TAYLOR v NEW ZEALAND POULTRY BOARD");
  const built = buildCitation("reported-case-nz", fields).text;
  assert.match(built, /TAYLOR v NEW ZEALAND POULTRY BOARD/, "the names stay as pasted");
  assert.doesNotMatch(built, /Taylor/, "a name must never be re-cased for the reader");
});

/**
 * Restoring the case fixes the field SPLIT, which is what the capitals really
 * broke: rule 4.1.3's ordinance had its title's last word repeated as its
 * regnal year — "…ORDINANCE 1841 ORDINANCE 4 VICT 5".
 */
test("a shouted paste splits into the same fields as an ordinary one", () => {
  const type = guideTypeById["nz-pre-1854-ordinance"];
  const plain = prefillFromPaste(type, "Distillation Prohibition Ordinance 1841 4 Vict 5, cl 1.", []);
  const shouted = prefillFromPaste(type, "DISTILLATION PROHIBITION ORDINANCE 1841 4 VICT 5, CL 1.", []);
  for (const id of Object.keys(plain)) {
    assert.equal(
      (shouted[id] ?? "").toLowerCase(),
      (plain[id] ?? "").toLowerCase(),
      `${id} split differently when shouted`,
    );
  }
});

/**
 * Rule 2.3's shortest form is five letters and digits — "At 535." — which sat
 * under the "never eat the whole paste" floor, so a footnote marker in front of
 * it was never stripped and the marker misclassified the citation.
 */
test("a footnote marker is stripped from even the shortest citation", () => {
  for (const text of ["3. At 535.", "See also At 535.", "Week 4: At 535.", "12 At 535."]) {
    const top = detectTypes(text, 86)[0]?.typeId;
    assert.equal(top, "subsequent-references", `${text} was read as ${top}`);
  }
  // And a citation that legitimately BEGINS with a number still keeps it: "16
  // US 610 (1818)" opens with a volume, not a footnote marker.
  assert.equal(referencePrefixLength("16 US 610 (1818) at 631."), 0);
  assert.equal(referencePrefixLength("546 F Supp 114 (SD NY 1982) at 117."), 0);
});

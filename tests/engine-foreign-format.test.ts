/**
 * Reading a reference written in some other citation style.
 *
 * The whole module is a rewrite applied BEFORE detection and extraction, so its
 * danger is not that it fails to fire — it is that it fires when it should not
 * and destroys a paste that was already correct. Most of what follows guards
 * that direction.
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  normaliseForeignFormat,
  apaAuthorsToGuide,
  toHeadlineCase,
} from "../src/engine/foreignFormat.ts";
import { prefillFromPaste, buildCitation, detectTypes } from "../src/engine/build.ts";
import { guideTypeById, guideTypes } from "../src/data/styleGuide.ts";
import { FOREIGN_FORMAT } from "./fixtures/foreign-format.ts";

/**
 * The floor that matters most: a paste already in the Guide's shape must come
 * through this untouched. Every one of the Guide's own worked examples is a
 * paste a student could reasonably make, so all 216 are the test.
 */
test("no Guide citation is rewritten by the foreign-format pass", () => {
  const rewritten: string[] = [];
  for (const type of guideTypes) {
    for (const ex of type.examples ?? []) {
      const text = ex.correct_citation;
      if (!text?.trim()) continue;
      const result = normaliseForeignFormat(text);
      if (result.style) rewritten.push(`[${type.rule}] ${result.style}: ${text}`);
    }
  }
  assert.deepEqual(
    rewritten,
    [],
    `the pre-pass claimed a Guide citation was written in another style:\n${rewritten.join("\n")}`,
  );
});

/**
 * Rule 3.2.8 lets a range be typed with spaces around its dash, and a spaced
 * hyphen was briefly taken as a database listing's column separator — which
 * split the pinpoint off and silently halved the pin cite.
 */
test("a spaced hyphen in a pinpoint range is not a column separator", () => {
  const text = "Taylor v New Zealand Poultry Board [1984] 1 NZLR 394 (CA) at 398 - 401";
  assert.equal(normaliseForeignFormat(text).style, null);
  const fields = prefillFromPaste(guideTypeById["reported-case-nz"], text, []);
  assert.equal(fields.pinpoint, "398–401");
});

/**
 * Rule 3.5 separates a Māori Land Court case name from its block with a dash,
 * and a student types it as a hyphen. That is the rule's own punctuation, not a
 * database's furniture.
 */
test("rule 3.5's block-name dash is not a column separator", () => {
  const text =
    "Faulkner v Hoete - Motiti North C No 1 [2018] Māori Appellate Court MB 17 (2018 APPEAL 17).";
  assert.equal(normaliseForeignFormat(text).style, null);
  const fields = prefillFromPaste(guideTypeById["maori-land-court"], text, []);
  assert.equal(fields.caseName, "Faulkner v Hoete");
  assert.equal(fields.blockName, "Motiti North C No 1");
});

/** Rule 6.1.2: two or three authors join with "and", four or more cut to "and others". */
test("an APA author list is rewritten the way rule 6.1.2 counts", () => {
  assert.equal(apaAuthorsToGuide("Carter, R."), "R Carter");
  assert.equal(apaAuthorsToGuide("Butler, A., & Butler, P."), "A Butler and P Butler");
  assert.equal(
    apaAuthorsToGuide("Cooke, R., Finn, P., & Palmer, J."),
    "R Cooke and P Finn and J Palmer",
  );
  assert.equal(
    apaAuthorsToGuide("Mahoney, R., McDonald, E., Optican, S., & Tinsley, Y."),
    "R Mahoney and others",
  );
  // Rule 6.1.2 again: initials are not separated by spaces.
  assert.equal(apaAuthorsToGuide("Burrows, J. F."), "JF Burrows");
  // A name already in the Guide's order is not an APA list and must not match.
  assert.equal(apaAuthorsToGuide("Ross Carter"), null);
  assert.equal(apaAuthorsToGuide("Andrew Butler and Petra Butler"), null);
});

/**
 * A given name the paste does not contain must never be invented. This is the
 * single rule the module exists under: a plausible wrong name is indetectable
 * in a finished essay.
 */
test("an initialised given name is never expanded to a full one", () => {
  const out = normaliseForeignFormat(
    "Carter, R. (2015). Burrows and Carter statute law in New Zealand (5th ed.). Wellington, New Zealand: LexisNexis.",
  );
  assert.match(out.text, /^R Carter\b/);
  assert.doesNotMatch(out.text, /Ross/);
  assert.ok(
    out.lossy.some((l) => /given name/.test(l)),
    "the reader must be told the given name is missing",
  );
});

/** A word the source capitalised is the source's styling, and survives. */
test("headline case never flattens a capital the source chose", () => {
  assert.equal(
    toHeadlineCase("the law of restitution in New Zealand"),
    "The Law of Restitution in New Zealand",
  );
  assert.equal(toHeadlineCase("a commentary on the NZ Bill of Rights"), "A Commentary on the NZ Bill of Rights");
  // The word after a subtitle colon opens a new clause.
  assert.equal(toHeadlineCase("at the cutting edge: issues in reporting"), "At the Cutting Edge: Issues in Reporting");
  // LexisNexis, McDonald, iPredict — inner capitals are left exactly as given.
  assert.equal(toHeadlineCase("published by LexisNexis"), "Published by LexisNexis");
});

/** Every fixture case must reach the citation its paste honestly supports. */
test("every foreign-format fixture builds the citation its paste supports", () => {
  const bad: string[] = [];
  for (const c of FOREIGN_FORMAT) {
    const fields = prefillFromPaste(guideTypeById[c.typeId], c.paste, []);
    const got = (buildCitation(c.typeId, fields).text ?? "").replace(/\s+/g, " ").trim();
    if (got !== c.want.replace(/\s+/g, " ").trim()) {
      bad.push(`[${c.style}]\n    got  ${got}\n    want ${c.want}`);
    }
  }
  assert.deepEqual(bad, [], `foreign-format output changed:\n${bad.join("\n")}`);
});

/**
 * A floor rather than a ceiling: PICK is the weakest layer everywhere, and one
 * fixture — a book TITLED after an Act, "The Evidence Act 2006: Act &
 * Analysis" — is genuinely ambiguous against the statute rule. The floor is set
 * below today's number so an improvement never has to edit the test, and a
 * regression still fails it.
 */
test("a foreign-format paste ranks its own type first", () => {
  const first = FOREIGN_FORMAT.filter(
    (c) => detectTypes(c.paste, 86)[0]?.typeId === c.typeId,
  ).length;
  assert.ok(
    first >= 11,
    `only ${first}/${FOREIGN_FORMAT.length} foreign-format pastes ranked their type first`,
  );
});

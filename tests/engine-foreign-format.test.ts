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
import {
  prefillFromPaste,
  buildCitation,
  detectTypes,
  missingRequiredComponents,
} from "../src/engine/build.ts";
import { guideTypeById, guideTypes } from "../src/data/styleGuide.ts";
import { FOREIGN_FORMAT } from "./fixtures/foreign-format.ts";
import { looksLikeLink } from "../src/engine/linkResolve.ts";

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

/**
 * Every fixture case must reach the citation its paste honestly supports — or,
 * where the format omits something the Guide requires, must refuse and ask for
 * exactly that. Refusing is the correct answer, not a shortfall.
 */
test("every foreign-format fixture builds the citation its paste supports", () => {
  const bad: string[] = [];
  for (const c of FOREIGN_FORMAT) {
    const fields = prefillFromPaste(guideTypeById[c.typeId], c.paste, []);
    const got = (buildCitation(c.typeId, fields).text ?? "").replace(/\s+/g, " ").trim();
    if (c.want) {
      if (got !== c.want.replace(/\s+/g, " ").trim()) {
        bad.push(`[${c.style}]\n    got  ${got}\n    want ${c.want}`);
      }
      continue;
    }
    const missing = missingRequiredComponents(guideTypeById[c.typeId], fields).map((m) => m.id);
    if (got) bad.push(`[${c.style}] built a citation from a format that omits ${c.mustAsk?.join(", ")}: ${got}`);
    for (const id of c.mustAsk ?? []) {
      if (!missing.includes(id)) bad.push(`[${c.style}] did not ask for ${id}`);
    }
  }
  assert.deepEqual(bad, [], `foreign-format output changed:\n${bad.join("\n")}`);
});

/**
 * A floor rather than a ceiling: PICK is the weakest layer everywhere, and the
 * three that miss are all genuine ambiguity rather than defects — a book TITLED
 * after an Act ("The Evidence Act 2006: Act & Analysis") against the statute
 * rule, and two whose format dropped the place of publication, leaving a
 * three-part publication bracket that rule 6.3's looseleaf template fits more
 * tightly than rule 6.1's four-part one. All three rank the right type SECOND,
 * where the reader is choosing from a visible list anyway.
 *
 * The floor sits below today's number so an improvement never has to edit the
 * test, and a regression still fails it.
 */
test("a foreign-format paste ranks its own type first", () => {
  const first = FOREIGN_FORMAT.filter(
    (c) => detectTypes(c.paste, 86)[0]?.typeId === c.typeId,
  ).length;
  assert.ok(
    first >= 15,
    `only ${first}/${FOREIGN_FORMAT.length} foreign-format pastes ranked their type first`,
  );
});

/**
 * Where the type is not ranked first it must still be within reach, because the
 * reader picks from the visible list. Nothing may fall out of it entirely.
 */
test("every foreign-format paste offers its type in the visible top six", () => {
  const missed = FOREIGN_FORMAT.filter((c) => {
    const rank = detectTypes(c.paste, 86).findIndex((d) => d.typeId === c.typeId);
    return rank < 0 || rank >= 6;
  }).map((c) => `${c.style}: ${c.typeId}`);
  assert.deepEqual(missed, [], `not offered in the visible list:\n${missed.join("\n")}`);
});

/**
 * A reference is not a link just because it ends in one.
 *
 * Zotero puts a DOI on the end of almost every APA 7 reference, and a DOI
 * matched ANYWHERE sent the whole paste to link lookup — so the commonest real
 * paste there is was never type-detected at all. A bare identifier is still a
 * link; a reference carrying one is a reference.
 */
test("a reference ending in a DOI is read as a reference, not a link", () => {
  const bare = [
    "https://doi.org/10.1000/xyz123",
    "10.1017/S0008197300000000",
    "doi:10.1017/S0008197300000000",
    "ISBN 978-0-19-957977-6",
  ];
  for (const text of bare) {
    assert.equal(looksLikeLink(text), true, `${text} is a link`);
  }
  const references = [
    "Carter, R. (2015). Burrows and Carter statute law in New Zealand (5th ed.). LexisNexis. https://doi.org/10.1000/x",
    "Mathews, B. (2004). Title. Journal, 9(2), 3-18. https://doi.org/10.1017/S0008197300000000",
  ];
  for (const text of references) {
    assert.equal(looksLikeLink(text), false, `${text} is a reference`);
    // And it must still reach its type.
    assert.ok(detectTypes(text, 86).length > 0, "no type was offered at all");
  }
});

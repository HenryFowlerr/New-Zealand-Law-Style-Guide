/**
 * Regression net over citations read off the PUBLISHED Style Guide rather than
 * our ingested copy of it (tests/fixtures/guide-corpus.ts).
 *
 * Sixty of these were absent from our data entirely, so nothing in the suite
 * had ever exercised them. The per-type assertions below cover the formats a
 * New Zealand law student actually cites, and must stay perfect; the corpus
 * total guards everything else against slipping backwards.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { buildCitation, prefillFromPaste } from "../src/engine/build.ts";
import { guideTypeById } from "../src/data/styleGuide.ts";
import { GUIDE_CORPUS } from "./fixtures/guide-corpus.ts";

const rebuild = (typeId: string, text: string): string => {
  const type = guideTypeById[typeId];
  return buildCitation(type.id, prefillFromPaste(type, text, [])).text ?? "";
};

/** Formats a student essay leans on. These must reproduce exactly, every one. */
const MUST_BE_PERFECT = [
  "neutral-citation-case-nz",
  "unreported-case-file-number-nz",
  "legislative-instrument",
  "court-rules",
  "treaty-of-waitangi",
  "nz-provincial-legislation",
  "nz-pre-1854-ordinance",
  "essay-in-edited-book",
  "internet-material",
  "law-commission-report",
  "subsequent-references",
  "maori-land-court",
];

for (const typeId of MUST_BE_PERFECT) {
  const entries = GUIDE_CORPUS.filter((c) => c.typeId === typeId);
  test(`${typeId}: every Guide example rebuilds exactly (${entries.length})`, () => {
    assert.ok(entries.length > 0, `no corpus entries for ${typeId}`);
    for (const entry of entries) {
      assert.equal(rebuild(entry.typeId, entry.text), entry.text, `rule ${entry.rule}`);
    }
  });
}

/**
 * Whole-corpus floor. Raise this as defects are fixed; it must never fall.
 * Recorded when the published Guide was first audited against the engine.
 */
const BASELINE_EXACT = 128;

test("the published Guide corpus does not regress", () => {
  const exact = GUIDE_CORPUS.filter((c) => rebuild(c.typeId, c.text) === c.text).length;
  assert.ok(
    exact >= BASELINE_EXACT,
    `${exact}/${GUIDE_CORPUS.length} exact, below the recorded floor of ${BASELINE_EXACT}`,
  );
});

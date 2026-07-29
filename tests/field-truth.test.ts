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

/**
 * Accuracy gate for the data-driven engine. For every worked example in the
 * Style Guide we parse the example back into component values using its
 * template, render those values, and require the result to equal the example.
 *
 * A pass proves the template + renderer reproduce the Guide's own example
 * exactly. This asserts a regression floor so the score can only climb as more
 * types are refined.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { guideTypes } from "../src/data/styleGuide.ts";
import {
  extractByTemplate,
  renderFromTemplate,
  tokensToText,
} from "../src/engine/render.ts";

const norm = (s: string) => s.trim().replace(/\.$/, "").replace(/\s+/g, " ");

let pass = 0;
let matched = 0;
let total = 0;
const renderMismatches: string[] = [];

for (const type of guideTypes) {
  for (const example of type.examples) {
    total += 1;
    const values = extractByTemplate(type, example.correct_citation);
    if (!values) continue;
    matched += 1;
    const rendered = tokensToText(renderFromTemplate(type.outputTemplate, values));
    if (norm(rendered) === norm(example.correct_citation)) pass += 1;
    else renderMismatches.push(`${type.id}: ${rendered}`);
  }
}

test("the engine reproduces the Style Guide's own worked examples", () => {
  // Regression floors. Raise these as coverage improves; never lower them.
  assert.ok(total >= 216, `expected >=216 examples, saw ${total}`);
  assert.ok(matched >= 205, `template match regressed: ${matched}/${total}`);
  assert.ok(pass >= 205, `exact reproduction regressed: ${pass}/${total}`);
});

test("of the examples the extractor can parse, almost all render exactly", () => {
  // The renderer is near-perfect on clean inputs. The remaining mismatches are
  // hard template-modelling cases in complex/rare formats: the treaty
  // "signed"/"opened for signature" variant, nominate-report parallel
  // citations, US session laws, and the "above n"/"pt" word-separators that a
  // static template cannot elide. Tightened as those templates are reworked.
  assert.ok(
    renderMismatches.length <= 1,
    `render mismatches grew to ${renderMismatches.length}:\n${renderMismatches.join("\n")}`,
  );
});

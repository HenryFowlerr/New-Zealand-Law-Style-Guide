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
  templateForms,
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
    // A type may offer several forms; the citation is reproduced if any renders it.
    const rendered = templateForms(type.outputTemplate).map((form) =>
      tokensToText(renderFromTemplate(form, values)),
    );
    if (rendered.some((r) => norm(r) === norm(example.correct_citation))) pass += 1;
    else renderMismatches.push(`${type.id}: ${rendered[0]}`);
  }
}

test("the engine reproduces the Style Guide's own worked examples", () => {
  // Regression floors. Raise these as coverage improves; never lower them.
  // The engine reproduces every one of the Guide's worked examples exactly.
  assert.ok(total >= 216, `expected >=216 examples, saw ${total}`);
  assert.ok(matched >= 216, `template match regressed: ${matched}/${total}`);
  assert.ok(pass >= 216, `exact reproduction regressed: ${pass}/${total}`);
});

test("of the examples the extractor can parse, almost all render exactly", () => {
  // Every example the extractor parses now also renders exactly — zero
  // mismatches. Documented structural variants (a paper cited with only a
  // date, a conference paper appearing "in" a collection, the Canadian
  // Charter's constitutional form) are carried as alternate template forms.
  assert.ok(
    renderMismatches.length <= 0,
    `render mismatches grew to ${renderMismatches.length}:\n${renderMismatches.join("\n")}`,
  );
});

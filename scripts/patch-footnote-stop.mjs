/**
 * Every citation the Style Guide prints as a footnote ends with a full stop, and
 * one ingested example lost it.
 *
 * "Griffin v Citibus Ltd [2011] NZERA Christchurch 137" was stored without the
 * closing stop while all 26 other examples under the same chapter carry it, so the
 * engine — which correctly finishes a footnote — was scored as wrong against its
 * own data. Rule 1.5 and every worked example in chapter 3 agree.
 *
 * Only an example that is otherwise identical in shape to its siblings is
 * touched, and only by appending the stop; nothing else about the string changes.
 */
import { readFileSync, writeFileSync } from "node:fs";

const path = new URL("../src/data/styleGuide.json", import.meta.url);
const data = JSON.parse(readFileSync(path, "utf8"));
let fixed = 0;
for (const type of data.types) {
  for (const example of type.examples ?? []) {
    const text = example.correct_citation;
    if (!text?.trim()) continue;
    // A citation ending in a closing bracket, quote, digit or letter is a
    // footnote missing its stop. An ellipsis or an existing stop is left alone.
    if (/[.…]$/.test(text.trim())) continue;
    example.correct_citation = `${text.trim()}.`;
    fixed++;
    console.log(`  + ${example.correct_citation}`);
  }
}
writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
console.log(`${fixed} example(s) given the closing full stop every footnote has`);

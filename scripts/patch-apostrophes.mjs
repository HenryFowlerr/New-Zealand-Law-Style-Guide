/**
 * Two ingested examples carry a straight apostrophe where the Guide prints a
 * curly one, and the engine was being scored as wrong for getting it right.
 *
 * The Guide is typeset, and fifteen of our own examples already carry "’":
 * "Halsbury’s Laws of England", "Jacobs’ Law of Trusts", "Birks’ Unjust
 * Enrichment", "Baigent’s case". Exactly two do not —
 *
 *   [3.5]   … [2017] Chief Judge's MB 144 (2017 CJ 144).
 *   [3.7.1] … The New Zealand Spectator and Cook's Straits Guardian …
 *
 * — and both are the same character, in the same position, in an otherwise
 * identical set. That is an ingestion artefact, not two exceptions to the Guide's
 * own typography.
 *
 * `normalizeQuotes` in the engine converts a pasted straight apostrophe to the
 * curly form, which is right: a student typing on a keyboard produces "'", and
 * the citation must print "’". These two examples made that correct behaviour
 * look like a defect in the paste sweep.
 *
 * Only an apostrophe INSIDE a word is touched — a possessive or an elision —
 * never a quotation mark, which has its own rules.
 */
import { readFileSync, writeFileSync } from "node:fs";

const path = new URL("../src/data/styleGuide.json", import.meta.url);
const data = JSON.parse(readFileSync(path, "utf8"));
let fixed = 0;
for (const type of data.types) {
  for (const example of type.examples ?? []) {
    const before = example.correct_citation;
    if (!before) continue;
    const after = before.replace(/(\p{L})'(?=\p{L}|\s)/gu, "$1’");
    if (after === before) continue;
    example.correct_citation = after;
    fixed++;
    console.log(`  ${type.rule}  ${after.slice(0, 96)}`);
  }
}
writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
console.log(`${fixed} example(s) given the apostrophe the Guide prints`);

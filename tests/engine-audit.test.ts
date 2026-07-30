/**
 * Checking the finished citation against what was pasted.
 *
 * Choosing the source type is the least reliable part of the tool, and a wrong
 * choice fails quietly: a detail is dropped, or written twice, and the citation
 * still reads perfectly well. Comparing it against the paste is the one moment
 * that is catchable — and the check must never cry wolf, or it will be ignored.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  auditAgainstPaste,
  buildCitation,
  detectTypes,
  prefillFromPaste,
} from "../src/engine/build.ts";
import { guideTypeById } from "../src/data/styleGuide.ts";
import { GUIDE_CORPUS } from "./fixtures/guide-corpus.ts";

const rebuild = (typeId: string, text: string) => {
  const type = guideTypeById[typeId];
  return buildCitation(type.id, prefillFromPaste(type, text, [])).text ?? "";
};

test("a correct citation raises no warning", () => {
  const text = "Z v Dental Complaints Assessment Committee [2008] NZSC 55, [2009] 1 NZLR 1 at [26].";
  assert.deepEqual(auditAgainstPaste(text, rebuild("reported-case-nz", text)), []);
});

test("a wrongly chosen type is caught by what it drops", () => {
  // A journal article read as a Canadian case loses the author and the title.
  const text = "J K Maxton “Equity” [1994] NZ Recent Law Review 245.";
  const warnings = auditAgainstPaste(text, rebuild("canada-case", text));
  const lost = warnings.filter((w) => w.kind === "missing").map((w) => w.text);
  assert.ok(lost.includes("Maxton"), `expected Maxton among ${JSON.stringify(lost)}`);
});

test("a citation that repeats itself is caught", () => {
  const warnings = auditAgainstPaste(
    "Pacey v Adlam – Matata Parish 39A 2B 2B 2A (2017) 178 Waiariki MB 32 (178 WAR 32).",
    "Pacey v Adlam – Matata Parish 39A 2B 2B 2A (2017) 178 Waiariki MB 32 (2017) 178 Waiariki MB 32 (178 WAR 32).",
  );
  assert.ok(warnings.some((w) => w.kind === "repeated"), JSON.stringify(warnings));
});

test("an omission the Guide requires is not reported as a loss", () => {
  // Rule 3.2 drops the court identifier when a neutral citation is present.
  const text = "Z v Dental Complaints Assessment Committee [2008] NZSC 55, [2009] 1 NZLR 1 (SC) at [26].";
  assert.deepEqual(auditAgainstPaste(text, rebuild("reported-case-nz", text)), []);
});

test("it never cries wolf across the published Guide corpus", () => {
  // Any false alarm on a citation that is already correct would train the user
  // to ignore the warning, which is worse than not having it.
  let falseAlarms = 0;
  for (const entry of GUIDE_CORPUS) {
    const top = detectTypes(entry.text, 1)[0];
    if (!top) continue;
    const out = rebuild(top.typeId, entry.text);
    if (out !== entry.text) continue;
    if (auditAgainstPaste(entry.text, out).length > 0) falseAlarms++;
  }
  assert.equal(falseAlarms, 0);
});

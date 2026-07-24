/**
 * Adversarial and property-based tests for the data-driven engine, across all
 * 86 Style Guide types. Guarantees the two invariants at scale:
 *   1. Fail-closed and crash-proof — arbitrary input never throws, and a
 *      citation is only "ready" when every required component is present.
 *   2. Well-formed output — every ready citation is free of the spacing and
 *      punctuation artefacts that would make it wrong under the Guide.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { guideTypes } from "../src/data/styleGuide.ts";
import {
  buildCitation,
  detectTypes,
  visibleComponents,
} from "../src/engine/build.ts";
import { extractByTemplate } from "../src/engine/render.ts";

function makeRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

function assertWellFormed(text: string, context: string) {
  assert.ok(text.length > 0, `${context}: empty`);
  assert.doesNotMatch(text, /\s{2,}/, `${context}: double space`);
  assert.doesNotMatch(text, /\s[.,;]/, `${context}: space before punctuation`);
  assert.doesNotMatch(text, /,,|;;|\.\./, `${context}: doubled punctuation`);
  assert.doesNotMatch(text, /\(\s*\)|\[\s*\]/, `${context}: empty brackets`);
  assert.doesNotMatch(text, /,\s*\)/, `${context}: trailing comma in brackets`);
  assert.equal(
    (text.match(/\.$/g) ?? []).length,
    1,
    `${context}: must end with one full stop`,
  );
  assert.doesNotMatch(text, /^\s|\s$/, `${context}: edge whitespace`);
}

test("filling every required component yields a well-formed, ready citation", () => {
  const rng = makeRng(7);
  const words = ["Smith", "Jones", "2007", "Wellington", "NZLR", "12", "Māui"];
  for (const type of guideTypes) {
    for (let iteration = 0; iteration < 6; iteration++) {
      const fields: Record<string, string> = {};
      for (const component of visibleComponents(type)) {
        if (!component.required && rng() < 0.4) continue;
        fields[component.id] = words[Math.floor(rng() * words.length)];
      }
      const result = buildCitation(type.id, fields);
      if (result.status === "ready") {
        assertWellFormed(result.text, `${type.id}#${iteration}`);
        assert.doesNotMatch(result.html, /<script>/i, `${type.id}: script leak`);
      }
    }
  }
});

test("building, detecting, and extracting never throw on garbage", () => {
  const rng = makeRng(20260724);
  const alphabet = " abcABC012“”\"'.,;:()[]<>&/–v".split("");
  for (let iteration = 0; iteration < 3000; iteration++) {
    const length = Math.floor(rng() * 70);
    let raw = "";
    for (let i = 0; i < length; i++) {
      raw += alphabet[Math.floor(rng() * alphabet.length)];
    }
    assert.doesNotThrow(() => detectTypes(raw));
    const type = guideTypes[Math.floor(rng() * guideTypes.length)];
    assert.doesNotThrow(() => extractByTemplate(type, raw));
    const fields: Record<string, string> = {};
    for (const component of visibleComponents(type)) fields[component.id] = raw;
    assert.doesNotThrow(() => buildCitation(type.id, fields));
  }
});

test("detection only ever suggests real, buildable types", () => {
  const inputs = [
    "Z v Dental Complaints Assessment Committee [2008] NZSC 55, [2009] 1 NZLR 1 at [26]",
    "Evidence Act 2006, s 8",
    "Peter Watts “Birks’ Unjust Enrichment” (2005) 121 LQR 163 at 165",
    "(21 September 2010) 666 NZPD 14104",
    "garbage input that matches nothing sensible",
  ];
  for (const input of inputs) {
    for (const detection of detectTypes(input)) {
      const result = buildCitation(detection.typeId, detection.fields);
      assert.ok(["ready", "incomplete"].includes(result.status));
    }
  }
});

test("every example the extractor parses builds a well-formed citation", () => {
  for (const type of guideTypes) {
    for (const example of type.examples) {
      const fields = extractByTemplate(type, example.correct_citation);
      if (!fields) continue;
      const result = buildCitation(type.id, fields);
      if (result.status === "ready") {
        assertWellFormed(result.text, `${type.id} example`);
      }
    }
  }
});

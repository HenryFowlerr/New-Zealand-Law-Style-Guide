/**
 * Fit the detection weights against the Style Guide's own worked examples.
 *
 * Detection ranks 86 templates against a paste. The weights that balance its
 * evidence were originally hand-tuned, which is guesswork: raising one weight
 * to rescue statutes quietly broke cases. The Guide ships 216 worked examples
 * with known types, so the balance can simply be measured instead.
 *
 * Features are computed once (the expensive part), then coordinate ascent with
 * random restarts maximises top-1 accuracy over the corpus. Run with:
 *
 *   npx tsx scripts/fit-detection.ts
 */
import {
  DETECTION_WEIGHTS,
  detectionCandidates,
  scoreFeatures,
  type DetectionFeatures,
} from "../src/engine/build";
import { guideTypes } from "../src/data/styleGuide";

type Case = {
  correctTypeId: string;
  holdout: boolean;
  candidates: { typeId: string; features: DetectionFeatures }[];
};

/** Held-out split: every third example of each type is never fitted on. */
const isHoldout = (index: number) => index % 3 === 2;

/**
 * How a reference actually arrives in the box. The Guide prints each example as
 * a finished footnote, but students paste out of a case list, a reading list or
 * a lecture slide, and the trailing full stop is usually not there. Fitting on
 * the printed form alone produced weights that ranked the four commonest
 * citations in New Zealand law — a reported case, a journal article, a statute —
 * below obscure types, because nothing in the corpus ever looked like a paste.
 */
const PASTE_FORMS: ((s: string) => string)[] = [
  (s) => s,
  (s) => s.replace(/\.\s*$/, ""),
];

console.log("Computing features over the Guide's worked examples…");
const cases: Case[] = [];
for (const type of guideTypes) {
  (type.examples ?? []).forEach((ex, index) => {
    if (!ex.correct_citation?.trim()) return;
    const seen = new Set<string>();
    for (const form of PASTE_FORMS) {
      const text = form(ex.correct_citation);
      if (seen.has(text)) continue;
      seen.add(text);
      const candidates = detectionCandidates(text).map((c) => ({
        typeId: c.typeId,
        features: c.features,
      }));
      if (!candidates.length) continue;
      cases.push({
        correctTypeId: type.id,
        holdout: isHoldout(index),
        candidates,
      });
    }
  });
}
console.log(`  ${cases.length} examples, ${cases.reduce((n, c) => n + c.candidates.length, 0)} candidate matches\n`);

const KEYS = Object.keys(DETECTION_WEIGHTS) as (keyof DetectionFeatures)[];

/**
 * Each weight's permitted sign.
 *
 * An unconstrained search happily returns a NEGATIVE weight for required-field
 * coverage and a POSITIVE one for an editor mismatch, because those quirks buy
 * a few more of the Guide's own examples. They are nonsense as evidence, and a
 * model that has learned nonsense will not survive contact with the pastes real
 * students bring — which is the case that actually matters and which this
 * corpus does not contain. So the search may choose the magnitude of each
 * signal, never its meaning.
 */
const SIGNS: Record<keyof DetectionFeatures, 1 | -1> = {
  requiredCoverage: 1,
  requiredMissing: -1,
  captured: 1,
  refit: 1,
  literalHits: 1,
  shapeSupport: 1,
  shapeViolations: -1,
  missingHome: -1,
  quotedTitleMismatch: -1,
  editorMismatch: -1,
  jurisdictionConflict: -1,
};

/** Top-1 accuracy, with mean margin as a smooth tie-breaker for the search. */
function evaluate(
  weights: Record<keyof DetectionFeatures, number>,
  subset: Case[] = cases,
): { top1: number; total: number; top6: number; margin: number } {
  let top1 = 0;
  let top6 = 0;
  let margin = 0;
  for (const c of subset) {
    let bestScore = -Infinity;
    let bestId = "";
    let correctScore = -Infinity;
    let better = 0;
    for (const cand of c.candidates) {
      const s = scoreFeatures(cand.features, weights);
      if (cand.typeId === c.correctTypeId) correctScore = s;
      if (s > bestScore) {
        bestScore = s;
        bestId = cand.typeId;
      }
    }
    for (const cand of c.candidates) {
      if (cand.typeId === c.correctTypeId) continue;
      if (scoreFeatures(cand.features, weights) > correctScore) better++;
    }
    if (bestId === c.correctTypeId) top1++;
    if (better < 6) top6++;
    if (Number.isFinite(correctScore)) {
      margin += Math.max(-500, Math.min(500, correctScore - bestScore));
    }
  }
  return { top1, total: subset.length, top6, margin: margin / (subset.length || 1) };
}

const trainCases = cases.filter((c) => !c.holdout);
const holdoutCases = cases.filter((c) => c.holdout);


function fitness(w: Record<keyof DetectionFeatures, number>): number {
  const e = evaluate(w, trainCases);
  return e.top1 * 10000 + e.top6 * 100 + e.margin;
}

const MAGNITUDES = [
  0, 1, 10, 30, 60, 100, 150, 200, 250, 300, 400, 500, 600, 700, 900, 1200, 1600,
];
const gridFor = (k: keyof DetectionFeatures) =>
  MAGNITUDES.map((m) => m * SIGNS[k]);

function coordinateAscent(
  start: Record<keyof DetectionFeatures, number>,
): Record<keyof DetectionFeatures, number> {
  let current = { ...start };
  let best = fitness(current);
  for (let pass = 0; pass < 8; pass++) {
    let improved = false;
    for (const k of KEYS) {
      const original = current[k];
      let bestValue = original;
      for (const v of gridFor(k)) {
        current[k] = v;
        const f = fitness(current);
        if (f > best) {
          best = f;
          bestValue = v;
          improved = true;
        }
      }
      current[k] = bestValue;
    }
    if (!improved) break;
  }
  return current;
}

const baseline = evaluate(DETECTION_WEIGHTS);
const baseHold = evaluate(DETECTION_WEIGHTS, holdoutCases);
console.log(`train ${trainCases.length} / holdout ${holdoutCases.length}`);
console.log(`baseline (hand-tuned): all=${baseline.top1}/${cases.length}  holdout=${baseHold.top1}/${holdoutCases.length}`);

let bestWeights = { ...DETECTION_WEIGHTS };
let bestFit = fitness(bestWeights);

// Deterministic restarts: the hand-tuned point, all-zero, and a few spreads.
const spread = (m: number) =>
  Object.fromEntries(KEYS.map((k) => [k, m * SIGNS[k]])) as Record<
    keyof DetectionFeatures,
    number
  >;
const starts: Record<keyof DetectionFeatures, number>[] = [
  { ...DETECTION_WEIGHTS },
  spread(0),
  spread(100),
  spread(300),
  spread(600),
];

for (const [i, start] of starts.entries()) {
  const fitted = coordinateAscent(start);
  const f = fitness(fitted);
  const e = evaluate(fitted, trainCases);
  const h = evaluate(fitted, holdoutCases);
  console.log(`  restart ${i}: train=${e.top1}/${trainCases.length}  holdout=${h.top1}/${holdoutCases.length}`);
  if (f > bestFit) {
    bestFit = f;
    bestWeights = fitted;
  }
}

const final = evaluate(bestWeights);
const finalTrain = evaluate(bestWeights, trainCases);
const finalHold = evaluate(bestWeights, holdoutCases);
console.log(`\nbest: all=${final.top1}/${cases.length} (${((final.top1 / cases.length) * 100).toFixed(1)}%)`);
console.log(`      train=${finalTrain.top1}/${trainCases.length} (${((finalTrain.top1 / trainCases.length) * 100).toFixed(1)}%)  holdout=${finalHold.top1}/${holdoutCases.length} (${((finalHold.top1 / holdoutCases.length) * 100).toFixed(1)}%)`);
console.log(`      top6(all)=${final.top6}/${cases.length}`);
console.log("\nexport const DETECTION_WEIGHTS: Record<keyof DetectionFeatures, number> = {");
for (const k of KEYS) console.log(`  ${k}: ${bestWeights[k]},`);
console.log("};");

/**
 * Full-corpus QA sweep.
 *
 * Grounded in the Style Guide's own 216 worked examples, so every "expected"
 * answer comes from the Guide itself — nothing is invented here.
 *
 * Three layers, in the order a user actually hits them:
 *   A. CLASSIFY  — paste the example; is the right source type ranked first?
 *   B. EXTRACT   — do the fields come back placed correctly (no data dropped)?
 *   C. OUTPUT    — does building from those fields reproduce the example exactly?
 *   D. ROBUST    — realistic perturbations that must not change the output.
 *   E. FIXPOINT  — re-pasting the tool's own output must be stable.
 */
import {
  detectTypes,
  prefillFromPaste,
  buildCitation,
  missingRequiredComponents,
} from "../src/engine/build";
import { guideTypes, guideTypeById } from "../src/data/styleGuide";

const norm = (s: string) => s.replace(/\s+/g, " ").trim();

type Row = {
  typeId: string;
  typeName: string;
  group: string;
  rule: string;
  example: string;
  /** rank of the correct type in detection, -1 = absent */
  rank: number;
  topTypeId: string;
  missing: string[];
  built: string;
  outputExact: boolean;
  fields: Record<string, string>;
};

const rows: Row[] = [];

for (const type of guideTypes) {
  for (const ex of type.examples ?? []) {
    const text = ex.correct_citation;
    if (!text || !text.trim()) continue;

    const dets = detectTypes(text, 86);
    const rank = dets.findIndex((d) => d.typeId === type.id);
    const fields = prefillFromPaste(type, text, []);
    const missing = missingRequiredComponents(type, fields).map((c) => c.id);
    const built = buildCitation(type.id, fields);
    const out = built.text ?? "";

    rows.push({
      typeId: type.id,
      typeName: type.name,
      group: type.group,
      rule: type.rule,
      example: text,
      rank,
      topTypeId: dets[0]?.typeId ?? "(none)",
      missing,
      built: out,
      outputExact: norm(out) === norm(text),
      fields,
    });
  }
}

// ---------------------------------------------------------------- A. CLASSIFY
const misclassified = rows.filter((r) => r.rank !== 0);
const notInTop6 = rows.filter((r) => r.rank === -1 || r.rank > 5);

// ----------------------------------------------------------------- B. EXTRACT
const incomplete = rows.filter((r) => r.missing.length > 0);

// ------------------------------------------------------------------ C. OUTPUT
const wrongOutput = rows.filter((r) => !r.outputExact);

console.log("=".repeat(78));
console.log("A. CLASSIFICATION — pasting the Guide's own example for each type");
console.log("=".repeat(78));
console.log(
  `  ${rows.length - misclassified.length}/${rows.length} ranked the correct type FIRST ` +
    `(${(((rows.length - misclassified.length) / rows.length) * 100).toFixed(1)}%)`,
);
console.log(
  `  ${rows.length - notInTop6.length}/${rows.length} had the correct type in the visible top 6`,
);

const byWrongTop = new Map<string, Row[]>();
for (const r of misclassified) {
  const k = r.topTypeId;
  byWrongTop.set(k, [...(byWrongTop.get(k) ?? []), r]);
}
console.log(`\n  Types that wrongly win the top slot (the "magnet" types):`);
for (const [id, rs] of [...byWrongTop.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 12)) {
  const nm = guideTypeById[id]?.name ?? id;
  console.log(`    ${String(rs.length).padStart(3)}×  ${nm}`);
}

console.log(`\n  Worst-affected (correct type not even in the top 6): ${notInTop6.length}`);
for (const r of notInTop6.slice(0, 25)) {
  console.log(
    `    [${r.rule}] ${r.typeName}\n        want: ${r.typeName}\n        got : ${guideTypeById[r.topTypeId]?.name ?? r.topTypeId}  (rank of correct: ${r.rank})\n        text: ${r.example.slice(0, 110)}`,
  );
}

console.log("\n" + "=".repeat(78));
console.log("B. EXTRACTION — required fields left empty after auto-fill");
console.log("=".repeat(78));
console.log(`  ${incomplete.length}/${rows.length} examples left a required field empty`);
for (const r of incomplete.slice(0, 30)) {
  console.log(`    [${r.rule}] ${r.typeName} — missing: ${r.missing.join(", ")}`);
  console.log(`        text: ${r.example.slice(0, 110)}`);
}

console.log("\n" + "=".repeat(78));
console.log("C. OUTPUT FIDELITY — build from the auto-filled fields");
console.log("=".repeat(78));
console.log(
  `  ${rows.length - wrongOutput.length}/${rows.length} reproduced the Guide example EXACTLY ` +
    `(${(((rows.length - wrongOutput.length) / rows.length) * 100).toFixed(1)}%)`,
);
for (const r of wrongOutput) {
  console.log(`\n    [${r.rule}] ${r.typeName}`);
  console.log(`        want: ${r.example}`);
  console.log(`        got : ${r.built || "(nothing generated)"}`);
  if (r.missing.length) console.log(`        missing: ${r.missing.join(", ")}`);
}

// ------------------------------------------------------------------ D. ROBUST
console.log("\n" + "=".repeat(78));
console.log("D. ROBUSTNESS — perturbations that must not change the answer");
console.log("=".repeat(78));

/**
 * A perturbation may legitimately change the citation's letters, so each one
 * says how its result should be compared. Only the ALL-CAPS case does: a paste
 * out of a judgment database shouts, and rule 3.2 says the party names are to be
 * given "exactly as on the first page of the report" — which an all-capitals
 * paste does not tell us, so the tool keeps what it was given and asks the reader
 * to check. What it must NOT do is lose anything, and comparing case-insensitively
 * is exactly the test that nothing was lost and nothing invented.
 */
const PERTURBATIONS: {
  name: string;
  apply: (s: string) => string;
  compare?: (s: string) => string;
}[] = [
  {
    name: "ALL CAPS (pasted from a case list)",
    apply: (s) => s.toUpperCase(),
    compare: (s) => s.toLowerCase(),
  },
  { name: "no trailing full stop", apply: (s) => s.replace(/\.\s*$/, "") },
  { name: "trailing full stop added", apply: (s) => (/\.\s*$/.test(s) ? s : s + ".") },
  { name: "leading/trailing whitespace", apply: (s) => `   ${s}   ` },
  { name: "straight quotes", apply: (s) => s.replace(/[“”]/g, '"').replace(/[‘’]/g, "'") },
  { name: "double internal spaces", apply: (s) => s.replace(/ /g, "  ") },
  { name: "non-breaking spaces", apply: (s) => s.replace(/ /g, " ") },
  { name: "newlines instead of spaces", apply: (s) => s.replace(/ /g, (m, i) => (i % 17 === 0 ? "\n" : m)) },
  { name: "en-dash → hyphen", apply: (s) => s.replace(/–/g, "-") },
];

type PertFail = { pert: string; typeName: string; rule: string; input: string; want: string; got: string; kind: string };
const pertFails: PertFail[] = [];
let pertRuns = 0;

for (const r of rows) {
  // Only perturb examples the tool already handles cleanly, so a failure here
  // is genuinely caused by the perturbation and not by a pre-existing defect.
  if (!r.outputExact || r.rank !== 0) continue;
  const type = guideTypeById[r.typeId];
  for (const p of PERTURBATIONS) {
    const input = p.apply(r.example);
    if (input === r.example) continue;
    pertRuns++;
    const dets = detectTypes(input, 86);
    const topId = dets[0]?.typeId ?? "(none)";
    if (topId !== r.typeId) {
      pertFails.push({
        pert: p.name,
        typeName: r.typeName,
        rule: r.rule,
        input,
        want: r.typeName,
        got: guideTypeById[topId]?.name ?? topId,
        kind: "CLASSIFY",
      });
      continue;
    }
    const fields = prefillFromPaste(type, input, []);
    const built = buildCitation(type.id, fields);
    const same = p.compare ?? ((x: string) => x);
    if (same(norm(built.text ?? "")) !== same(norm(r.example))) {
      pertFails.push({
        pert: p.name,
        typeName: r.typeName,
        rule: r.rule,
        input,
        want: r.example,
        got: built.text ?? "(nothing)",
        kind: "OUTPUT",
      });
    }
  }
}

console.log(`  ${pertRuns - pertFails.length}/${pertRuns} perturbed pastes still produced the right answer`);
const byPert = new Map<string, PertFail[]>();
for (const f of pertFails) byPert.set(f.pert, [...(byPert.get(f.pert) ?? []), f]);
for (const [name, fs] of [...byPert.entries()].sort((a, b) => b[1].length - a[1].length)) {
  const cls = fs.filter((f) => f.kind === "CLASSIFY").length;
  const out = fs.filter((f) => f.kind === "OUTPUT").length;
  console.log(`    ${String(fs.length).padStart(4)} fail  "${name}"  (${cls} misclassified, ${out} wrong output)`);
}
console.log(`\n  Samples:`);
for (const [name, fs] of byPert.entries()) {
  for (const f of fs.slice(0, 20)) {
    console.log(`\n    "${name}" — ${f.kind} — ${f.typeName} [${f.rule}]`);
    console.log(`        in  : ${JSON.stringify(f.input.slice(0, 100))}`);
    console.log(`        want: ${f.want.slice(0, 100)}`);
    console.log(`        got : ${f.got.slice(0, 100)}`);
  }
}

// ---------------------------------------------------------------- E. FIXPOINT
console.log("\n" + "=".repeat(78));
console.log("E. FIXED POINT — re-pasting the tool's own output must be stable");
console.log("=".repeat(78));
let fixOk = 0;
let fixRuns = 0;
const fixFails: Row[] = [];
for (const r of rows) {
  if (!r.outputExact || r.rank !== 0) continue;
  fixRuns++;
  const dets = detectTypes(r.built, 86);
  const type = guideTypeById[r.typeId];
  const fields2 = prefillFromPaste(type, r.built, []);
  const built2 = buildCitation(type.id, fields2);
  if (dets[0]?.typeId === r.typeId && norm(built2.text ?? "") === norm(r.built)) fixOk++;
  else fixFails.push(r);
}
console.log(`  ${fixOk}/${fixRuns} were stable on a second pass`);
for (const r of fixFails.slice(0, 15)) {
  console.log(`    [${r.rule}] ${r.typeName}: ${r.example.slice(0, 90)}`);
}

console.log("\n" + "=".repeat(78));
console.log("SUMMARY");
console.log("=".repeat(78));
console.log(`  examples tested         : ${rows.length}`);
console.log(`  classification correct  : ${rows.length - misclassified.length}/${rows.length}`);
console.log(`  all required extracted  : ${rows.length - incomplete.length}/${rows.length}`);
console.log(`  output exact            : ${rows.length - wrongOutput.length}/${rows.length}`);
console.log(`  robustness              : ${pertRuns - pertFails.length}/${pertRuns}`);
console.log(`  fixed point             : ${fixOk}/${fixRuns}`);

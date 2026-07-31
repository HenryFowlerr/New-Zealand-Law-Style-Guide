/**
 * Where is the guarantee UNTESTED?
 *
 * The guarantee is that correct fields produce the Guide's citation exactly, and
 * `field-truth.ts` is the only measure of it whose fields are written by hand.
 * "All 86 types" is not the same as all of the Guide's worked examples: a type
 * with three alternate forms and one hand-written entry has two forms nobody has
 * ever checked, and a form is a different citation, not a variation on one.
 *
 * This script does not test anything. It reports what is missing, so that the
 * next hand-written entry is chosen by coverage rather than by whichever example
 * happened to fail loudest.
 */
import { guideTypes } from "../src/data/styleGuide";
import { FIELD_TRUTH } from "../tests/fixtures/field-truth";
import { GUIDE_CORPUS } from "../tests/fixtures/guide-corpus";
import { templateForms } from "../src/engine/render";

const norm = (s: string) => s.replace(/\s+/g, " ").replace(/\.\s*$/, "").trim().toLowerCase();

const truthByType = new Map<string, number>();
const truthWants = new Set<string>();
for (const t of FIELD_TRUTH) {
  truthByType.set(t.typeId, (truthByType.get(t.typeId) ?? 0) + 1);
  truthWants.add(norm(t.want));
}

const skipped = FIELD_TRUTH.filter((t) => t.knownGap);

// Every worked example the ingested Guide carries, per type.
type Missing = { typeId: string; label: string; rule: string; text: string };
const missing: Missing[] = [];
let examplesTotal = 0;

for (const type of guideTypes as any[]) {
  for (const ex of type.examples ?? []) {
    const text: string = ex.correct_citation ?? ex.citation ?? "";
    if (!text) continue;
    examplesTotal++;
    if (!truthWants.has(norm(text))) {
      missing.push({ typeId: type.id, label: type.label ?? type.name, rule: ex.location ?? type.rule, text });
    }
  }
}

// A type whose forms outnumber its hand-written entries has forms never checked.
const formGaps: { id: string; label: string; forms: number; truth: number }[] = [];
for (const type of guideTypes as any[]) {
  const forms = templateForms(type.outputTemplate ?? "").length;
  const truth = truthByType.get(type.id) ?? 0;
  if (truth < forms) formGaps.push({ id: type.id, label: type.label ?? type.name, forms, truth });
}

const noTruth = (guideTypes as any[]).filter((t) => !truthByType.has(t.id));

console.log("=".repeat(78));
console.log("RENDER COVERAGE — where the guarantee is not measured by hand");
console.log("=".repeat(78));
console.log(`  types in the Guide            : ${(guideTypes as any[]).length}`);
console.log(`  types with a hand-written case: ${truthByType.size}`);
console.log(`  hand-written cases            : ${FIELD_TRUTH.length}`);
console.log(`  of those, skipped (knownGap)  : ${skipped.length}`);
console.log(`  worked examples in the Guide  : ${examplesTotal}`);
console.log(`  NOT covered by hand           : ${missing.length}`);
console.log(`  published-Guide corpus        : ${GUIDE_CORPUS.length}`);

if (noTruth.length) {
  console.log(`\n--- TYPES WITH NO HAND-WRITTEN CASE AT ALL (${noTruth.length}) ---`);
  for (const t of noTruth) console.log(`  ${t.rule ?? "?"}  ${t.id}  ${t.label ?? t.name}`);
}

if (skipped.length) {
  console.log(`\n--- SKIPPED BY knownGap (${skipped.length}) ---`);
  for (const s of skipped) console.log(`  ${s.typeId}: ${s.knownGap}\n     want: ${s.want}`);
}

console.log(`\n--- FORMS OUTNUMBER HAND-WRITTEN CASES (${formGaps.length} types) ---`);
console.log("  a type's alternate forms are different citations, not variations");
for (const g of formGaps.sort((a, b) => b.forms - a.forms).slice(0, 25)) {
  console.log(`  ${String(g.truth).padStart(2)} of ${String(g.forms).padStart(2)} forms  ${g.id}  ${g.label}`);
}

console.log(`\n--- WORKED EXAMPLES WITH NO HAND-WRITTEN FIELDS (${missing.length}) ---`);
const byType = new Map<string, Missing[]>();
for (const m of missing) {
  if (!byType.has(m.label)) byType.set(m.label, []);
  byType.get(m.label)!.push(m);
}
for (const [label, list] of [...byType.entries()].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`\n  ${label}  (${list.length})`);
  for (const m of list) console.log(`    [${m.rule}] ${m.text.slice(0, 110)}`);
}

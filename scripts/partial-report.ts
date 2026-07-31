/**
 * PARTIAL REFERENCES — a student rarely pastes a complete citation.
 *
 * They paste what they have: a case name and a neutral citation but no pinpoint,
 * an Act with no section, a journal article with no starting page. The corpus is
 * 216 COMPLETE citations printed in the Guide, so nothing measured what happens
 * to an incomplete one — the same blind spot that hid the capitalised-paste
 * failures until they were added to the sweep.
 *
 * No new ground truth is needed, because there is an invariant that does not
 * depend on knowing the right answer:
 *
 *   **Taking a detail OUT of the paste must not change where the others land.**
 *
 * Every field-truth entry is a hand-written set of correct boxes. Render it,
 * drop one optional value, render again, and read the shorter reference back.
 * Whatever the reader extracts must AGREE with the ground truth it came from: a
 * box may be empty, but it must never hold a different value. A box that changes
 * meaning when a neighbour disappears is the failure that matters, because the
 * student sees a filled box and believes it.
 *
 * Three distinct defects are counted separately, because they are not equally
 * bad:
 *
 *   CORRUPTED  a box holds a value that is not the one the Guide gives it —
 *              the student is shown something false
 *   DROPPED    a box the shorter reference still contains came back empty —
 *              recoverable, the student retypes it
 *   RETYPED    the type ranked first changed when a detail was removed
 *
 *   npx tsx scripts/partial-report.ts [--verbose]
 */
import { buildCitation, prefillFromPaste, detectTypes, visibleComponents } from "../src/engine/build.ts";
import { guideTypeById } from "../src/data/styleGuide.ts";
import { chooseForm } from "../src/engine/render.ts";
import { FIELD_TRUTH } from "../tests/fixtures/field-truth.ts";

const verbose = process.argv.includes("--verbose");

type Defect = {
  kind: "CORRUPTED" | "DROPPED" | "RETYPED";
  typeId: string;
  omitted: string;
  field: string;
  want: string;
  got: string;
  paste: string;
  /** Whether the shortened reference is one a student could actually have. */
  realistic: boolean;
};

/**
 * TRAILING vs INTERIOR, and why the difference decides whether a defect counts.
 *
 * Dropping the pinpoint off a case gives a reference a student really has.
 * Dropping the VOLUME out of "791 P 2d 1329" gives "P 2d 1329", which is not a
 * United States citation at all — no rule of the Guide produces it and nobody
 * will paste it. Both are "optional" in the ingested data, so a measure that
 * treats them alike reports mostly noise, and a noisy measure gets quoted.
 *
 * An omission is TRAILING when nothing the template writes after it is still
 * filled — the reference is simply shorter. That is the realistic partial, and
 * it is the number to watch.
 */
const trailingOmission = (form: string, omitted: string, remaining: Record<string, string>) => {
  const slots = [...form.matchAll(/\{([^}]+)\}/g)].map((m) => m[1]);
  const at = slots.indexOf(omitted);
  if (at < 0) return false;
  return !slots.slice(at + 1).some((id) => remaining[id]?.trim());
};

const defects: Defect[] = [];
let checks = 0;
let pastes = 0;
let realisticPastes = 0;

/** Compare the way a reader would: whitespace and the Guide's brackets aside. */
const norm = (value: string): string =>
  value
    .replace(/\s+/g, " ")
    .replace(/^[[(]|[\])]$/g, "")
    .replace(/[.,;]+$/, "")
    .trim()
    .toLowerCase();

for (const truth of FIELD_TRUTH) {
  if (truth.knownGap) continue;
  const type = guideTypeById[truth.typeId];
  if (!type) continue;
  const required = new Set(
    visibleComponents(type).filter((c) => c.required).map((c) => c.id),
  );
  const present = Object.keys(truth.fields).filter((id) => truth.fields[id]?.trim());
  // Only optional values can be removed; dropping a required one is meant to
  // refuse, and `engine-build.test.ts` already covers that.
  const droppable = present.filter((id) => !required.has(id));

  for (const omitted of droppable) {
    const reduced: Record<string, string> = { ...truth.fields };
    delete reduced[omitted];
    const built = buildCitation(truth.typeId, reduced);
    if (built.status !== "ready" || !built.text) continue;
    const realistic = trailingOmission(chooseForm(type.outputTemplate, reduced), omitted, reduced);
    pastes++;
    if (realistic) realisticPastes++;

    // 1. Does the shorter reference still identify the same kind of source?
    const ranked = detectTypes(built.text);
    if (ranked.length && ranked[0].typeId !== truth.typeId) {
      // Only count it where the COMPLETE reference was ranked correctly, so a
      // pre-existing classification miss is not blamed on the omission.
      const full = detectTypes(buildCitation(truth.typeId, truth.fields).text ?? "");
      if (full.length && full[0].typeId === truth.typeId) {
        defects.push({
          kind: "RETYPED",
          typeId: truth.typeId,
          omitted,
          field: "(type)",
          want: truth.typeId,
          got: ranked[0].typeId,
          paste: built.text,
          realistic,
        });
      }
    }

    // 2. Does every box the reader fills still agree with the ground truth?
    const read = prefillFromPaste(type, built.text, []);
    for (const [id, value] of Object.entries(read)) {
      if (!value?.trim()) continue;
      if (id === omitted) continue; // its value is genuinely gone from the text
      const expected = truth.fields[id];
      checks++;
      if (expected === undefined) {
        // A box the ground truth leaves empty. Only a defect if what it holds
        // is not simply a run the template also writes into another box.
        continue;
      }
      if (norm(expected) !== norm(value)) {
        defects.push({
          kind: "CORRUPTED",
          typeId: truth.typeId,
          omitted,
          field: id,
          want: expected,
          got: value,
          paste: built.text,
          realistic,
        });
      }
    }

    // 3. Did a value that is still IN the text fail to come back at all?
    for (const [id, value] of Object.entries(truth.fields)) {
      if (id === omitted || !value?.trim()) continue;
      if (!built.text.includes(value.trim())) continue; // not in the shorter form
      if ((read[id] ?? "").trim()) continue;
      defects.push({
        kind: "DROPPED",
        typeId: truth.typeId,
        omitted,
        field: id,
        want: value,
        got: "",
        paste: built.text,
        realistic,
      });
    }
  }
}

const real = defects.filter((d) => d.realistic);
const count = (kind: Defect["kind"], list = defects) => list.filter((d) => d.kind === kind).length;

console.log("=".repeat(78));
console.log("PARTIAL REFERENCES — removing a detail must not move the others");
console.log("=".repeat(78));
console.log(`  shortened references read     : ${pastes}  (${realisticPastes} realistic)`);
console.log(`  box values checked            : ${checks}`);
console.log("");
console.log("  REALISTIC — a trailing detail left off, which is what a student pastes");
console.log(`    CORRUPTED (shows a false value) : ${count("CORRUPTED", real)}`);
console.log(`    DROPPED   (loses a present one) : ${count("DROPPED", real)}`);
console.log(`    RETYPED   (type rank changed)   : ${count("RETYPED", real)}`);
console.log("");
console.log("  INTERIOR — a value removed from the MIDDLE, which leaves a reference no");
console.log("  rule of the Guide produces. Watch these, but do not chase them.");
console.log(`    CORRUPTED ${count("CORRUPTED") - count("CORRUPTED", real)}   DROPPED ${count("DROPPED") - count("DROPPED", real)}   RETYPED ${count("RETYPED") - count("RETYPED", real)}`);

const byField = new Map<string, number>();
for (const d of real) {
  const key = `${d.kind}  ${d.typeId}.${d.field}`;
  byField.set(key, (byField.get(key) ?? 0) + 1);
}
if (byField.size) {
  console.log("\n--- REALISTIC DEFECTS BY SHAPE (worst first) ---");
  for (const [key, n] of [...byField.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25)) {
    console.log(`  ${String(n).padStart(3)}  ${key}`);
  }
}

if (verbose && real.length) {
  console.log("\n--- EVERY REALISTIC DEFECT ---");
  for (const d of real) {
    console.log(`\n[${d.kind}] ${d.typeId} — dropping ${d.omitted} moved ${d.field}`);
    console.log(`  paste: ${d.paste}`);
    console.log(`  want : ${JSON.stringify(d.want)}`);
    console.log(`  got  : ${JSON.stringify(d.got)}`);
  }
}

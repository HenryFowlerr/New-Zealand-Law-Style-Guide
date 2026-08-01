/**
 * How well does the tool read a reference that is NOT in the Guide's format?
 *
 * The paste layer was built and fitted entirely against the Guide's own 216
 * worked examples, so it measures itself against text already in the shape it
 * expects. A student's screen holds something else: APA out of Zotero, Bluebook
 * out of a US casebook, a line scraped off a judgment database. This scores
 * that, and it is a CONVENIENCE measure — the guarantee is still field-truth.
 *
 * Three separate questions, because they fail separately:
 *   PICK    does the right type rank first?
 *   FIELDS  is every field the paste honestly carries extracted, in the
 *           Guide's form? (`tests/fixtures/foreign-format.ts` says which, and
 *           why some cannot be.)
 *   OUTPUT  does the citation come out exactly?
 *
 * Run with --verbose for the failing fields of every case.
 */
import { FOREIGN_FORMAT } from "../tests/fixtures/foreign-format.ts";
import {
  detectTypes,
  prefillFromPaste,
  buildCitation,
  missingRequiredComponents,
} from "../src/engine/build.ts";
import { guideTypeById } from "../src/data/styleGuide.ts";

const verbose = process.argv.includes("--verbose");
const norm = (s: string) => s.replace(/\s+/g, " ").trim();

let pick = 0;
let fieldsExact = 0;
let outputExact = 0;
let fieldTotal = 0;
let fieldRight = 0;
let askedCorrectly = 0;
const failClosedCases = FOREIGN_FORMAT.filter((c) => !c.want).length;

type Bad = { style: string; paste: string; note: string };
const bad: Bad[] = [];

console.log("=".repeat(78));
console.log("FOREIGN FORMAT — reading a reference that is not in the Guide's shape");
console.log("=".repeat(78));

const byStyle = new Map<string, { n: number; pick: number; out: number }>();

for (const c of FOREIGN_FORMAT) {
  const type = guideTypeById[c.typeId];
  if (!type) throw new Error(`fixture names an unknown type: ${c.typeId}`);

  const detections = detectTypes(c.paste, 86);
  const rank = detections.findIndex((d) => d.typeId === c.typeId);
  const pickedFirst = rank === 0;
  if (pickedFirst) pick++;

  const got = prefillFromPaste(type, c.paste, []);
  let allFields = true;
  const wrong: string[] = [];
  for (const [id, want] of Object.entries(c.fields)) {
    fieldTotal++;
    if (norm(got[id] ?? "") === norm(want)) fieldRight++;
    else {
      allFields = false;
      wrong.push(`${id}: want ${JSON.stringify(want)} got ${JSON.stringify(got[id] ?? "")}`);
    }
  }
  if (allFields) fieldsExact++;

  const text = buildCitation(c.typeId, got).text ?? "";
  const missing = missingRequiredComponents(type, got).map((m) => m.id);
  // A format that omits something the Guide requires must fail CLOSED, asking
  // for exactly what it could not carry. Scoring that as an output failure
  // would reward inventing the missing value, which is the opposite of the aim.
  const outOk = c.want
    ? norm(text) === norm(c.want)
    : !text &&
      (c.mustAsk ?? []).every((id) => missing.includes(id)) &&
      missing.length === (c.mustAsk ?? []).length;
  if (outOk) outputExact++;
  if (!c.want) askedCorrectly += outOk ? 1 : 0;

  const tally = byStyle.get(c.style) ?? { n: 0, pick: 0, out: 0 };
  tally.n++;
  if (pickedFirst) tally.pick++;
  if (outOk) tally.out++;
  byStyle.set(c.style, tally);

  if (!pickedFirst || !outOk) {
    bad.push({
      style: c.style,
      paste: c.paste,
      note: !pickedFirst
        ? `PICK rank ${rank < 0 ? "not ranked" : rank} — top was ${detections[0]?.typeId ?? "(none)"}`
        : c.want
          ? "OUTPUT differs"
          : `should fail CLOSED asking for ${(c.mustAsk ?? []).join(", ")}`,
    });
  }

  if (verbose) {
    console.log(`\n--- [${c.style}] ${c.typeId}`);
    console.log(`  paste : ${c.paste}`);
    console.log(`  PICK  : ${pickedFirst ? "first" : `rank ${rank < 0 ? "not ranked" : rank} (top ${detections[0]?.typeId ?? "none"})`}`);
    for (const w of wrong) console.log(`  FIELD : ${w}`);
    console.log(`  got   : ${text || "(refused)"}`);
    console.log(`  want  : ${c.want ?? `(refused — must ask for ${(c.mustAsk ?? []).join(", ")})`}`);
    if (c.lossy?.length) for (const l of c.lossy) console.log(`  lossy : ${l}`);
  }
}

const n = FOREIGN_FORMAT.length;
console.log(`\n  cases                      : ${n}`);
console.log(`  PICK   type ranked first   : ${pick}/${n}`);
console.log(`  FIELDS every field right   : ${fieldsExact}/${n}   (${fieldRight}/${fieldTotal} fields)`);
console.log(`  OUTPUT citation exact      : ${outputExact}/${n}`);
console.log(`  of those, failed CLOSED    : ${askedCorrectly}/${failClosedCases}   asked for what the format omits`);

console.log("\n  by style —");
for (const [style, t] of [...byStyle].sort((a, b) => a[0].localeCompare(b[0]))) {
  console.log(`    ${style.padEnd(28)} PICK ${t.pick}/${t.n}   OUTPUT ${t.out}/${t.n}`);
}

if (bad.length && !verbose) {
  console.log(`\n--- NOT YET READ (${bad.length}) — rerun with --verbose for the fields ---`);
  for (const b of bad) {
    console.log(`  [${b.style}] ${b.note}`);
    console.log(`    ${b.paste.slice(0, 96)}${b.paste.length > 96 ? "…" : ""}`);
  }
}

// A format that loses information the Guide requires is a real limit, not a
// defect, and it is stated rather than quietly scored as a pass.
const lossy = FOREIGN_FORMAT.filter((c) => c.lossy?.length);
console.log(`\n--- WHAT THE FORMAT ITSELF CANNOT CARRY (${lossy.length} cases) ---`);
const reasons = new Map<string, number>();
for (const c of lossy) for (const l of c.lossy ?? []) reasons.set(l, (reasons.get(l) ?? 0) + 1);
for (const [reason, count] of [...reasons].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(count).padStart(2)}  ${reason}`);
}
console.log("\n  These must be ASKED of the reader, never guessed.");

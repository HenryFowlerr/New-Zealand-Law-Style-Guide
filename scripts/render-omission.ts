/**
 * Leaving one optional detail out must remove that detail and nothing else.
 *
 * This is where a citation quietly goes wrong. A student has no pinpoint, or no
 * court identifier, or no edition — and the separators that attached the absent
 * part are still in the template. If the renderer takes one character too many
 * it eats the comma belonging to the next part; one too few and a stray bracket
 * survives. Either way the reference breaks the Guide, and nothing says so.
 *
 * No ground truth is needed: whatever the correct output is, every OTHER field's
 * value must still appear in it, intact.
 *
 *   npx tsx scripts/render-omission.ts
 */
import { buildCitation, visibleComponents } from "../src/engine/build.ts";
import { guideTypes, guideTypeById } from "../src/data/styleGuide.ts";
import { templateForms } from "../src/engine/render.ts";
import { FIELD_TRUTH } from "../tests/fixtures/field-truth.ts";

type Break = {
  typeId: string;
  rule: string;
  omitted: string;
  lost: string;
  full: string;
  reduced: string;
};

const breaks: Break[] = [];
let checks = 0;

/** A distinctive value per component, so a lost one is unmistakable. */
function sampleValue(id: string): string {
  if (/year$/i.test(id) || id === "year") return "2019";
  if (/date/i.test(id)) return "3 August 2019";
  if (/pinpoint/i.test(id)) return "[26]";
  if (/url/i.test(id)) return "<www.example.com>";
  if (/page|volume|number|issue/i.test(id)) return "12";
  return `Zq${id[0].toUpperCase()}${id.slice(1)}`;
}

/**
 * Every SINGLE-FORM type, with all its components filled — far wider than the
 * fixtures. Types with alternate forms are left out of this pass: filling every
 * slot of every form is not a citation anyone would write, and removing one
 * field legitimately flips which form is chosen, which reads as a loss without
 * being one.
 */
const SYNTHETIC = guideTypes
  .filter((type) => templateForms(type.outputTemplate).length === 1)
  .map((type) => ({
  typeId: type.id,
  fields: Object.fromEntries(
    visibleComponents(type).map((c) => [c.id, sampleValue(c.id)]),
  ) as Record<string, string>,
  want: "",
  }));

for (const truth of [...FIELD_TRUTH, ...SYNTHETIC]) {
  const type = guideTypeById[truth.typeId];
  const optional = visibleComponents(type)
    .filter((c) => !c.required && (truth.fields[c.id] ?? "").trim())
    .map((c) => c.id);
  const full = buildCitation(truth.typeId, truth.fields);
  if (full.status !== "ready") continue;

  for (const drop of optional) {
    const reducedFields = { ...truth.fields };
    delete reducedFields[drop];
    const reduced = buildCitation(truth.typeId, reducedFields);
    if (reduced.status !== "ready") continue;
    checks++;
    // Every remaining value must survive intact.
    for (const [id, value] of Object.entries(reducedFields)) {
      const v = value.trim();
      if (!v) continue;
      if (id === drop) continue;
      if (!reduced.text.includes(v)) {
        breaks.push({
          typeId: truth.typeId,
          rule: type.rule,
          omitted: drop,
          lost: `${id} = "${v}"`,
          full: full.text,
          reduced: reduced.text,
        });
      }
    }
  }
}

console.log("=".repeat(78));
console.log("OMISSION SAFETY — dropping one optional part must disturb nothing else");
console.log("=".repeat(78));
console.log(`  ${checks - breaks.length}/${checks} omissions left every other value intact`);
console.log(`  ${breaks.length} broke a neighbouring value\n`);

const seen = new Set<string>();
for (const b of breaks) {
  const key = `${b.typeId}:${b.omitted}:${b.lost}`;
  if (seen.has(key)) continue;
  seen.add(key);
  console.log(`[${b.rule}] ${guideTypeById[b.typeId].name} — omitting "${b.omitted}" lost ${b.lost}`);
  console.log(`   with   : ${b.full}`);
  console.log(`   without: ${b.reduced}\n`);
}

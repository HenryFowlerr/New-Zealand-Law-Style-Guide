/**
 * FORM CHOICE — which of a rule's alternate forms does a set of facts call for?
 *
 * Thirty-one of the Guide's rules offer more than one citation format under one
 * number: a Supreme Court transcript changed shape in 2011, a Gazette notice in
 * October 2017, rule 8.5 cites a Scottish case either by report or by neutral
 * citation alone. `chooseForm` decides between them, and until now nothing
 * measured it on its own — its failures only showed up folded into some other
 * number.
 *
 * That matters because choosing the wrong form is a WRONG CITATION, not a
 * cosmetic slip. Rule 9.3.1's second form is one slot followed by "pt 1 of the
 * Constitution Act 1982, being sch B to the Canada Act 1982 (UK)": pick it by
 * mistake and a student citing the Crimes Act gets the Canadian Charter.
 *
 * It is also the thing standing in the way of validating a type against the form
 * it is actually using — the fix for the last refusals in the corpus. That was
 * attempted once and reverted (see docs/working-notes.md) precisely because
 * chooseForm was not trustworthy enough to carry it. So this scores it directly:
 *
 *   TRUTH    — every hand-written field set renders to the Guide's citation.
 *              This is the one that must never regress.
 *   SPARSE   — with only the FIRST field of a type filled, the form chosen must
 *              not assert MORE than some other form of the same rule would. Where
 *              every form names the same thing — a transcript is a transcript —
 *              there is nothing to choose between and nothing to report. A
 *              nearly-empty field set is what a student stares at before they have
 *              typed anything, and it is where a narrow form wins on arithmetic.
 *
 *   npx tsx scripts/form-choice.ts
 */
import { buildCitation, visibleComponents } from "../src/engine/build.ts";
import { guideTypes, guideTypeById, type GuideType } from "../src/data/styleGuide.ts";
import { chooseForm, templateForms } from "../src/engine/render.ts";
import { FIELD_TRUTH } from "../tests/fixtures/field-truth.ts";

const multiForm = guideTypes.filter((t) => templateForms(t.outputTemplate).length > 1);
const multiFormIds = new Set(multiForm.map((t) => t.id));

/** Which form index was chosen for this field set. */
function chosenIndex(type: GuideType, fields: Record<string, string>): number {
  const forms = templateForms(type.outputTemplate);
  return forms.indexOf(chooseForm(type.outputTemplate, fields));
}

// ─────────────────────────────────────────────────────────────── TRUTH
type TruthRow = { typeId: string; want: string; got: string; form: number; ok: boolean };
const truth: TruthRow[] = [];
for (const entry of FIELD_TRUTH) {
  if (!multiFormIds.has(entry.typeId)) continue;
  const type = guideTypeById[entry.typeId];
  const built = buildCitation(entry.typeId, entry.fields);
  truth.push({
    typeId: entry.typeId,
    want: entry.want,
    got: built.text ?? "",
    form: chosenIndex(type, entry.fields as Record<string, string>),
    ok: (built.text ?? "") === entry.want,
  });
}

// ─────────────────────────────────────────────────────────────── SPARSE
/**
 * What a form ASSERTS that nothing in the fields supports. A student who has
 * typed one thing must not be handed a sentence of the Guide's prose about a
 * document they are not citing.
 */
function unsupportedWords(form: string, fields: Record<string, string>): string[] {
  const supplied = Object.values(fields).join(" ").toLowerCase();
  // Only a NAMED thing — the capital letter is the test. A template's lowercase
  // connective ("paper presented to", "as cited in") asserts nothing about the
  // source it is citing.
  return (form.replace(/\*|\{[^}]+\}/g, " ").match(/[A-Za-z]{4,}/g) ?? [])
    .filter((word) => /\p{Lu}/u.test(word))
    .map((word) => word.toLowerCase())
    .filter((word) => !supplied.includes(word));
}

type SparseRow = {
  typeId: string;
  rule: string;
  fields: Record<string, string>;
  got: string;
  asserted: string[];
  leastAvailable: number;
};
const sparse: SparseRow[] = [];
for (const type of multiForm) {
  const first = visibleComponents(type)[0];
  if (!first) continue;
  // The one field a student fills before any other: whatever the form asks for
  // first — a case name, a short title, a title.
  const fields = { [first.id]: "Crimes Act" };
  const required = new Set(type.components.filter((c) => c.required).map((c) => c.id));
  const form = chooseForm(type.outputTemplate, fields, required);
  const asserted = unsupportedWords(form, fields);
  // Only a report if some OTHER form of the same rule would have asserted less.
  // Where every form names the same thing there is nothing to choose between.
  const leastAvailable = Math.min(
    ...templateForms(type.outputTemplate).map((f) => unsupportedWords(f, fields).length),
  );
  if (asserted.length > leastAvailable) {
    sparse.push({
      typeId: type.id,
      rule: type.rule,
      fields,
      got: buildCitation(type.id, fields).text ?? "(refused)",
      asserted,
      leastAvailable,
    });
  }
}

const truthBad = truth.filter((r) => !r.ok);

console.log("=".repeat(78));
console.log("FORM CHOICE — which of a rule's alternate forms do these facts call for?");
console.log("=".repeat(78));
console.log(`  rules with more than one form : ${multiForm.length}`);
console.log(`  TRUTH  (hand-written sets)    : ${truth.length - truthBad.length}/${truth.length}`);
console.log(`  SPARSE (one field filled)     : ${multiForm.length - sparse.length}/${multiForm.length} chose the least-asserting form`);

if (truthBad.length) {
  console.log("\n" + "-".repeat(78));
  console.log(`WRONG FORM FOR A KNOWN-GOOD FIELD SET (${truthBad.length})`);
  console.log("-".repeat(78));
  for (const r of truthBad) {
    console.log(`\n[${guideTypeById[r.typeId].rule}] ${r.typeId}  (chose form ${r.form})`);
    console.log(`  want: ${r.want}`);
    console.log(`  got : ${r.got || "(refused)"}`);
  }
}

if (sparse.length) {
  console.log("\n" + "-".repeat(78));
  console.log(`CHOSE A FORM THAT ASSERTS MORE THAN ANOTHER WOULD (${sparse.length})`);
  console.log("-".repeat(78));
  for (const r of sparse) {
    console.log(`\n[${r.rule}] ${r.typeId}`);
    console.log(`  given : ${JSON.stringify(r.fields)}`);
    console.log(`  gives : ${r.got}`);
    console.log(`  names nothing supports: ${r.asserted.join(", ")}  (another form would name ${r.leastAvailable})`);
  }
}

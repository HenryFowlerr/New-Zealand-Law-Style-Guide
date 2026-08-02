/**
 * What happens when a student types PART of a reference?
 *
 * The measure that matters here is not accuracy, it is SAFETY. A fragment that
 * cannot be a citation must not come back as one, and the tool's most permissive
 * types — rule 2.3, Laws of New Zealand, the Cabinet Manual — will happily
 * accept any run of words into their single free-text box and print it back with
 * a full stop. See tests/fixtures/fragments.ts for why that is the worst thing
 * this tool can do.
 *
 * Three questions:
 *   PICK    is the right type offered, in the visible top six?
 *   FIELDS  is what the fragment DOES carry read into the right boxes?
 *   SAFE    does the top-ranked type refuse when the fragment is not a citation,
 *           and build when it is?
 *
 * SAFE is the one that must reach 100%.
 */
import { FRAGMENTS } from "../tests/fixtures/fragments.ts";
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
let fieldsOk = 0;
let safe = 0;
const unsafe: string[] = [];

console.log("=".repeat(78));
console.log("FRAGMENTS — part of a reference, not the whole of one");
console.log("=".repeat(78));

for (const c of FRAGMENTS) {
  const detections = detectTypes(c.fragment, 86);
  const rank = detections.findIndex((d) => d.typeId === c.typeId);
  const offered = rank >= 0 && rank < 6;
  if (offered) pick++;

  // FIELDS is asked of the type that SHOULD have been chosen: the question is
  // whether the fragment can be read, separately from whether it was ranked.
  const wanted = guideTypeById[c.typeId];
  const got = prefillFromPaste(wanted, c.fragment, []);
  const wrong = Object.entries(c.fields).filter(
    ([id, value]) => norm(got[id] ?? "") !== norm(value),
  );
  if (!wrong.length) fieldsOk++;

  // SAFE is asked of the type the reader actually gets by pressing Enter.
  const top = detections[0]?.typeId;
  const topBuilt = top ? buildCitation(top, prefillFromPaste(guideTypeById[top], c.fragment, [])).text : "";
  const shouldBuild = Boolean(c.want);
  const isSafe = shouldBuild ? Boolean(topBuilt) : !topBuilt;
  if (isSafe) safe++;
  else if (!shouldBuild) {
    unsafe.push(
      `  "${c.fragment}"\n    → ${top} built: ${topBuilt}\n    (it should have asked for ${(c.mustAsk ?? []).join(", ")})`,
    );
  } else {
    unsafe.push(`  "${c.fragment}"\n    → refused, but it is a complete citation: ${c.want}`);
  }

  if (verbose) {
    console.log(`\n--- ${c.what}`);
    console.log(`  in    : ${c.fragment}`);
    console.log(`  PICK  : ${c.typeId} at rank ${rank < 0 ? "not offered" : rank} (top ${top})`);
    for (const [id, value] of wrong) {
      console.log(`  FIELD : ${id}: want ${JSON.stringify(value)} got ${JSON.stringify(got[id] ?? "")}`);
    }
    console.log(`  top   : ${topBuilt || "(refused)"}`);
    console.log(`  want  : ${c.want ?? `(refuse — ask for ${(c.mustAsk ?? []).join(", ")})`}`);
  }
}

const n = FRAGMENTS.length;
console.log(`\n  fragments                  : ${n}`);
console.log(`  PICK   type offered in top 6: ${pick}/${n}`);
console.log(`  FIELDS what it carries, read: ${fieldsOk}/${n}`);
console.log(`  SAFE   builds only a real citation: ${safe}/${n}   ← must reach ${n}/${n}`);

if (unsafe.length) {
  console.log(`\n--- A FRAGMENT CAME BACK AS A CITATION (${unsafe.length}) ---`);
  console.log("  Each of these is a finished citation a student would paste into an essay.");
  for (const u of unsafe) console.log(u);
}

/**
 * THE LINK LAYER — pasting a URL instead of a reference.
 *
 * The other three layers each have a scored sweep; this one had none, and the
 * consequence was a whole class of silently wrong output. Every New Zealand legal
 * source resolved to "internet material", so the official text of the Evidence Act
 * came back as
 *
 *   “DLM393463” legislation.govt.nz <https://www.legislation.govt.nz/act/…>.
 *
 * A correctly formatted citation of the wrong kind, which is the one failure this
 * tool is meant to make impossible. Nothing measured it, so nothing reported it.
 *
 * Two things are scored here, and they are different questions:
 *
 *   TYPE  — is the source recognised as the KIND of thing the Guide says it is?
 *           An Act must never be cited as a web page. This is the one that matters:
 *           a wrong type cannot be rescued by good field values.
 *   CITE  — where the URL and the page title together determine a citation, is it
 *           exactly right?
 *
 * And a third, for the case that will happen most often in practice:
 *
 *   BLOCKED — with no page title at all, the tool must still return a citation of
 *             the right kind, carrying whatever the URL alone establishes, and NAME
 *             what it could not determine.
 *
 * And one where the right answer is to produce NOTHING:
 *
 *   DATABASE — a subscription database's URL is a session id behind a login, so
 *              there is nothing to read from either the path or the page. Naming
 *              the database and asking for the reference text beats a citation with
 *              a Westlaw session address in it.
 *
 *   npx tsx scripts/link-report.ts
 */
import { buildCitation, missingRequiredComponents } from "../src/engine/build.ts";
import { guideTypeById } from "../src/data/styleGuide.ts";
import { fieldsFromUrl } from "../src/engine/linkResolve.ts";
import { applyPageTitle, recogniseNzSource } from "../src/engine/nzSources.ts";
import { LINK_TRUTH } from "../tests/fixtures/link-truth.ts";

type Row = {
  url: string;
  hadTitle: boolean;
  wantType: string;
  gotType: string;
  wantCite?: string;
  gotCite: string;
  wantNeeded?: string[];
  gotNeeded: string[];
  note?: string;
};

const rows: Row[] = [];

let declinedOk = 0;
let declinedTotal = 0;

for (const truth of LINK_TRUTH) {
  const match = recogniseNzSource(truth.url);
  if (truth.declined) {
    declinedTotal++;
    if (match?.unresolvable) declinedOk++;
    else {
      console.log(`  ! ${truth.url}\n      should be declined, but was resolved`);
    }
    continue;
  }
  let typeId: string;
  let fields: Record<string, string>;
  let stillNeeded: string[];
  if (match) {
    const applied = applyPageTitle(match, truth.pageTitle ?? "");
    typeId = applied.typeId;
    fields = applied.fields;
    stillNeeded = applied.stillNeeded;
  } else {
    const derived = fieldsFromUrl(truth.url);
    typeId = derived.typeId;
    fields = derived.fields;
    stillNeeded = [];
  }
  const built = buildCitation(typeId, fields);
  const missing = missingRequiredComponents(guideTypeById[typeId], fields).map((c) => c.id);
  rows.push({
    url: truth.url,
    hadTitle: Boolean(truth.pageTitle),
    wantType: truth.typeId,
    gotType: typeId,
    wantCite: truth.want,
    gotCite: built.text ?? "",
    wantNeeded: truth.stillNeeded,
    gotNeeded: [...new Set([...stillNeeded, ...missing])],
    note: truth.note,
  });
}

const typeOk = rows.filter((r) => r.gotType === r.wantType);
const withWant = rows.filter((r) => r.wantCite);
const citeOk = withWant.filter((r) => r.gotCite === r.wantCite);
const blocked = rows.filter((r) => !r.hadTitle);
// With no page to read, the type must still be right and the tool must say what
// it could not work out — an empty "still needed" list would be a claim it knows
// everything, which it does not.
const blockedOk = blocked.filter(
  (r) => r.gotType === r.wantType && (r.wantNeeded ?? []).every((id) => r.gotNeeded.includes(id)),
);

console.log("=".repeat(78));
console.log("THE LINK LAYER — pasting a URL instead of a reference");
console.log("=".repeat(78));
console.log(`  TYPE recognised    : ${typeOk.length}/${rows.length}`);
console.log(`  CITE exact         : ${citeOk.length}/${withWant.length}`);
console.log(`  BLOCKED page safe  : ${blockedOk.length}/${blocked.length}`);
console.log(`  DATABASE declined  : ${declinedOk}/${declinedTotal}`);

const failures = rows.filter(
  (r) =>
    r.gotType !== r.wantType ||
    (r.wantCite && r.gotCite !== r.wantCite) ||
    (r.wantNeeded && !r.wantNeeded.every((id) => r.gotNeeded.includes(id))),
);

if (failures.length) {
  console.log("\n" + "-".repeat(78));
  console.log(`FAILURES (${failures.length})`);
  console.log("-".repeat(78));
  for (const r of failures) {
    console.log(`\n  ${r.url}`);
    if (r.note) console.log(`    note : ${r.note}`);
    console.log(`    title: ${r.hadTitle ? "read" : "NOT AVAILABLE"}`);
    if (r.gotType !== r.wantType) {
      console.log(`    type : want ${r.wantType}  got ${r.gotType}`);
    }
    if (r.wantCite && r.gotCite !== r.wantCite) {
      console.log(`    want : ${r.wantCite}`);
      console.log(`    got  : ${r.gotCite || "(refused)"}`);
    }
    if (r.wantNeeded && !r.wantNeeded.every((id) => r.gotNeeded.includes(id))) {
      console.log(`    needed: want ${r.wantNeeded.join(", ")}  got ${r.gotNeeded.join(", ") || "(none)"}`);
    }
  }
}

console.log("\n" + "-".repeat(78));
console.log("WHAT EACH LINK PRODUCES");
console.log("-".repeat(78));
for (const r of rows) {
  const tick = r.gotType === r.wantType ? " " : "!";
  console.log(`\n${tick} ${r.url}`);
  console.log(`    ${guideTypeById[r.gotType]?.name ?? r.gotType}${r.hadTitle ? "" : "  (page unreadable)"}`);
  console.log(`    ${r.gotCite || `(needs ${r.gotNeeded.join(", ") || "more"})`}`);
}

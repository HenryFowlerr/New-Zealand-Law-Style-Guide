/**
 * TEMPLATE ROUND-TRIP — not the guarantee. Read this before quoting the number.
 *
 * The guarantee (correct fields in, perfect citation out) is measured by
 * tests/fixtures/field-truth.ts, where every field set is written out BY HAND for
 * every one of the 86 source types. That is 148/148.
 *
 * This script asks something narrower: can a type's own template read its own
 * worked example back into fields, and do those fields then render to the example?
 * It is a useful check on `extractByTemplate` — nothing else exercises it in
 * isolation — but its failures are almost all the EXTRACTOR mis-splitting, not the
 * renderer. A reported case shows this plainly: with the neutral citation optional,
 * the lazy capture leaves the case name empty and shunts everything one field
 * right, so the year box gets "Taylor" and the build is refused. The paste path
 * does not do that, because the shape anchors in scan.ts correct it; this script
 * deliberately does not use them.
 *
 * So a failure here means "the template alone cannot parse this", which is worth
 * knowing and is not a broken citation. Do not read the percentage as the
 * guarantee, and do not "fix" the renderer to satisfy it.
 *
 *   npx tsx scripts/render-truth.ts [--group Cases] [--all]
 */
import { buildCitation } from "../src/engine/build.ts";
import { extractByTemplate } from "../src/engine/render.ts";
import { guideTypes, type GuideType } from "../src/data/styleGuide.ts";

/**
 * The parts of the Guide a New Zealand law student actually cites in an essay:
 * cases, legislation, parliamentary material and secondary sources. The Guide
 * covers foreign and international sources too (Parts 8–10), but they are a
 * different job and should not dominate the score for everyday work.
 */
const STUDENT_GROUPS = new Set([
  "Cases",
  "Legislation",
  "Parliamentary & official",
  "Secondary sources",
  "Subsequent references",
]);

const args = process.argv.slice(2);
const only = args.includes("--group") ? args[args.indexOf("--group") + 1] : "";
const includeInternational = args.includes("--all");

type Result = {
  type: GuideType;
  want: string;
  got: string;
  ok: boolean;
  reason: string;
};

const results: Result[] = [];

for (const type of guideTypes) {
  if (only && type.group !== only) continue;
  if (!includeInternational && !STUDENT_GROUPS.has(type.group)) continue;
  for (const example of type.examples ?? []) {
    const want = example.correct_citation;
    if (!want?.trim()) continue;
    // Fields as a student would have them: the right values in the right
    // boxes. Derived from the Guide's own example so nothing is invented.
    const fields = extractByTemplate(type, want);
    if (!fields) {
      results.push({
        type,
        want,
        got: "",
        ok: false,
        reason: "no field set could be derived",
      });
      continue;
    }
    const built = buildCitation(type.id, fields);
    const got = built.text ?? "";
    results.push({
      type,
      want,
      got,
      ok: got === want,
      reason: built.status === "incomplete" ? "refused to build" : "",
    });
  }
}

const failed = results.filter((r) => !r.ok);
const byType = new Map<string, Result[]>();
for (const r of failed) byType.set(r.type.id, [...(byType.get(r.type.id) ?? []), r]);

console.log("=".repeat(78));
console.log("TEMPLATE ROUND-TRIP — can each template parse its own worked example?");
console.log("=".repeat(78));
console.log("  (the guarantee is field-truth: 148/148 by hand, all 86 types — see the header)");
console.log(
  `  ${results.length - failed.length}/${results.length} round-tripped ` +
    `(${(((results.length - failed.length) / results.length) * 100).toFixed(1)}%)` +
    `${includeInternational ? "" : "  [student-facing groups only; --all for every group]"}`,
);

const groups = new Map<string, { pass: number; total: number }>();
for (const r of results) {
  const g = groups.get(r.type.group) ?? { pass: 0, total: 0 };
  g.total++;
  if (r.ok) g.pass++;
  groups.set(r.type.group, g);
}
console.log("");
for (const [group, g] of groups) {
  console.log(`  ${group.padEnd(28)} ${String(g.pass).padStart(3)}/${String(g.total).padEnd(4)}`);
}

console.log("\n" + "-".repeat(78));
console.log(`FAILURES BY TYPE (${byType.size} types)`);
console.log("-".repeat(78));
for (const [id, rs] of [...byType.entries()].sort((a, b) => b[1].length - a[1].length)) {
  const t = rs[0].type;
  console.log(`\n[${t.rule}] ${t.name}  (${rs.length})`);
  console.log(`  tpl : ${t.outputTemplate}`);
  for (const r of rs) {
    console.log(`  want: ${r.want}`);
    console.log(`  got : ${r.got || `(${r.reason})`}`);
  }
}

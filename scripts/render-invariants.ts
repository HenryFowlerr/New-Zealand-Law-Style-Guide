/**
 * Structural invariants of a rendered citation, over every combination of
 * present and absent optional fields.
 *
 * A student rarely has every box filled. Their case may have no neutral
 * citation, no court identifier, or no pinpoint; their book may have no
 * edition. Each absent field leaves the separators that flanked it — a comma, a
 * bracket, the word "at" — with nothing to join, and those are exactly the
 * errors that make a citation wrong: a stray comma, an empty "()", a dangling
 * "at".
 *
 * No ground truth is needed to catch them. Whatever the correct citation is,
 * it never contains an empty bracket or a doubled comma. So this enumerates the
 * optional-field subsets for every type and asserts what must hold of ANY valid
 * output.
 *
 *   npx tsx scripts/render-invariants.ts [--type reported-case-nz] [--all]
 */
import { buildCitation, visibleComponents } from "../src/engine/build.ts";
import { guideTypes, type GuideType } from "../src/data/styleGuide.ts";

const STUDENT_GROUPS = new Set([
  "Cases",
  "Legislation",
  "Parliamentary & official",
  "Secondary sources",
  "Subsequent references",
]);

const args = process.argv.slice(2);
const onlyType = args.includes("--type") ? args[args.indexOf("--type") + 1] : "";
const includeInternational = args.includes("--all");

/** A plausible value per component, so output reads like a real citation. */
function sampleValue(id: string): string {
  if (/year$/i.test(id) || id === "year") return "2019";
  if (/date/i.test(id)) return "3 August 2019";
  if (/page|volume|number|edition/i.test(id)) return "12";
  if (/pinpoint/i.test(id)) return "[26]";
  if (/url/i.test(id)) return "<www.example.com>";
  if (/name|author|editor|title|publisher|place|topic|court|series|abbrev/i.test(id)) {
    return `Sample${id[0].toUpperCase()}${id.slice(1)}`;
  }
  return `Sample${id[0].toUpperCase()}${id.slice(1)}`;
}

type Violation = {
  type: GuideType;
  omitted: string[];
  output: string;
  rule: string;
};

/** What must be true of any rendered citation, whatever its type. */
function violations(text: string): string[] {
  const found: string[] = [];
  if (!text.trim()) return found;
  const body = text.replace(/\.$/, "");
  if (/\(\s*\)|\[\s*\]|<\s*>/.test(body)) found.push("empty bracket");
  if (/,\s*,|;\s*;/.test(body)) found.push("doubled comma or semicolon");
  if (/\(\s*,|,\s*\)|\[\s*,|,\s*\]/.test(body)) found.push("comma against a bracket");
  if (/\s,|\s;/.test(body)) found.push("space before comma or semicolon");
  if (/ {2,}/.test(body)) found.push("double space");
  if (/^[\s,;.)\]]/.test(body)) found.push("leading separator");
  if (/[,;:–-]\s*$/.test(body)) found.push("trailing separator");
  if (/\.\./.test(text)) found.push("doubled full stop");
  if (!/\.$/.test(text)) found.push("no final full stop");
  if (/\s(at|in|vol|No|ed|eds|pt|art|s|ss|reg|cl|sch)\s*$/.test(body)) {
    found.push("dangling connective word");
  }
  if (/\(\s*(ed|eds)\s*\)\s*$/.test(body)) found.push("editor marker with no editor");
  for (const [open, close] of [
    ["(", ")"],
    ["[", "]"],
  ] as const) {
    const opens = (body.match(new RegExp(`\\${open}`, "g")) ?? []).length;
    const closes = (body.match(new RegExp(`\\${close}`, "g")) ?? []).length;
    if (opens !== closes) found.push(`unbalanced ${open}${close}`);
  }
  return found;
}

/** Every subset of the optional components, capped so the run stays quick. */
function subsets<T>(items: T[], cap = 4096): T[][] {
  const out: T[][] = [];
  const n = Math.min(items.length, 12);
  for (let mask = 0; mask < 1 << n; mask++) {
    if (out.length >= cap) break;
    out.push(items.filter((_, i) => i < n && (mask & (1 << i)) !== 0));
  }
  return out;
}

const found: Violation[] = [];
let rendered = 0;

for (const type of guideTypes) {
  if (onlyType && type.id !== onlyType) continue;
  if (!includeInternational && !STUDENT_GROUPS.has(type.group)) continue;
  const components = visibleComponents(type);
  const optional = components.filter((c) => !c.required).map((c) => c.id);
  const required = components.filter((c) => c.required).map((c) => c.id);
  for (const omitted of subsets(optional)) {
    const omit = new Set(omitted);
    const fields: Record<string, string> = {};
    for (const c of components) {
      if (omit.has(c.id)) continue;
      fields[c.id] = sampleValue(c.id);
    }
    // Required fields are always present: a citation missing one of those is
    // refused by design, which is correct behaviour and not what this tests.
    for (const id of required) fields[id] = sampleValue(id);
    const built = buildCitation(type.id, fields);
    if (built.status !== "ready") continue;
    rendered++;
    const bad = violations(built.text);
    if (bad.length) {
      found.push({ type, omitted, output: built.text, rule: bad.join(", ") });
    }
  }
}

const byType = new Map<string, Violation[]>();
for (const v of found) byType.set(v.type.id, [...(byType.get(v.type.id) ?? []), v]);

console.log("=".repeat(78));
console.log("RENDER INVARIANTS — every combination of omitted optional fields");
console.log("=".repeat(78));
console.log(
  `  ${rendered - found.length}/${rendered} rendered cleanly ` +
    `(${(((rendered - found.length) / rendered) * 100).toFixed(1)}%)`,
);
console.log(`  ${byType.size} of the types tested produce a malformed citation.\n`);

const ruleCounts = new Map<string, number>();
for (const v of found) {
  for (const r of v.rule.split(", ")) ruleCounts.set(r, (ruleCounts.get(r) ?? 0) + 1);
}
console.log("  By defect:");
for (const [rule, n] of [...ruleCounts.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`    ${String(n).padStart(6)}  ${rule}`);
}

console.log("\n" + "-".repeat(78));
console.log("SMALLEST FAILING CASE PER TYPE");
console.log("-".repeat(78));
for (const [, vs] of [...byType.entries()].sort((a, b) => b[1].length - a[1].length)) {
  const v = vs.slice().sort((a, b) => a.omitted.length - b.omitted.length)[0];
  console.log(`\n[${v.type.rule}] ${v.type.name}  (${vs.length} bad combinations)`);
  console.log(`  tpl     : ${v.type.outputTemplate}`);
  console.log(`  omitting: ${v.omitted.join(", ") || "(nothing)"}`);
  console.log(`  output  : ${v.output}`);
  console.log(`  defect  : ${v.rule}`);
}

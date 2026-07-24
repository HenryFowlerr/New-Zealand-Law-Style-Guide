/**
 * Accuracy scoreboard. For every worked example in the Style Guide data:
 *   1. extract component values from the example using the type's template,
 *   2. render those values back through the data-driven renderer,
 *   3. compare to the original example.
 *
 * A pass proves the template + renderer reproduce the Guide's own example
 * exactly. Failures point at templates/renderer rules that still need work.
 *
 *   npx tsx scripts/accuracy-report.ts [--show-failures]
 */
import { guideTypes } from "../src/data/styleGuide.ts";
import {
  extractByTemplate,
  renderFromTemplate,
  templateForms,
  tokensToText,
} from "../src/engine/render.ts";

const showFailures = process.argv.includes("--show-failures");

const norm = (s: string) => s.trim().replace(/\.$/, "").replace(/\s+/g, " ");

type Row = { group: string; pass: number; matched: number; total: number };
const byGroup = new Map<string, Row>();
const failures: string[] = [];
const unmatched: string[] = [];

for (const type of guideTypes) {
  const row = byGroup.get(type.group) ?? {
    group: type.group,
    pass: 0,
    matched: 0,
    total: 0,
  };
  for (const example of type.examples) {
    row.total += 1;
    const values = extractByTemplate(type, example.correct_citation);
    if (!values) {
      unmatched.push(`[${type.id}] ${example.correct_citation}`);
      continue;
    }
    row.matched += 1;
    const rendered = templateForms(type.outputTemplate).map((form) =>
      tokensToText(renderFromTemplate(form, values)),
    );
    if (rendered.some((r) => norm(r) === norm(example.correct_citation))) {
      row.pass += 1;
    } else {
      const best = rendered[0];
      failures.push(
        `[${type.id}]\n  want: ${example.correct_citation}\n  got:  ${best}`,
      );
    }
  }
  byGroup.set(type.group, row);
}

let pass = 0;
let matched = 0;
let total = 0;
console.log("\nAccuracy by group (round-trip of the Guide's own examples):\n");
for (const row of byGroup.values()) {
  pass += row.pass;
  matched += row.matched;
  total += row.total;
  console.log(
    `  ${row.group.padEnd(26)} ${String(row.pass).padStart(3)}/${String(
      row.total,
    ).padStart(3)} pass   (${row.matched}/${row.total} matched template)`,
  );
}
console.log(
  `\n  TOTAL ${pass}/${total} examples reproduced exactly (${(
    (pass / total) *
    100
  ).toFixed(1)}%); ${matched}/${total} matched the template.\n`,
);

if (showFailures) {
  console.log(`\n--- ${failures.length} RENDER MISMATCHES ---`);
  for (const f of failures) console.log(f);
  console.log(`\n--- ${unmatched.length} DID NOT MATCH TEMPLATE ---`);
  for (const u of unmatched) console.log(u);
}

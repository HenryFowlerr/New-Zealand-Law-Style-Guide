/** Classify the paste→output failures by defect shape. */
import { detectTypes, prefillFromPaste, buildCitation, missingRequiredComponents } from "../src/engine/build.ts";
import { guideTypes } from "../src/data/styleGuide.ts";

const norm = (s: string) => s.replace(/\s+/g, " ").trim();

type Row = { rule: string; name: string; want: string; got: string; fields: Record<string,string>; missing: string[]; kind: string };
const rows: Row[] = [];

/** Longest repeated adjacent substring — the signature of a double-written field. */
function repeatedRun(s: string): string {
  const words = s.split(/\s+/);
  let best = "";
  for (let n = 1; n <= Math.floor(words.length / 2); n++) {
    for (let i = 0; i + 2 * n <= words.length; i++) {
      const a = words.slice(i, i + n).join(" ");
      const b = words.slice(i + n, i + 2 * n).join(" ");
      if (a.replace(/[(),.[\]]/g, "") === b.replace(/[(),.[\]]/g, "") && a.replace(/\W/g,"").length > best.replace(/\W/g,"").length) best = a;
    }
  }
  return best;
}

for (const type of guideTypes) {
  for (const ex of type.examples ?? []) {
    const text = ex.correct_citation;
    if (!text?.trim()) continue;
    const fields = prefillFromPaste(type, text, []);
    const missing = missingRequiredComponents(type, fields).map((c) => c.id);
    const got = buildCitation(type.id, fields).text ?? "";
    if (norm(got) === norm(text)) continue;
    let kind: string;
    const rep = repeatedRun(got);
    if (!got) kind = "REFUSED";
    else if (rep) kind = `DUPLICATE:"${rep}"`;
    else if (norm(text).startsWith(norm(got).replace(/\.$/, "")) || norm(text).length > norm(got).length + 3) kind = "TRUNCATED/DROPPED";
    else kind = "OTHER";
    rows.push({ rule: type.rule, name: type.name, want: text, got, fields, missing, kind });
  }
}

const byKind = new Map<string, number>();
for (const r of rows) {
  const k = r.kind.split(":")[0];
  byKind.set(k, (byKind.get(k) ?? 0) + 1);
}
console.log(`total failures: ${rows.length}`);
for (const [k, n] of [...byKind].sort((a,b)=>b[1]-a[1])) console.log(`  ${String(n).padStart(3)}  ${k}`);

console.log("\n--- DUPLICATE ---");
for (const r of rows.filter(r=>r.kind.startsWith("DUPLICATE"))) {
  console.log(`\n[${r.rule}] ${r.name}  ${r.kind}`);
  console.log(`  want: ${r.want}`);
  console.log(`  got : ${r.got}`);
  console.log(`  fields: ${JSON.stringify(r.fields)}`);
}
console.log("\n--- OTHER / TRUNCATED ---");
for (const r of rows.filter(r=>!r.kind.startsWith("DUPLICATE") && r.kind!=="REFUSED")) {
  console.log(`\n[${r.rule}] ${r.name}  ${r.kind}`);
  console.log(`  want: ${r.want}`);
  console.log(`  got : ${r.got}`);
  console.log(`  fields: ${JSON.stringify(r.fields)}`);
}
console.log("\n--- REFUSED ---");
for (const r of rows.filter(r=>r.kind==="REFUSED")) {
  console.log(`\n[${r.rule}] ${r.name}  missing=${r.missing.join(",")}`);
  console.log(`  want: ${r.want}`);
  console.log(`  fields: ${JSON.stringify(r.fields)}`);
}

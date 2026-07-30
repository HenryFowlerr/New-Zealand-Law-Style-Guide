/**
 * Audit the engine against the PUBLISHED Style Guide, not our ingested copy.
 *
 * For each citation read off lawfoundation.org.nz, with the correct source type
 * already chosen (so this measures the citation, not the type detection):
 *
 *   A. can the type's template read it at all?
 *   B. does the engine rebuild it EXACTLY, character for character?
 *   C. is this example present in our ingested data, or did we never have it?
 *
 * C matters most. Where a citation the Guide prints is missing from our JSON,
 * every test we had was blind to it.
 *
 *   npx tsx scripts/guide-audit.ts [--failures]
 */
import { buildCitation, prefillFromPaste, missingRequiredComponents } from "../src/engine/build.ts";
import { guideTypeById, guideTypes } from "../src/data/styleGuide.ts";
import { GUIDE_CORPUS } from "../tests/fixtures/guide-corpus.ts";

const norm = (s: string) => s.replace(/\s+/g, " ").trim();

const ingested = new Set<string>();
for (const t of guideTypes) {
  for (const e of t.examples ?? []) ingested.add(norm(e.correct_citation));
}

type Row = {
  typeId: string;
  rule: string;
  want: string;
  got: string;
  exact: boolean;
  missing: string[];
  inData: boolean;
};

const rows: Row[] = [];
for (const entry of GUIDE_CORPUS) {
  const type = guideTypeById[entry.typeId];
  if (!type) {
    console.error(`unknown type id in corpus: ${entry.typeId}`);
    continue;
  }
  const fields = prefillFromPaste(type, entry.text, []);
  const built = buildCitation(type.id, fields);
  rows.push({
    typeId: entry.typeId,
    rule: entry.rule,
    want: entry.text,
    got: built.text ?? "",
    exact: (built.text ?? "") === entry.text,
    missing: missingRequiredComponents(type, fields).map((c) => c.id),
    inData: ingested.has(norm(entry.text)),
  });
}

const exact = rows.filter((r) => r.exact);
const novel = rows.filter((r) => !r.inData);
const novelExact = novel.filter((r) => r.exact);

console.log("=".repeat(78));
console.log("GUIDE AUDIT — engine output vs the published Style Guide");
console.log("=".repeat(78));
console.log(`  citations checked        : ${rows.length}`);
console.log(`  rebuilt exactly          : ${exact.length}/${rows.length} (${((exact.length / rows.length) * 100).toFixed(1)}%)`);
console.log(`  NOT in our ingested data : ${novel.length}`);
console.log(`    of those, exact        : ${novelExact.length}/${novel.length} (${novel.length ? ((novelExact.length / novel.length) * 100).toFixed(1) : "—"}%)`);

const byType = new Map<string, Row[]>();
for (const r of rows) byType.set(r.typeId, [...(byType.get(r.typeId) ?? []), r]);

console.log("\n  By source type:");
for (const [id, rs] of [...byType.entries()].sort((a, b) => {
  const fa = a[1].filter((r) => !r.exact).length;
  const fb = b[1].filter((r) => !r.exact).length;
  return fb - fa;
})) {
  const ok = rs.filter((r) => r.exact).length;
  const flag = ok === rs.length ? "  " : "!!";
  console.log(`   ${flag} ${String(ok).padStart(3)}/${String(rs.length).padEnd(3)}  ${guideTypeById[id].name}`);
}

const failures = rows.filter((r) => !r.exact);
console.log("\n" + "-".repeat(78));
console.log(`FAILURES (${failures.length})`);
console.log("-".repeat(78));
for (const r of failures) {
  console.log(`\n[${r.rule}] ${guideTypeById[r.typeId].name}${r.inData ? "" : "   ← not in our data"}`);
  console.log(`  want: ${r.want}`);
  console.log(`  got : ${r.got || `(refused — missing ${r.missing.join(", ")})`}`);
}

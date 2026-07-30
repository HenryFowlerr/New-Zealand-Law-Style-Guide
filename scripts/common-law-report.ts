/**
 * How good is the tool at the citations a New Zealand common-law essay
 * actually contains?
 *
 * Not the whole Guide, and not weighted by how many worked examples a type
 * happens to have. This is the working set: the cases themselves, the English
 * and Australian authority a New Zealand court reasons from, the statutes that
 * sit alongside them, and the texts, chapters and articles used to discuss them.
 *
 * Three separate questions, because they fail for different reasons:
 *
 *   RENDER  — correct values in the right boxes: is the citation right?
 *             This is the guarantee. It must be 100%.
 *   READ    — pasted as printed: are the values put in the right boxes?
 *   PICK    — pasted as printed: is the right source type ranked first?
 *
 *   npx tsx scripts/common-law-report.ts
 */
import {
  buildCitation,
  detectTypes,
  prefillFromPaste,
} from "../src/engine/build.ts";
import { extractByTemplate } from "../src/engine/render.ts";
import { guideTypeById, guideTypes } from "../src/data/styleGuide.ts";
import { GUIDE_CORPUS } from "../tests/fixtures/guide-corpus.ts";
import { FIELD_TRUTH } from "../tests/fixtures/field-truth.ts";

/** The citations a common-law essay is built from. */
const WORKING_SET: { id: string; why: string }[] = [
  { id: "reported-case-nz", why: "the reported New Zealand case" },
  { id: "neutral-citation-case-nz", why: "unreported, neutral citation" },
  { id: "unreported-case-file-number-nz", why: "unreported, file number" },
  { id: "england-wales-case-modern", why: "English authority" },
  { id: "australia-case", why: "Australian authority" },
  { id: "canada-case", why: "Canadian authority" },
  { id: "nz-statute", why: "the statute alongside the case law" },
  { id: "legislative-instrument", why: "regulations" },
  { id: "text-book", why: "the textbook" },
  { id: "essay-in-edited-book", why: "a chapter in a collection" },
  { id: "journal-article", why: "the journal article" },
  { id: "looseleaf-online-commentary", why: "Adams, Cross on Evidence" },
  { id: "laws-of-new-zealand", why: "the encyclopaedia" },
  { id: "subsequent-references", why: "above n — used in every footnote block" },
];

type Score = { pass: number; total: number };
const blank = (): Score => ({ pass: 0, total: 0 });

const render = new Map<string, Score>();
const read = new Map<string, Score>();
const pick = new Map<string, Score>();
for (const t of WORKING_SET) {
  render.set(t.id, blank());
  read.set(t.id, blank());
  pick.set(t.id, blank());
}

const bump = (m: Map<string, Score>, id: string, ok: boolean) => {
  const s = m.get(id);
  if (!s) return;
  s.total++;
  if (ok) s.pass++;
};

// RENDER — hand-written field sets, expected against the Guide verbatim.
for (const truth of FIELD_TRUTH) {
  if (!render.has(truth.typeId)) continue;
  const built = buildCitation(truth.typeId, truth.fields);
  bump(render, truth.typeId, built.text === truth.want);
}
// Plus every Guide example whose fields the template can derive unambiguously.
for (const type of guideTypes) {
  if (!render.has(type.id)) continue;
  for (const ex of type.examples ?? []) {
    const fields = extractByTemplate(type, ex.correct_citation);
    if (!fields) continue;
    const built = buildCitation(type.id, fields);
    if (built.status !== "ready") continue;
    bump(render, type.id, built.text === ex.correct_citation);
  }
}

// READ and PICK — pasted exactly as the Guide prints it.
for (const entry of GUIDE_CORPUS) {
  if (!read.has(entry.typeId)) continue;
  const type = guideTypeById[entry.typeId];
  const built = buildCitation(type.id, prefillFromPaste(type, entry.text, []));
  bump(read, entry.typeId, (built.text ?? "") === entry.text);
  bump(pick, entry.typeId, detectTypes(entry.text, 1)[0]?.typeId === entry.typeId);
}

const pct = (s: Score) => (s.total ? Math.round((s.pass / s.total) * 100) : null);
const cell = (s: Score) => {
  const p = pct(s);
  if (p === null) return "     —";
  return `${String(p).padStart(3)}% ${String(s.pass).padStart(2)}/${String(s.total).padEnd(2)}`;
};

console.log("=".repeat(86));
console.log("THE COMMON-LAW WORKING SET");
console.log("=".repeat(86));
console.log(`${"".padEnd(34)}  RENDER      READ        PICK`);
console.log(`${"".padEnd(34)}  fields ok   from paste  right type`);
console.log("-".repeat(86));
for (const t of WORKING_SET) {
  const name = guideTypeById[t.id].name;
  const label = name.length > 32 ? `${name.slice(0, 31)}…` : name;
  console.log(
    `${label.padEnd(34)}  ${cell(render.get(t.id)!)}  ${cell(read.get(t.id)!)}  ${cell(pick.get(t.id)!)}`,
  );
}

const totals = (m: Map<string, Score>) =>
  [...m.values()].reduce((a, s) => ({ pass: a.pass + s.pass, total: a.total + s.total }), blank());
console.log("-".repeat(86));
console.log(
  `${"WORKING SET".padEnd(34)}  ${cell(totals(render))}  ${cell(totals(read))}  ${cell(totals(pick))}`,
);

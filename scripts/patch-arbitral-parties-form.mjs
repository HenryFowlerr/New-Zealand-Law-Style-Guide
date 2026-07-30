/**
 * NZLSG 10.3.2 cites an unreported arbitral decision two ways, and our copy had
 * only the one with a separate case name.
 *
 * The published rule's own worked examples are
 *
 *   Arrest and Return of Savarkar (France v Great Britain) (Award) PCA 24 February 1911.
 *   Abaclat v Argentina (Jurisdiction and Admissibility) ICSID ARB/07/5, 4 August 2011 at [293].
 *
 * The first names the dispute and then the parties in brackets; the second has no
 * separate name at all — the parties ARE the name, unbracketed. The single
 * ingested template writes "(*{parties}*)" unconditionally, so the second came out
 * "(Abaclat v Argentina) (Jurisdiction and Admissibility) …" with brackets the
 * Guide does not print.
 *
 * A form without the case-name slot expresses it. `chooseForm` takes it only when
 * there is no case name to place, because otherwise the first form leaves fewer
 * of its own slots empty.
 *
 * Read off <https://lawfoundation.org.nz/style-guide2018/chapter-pt.10.3.html>.
 */
import { readFileSync, writeFileSync } from "node:fs";

const path = new URL("../src/data/styleGuide.json", import.meta.url);
const data = JSON.parse(readFileSync(path, "utf8"));
const type = data.types.find((t) => t.id === "international-arbitral-unreported");
if (!type) throw new Error("international-arbitral-unreported not found");

type.outputTemplate = [
  "*{caseName}* (*{parties}*) (*{phase}*) {arbitralBody} {caseNumber}, {date} at {pinpoint}",
  "*{caseName}* (*{parties}*) (*{phase}*) {arbitralBody} {date} at {pinpoint}",
  "*{parties}* (*{phase}*) {arbitralBody} {caseNumber}, {date} at {pinpoint}",
  "*{parties}* (*{phase}*) {arbitralBody} {date} at {pinpoint}",
].join(" | ");

writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
console.log("international-arbitral-unreported: the unbracketed-parties form of rule 10.3.2 added");

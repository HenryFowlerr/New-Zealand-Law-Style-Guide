/**
 * NZLSG 8.5 cites a Scottish case two ways, and our copy of the rule had one.
 *
 *   Glenday v Johnston (1905) 13 SLT 467 (IH)                    — by report
 *   Inveresk plc v Tullis Russell Papermakers Ltd [2009] CSIH 56 — by neutral citation
 *
 * The single ingested template demanded a year and a report series for both, so
 * the second refused to build: the Guide's own illustration of the rule produced
 * nothing at all.
 *
 * The second form needs neither. Validation now asks only for what the form being
 * used actually has a slot for — see `requiredForChosenForm` in build.ts, and
 * `npm run qa:forms`, which is what makes that safe.
 *
 * Read off <https://lawfoundation.org.nz/style-guide2018/chapter-pt.8.5.html>.
 */
import { readFileSync, writeFileSync } from "node:fs";

const path = new URL("../src/data/styleGuide.json", import.meta.url);
const data = JSON.parse(readFileSync(path, "utf8"));
const type = data.types.find((t) => t.id === "scotland-case");
if (!type) throw new Error("scotland-case not found");

type.outputTemplate = [
  "*{caseName}* {neutralCitation} {year} {volume} {reportSeries} {startingPage} ({court})",
  "*{caseName}* {neutralCitation}",
].join(" | ");

writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
console.log("scotland-case: the neutral-citation-only form of rule 8.5 added");

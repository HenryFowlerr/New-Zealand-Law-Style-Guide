/**
 * NZLSG 10.2.1 prints the year of an ICJ decision in SQUARE brackets and the year
 * of a PCIJ decision in ROUND ones, and the ingested template hard-coded square:
 *
 *   Military and Paramilitary Activities … (Merits) [1986] ICJ Rep 14 at 55.
 *   Factory at Chorzów (Germany v Poland) (Merits) (1928) PCIJ (series A) No 13 at 47.
 *
 * Both are the Guide's own worked examples under the same rule, so a template that
 * can only write one of them produced "[(1928)]" for the other.
 *
 * The fix is the one the Guide's own structure implies and that rules 8.5 and
 * 10.5.3 already use: the slot does not supply brackets, and the year carries the
 * ones its report series uses. The bracket style IS the information — square for a
 * year-organised report, round otherwise — so it belongs in the value.
 */
import { readFileSync, writeFileSync } from "node:fs";

const path = new URL("../src/data/styleGuide.json", import.meta.url);
const data = JSON.parse(readFileSync(path, "utf8"));
const type = data.types.find((t) => t.id === "icj-pcij-decision");
if (!type) throw new Error("icj-pcij-decision not found");

type.outputTemplate =
  "*{caseName}* (*{parties}*) (*{phase}*) {year} {volume} {publication} {pageOrCaseNumber} at {pinpoint}";
const year = type.components.find((c) => c.id === "year");
if (year) {
  year.formatting =
    "square brackets [1986] for a year-organised report (ICJ Rep); round brackets (1928) otherwise (PCIJ) — give the brackets as the report prints them";
}

writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
console.log("icj-pcij-decision: the year carries its own brackets (rule 10.2.1)");

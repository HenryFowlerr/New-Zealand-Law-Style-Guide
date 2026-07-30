/**
 * NZLSG 8.5 cites a Scottish case with a VOLUME number, and the ingestion
 * dropped it.
 *
 * The published Guide's own second example under 8.5 is
 *
 *   Glenday v Johnston (1905) 13 SLT 467 (IH)
 *
 * where "13" is the volume of the Scottish Law Times. Our copy of the rule has
 * no volume component at all, so the engine had nowhere to put the 13 and
 * rebuilt the case as "Glenday v Johnston (1905) SLT 467 (IH)" — a citation that
 * will not find the case.
 *
 * Read off <https://lawfoundation.org.nz/style-guide2018/chapter-pt.8.5.html>,
 * which prescribes: year (bracketed for a volume-organised series, unbracketed
 * for a year-organised one), report series, page, court identifier — with the
 * volume between the year and the series where the series carries one. The
 * Guide's first example, "Musaj v Secretary of State for the Home Department
 * 2004 SLT 623 (OH)", is the year-organised form and has no volume, so the
 * component is optional.
 */
import { readFileSync, writeFileSync } from "node:fs";

const path = new URL("../src/data/styleGuide.json", import.meta.url);
const data = JSON.parse(readFileSync(path, "utf8"));
const type = data.types.find((t) => t.id === "scotland-case");
if (!type) throw new Error("scotland-case not found");

type.outputTemplate =
  "*{caseName}* {neutralCitation} {year} {volume} {reportSeries} {startingPage} ({court})";

if (!type.components.some((c) => c.id === "volume")) {
  const series = type.components.findIndex((c) => c.id === "reportSeries");
  type.components.splice(series, 0, {
    id: "volume",
    label: "Volume",
    required: false,
    italic: false,
    separatorBefore: "space",
    includedWhen: "included where the report series is volume-organised (rule 8.5)",
    omittedWhen: "omitted for a year-organised series",
  });
}

writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
console.log("scotland-case: volume element restored from the published Guide");

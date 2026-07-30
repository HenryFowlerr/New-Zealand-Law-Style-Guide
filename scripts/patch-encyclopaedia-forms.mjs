/**
 * NZLSG 6.5 is two rules, and the ingestion flattened them into one template
 * with a slot the online form does not have.
 *
 * 6.5.1 (hardcopy) prescribes: title, edition, reissue (if available), year,
 * volume/binder (if needed), topic, pinpoint.
 *
 *   Halsbury's Laws of England (4th ed, reissue, 1998) vol 9(1) Contract at [859]
 *
 * 6.5.2 (online) says to "cite online editions of legal encyclopaedias in the
 * same way as hardcopy editions but add 'online ed' after the year of
 * publication", and its elements are title, edition, YEAR, "online ed", volume,
 * topic, pinpoint — with no reissue element at all.
 *
 *   Halsbury's Laws of England (5th ed, 2012, online ed) vol 22 Contract at [231]
 *
 * The single ingested template, "({edition}, {reissue}, {year}, {onlineEd})",
 * meant the extractor read that "2012" into the reissue box and "online ed" into
 * the year box, and the citation came back "(5th ed, 2012, 2012)". Splitting the
 * two forms lets each be read by the rule that governs it.
 *
 * Read off <https://lawfoundation.org.nz/style-guide2018/chapter-pt.6.5.html>,
 * <chapter-pt.6.5.2.html>. The Guide also states there that from Halsbury's 5th
 * edition onwards no reissue information is needed at all; that condition is
 * enforced in src/engine/rules.ts.
 */
import { readFileSync, writeFileSync } from "node:fs";

const path = new URL("../src/data/styleGuide.json", import.meta.url);
const data = JSON.parse(readFileSync(path, "utf8"));
const type = data.types.find((t) => t.id === "legal-encyclopaedia");
if (!type) throw new Error("legal-encyclopaedia not found");

const hardcopy = "{title} ({edition}, {reissue}, {year}) vol {volume} {topic} at {pinpoint}";
const online = "{title} ({edition}, {year}, {onlineEd}) vol {volume} {topic} at {pinpoint}";
type.outputTemplate = `${hardcopy} | ${online}`;

const onlineEd = type.components.find((c) => c.id === "onlineEd");
if (onlineEd) {
  onlineEd.separatorBefore = "', ' (after the year)";
  onlineEd.includedWhen = "included for the online edition, after the year (rule 6.5.2)";
  onlineEd.omittedWhen = "omitted for hardcopy";
}
const reissue = type.components.find((c) => c.id === "reissue");
if (reissue) {
  reissue.omittedWhen =
    "unnecessary for Halsbury 5th ed onwards; no reissue element in the online form (rule 6.5.2)";
}

writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
console.log("legal-encyclopaedia: hardcopy (6.5.1) and online (6.5.2) forms separated");

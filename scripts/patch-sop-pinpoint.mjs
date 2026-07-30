/**
 * NZLSG 4.2.3 introduces a supplementary order paper's pinpoint with " at ", and
 * the ingested template ran the two together.
 *
 * The published rule's own worked example is
 *
 *   Supplementary Order Paper 2006 (79) Evidence Bill 2005 (256-1) (explanatory note) at 3.
 *
 * and our template was "Supplementary Order Paper {year} ({sopNumber})
 * {billCitation} {pinpoint}", which produced "… (explanatory note) 3." — a
 * pinpoint a reader cannot tell from part of the Bill citation.
 *
 * Read off <https://lawfoundation.org.nz/style-guide2018/chapter-pt.4.2.3.html>.
 * The rule text describes the pinpoint as following the Bill citation; the
 * worked example shows the "at", and where the two differ the example is what a
 * reader will be checked against.
 */
import { readFileSync, writeFileSync } from "node:fs";

const path = new URL("../src/data/styleGuide.json", import.meta.url);
const data = JSON.parse(readFileSync(path, "utf8"));
const type = data.types.find((t) => t.id === "supplementary-order-paper");
if (!type) throw new Error("supplementary-order-paper not found");

type.outputTemplate =
  "Supplementary Order Paper {year} ({sopNumber}) {billCitation} at {pinpoint}";
const pinpoint = type.components.find((c) => c.id === "pinpoint");
if (pinpoint) pinpoint.separatorBefore = "' at '";

writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
console.log("supplementary-order-paper: pinpoint is introduced by ' at ' (rule 4.2.3)");

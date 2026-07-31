/**
 * NZLSG 2.3.1(a) gives a subsequent reference two shapes, and our copy had one.
 *
 *   R v Wang, above n 49, at 533     — 2.3.1(a)(i),  a case or a text
 *   Securities Act, s 63             — 2.3.1(a)(ii), legislation
 *
 * Legislation takes neither part of the other form: no "above n x", because a
 * statute is identified by its short title rather than by a footnote back-
 * reference, and no "at", because the section follows the comma directly. The
 * single ingested template wrote both, so the Guide's own example of the rule
 * came out as "Securities Act, at s 63." — a citation no NZLSG page contains.
 *
 * Note this is NOT a general "a division label drops the at" rule. The Guide
 * writes "at cl 5" (4.3.2) and "at ch 1" elsewhere; what is specific here is the
 * subsequent-reference form for legislation.
 *
 * Read off <https://lawfoundation.org.nz/style-guide2019/chapter-pt.2.3.html>.
 */
import { readFileSync, writeFileSync } from "node:fs";

const path = new URL("../src/data/styleGuide.json", import.meta.url);
const data = JSON.parse(readFileSync(path, "utf8"));
const type = data.types.find((t) => t.id === "subsequent-references");
if (!type) throw new Error("subsequent-references not found");

type.outputTemplate = [
  "{identifier}, above n {footnoteNumber}, at {pinpoint}",
  "{identifier}, {pinpoint}",
].join(" | ");

type.parseStructure =
  "[Identifier] [', above n ' x ','] [' at ' pinpoint] — legislation takes " +
  "'{identifier}, {pinpoint}' (2.3.1(a)(ii)) — or just 'At ' pinpoint where the source is obvious.";

writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
console.log("subsequent-references: rule 2.3.1(a)(ii)'s legislation form added");

/**
 * NZLSG 6.2 requires "(ed)" after the editor of a collection, and the ingested
 * template had no such literal — so every edited-book citation the tool
 * produced was missing it. The Guide also covers the case where a collection
 * has no identified editor: the essay authors are then given as the book's
 * authors, in the same position but WITHOUT the marker. That needs a slot of
 * its own, so the two are not conflated.
 */
import { readFileSync, writeFileSync } from "node:fs";

const path = new URL("../src/data/styleGuide.json", import.meta.url);
const data = JSON.parse(readFileSync(path, "utf8"));
const type = data.types.find((t) => t.id === "essay-in-edited-book");
if (!type) throw new Error("essay-in-edited-book not found");

const withEd =
  '{author} “{essayTitle}” in {editor} (ed) {bookTitle} ({edition}, {publisher}, {place}, {year}) {startingPage} at {pinpoint}';
const withAuthors =
  '{author} “{essayTitle}” in {bookAuthors} {bookTitle} ({edition}, {publisher}, {place}, {year}) {startingPage} at {pinpoint}';
const bare =
  '{author} “{essayTitle}” in {bookTitle} ({edition}, {publisher}, {place}, {year}) {startingPage} at {pinpoint}';
type.outputTemplate = [withEd, withAuthors, bare].join(" | ");

if (!type.components.some((c) => c.id === "bookAuthors")) {
  const editor = type.components.find((c) => c.id === "editor");
  type.components.push({
    id: "bookAuthors",
    label: "Book authors (collection with no editor)",
    required: false,
    italic: false,
    order: (editor?.order ?? 3) + 0.5,
    separatorBefore: "in",
    includedWhen:
      "used instead of an editor where the collection names no editor: give the essay/chapter authors as the book's authors",
    omittedWhen: "omit whenever an editor is named",
    formatting:
      "all authors if three or fewer, otherwise the first author followed by 'and others'; no '(ed)' marker",
    notes: "NZLSG 6.2",
  });
  type.components.sort((a, b) => a.order - b.order);
}

writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
console.log("patched:", type.outputTemplate);

/**
 * The "(ed)" marker is not unique to an essay in an edited collection. The
 * Guide prints it wherever a named editor stands where an author would:
 *
 *   Simon France (ed) Adams on Criminal Law – Evidence (looseleaf ed, …)   6.3
 *   Peter Blanchard (ed) Civil Remedies in New Zealand (2nd ed, …)         6.1.2
 *   HG Beale (ed) Chitty on Contracts (32nd ed, …) vol 2 at [38–033]       6.1.8
 *
 * Neither template carried the literal, so every one of those citations was
 * produced without it. Each type gains a form WITH the marker for when an
 * editor is named, and keeps its existing form for when one is not; the
 * renderer picks whichever fits the fields actually held.
 */
import { readFileSync, writeFileSync } from "node:fs";

const path = new URL("../src/data/styleGuide.json", import.meta.url);
const data = JSON.parse(readFileSync(path, "utf8"));

const editorComponent = (order) => ({
  id: "editor",
  label: "Editor",
  required: false,
  italic: false,
  order,
  separatorBefore: "",
  includedWhen:
    "included where the work names an editor rather than an author; followed by the '(ed)' or '(eds)' marker",
  omittedWhen: "omit where the work names an author",
  formatting:
    "as for an author; the marker follows the name in round brackets, '(ed)' for one editor and '(eds)' for more",
  notes: "NZLSG 6.1.2, 6.3",
});

// 6.3 — online commentary / looseleaf text.
const looseleaf = data.types.find((t) => t.id === "looseleaf-online-commentary");
looseleaf.outputTemplate = [
  "{editor} (ed) {title} ({edition}, {publisher}) at {pinpoint}",
  "{title} ({edition}, {publisher}) at {pinpoint}",
].join(" | ");

// 6.1 — a text cited to its editor rather than an author.
const book = data.types.find((t) => t.id === "text-book");
const bookBase =
  "{title} ({edition}, {publisher}, {placeOfPublication}, {year}) vol {volume} at {pinpoint}";
book.outputTemplate = [
  `{author} ${bookBase}`,
  `{editor} (ed) ${bookBase}`,
].join(" | ");
if (!book.components.some((c) => c.id === "editor")) {
  const author = book.components.find((c) => c.id === "author");
  book.components.push(editorComponent((author?.order ?? 1) + 0.5));
  book.components.sort((a, b) => a.order - b.order);
}

writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
console.log("6.3:", looseleaf.outputTemplate);
console.log("6.1:", book.outputTemplate);

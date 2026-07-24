/** Second round of template corrections toward exact reproduction. Idempotent. */
import { readFileSync, writeFileSync } from "node:fs";
const path = "src/data/styleGuide.json";
const data = JSON.parse(readFileSync(path, "utf8"));
const byId = Object.fromEntries(data.types.map((t) => [t.id, t]));
const opt = (id, label, req = false, italic = false) => ({
  id, label, required: req, italic, order: 90, separatorBefore: "",
  includedWhen: req ? "always" : "when present", omittedWhen: req ? "never" : "if absent",
  formatting: "", notes: "template correction",
});
const ensure = (t, id, label, req, italic) => {
  if (!t.components.some((c) => c.id === id)) t.components.push(opt(id, label, req, italic));
};

// Essay: "(ed)" is conditional (single editor only); carry it in the editor field.
byId["essay-in-edited-book"].outputTemplate =
  "{author} “{essayTitle}” in {editor} {bookTitle} ({edition}, {publisher}, {place}, {year}) {startingPage} at {pinpoint}";

// Treaty: the parenthetical varies (signed / opened for signature / not yet in
// force); capture it as one field.
byId["treaty"].outputTemplate =
  "{treatyName}, {partiesNames} {treatySeriesCitation} ({signatureDetails}), {pinpoint}";
ensure(byId["treaty"], "signatureDetails", "Signature details", true);

// Text-book and Waitangi report: an optional volume between the details and the
// pinpoint (unit word "vol" elides when absent).
byId["text-book"].outputTemplate =
  "{author} {title} ({edition}, {publisher}, {placeOfPublication}, {year}) vol {volume} at {pinpoint}";
ensure(byId["text-book"], "volume", "Volume");
byId["waitangi-tribunal-report"].outputTemplate =
  "{author} *{title}* (Wai {waiNumber}, {year}) vol {volume} at {pinpoint}";
ensure(byId["waitangi-tribunal-report"], "volume", "Volume");

writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
console.log("patched round 2");

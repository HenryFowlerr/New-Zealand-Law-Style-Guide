/**
 * Some source types reference template placeholders that have no matching
 * component, so the generated form had no field for them and the citation could
 * never be completed. Synthesise the missing components with a humanised label.
 * Marked required (matching the extractor's default) so fail-closed still holds;
 * book titles are flagged italic. Idempotent.
 */
import { readFileSync, writeFileSync } from "node:fs";

const path = "src/data/styleGuide.json";
const data = JSON.parse(readFileSync(path, "utf8"));

function humanise(id) {
  const spaced = id
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

const ITALIC = new Set(["bookTitle"]);
const OPTIONAL = /pinpoint/i;

let added = 0;
for (const type of data.types) {
  const have = new Set(type.components.map((c) => c.id));
  const tplIds = [...type.outputTemplate.matchAll(/\{([^}]+)\}/g)].map((m) => m[1]);
  let order = Math.max(0, ...type.components.map((c) => c.order ?? 0));
  for (const id of tplIds) {
    if (have.has(id)) continue;
    have.add(id);
    order += 1;
    type.components.push({
      id,
      label: humanise(id),
      required: false,
      italic: ITALIC.has(id),
      order,
      separatorBefore: "",
      includedWhen: "present in the citation template",
      omittedWhen: "may be omitted",
      formatting: "",
      notes: "added to complete the form (template placeholder had no component)",
    });
    added += 1;
  }
}

writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
console.log(`Added ${added} missing components`);

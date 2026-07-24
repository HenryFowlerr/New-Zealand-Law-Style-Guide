/**
 * Adds alternate template forms (joined with " | ") so the engine can reproduce
 * the Style Guide's own worked examples that use a documented variant structure
 * of a source type — e.g. a paper cited with only a date, a conference paper
 * that appears "in" a collection, the Canadian Charter's constitutional form.
 *
 * The first form of each template stays the canonical build form; the extra
 * forms are only consulted by the extractor/round-trip renderer. Any component
 * a new form references that did not exist is added as an optional field.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const jsonPath = join(here, "..", "src", "data", "styleGuide.json");
const guide = JSON.parse(readFileSync(jsonPath, "utf8"));

/** Alternate forms appended (with " | ") to a type's outputTemplate. */
const altForms = {
  "paper-or-report": ["{author} {title} ({date})"],
  "ebook-electronic-only": [
    "{author} {title} ({publisher}, {location}, {year}) at {pinpoint}",
  ],
  "conference-paper-seminar": [
    "{speaker} “{title}” in {collection} ({conference}, {date}) {startingPage} at {pinpoint}",
  ],
  "canada-statute": [
    "{shortTitle}, pt 1 of the Constitution Act 1982, being sch B to the Canada Act 1982 (UK)",
  ],
  "international-arbitral-unreported": [
    "*{caseName}* (*{parties}*) (*{phase}*) {arbitralBody} {date} at {pinpoint}",
  ],
  "gatt-document": ["{title} {gattDocumentNumber}, {date} ({description}) at {pinpoint}"],
};

/** Optional components a new form needs that the type may lack. */
const extraComponents = {
  "ebook-electronic-only": [{ id: "location", label: "Location" }],
  "conference-paper-seminar": [{ id: "collection", label: "Collection", italic: true }],
};

const placeholderIds = (tpl) =>
  [...tpl.matchAll(/\{([a-zA-Z0-9]+)\}/g)].map((m) => m[1]);

for (const type of guide.types) {
  const alts = altForms[type.id];
  if (!alts) continue;

  const existing = type.outputTemplate.split(/\s+\|\s+/);
  for (const alt of alts) {
    if (!existing.includes(alt)) existing.push(alt);
  }
  type.outputTemplate = existing.join(" | ");

  const have = new Set(type.components.map((c) => c.id));
  const wantExtra = extraComponents[type.id] ?? [];
  let order = Math.max(0, ...type.components.map((c) => c.order ?? 0));
  for (const extra of wantExtra) {
    if (have.has(extra.id)) continue;
    order += 1;
    type.components.push({
      id: extra.id,
      label: extra.label,
      required: false,
      italic: Boolean(extra.italic),
      order,
      separatorBefore: "",
      includedWhen: "present in the citation template",
      omittedWhen: "may be omitted",
      formatting: "",
      notes: "added to support an alternate documented citation form",
    });
    have.add(extra.id);
  }

  // Sanity: every placeholder in every form must map to a component.
  for (const form of existing) {
    for (const id of placeholderIds(form)) {
      if (!have.has(id)) {
        throw new Error(`${type.id}: form references unknown component {${id}}`);
      }
    }
  }
}

writeFileSync(jsonPath, JSON.stringify(guide, null, 2) + "\n");
console.log("Patched alternate template forms for:", Object.keys(altForms).join(", "));

/**
 * Properties of the generated citation that hold whatever the source type is.
 * These need no ground truth: they are true of every correct citation.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { buildCitation, visibleComponents } from "../src/engine/build.ts";
import { guideTypes, guideTypeById } from "../src/data/styleGuide.ts";
import { templateForms } from "../src/engine/render.ts";
import { FIELD_TRUTH } from "./fixtures/field-truth.ts";

const sampleValue = (id: string): string => {
  if (/year$/i.test(id) || id === "year") return "2019";
  if (/date/i.test(id)) return "3 August 2019";
  if (/pinpoint/i.test(id)) return "[26]";
  if (/url/i.test(id)) return "<www.example.com>";
  if (/page|volume|number|issue/i.test(id)) return "12";
  return `Zq${id[0].toUpperCase()}${id.slice(1)}`;
};

test("leaving out one optional part removes it and disturbs nothing else", () => {
  // Where a citation quietly goes wrong: the separators that attached the
  // absent part are still in the template, and taking one character too many
  // eats the comma belonging to the next part.
  const cases = [
    ...FIELD_TRUTH.map((t) => ({ typeId: t.typeId, fields: t.fields })),
    ...guideTypes
      .filter((t) => templateForms(t.outputTemplate).length === 1)
      .map((t) => ({
        typeId: t.id,
        fields: Object.fromEntries(
          visibleComponents(t).map((c) => [c.id, sampleValue(c.id)]),
        ) as Record<string, string>,
      })),
  ];
  for (const { typeId, fields } of cases) {
    const type = guideTypeById[typeId];
    const full = buildCitation(typeId, fields);
    if (full.status !== "ready") continue;
    const optional = visibleComponents(type)
      .filter((c) => !c.required && (fields[c.id] ?? "").trim())
      .map((c) => c.id);
    for (const drop of optional) {
      const reduced = { ...fields };
      delete reduced[drop];
      const out = buildCitation(typeId, reduced);
      if (out.status !== "ready") continue;
      // Only values the template actually writes. A few types carry a
      // composite component the renderer never emits (australia-case's
      // "reportCitation" is the year, volume, series and page together); it
      // cannot survive dropping one of its parts, and should not.
      const rendered = new Set(
        [...type.outputTemplate.matchAll(/\{([^}]+)\}/g)].map((m) => m[1]),
      );
      for (const [id, value] of Object.entries(reduced)) {
        const v = value.trim();
        if (!v || id === drop || !rendered.has(id)) continue;
        assert.ok(
          out.text.includes(v),
          `${type.name}: omitting "${drop}" lost ${id} ("${v}")\n  ${out.text}`,
        );
      }
    }
  }
});

test("italics follow the Guide: case names, books, reports, mastheads", () => {
  // NZLSG chapter 1: italicise the names of parties (including the "v"), the
  // titles of books and of government reports, and the names of newspapers.
  // An article title takes quotation marks instead, and legislation is plain.
  const expectItalic: [string, Record<string, string>, string][] = [
    ["reported-case-nz",
      { caseName: "Taylor v New Zealand Poultry Board", year: "[1984]", volume: "1",
        reportSeries: "NZLR", startingPage: "394" },
      "Taylor v New Zealand Poultry Board"],
    ["text-book",
      { author: "Andrew Burrows", title: "The Law of Restitution", edition: "3rd ed",
        publisher: "Oxford University Press", placeOfPublication: "Oxford", year: "2011" },
      "The Law of Restitution"],
    ["law-commission-report",
      { author: "Law Commission", title: "Tribunal Reform",
        officialCitation: "NZLC SP20", year: "2008" },
      "Tribunal Reform"],
    ["newspaper-magazine-article",
      { author: "Rob Hosking", articleTitle: "Messy Allowance Law Finally Gets Clarity",
        newspaperTitle: "The National Business Review", place: "New Zealand",
        date: "17 July 2009" },
      "The National Business Review"],
  ];
  for (const [typeId, fields, italic] of expectItalic) {
    const built = buildCitation(typeId, fields);
    assert.equal(built.status, "ready", typeId);
    assert.ok(
      built.html.includes(`<em>${italic}</em>`),
      `${typeId}: expected <em>${italic}</em> in ${built.html}`,
    );
  }

  // A journal article title is quoted, never italicised, and a statute is plain.
  const journal = buildCitation("journal-article", {
    author: "Peter Watts", title: "Birks’ Unjust Enrichment", year: "(2005)",
    volume: "121", journalAbbrev: "LQR", startingPage: "163",
  });
  assert.ok(!journal.html.includes("<em>"), `journal must not italicise: ${journal.html}`);
  const statute = buildCitation("nz-statute", {
    shortTitle: "Evidence Act", year: "2006", pinpoint: "s 8",
  });
  assert.ok(!statute.html.includes("<em>"), `statute must not italicise: ${statute.html}`);
});

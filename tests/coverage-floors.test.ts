/**
 * Floors for the three measures added while closing the coverage gaps.
 *
 * `scripts/render-coverage.ts`, `scripts/partial-report.ts` and
 * `scripts/link-coverage.ts` are reports, and a report cannot fail a build. Each
 * of them found real defects that every existing test was blind to, so each gets
 * a floor here: the deploy gate runs `npm test`, and a number that nothing
 * asserts is a number that drifts.
 *
 * These are FLOORS, not targets. Improve one and tighten it in the same commit —
 * that is what stops the ratchet slipping backwards later.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { guideTypes, guideTypeById } from "../src/data/styleGuide.ts";
import { buildCitation, prefillFromPaste, visibleComponents } from "../src/engine/build.ts";
import { chooseForm } from "../src/engine/render.ts";
import { recogniseNzSource } from "../src/engine/nzSources.ts";
import { FIELD_TRUTH } from "./fixtures/field-truth.ts";

const norm = (s: string) => s.replace(/\s+/g, " ").replace(/\.\s*$/, "").trim().toLowerCase();

/**
 * Every worked example the Guide prints must have a field set written BY HAND.
 * Without this the guarantee rests on the extractor and the renderer agreeing
 * with each other, which is the circular-accuracy trap in another costume.
 */
test("every Guide worked example has hand-written fields", () => {
  const have = new Set(FIELD_TRUTH.map((t) => norm(t.want)));
  const missing: string[] = [];
  for (const type of guideTypes) {
    for (const example of type.examples ?? []) {
      const text = example.correct_citation;
      if (text && !have.has(norm(text))) missing.push(`[${type.id}] ${text}`);
    }
  }
  assert.deepEqual(missing, [], `worked examples with no hand-written field set:\n${missing.join("\n")}`);
});

/**
 * A citation the Guide prints that we cannot build is a gap, and a gap must be
 * DECLARED. `knownGap` is how; an undeclared one would simply look like a pass.
 */
test("no more than the one declared template gap", () => {
  const gaps = FIELD_TRUTH.filter((t) => t.knownGap).map((t) => t.typeId);
  assert.deepEqual(
    gaps,
    ["canada-statute"],
    "a template gap was added or closed — update this floor in the same commit",
  );
});

/**
 * The URL shapes a New Zealand law student actually pastes. A legal source read
 * as "internet material" is a correctly formatted citation of the wrong kind,
 * which is the whole reason `recogniseNzSource` exists.
 */
test("every legal URL shape is recognised from the path alone", () => {
  const shapes: [string, string][] = [
    ["https://www.legislation.govt.nz/act/public/2006/0069/latest/DLM393463.html", "nz-statute"],
    ["https://www.legislation.govt.nz/regulation/public/2008/0197/latest/DLM1382100.html", "legislative-instrument"],
    ["http://www.nzlii.org/nz/cases/NZSC/2008/55.html", "neutral-citation-case-nz"],
    ["https://www.courtsofnz.govt.nz/assets/cases/2019/2019-NZSC-40.pdf", "neutral-citation-case-nz"],
    // AustLII's ordinary link, with its viewdoc prefix and a sub-jurisdiction.
    ["http://www.austlii.edu.au/cgi-bin/viewdoc/au/cases/cth/HCA/1992/23.html", "australia-case"],
    // BAILII, whose jurisdiction segment decides the rule — not the court code.
    ["https://www.bailii.org/uk/cases/UKSC/2019/41.html", "england-wales-case-modern"],
    ["https://www.bailii.org/ew/cases/EWCA/Civ/2020/1058.html", "england-wales-case-modern"],
    ["https://gazette.govt.nz/notice/id/2019-au1234", "nz-gazette"],
    ["https://www.parliament.nz/en/pb/hansard-debates/rhr/combined/HansD_20170816_20170816", "hansard"],
    // CanLII, whose path puts the court before a "/doc/" segment and the
    // citation in a slug — nothing an LII path pattern reads.
    ["https://www.canlii.org/en/ca/scc/doc/2010/2010scc2/2010scc2.html", "canada-case"],
    ["https://www.canlii.org/en/on/onca/doc/2015/2015onca100/2015onca100.html", "canada-case"],
    ["https://www.canlii.org/en/ca/laws/stat/rsc-1985-c-c-46/latest/rsc-1985-c-c-46.html", "canada-statute"],
  ];
  for (const [url, typeId] of shapes) {
    const match = recogniseNzSource(url);
    assert.ok(match, `not recognised at all: ${url}`);
    assert.equal(match.typeId, typeId, `wrong kind of source for ${url}`);
  }
});

/**
 * Rule 8.3.3: "never use CanLII pseudo-neutral citations". Where a judgment
 * predates neutral citation, CanLII puts its own identifier in the same slot of
 * the path — "1959canlii45" sits exactly where "2010scc2" does. Reading it as a
 * citation would produce "1959 SCC 45", which names a court that did not decide
 * it in a form the Guide forbids, and would look entirely correct.
 */
test("a CanLII pseudo-neutral citation is left empty, not written", () => {
  const match = recogniseNzSource(
    "https://www.canlii.org/en/ca/scc/doc/1959/1959canlii45/1959canlii45.html",
  );
  assert.ok(match, "the URL is still a Canadian case");
  assert.equal(match.typeId, "canada-case");
  assert.equal(
    match.fields.neutralCitationNoBrackets,
    undefined,
    "CanLII's own identifier must never be written as a neutral citation",
  );
  assert.ok(
    match.stillNeeded?.includes("reportCitation"),
    "the reader must be asked for the report citation instead",
  );
});

/** A subscription database must be declined by name, never guessed at. */
test("a subscription database is declined rather than cited", () => {
  for (const url of [
    "https://www.westlaw.co.nz/maf/wlnz/app/document?docguid=Ideadbeef",
    "https://advance.lexis.com/document/?pdmfid=1&crid=abc",
  ]) {
    const match = recogniseNzSource(url);
    assert.ok(match?.unresolvable, `${url} must be declined`);
    assert.equal(match.typeId, "", "a declined link must not claim a type");
  }
});

/**
 * Leaving a trailing detail off must not move the others. Counted only for the
 * REALISTIC partials — a value removed from the middle of a citation leaves a
 * reference no rule of the Guide produces, and chasing those is chasing noise.
 */
test("a shortened reference does not corrupt the boxes beyond the floor", () => {
  const FLOOR = 27;
  let corrupted = 0;
  const worst: string[] = [];

  for (const truth of FIELD_TRUTH) {
    if (truth.knownGap) continue;
    const type = guideTypeById[truth.typeId];
    if (!type) continue;
    const required = new Set(visibleComponents(type).filter((c) => c.required).map((c) => c.id));
    const droppable = Object.keys(truth.fields).filter(
      (id) => truth.fields[id]?.trim() && !required.has(id),
    );

    for (const omitted of droppable) {
      const reduced = { ...truth.fields };
      delete reduced[omitted];
      const built = buildCitation(truth.typeId, reduced);
      if (built.status !== "ready" || !built.text) continue;
      // Trailing only: nothing the template writes after it is still filled.
      const slots = [...chooseForm(type.outputTemplate, reduced).matchAll(/\{([^}]+)\}/g)].map(
        (m) => m[1],
      );
      const at = slots.indexOf(omitted);
      if (at < 0 || slots.slice(at + 1).some((id) => reduced[id]?.trim())) continue;

      const read = prefillFromPaste(type, built.text, []);
      for (const [id, value] of Object.entries(read)) {
        if (!value?.trim() || id === omitted) continue;
        const expected = truth.fields[id];
        if (expected === undefined) continue;
        const clean = (v: string) =>
          v.replace(/\s+/g, " ").replace(/^[[(]|[\])]$/g, "").replace(/[.,;]+$/, "").trim().toLowerCase();
        if (clean(expected) !== clean(value)) {
          corrupted++;
          worst.push(`${truth.typeId}: dropping ${omitted} put ${JSON.stringify(value)} in ${id}`);
        }
      }
    }
  }

  assert.ok(
    corrupted <= FLOOR,
    `realistic partial corruption rose to ${corrupted} (floor ${FLOOR}):\n${worst.slice(0, 10).join("\n")}`,
  );
});

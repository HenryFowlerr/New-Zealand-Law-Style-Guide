# NZ Law Cite

A browser-only citation builder for the **New Zealand Law Style Guide, Third
Edition (2018)**.

The project is an independent study aid. It is not affiliated with or endorsed
by the New Zealand Law Foundation or the publishers of the Style Guide.

## Safety model

NZ Law Cite is deliberately fail-closed:

- it never invents missing source facts;
- it does not generate a copyable citation while required details are missing;
- the source type is always confirmed by the user before anything is generated,
  and every auto-filled field is marked as read from the paste rather than
  known, so it invites a check;
- every format links to its controlling Style Guide paragraph; and
- the Guide's conditional rules are applied and explained — where a component
  must be left out because another is present (a court identifier alongside a
  neutral citation, under rule 3.2), the interface says so and cites the rule
  rather than silently dropping what you typed.

Accuracy still depends on the bibliographic facts supplied by the user and on
any institution-specific requirements that depart from Appendix 7.

## A data-driven engine over the whole Guide

The tool is generated from a structured copy of the Style Guide, not from
hand-coded formats. `src/data/styleGuide.json` holds **86 source types** across
six groups — Cases, Legislation, Parliamentary & official, Secondary sources,
International & foreign (Australia, Canada, England & Wales, Scotland, US,
treaties, UN, EU, WTO/GATT), and Subsequent references — each with its
components, rules, provenance, and the Guide's own worked examples. A single
renderer (`src/engine/`) turns a type's template and field values into the
citation, so adding or correcting a format is a data change, not new code.

The interface lists every type (grouped and searchable, each with a real
worked example), generates each form from that type's components, and composes
multiple authorities into one footnote with semicolons, “and” before the final
source, and one final full stop.

## Accuracy

Three different things can go wrong, and they are measured separately, because
a single headline number hides which one is failing.

**Generating the citation** — the guarantee. With the right source type chosen
and the right values in the boxes, does the citation match the Style Guide
exactly, to the comma? `tests/fixtures/field-truth.ts` holds field sets written
out **by hand** for every student-facing type, each expected against a worked
example from the Guide quoted verbatim. Nothing is derived from the extractor,
so a pass shows the renderer matches the Guide rather than showing that our own
two halves agree with each other. **80 of 80 exact.**

Two further properties are checked without needing ground truth, since they hold
of any correct citation: leaving out one optional detail removes that detail and
nothing else (`scripts/render-omission.ts`), and no combination of absent
optional fields can produce an empty bracket, a doubled comma or a dangling
"at" (`scripts/render-invariants.ts`).

**Reading a pasted reference** — putting the values into the right boxes.
Around 92% for the formats a New Zealand essay uses.

**Identifying the source type** from a paste — the weakest layer, around 76%.
The interface always shows several candidates and the user confirms one before
anything is generated, and a wrongly-ranked type usually renders identically
anyway; but this is where the remaining risk lives, and it is why the tool asks
you to confirm the format rather than assuming it.

Everything is measured against citations read off the **published** Guide at
lawfoundation.org.nz rather than only against the copy ingested here
(`tests/fixtures/guide-corpus.ts`, `scripts/guide-audit.ts`) — sixty of those
were missing from the ingested data entirely, and testing only against our own
copy would have made an ingestion error invisible.

Run them with `npm run qa`.

## Rich paste

Pasting a reference copied from a formatted source (PDF, Word, a web page) reads
the italic runs from the pasted HTML, so an italic title is split cleanly from a
non-italic author — the reliable answer to a split that is ambiguous in plain
text. Plain-text paste falls back to template extraction.

## Starting from an existing reference

Paste a reference in any of the verified formats and NZ Law Cite reads back the
details it can identify from the text — author, title, year, publisher, court,
neutral citation, pinpoint, and so on. Detection runs live as you type, so there
is nothing to click: the top match is shown and pressing Enter opens the
prefilled form with focus on the first still-missing field. The form then shows
which parts were found and prompts you for anything still required before a
citation is generated. Where two details cannot be split apart reliably from
unformatted text — for example a book's author and title once italics are lost —
the tool captures the longer part (the title) so it need not be retyped and
leaves the author blank and flagged as needed, rather than guessing the split.
Every extracted field is marked as read from your paste rather than known, and
should be checked against the source before the citation is used.

## Working quickly

- **Live detection** — paste or type a reference and the format is detected as
  you go; Enter accepts the top match.
- **Keyboard flow** — the build-from-details search selects the first result on
  Enter; inside a form, `Ctrl`/`⌘`+`Enter` copies a ready citation and `Esc`
  steps back.
- **Several references at once** — paste a reading list, a footnote block or a
  numbered list and each reference is separated, detected and built on its own
  terms; adding one to the footnote moves on to the next.
- **Completeness at a glance** — a green tick when every required part of the
  citation is present, a red mark naming what is still missing.
- **Footnote composer** — collect several authorities into one footnote with the
  correct semicolons, final “and”, and single full stop; it persists on your
  device.

## Contributing

`docs/working-notes.md` records how the project is measured, the traps that have
already cost work to find, and what is still open. Read it before changing the
engine.

## Local development

Requires Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Run the complete release gate (type check, citation-rule tests, production
build):

```bash
npm run verify
```

Run the browser-level interface tests (needs a browser; not part of the deploy
gate):

```bash
npx playwright install chromium
npm run test:e2e
```

### How the tests are organised

- `tests/field-truth.test.ts` — **the guarantee.** Correct fields in, the Guide's
  own citation out, for every one of the 86 types and for 215 of the Guide's 216
  worked examples. Its field sets are written out BY HAND, so a pass means the
  renderer agrees with the Guide rather than with the extractor.
- `tests/guide-corpus.test.ts` — the same question against citations read off the
  published Guide rather than off our ingested copy of it, so an ingestion error
  cannot hide.
- `tests/engine-build.test.ts` — the interactive build pipeline: exact output for
  representative types, italic titles, html escaping, the rich-paste author/title
  split, and that a citation is never emitted with a slot the chosen form needs
  left empty.
- `tests/engine-stress.test.ts` — adversarial and property-based checks across
  all 86 types: well-formed output, and building/detecting/extracting that never
  throw on thousands of random inputs.
- `tests/e2e/interface.spec.ts` — the real student paths through the interface.

`npm run qa` runs every measurement. The ones worth reading first are
`scripts/render-coverage.ts` (where is the guarantee NOT measured by hand?),
`scripts/partial-report.ts` (does a shorter paste still land in the right
boxes?) and `scripts/link-coverage.ts` (which pasted URLs does the tool
actually recognise?).

**`scripts/accuracy-report.ts` reports 216/216 and always will** — it derives
each example's fields with the very template it then renders them back through,
so it cannot fail on a wrong citation. It is kept for its per-group breakdown
and must not be quoted as evidence. `docs/working-notes.md` explains this and
the other traps; read it before changing the engine.

## Deployment

The repository includes a GitHub Pages workflow. Every deployment reruns type
checking, citation-rule tests, and the production build before publishing.

## Authoritative source

[New Zealand Law Style Guide, Third Edition](https://lawfoundation.org.nz/style-guide2019/index.html)

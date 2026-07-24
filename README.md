# NZ Law Cite

A browser-only citation builder for the **New Zealand Law Style Guide, Third
Edition (2018)**.

The project is an independent study aid. It is not affiliated with or endorsed
by the New Zealand Law Foundation or the publishers of the Style Guide.

## Safety model

NZ Law Cite is deliberately fail-closed:

- it never invents missing source facts;
- it does not generate a copyable citation while required details are missing;
- pasted text is treated as unverified until the user confirms the extracted
  source type and fields;
- every supported format links to its controlling Style Guide paragraph; and
- source types not yet fully tested are labelled unsupported rather than being
  approximated.

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

The Guide's own worked examples are the oracle: each is parsed back into field
values via its template, re-rendered, and required to match. The current engine
reproduces **186 of 216 examples exactly (86%)**, and of the examples the parser
reads cleanly the renderer is correct on all but a handful of documented
edge cases (complex/rare foreign formats and the special subsequent-reference
form). The score is a committed regression gate (`tests/accuracy.test.ts`).

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
Every extracted field is unverified until you confirm it against the source.

## Working quickly

- **Live detection** — paste or type a reference and the format is detected as
  you go; Enter accepts the top match.
- **Keyboard flow** — the build-from-details search selects the first result on
  Enter; inside a form, `Ctrl`/`⌘`+`Enter` copies a ready citation and `Esc`
  steps back.
- **Footnote composer** — collect several authorities into one footnote with the
  correct semicolons, final “and”, and single full stop; it persists on your
  device.

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

- `tests/accuracy.test.ts` — reproduces the Style Guide's own worked examples
  and holds the accuracy floor.
- `tests/engine-build.test.ts` — the interactive build pipeline: exact output
  for representative types, fail-closed across every type, italic titles, html
  escaping, and the rich-paste author/title split.
- `tests/engine-stress.test.ts` — adversarial and property-based checks across
  all 86 types: well-formed output, and building/detecting/extracting that never
  throw on thousands of random inputs.
- `tests/e2e/interface.spec.ts` — the real student paths through the interface.
- `scripts/accuracy-report.ts` — a per-group scoreboard (`npx tsx`).

## Deployment

The repository includes a GitHub Pages workflow. Every deployment reruns type
checking, citation-rule tests, and the production build before publishing.

## Authoritative source

[New Zealand Law Style Guide, Third Edition](https://lawfoundation.org.nz/style-guide2019/index.html)

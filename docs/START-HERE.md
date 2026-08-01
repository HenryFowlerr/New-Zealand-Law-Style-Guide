# Start here

For the beginning of a working session. Read this, run `npm run status`, then
open only what you need. `docs/working-notes.md` is the full reasoning — 400
lines, and reading all of it every session is waste. The map below says which
section actually applies.

## The promise

**Right source type selected, boxes filled correctly → the citation matches the
Style Guide exactly.** Every comma, bracket, dash, italic and full stop.

Everything else — reading a paste, guessing the type, resolving a link — is
convenience. A wrong citation looks exactly like a right one, so a confident
wrong answer is the one outcome that must be impossible.

## First two commands

```bash
npm run status
```

Every number on one screen. Then open the ONE script whose number you care
about — `failure-shapes`, `partial-report --verbose`, `render-coverage`,
`link-coverage`. Do not run `npm run qa` to find out where you are; it prints
several hundred lines.

```bash
npm run check && npm test
```

Typecheck and 451 unit tests. `npm run qa` before committing, `npm run test:e2e`
before pushing UI changes.

## The five rules that cost real work to learn

1. **Measure before and after, every time, and revert if the total falls.** Three
   separate changes looked right on the citation in front of them and cost five
   to twelve others.
2. **Work that improves the FIELDS goes in `prefillFromPaste`, never inside
   `refineFields`.** Detection's weights were fitted against the features as they
   were; changing what they see costs classification even when the change is
   correct. This has now happened four times. The same code cost 2 identifications
   in `refineFields` and 0 on the prefill path.
3. **Prefer a FEATURE to a weight.** A series abbreviation IS its jurisdiction for
   any citation using it; a refitted weight is true only of these 216. Refits have
   lost holdout before.
4. **If the Guide is ambiguous, leave it and say so.** A rule we invented is worse
   than a gap we documented. Gaps go in `knownGap` or the open list, not in code.
5. **Never quote `accuracy-report.ts`.** It reports 216/216 and always will — it
   derives fields with the template it then renders them back through, so it
   cannot fail on a wrong citation.

## Which measure means what

| | Question | Trust it? |
|---|---|---|
| `field-truth.test.ts` | correct fields → correct citation | **yes — fields written by hand** |
| `guide-audit` | matches the PUBLISHED Guide | **yes — strings not from this repo** |
| `qa-sweep` | READ and PICK from a paste | yes |
| `partial-report` | a SHORTER paste still lands right | yes, the "realistic" block only |
| `link-report` / `link-coverage` | a pasted URL | yes |
| `foreign-format-report` | a paste in APA / Bluebook / Chicago | yes |
| `render-truth` | template parses its own example | no — mostly extractor mis-splits |
| `accuracy-report` | — | **no — cannot fail** |

## Layout

```
src/engine/foreignFormat.ts  APA/Bluebook/Chicago → the Guide's shape, BEFORE detection
src/engine/render.ts   templates, forms, separators, italics, splitting a paste
src/engine/scan.ts     shape anchors — the field-level extraction
src/engine/build.ts    detection features and weights, buildCitation, the audit
src/engine/rules.ts    the Guide's conditional and corrective rules
src/engine/nzSources.ts  which URL means which source
src/data/styleGuide.json  the 86 types; changed by a scripts/patch-*.mjs, not by hand
tests/fixtures/        hand-written ground truth, and the published-Guide corpus
scripts/               every measurement; none of them ship
```

## Open work, roughly by value

1. **PICK is the weakest layer (156/216).** Domestic shape ambiguity now, not
   jurisdiction — "At 535." against Laws of New Zealand. More markers would be
   fitting the corpus rather than the Guide, so this needs a different idea.
2. **25 realistic partial corruptions**, mostly US and EU types a New Zealand
   essay rarely cites. `partial-report --verbose`. The domestic working set is
   clean.
3. **One output failure** (`failure-shapes`): rule 9.3.1's Charter refuses, and
   see 4 — that is the right failure, so this line is now at its floor.
4. **The Charter is the last declared gap.** Its form takes only a short title,
   and `chooseForm` will not pick it because the form's literals name an
   instrument the fields do not corroborate — a penalty that is load-bearing,
   since without it a bare "Crimes Act" becomes the Charter. It fails CLOSED,
   which is the right failure.
5. **34 robustness failures**, now mostly ALL CAPS (19 misclassified, 7 wrong
   output) — a case list pasted out of a database. The en-dash item is closed: a
   day span is corrected to the en dash rule 3.2.8 requires, and a dash inside a
   quoted TITLE is reproduced as its author wrote it, which is why the
   perturbation no longer reaches inside one.
6. **CanLII legislation beyond `/laws/stat/`** — regulations (`/laws/regu/`) and
   constitutional documents (`/laws/const/`) still fall through to the generic
   resolvers. Cases and statutes are read from the path.
7. **More foreign formats.** `foreignFormat.ts` now reads APA 6 and 7 (book,
   chapter, journal, thesis; DOI and footnote number stripped), Harvard,
   Chicago, MLA, Bluebook and a hyphen-columned database listing. Not yet:
   Vancouver, McGill, OSCOLA's secondary-source forms, and a BibTeX/RIS record.
   Add a fixture case FIRST — `foreign-format-report` is the measure.
7a. **Does rule 6.2 require a place of publication?** Rule 6.1.6 says "always"
   for a book; `styleGuide.json` marks `place` optional for an essay in an
   edited book, so an APA 7 chapter builds without one instead of asking. The
   Guide's own 6.2 examples all print a place. Settle it from the Guide, then
   patch the data with a `scripts/patch-*.mjs` — do not just flip the flag.
7b. **PICK, when a format drops the place.** MLA and APA 7 leave a THREE-part
   publication bracket, which rule 6.3's looseleaf template fits more tightly
   than rule 6.1's four-part one, so the book ranks second. A numbered edition
   ("3rd ed") is not a looseleaf ("looseleaf ed", "online ed") and that is a
   real feature — but it is a detection change, so measure holdout before and
   after.
8. **A journal-abbreviation table.** APA spells a journal's name out and the
   Guide abbreviates it from its own appendix ("Law Quarterly Review" → "LQR").
   Without the table that conversion is unreachable, and it is reported as lossy
   rather than guessed.
9. **Bluebook district courts.** "S.D.N.Y." becomes "SDNY"; the Guide writes
   "SD NY". Splitting a court from its state needs Appendix 3, not a pattern.

## Deploying

Push to `main`. Pages runs `npm run verify` and deploys to
<https://henryfowlerr.github.io/New-Zealand-Law-Style-Guide/>.

## Session hygiene

Run `npm run checkpoint -- "did" "next"` at every natural boundary, and read
`docs/HANDOFF.md` at the start of a session. A long chat costs more per turn than
a short one, because the whole conversation is re-sent each time — so hand off
early rather than pushing one session further.

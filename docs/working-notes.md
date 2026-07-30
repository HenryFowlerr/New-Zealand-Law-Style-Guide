# Working notes

How this project is measured and improved. Read this before changing the
engine — several of the traps below cost real work to find, and every one of
them is easy to walk back into.

## The one guarantee

**With the right source type selected and the boxes filled correctly, the
citation must match the Style Guide exactly.** Every comma, bracket, dash,
italic and full stop.

That is the promise the tool makes to a student writing an essay. Everything
else — reading a paste, guessing the type — is convenience. If the guarantee
breaks, the tool is worse than useless, because a wrong citation looks exactly
like a right one.

## Three things fail for different reasons

Never report a single accuracy number. It hides which layer is broken.

| | What it asks | Where | Now |
|---|---|---|---|
| **RENDER** | Correct fields in, correct citation out? | `tests/fixtures/field-truth.ts` | **80/80** |
| **READ** | Does a paste land in the right boxes? | `scripts/qa-sweep.ts` | 195/216 fields, 171/216 exact |
| **PICK** | Is the right source type ranked first? | `scripts/qa-sweep.ts` | 139/216 |

`npm run qa` runs everything. `scripts/common-law-report.ts` scores the subset a
New Zealand essay is actually built from, which matters more than the total
(READ 79/84, PICK 76/84). `scripts/failure-shapes.ts` sorts whatever is currently
failing by the SHAPE of the defect — duplicated, truncated, refused — which is
how the largest cluster gets found instead of the loudest example.

## Traps

**The circular-accuracy trap.** `scripts/accuracy-report.ts` reports 216/216 and
always will. It derives each example's fields with the very template it then
renders them back through, tries every alternate form, passes if any one
matches, and strips the trailing full stop before comparing. It cannot fail on a
wrong citation. Do not quote it as evidence of anything. `field-truth.ts` is the
real measure, because its fields are written out **by hand**.

**Testing against our own copy of the Guide.** `src/data/styleGuide.json` is an
ingestion, and ingestions have errors. When the data is wrong the engine agrees
with it and both are wrong together, invisibly. `tests/fixtures/guide-corpus.ts`
holds citations read off the published Guide at lawfoundation.org.nz — sixty of
them were missing from our data entirely. When the two disagree, the published
Guide wins.

**Fetched pages are summarised, not exact.** WebFetch is reliable for structure
and wording but can normalise quote marks and dashes. Never "fix" the engine to
match a fetched character that might have been mangled in transit.

**Fixing the example in front of you.** Three separate changes looked right on
the citation being examined and cost five to twelve others across the corpus.
Measure before and after, every time, and revert if the total falls. Two of
those reverts are recorded in commit messages rather than the code, which is
where that belongs.

**Fitting weights to this corpus.** `scripts/fit-detection.ts` fits the
detection weights, under a sign constraint per signal so the search can choose a
weight's magnitude but never invert its meaning — unconstrained it returns a
*negative* reward for filling required fields, which games the corpus and would
not survive a real paste. A third of the corpus is held out. **If a fit scores
better on training and worse on holdout, do not apply it.** That has happened;
features generalise, weights tuned to 216 examples do not.

**Inventing a rule.** If the Guide is ambiguous, leave it alone and say so. A
rule we made up is worse than a gap we documented.

**Changing what a fitted model sees.** The detection weights were fitted against
the feature values as they were at the time. Feeding them better fields — the
reconciliation pass below — moved the distribution and classification fell 136 to
124 without a single weight changing. Refitting recovered the training score and
LOST holdout (50 → 44 of 92), which is the signal not to apply it. So the pass
runs where the boxes are filled and not where the type is ranked, and detection
still sees what it was fitted on. Anything that touches a feature must be
measured on classification too, not just on the layer it was aimed at.

**Believing the corpus measures everything.** The corpus is 216 citations printed
in the Guide, and it is printed correctly, in mixed case, fully punctuated. Real
pastes are not. A citation copied out of a case list arrives in capitals, and
because nothing in the corpus does, nothing scored it: 71 of 118 capitalised
pastes were wrong, including silently dropped pinpoints, while every headline
number looked healthy. When a real-world input shape is missing from the corpus,
add it to the sweep's perturbations — a fix the corpus cannot reward will
otherwise look like a regression, because the one or two points it costs
elsewhere are the only thing visible.

A perturbation may legitimately change the output, so each one now says how to
compare. ALL CAPS compares case-insensitively: the guarantee there is that
nothing is lost and nothing invented, not that the capitals went away.

## Where the rules actually live

The ingested data carries far more than the templates, and most of it went
unused for a long time:

- `includedWhen` / `omittedWhen` — the Guide's *conditional* rules. Rule 3.2
  drops the court identifier when a neutral citation is present; a student has
  both facts and fills both boxes, and the citation was wrong. Encoded in
  `src/engine/rules.ts`, each citing its paragraph, each explaining itself in
  the interface rather than silently discarding what was typed.
- `separatorBefore` — which field a separator belongs to. `{title} {year},
  {pinpoint}` with no year keeps its comma; `{caseName} {neutralCitation},
  {year}` with no neutral citation loses it. Nothing about the punctuation
  distinguishes them; this field does.
- `italic` — chapter 1 requires party names (including the "v"), book titles,
  government report titles and newspaper names in italics; article titles take
  quotation marks and legislation is plain.

Before adding logic, check whether the Guide already recorded the answer.

## One run of the paste, one box

A citation read back into its boxes is a partition of the pasted text: each field
holds a different run of it, and the runs appear in the order the template writes
them — including the template's own literals, which the renderer prints whether
or not the paste already contains them.

Two passes extract independently and neither knows what the other claimed, so
both take the same words and the renderer writes them twice. That was 27 of the
75 wrong outputs: `Arms Amendment Bill (No 3) 2005 (No 3) 2005 (248-1)`,
`Morissens v Belgium (1988) 56 DR (1988) 56 DR 127`, `Laws of New Zealand Equity
Laws of New Zealand Equity`.

`reconcileAgainstSource` in `scan.ts` walks the fields behind a cursor and gives
each one exclusive title to its span. Which of two claimants over-reached is
genuinely ambiguous, and guessing it from the punctuation was wrong often enough
to cost 13 classifications — so both readings are built and scored against the
paste by word count (a citation should contain each word of the paste exactly as
often as the paste does), and the better one wins. **Doing nothing is on the
ballot and wins any tie.** A reading that would empty a required field is
discarded outright.

If you extend it: a required field left empty outranks the word count, because an
empty required field is what makes the tool refuse to build at all.

## Two lessons about scoring

**Counting is not neutral.** A raw count of filled fields rewards a template for
being *wide* (the US session-law template filled six boxes from "Evidence Act
2006, s 8", nonsense in every one). A fraction of the template's own slots
rewards it for being *narrow*, which is worse — `{billCitation} ({locator})`
fills both its slots by swallowing a whole book into two free-text buckets and
scores a perfect 1.0. What works is counting the *facts separated*, capped.

**A shape check must check the shape.** The conditional rules once fired on any
non-empty box, and a mis-split had filled the neutral-citation fields with
case-name words, so the rule deleted a correct "(SC)" from Australian and
English authority. Conditions carry the shape their field must have.

## Layout

```
src/engine/render.ts   templates, forms, separators, italics, splitting a paste
src/engine/scan.ts     shape anchors — the field-level extraction
src/engine/build.ts    detection features and weights, buildCitation, the audit
src/engine/rules.ts    the Guide's conditional rules
src/engine/shapes.ts   what shape each kind of component must have; render.ts
                       and scan.ts both need it and scan already imports render
tests/fixtures/        hand-written ground truth, and the published-Guide corpus
scripts/               every measurement; none of them ship
```

## Open

The clusters this section used to name were stale — the Māori Land Court and the
pre-1854 ordinances were already passing, and the Gazette problem turned out to be
partly this repo's own fixture. Re-derive the clusters from
`scripts/failure-shapes.ts` rather than trusting a list.

- **Paste→output 171/216.** By defect shape: 22 refused (a required field the
  extractor cannot find), 16 truncated, 9 other, 5 duplicated. The refusals are
  the ones worth taking next — a refusal is a citation the student does not get.
- **Journal articles with a long or punctuated name refuse to build.** `(2004)
  9(2) Australia & New Zealand Journal of Law & Education 3` and `(2007) 48 Wm &
  Mary L Rev 1605`. The reporter-locus pattern needs each word of a series to be
  capitalised and letters-only, so "&" and "of" defeat it and `journalAbbrev` and
  `startingPage` are left empty. Two of the audit's nine remaining failures.
- **A book with an editor rather than an author loses its "(ed)".** `Peter
  Blanchard (ed) Civil Remedies in New Zealand (2nd ed, …)` under 6.1.2. Check the
  published 6.1.2 for what the element list actually is before changing the type.
- **A publication parenthesis with a nested bracket breaks.** `Chatswood (NSW),
  2016) at [1206]` puts the pinpoint in the year, because the paren pattern
  refuses to nest.
- **A newspaper date range loses its first day.** `24–30 September 2011` reads as
  `30 September 2011` (rule 7.2).
- **Hansard naming a debate instead of a column still refuses.** The trailing-
  parenthesis pinpoint rule exists but does not fire for `(16 August 2017) 724
  NZPD (Maritime Transport Amendment Bill – Second Reading, Julie Anne Genter)`.
- **Guide audit 141/150.**
- **Classification 139/216; international 28/79.** Much weaker than domestic. The
  foreign *case* types matter most, since New Zealand common law reasons from
  English and Australian authority — Canada (8.3) and Scotland (8.5) now read
  correctly, but US state and federal cases (8.6.2, 8.6.3) still rank low because
  their locus has no bracketed year to anchor on. A year-less "volume SERIES page"
  anchor is the obvious next move; it was not attempted because it is loose enough
  to need careful measuring.
- **A capitalised paste has two defects that the text cannot settle.** In capitals
  an abbreviation and an ordinary word look identical, so `BOARD OF TRADE 546`
  reads as though "TRADE" started the citation, and a Gazette notice number is
  taken for an issue number. Both are left alone deliberately. See
  `pasteIsAllCaps`.
- **`en-dash → hyphen` costs 11 outputs.** A student typing a hyphen where the
  Guide prints an en dash is realistic; the Māori Land Court block-name split and
  several title fields key on the dash.
- **`llmParse.ts` and `webllmModel.ts` are unreachable** — leftovers from a
  removed Ollama feature, kept because they are real design work, tree-shaken
  out of the bundle either way.

## Deploying

Push to `main`. The Pages workflow runs `npm run verify` (typecheck, unit tests,
build) and deploys to
<https://henryfowlerr.github.io/New-Zealand-Law-Style-Guide/>. Playwright is
deliberately outside that gate because it needs a browser; run `npm run test:e2e`
locally before pushing UI changes.

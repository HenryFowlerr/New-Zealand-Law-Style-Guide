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
| **READ** | Does a paste land in the right boxes? | `scripts/qa-sweep.ts` | 194/216 fields, 141/216 exact |
| **PICK** | Is the right source type ranked first? | `scripts/qa-sweep.ts` | 136/216 |

`npm run qa` runs everything. `scripts/common-law-report.ts` scores the subset a
New Zealand essay is actually built from, which matters more than the total.

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
tests/fixtures/        hand-written ground truth, and the published-Guide corpus
scripts/               every measurement; none of them ship
```

## Open

- **Paste→output 141/216.** Clusters: Māori Land Court minute books, pre-1854
  ordinances, two long-named journals, Gazette notices.
- **Guide audit 129/147.** Some of the Gazette failures may be corpus
  mislabelling between rules 4.3.2 and 5.2.4 rather than engine defects — check
  before fixing.
- **International types 28/79 on identification.** Much weaker than domestic.
  The foreign *case* types matter most, since New Zealand common law reasons
  from English and Australian authority.
- **`llmParse.ts` and `webllmModel.ts` are unreachable** — leftovers from a
  removed Ollama feature, kept because they are real design work, tree-shaken
  out of the bundle either way.

## Deploying

Push to `main`. The Pages workflow runs `npm run verify` (typecheck, unit tests,
build) and deploys to
<https://henryfowlerr.github.io/New-Zealand-Law-Style-Guide/>. Playwright is
deliberately outside that gate because it needs a browser; run `npm run test:e2e`
locally before pushing UI changes.

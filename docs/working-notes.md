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
| **RENDER** | Correct fields in, correct citation out? | `tests/fixtures/field-truth.ts` | **149/149, all 86 types, none skipped** |
| **READ** | Does a paste land in the right boxes? | `scripts/qa-sweep.ts` | 214/216 fields, 199/216 exact |
| **PICK** | Is the right source type ranked first? | `scripts/qa-sweep.ts` | 148/216 |
| **LINK** | Does a URL give the right KIND of citation? | `scripts/link-report.ts` | 16/16 type, 6/6 exact |

RENDER is the promise; the other three are convenience. It is now measured for
every type in the Guide — it used to cover 38 of 86, so for the rest the promise
was simply untested. Two further checks back it up, both at 100%:
`render-invariants` (621/621 — every combination of omitted optional fields still
renders something well-formed) and `render-omission` (460/460 — dropping one
optional part disturbs nothing else).

`npm run qa` runs everything. `scripts/common-law-report.ts` scores the subset a
New Zealand essay is actually built from, which matters more than the total
(RENDER 94/94, READ 84/84, PICK 80/84 — the first two at 100%). `scripts/failure-shapes.ts` sorts whatever
is currently failing by the SHAPE of the defect — duplicated, truncated, refused —
which is how the largest cluster gets found instead of the loudest example.

**`scripts/render-truth.ts` is NOT the guarantee**, despite once being titled as
though it were. It asks whether a template can parse its own worked example, and
almost every failure is `extractByTemplate` mis-splitting rather than a wrong
citation. Do not change the renderer to satisfy it.

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

**Validating against the chosen form.** Seven citations refuse because a type
marks a component required that the FORM being used has no slot for — rule 8.5's
neutral-citation-only Scottish case, rule 9.3.1's Charter. Requiring only what the
chosen form uses looks obviously right, and it is not.

It was implemented in full and measured: the Charter and the Inveresk case both
started building, and the corpus went BACKWARDS — output exact 194 → 191, template
round-trip 207 → 204, and omission safety broke for the first time in the
project's history, 460/460 → 451/456. Five unit tests failed with it. Reverted.

The reason is that it makes `chooseForm` load-bearing for correctness rather than
just for presentation, and `chooseForm` is not good enough to carry that. Two
things had to be added just to stop it emitting nonsense — an empty REQUIRED slot
weighted above an empty optional one, and a heavy penalty for literal text the
supplied fields do not corroborate, without which a bare "Crimes Act" became "…,
pt 1 of the Constitution Act 1982, being sch B to the Canada Act 1982 (UK)". Even
with both, a Scottish case that has a year AND a report series started losing its
court identifier.

If it is attempted again, fix `chooseForm` FIRST and prove it in isolation:
choosing the wrong form is a wrong citation, not a cosmetic slip. The two
examples this would rescue are not worth what it currently costs.

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

## The Guide corrects the student, it does not only describe

Several rules do not merely say what a citation looks like — they say to CHANGE
what the source prints. Rule 3.2.1: "only cite the first plaintiff/appellant and
the first defendant/respondent (do not use '& Anor' or '& Ors')", and "Shorten
procedural phrases such as 'In re' and 'In the matter of' to 'Re'." Rule 2.3
forbids "ibid" outright. Rule 4.1.1 gives a New Zealand Act no jurisdiction tag,
so a student's "(NZ)" has to go.

`VALUE_RULES` in `src/engine/rules.ts` holds the corrections, beside `GUIDE_RULES`
which can only DROP a component. Each cites its paragraph and explains itself
through the notes mechanism, because silently editing what someone typed is not
acceptable even when the Guide requires the edit — and the note says "corrected"
rather than "left out" when the field is still there.

**A correction fights the reconstruction score, and this will happen again.**
Detection rewards a type for reproducing the paste, so a rule requiring the tool
to change the paste makes the CORRECT type look like a worse reconstruction.
Dropping "& Anor" turned "R v Smith & Anor [2019] NZHC 1234 at [22]" from a
correct citation into no citation at all; the "(NZ)" tag made an Act Australian
for the same reason, from the other direction. Both comparisons — `refit` in
detection and `auditAgainstPaste` in the interface — now run on
`normaliseForComparison`, so the question is whether a type explains the reference
rather than whether it echoes it. **Any new value rule must be added there too.**

## What a student actually pastes

A reference is almost never copied on its own, and none of this is in the corpus:

- a footnote marker (`12 `, `3. `, `[4] `, superscript), an introductory signal
  (`See also `), a reading-list heading (`Week 4: `) — all of which ended up
  inside the case name
- a retrieval date on the end (`(accessed 4 May 2025)`), which changed the shape
  the detector keys on and turned a good neutral citation into a refusal
- a whole footnote of several authorities joined by `; ` and `; and `
- a reading list, whose entries are NOT punctuated, so the sentence-end rule that
  governs line joining never fires
- a bibliography, whose section headings ("Cases", "Legislation") carry no
  punctuation either
- ALL CAPS out of a case list; a hyphen where the Guide prints an en dash

`referencePrefixLength` and `referenceSuffixLength` in `render.ts` strip the
first two at the paste boundary, once, so detection, extraction and the audit all
see the reference itself. `splitReferences` handles the rest.

The rule for all of it: **strip only what cannot be part of a citation.** A bare
leading number is the one ambiguous case — "16 US 610" is a volume — so it goes
only before a Titlecase word, an opening quote, or a single-letter party. Failing
closed there is deliberate: a stray "12" is visible, a swallowed volume is not.

## The link layer

A URL's PATH is the trusted source, not the page. On the sites a New Zealand law
student actually links to, the path carries the citation:

```
legislation.govt.nz/act/public/2006/0069/…  → an Act of 2006
nzlii.org/nz/cases/NZSC/2008/55.html        → [2008] NZSC 55
courtsofnz.govt.nz/…/2019-NZSC-40.pdf       → [2019] NZSC 40
```

So the TYPE is settled by the URL and never guessed from page text. That matters
because the generic resolvers (Crossref, Open Library, Citoid) are built for
scholarship and read a judgment or an Act as a *web page* — rule 4.1.1 gives an
Act no URL at all, so "internet material" is not a rough answer here, it is a
wrong one. `recogniseNzSource` runs before all of them.

**A page title has to earn being used.** A public CORS proxy routinely returns a
challenge page instead of the document, and trusting its `<title>` produced
`Just a moment... [2008] NZSC 55.` — every part right except the one naming the
case. A title is accepted only where it CORROBORATES what the path established: an
NZLII title must contain the neutral citation, a legislation.govt.nz title must
end with the path's year. Anything else falls back to the URL alone, which is
correct rather than merely safe.

When adding a site, add its `corroborates` at the same time. Without one, the
first interstitial that site serves becomes a citation.

## Open

The clusters this section used to name were stale — the Māori Land Court and the
pre-1854 ordinances were already passing, and the Gazette problem turned out to be
partly this repo's own fixture. Re-derive the clusters from
`scripts/failure-shapes.ts` rather than trusting a list.

- **Paste→output 199/216.** By defect shape: 11 truncated, 3 other, 2 refused,
  1 duplicated. Run `scripts/failure-shapes.ts` rather than reading this list; it
  goes stale.
- **The two remaining refusals are the same modelling gap.** Rule 8.5's
  neutral-citation-only form ("Inveresk plc v Tullis Russell Papermakers Ltd
  [2009] CSIH 56") needs neither a year nor a report series, but both are marked
  required, and rule 9.3.1's Charter form needs only a short title. **Validating
  per-form has been tried and does not pay — read the trap of that name before
  attempting it again.** Where one component simply takes another's place, the
  narrow fix is `STANDS_IN_FOR` in `build.ts`, which has one entry citing its rule.
- **The link layer covers five New Zealand sites and nothing else.** Westlaw and
  LexisNexis are paywalled and their URLs carry no citation, so they cannot be
  read this way; a student pasting one should be told to paste the reference text
  instead, and currently is not. Also unhandled: the NZ Gazette
  (gazette.govt.nz), Hansard (parliament.nz), and AustLII/BAILII paths other than
  `/cases/`.
- **Multi-form validation.** `validate` requires every component marked required
  across ALL of a type's alternate forms, so rule 9.3.1's second form (the
  Canadian Charter, which needs only a short title) can never be built. Relaxing
  it to the chosen form is NOT the fix: `chooseForm` would then pick that form for
  any bare short title and emit the Charter's wording for an unrelated Act.
- **A Canadian statute asks for its volume and jurisdiction separately** — "RS"
  and "C" — because rule 9.3.1 describes them as two elements joined without a
  space. That is faithful but hostile: a student will type "RSC" into one box and
  be told the jurisdiction is missing. A labelling problem, not a correctness
  one.
- **Guide audit 150/150.** Every citation read off the published Guide now
  rebuilds exactly. That is the measure to watch: it is the only one whose
  expected strings did not come from this repository.
- **Classification 147/216.** Much weaker than domestic. The
  foreign *case* types matter most, since New Zealand common law reasons from
  English and Australian authority. Canada (8.3), Scotland (8.5) and the American
  courts (8.6.2, 8.6.3) now READ correctly; ranking them first is the part still
  outstanding, and it is a fitted-model question rather than a pattern one.
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

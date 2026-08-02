# Handoff

Written by `npm run checkpoint` at 2026-08-02 01:23 UTC, on branch `main`.
Delete nothing here by hand — the next checkpoint overwrites it.

## State

**GREEN — typecheck and unit tests pass**
Unit tests: 466 passed, 0 failed.

## Last done

A fragment is no longer turned into a citation: gate detection on citation apparatus, require rule 2.3's pinpoint, and hand the words on when the reader picks a format

## Next step

Open list in docs/START-HERE.md — rule 3.8's inert required flags; offer a type for a fragment; rule 6.2 place question

## Where every measurement stands

```
NZ LAW CITE — where everything stands
THE GUARANTEE — correct fields in, the Guide's citation out
  field-truth (by hand)      220                tests/fixtures/field-truth.ts
  worked examples uncovered  0                  must stay 0
  declared template gaps     1                  knownGap in field-truth
  published-Guide audit      154/154            the only non-self-referential one
  render invariants          635/635            
  render omission            578/578            
CONVENIENCE — reading a paste
  READ fields                215/216            
  READ output exact          215/216            
  PICK type ranked first     156/216            weakest layer
  robustness                 1500/1507          perturbed pastes
  fixed point                155/155            re-pasting our own output
PARTIAL — a shorter paste (realistic omissions only)
  corrupted                  25                 shows a FALSE value — worst
  dropped                    16                 loses a present one
  retyped                    10                 type rank changed
FOREIGN FORMAT — a reference written in some other style
  PICK type ranked first     15/18              
  READ fields                18/18              
  OUTPUT citation exact      18/18              APA, Bluebook, Chicago
FRAGMENT — part of a reference, not the whole of one
  never built from a fragment 11/11              must stay at full
  type offered in top 6      6/11               
  what it carries, read      10/11              
LINK — a pasted URL
  right KIND of source       21/21              
  exact citation             8/8                
  blocked page still safe    8/8                
  database declined          3/3                
  URL shapes missed          0                  must stay 0
THE WORKING SET — what a New Zealand essay actually cites
  RENDER / READ / PICK       100% 112/112 100% 84/84 95% 80/84
WHAT IS FAILING — by defect shape
  1 output failures
   1  REFUSED
  Detail: run the one script you need —
  failure-shapes | partial-report --verbose | render-coverage | link-coverage
  Read docs/START-HERE.md before changing the engine.
```

## Git

Recent commits:

```
18c7719 Checkpoint: Read a FULL CAPS paste: restore the Guide's casing for ranki
ac19c0e Correct the unit-test count in START-HERE
5bd90a5 Correct the unit-test count in START-HERE
4c4e1fd Checkpoint: Read APA 7, Harvard and MLA; have each reader name the field
e215e06 Checkpoint: Tell the reader which foreign style was recognised and what
cc8f2be Checkpoint: Read APA, Bluebook, Chicago and database-listing references
70b3a0a Checkpoint: Correct a hyphenated day span, stop the dash perturbation re
5657284 Checkpoint: Recognise CanLII — cases, statutes, and rule 8.3.3's forbidd
```

Uncommitted when this ran (the checkpoint commits them next):

```
M docs/START-HERE.md
 M package.json
 M scripts/status.ts
 M src/App.tsx
 M src/data/styleGuide.json
 M src/engine/build.ts
 M src/styles.css
 M tests/e2e/interface.spec.ts
 M tests/engine-scan.test.ts
?? scripts/fragment-report.ts
?? scripts/patch-subsequent-reference-pinpoint.mjs
?? tests/fixtures/fragments.ts
```

## Picking this up

1. `npm run status` — confirm the numbers above still hold.
2. Read the "Next step" line, then `docs/START-HERE.md` for the open list.
3. Measure before and after any engine change, and revert if the total falls.

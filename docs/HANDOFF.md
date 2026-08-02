# Handoff

Written by `npm run checkpoint` at 2026-08-02 00:41 UTC, on branch `main`.
Delete nothing here by hand — the next checkpoint overwrites it.

## State

**GREEN — typecheck and unit tests pass**
Unit tests: 466 passed, 0 failed.

## Last done

Read a FULL CAPS paste: restore the Guide's casing for ranking and the field split, keep the reader's capitals in the citation; strip a footnote marker from rule 2.3's short forms

## Next step

Open list in docs/START-HERE.md — 8 robustness failures left; rule 6.2 place question; journal-abbreviation table needs the Guide's appendix

## Where every measurement stands

```
NZ LAW CITE — where everything stands
THE GUARANTEE — correct fields in, the Guide's citation out
  field-truth (by hand)      220                tests/fixtures/field-truth.ts
  worked examples uncovered  0                  must stay 0
  declared template gaps     1                  knownGap in field-truth
  published-Guide audit      154/154            the only non-self-referential one
  render invariants          637/637            
  render omission            583/583            
CONVENIENCE — reading a paste
  READ fields                215/216            
  READ output exact          215/216            
  PICK type ranked first     156/216            weakest layer
  robustness                 1499/1507          perturbed pastes
  fixed point                155/155            re-pasting our own output
PARTIAL — a shorter paste (realistic omissions only)
  corrupted                  25                 shows a FALSE value — worst
  dropped                    16                 loses a present one
  retyped                    11                 type rank changed
FOREIGN FORMAT — a reference written in some other style
  PICK type ranked first     15/18              
  READ fields                18/18              
  OUTPUT citation exact      18/18              APA, Bluebook, Chicago
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
ac19c0e Correct the unit-test count in START-HERE
5bd90a5 Correct the unit-test count in START-HERE
4c4e1fd Checkpoint: Read APA 7, Harvard and MLA; have each reader name the field
e215e06 Checkpoint: Tell the reader which foreign style was recognised and what
cc8f2be Checkpoint: Read APA, Bluebook, Chicago and database-listing references
70b3a0a Checkpoint: Correct a hyphenated day span, stop the dash perturbation re
5657284 Checkpoint: Recognise CanLII — cases, statutes, and rule 8.3.3's forbidd
d325a37 Checkpoint: Read a paragraph-numbered report locus and a bracketed year
```

Uncommitted when this ran (the checkpoint commits them next):

```
M docs/START-HERE.md
 M src/engine/build.ts
 M src/engine/render.ts
?? src/engine/shouted.ts
?? tests/engine-shouted.test.ts
```

## Picking this up

1. `npm run status` — confirm the numbers above still hold.
2. Read the "Next step" line, then `docs/START-HERE.md` for the open list.
3. Measure before and after any engine change, and revert if the total falls.

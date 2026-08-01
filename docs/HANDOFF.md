# Handoff

Written by `npm run checkpoint` at 2026-08-01 01:10 UTC, on branch `main`.
Delete nothing here by hand — the next checkpoint overwrites it.

## State

**GREEN — typecheck and unit tests pass**
Unit tests: 454 passed, 0 failed.

## Last done

Added the nz-law-cite skill, npm run status, and this checkpoint script

## Next step

Continue the open list in docs/START-HERE.md — PICK at 155/216 is the weakest layer

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
  READ output exact          213/216            
  PICK type ranked first     155/216            weakest layer
  robustness                 1462/1498          perturbed pastes
  fixed point                154/154            re-pasting our own output
PARTIAL — a shorter paste (realistic omissions only)
  corrupted                  27                 shows a FALSE value — worst
  dropped                    20                 loses a present one
  retyped                    11                 type rank changed
LINK — a pasted URL
  right KIND of source       21/21              
  exact citation             8/8                
  blocked page still safe    8/8                
  database declined          3/3                
  URL shapes missed          0                  must stay 0
THE WORKING SET — what a New Zealand essay actually cites
  RENDER / READ / PICK       100% 112/112 100% 84/84 95% 80/84
WHAT IS FAILING — by defect shape
  3 output failures
   1  DUPLICATE
   1  REFUSED
   1  OTHER
  Detail: run the one script you need —
  failure-shapes | partial-report --verbose | render-coverage | link-coverage
  Read docs/START-HERE.md before changing the engine.
```

## Git

Recent commits:

```
d95687c Make picking this project up cheap
b9f197e Put a floor under the three measures that found the defects
5647fd7 Read a report series as the jurisdiction it names
ee6ad4e Point the README at the measure that can fail
98e9882 Cut where the Guide puts the boundary, not at the first space
9da8326 Give a paste with no citation in it back whole
5efd1aa Read the jurisdiction in a LII path, not just the court code
7ab9500 Write by hand the third of the Guide the guarantee never covered
```

Uncommitted when this ran (the checkpoint commits them next):

```
M package.json
?? .claude/skills/
?? scripts/checkpoint.ts
```

## Picking this up

1. `npm run status` — confirm the numbers above still hold.
2. Read the "Next step" line, then `docs/START-HERE.md` for the open list.
3. Measure before and after any engine change, and revert if the total falls.

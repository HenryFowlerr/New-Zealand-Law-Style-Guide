# nz-law-cite

Generates citations to the New Zealand Law Style Guide, 3rd ed. 86 source types,
driven by `src/data/styleGuide.json` rather than by code.

**The promise: right type selected + boxes filled correctly → the citation matches
the Guide exactly.** Everything else (reading a paste, guessing the type,
resolving a link) is convenience. A wrong citation looks exactly like a right
one, so a confident wrong answer is the one outcome that must be impossible.

## Start a session with

```bash
npm run status
```

Every measurement on one screen. Then open the ONE script whose number moved.
**Do not run `npm run qa` to find out where things stand** — it prints several
hundred lines. Read `docs/START-HERE.md` before changing the engine;
`docs/working-notes.md` is the full reasoning, and its section headings say which
part applies.

## Rules that cost real work to learn

- **Measure before and after, and revert if the total falls.** Three changes
  looked right on the citation in front of them and cost five to twelve others.
- **Field improvements go in `prefillFromPaste`, never inside `refineFields`** —
  detection's weights were fitted against the features as they were, so changing
  what they see costs classification even when the change is correct. Four times
  now.
- **Prefer a feature to a refitted weight.** Refits have lost holdout before.
- **If the Guide is ambiguous, leave it and document it** (`knownGap`, or the open
  list in START-HERE). An invented rule is worse than a recorded gap.
- **Never quote `scripts/accuracy-report.ts`** — it reports 216/216 and cannot
  fail on a wrong citation. `field-truth.test.ts` is the real measure, because
  its fields are written by hand.

## Verify

`npm run check && npm test` while working; `npm run qa` before committing;
`npm run test:e2e` before pushing UI changes. Data changes go through a
`scripts/patch-*.mjs`, not by hand-editing the JSON.

## Checkpoint early — a session can end at any moment

```bash
npm run checkpoint -- "what I just did" "what to do next"
```

Runs the gate, writes `docs/HANDOFF.md` (state, next step, every measurement,
git), and commits. Safe when the tests are RED too — it saves anyway and says so
at the top, because losing work is worse than recording it unfinished.

**Run it without being asked when:** a coherent piece of work is finished and
verified; before starting something risky or large; the session has grown long or
replies are slowing; the user mentions usage, limits, cost or slowness; or
anything is uncommitted and the next step is uncertain.

Then say plainly that a fresh chat will be cheaper and that `docs/HANDOFF.md`
carries the state. **Never end a turn with work uncommitted** — that turn may be
the last one. A new chat starts with `npm run status` and the handoff.

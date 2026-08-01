---
name: nz-law-cite
description: Working on the NZ Law Cite citation generator (New Zealand Law Style Guide, 3rd ed) — the engine in src/engine, the 86 source types in src/data/styleGuide.json, the measurement scripts, or the citation rules themselves. Use whenever the task touches citations, source types, the Style Guide, reading a pasted reference, resolving a pasted link, or any of RENDER/READ/PICK/LINK/PARTIAL accuracy. Loads the project's promise, its five hard-won rules, the cheap way to see where things stand, and the checkpoint protocol.
---

# NZ Law Cite

Generates citations to the New Zealand Law Style Guide, 3rd ed. 86 source types,
driven by `src/data/styleGuide.json` rather than by code.

## The promise

**Right source type selected + boxes filled correctly → the citation matches the
Guide exactly.** Every comma, bracket, dash, italic and full stop.

Everything else — reading a paste, guessing the type, resolving a link — is
convenience. A wrong citation looks exactly like a right one, so a *confident
wrong answer* is the one outcome that must be impossible. When in doubt, fail
closed and say what is missing.

## Orient in one command

```bash
npm run status
```

Every measurement on one screen. **Do not run `npm run qa` to find out where
things stand** — it runs ten scripts and prints several hundred lines. Read
`status` first, then open the ONE script whose number moved:

- `scripts/failure-shapes.ts` — what is failing, grouped by defect shape
- `scripts/partial-report.ts --verbose` — shorter pastes; read the REALISTIC block only
- `scripts/render-coverage.ts` — where the guarantee is not measured by hand
- `scripts/link-coverage.ts` — which pasted URL shapes are recognised

`docs/START-HERE.md` is the one-page orientation with the open list ordered by
value. `docs/working-notes.md` is the full reasoning — its headings say which
section applies; do not read it end to end.

## Five rules that cost real work to learn

1. **Measure before and after, every time, and revert if the total falls.** Three
   separate changes looked right on the citation in front of them and cost five
   to twelve others elsewhere. Record reverted attempts with their numbers, at
   the code site — a documented negative result is worth as much as the fix.
2. **Field improvements belong in `prefillFromPaste`, never inside
   `refineFields`.** Detection's weights were fitted against the features as they
   were, so feeding them better fields moves the distribution and costs
   classification even when the change is correct. This has happened four times.
   The identical code cost 2 correct type identifications in `refineFields` and 0
   on the prefill path.
3. **Prefer a FEATURE to a refitted weight.** A report series abbreviation IS its
   jurisdiction, for any citation using it; a weight refitted to these 216
   examples is true only of them, and refits have lost holdout before.
4. **If the Guide is ambiguous, leave it alone and document it** — `knownGap` in
   `field-truth.ts`, or the open list. A rule we invented is worse than a gap we
   recorded.
5. **Never quote `scripts/accuracy-report.ts`.** It reports 216/216 and always
   will: it derives each example's fields with the very template it then renders
   them back through, so it cannot fail on a wrong citation.

## Which measure to trust

| | Question | Trust |
|---|---|---|
| `field-truth.test.ts` | correct fields → correct citation | **yes — fields written by hand** |
| `guide-audit` | matches the PUBLISHED Guide | **yes — strings not from this repo** |
| `qa-sweep` | READ and PICK from a paste | yes |
| `partial-report` | a SHORTER paste still lands right | yes, REALISTIC block only |
| `link-report` / `link-coverage` | a pasted URL | yes |
| `render-truth` | template parses its own example | no — mostly extractor mis-splits |
| `accuracy-report` | — | **no — cannot fail** |

## Working practice

- Data changes go through a `scripts/patch-*.mjs`, never by hand-editing
  `styleGuide.json`.
- `npm run check && npm test` while working. `npm run qa` before committing.
  `npm run test:e2e` before pushing UI changes.
- Commit messages describe the DEFECT and the measurement, not the diff. Match
  the existing history's voice.
- When a measure improves, tighten its floor in `tests/coverage-floors.test.ts`
  in the same commit, or the ratchet slips.

## Checkpointing and handing off

This project is long-running and sessions get expensive as they grow — the whole
conversation is re-sent every turn. So checkpoint often and hand off early.

```bash
npm run checkpoint -- "what I just did" "what to do next"
```

That runs the gate, writes `docs/HANDOFF.md` (status numbers, git state, next
step), and commits everything. It is safe to run at any moment and cheap.

**Run it without being asked when any of these is true:**

- a coherent piece of work is finished and verified
- about to start something risky, large, or easy to get wrong
- the session has grown long, or replies are getting slow
- the user mentions usage, limits, cost, or slowness
- anything is uncommitted and the next step is uncertain

Then tell the user plainly that a fresh chat will be cheaper, and that
`docs/HANDOFF.md` carries the state. Never leave work uncommitted at the end of
a turn that might be the last one.

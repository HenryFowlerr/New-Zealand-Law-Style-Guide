/**
 * Save everything, so that stopping is never expensive.
 *
 *   npm run checkpoint -- "what I just did" "what to do next"
 *
 * Runs the gate, records where every measurement stands, writes docs/HANDOFF.md
 * and commits. Safe to run at any moment: if the tests are red it still saves,
 * and says so loudly at the top of the handoff, because losing the work is worse
 * than recording that it is unfinished.
 *
 * The point is that a session can end at any time — a usage limit, a closed
 * laptop, a context that has grown too expensive to keep feeding — and the next
 * one should start from a written state rather than by re-deriving it.
 */
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const [did = "", next = ""] = process.argv.slice(2);

const sh = (cmd: string, args: string[]): { ok: boolean; out: string } => {
  try {
    return {
      ok: true,
      out: execFileSync(cmd, args, {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        maxBuffer: 32 * 1024 * 1024,
      }),
    };
  } catch (error: unknown) {
    const e = error as { stdout?: string; stderr?: string };
    return { ok: false, out: `${e?.stdout ?? ""}${e?.stderr ?? ""}` };
  }
};

console.log("checkpoint: running the gate…");
const typecheck = sh("npm", ["run", "check"]);
const unit = sh("npm", ["test"]);
const status = sh("npm", ["run", "status"]);

const passed = unit.out.match(/^ℹ pass (\d+)/m)?.[1] ?? "?";
const failed = unit.out.match(/^ℹ fail (\d+)/m)?.[1] ?? "?";
const green = typecheck.ok && failed === "0";

const branch = sh("git", ["rev-parse", "--abbrev-ref", "HEAD"]).out.trim();
const dirty = sh("git", ["status", "--short"]).out.trim();
const recent = sh("git", ["log", "--oneline", "-8"]).out.trim();

// The status table, without its banner — the numbers are the useful part.
const numbers = status.out
  .split("\n")
  .filter((l) => !/^[=>]|^$|^> nz-law-cite|^> tsx/.test(l))
  .join("\n")
  .trim();

const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");

const handoff = `# Handoff

Written by \`npm run checkpoint\` at ${stamp} UTC, on branch \`${branch}\`.
Delete nothing here by hand — the next checkpoint overwrites it.

## State

**${green ? "GREEN — typecheck and unit tests pass" : "RED — SEE BELOW, do not build on this without reading it"}**
Unit tests: ${passed} passed, ${failed} failed.
${green ? "" : `\n\`\`\`\n${(typecheck.ok ? unit.out : typecheck.out).split("\n").slice(-25).join("\n").trim()}\n\`\`\`\n`}
## Last done

${did || "_(not recorded — the checkpoint was run without a message)_"}

## Next step

${next || "_(not recorded — read the open list in docs/START-HERE.md)_"}

## Where every measurement stands

\`\`\`
${numbers}
\`\`\`

## Git

Recent commits:

\`\`\`
${recent}
\`\`\`

${dirty ? `Uncommitted when this ran (the checkpoint commits them next):\n\n\`\`\`\n${dirty}\n\`\`\`` : "Working tree was clean."}

## Picking this up

1. \`npm run status\` — confirm the numbers above still hold.
2. Read the "Next step" line, then \`docs/START-HERE.md\` for the open list.
3. Measure before and after any engine change, and revert if the total falls.
`;

writeFileSync("docs/HANDOFF.md", handoff);
console.log("checkpoint: wrote docs/HANDOFF.md");

sh("git", ["add", "-A"]);
const subject = did
  ? `Checkpoint: ${did.replace(/\s+/g, " ").trim().slice(0, 60)}`
  : "Checkpoint";
const body = [
  did && `Done: ${did}`,
  next && `Next: ${next}`,
  `Gate: ${green ? "green" : "RED"} — ${passed} unit tests passed, ${failed} failed.`,
  "",
  "Saved by scripts/checkpoint.ts so the session can end at any point.",
  "docs/HANDOFF.md carries the state.",
  "",
  "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>",
]
  .filter((l) => l !== undefined && l !== false)
  .join("\n");

const commit = sh("git", ["commit", "-m", subject, "-m", body]);
console.log(
  commit.ok
    ? `checkpoint: committed — ${subject}`
    : `checkpoint: nothing to commit (${commit.out.split("\n")[0]})`,
);

console.log(`\ncheckpoint: ${green ? "GREEN" : "RED — the handoff says why"}`);
if (!green) process.exitCode = 1;

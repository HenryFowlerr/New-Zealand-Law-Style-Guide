/**
 * Every number, in one screen. `npm run status`
 *
 * Written for the start of a working session. `npm run qa` runs ten scripts and
 * prints several hundred lines, nearly all of it detail you only want once you
 * know WHICH layer moved — and reading all of it, every session, is the single
 * most expensive habit on this project.
 *
 * This runs the same scripts and prints only their verdicts. Read this first,
 * then run the one script whose number you care about, with its own flags.
 */
import { execFileSync } from "node:child_process";

const run = (script: string, args: string[] = []): string => {
  try {
    return execFileSync("npx", ["tsx", `scripts/${script}`, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      maxBuffer: 32 * 1024 * 1024,
    });
  } catch (error: unknown) {
    const out = (error as { stdout?: string })?.stdout;
    return typeof out === "string" ? out : "";
  }
};

/** First capture group of the first matching line, or "?". */
const grab = (text: string, pattern: RegExp): string => text.match(pattern)?.[1]?.trim() ?? "?";

const line = (label: string, value: string, note = "") =>
  console.log(`  ${label.padEnd(26)} ${value.padEnd(18)} ${note}`);

console.log("=".repeat(78));
console.log("NZ LAW CITE — where everything stands");
console.log("=".repeat(78));

const sweep = run("qa-sweep.ts");
const coverage = run("render-coverage.ts");
const audit = run("guide-audit.ts");
const invariants = run("render-invariants.ts");
const omission = run("render-omission.ts");
const partial = run("partial-report.ts");
const links = run("link-report.ts");
const linkCoverage = run("link-coverage.ts");
const working = run("common-law-report.ts");
const shapes = run("failure-shapes.ts");
const foreign = run("foreign-format-report.ts");

console.log("\nTHE GUARANTEE — correct fields in, the Guide's citation out");
line("field-truth (by hand)", grab(coverage, /hand-written cases\s*:\s*(\d+)/), "tests/fixtures/field-truth.ts");
line("worked examples uncovered", grab(coverage, /NOT covered by hand\s*:\s*(\d+)/), "must stay 0");
line("declared template gaps", grab(coverage, /skipped \(knownGap\)\s*:\s*(\d+)/), "knownGap in field-truth");
line("published-Guide audit", grab(audit, /rebuilt exactly\s*:\s*(\S+)/), "the only non-self-referential one");
line("render invariants", grab(invariants, /(\d+\/\d+) rendered cleanly/));
line("render omission", grab(omission, /(\d+\/\d+) omissions left/));

console.log("\nCONVENIENCE — reading a paste");
line("READ fields", grab(sweep, /all required extracted\s*:\s*(\S+)/));
line("READ output exact", grab(sweep, /output exact\s*:\s*(\S+)/));
line("PICK type ranked first", grab(sweep, /classification correct\s*:\s*(\S+)/), "weakest layer");
line("robustness", grab(sweep, /robustness\s*:\s*(\S+)/), "perturbed pastes");
line("fixed point", grab(sweep, /fixed point\s*:\s*(\S+)/), "re-pasting our own output");

console.log("\nPARTIAL — a shorter paste (realistic omissions only)");
const realistic = partial.split("REALISTIC")[1] ?? "";
line("corrupted", grab(realistic, /CORRUPTED[^:]*:\s*(\d+)/), "shows a FALSE value — worst");
line("dropped", grab(realistic, /DROPPED[^:]*:\s*(\d+)/), "loses a present one");
line("retyped", grab(realistic, /RETYPED[^:]*:\s*(\d+)/), "type rank changed");

console.log("\nFOREIGN FORMAT — a reference written in some other style");
line("PICK type ranked first", grab(foreign, /PICK\s+type ranked first\s*:\s*(\S+)/));
line("READ fields", grab(foreign, /FIELDS every field right\s*:\s*(\S+)/));
line("OUTPUT citation exact", grab(foreign, /OUTPUT citation exact\s*:\s*(\S+)/), "APA, Bluebook, Chicago");

console.log("\nLINK — a pasted URL");
line("right KIND of source", grab(links, /TYPE recognised\s*:\s*(\S+)/));
line("exact citation", grab(links, /CITE exact\s*:\s*(\S+)/));
line("blocked page still safe", grab(links, /BLOCKED page safe\s*:\s*(\S+)/));
line("database declined", grab(links, /DATABASE declined\s*:\s*(\S+)/));
line("URL shapes missed", grab(linkCoverage, /MISSED (\d+)/), "must stay 0");

console.log("\nTHE WORKING SET — what a New Zealand essay actually cites");
// Anchored: "THE COMMON-LAW WORKING SET" is a heading two lines above the row.
const ws = working.match(/^WORKING SET\s+(.*)$/m)?.[1]?.replace(/\s+/g, " ").trim() ?? "?";
console.log(`  RENDER / READ / PICK       ${ws}`);

console.log("\nWHAT IS FAILING — by defect shape");
const total = grab(shapes, /total failures:\s*(\d+)/);
console.log(`  ${total} output failures`);
for (const row of shapes.split("\n").slice(1, 8)) {
  if (/^\s+\d+\s+[A-Z]/.test(row)) console.log(`   ${row.trim()}`);
}

console.log("\n  Detail: run the one script you need —");
console.log("  failure-shapes | partial-report --verbose | render-coverage | link-coverage");
console.log("  Read docs/START-HERE.md before changing the engine.\n");

/**
 * One-off ingestion: turn the raw Style Guide extraction (prose + JSON batches)
 * into a single clean, validated data file the engine consumes.
 *
 *   node scripts/ingest-style-guide.mjs <input.txt> src/data/styleGuide.json
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const [, , inputPath, outputPath] = process.argv;
if (!inputPath || !outputPath) {
  console.error("usage: ingest-style-guide.mjs <input.txt> <output.json>");
  process.exit(1);
}

let raw = readFileSync(inputPath, "utf8");

// The extraction was truncated once, mid-object, then re-done. Remove the
// truncated fragment (a partial "us-model-law" object) and the "Continuing…"
// prose plus the array bracket that re-opens the stream, so the surrounding
// array stitches back into one valid array. The complete object follows.
raw = raw.replace(
  /\{\s*"id": "us-model-law"[\s\S]*?Continuing the international\/foreign JSON objects from where they cut off\.\s*\[\s*/,
  "",
);

const lines = raw.split("\n");

// Top-level JSON arrays are bounded by a line that is exactly "[" and a line
// that is exactly "]" (array members are indented, so those never collide).
// The global-rules object is bounded by a col-0 "{" ... "}".
const arrays = [];
let globalRules = null;
let buffer = null;
let closer = null;

for (const line of lines) {
  if (buffer === null) {
    if (line === "[") {
      buffer = [line];
      closer = "]";
    } else if (line === "{") {
      buffer = [line];
      closer = "}";
    }
    continue;
  }
  buffer.push(line);
  if (line === closer) {
    const parsed = JSON.parse(buffer.join("\n"));
    if (closer === "]") arrays.push(parsed);
    else if (parsed.globalRules) globalRules = parsed.globalRules;
    buffer = null;
    closer = null;
  }
}

const types = arrays.flat();

// De-duplicate ids (the source has one accidental duplicate). Keep the first,
// suffix later collisions so nothing is silently dropped.
const seen = new Map();
for (const type of types) {
  const count = seen.get(type.id) ?? 0;
  seen.set(type.id, count + 1);
  if (count > 0) {
    const newId = `${type.id}-${count + 1}`;
    console.warn(`duplicate id "${type.id}" -> "${newId}"`);
    type.id = newId;
  }
}

if (!globalRules) {
  console.error("global rules object not found");
  process.exit(1);
}

const exampleCount = types.reduce(
  (sum, type) => sum + (type.examples?.length ?? 0),
  0,
);

const data = {
  meta: {
    source: "New Zealand Law Style Guide, 3rd edition (2018)",
    sourceUrl: "https://lawfoundation.org.nz/style-guide2019/index.html",
    ingestedAt: new Date().toISOString().slice(0, 10),
    typeCount: types.length,
    exampleCount,
  },
  types,
  globalRules,
};

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(data, null, 2)}\n`);

console.log(
  `Wrote ${types.length} types and ${exampleCount} examples to ${outputPath}`,
);

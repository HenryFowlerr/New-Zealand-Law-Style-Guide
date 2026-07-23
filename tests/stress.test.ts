/**
 * Adversarial and property-based tests. These simulate the kind of abuse a
 * large cohort of students would inflict on the tool: sparse input, malformed
 * input, hostile markup, exotic unicode, and repeated round-trips. The point
 * is to guarantee two things at scale:
 *
 *   1. Fail-closed. A citation is never marked "ready" while any required,
 *      visible field is missing, and a non-ready citation never leaks text.
 *   2. Well-formed output. Every ready citation is free of the punctuation and
 *      spacing artefacts that would make it wrong under the Style Guide.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  analyseCitation,
  buildCitation,
  composeFootnote,
  getVisibleFields,
  prefillCitation,
  sourceTypeMap,
  sourceTypes,
  type CitationData,
  type CitationTypeId,
} from "../src/citationEngine.ts";

// A tiny deterministic PRNG so failures are reproducible.
function makeRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

function pick<T>(rng: () => number, items: T[]): T {
  return items[Math.floor(rng() * items.length) % items.length];
}

/**
 * Complete, valid field sets for every source type. Each entry produces a
 * ready citation and is the basis for round-trip and fail-closed testing.
 */
const validSamples: Record<CitationTypeId, CitationData[]> = {
  journal: [
    {
      author: "Peter Watts",
      title: "Birks’ Unjust Enrichment",
      year: "2005",
      yearRole: "independent-volume",
      volume: "121",
      journal: "LQR",
      startPage: "163",
      pinpoint: "165",
    },
    {
      author: "Jessica Palmer",
      title: "Theories of the Trust",
      year: "2010",
      yearRole: "year-is-volume",
      journal: "NZ L Rev",
      startPage: "541",
    },
  ],
  book: [
    {
      author: "Ross Carter",
      title: "Burrows and Carter Statute Law in New Zealand",
      edition: "5th",
      publisher: "LexisNexis",
      place: "Wellington",
      year: "2015",
      pinpoint: "311",
    },
  ],
  chapter: [
    {
      author: "Robin Cooke",
      title: "Tort and Contract",
      editor: "PD Finn",
      bookTitle: "Essays on Contract",
      edition: "2nd",
      publisher: "Law Book Company",
      place: "Sydney",
      year: "1987",
      startPage: "222",
      pinpoint: "229",
    },
  ],
  looseleaf: [
    {
      author: "Billie Little and others",
      title: "Personal Injury in New Zealand",
      editionType: "online",
      publisher: "Thomson Reuters",
      pinpoint: "[AC21.02]",
    },
  ],
  report: [
    {
      author: "Labour Market Policy Group",
      title: "Cover for Mental Injury",
      officialCitation: "00/001872",
      date: "24 March 2000",
    },
  ],
  act: [
    {
      title: "Evidence Act",
      year: "2006",
      referenceType: "s",
      reference: "43",
    },
    {
      title: "Counter-Terrorism Act",
      year: "2008",
      jurisdiction: "UK",
      referenceType: "s",
      reference: "92",
    },
  ],
  "case-reported": [
    {
      caseName: "Z v Dental Complaints Assessment Committee",
      neutralCitation: "[2008] NZSC 55",
      reportYear: "2009",
      yearRole: "essential",
      volume: "1",
      reportSeries: "NZLR",
      startPage: "1",
      pinpoint: "[26]",
    },
  ],
  "case-neutral": [
    {
      caseName: "Attorney-General v X",
      year: "2007",
      court: "NZCA",
      judgmentNumber: "388",
      pinpoint: "[70]",
    },
  ],
  "case-unreported": [
    {
      caseName: "R v Tuhou",
      court: "HC",
      registry: "Napier",
      fileNumber: "CRI-2007-020-2820",
      date: "11 September 2008",
      pinpoint: "[13]",
    },
  ],
  subsequent: [
    {
      sourceCategory: "text",
      context: "not-obvious",
      label: "Todd",
      earlierFootnote: "8",
      pinpoint: "50",
    },
  ],
};

/** Assert a ready citation is free of formatting artefacts. */
function assertWellFormed(textValue: string, context: string) {
  assert.ok(textValue.length > 0, `${context}: empty text`);
  assert.doesNotMatch(textValue, /\s{2,}/, `${context}: double space`);
  assert.doesNotMatch(textValue, /\s[.,;]/, `${context}: space before punctuation`);
  assert.doesNotMatch(textValue, /,,|;;|\.\./, `${context}: doubled punctuation`);
  assert.doesNotMatch(textValue, /\(\s*\)/, `${context}: empty parentheses`);
  assert.doesNotMatch(textValue, /,\s*\)/, `${context}: trailing comma in parens`);
  assert.doesNotMatch(textValue, /\(\s*,/, `${context}: leading comma in parens`);
  assert.equal(
    (textValue.match(/\.$/g) ?? []).length,
    1,
    `${context}: must end with exactly one full stop`,
  );
  assert.doesNotMatch(textValue, /^\s|\s$/, `${context}: leading/trailing space`);
}

test("every valid sample renders a well-formed, ready citation", () => {
  for (const type of Object.keys(validSamples) as CitationTypeId[]) {
    for (const [index, sample] of validSamples[type].entries()) {
      const result = buildCitation(type, sample);
      assert.equal(result.status, "ready", `${type}#${index} should be ready`);
      assertWellFormed(result.text, `${type}#${index}`);
      // HTML and text must carry the same visible characters.
      assert.equal(
        result.html.replace(/<\/?em>/g, ""),
        result.text
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")
          .replaceAll('"', "&quot;")
          .replaceAll("'", "&#039;"),
        `${type}#${index}: html/text mismatch`,
      );
    }
  }
});

test("building is idempotent — the same data always yields the same text", () => {
  for (const type of Object.keys(validSamples) as CitationTypeId[]) {
    for (const sample of validSamples[type]) {
      const first = buildCitation(type, sample).text;
      const second = buildCitation(type, { ...sample }).text;
      assert.equal(first, second, `${type} not idempotent`);
    }
  }
});

test("dropping any single required field fails closed with no leaked text", () => {
  for (const type of Object.keys(validSamples) as CitationTypeId[]) {
    const definition = sourceTypeMap[type];
    for (const sample of validSamples[type]) {
      const requiredVisible = getVisibleFields(definition, sample).filter(
        (field) => field.required,
      );
      for (const field of requiredVisible) {
        const broken = { ...sample, [field.id]: "" };
        const result = buildCitation(type, broken);
        assert.equal(
          result.status,
          "incomplete",
          `${type} stayed ready without required ${field.id}`,
        );
        assert.equal(result.text, "", `${type} leaked text without ${field.id}`);
        assert.equal(result.html, "", `${type} leaked html without ${field.id}`);
        assert.ok(
          result.issues.some((issue) => issue.level === "error"),
          `${type} raised no error for missing ${field.id}`,
        );
      }
    }
  }
});

test("whitespace-only required fields are treated as missing", () => {
  for (const type of Object.keys(validSamples) as CitationTypeId[]) {
    const definition = sourceTypeMap[type];
    for (const sample of validSamples[type]) {
      const requiredVisible = getVisibleFields(definition, sample).filter(
        (field) => field.required,
      );
      if (requiredVisible.length === 0) continue;
      const field = requiredVisible[0];
      const result = buildCitation(type, { ...sample, [field.id]: "   \t  " });
      assert.equal(result.status, "incomplete", `${type} accepted blank ${field.id}`);
    }
  }
});

test("hostile markup in every string field is neutralised in the html", () => {
  const payload = '<script>alert("xss")</script>';
  for (const type of Object.keys(validSamples) as CitationTypeId[]) {
    const definition = sourceTypeMap[type];
    for (const sample of validSamples[type]) {
      for (const field of getVisibleFields(definition, sample)) {
        if (field.type === "select" || field.type === "checkbox") continue;
        const result = buildCitation(type, { ...sample, [field.id]: payload });
        if (result.status !== "ready") continue;
        assert.doesNotMatch(
          result.html,
          /<script>/,
          `${type}.${field.id} leaked a script tag`,
        );
      }
    }
  }
});

test("macrons and other unicode survive without corrupting output", () => {
  const result = buildCitation("case-neutral", {
    caseName: "Ngāti Whātua Ōrākei Trust v Attorney-General",
    year: "2018",
    court: "NZSC",
    judgmentNumber: "84",
    pinpoint: "[12]",
  });
  assert.equal(result.status, "ready");
  assert.match(result.text, /Ngāti Whātua Ōrākei/);
  assertWellFormed(result.text, "macron case");
});

test("prefill and analyse never throw on garbage input", () => {
  const rng = makeRng(20260723);
  const alphabet = " abcABC0123“”\"'.,;:()[]<>&/vAct".split("");
  for (let iteration = 0; iteration < 4000; iteration++) {
    const length = Math.floor(rng() * 60);
    let raw = "";
    for (let i = 0; i < length; i++) raw += pick(rng, alphabet);
    assert.doesNotThrow(() => analyseCitation(raw));
    for (const type of sourceTypes) {
      assert.doesNotThrow(() => prefillCitation(type.id, raw));
      // Whatever prefill returns must still be safe to build.
      assert.doesNotThrow(() => buildCitation(type.id, prefillCitation(type.id, raw)));
    }
  }
});

test("analyse suggestions always resolve to real, buildable source types", () => {
  const rng = makeRng(7);
  const fragments = [
    "Smith v Jones",
    "[2019] NZCA 12",
    "(2005) 3 NZLR 1",
    "Evidence Act 2006",
    "“A Title”",
    "(2010) 4 NZLJ 5",
    "above n 6",
    "online ed",
    "at [12]",
    "in PD Finn (ed)",
  ];
  for (let iteration = 0; iteration < 2000; iteration++) {
    const count = 1 + Math.floor(rng() * 4);
    const parts: string[] = [];
    for (let i = 0; i < count; i++) parts.push(pick(rng, fragments));
    const suggestions = analyseCitation(parts.join(" "));
    for (const suggestion of suggestions) {
      assert.ok(sourceTypeMap[suggestion.type], "unknown suggested type");
      assert.ok(
        ["high", "possible"].includes(suggestion.confidence),
        "invalid confidence",
      );
    }
    // Suggestions are unique per type.
    const types = suggestions.map((suggestion) => suggestion.type);
    assert.equal(new Set(types).size, types.length, "duplicate suggestion type");
  }
});

test("full-extraction formats round-trip render → prefill → render unchanged", () => {
  const roundTripTypes: CitationTypeId[] = [
    "journal",
    "chapter",
    "act",
    "case-reported",
    "case-neutral",
    "case-unreported",
  ];
  for (const type of roundTripTypes) {
    for (const sample of validSamples[type]) {
      const rendered = buildCitation(type, sample);
      assert.equal(rendered.status, "ready", `${type}: sample not ready`);
      const reparsed = prefillCitation(type, rendered.text);
      const rebuilt = buildCitation(type, reparsed);
      assert.equal(
        rebuilt.status,
        "ready",
        `${type}: round-trip produced an incomplete citation from "${rendered.text}"`,
      );
      assert.equal(
        rebuilt.text,
        rendered.text,
        `${type}: round-trip text drifted`,
      );
    }
  }
});

test("footnote composer keeps exactly one full stop and correct joiners", () => {
  const items = [
    buildCitation("journal", validSamples.journal[0]),
    buildCitation("case-neutral", validSamples["case-neutral"][0]),
    buildCitation("subsequent", validSamples.subsequent[0]),
  ];
  const footnote = composeFootnote(items);
  assert.equal((footnote.text.match(/\.$/g) ?? []).length, 1);
  assert.match(footnote.text, /; and /, "missing final and");
  assert.doesNotMatch(footnote.text, /\.\s*;/, "period before semicolon");
  assert.doesNotMatch(footnote.text, /;\s*and\s+.*;\s*and/, "duplicated final and");
});

test("footnote composer ignores incomplete citations entirely", () => {
  const incomplete = buildCitation("journal", { author: "Only an author" });
  assert.equal(incomplete.status, "incomplete");
  const footnote = composeFootnote([
    incomplete,
    buildCitation("act", validSamples.act[0]),
  ]);
  // Only the one ready act should appear, ending in a single full stop.
  assert.match(footnote.text, /^Evidence Act 2006, s 43\.$/);
});

test("randomised valid data across all types is always well-formed", () => {
  const rng = makeRng(999);
  const authors = ["Peter Watts", "R v", "Māui Solomon", "A B and C D", "Jane Doe"];
  const titles = ["A Title", "On “Quotes”", "Law & Order", "Something <b>bold</b>"];
  const years = ["2001", "2019", "1999", "2024"];
  const pages = ["1", "163", "[26]", "511, n 46"];
  for (let iteration = 0; iteration < 1500; iteration++) {
    const type = pick(rng, sourceTypes).id;
    const base = pick(rng, validSamples[type]);
    const mutated: CitationData = { ...base };
    for (const key of Object.keys(mutated)) {
      const original = mutated[key];
      if (typeof original !== "string") continue;
      if (/author|title|caseName|label/i.test(key)) {
        mutated[key] = pick(rng, [...authors, ...titles, original]);
      } else if (/year/i.test(key) && /^\d{4}$/.test(original)) {
        mutated[key] = pick(rng, years);
      } else if (/pinpoint|page/i.test(key)) {
        mutated[key] = pick(rng, pages);
      }
    }
    const result = buildCitation(type, mutated);
    if (result.status === "ready") {
      assertWellFormed(result.text, `random ${type}#${iteration}`);
      assert.doesNotMatch(result.html, /<script>/, `random ${type} leaked script`);
    }
  }
});

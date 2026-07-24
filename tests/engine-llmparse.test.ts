/**
 * Tests for the optional LLM-assisted extractor. Inference is stubbed, so these
 * cover the parts that must be correct regardless of which model runs: the
 * schema prompt, tolerant JSON parsing, and mapping the reply to buildable
 * fields.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  buildExtractionPrompt,
  extractJsonObject,
  llmParse,
  parseLLMResponse,
} from "../src/engine/llmParse.ts";
import { guideTypeById } from "../src/data/styleGuide.ts";
import { buildCitation } from "../src/engine/build.ts";

const book = guideTypeById["text-book"];

test("the prompt names every component id and grounds with an example", () => {
  const { system, user } = buildExtractionPrompt("some reference", book);
  for (const c of book.components) assert.ok(user.includes(`"${c.id}"`), `missing ${c.id}`);
  assert.match(system, /JSON/);
  assert.ok(user.includes("some reference"));
});

test("extractJsonObject tolerates markdown fences and surrounding prose", () => {
  assert.equal(extractJsonObject('Here:\n```json\n{"a":1}\n```'), '{"a":1}');
  assert.equal(extractJsonObject('noise {"a":{"b":2}} tail'), '{"a":{"b":2}}');
  assert.equal(extractJsonObject("no json here"), null);
});

test("parseLLMResponse keeps known ids, drops unknowns, nulls and blanks", () => {
  const reply = JSON.stringify({
    author: "Andrew Butler and Petra Butler",
    title: "The New Zealand Bill of Rights Act: A Commentary",
    edition: "2nd ed",
    publisher: "LexisNexis",
    placeOfPublication: "Wellington",
    year: "2015",
    pinpoint: null,
    madeUpField: "ignored",
  });
  const fields = parseLLMResponse(reply, book);
  assert.equal(fields.author, "Andrew Butler and Petra Butler");
  assert.equal(fields.madeUpField, undefined);
  assert.equal(fields.pinpoint, undefined);
});

test("malformed model output yields no fields rather than throwing", () => {
  assert.deepEqual(parseLLMResponse("total nonsense, no braces", book), {});
  assert.deepEqual(parseLLMResponse('{"author": ', book), {});
});

test("llmParse output builds the correct citation", async () => {
  const stub = async () =>
    JSON.stringify({
      author: "Andrew Butler and Petra Butler",
      title: "The New Zealand Bill of Rights Act: A Commentary",
      edition: "2nd ed",
      publisher: "LexisNexis",
      placeOfPublication: "Wellington",
      year: "2015",
    });
  const fields = await llmParse(
    "andrew butler and petra butler the new zealand bill of rights act a commentary 2nd ed lexisnexis wellington 2015",
    book,
    stub,
  );
  const result = buildCitation("text-book", fields);
  assert.equal(
    result.text,
    "Andrew Butler and Petra Butler The New Zealand Bill of Rights Act: A Commentary (2nd ed, LexisNexis, Wellington, 2015).",
  );
});

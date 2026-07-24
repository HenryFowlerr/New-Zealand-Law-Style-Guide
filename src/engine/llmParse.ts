/**
 * Optional LLM-assisted extraction for the hard case: messy pasted text with no
 * DOI/ISBN and no formatting, where the author/title boundary can't be found by
 * rule. A small instruct model (1–3B params) handles this well.
 *
 * The design is transport-agnostic. This module only builds a strict,
 * schema-constrained prompt and parses the model's JSON reply into engine
 * fields; the actual inference call is injected as a `CallModel` function. That
 * lets the SAME code run against:
 *   - a local Ollama server (free, on the user's Mac) — see ollamaModel below,
 *   - an in-browser WebLLM/transformers.js model (free, runs in the visitor's
 *     browser, no backend) — a thin adapter that returns the model's text,
 *   - or any hosted endpoint.
 *
 * Keeping inference injected also means the prompt builder and JSON parser are
 * unit-testable offline with a recorded model reply — no network, no model.
 */
import type { GuideType } from "../data/styleGuide";

export type CallModel = (prompt: { system: string; user: string }) => Promise<string>;

/**
 * Build a prompt that asks the model to return ONLY a JSON object whose keys are
 * this type's component ids, filled from the reference text (or null when a
 * part is absent). The type's rule and a worked example ground the model so it
 * returns values already in the Guide's shape (e.g. a case year as "[2008]").
 */
export function buildExtractionPrompt(
  text: string,
  type: GuideType,
): { system: string; user: string } {
  const fields = type.components
    .map((c) => `  "${c.id}": string|null  // ${c.label}${c.required ? " (required)" : ""}`)
    .join("\n");
  const example = type.examples[0]?.correct_citation;
  const system = [
    "You extract citation components for the New Zealand Law Style Guide.",
    "Return ONLY a JSON object, no prose, no markdown fences.",
    "Each value is the exact substring from the reference, or null if absent.",
    "Do not invent, translate, reorder, or reformat values beyond copying them out.",
    "Keep bracket/quote styles as they appear (e.g. a case year like \"[2008]\").",
  ].join(" ");
  const user = [
    `Source type: ${type.name}.`,
    type.rule ? `Rule: ${type.rule}` : "",
    example ? `Example of this type: ${example}` : "",
    "",
    "Return JSON with exactly these keys:",
    "{",
    fields,
    "}",
    "",
    `Reference to extract from:\n${text}`,
  ]
    .filter(Boolean)
    .join("\n");
  return { system, user };
}

/** Pull the first balanced JSON object out of a model reply (tolerates fences). */
export function extractJsonObject(raw: string): string | null {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : raw;
  const start = body.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < body.length; i++) {
    if (body[i] === "{") depth++;
    else if (body[i] === "}" && --depth === 0) return body.slice(start, i + 1);
  }
  return null;
}

/**
 * Parse a model reply into fields, keeping only this type's known component ids
 * and non-empty string values. Anything malformed yields an empty object rather
 * than throwing — the caller then falls back to the heuristic scanner.
 */
export function parseLLMResponse(raw: string, type: GuideType): Record<string, string> {
  const json = extractJsonObject(raw);
  if (!json) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return {};
  }
  if (!parsed || typeof parsed !== "object") return {};
  const known = new Set(type.components.map((c) => c.id));
  const fields: Record<string, string> = {};
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (!known.has(key)) continue;
    if (typeof value === "string" && value.trim()) fields[key] = value.trim();
    else if (typeof value === "number") fields[key] = String(value);
  }
  return fields;
}

/** Extract fields for a type from free text using an injected model call. */
export async function llmParse(
  text: string,
  type: GuideType,
  callModel: CallModel,
): Promise<Record<string, string>> {
  const reply = await callModel(buildExtractionPrompt(text, type));
  return parseLLMResponse(reply, type);
}

/**
 * Adapter for a local Ollama server (the free, download-and-run-on-your-Mac
 * path: `ollama pull llama3.2:3b`, then it serves http://localhost:11434).
 * Uses Ollama's JSON mode so the reply is a clean object. Browser-only (global
 * fetch); untested here by design — the parsing it feeds is covered above.
 */
export function ollamaModel(
  model = "llama3.2:3b",
  host = "http://localhost:11434",
): CallModel {
  return async ({ system, user }) => {
    const response = await fetch(`${host}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        format: "json",
        stream: false,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    if (!response.ok) throw new Error(`Ollama ${response.status}`);
    const data = await response.json();
    return data?.message?.content ?? "";
  };
}

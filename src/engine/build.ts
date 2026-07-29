/**
 * Interactive build pipeline. Given a source type id and the user's field
 * values, validate the required components, render the citation via the
 * data-driven renderer, and finish it as a footnote sentence (one full stop).
 * This is the entry point the interface uses to build any of the Guide's types.
 */
import {
  guideTypeById,
  guideTypes,
  type GuideComponent,
  type GuideType,
} from "../data/styleGuide";
import {
  extractByTemplate,
  templateForms,
  normalizeQuotes,
  normalizePaste,
  renderFromTemplate,
  tokensToHtml,
  tokensToText,
  type ComponentValue,
  type Token,
} from "./render";
import {
  anchorMismatch,
  anchorSupport,
  fieldShapeViolations,
  jurisdictionConflict,
  refineFields,
} from "./scan";

export type CitationFields = Record<string, string>;

export type Issue = {
  level: "error" | "note";
  field?: string;
  message: string;
};

export type BuildResult = {
  status: "ready" | "incomplete";
  type: GuideType;
  tokens: Token[];
  text: string;
  html: string;
  issues: Issue[];
};

function fieldValue(fields: CitationFields, id: string): string {
  const raw = fields[id];
  return typeof raw === "string" ? raw.trim() : "";
}

/** Components a type actually uses in its template, in template order. */
export function templateComponentIds(type: GuideType): string[] {
  const ids = new Set<string>();
  const re = /\{([^}]+)\}/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(type.outputTemplate)) !== null) ids.add(match[1]);
  return [...ids];
}

/** Visible fields for the form: components referenced by the template. */
export function visibleComponents(type: GuideType): GuideComponent[] {
  const used = new Set(templateComponentIds(type));
  const byId = new Map(type.components.map((c) => [c.id, c]));
  // Preserve template order, then any leftover components.
  const ordered: GuideComponent[] = [];
  for (const id of templateComponentIds(type)) {
    const component = byId.get(id);
    if (component) ordered.push(component);
  }
  for (const component of type.components) {
    if (!used.has(component.id)) continue;
    if (!ordered.includes(component)) ordered.push(component);
  }
  return ordered;
}

export function validate(type: GuideType, fields: CitationFields): Issue[] {
  const issues: Issue[] = [];
  for (const component of visibleComponents(type)) {
    if (component.required && !fieldValue(fields, component.id)) {
      issues.push({
        level: "error",
        field: component.id,
        message: `${component.label} is required by rule ${type.rule}.`,
      });
    }
  }
  return issues;
}

function withFinalStop(tokens: Token[]): Token[] {
  if (tokens.length === 0) return tokens;
  const result = tokens.map((token) => ({ ...token }));
  const last = result[result.length - 1];
  last.text = `${last.text.replace(/[.\s]+$/, "")}.`;
  return result;
}

export function buildCitation(
  typeId: string,
  fields: CitationFields,
): BuildResult {
  const type = guideTypeById[typeId];
  if (!type) {
    throw new Error(`Unknown citation type: ${typeId}`);
  }
  const issues = validate(type, fields);
  const hasError = issues.some((issue) => issue.level === "error");
  if (hasError) {
    return { status: "incomplete", type, tokens: [], text: "", html: "", issues };
  }
  // Mark italic components so titles the template does not asterisk (book,
  // report and text titles) still render italic as the Style Guide requires.
  const italicIds = new Set(
    type.components.filter((component) => component.italic).map((c) => c.id),
  );
  const values: Record<string, ComponentValue> = {};
  for (const [id, raw] of Object.entries(fields)) {
    const text = typeof raw === "string" ? raw.trim() : "";
    values[id] = italicIds.has(id) ? { text, italic: true } : text;
  }
  const tokens = withFinalStop(renderFromTemplate(type.outputTemplate, values));
  return {
    status: "ready",
    type,
    tokens,
    text: tokensToText(tokens),
    html: tokensToHtml(tokens),
    issues,
  };
}

export function missingRequiredComponents(
  type: GuideType,
  fields: CitationFields,
): GuideComponent[] {
  return visibleComponents(type).filter(
    (component) => component.required && !fieldValue(fields, component.id),
  );
}

/** An italic span found in pasted rich text, positioned in the plain text. */
export type ItalicRun = { text: string; start: number; end: number };

function italicComponentIds(type: GuideType): string[] {
  const asterisked = new Set(
    [...type.outputTemplate.matchAll(/\*\{([^}]+)\}\*/g)].map((m) => m[1]),
  );
  const byId = new Map(type.components.map((c) => [c.id, c]));
  return templateComponentIds(type).filter(
    (id) => asterisked.has(id) || byId.get(id)?.italic,
  );
}

/**
 * Prefill a type's fields from pasted text, using italic runs (from rich paste)
 * to place italic components — a book/report title, a case name, a masthead —
 * exactly, and to lift the non-italic author that precedes an italic title out
 * of the title. This is the reliable answer to the author/title split when the
 * source carried formatting; plain-text paste falls back to template extraction.
 */
export function prefillFromPaste(
  type: GuideType,
  rawText: string,
  italicRuns: ItalicRun[] = [],
): CitationFields {
  // Canonicalise whitespace and straight quotes before any extraction, and
  // re-base the rich-paste italic runs onto the result so their offsets still
  // point at the same words.
  const { text, fromRaw } = normalizePaste(rawText);
  const runs = italicRuns.map((run) => ({
    text: normalizeQuotes(run.text.replace(/\s+/g, " ").trim()),
    start: fromRaw[Math.min(run.start, rawText.length)] ?? 0,
    end: fromRaw[Math.min(run.end, rawText.length)] ?? 0,
  }));
  const positional = extractByTemplate(type, text) ?? {};
  const italicIds = italicComponentIds(type);
  // With no usable italic runs, correct the positional guesses with shape-based
  // anchors (a neutral citation, a reporter locus, a pinpoint, an edition, a
  // quoted title, an "X v Y" case name) recognised anywhere in the text.
  if (italicIds.length === 0 || runs.length !== italicIds.length) {
    return refineFields(type, positional, text);
  }
  const base = { ...positional };
  // Assign each italic run, in order, to each italic component, in order.
  italicIds.forEach((id, index) => {
    base[id] = runs[index].text;
  });
  // The text before the first italic run is the author/creator, if the template
  // has a non-italic field before that italic field.
  const order = templateComponentIds(type);
  const firstItalicIndex = order.indexOf(italicIds[0]);
  const priorId = order
    .slice(0, firstItalicIndex)
    .find((id) => !italicIds.includes(id));
  const before = text.slice(0, runs[0].start).trim();
  if (priorId && before) base[priorId] = before;
  // Correct the remaining non-italic fields (year, volume, reporter, pinpoint,
  // edition) with shape-based anchors, but keep the reliable italic placements
  // of the title/case name and the author lifted out in front of them.
  const refined = refineFields(type, base, text);
  italicIds.forEach((id) => {
    refined[id] = base[id];
  });
  if (priorId && before) refined[priorId] = before;
  return refined;
}

export type Detection = {
  typeId: string;
  fields: CitationFields;
  score: number;
};

/**
 * How much a template pins down, from 0 (free text only) to 1 (every field
 * delimited). A boundary between two placeholders separated by nothing but
 * whitespace is unconstrained: the extractor may cut it at any space and still
 * "match". A boundary carrying a literal — a bracket, a comma, "reported in" —
 * is real evidence that the reference has this type's shape.
 */
function templateConstraint(type: GuideType): number {
  // Score the most constrained alternative form, since that is the one a match
  // would have used.
  const forms = templateForms(type.outputTemplate);
  let best = 0;
  for (const form of forms) {
    const slots = form.match(/\{[^}]+\}/g) ?? [];
    if (slots.length <= 1) {
      best = Math.max(best, 1);
      continue;
    }
    // Between each adjacent pair of placeholders, is there any literal beyond
    // whitespace and the italic markers?
    const gaps = form.split(/\{[^}]+\}/).slice(1, -1);
    const constrained = gaps.filter((gap) => /[^\s*]/.test(gap)).length;
    best = Math.max(best, constrained / gaps.length);
  }
  // Never fully discount: a loose template can still be the right answer, it
  // just must not win on reconstruction alone.
  return 0.25 + 0.75 * best;
}

/**
 * Best-effort paste detection: try to read the pasted text with every type's
 * template and rank the ones that match by how well they account for the text
 * (all required components filled first, then the most components captured).
 * The user always confirms the type before anything is generated.
 */
/**
 * The evidence detection weighs, one number per signal. Kept as a named vector
 * so the weights can be fitted against the Guide's own 216 worked examples
 * (scripts/fit-detection.ts) instead of hand-tuned by eye.
 */
export type DetectionFeatures = {
  /** Fraction of the type's required components the paste filled, 0–1. */
  requiredCoverage: number;
  /** Required components left empty. */
  requiredMissing: number;
  /** Fraction of the components this type's template uses that got filled, 0–1. */
  captured: number;
  /** Reconstruction quality, 0–1, discounted by how much the template pins down. */
  refit: number;
  /** Distinctive literal words from the template found in the paste. */
  literalHits: number;
  /** Self-identifying anchors the type can hold (neutral citation, docket…). */
  shapeSupport: number;
  /** Values contradicting the shape their component is defined to have. */
  shapeViolations: number;
  /** Structure in the paste this type has no component for. */
  missingHome: number;
  /** A quoted title in the paste with nowhere to put it. */
  quotedTitleMismatch: number;
  /** An "(ed)" marker in the paste with no editor component. */
  editorMismatch: number;
  /** The paste names a jurisdiction this type does not belong to. */
  jurisdictionConflict: number;
};

/**
 * Fitted against the Guide's own 216 worked examples by
 * scripts/fit-detection.ts, under a sign constraint per signal so the search
 * could choose each weight's magnitude but never invert its meaning. Re-run
 * that script after changing any feature.
 *
 * Hand-tuned weights ranked the correct type first for 75 of the 216; these
 * reach 112, and on the third of the corpus held out of the fit the improvement
 * holds (10/46 → 16/46), so it is a real gain rather than memorisation.
 */
export const DETECTION_WEIGHTS: Record<keyof DetectionFeatures, number> = {
  requiredCoverage: 0,
  requiredMissing: 0,
  captured: 600,
  refit: 500,
  literalHits: 700,
  shapeSupport: 250,
  shapeViolations: -150,
  missingHome: -250,
  quotedTitleMismatch: -60,
  editorMismatch: 0,
  jurisdictionConflict: -400,
};

export function scoreFeatures(
  features: DetectionFeatures,
  weights: Record<keyof DetectionFeatures, number> = DETECTION_WEIGHTS,
): number {
  let total = 0;
  for (const key of Object.keys(weights) as (keyof DetectionFeatures)[]) {
    total += features[key] * weights[key];
  }
  return total;
}

/** Every type whose template can read this text, with its evidence measured. */
export function detectionCandidates(
  text: string,
): { typeId: string; fields: CitationFields; features: DetectionFeatures }[] {
  const trimmed = normalizePaste(text).text;
  if (!trimmed) return [];
  const lower = trimmed.toLowerCase();
  const normalise = (s: string) =>
    s.trim().replace(/\.$/, "").replace(/\s+/g, " ").toLowerCase();
  const candidates: {
    typeId: string;
    fields: CitationFields;
    features: DetectionFeatures;
  }[] = [];
  for (const type of guideTypes) {
    const positional = extractByTemplate(type, trimmed);
    if (!positional) continue;
    // Correct the boxes with shape anchors before scoring, so ranking reflects
    // how well the type explains the reference with fields in the right places.
    const fields = refineFields(type, positional, trimmed);
    const required = visibleComponents(type).filter((c) => c.required);
    const requiredCovered = required.filter((c) => fields[c.id]).length;
    // Does building from these placed fields reproduce the reference? Strong
    // evidence — but only to the extent the template constrained it. A template
    // that is nothing but free-text placeholders separated by spaces,
    // "{author} {title} {topic}", is an identity function: it reproduces ANY
    // input by cutting it at arbitrary spaces, so it proves nothing.
    let refit = 0;
    const built = buildCitation(type.id, fields);
    if (built.status === "ready") {
      const stripPin = (s: string) => normalise(s).replace(/\s+at\s+\S+$/, "");
      const b = stripPin(built.text);
      const t = stripPin(trimmed);
      if (b === t) refit = 1;
      else if (t.startsWith(b) || b.startsWith(t)) refit = 0.5;
    }
    refit *= templateConstraint(type);
    // Distinctive literal words in the template ("press release", "NZPD",
    // "reported in") that also appear in the input separate a specific format
    // from a permissive one that merely matched loosely.
    const literals =
      type.outputTemplate.replace(/\*|\{[^}]+\}/g, " ").match(/[A-Za-z]{4,}/g) ?? [];
    const literalHits = literals.filter((word) =>
      lower.includes(word.toLowerCase()),
    ).length;
    const quotedInInput = /[“"][^“”"]{3,}[”"]/.test(trimmed);
    const holdsTitle = ["title", "essayTitle", "chapterTitle"].some((id) =>
      type.components.some((c) => c.id === id),
    );
    const editorInInput = /\(eds?\)/.test(trimmed);
    const holdsEditor = type.components.some((c) => c.id === "editor");
    // Capture is scored as a FRACTION of the slots this template actually has.
    // As a raw count it rewarded a template purely for being wide: the US
    // session-law template filled six boxes from "Evidence Act 2006, s 8" —
    // nonsense in every one — and outscored the New Zealand statute type that
    // read it correctly into three.
    const slotCount = templateComponentIds(type).length;
    candidates.push({
      typeId: type.id,
      fields,
      features: {
        requiredCoverage: required.length ? requiredCovered / required.length : 1,
        requiredMissing: required.length - requiredCovered,
        captured: slotCount ? Object.keys(fields).length / slotCount : 0,
        refit,
        literalHits,
        shapeSupport: anchorSupport(type, trimmed),
        shapeViolations: fieldShapeViolations(type, fields),
        missingHome: anchorMismatch(type, trimmed),
        quotedTitleMismatch: quotedInInput && !holdsTitle ? 1 : 0,
        editorMismatch: editorInInput && !holdsEditor ? 1 : 0,
        jurisdictionConflict: jurisdictionConflict(type, trimmed),
      },
    });
  }
  return candidates;
}

export function detectTypes(text: string, limit = 6): Detection[] {
  const detections = detectionCandidates(text).map((candidate) => ({
    typeId: candidate.typeId,
    fields: candidate.fields,
    score: scoreFeatures(candidate.features),
  }));
  detections.sort((a, b) => b.score - a.score);
  return detections.slice(0, limit);
}

function stripTrailingStop(tokens: Token[]): Token[] {
  if (tokens.length === 0) return tokens;
  const result = tokens.map((token) => ({ ...token }));
  const last = result[result.length - 1];
  last.text = last.text.replace(/\.+$/, "");
  return result;
}

/**
 * Compose several ready citations into one footnote: semicolons between
 * sources, "and" before the last, and a single closing full stop (rule 2.2.4).
 */
export function composeFootnote(results: BuildResult[]): {
  text: string;
  html: string;
  tokens: Token[];
} {
  const ready = results.filter((result) => result.status === "ready");
  if (ready.length === 0) return { text: "", html: "", tokens: [] };

  const tokens: Token[] = [];
  ready.forEach((result, index) => {
    if (index > 0) {
      tokens.push({ text: index === ready.length - 1 ? "; and " : "; " });
    }
    tokens.push(...stripTrailingStop(result.tokens));
  });
  const last = tokens[tokens.length - 1];
  last.text = `${last.text.replace(/\.+$/, "")}.`;

  return {
    text: tokensToText(tokens),
    html: tokensToHtml(tokens),
    tokens,
  };
}

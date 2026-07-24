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
  renderFromTemplate,
  tokensToHtml,
  tokensToText,
  type Token,
} from "./render";

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
  const tokens = withFinalStop(renderFromTemplate(type.outputTemplate, fields));
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

export type Detection = {
  typeId: string;
  fields: CitationFields;
  score: number;
};

/**
 * Best-effort paste detection: try to read the pasted text with every type's
 * template and rank the ones that match by how well they account for the text
 * (all required components filled first, then the most components captured).
 * The user always confirms the type before anything is generated.
 */
export function detectTypes(text: string, limit = 6): Detection[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const detections: Detection[] = [];
  for (const type of guideTypes) {
    const fields = extractByTemplate(type, trimmed);
    if (!fields) continue;
    const required = visibleComponents(type).filter((c) => c.required);
    const requiredCovered = required.filter((c) => fields[c.id]).length;
    const requiredMissing = required.length - requiredCovered;
    const captured = Object.keys(fields).length;
    // Full required coverage dominates; then more captured detail; strongly
    // penalise a match that leaves required fields empty.
    const score = requiredCovered * 100 + captured - requiredMissing * 200;
    detections.push({ typeId: type.id, fields, score });
  }
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

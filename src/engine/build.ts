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
  chooseForm,
  type Token,
} from "./render";
import {
  anchorMismatch,
  anchorSupport,
  jurisdictionConflict,
  refineFields,
  reconcileAgainstSource,
  splitNeutralCitationParts,
  fillReportLocusTail,
} from "./scan";
import { fieldShapeViolations } from "./shapes";
import { applyGuideRules, normaliseForComparison } from "./rules";
import { normaliseForeignFormat } from "./foreignFormat";

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

/**
 * A required component another may stand in for.
 *
 * Rule 6.1.2(g): "If there is a named editor or general editor, use that name
 * followed by '(ed)' or, if there is more than one, '(eds)'." The editor's name
 * takes the AUTHOR's place — it is not an extra field alongside it — so a book
 * with an editor and no author is complete, and demanding an author refused
 * "Peter Blanchard (ed) Civil Remedies in New Zealand (2nd ed, Brookers,
 * Wellington, 2011)": the Guide's own illustration of the rule.
 *
 * Deliberately a short explicit list rather than a general "required per form"
 * rule. That was implemented and measured and cost more than it gained — see the
 * trap of the same name in docs/working-notes.md.
 */
const STANDS_IN_FOR: Record<string, Record<string, string[]>> = {
  "text-book": { author: ["editor"] },
};

/**
 * The components a type requires GIVEN the form it is being cited under.
 *
 * A rule's alternate forms need different facts. Rule 8.5 cites a Scottish case
 * either by report — year, series, page — or by neutral citation alone, and rule
 * 9.3.1's second form needs only a short title. Demanding every component marked
 * required across ALL forms meant those citations were asked for facts the form
 * does not have and refused to build, so the Guide's own worked examples produced
 * nothing.
 *
 * This was tried once before and reverted, because it makes `chooseForm`
 * load-bearing for correctness rather than presentation and `chooseForm` was not
 * good enough to carry it. It is measured directly now — `npm run qa:forms` —
 * which is what changed.
 */
function requiredForChosenForm(type: GuideType, fields: CitationFields): GuideComponent[] {
  const inForm = new Set(
    [...chooseForm(type.outputTemplate, fields as Record<string, string>).matchAll(/\{([^}]+)\}/g)]
      .map((m) => m[1]),
  );
  return visibleComponents(type).filter((c) => c.required && inForm.has(c.id));
}

/** Is a required component satisfied, directly or by one that stands in for it? */
function componentSatisfied(
  type: GuideType,
  fields: CitationFields,
  id: string,
): boolean {
  if (fieldValue(fields, id)) return true;
  return (STANDS_IN_FOR[type.id]?.[id] ?? []).some((alt) => fieldValue(fields, alt));
}

export function validate(type: GuideType, fields: CitationFields): Issue[] {
  const issues: Issue[] = [];
  for (const component of requiredForChosenForm(type, fields)) {
    if (!componentSatisfied(type, fields, component.id)) {
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
  // Apply the Guide's conditional rules before anything else: a component the
  // Guide says does not belong alongside what is already present is dropped
  // here, with a note so the interface can explain the omission rather than
  // silently discarding something the user typed.
  const ruled = applyGuideRules(type, fields);
  const fieldsToRender = ruled.fields;
  const issues = validate(type, fieldsToRender);
  for (const applied of ruled.applied) {
    // A rule either drops a component or corrects its value, and the reader is
    // owed the right sentence for which: "left out" reads as a fault when the
    // field is still there with a shorter, correct value in it.
    const stillPresent = Boolean((fieldsToRender[applied.field] ?? "").trim());
    issues.push({
      level: "note",
      field: applied.field,
      message: `${stillPresent ? "Corrected" : "Left out"} under rule ${applied.rule}. ${applied.why}`,
    });
  }
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
  for (const [id, raw] of Object.entries(fieldsToRender)) {
    const text = typeof raw === "string" ? raw.trim() : "";
    values[id] = italicIds.has(id) ? { text, italic: true } : text;
  }
  // The Guide records, per component, the separator that introduces it. The
  // renderer needs that to know whose comma a stranded separator was.
  const separators = Object.fromEntries(
    type.components.map((component) => [component.id, component.separatorBefore]),
  );
  const tokens = withFinalStop(
    renderFromTemplate(type.outputTemplate, values, separators),
  );
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
  return requiredForChosenForm(type, fields).filter(
    (component) => !componentSatisfied(type, fields, component.id),
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
  // As in detection: a recognised foreign style is rewritten into the Guide's
  // shape before extraction. A rewritten paste no longer lines up with the
  // rich-paste italic offsets — the words have moved — so those are dropped
  // rather than applied to whatever now sits at the old position.
  const foreign = normaliseForeignFormat(rawText);
  const sourceText = foreign.style ? foreign.text : rawText;
  const usableRuns = foreign.style ? [] : italicRuns;
  const { text, fromRaw } = normalizePaste(sourceText);
  const runs = usableRuns.map((run) => ({
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
    return reconcileAgainstSource(
      type,
      fillReportLocusTail(
        type,
        splitNeutralCitationParts(type, refineFields(type, positional, text), text),
        text,
      ),
      text,
    );
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
  return reconcileAgainstSource(
    type,
    fillReportLocusTail(type, splitNeutralCitationParts(type, refined, text), text),
    text,
  );
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
  // A reference written in another style is rewritten into the Guide's shape
  // FIRST, so the weights below score the kind of string they were fitted
  // against. Nothing here learns a new format; the pre-pass hands it one it
  // already knows. A paste that is not in a recognised foreign style comes
  // through untouched.
  const trimmed = normalizePaste(normaliseForeignFormat(text).text).text;
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
      const stripPin = (s: string) =>
        normaliseForComparison(normalise(s)).replace(/\s+at\s+\S+$/, "");
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
    // How many DISTINCT facts this type managed to separate, capped so a very
    // wide template cannot win on breadth alone.
    //
    // Neither obvious measure works by itself. A raw count rewards a template
    // for being wide — the US session-law template filled six boxes from
    // "Evidence Act 2006, s 8", nonsense in every one. A fraction of the
    // template's own slots rewards a template for being NARROW, which is worse:
    // "{billCitation} ({locator})" fills both of its two slots by swallowing an
    // entire book into them and scores a perfect 1.0, beating the book type
    // that correctly separated author, title, publisher, place and year.
    //
    // Counting the facts separated, capped, prefers the type that actually
    // explains the reference. The shape checks below stop it running away.
    candidates.push({
      typeId: type.id,
      fields,
      features: {
        requiredCoverage: required.length ? requiredCovered / required.length : 1,
        requiredMissing: required.length - requiredCovered,
        captured: Math.min(Object.keys(fields).length, 8) / 8,
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

/**
 * Something worth showing the user about the citation just generated: a detail
 * from their paste that did not survive, or a run of text the citation repeats.
 */
export type CitationWarning = {
  text: string;
  kind: "missing" | "repeated";
};

const AUDIT_STOPWORDS = new Set([
  "the", "and", "of", "in", "at", "on", "for", "to", "a", "an", "v", "vs",
  "ed", "eds", "vol", "no", "pt", "ch", "online", "looseleaf", "ebook",
  "press", "release", "podcast", "above", "n",
]);

/**
 * What the paste said that the citation does not.
 *
 * Identifying the source type is the weakest part of the tool, and a wrongly
 * chosen type usually fails in the same way: a detail the reference plainly
 * contained is quietly left out, because the type had nowhere to put it. That
 * is invisible in the finished citation — it reads perfectly well — so the one
 * moment a student could catch it is the moment they compare it against what
 * they pasted, which is exactly the comparison nobody makes.
 *
 * This makes it for them. It needs no knowledge of the Guide: any year, number,
 * docket or distinctive word that was in the paste and is missing from the
 * output is worth showing, whatever the rule says.
 *
 * It deliberately does not judge. Some omissions are correct — rule 3.2 drops a
 * court identifier when a neutral citation is present — so this reports what
 * changed and leaves the reading of it to the user.
 */
export function auditAgainstPaste(
  paste: string,
  citation: string,
): CitationWarning[] {
  if (!paste.trim() || !citation.trim()) return [];
  // Compare case-insensitively, but report the words as the user wrote them:
  // showing "maxton" back to someone who typed "Maxton" reads like a fault in
  // the tool rather than a question about their citation.
  // Compare against the paste AS THE GUIDE REQUIRES IT TO BE WRITTEN. Rule 3.2.1
  // removes "& Anor" from a case name, so reporting it as a detail the citation
  // had lost would be the tool apologising for obeying the rule — and it already
  // explains that change in its own note.
  const source = normaliseForComparison(normalizePaste(paste).text);
  const output = normalizePaste(citation).text.toLowerCase().replace(/[“”‘’"']/g, "");
  const lost: CitationWarning[] = [];
  const seen = new Set<string>();

  const report = (raw: string) => {
    const token = raw.toLowerCase().replace(/[“”‘’"']/g, "");
    if (!token || seen.has(token)) return;
    seen.add(token);
    if (!output.includes(token)) lost.push({ text: raw, kind: "missing" });
  };

  // Numbers carry the facts a citation is built from — years, volumes, pages,
  // paragraph numbers, dockets — and a lost one is always worth reporting.
  for (const match of source.matchAll(/[A-Za-z]*\d[\w./-]*/g)) {
    if (match[0].length >= 2) report(match[0]);
  }
  // Words of substance: a dropped party, publisher or reporter abbreviation.
  for (const match of source.matchAll(/[A-Za-zĀ-ſ][\w’'-]{2,}/g)) {
    if (!AUDIT_STOPWORDS.has(match[0].toLowerCase())) report(match[0]);
  }

  return [...lost, ...repeatedRuns(citation)];
}

/**
 * Runs of the citation that appear twice over.
 *
 * The other half of what a wrongly chosen type does. Where it has nowhere to
 * put a detail the reference cannot lose it — the positional pass and the
 * anchors disagree about where one component ends — so it writes the same words
 * again: "(2017) 178 Waiariki MB 32 (2017) 178 Waiariki MB 32". Comparing
 * against the paste cannot see this, because nothing was lost; only the output
 * shows it.
 *
 * Template literals repeat legitimately ("at", brackets, "New Zealand"), so
 * only a run of several substantial words counts.
 */
function repeatedRuns(citation: string): CitationWarning[] {
  const words = citation
    .replace(/[“”‘’"']/g, "")
    .split(/\s+/)
    .filter(Boolean);
  const found: CitationWarning[] = [];
  const reported = new Set<string>();
  const MIN_RUN = 3;
  for (let length = Math.min(8, Math.floor(words.length / 2)); length >= MIN_RUN; length--) {
    for (let start = 0; start + length * 2 <= words.length; start++) {
      const run = words.slice(start, start + length).join(" ");
      // Substance, not punctuation: a repeated run of brackets proves nothing.
      if ((run.match(/[A-Za-z\d]{2,}/g) ?? []).length < MIN_RUN) continue;
      const rest = words.slice(start + length).join(" ");
      if (!rest.includes(run)) continue;
      if ([...reported].some((seen) => seen.includes(run))) continue;
      reported.add(run);
      found.push({ text: run, kind: "repeated" });
    }
  }
  return found;
}

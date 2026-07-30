/**
 * Data-driven renderer. A citation type is described by an `outputTemplate`
 * (e.g. "*{caseName}* [{year}] {courtIdentifier} {judgmentNumber} at {pinpoint}")
 * and a list of components. This module turns a template + a set of prepared
 * component values into the final citation tokens, eliding absent optional
 * components together with the punctuation/brackets that only existed to attach
 * them, and preserving italic runs.
 *
 * The same template drives extraction (parsing an example/citation back into
 * component values), which powers the accuracy harness: for every worked
 * example in the Style Guide we extract values via the template and render them
 * back, and the result must equal the example exactly.
 */
import type { GuideType } from "../data/styleGuide";

export type Token = { text: string; italic?: boolean };

export type ComponentValue = string | { text: string; italic?: boolean } | undefined;

type TplToken =
  | { kind: "lit"; text: string; italic: boolean }
  | { kind: "ph"; id: string; italic: boolean };

/** Remove editorial annotations a form carries (a "label:" prefix or a trailing
 * "(2011+)"/"(pre-2011)" note) so only the citation structure remains. */
function stripAnnotations(form: string): string {
  return form
    .replace(/^\s*[A-Za-z0-9 +/–-]+:\s+/, "")
    .replace(/\s{2,}\([^)]*\)\s*$/, "")
    .trim();
}

/** A template may hold several forms separated by " | " (e.g. modern vs older
 * citation styles). Return each as a clean, single form. */
export function templateForms(template: string): string[] {
  const forms = template
    .split(/\s+\|\s+/)
    .map(stripAnnotations)
    .filter(Boolean);
  return forms.length ? forms : [template.trim()];
}

export function parseTemplate(form: string): TplToken[] {
  const tokens: TplToken[] = [];
  let italic = false;
  let lit = "";
  const flush = () => {
    if (lit) {
      tokens.push({ kind: "lit", text: lit, italic });
      lit = "";
    }
  };
  for (let i = 0; i < form.length; i++) {
    const ch = form[i];
    if (ch === "*") {
      flush();
      italic = !italic;
      continue;
    }
    if (ch === "{") {
      const end = form.indexOf("}", i);
      if (end === -1) {
        lit += ch;
        continue;
      }
      flush();
      tokens.push({ kind: "ph", id: form.slice(i + 1, end), italic });
      i = end;
      continue;
    }
    lit += ch;
  }
  flush();
  return tokens;
}

function valueText(value: ComponentValue): string {
  if (value === undefined) return "";
  return (typeof value === "string" ? value : value.text).trim();
}

/** Tidy a literal run once absent values have made brackets/separators dangle. */
function cleanLiteral(text: string): string {
  return text
    .replace(/\(\s*\)/g, "")
    .replace(/\[\s*\]/g, "")
    .replace(/[“"”]\s*[“"”]/g, "")
    // A separator left dangling against a bracket once a value was elided.
    .replace(/([([])\s*[-,–]\s*/g, "$1")
    .replace(/\s*[-,–]\s*([)\]])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .replace(/\s+,/g, ",")
    .replace(/,\s*,/g, ",")
    .replace(/,\s*\)/g, ")")
    .replace(/\(\s*,\s*/g, "(")
    // Comma cleanup above can create a newly-empty pair; strip it too.
    .replace(/\(\s*\)/g, "")
    .replace(/\[\s*\]/g, "")
    .replace(/\s{2,}/g, " ");
}

/**
 * Pick the alternate template form that fits the facts we actually hold.
 *
 * Several types in the Guide are genuinely two formats under one rule — a
 * Supreme Court transcript is "[year] NZSC Trans number" from 2011 and
 * "Transcript fileNumber, hearingDate" before it; a Gazette notice changed
 * shape in October 2017. Rendering always took the first form, so a pre-2011
 * transcript came out as "Couch v Attorney-General Transcript [2006] NZSC
 * Trans" — the first form's skeleton with the second form's facts dropped on
 * the floor.
 *
 * The right form is the one that uses the most of what we have and leaves the
 * fewest of its own slots empty.
 */
function chooseForm(
  template: string,
  values: Record<string, ComponentValue>,
): string {
  const forms = templateForms(template);
  if (forms.length === 1) return forms[0];
  const filled = new Set(
    Object.keys(values).filter((id) => valueText(values[id]).trim() !== ""),
  );
  let best = forms[0];
  let bestScore = -Infinity;
  for (const form of forms) {
    const slots = [...new Set([...form.matchAll(/\{([^}]+)\}/g)].map((m) => m[1]))];
    const used = slots.filter((id) => filled.has(id)).length;
    const empty = slots.length - used;
    const unused = [...filled].filter((id) => !slots.includes(id)).length;
    const score = used * 2 - empty - unused;
    if (score > bestScore) {
      bestScore = score;
      best = form;
    }
  }
  return best;
}

export function renderFromTemplate(
  template: string,
  values: Record<string, ComponentValue>,
): Token[] {
  const tpl = parseTemplate(chooseForm(template, values));
  const out: Token[] = [];
  let litBuffer = "";
  // Whether an optional component was dropped since the buffer was last flushed.
  // If so, the buffer holds only the separators that flanked the missing field,
  // which collapse to a single space (commas/dashes that joined it disappear).
  let elision = false;
  const flushLit = () => {
    if (!litBuffer) {
      elision = false;
      return;
    }
    let text = litBuffer;
    if (elision) {
      // A field dropped from a comma-separated list (two commas flank the gap)
      // leaves one list comma; a field dropped elsewhere collapses to a space.
      const commas = (text.match(/,/g) ?? []).length;
      text =
        commas >= 2
          ? text.replace(/(?:\s*,\s*)+/g, ", ")
          : text.replace(/\s*[,–-]\s*/g, " ");
    }
    const cleaned = cleanLiteral(text);
    if (cleaned) out.push({ text: cleaned });
    litBuffer = "";
    elision = false;
  };
  for (const t of tpl) {
    if (t.kind === "lit") {
      if (t.italic) {
        flushLit();
        out.push({ text: t.text, italic: true });
      } else {
        litBuffer += t.text;
      }
      continue;
    }
    const raw = values[t.id];
    const text = valueText(raw);
    if (!text) {
      // Drop a "unit word" that only introduces this now-absent field
      // (e.g. "vol", "pt", "no", "above n", "at") along with its leading space.
      const before = litBuffer;
      litBuffer = litBuffer.replace(
        /\s*[,–-]?\s*(?:\b(?:above n|pt|vol|no|cl|reg|sch|art|ch|at)\b|§)\s*$/i,
        "",
      );
      // Only trigger comma-collapse when the absent field's OWN separator was
      // punctuation (not a unit word already handled above); this keeps a comma
      // that belongs to the NEXT, present field (e.g. a parallel citation).
      if (litBuffer === before) elision = true;
      continue;
    }
    flushLit();
    const italic = t.italic || (typeof raw === "object" && raw?.italic) || false;
    out.push(italic ? { text, italic: true } : { text });
  }
  flushLit();

  return finalize(out);
}

/** Trim edges and remove separators left dangling at the very start or end. */
function finalize(tokens: Token[]): Token[] {
  const result = tokens.map((t) => ({ ...t })).filter((t) => t.text.length > 0);
  if (result.length === 0) return result;
  result[0].text = result[0].text.replace(/^\s+/, "");
  const last = result[result.length - 1];
  last.text = last.text
    .replace(/\s+$/, "")
    .replace(/(?:\s+(?:at|in|vol|no|reported)|[,;(]|\s+–)\s*$/i, "")
    .replace(/\s+$/, "");
  return result.filter((t) => t.text.length > 0);
}

export function tokensToText(tokens: Token[]): string {
  return tokens.map((t) => t.text).join("");
}

function escapeHtml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function tokensToHtml(tokens: Token[]): string {
  return tokens
    .map((t) => (t.italic ? `<em>${escapeHtml(t.text)}</em>` : escapeHtml(t.text)))
    .join("");
}

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Constrained capture patterns for fields with a recognisable shape. Typing
 * these anchors the surrounding free-text fields, so (for example) a case name
 * stops at its neutral citation instead of bleeding into it. Kept deliberately
 * permissive so real values still match; anything unlisted uses a plain capture.
 */
function capturePattern(id: string): string | null {
  if (id === "neutralCitation") {
    return "\\[\\d{4}\\]\\s+[A-Za-z]+(?:\\s+[A-Za-z]+)*\\s+\\d+[A-Za-z]?";
  }
  return null;
}

/**
 * Build a regex from a type's template that captures each component value, using
 * the component `required` flags to make optional components (with their leading
 * separator and any wrapping bracket) optional in the match.
 */
export function buildExtractionRegex(
  type: GuideType,
  form: string = templateForms(type.outputTemplate)[0],
): {
  regex: RegExp;
  ids: string[];
} | null {
  const tpl = parseTemplate(form);
  const requiredById = new Map(type.components.map((c) => [c.id, c.required]));
  const ids: string[] = [];
  let pattern = "^";

  for (let i = 0; i < tpl.length; i++) {
    const t = tpl[i];
    if (t.kind === "lit") {
      // A literal that leads a following placeholder is emitted while handling
      // that placeholder; only a trailing literal is emitted here.
      if (tpl[i + 1] && tpl[i + 1].kind === "ph") continue;
      pattern += escapeRegExp(t.text);
      continue;
    }

    const leadTok =
      i > 0 && tpl[i - 1].kind === "lit" ? (tpl[i - 1] as { text: string }).text : "";
    const required = requiredById.get(t.id) ?? true;

    // For an optional field, structural closing brackets at the start of the
    // lead belong to an already-open group and must stay mandatory; only the
    // remaining separator becomes optional with the capture.
    let mandatoryPrefix = "";
    let sep = leadTok;
    if (!required) {
      // Leading closing brackets or a closing quote (with any spaces between)
      // are structural — they close an earlier field — so they stay mandatory;
      // a plain leading separator stays with the optional unit.
      const closers = leadTok.match(/^(?:\s*[)\]”])+/);
      if (closers && closers[0]) {
        mandatoryPrefix = closers[0];
        sep = leadTok.slice(closers[0].length);
      }
    }

    // A quoted field stops at its closing quote rather than swallowing it.
    const opensQuote = /[“"]\s*$/.test(sep);
    const typed = capturePattern(t.id);
    const capture = opensQuote
      ? "([^“”\"]*)"
      : typed
        ? `(${typed})`
        : "(.*?)";

    // If the separator opens a bracket and the next literal closes it, pull the
    // closer into this unit so an absent optional drops both brackets.
    let trailer = "";
    const next = tpl[i + 1];
    const opener = sep.trimEnd().slice(-1);
    if (next && next.kind === "lit" && (opener === "(" || opener === "[")) {
      const closer = opener === "(" ? ")" : "]";
      if (next.text.trimStart().startsWith(closer)) {
        trailer = closer;
        (tpl[i + 1] as { text: string }).text = next.text.replace(closer, "");
      }
    }

    // An optional field that OPENS a multi-item bracket (its "(" has no
    // immediate closer, and more fields follow): keep the "(" mandatory (it
    // opens the list) and pull the field's trailing comma into its optional
    // unit, so an absent first item — e.g. a hardcopy newspaper with no
    // "online ed," — drops cleanly.
    if (!required && !trailer) {
      const opener = sep.match(/^(.*[([])(\s*)$/);
      const nextLit = tpl[i + 1];
      if (opener && nextLit && nextLit.kind === "lit" && /^,\s*/.test(nextLit.text)) {
        mandatoryPrefix += opener[1];
        sep = opener[2];
        const comma = nextLit.text.match(/^,\s*/)![0];
        trailer = comma;
        (tpl[i + 1] as { text: string }).text = nextLit.text.slice(comma.length);
      }
    }

    // An optional field with a distinctive shape (a typed pattern, e.g. a
    // neutral citation) followed by a comma that leads a REQUIRED field: the
    // comma only appears when this field does (it joins the neutral citation to
    // the reported citation), so pull it into this optional unit. Restricted to
    // typed fields so a free-text field (a conference name) is unaffected.
    if (!required && !trailer && capturePattern(t.id)) {
      const nextLit = tpl[i + 1];
      const after = tpl[i + 2];
      const afterRequired =
        after && after.kind === "ph" && (requiredById.get(after.id) ?? true);
      if (nextLit && nextLit.kind === "lit" && /^,\s*$/.test(nextLit.text) && afterRequired) {
        trailer += nextLit.text;
        (tpl[i + 1] as { text: string }).text = "";
      }
    }

    ids.push(t.id);
    pattern += escapeRegExp(mandatoryPrefix);
    const unit = `${escapeRegExp(sep)}${capture}${escapeRegExp(trailer)}`;
    pattern += required ? unit : `(?:${unit})?`;
  }
  pattern += "$";

  try {
    return { regex: new RegExp(pattern), ids };
  } catch {
    return null;
  }
}

/** Drop a trailing unmatched close bracket a greedy capture may have swallowed. */
function balanceBrackets(value: string): string {
  let text = value;
  const trailingClose = /[)\]]$/;
  while (trailingClose.test(text)) {
    const opens = (text.match(/[([]/g) ?? []).length;
    const closes = (text.match(/[)\]]/g) ?? []).length;
    if (closes <= opens) break;
    text = text.slice(0, -1);
  }
  return text;
}

/**
 * Convert straight quotes/apostrophes to the curly forms the Style Guide uses.
 * A plain-text paste, a PDF copy, or hand typing yields ASCII " and ', which
 * otherwise defeat the quote-aware detection and extraction (and would render
 * incorrectly). An opening mark follows a space/bracket/start; everything else
 * is a closing mark or an apostrophe.
 */
export function normalizeQuotes(text: string): string {
  return text
    .replace(/(^|[\s([{])"/g, "$1“") // opening double “
    .replace(/"/g, "”") // closing double ”
    .replace(/(^|[\s([{])'/g, "$1‘") // opening single ‘
    .replace(/'/g, "’"); // closing single / apostrophe ’
}

/** A canonicalised paste, plus the offset map back to the text it came from. */
export type NormalizedPaste = {
  text: string;
  /** `fromRaw[i]` is the offset in `text` of raw character `i`. */
  fromRaw: number[];
};

/**
 * Canonicalise pasted text before any parsing.
 *
 * Real pastes do not arrive as clean single-spaced strings: copying out of a
 * PDF gives non-breaking spaces, copying out of Word or a database record wraps
 * lines mid-citation, and hand-editing leaves double spaces behind. Every one of
 * those defeated detection outright, and any run of spaces that survived was
 * carried into the fields and out into the generated citation.
 *
 * So every kind of whitespace collapses to a single plain space here, once, at
 * the boundary. Because that changes offsets, the returned `fromRaw` map lets a
 * rich paste's italic runs be re-based onto the normalised text.
 */
export function normalizePaste(raw: string): NormalizedPaste {
  const fromRaw: number[] = new Array(raw.length + 1);
  let out = "";
  let pendingSpace = false;
  for (let i = 0; i < raw.length; i++) {
    fromRaw[i] = out.length;
    const ch = raw[i];
    if (/\s/.test(ch)) {
      // Collapse a run of any whitespace into one space, and drop it entirely
      // at the start so the citation begins at its first real character.
      pendingSpace = out.length > 0;
      continue;
    }
    if (pendingSpace) {
      fromRaw[i] = out.length + 1;
      out += " ";
      pendingSpace = false;
    }
    out += ch;
  }
  fromRaw[raw.length] = out.length;
  return { text: normalizeQuotes(out), fromRaw };
}

export function extractByTemplate(
  type: GuideType,
  citation: string,
): Record<string, string> | null {
  // Note: callers that receive raw pasted text (detectTypes, prefillFromPaste)
  // normalise straight quotes first; the Guide's own examples are already curly.
  const stripped = citation.trim().replace(/\.$/, "");
  const norm = (s: string) => s.trim().replace(/\.$/, "").replace(/\s+/g, " ");
  // Try each form the type offers (e.g. modern vs older citation styles).
  // Prefer a form whose values render back to the input (the correct structure);
  // otherwise the one that fills the most fields.
  let best: Record<string, string> | null = null;
  let bestScore = -1;
  for (const form of templateForms(type.outputTemplate)) {
    const built = buildExtractionRegex(type, form);
    if (!built) continue;
    const match = stripped.match(built.regex);
    if (!match) continue;
    const values: Record<string, string> = {};
    built.ids.forEach((id, index) => {
      const captured = match[index + 1];
      if (captured != null && captured.trim().length > 0) {
        values[id] = balanceBrackets(captured.trim());
      }
    });
    const roundTrips =
      norm(tokensToText(renderFromTemplate(form, values))) === norm(stripped);
    const score = (roundTrips ? 1000 : 0) + Object.keys(values).length;
    if (score > bestScore) {
      bestScore = score;
      best = values;
    }
  }
  return best;
}

/**
 * Split a paste into the separate references it contains.
 *
 * A reading list, a footnote block or a bibliography is pasted as several
 * citations at once, and the tool read only the first and silently dropped the
 * rest — the worst possible failure, because the student gets a citation back
 * and no sign that anything is missing. Numbered lists were worse still: the
 * marker was absorbed into the case name ("1. Attorney-General v X").
 *
 * The difficulty is that a single citation also wraps across lines when it is
 * copied out of a PDF, so a line break alone means nothing. A new reference is
 * taken to start only where the previous line finished a sentence AND the next
 * line opens like a citation — or where a blank line or a list marker says so
 * outright.
 */
export function splitReferences(raw: string): string[] {
  if (!raw.trim()) return [];
  const lines = raw
    .replace(/\r\n?/g, "\n")
    .split("\n")
    // A footnote marker is at most three digits: bounding it stops a bracketed
    // YEAR opening a wrapped line — "[1984] 1 NZLR 394 (CA) at 398." — from
    // being stripped as if it were "[12]".
    .map((line) => line.replace(/^\s*(?:\d{1,3}[.)]|\[\d{1,3}\]|[-•*‣—–])\s+/, "").trim());

  const blocks: string[] = [];
  let current: string[] = [];
  const flush = () => {
    const joined = current.join(" ").replace(/\s+/g, " ").trim();
    if (joined) blocks.push(joined);
    current = [];
  };

  // A line that opens a citation: a capital, a quotation mark, or a bracketed
  // date — the shapes every one of the Guide's formats can begin with.
  const opensCitation = /^(?:[“"(\[]|[A-ZĀ-ſ])/;
  // A line that closes one: a full stop, allowing a closing quote or bracket.
  const closesCitation = /[.!?][”"')\]]?$/;

  for (const [index, line] of lines.entries()) {
    if (!line) {
      flush();
      continue;
    }
    const previous = current.length ? current[current.length - 1] : "";
    const startsNew =
      current.length > 0 &&
      closesCitation.test(previous) &&
      opensCitation.test(line) &&
      // A list marker was already stripped, so a numbered list always splits.
      (/^\s*(?:\d{1,3}[.)]|\[\d{1,3}\])\s+/.test(raw.split("\n")[index] ?? "") ||
        closesCitation.test(previous));
    if (startsNew) flush();
    current.push(line);
  }
  flush();

  // Anything too short to be a reference is a stray fragment, not a citation.
  return blocks.filter((block) => block.replace(/\W/g, "").length >= 8);
}

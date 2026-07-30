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
import { fieldShapeViolations } from "./shapes";

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
export function chooseForm(
  template: string,
  values: Record<string, ComponentValue>,
  /** Which components the type marks required, so an empty one weighs properly. */
  required: Set<string> = new Set(),
): string {
  const forms = templateForms(template);
  if (forms.length === 1) return forms[0];
  const filled = new Set(
    Object.keys(values).filter((id) => valueText(values[id]).trim() !== ""),
  );
  // Every supplied value's text, for judging what a form's literals claim.
  const supplied = Object.values(values).map(valueText).join(" ").toLowerCase();

  const slotsOf = (form: string) => [
    ...new Set([...form.matchAll(/\{([^}]+)\}/g)].map((m) => m[1])),
  ];
  // A slot only ONE form has. Filling one is a deliberate choice of that form.
  const exclusive = forms.map((form, index) => {
    const others = new Set(forms.filter((_, i) => i !== index).flatMap(slotsOf));
    return slotsOf(form).filter((id) => !others.has(id));
  });

  let best = forms[0];
  let bestScore = -Infinity;
  for (const [index, form] of forms.entries()) {
    const slots = slotsOf(form);
    const used = slots.filter((id) => filled.has(id)).length;
    const empty = slots.filter((id) => !filled.has(id)).length;
    // A value the user supplied that this form has NO SLOT FOR is the strongest
    // evidence against it — they typed it because the citation needs it. Rule
    // 10.6.2's fuller form names the BISD supplement, and a reader who filled that
    // in must not be given the form that silently drops it.
    const unused = [...filled].filter((id) => !slots.includes(id)).length;
    // A form's literal text can be a CLAIM about the source. Rule 9.3.1's second
    // form is one slot followed by "pt 1 of the Constitution Act 1982, being sch B
    // to the Canada Act 1982 (UK)" — narrow enough to win on arithmetic, and
    // picking it turns a student's "Crimes Act" into the Canadian Charter.
    //
    // Only a NAMED thing counts, which is why the test is a capital letter rather
    // than length: "Constitution", "Canada", "Transcript", "eBook", "Gazette" name
    // something the source would have to be. The lowercase connective a template
    // supplies — "paper presented to", "being", "as cited in" — asserts nothing
    // about the source and must not be penalised, or rule 6.7.2's conference paper
    // loses its own form.
    // Waived where the reader has filled a slot only THIS form has. Rule 10.6.2's
    // fuller form names "GATT BISD", which is an assertion — but someone who
    // entered the BISD supplement or its page has chosen that form, and dropping
    // to the shorter one silently discards what they typed.
    const evidenced = exclusive[index].some((id) => filled.has(id));
    const asserted = evidenced
      ? 0
      : (form.replace(/\*|\{[^}]+\}/g, " ").match(/[A-Za-z]{4,}/g) ?? [])
          .filter((word) => /\p{Lu}/u.test(word))
          .map((word) => word.toLowerCase())
          .filter((word) => !supplied.includes(word)).length;
    // A value with nowhere to go outweighs an assertion, because the reader put it
    // there on purpose: rule 10.6.2's fuller form names "GATT BISD" — an assertion
    // — but a reader who filled in the BISD supplement plainly wants that form.
    const score = used * 2 - empty - 10 * unused - 8 * asserted;
    if (score > bestScore) {
      bestScore = score;
      best = form;
    }
  }
  return best;
}

/**
 * Drop brackets from a value that the template is about to write itself.
 *
 * A student reading a judgment types the year exactly as it is printed —
 * "(1986)" or "[2009]" — and several templates supply those brackets around the
 * slot, so the citation came out "((1986))". The paste path already guarded
 * against this, but a hand-typed field went straight through, which is the one
 * path a careful user is most likely to take.
 */
function stripSuppliedBrackets(
  tpl: TplToken[],
  values: Record<string, ComponentValue>,
): Record<string, ComponentValue> {
  const out = { ...values };
  for (let i = 0; i < tpl.length; i++) {
    const token = tpl[i];
    if (token.kind !== "ph") continue;
    const before = tpl[i - 1];
    const after = tpl[i + 1];
    const opener = before?.kind === "lit" ? before.text.trimEnd().slice(-1) : "";
    const closer = after?.kind === "lit" ? after.text.trimStart().slice(0, 1) : "";
    const pair =
      (opener === "[" && closer === "]") || (opener === "(" && closer === ")");
    if (!pair) continue;
    const raw = out[token.id];
    const text = valueText(raw);
    if (!text) continue;
    const stripped =
      (opener === "[" && /^\[.*\]$/.test(text)) ||
      (opener === "(" && /^\(.*\)$/.test(text))
        ? text.slice(1, -1).trim()
        : text;
    if (stripped === text) continue;
    out[token.id] =
      typeof raw === "object" && raw ? { ...raw, text: stripped } : stripped;
  }
  return out;
}

/**
 * Does the separator after an absent field belong to the NEXT field?
 *
 * Both of these leave a comma stranded when the middle field is empty:
 *
 *   {caseName} {neutralCitation}, {year} ...     — comma must GO
 *   {title} {year}, {pinpoint}                   — comma must STAY
 *
 * The difference is whose comma it is, and the Guide records that on each
 * component. A pinpoint under rule 4.3.4 is introduced by "', '" outright, so
 * the comma is the pinpoint's and survives its neighbour. A reported case's
 * year is introduced by "', ' (after neutral citation) or space" — conditional
 * on the neutral citation being there — so with no neutral citation there is no
 * comma either.
 */
function separatorBelongsToNext(separatorBefore: string | undefined): boolean {
  if (!separatorBefore) return false;
  if (/\bor\b/.test(separatorBefore)) return false;
  return /^['"\u2018\u201c]?\s*,/.test(separatorBefore.trim());
}

export function renderFromTemplate(
  template: string,
  rawValues: Record<string, ComponentValue>,
  separators: Record<string, string> = {},
): Token[] {
  const tpl = parseTemplate(chooseForm(template, rawValues));
  const values = stripSuppliedBrackets(tpl, rawValues);
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
  for (let i = 0; i < tpl.length; i++) {
    const t = tpl[i];
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
      if (litBuffer === before) {
        // Look ahead: if the next field owns the separator that follows this
        // absent one, that separator must survive.
        const next = tpl.slice(i + 1).find((t) => t.kind === "ph");
        elision =
          next && next.kind === "ph"
            ? !separatorBelongsToNext(separators[next.id])
            : true;
      }
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
 * Escape a template's literal text, but let any dash in it match any other.
 *
 * A template prints the dash the Guide prints — rule 3.5 separates a Māori Land
 * Court case name from its block with an en dash — and a keyboard offers a
 * hyphen. Demanding the exact character meant "Faulkner v Hoete - Motiti North C
 * No 1 …" did not match the rule's own template at all, so the type was not even
 * offered in the picker. The dash a student types is not evidence about which
 * rule they meant.
 */
function escapeLiteral(input: string): string {
  return escapeRegExp(input).replace(/[-–—]/g, "[-–—]");
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
      pattern += escapeLiteral(t.text);
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
    pattern += escapeLiteral(mandatoryPrefix);
    const unit = `${escapeLiteral(sep)}${capture}${escapeLiteral(trailer)}`;
    pattern += required ? unit : `(?:${unit})?`;
  }
  pattern += "$";

  try {
    // Case-insensitive. Every literal in a template is a fixed word the Guide
    // supplies — " at ", " reported in ", "(ed)", "NZPD" — and a case list copied
    // out of a judgment database arrives in capitals, so a case-sensitive " at "
    // meant the whole template failed to match and every field it would have
    // placed was lost. Whether a reference can be read at all must not turn on
    // how the source it was copied from chose to shout.
    return { regex: new RegExp(pattern, "i"), ids };
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

/**
 * Was this pasted out of something that shouts?
 *
 * Case lists and judgment databases render party names in full capitals, and
 * nothing in the text says so except the absence of a single lowercase letter.
 *
 * But plenty of correct citation is capitals already: "[1984] 1 NZLR 394" has no
 * lowercase in it either, and there is nothing there to warn anybody about. What
 * distinguishes a shouted paste is capitalised WORDS — so at least two runs of
 * three letters, one of them five or longer, which no law report abbreviation
 * reaches on its own.
 */
export function pasteIsAllCaps(raw: string): boolean {
  if (/\p{Ll}/u.test(raw)) return false;
  const runs = raw.match(/\p{Lu}{3,}/gu) ?? [];
  return runs.length >= 2 && runs.some((run) => run.length >= 5);
}

/**
 * How much of the front of a paste is NOT part of the reference.
 *
 * A reference is almost never copied on its own. It comes out of a footnote with
 * its marker still attached, out of a sentence with the signal that introduced
 * it, or off a reading list under a heading:
 *
 *   12 Taylor v New Zealand Poultry Board [1984] 1 NZLR 394 (CA) at 398.
 *   See Taylor v New Zealand Poultry Board [1984] 1 NZLR 394 (CA) at 398.
 *   Week 4: Z v Dental Complaints Assessment Committee [2008] NZSC 55
 *
 * Every one of those ended up INSIDE the case name, so the citation named a party
 * that does not exist — "12 Taylor v New Zealand Poultry Board" — and read as
 * though it were correct.
 *
 * A bare leading number is the only ambiguous case, because a citation can begin
 * with one: "16 US 610 (1818)" is a volume, not a footnote marker. It is stripped
 * only when the word after it is Titlecase, which a report series abbreviation
 * never is. Everything else here — a number with punctuation, a superscript, an
 * introductory signal, a reading-list heading — cannot begin a citation at all.
 */
export function referencePrefixLength(raw: string): number {
  const patterns: RegExp[] = [
    // A footnote marker: superscript digits, or digits closed by punctuation.
    /^\s*[¹²³⁰-₟]+\s*/,
    /^\s*\d{1,3}\s*[.):\]]\s+/,
    /^\s*\[\d{1,3}\]\s+/,
    // A bare footnote number. Ambiguous — a citation can begin with one, and
    // "16 US 610 (1818)" is a volume — so it goes only before something that
    // cannot be a report series: a Titlecase word, an opening quotation mark, or
    // a single-letter party ("12 R v Smith"). "US 610" matches none of those.
    /^\s*\d{1,3}\s+(?=\p{Lu}\p{Ll}|[“"‘']|\p{Lu}\s+v\s)/u,
    // An introductory signal (chapter 2). "Seebeck v X" is safe: \b stops it.
    /^\s*(?:see also|see|cf|compare|but see|but cf|contrast|accord|e\.?g\.?|note)\b[\s,:]+/i,
    // A reading-list or seminar heading.
    /^\s*(?:week|topic|reading|seminar|lecture|tutorial|case|module|unit)\s*\d*\s*[:.—–-]\s+/i,
  ];
  let cut = 0;
  // Repeat, because a footnote marker and a signal can both be present:
  // "12 See also Taylor v …".
  for (let pass = 0; pass < 4; pass++) {
    const rest = raw.slice(cut);
    const match = patterns.map((p) => rest.match(p)).find((m) => m && m[0].length > 0);
    if (!match) break;
    cut += match[0].length;
  }
  // Never eat the whole paste: if nothing recognisable is left, this was not a
  // prefix at all.
  return raw.slice(cut).replace(/[^\p{L}\p{N}]/gu, "").length >= 6 ? cut : 0;
}

/**
 * How much of the END of a paste is not part of the reference.
 *
 * A retrieval date is an APA and Bluebook habit that students carry over, and it
 * also comes attached when a reference is copied out of a database's "cite this"
 * box: "… at [70] (accessed 4 May 2025)". Not one of the Guide's 216 worked
 * examples contains one, so under this style guide it is never part of a
 * citation — checked, not assumed.
 *
 * It did more damage than an unwanted phrase: the trailing bracket changed the
 * shape the detector keys on, so the case above was read as a REPORTED case,
 * which then refused to build for want of a report series. A student pasting a
 * perfectly good neutral citation got nothing at all.
 *
 * Keyed on the retrieval words alone, so the many parentheses a citation
 * legitimately ends with — "(CA)", "(explanatory note)", "(online ed)",
 * "(forthcoming)", "(Report of the Appellate body)" — are untouched.
 */
export function referenceSuffixLength(raw: string): number {
  const match = raw.match(
    /\s*[([]\s*(?:last\s+)?(?:accessed|retrieved|visited|viewed|downloaded)\b[^)\]]*[)\]]\s*\.?\s*$/i,
  ) ?? raw.match(/\s*[,;]?\s*retrieved\s+from\b.*$/i);
  if (!match) return 0;
  const rest = raw.slice(0, raw.length - match[0].length);
  return rest.replace(/[^\p{L}\p{N}]/gu, "").length >= 6 ? match[0].length : 0;
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
  // A footnote marker, an introductory signal or a reading-list heading is not
  // part of the reference. Dropping it here, once, keeps every later pass —
  // detection, extraction, the audit — looking at the reference itself.
  const prefix = referencePrefixLength(raw);
  const end = raw.length - referenceSuffixLength(raw);
  for (let i = 0; i < prefix; i++) fromRaw[i] = 0;
  for (let i = prefix; i < end; i++) {
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
  // Rule 3.2 requires the "v" between parties to be lowercase (it is italicised
  // with the rest of the case name), and a paste out of a judgment database
  // capitalises it along with everything else. One character, same length, so
  // the offset map above still holds.
  //
  // The party names themselves are deliberately left exactly as pasted. The same
  // rule says to give them "exactly as on the first page of the report", and an
  // all-capitals paste does not say what that is: "ANZ" and "Anz" are the same
  // string in capitals, and guessing would produce a wrong citation that looks
  // right. The interface asks the reader to check them instead.
  const text = pasteIsAllCaps(raw) ? out.replace(/(\s)V(\s)/g, "$1v$2") : out;
  return { text: normalizeQuotes(text), fromRaw };
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
  // Not -1: the shape penalty below can take a genuine match's score negative,
  // and a sentinel that a real score can fall under drops the type out of
  // detection altogether rather than merely ranking it low.
  let bestScore = -Infinity;
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
    // Two forms of the same rule can both round-trip and fill the same number of
    // boxes while disagreeing about which box holds what. Rule 6.5's hardcopy
    // form reads "(5th ed, 2012, online ed)" as edition/reissue/year — putting
    // "online ed" in the year — and its online form reads it as
    // edition/year/online ed, correctly; both rebuild the string exactly, so
    // field count alone picked whichever came first. A value that contradicts
    // the shape its component is defined to have settles it.
    // How much of this form's own FIXED TEXT the source turned out to contain.
    // A form that matched seventy characters of its own wording has explained the
    // reference; one that matched a comma has not. Rule 9.3.1's Charter form is
    // "{shortTitle}, pt 1 of the Constitution Act 1982, being sch B to the Canada
    // Act 1982 (UK)" — a near-total literal match — while its ordinary form reads
    // the same string by cutting it at arbitrary spaces and scores higher on field
    // count alone, which is how the Charter ended up with a volume and a chapter.
    const literalWeight =
      form.replace(/\*|\{[^}]+\}/g, "").replace(/\s/g, "").length / 4;
    // A form whose optional slots all collapse can become an identity function:
    // "{caseName} {neutralCitation}" with the citation optional matches ANY input
    // by putting the whole of it in the case name, and then "round-trips"
    // perfectly. It has explained nothing, and it displaced the form that reads
    // rule 8.5's report citation properly — losing the court identifier from
    // Glenday v Johnston. Reproducing a reference by copying it is not evidence.
    const explains =
      !Object.values(values).some(
        (value) => value.replace(/\s/g, "").length >= 0.85 * stripped.replace(/\s/g, "").length,
      );
    const score =
      (roundTrips && explains ? 1000 : 0) +
      Object.keys(values).length +
      (roundTrips && explains ? literalWeight : 0) -
      10 * fieldShapeViolations(type, values);
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
  /**
   * A section heading in a bibliography — "Cases", "Legislation", "Books and
   * chapters". Copied out of Word these carry no punctuation, so the line below
   * simply joined them and the citation came out "Cases Attorney-General v X
   * [2007] NZCA 388." with the heading inside the case name.
   *
   * A heading carries NO citation signal at all — no number, no " v ", no bracket
   * or quotation mark — and is short. That is what separates it from a line a PDF
   * wrapped mid-citation: "Taylor v New Zealand Poultry" has its " v ", and
   * "Stephen Todd (ed) The Law of Torts in New" has its bracket.
   */
  const isHeading = (line: string): boolean =>
    line.length > 0 &&
    !/\d/.test(line) &&
    !/\sv\s/i.test(line) &&
    !/[“"(\[]/.test(line) &&
    line.split(/\s+/).length <= 4;
  // A line that closes one: a full stop, allowing a closing quote or bracket.
  const closesCitation = /[.!?][”"')\]]?$/;

  const rawLines = raw.replace(/\r\n?/g, "\n").split("\n");
  const hadMarker = (index: number): boolean =>
    /^\s*(?:\d{1,3}[.)]|\[\d{1,3}\]|[-•*‣—–])\s+/.test(rawLines[index] ?? "");
  // Two or more marked lines mean the paste IS a list, and in a list every line
  // that opens a citation is its own reference — including the ones whose marker
  // the student forgot. Without this, an unmarked last line was joined to the
  // entry above it and then dropped, so a reading list quietly lost a source.
  const isList = rawLines.filter((_, index) => hadMarker(index)).length >= 2;

  for (const [index, line] of lines.entries()) {
    if (!line) {
      flush();
      continue;
    }
    const previous = current.length ? current[current.length - 1] : "";
    // A stripped list marker starts a new reference ON ITS OWN. It used to be
    // gated behind the previous line having finished a sentence, which made the
    // clause unreachable — and a reading list does not punctuate its entries. So
    // a whole list collapsed into one reference and the citation mixed facts from
    // different authorities: one case's name with another's neutral citation.
    // Where there is no marker, the sentence-end test still applies, which is
    // what keeps a citation wrapped across lines by a PDF in one piece.
    const startsNew =
      current.length > 0 &&
      opensCitation.test(line) &&
      (hadMarker(index) || isList || closesCitation.test(previous) || isHeading(previous));
    if (startsNew) flush();
    current.push(line);
  }
  flush();

  // Anything too short to be a reference is a stray fragment, not a citation —
  // and so is anything with no number in it at all. Every citation the Guide
  // defines carries a year, a volume, a section or a paragraph, so a run of words
  // with no digit is a heading off a reading list ("Duty of care"), not a source.
  return blocks
    .flatMap(splitAuthoritiesInOneFootnote)
    .map((block) => block.slice(referencePrefixLength(block)).trim())
    .filter((block) => block.replace(/\W/g, "").length >= 8 && /\d/.test(block));
}

/**
 * Split one footnote into the authorities it cites.
 *
 * Rule 2.2.4 joins several authorities in a single footnote with semicolons and
 * an "and" before the last — which is exactly what composeFootnote writes. Being
 * unable to read one back was a strange gap: a student pasting a footnote out of
 * their own draft, or out of a judgment, got all three authorities mashed into one
 * citation.
 *
 * The semicolon is a safe boundary here in a way a comma never could be: not one
 * of the Guide's 216 worked examples contains a semicolon inside a single
 * citation, so within a paste it can only be separating them.
 */
function splitAuthoritiesInOneFootnote(block: string): string[] {
  if (!block.includes(";")) return [block];
  const parts = block
    .split(/\s*;\s*(?:and\s+)?/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length < 2) return [block];
  // Every part must look like the start of a reference. If one does not, the
  // semicolon was doing something else and the footnote is left whole.
  const opensCitation = /^(?:[“"(\[]|\p{Lu}|\d)/u;
  return parts.every((part) => opensCitation.test(part) && part.replace(/\W/g, "").length >= 8)
    ? parts
    : [block];
}

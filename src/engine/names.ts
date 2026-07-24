/**
 * Deterministic author/title boundary parser — pure JavaScript, so it runs on
 * every browser (no WebGPU, no model, no download). This closes the one gap a
 * static rule engine otherwise leaves: in an unformatted, un-quoted reference
 * like "Andrew Butler and Petra Butler The New Zealand Bill of Rights Act",
 * telling where the author list ends and the title begins.
 *
 * The grammar is: name (connector name)* — a person name is a short run of
 * capitalised words / initials / lowercase nobiliary particles ("van", "de"),
 * and names are joined by "and", "&" or a comma. The parser consumes that run
 * from the front of the text; whatever follows is the title. A completed name
 * only extends into another name when a connector says so, which is what lets
 * "…Petra Butler The New Zealand…" break correctly after the second surname.
 *
 * Personal names vary without limit, so this is a heuristic, not a proof — it
 * targets the common shapes (one or more "Given Surname" authors) and is honest
 * about the rest. It never fabricates: no name-shaped head, no split.
 */

const CONNECTORS = new Set(["and", "&"]);
// Lowercase particles that sit inside a surname.
const PARTICLES = new Set([
  "van", "von", "der", "den", "de", "del", "di", "da", "du", "la", "le",
  "el", "al", "bin", "ibn", "ter", "ten", "op", "af",
]);

/** Drop a trailing list separator so "Smith," still reads as a name token. */
const stripSep = (t: string): string => t.replace(/[,;]+$/, "");

const isCapWord = (t: string): boolean =>
  /^[A-ZĀĒĪŌŪ][A-Za-zĀĒĪŌŪāēīōū'’-]*[A-Za-zĀĒĪŌŪāēīōū’)]?$/.test(t) && /[a-zāēīōū]/.test(t);
const isInitial = (t: string): boolean => /^[A-Z]\.?$/.test(t) || /^[A-Z]{2,3}$/.test(t);
const isParticle = (t: string): boolean => PARTICLES.has(t.toLowerCase());

// Words that begin a title, not a person's given name. "A" is excluded — it is
// a valid initial ("A B Carter") — but "the/an/on/of…" never start a name.
const TITLE_LEAD = new Set([
  "the", "an", "on", "of", "in", "at", "to", "for", "from", "with", "by",
  "how", "why", "what", "when", "towards", "beyond", "after", "against",
]);

/**
 * Consume one person name from tokens[start]. Returns the exclusive end index,
 * or start if no name is present. A name is initials/particles plus a small
 * number of capitalised words. The capitalised-word budget is what stops the
 * parse from swallowing a title that begins with a capitalised word: two words
 * for a plain "Given Surname", but only one once an initial has appeared (so
 * "R P Boast" ends at the surname rather than eating the next word).
 */
function consumeName(tokens: string[], start: number): number {
  let i = start;
  let capWords = 0;
  let sawInitial = false;
  while (i < tokens.length) {
    const tok = stripSep(tokens[i]);
    if (isInitial(tok)) {
      sawInitial = true;
      i++;
      continue;
    }
    if (isParticle(tok)) {
      i++;
      continue;
    }
    const limit = sawInitial ? 1 : 2;
    if (isCapWord(tok) && capWords < limit) {
      capWords++;
      i++;
      continue;
    }
    break;
  }
  // A real name needs at least one capitalised word (initials alone are not a
  // recognised author head here).
  return capWords >= 1 ? i : start;
}

export type AuthorSplit = { author: string; rest: string };

/**
 * Split a reference head into an author list and the remaining text (the
 * title). Returns null when the text does not begin with a name.
 */
export function splitAuthor(text: string): AuthorSplit | null {
  const raw = text.trim();
  if (!raw) return null;
  const tokens = raw.split(/\s+/);

  // A title-leading word up front means there is no author to split off.
  if (TITLE_LEAD.has(stripSep(tokens[0]).toLowerCase())) return null;

  let end = consumeName(tokens, 0);
  if (end === 0) return null;

  // Extend across a connector-joined author list.
  while (end < tokens.length) {
    let cursor = end;
    let connector = false;
    // A trailing comma on the last consumed token, or a standalone connector.
    const prev = tokens[end - 1];
    if (/,$/.test(prev)) connector = true;
    if (CONNECTORS.has(tokens[cursor]?.toLowerCase())) {
      connector = true;
      cursor++;
    }
    if (!connector) break;
    const nextEnd = consumeName(tokens, cursor);
    if (nextEnd === cursor) break; // connector not followed by a name
    end = nextEnd;
  }

  // Require at least two author tokens (a "Given Surname" shape, or an initial
  // plus surname). A single leading capitalised word — "Ministry" of "Ministry
  // of Education…", "Comparative" of a title — is not a confident author head,
  // so we decline rather than mis-split.
  if (end < 2) return null;

  const author = tokens.slice(0, end).join(" ").replace(/,$/, "").trim();
  const rest = tokens.slice(end).join(" ").trim();
  if (!author) return null;
  return { author, rest };
}

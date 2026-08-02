/**
 * Read a paste that arrived in FULL CAPITALS.
 *
 * A case list copied out of a judgment database, or a judgment's own header,
 * comes in capitals: "TAYLOR V NEW ZEALAND POULTRY BOARD [1984] 1 NZLR 394
 * (CA)". This was the single largest defect in the whole paste layer — 26 of 34
 * robustness failures, 19 of them a WRONG TYPE.
 *
 * ------------------------------------------------------------------------
 * WHY CAPITALS BREAK THE TYPE, NOT JUST THE LOOK
 * ------------------------------------------------------------------------
 * Almost every shape anchor in scan.ts tells an abbreviation from a word by its
 * case. A report series is "[A-Z][A-Za-z]*" repeated — Title Case — so in a
 * shouted paste "NEW ZEALAND POULTRY BOARD" reads as a series just as well as
 * "NZLR" does, and a case name reads as a court. The distinctions the anchors
 * are built on all collapse at once.
 *
 * ------------------------------------------------------------------------
 * WHAT THIS DOES, AND WHAT IT DELIBERATELY DOES NOT
 * ------------------------------------------------------------------------
 * It restores case for DETECTION ONLY. Rule 3.2 wants the parties' names
 * exactly as printed on the first page of the report, and a paste in capitals
 * cannot say what that is — "ANZ" may be an initialism or a name. So the
 * citation that gets built still carries the reader's capitals, and the
 * interface still asks them to fix the names by hand. Only the ranking sees
 * this, and ranking is a question about SHAPE, which is exactly what the
 * capitals destroyed.
 *
 * The vocabulary is the Guide's own. Every token the Guide writes with unusual
 * casing — all capitals like NZLR and ICJ, or an inner capital like LexisNexis
 * — is harvested from its 216 worked examples and its templates, so nothing
 * here is a list somebody invented. A token the Guide does not write unusually
 * is ordinary language and takes ordinary headline case.
 */
import { guideTypes } from "../data/styleGuide";
import { pasteIsAllCaps } from "./render";
import { toHeadlineCase } from "./foreignFormat";

/**
 * Shouted form → the casing the Guide itself prints, for every token the Guide
 * writes unusually. Built once from the Guide's data.
 */
const GUIDE_CASING = (() => {
  const canonical = new Map<string, string>();
  const harvest = (text: string) => {
    for (const match of text.matchAll(/\b[A-Za-z][A-Za-z0-9&'’]{0,11}\b/g)) {
      const word = match[0];
      // Unusual = all capitals ("NZLR"), or a capital after the first letter
      // ("LexisNexis", "McDonald"). Ordinary words are left to headline case.
      const unusual = /^[A-Z][A-Z0-9&]+$/.test(word) || /[A-Z]/.test(word.slice(1));
      if (unusual) canonical.set(word.toUpperCase(), word);
    }
  };
  for (const type of guideTypes) {
    harvest(type.outputTemplate);
    for (const example of type.examples ?? []) harvest(example.correct_citation);
  }
  return canonical;
})();

/**
 * The Guide's division markers, which it always prints lowercase.
 *
 * The same set scan.ts keys a legislation pinpoint on, plus "c" for a chapter
 * and the publication words. Headline case would capitalise them — and "RSC
 * 1985 C A-12, S 15" is not the citation rule 9.3.1 prints.
 *
 * "at" and "no" are deliberately NOT here. Both open a form of their own — rule
 * 2.3's "At 535." and rule 4.2.1's "Arms Amendment Bill (No 3) 2005" — and
 * headline case already lowercases them mid-sentence, which is the whole of
 * what is wanted.
 */
const ALWAYS_LOWER = new Set([
  "s", "ss", "sch", "pt", "art", "arts", "reg", "regs", "r", "rr",
  "cl", "cls", "ch", "c", "ed", "eds", "vol", "n",
]);

/** Is this paste shouted? Re-exported so callers need only this module. */
export { pasteIsAllCaps };

/**
 * Give a shouted paste back the casing the Guide would print, for ranking.
 *
 * Returns the input untouched when it is not shouted, so an ordinary paste
 * never passes through any of this.
 */
export function restoreCaseForDetection(text: string): string {
  if (!pasteIsAllCaps(text)) return text;
  return toHeadlineCase(text.toLowerCase()).replace(
    /\b[A-Za-z][A-Za-z0-9&'’]{0,11}\b/g,
    (word) => {
      const guide = GUIDE_CASING.get(word.toUpperCase());
      if (guide) return guide;
      if (ALWAYS_LOWER.has(word.toLowerCase())) return word.toLowerCase();
      return word;
    },
  );
}

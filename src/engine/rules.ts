/**
 * Conditional rules of the Style Guide: components that must be left out when
 * another component is present.
 *
 * The Guide does not simply list the parts of a citation — it says when each
 * part belongs. Rule 3.2 is explicit that a reported case carries a court
 * identifier "when there is NO neutral citation", and that it is omitted when
 * one is present "(court is evident from it)". Every one of those conditions is
 * recorded in the ingested data, in the `includedWhen` and `omittedWhen` notes
 * on each component — and none of them was ever applied.
 *
 * That is not a cosmetic gap. A student reading a judgment has the neutral
 * citation and the court in front of them, fills in both boxes because both are
 * true, and the tool produces
 *
 *   Z v Dental Complaints Assessment Committee [2008] NZSC 55, [2009] 1 NZLR 1 (SC) at [26].
 *
 * which is wrong under 3.2 — the "(SC)" must not be there. Nothing in the
 * interface told them, because nothing in the engine knew.
 *
 * The conditions in the data are prose, so they are restated here as checkable
 * rules. Each records the paragraph it comes from, and each explains itself to
 * the user rather than silently discarding something they typed.
 */
import type { GuideType } from "../data/styleGuide.ts";

export type GuideRule = {
  typeId: string;
  /** The component left out when the condition holds. */
  omit: string;
  /**
   * The condition: these components carrying values that genuinely look like a
   * neutral citation. A shape is required, not merely a non-empty box —
   * positional extraction fills these with case-name words when it mis-splits,
   * and acting on that deleted the court from perfectly good citations.
   */
  whenAllMatch: { field: string; shape: RegExp }[];
  /** The Style Guide paragraph this comes from. */
  rule: string;
  /** Shown to the user, so the omission is explained rather than silent. */
  why: string;
};

export const GUIDE_RULES: GuideRule[] = [
  {
    typeId: "reported-case-nz",
    omit: "courtIdentifier",
    whenAllMatch: [{ field: "neutralCitation", shape: /\[\d{4}\]\s+[A-Za-z]{2,}\s*\w*\s*\d/ }],
    rule: "3.2",
    why: "The court identifier is omitted when a neutral citation is given — the neutral citation already shows the court.",
  },
  {
    typeId: "england-wales-case-modern",
    omit: "court",
    whenAllMatch: [
      { field: "neutralYear", shape: /^\[?\d{4}\]?$/ },
      { field: "neutralCourt", shape: /^[A-Z]{2,}[A-Za-z]*$/ },
      { field: "number", shape: /\d/ },
    ],
    rule: "8.4.1",
    why: "The court is included only where there is no neutral citation.",
  },
  {
    typeId: "australia-case",
    omit: "jurisdictionCourt",
    whenAllMatch: [
      { field: "neutralYear", shape: /^\[?\d{4}\]?$/ },
      { field: "neutralCourt", shape: /^[A-Z]{2,}[A-Za-z]*$/ },
      { field: "number", shape: /\d/ },
    ],
    rule: "8.2",
    why: "The jurisdiction and court are omitted where a neutral citation makes the court evident.",
  },
  {
    // "However, for the fifth edition onwards of Halsbury's Laws of England it
    // is unnecessary to provide any reissue information due to the way the
    // publication is organised." — rule 6.5, read off the published Guide. The
    // ingested data records it as omittedWhen "unnecessary for Halsbury 5th ed
    // onwards" and nothing acted on it, so a 5th-edition citation carried a
    // reissue the extractor had filled with the year, printing it twice:
    // "Halsbury's Laws of England (5th ed, 2012, 2012)".
    typeId: "legal-encyclopaedia",
    omit: "reissue",
    whenAllMatch: [
      { field: "title", shape: /Halsbury/i },
      { field: "edition", shape: /^(?:[5-9]|[1-9]\d+)(?:st|nd|rd|th)\s+ed$/i },
    ],
    rule: "6.5",
    why: "From the fifth edition of Halsbury’s Laws of England onwards the Guide says no reissue information is needed, because of the way the publication is organised.",
  },
];

export type AppliedRule = { field: string; rule: string; why: string };

const has = (fields: Record<string, string>, id: string): boolean =>
  typeof fields[id] === "string" && fields[id].trim() !== "";

/**
 * Drop the components the Guide says do not belong alongside what is already
 * there, and report each omission so the interface can say why.
 */
export function applyGuideRules(
  type: GuideType,
  fields: Record<string, string>,
): { fields: Record<string, string>; applied: AppliedRule[] } {
  const result = { ...fields };
  const applied: AppliedRule[] = [];
  for (const rule of GUIDE_RULES) {
    if (rule.typeId !== type.id) continue;
    if (!has(result, rule.omit)) continue;
    const triggered = rule.whenAllMatch.every(({ field, shape }) => {
      const value = (result[field] ?? "").trim();
      return value !== "" && shape.test(value);
    });
    if (!triggered) continue;
    delete result[rule.omit];
    applied.push({ field: rule.omit, rule: rule.rule, why: rule.why });
  }
  return { fields: result, applied };
}

/**
 * Typed access to the ingested New Zealand Law Style Guide data set. The JSON is
 * produced by scripts/ingest-style-guide.mjs from the verbatim extraction and is
 * the single source of truth for the engine: every source type, its components,
 * its rules, and the Guide's own worked examples (which serve as the accuracy
 * oracle for the renderer).
 */
import raw from "./styleGuide.json";

export type GuideComponent = {
  id: string;
  label: string;
  required: boolean;
  italic: boolean;
  order: number;
  /** The literal or described separator that precedes this component. */
  separatorBefore: string;
  includedWhen: string;
  omittedWhen: string;
  formatting: string;
  notes: string;
};

export type GuideExample = {
  correct_citation: string;
  location: string;
};

export type GuideGroup =
  | "Cases"
  | "Legislation"
  | "Parliamentary & official"
  | "Secondary sources"
  | "International & foreign"
  | "Subsequent references";

export type GuideType = {
  id: string;
  name: string;
  group: GuideGroup;
  rule: string;
  ruleUrl: string;
  /** Template with {placeholders}; *asterisks* mark italic runs. */
  outputTemplate: string;
  components: GuideComponent[];
  bracketRules: string;
  validation: string;
  pinpoint: string;
  subsequentForm: string;
  parseStructure: string;
  examples: GuideExample[];
  uncertainty: string;
};

export type StyleGuideData = {
  meta: {
    source: string;
    sourceUrl: string;
    ingestedAt: string;
    typeCount: number;
    exampleCount: number;
  };
  types: GuideType[];
  globalRules: Record<string, string>;
};

export const styleGuide = raw as StyleGuideData;

export const guideTypes: GuideType[] = styleGuide.types;

export const guideTypeById: Record<string, GuideType> = Object.fromEntries(
  guideTypes.map((type) => [type.id, type]),
);

export const guideGroupOrder: GuideGroup[] = [
  "Cases",
  "Legislation",
  "Parliamentary & official",
  "Secondary sources",
  "International & foreign",
  "Subsequent references",
];

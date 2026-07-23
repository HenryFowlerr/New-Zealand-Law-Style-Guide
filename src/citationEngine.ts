export type CitationTypeId =
  | "journal"
  | "book"
  | "chapter"
  | "looseleaf"
  | "report"
  | "newspaper"
  | "internet"
  | "thesis"
  | "conference"
  | "act"
  | "bill"
  | "case-reported"
  | "case-neutral"
  | "case-unreported"
  | "hansard"
  | "press-release"
  | "subsequent";

export type CitationData = Record<string, string | boolean | undefined>;

export type FieldOption = {
  label: string;
  value: string;
};

export type FieldDefinition = {
  id: string;
  label: string;
  type?: "text" | "select" | "checkbox";
  required?: boolean;
  placeholder?: string;
  help?: string;
  options?: FieldOption[];
  when?: (data: CitationData) => boolean;
};

export type SourceTypeDefinition = {
  id: CitationTypeId;
  name: string;
  shortName: string;
  description: string;
  group:
    | "Secondary sources"
    | "Cases & legislation"
    | "Parliamentary & official"
    | "Citation history";
  rule: string;
  ruleUrl: string;
  fields: FieldDefinition[];
};

export type CitationIssue = {
  level: "error" | "note";
  message: string;
  field?: string;
};

export type CitationToken = {
  text: string;
  italic?: boolean;
};

export type CitationResult = {
  status: "ready" | "incomplete";
  type: CitationTypeId;
  tokens: CitationToken[];
  text: string;
  html: string;
  issues: CitationIssue[];
  rule: string;
  ruleUrl: string;
};

export type CitationSuggestion = {
  type: CitationTypeId;
  confidence: "high" | "possible";
  reason: string;
};

const GUIDE_ROOT = "https://lawfoundation.org.nz/style-guide2019";

const yearRoleOptions: FieldOption[] = [
  {
    value: "independent-volume",
    label: "The journal/report has an independent volume number",
  },
  {
    value: "year-is-volume",
    label: "The year is the volume number",
  },
];

const caseYearOptions: FieldOption[] = [
  {
    value: "essential",
    label: "Square brackets — the year is essential to locate the report",
  },
  {
    value: "descriptive",
    label: "Round brackets — the volume identifies the report",
  },
];

const pinpointField: FieldDefinition = {
  id: "pinpoint",
  label: "Pinpoint",
  placeholder: "165, [26], or 511, n 46",
  help: "Enter only the page, paragraph, or note reference. “at” is added for you.",
};

export const sourceTypes: SourceTypeDefinition[] = [
  {
    id: "journal",
    name: "Journal article",
    shortName: "Journal",
    description:
      "Articles in law reviews, journals, or serial publications such as NZLJ or LawTalk.",
    group: "Secondary sources",
    rule: "6.4",
    ruleUrl: `${GUIDE_ROOT}/chapter-pt.6.4.html#6.4`,
    fields: [
      {
        id: "author",
        label: "Author",
        required: true,
        placeholder: "Peter Watts",
        help: "Use the name exactly as it appears in the article.",
      },
      {
        id: "title",
        label: "Article title",
        required: true,
        placeholder: "Birks’ Unjust Enrichment",
        help: "Do not add quotation marks; they are added automatically.",
      },
      {
        id: "year",
        label: "Year",
        required: true,
        placeholder: "2005",
      },
      {
        id: "yearRole",
        label: "How does this journal organise volumes?",
        type: "select",
        required: true,
        options: yearRoleOptions,
        help: "This determines whether the year uses round or square brackets.",
      },
      {
        id: "volume",
        label: "Volume or issue number",
        placeholder: "121 or 733",
        help: "Required when the journal has independent volume or issue numbers.",
        when: (data) => data.yearRole === "independent-volume",
      },
      {
        id: "pagesRestart",
        label: "Page numbers restart in each issue",
        type: "checkbox",
        help: "Only select this when each issue begins again at page 1.",
        when: (data) => data.yearRole === "independent-volume",
      },
      {
        id: "issue",
        label: "Issue number",
        placeholder: "2",
        when: (data) => data.pagesRestart === true,
      },
      {
        id: "journal",
        label: "Official journal abbreviation",
        required: true,
        placeholder: "LQR",
        help: "Full stops used only as abbreviation marks are removed.",
      },
      {
        id: "startPage",
        label: "Article’s first page",
        required: true,
        placeholder: "163",
      },
      pinpointField,
    ],
  },
  {
    id: "book",
    name: "Book or legal text",
    shortName: "Book",
    description: "A whole authored or edited book, including a multi-volume text.",
    group: "Secondary sources",
    rule: "6.1",
    ruleUrl: `${GUIDE_ROOT}/chapter-6.html#6.1`,
    fields: [
      {
        id: "author",
        label: "Author or editor",
        required: true,
        placeholder: "Ross Carter",
        help: "For an editor, include “(ed)” or “(eds)” after the name.",
      },
      {
        id: "title",
        label: "Book title",
        required: true,
        placeholder: "Burrows and Carter Statute Law in New Zealand",
      },
      {
        id: "edition",
        label: "Edition",
        placeholder: "5th",
        help: "Leave blank for a first edition.",
      },
      {
        id: "publisher",
        label: "Publisher",
        required: true,
        placeholder: "LexisNexis",
      },
      {
        id: "place",
        label: "Place of publication",
        required: true,
        placeholder: "Wellington",
      },
      {
        id: "year",
        label: "Year of publication",
        required: true,
        placeholder: "2015",
      },
      {
        id: "volume",
        label: "Volume",
        placeholder: "2",
      },
      pinpointField,
    ],
  },
  {
    id: "chapter",
    name: "Chapter in an edited book",
    shortName: "Book chapter",
    description: "An essay or chapter with its own author inside an edited collection.",
    group: "Secondary sources",
    rule: "6.2",
    ruleUrl: `${GUIDE_ROOT}/chapter-pt.6.2.html#6.2`,
    fields: [
      {
        id: "author",
        label: "Chapter author",
        required: true,
        placeholder: "Robin Cooke",
      },
      {
        id: "title",
        label: "Chapter title",
        required: true,
        placeholder: "Tort and Contract",
      },
      {
        id: "editor",
        label: "Book editor",
        required: true,
        placeholder: "PD Finn",
        help: "Do not add “(ed)”; it is added automatically.",
      },
      {
        id: "bookTitle",
        label: "Book title",
        required: true,
        placeholder: "Essays on Contract",
      },
      {
        id: "edition",
        label: "Edition",
        placeholder: "2nd",
      },
      {
        id: "publisher",
        label: "Publisher",
        required: true,
        placeholder: "Law Book Company",
      },
      {
        id: "place",
        label: "Place of publication",
        required: true,
        placeholder: "Sydney",
      },
      {
        id: "year",
        label: "Year of publication",
        required: true,
        placeholder: "1987",
      },
      {
        id: "startPage",
        label: "Chapter’s first page",
        required: true,
        placeholder: "222",
      },
      pinpointField,
    ],
  },
  {
    id: "looseleaf",
    name: "Online commentary or looseleaf",
    shortName: "Commentary",
    description: "An updating service or online legal commentary.",
    group: "Secondary sources",
    rule: "6.3",
    ruleUrl: `${GUIDE_ROOT}/chapter-pt.6.3.html#6.3`,
    fields: [
      {
        id: "author",
        label: "Editor or author",
        placeholder: "Simon France (ed)",
        help: "May be omitted only when the publication does not identify one.",
      },
      {
        id: "title",
        label: "Service title",
        required: true,
        placeholder: "Adams on Criminal Law – Evidence",
      },
      {
        id: "editionType",
        label: "Edition type",
        type: "select",
        required: true,
        options: [
          { value: "looseleaf", label: "Looseleaf edition" },
          { value: "online", label: "Online edition" },
        ],
      },
      {
        id: "publisher",
        label: "Publisher",
        required: true,
        placeholder: "Thomson Reuters",
      },
      {
        id: "accessDetail",
        label: "Update or access detail",
        placeholder: "accessed 31 May 2018",
        help: "Usually unnecessary. Include only when it matters.",
      },
      pinpointField,
    ],
  },
  {
    id: "report",
    name: "Paper or report",
    shortName: "Report",
    description:
      "Government, institutional, business, consultation, annual, or research reports.",
    group: "Secondary sources",
    rule: "5.4",
    ruleUrl: `${GUIDE_ROOT}/chapter-pt.5.4.html#5.4`,
    fields: [
      {
        id: "author",
        label: "Author or institution",
        placeholder: "Labour Market Policy Group",
        help: "Leave blank only when the author is already part of the title.",
      },
      {
        id: "title",
        label: "Report title",
        required: true,
        placeholder: "Cover for Mental Injury Arising from Witnessing a Traumatic Incident",
      },
      {
        id: "publisher",
        label: "Publisher",
        placeholder: "Ministry of Economic Development",
        help: "Omit when it is the same as the author.",
      },
      {
        id: "officialCitation",
        label: "Official report number or citation",
        placeholder: "00/001872",
      },
      {
        id: "date",
        label: "Date",
        required: true,
        placeholder: "24 March 2000",
        help: "Use as much specificity as the report provides.",
      },
      pinpointField,
    ],
  },
  {
    id: "act",
    name: "Act or legislative instrument",
    shortName: "Legislation",
    description:
      "An Act, regulation, rule, or order, with an optional section, clause, or other pinpoint.",
    group: "Cases & legislation",
    rule: "4.1.1",
    ruleUrl: `${GUIDE_ROOT}/chapter-4.html#4.1.1`,
    fields: [
      {
        id: "title",
        label: "Short title",
        required: true,
        placeholder: "Evidence Act",
        help: "Include the type word, for example Act, Regulations, Rules, or Order.",
      },
      {
        id: "year",
        label: "Year enacted",
        required: true,
        placeholder: "2006",
      },
      {
        id: "jurisdiction",
        label: "Jurisdiction identifier",
        placeholder: "UK",
        help: "Leave blank for New Zealand legislation.",
      },
      {
        id: "referenceType",
        label: "Reference type",
        type: "select",
        options: [
          { value: "", label: "No pinpoint" },
          { value: "s", label: "Section (s)" },
          { value: "ss", label: "Sections (ss)" },
          { value: "sch", label: "Schedule (sch)" },
          { value: "pt", label: "Part (pt)" },
          { value: "cl", label: "Clause (cl)" },
          { value: "reg", label: "Regulation (reg)" },
          { value: "r", label: "Rule (r)" },
          { value: "art", label: "Article (art)" },
          { value: "long title", label: "Long title" },
        ],
      },
      {
        id: "reference",
        label: "Reference",
        placeholder: "43 or 3 cl 4",
        when: (data) =>
          typeof data.referenceType === "string" &&
          data.referenceType !== "" &&
          data.referenceType !== "long title",
      },
    ],
  },
  {
    id: "case-reported",
    name: "Reported New Zealand case",
    shortName: "Reported case",
    description: "A case published in an authorised or other report series.",
    group: "Cases & legislation",
    rule: "3.2",
    ruleUrl: `${GUIDE_ROOT}/chapter-pt.3.2.html#3.2`,
    fields: [
      {
        id: "caseName",
        label: "Case name",
        required: true,
        placeholder: "Z v Dental Complaints Assessment Committee",
      },
      {
        id: "neutralCitation",
        label: "Neutral citation",
        placeholder: "[2008] NZSC 55",
        help: "Include when one exists, followed by the reported citation.",
      },
      {
        id: "reportYear",
        label: "Report year",
        required: true,
        placeholder: "2009",
      },
      {
        id: "yearRole",
        label: "How is the report located?",
        type: "select",
        required: true,
        options: caseYearOptions,
      },
      {
        id: "volume",
        label: "Volume",
        placeholder: "1",
      },
      {
        id: "reportSeries",
        label: "Report series",
        required: true,
        placeholder: "NZLR",
      },
      {
        id: "startPage",
        label: "Starting page or case number",
        required: true,
        placeholder: "1",
      },
      {
        id: "court",
        label: "Court identifier",
        placeholder: "CA",
        help: "Often unnecessary when a neutral citation or report series identifies the court.",
      },
      pinpointField,
    ],
  },
  {
    id: "case-neutral",
    name: "Neutral-citation-only New Zealand case",
    shortName: "Neutral case",
    description: "A decision with a neutral citation but no reported citation.",
    group: "Cases & legislation",
    rule: "3.3",
    ruleUrl: `${GUIDE_ROOT}/chapter-pt.3.3.html#3.3`,
    fields: [
      {
        id: "caseName",
        label: "Case name",
        required: true,
        placeholder: "Attorney-General v X",
      },
      {
        id: "year",
        label: "Year",
        required: true,
        placeholder: "2007",
      },
      {
        id: "court",
        label: "Court identifier",
        required: true,
        placeholder: "NZCA",
      },
      {
        id: "judgmentNumber",
        label: "Judgment number",
        required: true,
        placeholder: "388",
      },
      pinpointField,
    ],
  },
  {
    id: "case-unreported",
    name: "Unreported New Zealand case",
    shortName: "Unreported case",
    description: "A decision without a report citation or neutral citation.",
    group: "Cases & legislation",
    rule: "3.4",
    ruleUrl: `${GUIDE_ROOT}/chapter-pt.3.4.html#3.4`,
    fields: [
      {
        id: "caseName",
        label: "Case name",
        required: true,
        placeholder: "R v Tuhou",
      },
      {
        id: "court",
        label: "Court abbreviation",
        required: true,
        placeholder: "HC",
      },
      {
        id: "registry",
        label: "Registry",
        placeholder: "Napier",
        help: "Required for courts with more than one registry.",
      },
      {
        id: "fileNumber",
        label: "File number",
        required: true,
        placeholder: "CRI-2007-020-2820",
      },
      {
        id: "date",
        label: "Date of judgment",
        required: true,
        placeholder: "11 September 2008",
      },
      pinpointField,
    ],
  },
  {
    id: "newspaper",
    name: "Newspaper or news article",
    shortName: "News article",
    description: "An article in a newspaper or news publication.",
    group: "Secondary sources",
    rule: "6",
    ruleUrl: `${GUIDE_ROOT}/chapter-6.html`,
    fields: [
      {
        id: "author",
        label: "Author",
        placeholder: "Anne Smith",
        help: "Leave blank when the article names no author.",
      },
      {
        id: "title",
        label: "Article title",
        required: true,
        placeholder: "New Court Rules Announced",
      },
      {
        id: "newspaper",
        label: "Newspaper",
        required: true,
        placeholder: "The New Zealand Herald",
      },
      {
        id: "place",
        label: "Place of publication",
        required: true,
        placeholder: "Auckland",
      },
      {
        id: "date",
        label: "Date",
        required: true,
        placeholder: "24 September 2009",
      },
      pinpointField,
    ],
  },
  {
    id: "internet",
    name: "Internet material",
    shortName: "Web page",
    description:
      "A document or page that exists only online, cited by author, title, date, and URL.",
    group: "Secondary sources",
    rule: "6",
    ruleUrl: `${GUIDE_ROOT}/chapter-6.html`,
    fields: [
      {
        id: "author",
        label: "Author or organisation",
        placeholder: "Ministry of Justice",
        help: "Leave blank only when the page identifies no author or body.",
      },
      {
        id: "title",
        label: "Page or document title",
        required: true,
        placeholder: "Annual Report 2018",
      },
      {
        id: "date",
        label: "Date or access note",
        placeholder: "2018 or accessed 5 May 2018",
        help: "Use the document’s date, or the date accessed if it has none.",
      },
      {
        id: "url",
        label: "URL",
        required: true,
        placeholder: "www.justice.govt.nz",
        help: "Enter the address only; the angle brackets are added for you.",
      },
    ],
  },
  {
    id: "thesis",
    name: "Dissertation or thesis",
    shortName: "Thesis",
    description: "An unpublished dissertation or thesis submitted for a degree.",
    group: "Secondary sources",
    rule: "6",
    ruleUrl: `${GUIDE_ROOT}/chapter-6.html`,
    fields: [
      {
        id: "author",
        label: "Author",
        required: true,
        placeholder: "Jane Doe",
      },
      {
        id: "title",
        label: "Title",
        required: true,
        placeholder: "The Rule Against Perpetuities",
      },
      {
        id: "qualification",
        label: "Qualification",
        required: true,
        placeholder: "LLM Thesis",
        help: "For example LLB (Hons) Dissertation, LLM Thesis, or PhD Thesis.",
      },
      {
        id: "institution",
        label: "Institution",
        required: true,
        placeholder: "Victoria University of Wellington",
      },
      {
        id: "year",
        label: "Year",
        required: true,
        placeholder: "2016",
      },
      pinpointField,
    ],
  },
  {
    id: "conference",
    name: "Conference or seminar paper",
    shortName: "Conference paper",
    description: "A paper presented at a conference, seminar, or similar event.",
    group: "Secondary sources",
    rule: "6",
    ruleUrl: `${GUIDE_ROOT}/chapter-6.html`,
    fields: [
      {
        id: "author",
        label: "Author",
        required: true,
        placeholder: "John Smith",
      },
      {
        id: "title",
        label: "Paper title",
        required: true,
        placeholder: "Reforming the Law of Trusts",
      },
      {
        id: "conference",
        label: "Conference or event",
        required: true,
        placeholder: "New Zealand Law Conference",
      },
      {
        id: "place",
        label: "Place",
        placeholder: "Auckland",
      },
      {
        id: "date",
        label: "Date",
        required: true,
        placeholder: "October 2018",
      },
      pinpointField,
    ],
  },
  {
    id: "bill",
    name: "Bill",
    shortName: "Bill",
    description: "A Bill before Parliament, with an optional clause pinpoint.",
    group: "Cases & legislation",
    rule: "4.2",
    ruleUrl: `${GUIDE_ROOT}/chapter-4.html#4.2`,
    fields: [
      {
        id: "title",
        label: "Short title",
        required: true,
        placeholder: "Evidence Bill",
        help: "Include the word “Bill”.",
      },
      {
        id: "year",
        label: "Year",
        required: true,
        placeholder: "2005",
      },
      {
        id: "billNumber",
        label: "Bill number",
        required: true,
        placeholder: "256-1",
      },
      {
        id: "clause",
        label: "Clause pinpoint",
        placeholder: "5",
        help: "Enter only the number; “cl” is added for you.",
      },
    ],
  },
  {
    id: "hansard",
    name: "Parliamentary debate (Hansard)",
    shortName: "Hansard",
    description: "A speech or debate reported in the New Zealand Parliamentary Debates.",
    group: "Parliamentary & official",
    rule: "5",
    ruleUrl: `${GUIDE_ROOT}/chapter-5.html`,
    fields: [
      {
        id: "date",
        label: "Date of debate",
        required: true,
        placeholder: "21 September 2010",
      },
      {
        id: "volume",
        label: "NZPD volume",
        required: true,
        placeholder: "666",
      },
      {
        id: "page",
        label: "Page",
        required: true,
        placeholder: "14104",
      },
      {
        id: "speaker",
        label: "Speaker",
        placeholder: "Hon Simon Power",
        help: "Optional. Added in parentheses after the page.",
      },
    ],
  },
  {
    id: "press-release",
    name: "Press or media release",
    shortName: "Press release",
    description: "A press release, media statement, or similar announcement.",
    group: "Parliamentary & official",
    rule: "5",
    ruleUrl: `${GUIDE_ROOT}/chapter-5.html`,
    fields: [
      {
        id: "author",
        label: "Author or body",
        required: true,
        placeholder: "New Zealand Law Society",
      },
      {
        id: "title",
        label: "Title",
        required: true,
        placeholder: "Access to Justice",
      },
      {
        id: "date",
        label: "Date",
        required: true,
        placeholder: "5 May 2018",
      },
    ],
  },
  {
    id: "subsequent",
    name: "Later reference to an earlier source",
    shortName: "Later reference",
    description: "General-style later references, including “above n” and obvious-context pinpoints.",
    group: "Citation history",
    rule: "2.3.1",
    ruleUrl: `${GUIDE_ROOT}/chapter-pt.2.3.html#2.3.1`,
    fields: [
      {
        id: "sourceCategory",
        label: "Earlier source type",
        type: "select",
        required: true,
        options: [
          { value: "case", label: "Case" },
          { value: "text", label: "Book, chapter, article, or report" },
          { value: "legislation", label: "Legislation" },
        ],
      },
      {
        id: "context",
        label: "Is the earlier source obvious from the sentence?",
        type: "select",
        required: true,
        options: [
          { value: "obvious", label: "Yes — the reader cannot mistake the source" },
          { value: "not-obvious", label: "No — identify the source" },
        ],
      },
      {
        id: "label",
        label: "Case tag, author surname, or Act short title",
        placeholder: "Todd",
        when: (data) => data.context === "not-obvious",
      },
      {
        id: "earlierFootnote",
        label: "First citation’s footnote number",
        placeholder: "8",
        when: (data) =>
          data.context === "not-obvious" && data.sourceCategory !== "legislation",
      },
      {
        id: "referenceType",
        label: "Legislative reference type",
        type: "select",
        when: (data) => data.sourceCategory === "legislation",
        options: [
          { value: "s", label: "Section" },
          { value: "ss", label: "Sections" },
          { value: "cl", label: "Clause" },
          { value: "reg", label: "Regulation" },
          { value: "r", label: "Rule" },
          { value: "art", label: "Article" },
        ],
      },
      {
        id: "pinpoint",
        label: "Pinpoint or provision",
        required: true,
        placeholder: "50, [52], or 63",
      },
    ],
  },
];

export const sourceTypeMap = Object.fromEntries(
  sourceTypes.map((sourceType) => [sourceType.id, sourceType]),
) as Record<CitationTypeId, SourceTypeDefinition>;

/**
 * One correct, worked example per format. These are the same field sets the
 * test suite pins, so "fill an example" always produces a Style-Guide-correct
 * citation students can learn from or use to sanity-check the tool.
 */
export const sourceExamples: Record<CitationTypeId, CitationData> = {
  journal: {
    author: "Peter Watts",
    title: "Birks’ Unjust Enrichment",
    year: "2005",
    yearRole: "independent-volume",
    volume: "121",
    journal: "LQR",
    startPage: "163",
    pinpoint: "165",
  },
  book: {
    author: "Ross Carter",
    title: "Burrows and Carter Statute Law in New Zealand",
    edition: "5th",
    publisher: "LexisNexis",
    place: "Wellington",
    year: "2015",
    pinpoint: "311",
  },
  chapter: {
    author: "Robin Cooke",
    title: "Tort and Contract",
    editor: "PD Finn",
    bookTitle: "Essays on Contract",
    edition: "2nd",
    publisher: "Law Book Company",
    place: "Sydney",
    year: "1987",
    startPage: "222",
    pinpoint: "229",
  },
  looseleaf: {
    author: "Billie Little and others",
    title: "Personal Injury in New Zealand",
    editionType: "online",
    publisher: "Thomson Reuters",
    pinpoint: "[AC21.02]",
  },
  report: {
    author: "Labour Market Policy Group",
    title: "Cover for Mental Injury",
    officialCitation: "00/001872",
    date: "24 March 2000",
  },
  newspaper: {
    author: "Anne Smith",
    title: "New Court Rules Announced",
    newspaper: "The New Zealand Herald",
    place: "Auckland",
    date: "24 September 2009",
    pinpoint: "3",
  },
  internet: {
    author: "Ministry of Justice",
    title: "Annual Report 2018",
    date: "2018",
    url: "www.justice.govt.nz",
  },
  thesis: {
    author: "Jane Doe",
    title: "The Rule Against Perpetuities",
    qualification: "LLM Thesis",
    institution: "Victoria University of Wellington",
    year: "2016",
    pinpoint: "40",
  },
  conference: {
    author: "John Smith",
    title: "Reforming the Law of Trusts",
    conference: "New Zealand Law Conference",
    place: "Auckland",
    date: "October 2018",
  },
  act: {
    title: "Evidence Act",
    year: "2006",
    referenceType: "s",
    reference: "43",
  },
  bill: {
    title: "Evidence Bill",
    year: "2005",
    billNumber: "256-1",
    clause: "5",
  },
  "case-reported": {
    caseName: "Z v Dental Complaints Assessment Committee",
    neutralCitation: "[2008] NZSC 55",
    reportYear: "2009",
    yearRole: "essential",
    volume: "1",
    reportSeries: "NZLR",
    startPage: "1",
    pinpoint: "[26]",
  },
  "case-neutral": {
    caseName: "Attorney-General v X",
    year: "2007",
    court: "NZCA",
    judgmentNumber: "388",
    pinpoint: "[70]",
  },
  "case-unreported": {
    caseName: "R v Tuhou",
    court: "HC",
    registry: "Napier",
    fileNumber: "CRI-2007-020-2820",
    date: "11 September 2008",
    pinpoint: "[13]",
  },
  hansard: {
    date: "21 September 2010",
    volume: "666",
    page: "14104",
    speaker: "Hon Simon Power",
  },
  "press-release": {
    author: "New Zealand Law Society",
    title: "Access to Justice",
    date: "5 May 2018",
  },
  subsequent: {
    sourceCategory: "text",
    context: "not-obvious",
    label: "Todd",
    earlierFootnote: "8",
    pinpoint: "50",
  },
};

export function getVisibleFields(
  definition: SourceTypeDefinition,
  data: CitationData,
): FieldDefinition[] {
  return definition.fields.filter((field) => !field.when || field.when(data));
}

/**
 * Required fields that are currently visible but still empty. This drives the
 * "still needed" prompt: the interface asks the user for each missing part
 * before a citation is generated.
 */
export function missingRequiredFields(
  type: CitationTypeId,
  data: CitationData,
): FieldDefinition[] {
  const definition = sourceTypeMap[type];
  return getVisibleFields(definition, data).filter(
    (field) => field.required === true && !value(data, field.id),
  );
}

/**
 * Visible non-checkbox fields that already carry a value. Used to report how
 * many details were read from a pasted reference.
 */
export function extractedFields(
  type: CitationTypeId,
  data: CitationData,
): FieldDefinition[] {
  const definition = sourceTypeMap[type];
  return getVisibleFields(definition, data).filter(
    (field) => field.type !== "checkbox" && Boolean(value(data, field.id)),
  );
}

function value(data: CitationData, key: string): string {
  const raw = data[key];
  return typeof raw === "string" ? raw.trim().replace(/\s+/g, " ") : "";
}

function escapeHtml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normaliseCreator(input: string): string {
  return input
    .replace(/\bet\s+al\.?/gi, "and others")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.,;:]+$/, "");
}

function normaliseTitle(input: string): string {
  return input
    .trim()
    .replace(/^["“”]+|["“”]+$/g, "")
    .replace(/\s+/g, " ")
    .replace(/[.]+$/, "");
}

function normaliseAbbreviation(input: string): string {
  return input.replaceAll(".", "").replace(/\s+/g, " ").trim();
}

function isFirstEdition(input: string): boolean {
  const cleaned = input.trim().replace(/\s+ed\.?$/i, "");
  return /^(1st|1|first)$/i.test(cleaned);
}

function normaliseEdition(input: string): string {
  const cleaned = input.trim().replace(/\s+ed\.?$/i, "");
  if (!cleaned || isFirstEdition(cleaned)) return "";
  return `${cleaned} ed`;
}

function normalisePinpoint(input: string): string {
  return input
    .trim()
    .replace(/^,?\s*at\s+/i, "")
    .replace(/[.]+$/, "");
}

function text(input: string): CitationToken {
  return { text: input };
}

function italic(input: string): CitationToken {
  return { text: input, italic: true };
}

function tokensToText(tokens: CitationToken[]): string {
  return tokens.map((token) => token.text).join("");
}

function tokensToHtml(tokens: CitationToken[]): string {
  return tokens
    .map((token) => {
      const safe = escapeHtml(token.text);
      return token.italic ? `<em>${safe}</em>` : safe;
    })
    .join("");
}

function detailList(values: string[]): string {
  return values.filter(Boolean).join(", ");
}

function withFinalPeriod(tokens: CitationToken[]): CitationToken[] {
  if (tokens.length === 0) return tokens;
  const result = tokens.map((token) => ({ ...token }));
  const last = result[result.length - 1];
  last.text = `${last.text.replace(/[.]+$/, "")}.`;
  return result;
}

function bookDetails(data: CitationData): string {
  return detailList([
    normaliseEdition(value(data, "edition")),
    value(data, "publisher"),
    value(data, "place"),
    value(data, "year"),
  ]);
}

function renderJournal(data: CitationData): CitationToken[] {
  const year = value(data, "year");
  const yearPart =
    data.yearRole === "year-is-volume" ? `[${year}]` : `(${year})`;
  const volumeBase = value(data, "volume");
  const volume =
    data.pagesRestart === true && value(data, "issue")
      ? `${volumeBase}(${value(data, "issue")})`
      : volumeBase;
  const pinpoint = normalisePinpoint(value(data, "pinpoint"));
  const citation = [
    normaliseCreator(value(data, "author")),
    `“${normaliseTitle(value(data, "title"))}”`,
    yearPart,
    volume,
    normaliseAbbreviation(value(data, "journal")),
    value(data, "startPage"),
  ]
    .filter(Boolean)
    .join(" ");
  return withFinalPeriod([text(`${citation}${pinpoint ? ` at ${pinpoint}` : ""}`)]);
}

function renderBook(data: CitationData): CitationToken[] {
  const creator = normaliseCreator(value(data, "author"));
  const details = bookDetails(data);
  const volume = value(data, "volume");
  const pinpoint = normalisePinpoint(value(data, "pinpoint"));
  const tokens: CitationToken[] = [
    text(`${creator} `),
    italic(normaliseTitle(value(data, "title"))),
    text(` (${details})`),
  ];
  if (volume) tokens.push(text(` vol ${volume}`));
  if (pinpoint) tokens.push(text(` at ${pinpoint}`));
  return withFinalPeriod(tokens);
}

function renderChapter(data: CitationData): CitationToken[] {
  const details = detailList([
    normaliseEdition(value(data, "edition")),
    value(data, "publisher"),
    value(data, "place"),
    value(data, "year"),
  ]);
  const pinpoint = normalisePinpoint(value(data, "pinpoint"));
  const editor = value(data, "editor").replace(/\s+\(eds?\)$/i, "");
  const tokens: CitationToken[] = [
    text(
      `${normaliseCreator(value(data, "author"))} “${normaliseTitle(value(data, "title"))}” in ${editor} (ed) `,
    ),
    italic(normaliseTitle(value(data, "bookTitle"))),
    text(` (${details}) ${value(data, "startPage")}`),
  ];
  if (pinpoint) tokens.push(text(` at ${pinpoint}`));
  return withFinalPeriod(tokens);
}

function renderLooseleaf(data: CitationData): CitationToken[] {
  const creator = normaliseCreator(value(data, "author"));
  const edition =
    data.editionType === "looseleaf" ? "looseleaf ed" : "online ed";
  const details = detailList([
    edition,
    value(data, "publisher"),
    value(data, "accessDetail"),
  ]);
  const pinpoint = normalisePinpoint(value(data, "pinpoint"));
  const tokens: CitationToken[] = [];
  if (creator) tokens.push(text(`${creator} `));
  tokens.push(italic(normaliseTitle(value(data, "title"))));
  tokens.push(text(` (${details})`));
  if (pinpoint) tokens.push(text(` at ${pinpoint}`));
  return withFinalPeriod(tokens);
}

function renderReport(data: CitationData): CitationToken[] {
  const creator = normaliseCreator(value(data, "author"));
  const details = detailList([
    value(data, "publisher"),
    value(data, "officialCitation"),
    value(data, "date"),
  ]);
  const pinpoint = normalisePinpoint(value(data, "pinpoint"));
  const tokens: CitationToken[] = [];
  if (creator) tokens.push(text(`${creator} `));
  tokens.push(italic(normaliseTitle(value(data, "title"))));
  tokens.push(text(` (${details})`));
  if (pinpoint) tokens.push(text(` at ${pinpoint}`));
  return withFinalPeriod(tokens);
}

function renderAct(data: CitationData): CitationToken[] {
  const jurisdiction = value(data, "jurisdiction");
  const jurisdictionPart =
    jurisdiction && !/^(nz|new zealand)$/i.test(jurisdiction)
      ? ` (${jurisdiction})`
      : "";
  const referenceType = value(data, "referenceType");
  const reference = value(data, "reference");
  const pinpoint =
    referenceType === "long title"
      ? ", long title"
      : referenceType && reference
        ? `, ${referenceType} ${reference}`
        : "";
  return withFinalPeriod([
    text(
      `${normaliseTitle(value(data, "title"))} ${value(data, "year")}${jurisdictionPart}${pinpoint}`,
    ),
  ]);
}

function renderReportedCase(data: CitationData): CitationToken[] {
  const neutral = value(data, "neutralCitation").replace(/[.]+$/, "");
  const year = value(data, "reportYear");
  const reportYear =
    data.yearRole === "essential" ? `[${year}]` : `(${year})`;
  const report = [
    reportYear,
    value(data, "volume"),
    normaliseAbbreviation(value(data, "reportSeries")),
    value(data, "startPage"),
  ]
    .filter(Boolean)
    .join(" ");
  const court = normaliseAbbreviation(value(data, "court"));
  const pinpoint = normalisePinpoint(value(data, "pinpoint"));
  const tokens: CitationToken[] = [
    italic(normaliseTitle(value(data, "caseName"))),
    text(` ${neutral ? `${neutral}, ` : ""}${report}`),
  ];
  if (court) tokens.push(text(` (${court})`));
  if (pinpoint) tokens.push(text(` at ${pinpoint}`));
  return withFinalPeriod(tokens);
}

function renderNeutralCase(data: CitationData): CitationToken[] {
  const pinpoint = normalisePinpoint(value(data, "pinpoint"));
  const tokens: CitationToken[] = [
    italic(normaliseTitle(value(data, "caseName"))),
    text(
      ` [${value(data, "year")}] ${normaliseAbbreviation(value(data, "court"))} ${value(data, "judgmentNumber")}`,
    ),
  ];
  if (pinpoint) tokens.push(text(` at ${pinpoint}`));
  return withFinalPeriod(tokens);
}

function renderUnreportedCase(data: CitationData): CitationToken[] {
  const pinpoint = normalisePinpoint(value(data, "pinpoint"));
  const identity = [
    normaliseAbbreviation(value(data, "court")),
    value(data, "registry"),
    value(data, "fileNumber"),
  ]
    .filter(Boolean)
    .join(" ");
  const tokens: CitationToken[] = [
    italic(normaliseTitle(value(data, "caseName"))),
    text(` ${identity}, ${value(data, "date")}`),
  ];
  if (pinpoint) tokens.push(text(` at ${pinpoint}`));
  return withFinalPeriod(tokens);
}

function renderNewspaper(data: CitationData): CitationToken[] {
  const author = normaliseCreator(value(data, "author"));
  const pinpoint = normalisePinpoint(value(data, "pinpoint"));
  const details = detailList([value(data, "place"), value(data, "date")]);
  const tokens: CitationToken[] = [];
  if (author) tokens.push(text(`${author} `));
  tokens.push(text(`“${normaliseTitle(value(data, "title"))}” `));
  tokens.push(italic(normaliseTitle(value(data, "newspaper"))));
  tokens.push(text(` (${details})`));
  if (pinpoint) tokens.push(text(` at ${pinpoint}`));
  return withFinalPeriod(tokens);
}

function renderInternet(data: CitationData): CitationToken[] {
  const author = normaliseCreator(value(data, "author"));
  const date = value(data, "date");
  const url = value(data, "url").replace(/^<+|>+$/g, "");
  const tokens: CitationToken[] = [];
  if (author) tokens.push(text(`${author} `));
  tokens.push(text(`“${normaliseTitle(value(data, "title"))}”`));
  if (date) tokens.push(text(` (${date})`));
  tokens.push(text(` <${url}>`));
  return withFinalPeriod(tokens);
}

function renderThesis(data: CitationData): CitationToken[] {
  const details = detailList([
    value(data, "qualification"),
    value(data, "institution"),
    value(data, "year"),
  ]);
  const pinpoint = normalisePinpoint(value(data, "pinpoint"));
  const tokens: CitationToken[] = [
    text(
      `${normaliseCreator(value(data, "author"))} “${normaliseTitle(value(data, "title"))}” (${details})`,
    ),
  ];
  if (pinpoint) tokens.push(text(` at ${pinpoint}`));
  return withFinalPeriod(tokens);
}

function renderConference(data: CitationData): CitationToken[] {
  const inner = detailList([
    value(data, "conference"),
    value(data, "place"),
    value(data, "date"),
  ]);
  const pinpoint = normalisePinpoint(value(data, "pinpoint"));
  const tokens: CitationToken[] = [
    text(
      `${normaliseCreator(value(data, "author"))} “${normaliseTitle(value(data, "title"))}” (paper presented at ${inner})`,
    ),
  ];
  if (pinpoint) tokens.push(text(` at ${pinpoint}`));
  return withFinalPeriod(tokens);
}

function renderBill(data: CitationData): CitationToken[] {
  const clause = normalisePinpoint(value(data, "clause"));
  const base = `${normaliseTitle(value(data, "title"))} ${value(data, "year")} (${value(data, "billNumber")})`;
  return withFinalPeriod([text(`${base}${clause ? `, cl ${clause}` : ""}`)]);
}

function renderHansard(data: CitationData): CitationToken[] {
  const speaker = value(data, "speaker");
  const base = `(${value(data, "date")}) ${value(data, "volume")} NZPD ${value(data, "page")}`;
  return withFinalPeriod([text(`${base}${speaker ? ` (${speaker})` : ""}`)]);
}

function renderPressRelease(data: CitationData): CitationToken[] {
  return withFinalPeriod([
    text(
      `${normaliseCreator(value(data, "author"))} “${normaliseTitle(value(data, "title"))}” (press release, ${value(data, "date")})`,
    ),
  ]);
}

const fullReferenceWords: Record<string, string> = {
  s: "Section",
  ss: "Sections",
  cl: "Clause",
  reg: "Regulation",
  r: "Rule",
  art: "Article",
};

function renderSubsequent(data: CitationData): CitationToken[] {
  const category = value(data, "sourceCategory");
  const context = value(data, "context");
  const pinpoint = normalisePinpoint(value(data, "pinpoint"));
  const label = normaliseTitle(value(data, "label"));

  if (category === "legislation") {
    const referenceType = value(data, "referenceType");
    if (context === "obvious") {
      return withFinalPeriod([
        text(`${fullReferenceWords[referenceType] ?? "Provision"} ${pinpoint}`),
      ]);
    }
    return withFinalPeriod([text(`${label}, ${referenceType} ${pinpoint}`)]);
  }

  if (context === "obvious") {
    return withFinalPeriod([text(`At ${pinpoint}`)]);
  }

  const footnote = value(data, "earlierFootnote");
  const prefix = category === "case" ? italic(label) : text(label);
  return withFinalPeriod([
    prefix,
    text(`, above n ${footnote}${pinpoint ? `, at ${pinpoint}` : ""}`),
  ]);
}

function render(type: CitationTypeId, data: CitationData): CitationToken[] {
  switch (type) {
    case "journal":
      return renderJournal(data);
    case "book":
      return renderBook(data);
    case "chapter":
      return renderChapter(data);
    case "looseleaf":
      return renderLooseleaf(data);
    case "report":
      return renderReport(data);
    case "act":
      return renderAct(data);
    case "case-reported":
      return renderReportedCase(data);
    case "case-neutral":
      return renderNeutralCase(data);
    case "case-unreported":
      return renderUnreportedCase(data);
    case "newspaper":
      return renderNewspaper(data);
    case "internet":
      return renderInternet(data);
    case "thesis":
      return renderThesis(data);
    case "conference":
      return renderConference(data);
    case "bill":
      return renderBill(data);
    case "hansard":
      return renderHansard(data);
    case "press-release":
      return renderPressRelease(data);
    case "subsequent":
      return renderSubsequent(data);
  }
}

function validate(type: CitationTypeId, data: CitationData): CitationIssue[] {
  const definition = sourceTypeMap[type];
  const issues: CitationIssue[] = [];
  const visibleFields = getVisibleFields(definition, data);

  for (const field of visibleFields) {
    if (field.required && !value(data, field.id)) {
      issues.push({
        level: "error",
        field: field.id,
        message: `${field.label} is required by rule ${definition.rule}.`,
      });
    }
  }

  for (const key of ["year", "reportYear"]) {
    const year = value(data, key);
    if (year && !/^\d{4}$/.test(year)) {
      issues.push({
        level: "error",
        field: key,
        message: "Enter the year as four digits.",
      });
    }
  }

  if (
    type === "journal" &&
    data.yearRole === "independent-volume" &&
    !value(data, "volume")
  ) {
    issues.push({
      level: "error",
      field: "volume",
      message: "An independent volume or issue number is required.",
    });
  }

  if (type === "journal" && data.pagesRestart === true && !value(data, "issue")) {
    issues.push({
      level: "error",
      field: "issue",
      message: "Add the issue number because page numbers restart in each issue.",
    });
  }

  if (/\bet\s+al\.?/i.test(value(data, "author"))) {
    issues.push({
      level: "note",
      field: "author",
      message: "“et al” will be changed to the NZLSG form “and others”.",
    });
  }

  if ((type === "book" || type === "chapter") && isFirstEdition(value(data, "edition"))) {
    issues.push({
      level: "note",
      field: "edition",
      message: "First editions are not shown, so this edition is omitted.",
    });
  }

  if (type === "act") {
    const referenceType = value(data, "referenceType");
    const reference = value(data, "reference");
    if (
      referenceType &&
      referenceType !== "long title" &&
      !reference
    ) {
      issues.push({
        level: "error",
        field: "reference",
        message: "Add the section, clause, schedule, or other reference.",
      });
    }
    if (/^(nz|new zealand)$/i.test(value(data, "jurisdiction"))) {
      issues.push({
        level: "note",
        field: "jurisdiction",
        message: "The New Zealand identifier is omitted under rule 4.1.1(c).",
      });
    }
  }

  if (type === "case-reported") {
    const neutral = value(data, "neutralCitation");
    if (neutral && !/^\[\d{4}\]\s+[A-Z][A-Z0-9]*\s+\d+[A-Za-z]?$/.test(neutral)) {
      issues.push({
        level: "error",
        field: "neutralCitation",
        message: "Use the neutral citation form “[year] court judgment-number”.",
      });
    }
    if (data.yearRole === "descriptive" && !value(data, "volume")) {
      issues.push({
        level: "error",
        field: "volume",
        message: "A volume number is needed when the report year uses round brackets.",
      });
    }
  }

  if (type === "subsequent") {
    const category = value(data, "sourceCategory");
    const context = value(data, "context");
    if (/\bibid\b/i.test(value(data, "label"))) {
      issues.push({
        level: "error",
        field: "label",
        message: "General NZLSG style uses a pinpoint or “above n”, not “ibid”.",
      });
    }
    if (context === "not-obvious" && !value(data, "label")) {
      issues.push({
        level: "error",
        field: "label",
        message: "Identify the earlier source because it is not obvious from context.",
      });
    }
    if (
      context === "not-obvious" &&
      category !== "legislation" &&
      !/^\d+$/.test(value(data, "earlierFootnote"))
    ) {
      issues.push({
        level: "error",
        field: "earlierFootnote",
        message: "Enter the number of the footnote containing the first full citation.",
      });
    }
    if (category === "legislation" && !value(data, "referenceType")) {
      issues.push({
        level: "error",
        field: "referenceType",
        message: "Choose the kind of legislative provision.",
      });
    }
  }

  return issues;
}

export function buildCitation(
  type: CitationTypeId,
  data: CitationData,
): CitationResult {
  const definition = sourceTypeMap[type];
  const issues = validate(type, data);
  const hasError = issues.some((issue) => issue.level === "error");
  const tokens = hasError ? [] : render(type, data);

  return {
    status: hasError ? "incomplete" : "ready",
    type,
    tokens,
    text: hasError ? "" : tokensToText(tokens),
    html: hasError ? "" : tokensToHtml(tokens),
    issues,
    rule: definition.rule,
    ruleUrl: definition.ruleUrl,
  };
}

function stripPeriod(tokens: CitationToken[]): CitationToken[] {
  if (tokens.length === 0) return tokens;
  const result = tokens.map((token) => ({ ...token }));
  result[result.length - 1].text = result[result.length - 1].text.replace(
    /[.]+$/,
    "",
  );
  return result;
}

export function composeFootnote(results: CitationResult[]): {
  text: string;
  html: string;
  tokens: CitationToken[];
} {
  const ready = results.filter((result) => result.status === "ready");
  if (ready.length === 0) return { text: "", html: "", tokens: [] };

  const tokens: CitationToken[] = [];
  ready.forEach((result, index) => {
    if (index > 0) {
      tokens.push(text(index === ready.length - 1 ? "; and " : "; "));
    }
    tokens.push(...stripPeriod(result.tokens));
  });

  const completed = withFinalPeriod(tokens);
  return {
    text: tokensToText(completed),
    html: tokensToHtml(completed),
    tokens: completed,
  };
}

export function analyseCitation(input: string): CitationSuggestion[] {
  const raw = input.trim().replace(/\s+/g, " ");
  if (!raw) return [];

  const suggestions: CitationSuggestion[] = [];
  const add = (
    type: CitationTypeId,
    confidence: CitationSuggestion["confidence"],
    reason: string,
  ) => {
    if (!suggestions.some((suggestion) => suggestion.type === type)) {
      suggestions.push({ type, confidence, reason });
    }
  };

  if (/\babove n\s+\d+/i.test(raw)) {
    add("subsequent", "high", "It contains an “above n” cross-reference.");
  }
  if (/\(press release,/i.test(raw)) {
    add("press-release", "high", "It is marked as a press release.");
  }
  if (/\bNZPD\b/.test(raw)) {
    add("hansard", "high", "It cites the New Zealand Parliamentary Debates (NZPD).");
  }
  if (/\bpaper presented (?:at|to)\b/i.test(raw)) {
    add("conference", "high", "It describes a paper presented at an event.");
  }
  if (/\(\s*(?:LL[BM]|BA|MA|PhD|BCL|JD)[^)]*(?:thesis|dissertation)/i.test(raw)) {
    add("thesis", "high", "It identifies a dissertation or thesis and its degree.");
  }
  if (/<\s*(?:https?:\/\/|www\.)[^>]+>/i.test(raw)) {
    add("internet", "high", "It contains a URL in angle brackets.");
  }
  if (/\bBill\s+\d{4}\s+\(\d/.test(raw)) {
    add("bill", "high", "It contains a Bill title, year, and bill number.");
  }
  if (/[“"].+?[”"]\s+.+?\([A-Z][A-Za-z]+,\s*\d/u.test(raw)) {
    add("newspaper", "possible", "It resembles an article in a named newspaper.");
  }
  if (/\((?:online|looseleaf)(?:\s+looseleaf)?\s+ed,/i.test(raw)) {
    add("looseleaf", "high", "It identifies an online or looseleaf edition.");
  }
  if (/\bAct\s+\d{4}\b/.test(raw)) {
    add("act", "high", "It contains an Act title followed by an enactment year.");
  }
  if (/\b(?:Regulations|Rules|Order|Notice)\s+\d{4}\b/.test(raw)) {
    add(
      "act",
      "high",
      "It contains a legislative instrument title followed by a year.",
    );
  }
  if (
    /["“].+?["”]\s+[\[(]\d{4}[\])]\s+(?:\d+(?:\(\d+\))?\s+)?[^,]+\s+\d+/u.test(
      raw,
    )
  ) {
    add("journal", "high", "It matches the author–article–year–journal pattern.");
  }
  if (/["“].+?["”]\s+in\s+.+?\(.+?\d{4}\)\s+\d+/u.test(raw)) {
    add("chapter", "high", "It contains a quoted chapter title followed by “in”.");
  }
  if (/\bv\b/.test(raw) && /\[\d{4}\]\s+NZ[A-Z]+\s+\d+/.test(raw)) {
    if (/,\s*[\[(]\d{4}[\])]\s+\d*\s*[A-Z][A-Za-z]*\s+\d+/.test(raw)) {
      add("case-reported", "high", "It contains both a neutral and reported citation.");
    } else {
      add("case-neutral", "high", "It contains a New Zealand neutral citation.");
    }
  }
  if (
    /\bv\b/.test(raw) &&
    !/\[\d{4}\]\s+NZ[A-Z]+\s+\d+/.test(raw) &&
    /[[(]\d{4}[\])]\s+\d*\s*[A-Z][A-Za-z]*\s+\d+/.test(raw)
  ) {
    add(
      "case-reported",
      "possible",
      "It resembles a case name followed by a reported citation.",
    );
  }
  if (
    /\bv\b/.test(raw) &&
    /\b(?:SC|CA|HC|DC|FC|EmpC|EnvC)\b.+,\s+\d{1,2}\s+\p{L}+\s+\d{4}/u.test(raw)
  ) {
    add("case-unreported", "possible", "It resembles a court file reference and judgment date.");
  }
  if (
    !suggestions.length &&
    /\(.+?(?:19|20)\d{2}\)/.test(raw) &&
    !/["“]/.test(raw)
  ) {
    add("book", "possible", "It resembles an authored title with publication details.");
    add("report", "possible", "It may instead be an institutional paper or report.");
  }

  return suggestions;
}

/**
 * Split a book/chapter publication parenthetical such as
 * "5th ed, LexisNexis, Wellington, 2015" into its component fields. Only the
 * confidently delimited parts are returned; anything ambiguous is left for the
 * user to supply.
 */
function parsePublicationDetails(inner: string): {
  edition?: string;
  publisher?: string;
  place?: string;
  year?: string;
} {
  const parts = inner
    .split(/,\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
  const result: {
    edition?: string;
    publisher?: string;
    place?: string;
    year?: string;
  } = {};
  if (parts.length && /^\d{4}$/.test(parts[parts.length - 1])) {
    result.year = parts.pop();
  }
  if (parts.length && /\bed$/i.test(parts[0])) {
    result.edition = parts.shift()!.replace(/\s+ed$/i, "");
  }
  if (parts.length >= 2) {
    result.publisher = parts[0];
    result.place = parts.slice(1).join(", ");
  } else if (parts.length === 1) {
    result.publisher = parts[0];
  }
  return result;
}

export function prefillCitation(
  type: CitationTypeId,
  input: string,
): CitationData {
  const raw = input.trim().replace(/\s+/g, " ").replace(/[.]+$/, "");

  if (type === "journal") {
    const match = raw.match(
      /^(.+?)\s+["“](.+?)["”]\s+([\[(])(\d{4})[\])]\s+(?:(\d+(?:\((\d+)\))?)\s+)?(.+?)\s+(\d+)(?:\s+at\s+(.+))?$/u,
    );
    if (match) {
      const volumeWithIssue = match[5] ?? "";
      const issue = match[6] ?? "";
      return {
        author: match[1],
        title: match[2],
        year: match[4],
        yearRole: match[3] === "[" ? "year-is-volume" : "independent-volume",
        volume: issue ? volumeWithIssue.replace(/\(.+\)$/, "") : volumeWithIssue,
        pagesRestart: Boolean(issue),
        issue,
        journal: match[7],
        startPage: match[8],
        pinpoint: match[9] ?? "",
      };
    }
  }

  if (type === "act") {
    const match = raw.match(
      /^(.+?\b(?:Act|Regulations|Rules|Order|Notice))\s+(\d{4})(?:\s+\(([^)]+)\))?(?:,\s*(s|ss|sch|pt|cl|reg|r|art)\s+(.+))?$/i,
    );
    if (match) {
      return {
        title: match[1],
        year: match[2],
        jurisdiction: match[3] ?? "",
        referenceType: match[4]?.toLowerCase() ?? "",
        reference: match[5] ?? "",
      };
    }
  }

  if (type === "subsequent") {
    const match = raw.match(
      /^(.+?),?\s+above n\s+(\d+),?(?:\s+at\s+(.+))?$/i,
    );
    if (match) {
      return {
        sourceCategory: "text",
        context: "not-obvious",
        label: match[1].replace(/,$/, ""),
        earlierFootnote: match[2],
        pinpoint: match[3] ?? "",
      };
    }
  }

  if (type === "case-neutral") {
    const match = raw.match(
      /^(.+?\bv\b.+?)\s+\[(\d{4})\]\s+([A-Z][A-Z0-9]*)\s+(\d+)(?:\s+at\s+(.+))?$/,
    );
    if (match) {
      return {
        caseName: match[1],
        year: match[2],
        court: match[3],
        judgmentNumber: match[4],
        pinpoint: match[5] ?? "",
      };
    }
  }

  if (type === "chapter") {
    const match = raw.match(
      /^(.+?)\s+[“"](.+?)[”"]\s+in\s+(.+?)\s+\(eds?\)\s+(.+?)\s+\(([^)]*\d{4})\)\s+(\d+[A-Za-z]?)(?:\s+at\s+(.+))?$/u,
    );
    if (match) {
      const details = parsePublicationDetails(match[5]);
      return {
        author: match[1],
        title: match[2],
        editor: match[3],
        bookTitle: match[4],
        edition: details.edition ?? "",
        publisher: details.publisher ?? "",
        place: details.place ?? "",
        year: details.year ?? "",
        startPage: match[6],
        pinpoint: match[7] ?? "",
      };
    }
  }

  if (type === "book") {
    // The author and title run together without a delimiter once italics are
    // lost, so only the reliably delimited publication details are extracted.
    const match = raw.match(
      /^.+?\s+\(([^)]*\d{4})\)(?:\s+vol\s+(\S+))?(?:\s+at\s+(.+))?$/u,
    );
    if (match) {
      const details = parsePublicationDetails(match[1]);
      if (details.year) {
        return {
          edition: details.edition ?? "",
          publisher: details.publisher ?? "",
          place: details.place ?? "",
          year: details.year,
          volume: match[2] ?? "",
          pinpoint: match[3] ?? "",
        };
      }
    }
  }

  if (type === "looseleaf") {
    const match = raw.match(
      /^.+?\s+\((looseleaf|online)\s+ed(?:,\s*(.+?))?\)(?:\s+at\s+(.+))?$/iu,
    );
    if (match) {
      const rest = (match[2] ?? "")
        .split(/,\s*/)
        .map((part) => part.trim())
        .filter(Boolean);
      return {
        editionType: match[1].toLowerCase(),
        publisher: rest[0] ?? "",
        accessDetail: rest.slice(1).join(", "),
        pinpoint: match[3] ?? "",
      };
    }
  }

  if (type === "case-reported") {
    const match = raw.match(
      /^(.+?\bv\b.+?)\s+(?:(\[\d{4}\]\s+[A-Z][A-Za-z0-9]*\s+\d+[A-Za-z]?),\s+)?([[(])(\d{4})[\])]\s+(?:(\d+)\s+)?([A-Za-z][A-Za-z '.]*?)\s+(\d+[A-Za-z]?)(?:\s+\(([^)]+)\))?(?:\s+at\s+(.+))?$/u,
    );
    if (match) {
      return {
        caseName: match[1],
        neutralCitation: match[2] ?? "",
        reportYear: match[4],
        yearRole: match[3] === "[" ? "essential" : "descriptive",
        volume: match[5] ?? "",
        reportSeries: match[6].trim(),
        startPage: match[7],
        court: match[8] ?? "",
        pinpoint: match[9] ?? "",
      };
    }
  }

  if (type === "case-unreported") {
    const match = raw.match(
      /^(.+?\bv\b.+?)\s+([A-Z][A-Za-z]*)\s+(?:([A-Z][a-z]+)\s+)?(\S*\d\S*),\s+(.+?)(?:\s+at\s+(.+))?$/u,
    );
    if (match) {
      return {
        caseName: match[1],
        court: match[2],
        registry: match[3] ?? "",
        fileNumber: match[4],
        date: match[5],
        pinpoint: match[6] ?? "",
      };
    }
  }

  if (type === "bill") {
    const match = raw.match(
      /^(.+?\bBill)\s+(\d{4})\s+\(([^)]+)\)(?:,\s*cl\s+(.+))?$/u,
    );
    if (match) {
      return {
        title: match[1],
        year: match[2],
        billNumber: match[3],
        clause: match[4] ?? "",
      };
    }
  }

  if (type === "hansard") {
    const match = raw.match(
      /^\((.+?)\)\s+(\d+)\s+NZPD\s+(\S+?)(?:\s+\(([^)]+)\))?$/u,
    );
    if (match) {
      return {
        date: match[1],
        volume: match[2],
        page: match[3],
        speaker: match[4] ?? "",
      };
    }
  }

  if (type === "press-release") {
    const match = raw.match(
      /^(.+?)\s+[“"](.+?)[”"]\s+\(press release,\s*(.+?)\)$/iu,
    );
    if (match) {
      return {
        author: match[1],
        title: match[2],
        date: match[3],
      };
    }
  }

  if (type === "newspaper") {
    const match = raw.match(
      /^(.*?)[“"](.+?)[”"]\s+(.+?)\s+\(([^,)]+),\s*([^)]+)\)(?:\s+at\s+(.+))?$/u,
    );
    if (match) {
      return {
        author: match[1].trim(),
        title: match[2],
        newspaper: match[3],
        place: match[4],
        date: match[5],
        pinpoint: match[6] ?? "",
      };
    }
  }

  if (type === "internet") {
    const match = raw.match(
      /^(.*?)[“"](.+?)[”"](?:\s+\(([^)]+)\))?\s+<(.+?)>$/u,
    );
    if (match) {
      return {
        author: match[1].trim(),
        title: match[2],
        date: match[3] ?? "",
        url: match[4],
      };
    }
  }

  if (type === "thesis") {
    const match = raw.match(
      /^(.+?)\s+[“"](.+?)[”"]\s+\(([^,]+),\s*(.+?),\s*(\d{4})\)(?:\s+at\s+(.+))?$/u,
    );
    if (match) {
      return {
        author: match[1],
        title: match[2],
        qualification: match[3],
        institution: match[4],
        year: match[5],
        pinpoint: match[6] ?? "",
      };
    }
  }

  if (type === "conference") {
    const match = raw.match(
      /^(.+?)\s+[“"](.+?)[”"]\s+\(paper presented at\s+([^)]+)\)(?:\s+at\s+(.+))?$/iu,
    );
    if (match) {
      const inner = match[3]
        .split(/,\s*/)
        .map((part) => part.trim())
        .filter(Boolean);
      const conference = inner.shift() ?? "";
      const date = inner.pop() ?? "";
      const place = inner.join(", ");
      return {
        author: match[1],
        title: match[2],
        conference,
        place,
        date,
        pinpoint: match[4] ?? "",
      };
    }
  }

  return {};
}

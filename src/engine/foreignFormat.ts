/**
 * Rewrite a reference written in SOME OTHER citation style into the Guide's
 * own shape, before anything else reads it.
 *
 * ------------------------------------------------------------------------
 * WHY A PRE-PASS RATHER THAN MORE EXTRACTION
 * ------------------------------------------------------------------------
 * The paste layer — the template extractor, the shape anchors in scan.ts, and
 * the fitted weights in build.ts — was built and measured entirely against the
 * Guide's 216 worked examples. Teaching it to also read APA would mean either
 * new anchors (which change the features detection was fitted against, and has
 * cost identifications four separate times) or refitted weights (which have
 * lost holdout before).
 *
 * So nothing downstream learns anything. A recognised foreign reference is
 * rewritten into the Guide's conventions FIRST, and detection and extraction
 * then see exactly the kind of string they were built for. That is the standing
 * "prefer a FEATURE to a refitted weight" rule applied one layer earlier: the
 * feature is the format itself.
 *
 * ------------------------------------------------------------------------
 * THE RULE THIS MODULE MUST NEVER BREAK
 * ------------------------------------------------------------------------
 * A foreign format can LOSE what the Guide requires. APA initialises given
 * names, so "Carter, R." can become "R Carter" and must never become "Ross
 * Carter" — the tool does not know the given name and guessing produces a
 * confident wrong answer, which is the one outcome this project refuses.
 * Everything here is a re-arrangement of what the paste already says.
 *
 * Every conversion is gated behind a signature that Guide-shaped text does not
 * have, and returns the input untouched when it does not fire. A student who
 * pastes a correct Guide citation must be unaffected, and the 216 worked
 * examples are the floor that proves it.
 */

/** What was recognised, for the message shown to the reader. */
export type ForeignFormat = {
  /** The text rewritten into the Guide's shape. */
  text: string;
  /** Which style was recognised, or null when nothing fired. */
  style: string | null;
  /** What the format could not carry, for the reader to complete. */
  lossy: string[];
  /**
   * The parts this reader identified, under the component ids of the type it
   * recognised — applied over the positional extraction, for the ids the
   * chosen type actually has.
   *
   * Rewriting to text and re-reading it is enough only while every part is
   * present. Where a format OMITS one, the rewritten bracket is genuinely
   * ambiguous: MLA gives "(3rd ed, Oxford University Press, 2011)" with no
   * place, the template expects four parts there, and the positional read slid
   * the publisher into the place box — producing "Oxford University Press,
   * Oxford University Press". The reader already knew which part was which, so
   * it says so rather than throwing that away and hoping.
   */
  fields?: Record<string, string>;
  /**
   * Component ids this format DOES NOT CARRY, which must therefore be left
   * empty rather than filled by re-reading the rewritten string.
   *
   * Naming them is what makes the citation fail closed. Without it the
   * positional pass slid the publisher into the place box for every MLA and
   * APA 7 reference — "Oxford University Press, Oxford University Press" — a
   * value that is wrong, looks deliberate, and no reader would query.
   */
  omitted?: string[];
};

const untouched = (text: string): ForeignFormat => ({ text, style: null, lossy: [] });

// Words the Guide leaves lowercase inside a title unless they open it. Rule
// 6.1.3 asks for the title as the title page prints it, and a title page prints
// headline case; APA converts to sentence case, so this converts back.
const MINOR_WORDS = new Set([
  "a", "an", "the", "and", "but", "or", "nor", "for", "of", "in", "on", "at",
  "to", "by", "with", "from", "as", "into", "over", "under", "per", "up",
  "off", "out", "via", "v",
]);

/**
 * Headline-case a title that arrived in sentence case.
 *
 * A word that ALREADY carries an inner capital is left exactly as it is: that
 * is how "NZ", "LexisNexis", "McDonald" and "iPredict" survive. Only an
 * all-lowercase word is touched, so nothing that was deliberately capitalised
 * can be flattened by this.
 */
export function toHeadlineCase(title: string): string {
  const words = title.split(/(\s+)/);
  let isFirst = true;
  return words
    .map((word) => {
      if (/^\s+$/.test(word)) return word;
      // Anything with a capital already in it is the source's own styling.
      if (/[A-Z]/.test(word.slice(1)) || /^[A-Z]/.test(word)) {
        const openedSentence = isFirst;
        isFirst = false;
        void openedSentence;
        return word;
      }
      const bare = word.replace(/^[“"'(\[]+/, "").replace(/[”"')\].,:;?!]+$/, "");
      const lead = word.slice(0, word.length - word.replace(/^[“"'(\[]+/, "").length);
      const tail = word.slice(lead.length + bare.length);
      // A colon ends a clause, so the word after a subtitle colon opens again.
      const opens = isFirst;
      isFirst = /[:.?!]$/.test(word);
      if (!bare) return word;
      const keepLower = MINOR_WORDS.has(bare.toLowerCase()) && !opens;
      const cased = keepLower
        ? bare.toLowerCase()
        : bare.charAt(0).toUpperCase() + bare.slice(1);
      return `${lead}${cased}${tail}`;
    })
    .join("");
}

// An APA author list: "Carter, R." / "Butler, A., & Butler, P." / four of them.
// The initials are the signature — a Guide author is "Ross Carter", never
// "Carter, R.", so this cannot match a reference already in the Guide's shape.
const APA_NAME = String.raw`[A-Z][\w'’À-ɏ-]+(?:\s+[A-Z][\w'’À-ɏ-]+)*,\s*(?:[A-Z]\.\s*)+`;
const APA_AUTHORS = new RegExp(
  `^(${APA_NAME}(?:,?\\s*(?:&|and)?\\s*${APA_NAME})*)$`,
);

/**
 * "Butler, A., & Butler, P." → "A Butler and P Butler".
 *
 * Rule 6.1.2: two or three authors are joined by "and"; four or more give the
 * first author followed by "and others". Initials are not separated by spaces,
 * so "Burrows, J. F." becomes "JF Burrows".
 */
export function apaAuthorsToGuide(list: string): string | null {
  if (!APA_AUTHORS.test(list.trim())) return null;
  const people: string[] = [];
  const re = new RegExp(APA_NAME, "g");
  for (const m of list.matchAll(re)) {
    const chunk = m[0].trim().replace(/,$/, "");
    const [surname, initialPart = ""] = chunk.split(/,\s*/);
    const initials = (initialPart.match(/[A-Z](?=\.)/g) ?? []).join("");
    people.push(initials ? `${initials} ${surname}` : surname);
  }
  if (!people.length) return null;
  if (people.length >= 4) return `${people[0]} and others`;
  return people.join(" and ");
}

/** "Wellington, New Zealand" → "Wellington". Rule 6.1.6 wants the place only. */
function placeOnly(place: string): string {
  const first = place.split(",")[0].trim();
  return first || place.trim();
}

/**
 * Strip the apparatus a reference collects on its way to the clipboard.
 *
 * A footnote number comes with a reference copied out of a footnote, and APA 7
 * ends almost everything with a DOI or a retrieval URL. Rules 6.1 and 6.4 cite
 * a book by its publication details and an article by its volume and page, and
 * give neither a web address, so the DOI is not information the citation has
 * anywhere to put. Left in place both of them simply defeated every pattern
 * below and the reference was not recognised at all.
 */
function stripApparatus(text: string): string {
  return text
    // A leading footnote or list number: "12. ", "12) ", "[12] ".
    .replace(/^\s*(?:\[\d{1,3}\]|\d{1,3}[.)])\s+(?=[A-Z])/, "")
    // A trailing DOI or URL, with or without APA's "Retrieved … from".
    .replace(
      /[\s.,]*(?:Retrieved\s+[^,]*,?\s*from\s+)?(?:https?:\/\/\S+|doi:\s*\S+)\s*$/i,
      "",
    )
    .trim();
}

/**
 * The publication tail the Guide writes inside one bracket: edition, publisher,
 * place, year (rules 6.1.4–6.1.7).
 *
 * The place is OMITTED when the format did not carry one — APA 7 and MLA both
 * dropped it — rather than filled with a guess. Rule 6.1.6 requires it, so the
 * citation then fails closed and the interface asks for it, which is the whole
 * point: an empty box the reader fills beats a plausible city they never check.
 */
function publicationTail(parts: {
  edition?: string;
  publisher?: string;
  place?: string;
  year: string;
}): string {
  return [parts.edition, parts.publisher, parts.place, parts.year]
    .map((p) => p?.trim())
    .filter(Boolean)
    .join(", ");
}

/** "Butler, A." or APA's forename-first editor "A. Butler" → "A Butler". */
function personToGuide(name: string): string {
  const inverted = apaAuthorsToGuide(name);
  if (inverted) return inverted;
  // Forename-first with initials, which is how APA writes an editor after "In".
  return name.trim().replace(/\.\s*/g, " ").replace(/\s+/g, " ").trim();
}

/** "(5th ed.)" / "3rd ed." → "3rd ed". Rule 6.1.4 uses no full stop. */
function tidyEdition(edition: string): string {
  return edition.replace(/\./g, "").replace(/\s+/g, " ").trim();
}

/**
 * Read an APA reference.
 *
 * The signature is an author list carrying INITIALS followed by a bracketed
 * year and a full stop — "Carter, R. (2015)." — which is a shape no citation in
 * the Guide has, because the Guide never initialises a leading author and never
 * puts the year there.
 */
function apa(text: string): ForeignFormat | null {
  const head = text.match(/^(.+?)\s*\((\d{4})[a-z]?\)\.\s*(.+)$/s);
  if (!head) return null;
  const [, rawAuthors, year, rest] = head;
  const author = apaAuthorsToGuide(rawAuthors);
  if (!author) return null;
  const lossy = [
    /\band others$/.test(author)
      ? "the first author's given name — APA initialises it"
      : author.includes(" and ")
        ? "both authors' given names — APA initialises them"
        : "author's given name — APA initialises it",
  ];

  // ---- a thesis: "[LLB (Hons) dissertation]. University of Auckland."
  const thesis = rest.match(/^(.*?)\s*\[([^\]]*(?:thesis|dissertation)[^\]]*)\]\.\s*(.+?)\.?\s*$/i);
  if (thesis) {
    const [, title, paper, university] = thesis;
    return {
      text: `${author} “${toHeadlineCase(title.trim())}” (${toHeadlineCase(paper.trim())}, ${university.trim()}, ${year}).`,
      style: "APA",
      lossy,
      fields: {
        author,
        title: toHeadlineCase(title.trim()),
        typeOfPaper: toHeadlineCase(paper.trim()),
        university: university.trim(),
        year,
      },
    };
  }

  // ---- a journal article: "… Journal Name, 9(2), 3-18."
  const journal = rest.match(
    /^(.*?)\.\s*([^.]+?),\s*(\d+(?:\(\d+\))?),\s*(\d+)(?:\s*[-–—]\s*\d+)?\.?\s*$/s,
  );
  if (journal) {
    const [, title, journalName, volume, page] = journal;
    const spelledOut = /\s/.test(journalName.trim());
    return {
      text: `${author} “${toHeadlineCase(title.trim())}” (${year}) ${volume} ${journalName.trim()} ${page}.`,
      style: "APA",
      lossy: spelledOut
        ? [...lossy, "the journal's Guide abbreviation — APA spells the name out"]
        : lossy,
      fields: {
        author,
        title: toHeadlineCase(title.trim()),
        year: `(${year})`,
        volume,
        journalAbbrev: journalName.trim(),
        startingPage: page,
      },
    };
  }

  // ---- an essay in an edited book (rule 6.2):
  // "Chapter. In A. Butler (Ed.), Book title (2nd ed., pp. 335-360). Publisher."
  const chapter = rest.match(
    /^(.*?)\.\s*In\s+(.+?)\s*\(Eds?\.\),?\s*(.+?)\s*\(([^)]*)\)\.\s*(.+?)\.?\s*$/s,
  );
  if (chapter) {
    const [, essayTitle, editor, bookTitle, bracket, publisher] = chapter;
    const edition = bracket.match(/(\d{1,2}(?:st|nd|rd|th)\s*ed|rev\.?\s*ed)\.?/i);
    const firstPage = bracket.match(/pp?\.\s*(\d+)/i);
    const tail = publicationTail({
      edition: edition ? tidyEdition(edition[1]) : "",
      publisher: publisher.trim(),
      year,
    });
    const page = firstPage ? ` ${firstPage[1]}` : "";
    return {
      text: `${author} “${toHeadlineCase(essayTitle.trim())}” in ${personToGuide(editor)} (ed) ${toHeadlineCase(bookTitle.trim())} (${tail})${page}.`,
      style: "APA",
      lossy: [...lossy, "the place of publication — APA 7 omits it"],
      omitted: ["place"],
      fields: {
        author,
        essayTitle: toHeadlineCase(essayTitle.trim()),
        editor: personToGuide(editor),
        bookTitle: toHeadlineCase(bookTitle.trim()),
        ...(edition ? { edition: tidyEdition(edition[1]) } : {}),
        publisher: publisher.trim(),
        year,
        ...(firstPage ? { startingPage: firstPage[1] } : {}),
      },
    };
  }

  // ---- a book: "Title (3rd ed.). Place, Country: Publisher." — and APA 7's
  // shorter "Title (3rd ed.). Publisher.", which carries no place at all.
  const book = rest.match(/^(.*?)\.\s*(?:([^.:]+):\s*)?([^.:]+?)\.?\s*$/s);
  if (book) {
    let [, title, place = "", publisher] = book;
    let edition = "";
    const ed = title.match(/\s*\((\d{1,2}(?:st|nd|rd|th)\s*ed\.?|rev\.?\s*ed\.?)\)\s*$/i);
    if (ed) {
      edition = tidyEdition(ed[1]);
      title = title.slice(0, ed.index).trim();
    }
    if (!title.trim() || !publisher.trim()) return null;
    const tail = publicationTail({
      edition,
      publisher: publisher.trim(),
      place: place ? placeOnly(place) : "",
      year,
    });
    return {
      text: `${author} ${toHeadlineCase(title.trim())} (${tail}).`,
      style: "APA",
      lossy: place
        ? lossy
        : [...lossy, "the place of publication — APA 7 omits it"],
      ...(place ? {} : { omitted: ["placeOfPublication"] }),
      fields: {
        author,
        title: toHeadlineCase(title.trim()),
        ...(edition ? { edition } : {}),
        publisher: publisher.trim(),
        ...(place ? { placeOfPublication: placeOnly(place) } : {}),
        year,
      },
    };
  }

  return null;
}

/**
 * Read a Harvard reference.
 *
 *   Burrows, A. (2011) The Law of Restitution. 3rd edn. Oxford: OUP.
 *
 * Harvard differs from APA in two ways that matter to a pattern: no full stop
 * after the year's bracket, and "edn" where the Guide writes "ed". It keeps the
 * place, so unlike APA 7 a Harvard book reaches a complete citation.
 */
function harvard(text: string): ForeignFormat | null {
  const match = text.match(
    /^(.+?)\s*\((\d{4})\)\s+(.+?)\.\s*(?:(\d{1,2}(?:st|nd|rd|th)\s+edn?|rev\.?\s+edn?)\.\s*)?([^.:]+):\s*([^.]+?)\.?\s*$/,
  );
  if (!match) return null;
  const [, rawAuthors, year, title, edition = "", place, publisher] = match;
  const author = apaAuthorsToGuide(rawAuthors);
  if (!author) return null;
  const tail = publicationTail({
    // "3rd edn" → "3rd ed": the Guide's abbreviation, not Harvard's.
    edition: edition ? tidyEdition(edition).replace(/\bedn\b/i, "ed") : "",
    publisher: publisher.trim(),
    place: placeOnly(place),
    year,
  });
  const guideEdition = edition ? tidyEdition(edition).replace(/\bedn\b/i, "ed") : "";
  return {
    text: `${author} ${toHeadlineCase(title.trim())} (${tail}).`,
    style: "Harvard",
    lossy: ["author's given name — Harvard initialises it"],
    fields: {
      author,
      title: toHeadlineCase(title.trim()),
      ...(guideEdition ? { edition: guideEdition } : {}),
      publisher: publisher.trim(),
      placeOfPublication: placeOnly(place),
      year,
    },
  };
}

/**
 * Read an MLA works-cited entry.
 *
 *   Burrows, Andrew. The Law of Restitution. 3rd ed., Oxford University Press, 2011.
 *
 * MLA keeps the given name in full, like Chicago, but puts the year last after
 * a comma and carries no place of publication.
 */
function mla(text: string): ForeignFormat | null {
  const match = text.match(
    /^([A-Z][\w'’-]+),\s+([A-Z][\w'’.\s-]*?)\.\s+(.+?)\.\s+(?:(\d{1,2}(?:st|nd|rd|th)\s+ed|rev\.?\s+ed)\.,\s*)?([^,]+),\s*(\d{4})\.?\s*$/,
  );
  if (!match) return null;
  const [, surname, given, title, edition = "", publisher, year] = match;
  const tail = publicationTail({
    edition: edition ? tidyEdition(edition) : "",
    publisher: publisher.trim(),
    year,
  });
  return {
    text: `${given.trim()} ${surname} ${title.trim()} (${tail}).`,
    style: "MLA",
    lossy: ["the place of publication — MLA omits it"],
    omitted: ["placeOfPublication"],
    fields: {
      author: `${given.trim()} ${surname}`,
      title: title.trim(),
      ...(edition ? { edition: tidyEdition(edition) } : {}),
      publisher: publisher.trim(),
      year,
    },
  };
}

/**
 * Read a Chicago bibliography entry.
 *
 *   Burrows, Andrew. The Law of Restitution. 3rd ed. Oxford: OUP, 2011.
 *
 * Chicago inverts only the FIRST author and keeps the given name in full, so
 * unlike APA nothing is lost and the Guide's citation is reachable exactly.
 */
function chicago(text: string): ForeignFormat | null {
  const match = text.match(
    /^([A-Z][\w'’-]+),\s+([A-Z][\w'’.\s-]*?)\.\s+(.+?)\.\s+(?:(\d{1,2}(?:st|nd|rd|th)\s+ed|rev\.?\s+ed)\.\s+)?([^.:]+):\s*([^,]+),\s*(\d{4})\.?\s*$/,
  );
  if (!match) return null;
  const [, surname, given, title, edition = "", place, publisher, year] = match;
  const inside = [edition && tidyEdition(edition), publisher.trim(), placeOnly(place), year]
    .filter(Boolean)
    .join(", ");
  return {
    text: `${given.trim()} ${surname} ${title.trim()} (${inside}).`,
    style: "Chicago",
    lossy: [],
    fields: {
      author: `${given.trim()} ${surname}`,
      title: title.trim(),
      ...(edition ? { edition: tidyEdition(edition) } : {}),
      publisher: publisher.trim(),
      placeOfPublication: placeOnly(place),
      year,
    },
  };
}

// A US report locus written the Bluebook way, with a full stop in every
// abbreviation: "410 U.S. 113 (1973)", "768 F.2d 145 (7th Cir. 1986)". The full
// stops are the signature — rule 1.4 removes them, so the Guide never has any.
// The reporter itself may be several dotted letters — "U.S.", "F.", "P.", "So."
// — so the abbreviation is a RUN of them, not one.
const BLUEBOOK_LOCUS =
  /\b\d{1,4}\s+(?:[A-Z][A-Za-z]*\.)+(?:\s*\d[a-z]\b|\s*Supp\.?|\s*App\.?)?\s*\d{1,5}\s*\(/;

/**
 * Read a Bluebook case citation.
 *
 * Everything here is the same removal — the full stops rule 1.4 does not use —
 * plus the comma Bluebook puts between the case name and the volume, which the
 * Guide does not (rule 8.6).
 */
function bluebook(text: string): ForeignFormat | null {
  if (!BLUEBOOK_LOCUS.test(text)) return null;
  let out = text;
  // "U.S." → "US", "S.D.N.Y." → "SDNY": a run of single letters each followed
  // by a full stop is one abbreviation written the Bluebook way.
  out = out.replace(/\b(?:[A-Z]\.){2,}/g, (run) => run.replace(/\./g, ""));
  // "F.2d" → "F 2d", "F. Supp." → "F Supp": a reporter and its series.
  out = out.replace(/\b([A-Z])\.\s*(\d[a-z]\b)/g, "$1 $2");
  out = out.replace(/\b([A-Z][A-Za-z]*)\.\s+(Supp|App|Ct|Rptr|Cas)\b\.?/g, "$1 $2");
  // "v." → "v", and the entity and court abbreviations Bluebook stops.
  out = out.replace(/\bv\.\s/g, "v ");
  out = out.replace(/\b(Inc|Co|Corp|Ltd|Cir|Ass'n|Dep't|No|Bros)\.(?=\s|,|$)/g, "$1");
  // ", Inc" and ", Co" — the Guide's case names carry no comma before them.
  out = out.replace(/,\s+(?=(?:Inc|Co|Corp|Ltd|Bros)\b)/g, " ");
  // The comma Bluebook puts between the case name and the volume number.
  out = out.replace(/,\s+(?=\d{1,4}\s+[A-Z])/g, " ");
  if (out === text) return null;
  return { text: out, style: "Bluebook", lossy: [] };
}

// New Zealand court names as a database spells them out, against the Guide's
// Appendix 3 abbreviations. Only the courts a database actually names in full.
const COURT_NAMES: [RegExp, string][] = [
  [/\bCourt of Appeal(?: of New Zealand)?\b/i, "CA"],
  [/\bSupreme Court(?: of New Zealand)?\b/i, "SC"],
  [/\bHigh Court(?: of New Zealand)?\b/i, "HC"],
  [/\bDistrict Court(?: of New Zealand)?\b/i, "DC"],
  [/\bEmployment Court\b/i, "EmpC"],
  [/\bPrivy Council\b/i, "PC"],
];

/**
 * Read a line scraped off a judgment database, whose parts are separated by
 * spaced hyphens: "Taylor v NZ Poultry Board - [1984] 1 NZLR 394 - Court of
 * Appeal of New Zealand".
 *
 * The hyphens are the listing's furniture, not punctuation of the citation, and
 * left in place they became part of the case name and shifted every field after
 * it.
 *
 * A spaced hyphen ALONE is nowhere near enough of a signature, and assuming it
 * was broke two existing floors immediately. A student types a pinpoint range
 * with spaces around the dash — "at 398 - 401" — and rule 3.5 separates a Māori
 * Land Court case name from its block with a dash of its own: "Faulkner v Hoete
 * – Motiti North C No 1". Splitting either of those on the dash destroys it.
 *
 * What actually marks a database listing is its COURT COLUMN: one part that is
 * nothing but a court's name written out in full. The Guide abbreviates every
 * court (Appendix 3), so a bare "Court of Appeal of New Zealand" standing as
 * its own hyphen-delimited part cannot be a citation in the Guide's shape.
 */
function databaseListing(text: string): ForeignFormat | null {
  if (!/\s-\s/.test(text)) return null;
  const parts = text.split(/\s+-\s+/).map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  // Only a listing that leads with a case name and carries a report locus.
  if (!/\sv\s/i.test(parts[0])) return null;
  if (!parts.some((p) => /[[(]\d{4}[\])]/.test(p))) return null;

  /** A part that is NOTHING but a court's name is the listing's court column. */
  const courtColumn = (part: string): string | null => {
    const named = COURT_NAMES.find(([pattern]) => pattern.test(part));
    return named && part.replace(named[0], "").trim().length === 0 ? named[1] : null;
  };
  // Without that column this is not a listing, and the dash belongs to whatever
  // typed it — a pinpoint range, or rule 3.5's block-name separator.
  if (!parts.some((p) => courtColumn(p))) return null;

  const kept: string[] = [];
  let court = "";
  for (const part of parts) {
    const abbrev = courtColumn(part);
    if (abbrev) {
      court = abbrev;
      continue;
    }
    // A part that is nothing but a bare year repeats what the locus already says.
    if (/^\(?\d{4}\)?$/.test(part)) continue;
    kept.push(part);
  }
  const body = kept.join(" ");
  return {
    text: court ? `${body} (${court}).` : `${body}.`,
    style: "database listing",
    lossy: [],
  };
}

/**
 * Rewrite a paste into the Guide's shape if it is written in a style this knows.
 *
 * Order matters only where two signatures could both fire; they are written to
 * be mutually exclusive, and each returns null rather than guessing.
 */
export function normaliseForeignFormat(rawText: string): ForeignFormat {
  const text = stripApparatus(rawText.replace(/\s+/g, " ").trim());
  if (!text) return untouched(rawText);
  // Chicago and MLA are both "Surname, Forename. Title." and are separated only
  // by where the year sits, so Chicago (year last, after the publisher and a
  // place) is tried before MLA (year last, no place).
  for (const read of [apa, harvard, chicago, mla, bluebook, databaseListing]) {
    const result = read(text);
    if (result && result.text.trim() && result.text !== text) return result;
  }
  return untouched(rawText);
}

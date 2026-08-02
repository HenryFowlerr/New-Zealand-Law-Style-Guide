import { useEffect, useMemo, useState } from "react";
import {
  guideGroupOrder,
  guideTypeById,
  guideTypes,
  type GuideComponent,
  type GuideType,
} from "./data/styleGuide";
import {
  buildCitation,
  composeFootnote,
  detectTypes,
  missingRequiredComponents,
  prefillFromPaste,
  visibleComponents,
  auditAgainstPaste,
  type CitationFields,
  type ItalicRun,
} from "./engine/build";
import { pasteIsAllCaps, splitReferences } from "./engine/render";
import { forbiddenShortForm } from "./engine/rules";
import { resolveLink, looksLikeLink } from "./engine/linkResolve";
import { normaliseForeignFormat } from "./engine/foreignFormat";
import { pasteCarriesCitationApparatus } from "./engine/build";
import { browserFetchers } from "./engine/browserFetch";

type Mode = "paste" | "build";
type FootnoteEntry = { typeId: string; fields: CitationFields };

const STORAGE_KEY = "nz-law-cite-footnote-v2";

/**
 * Read pasted rich text: return the plain text plus the italic spans within it.
 * Italic runs let the tool split an italic title from a non-italic author when
 * the reference was copied from a formatted source.
 */
function parsePastedHtml(html: string): { text: string; italicRuns: ItalicRun[] } {
  const doc = new DOMParser().parseFromString(html, "text/html");
  let raw = "";
  const rawRuns: { text: string; start: number }[] = [];
  const walk = (node: Node, italic: boolean) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const value = node.textContent ?? "";
      if (!value) return;
      if (italic && value.trim()) rawRuns.push({ text: value, start: raw.length });
      raw += value;
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();
    const styleItalic = /font-style\s*:\s*italic/i.test(el.getAttribute("style") ?? "");
    const nextItalic = italic || tag === "i" || tag === "em" || styleItalic;
    el.childNodes.forEach((child) => walk(child, nextItalic));
  };
  walk(doc.body, false);

  const text = raw.replace(/\s+/g, " ").trim();
  const italicRuns: ItalicRun[] = [];
  for (const run of rawRuns) {
    const normalised = run.text.replace(/\s+/g, " ").trim();
    if (!normalised) continue;
    const start = text.indexOf(normalised);
    if (start >= 0) italicRuns.push({ text: normalised, start, end: start + normalised.length });
  }
  return { text, italicRuns };
}

function navigatorMeta(): string {
  if (typeof navigator === "undefined") return "Ctrl";
  return /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent)
    ? "⌘"
    : "Ctrl";
}

function loadSavedFootnote(): FootnoteEntry[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return [];
    const parsed = JSON.parse(saved) as FootnoteEntry[];
    return Array.isArray(parsed)
      ? parsed.filter(
          (item) =>
            item &&
            typeof item.typeId === "string" &&
            guideTypeById[item.typeId] &&
            item.fields &&
            typeof item.fields === "object",
        )
      : [];
  } catch {
    return [];
  }
}

async function copyCitation(
  plainText: string,
  html: string,
  rich: boolean,
): Promise<void> {
  if (rich && typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
    const item = new ClipboardItem({
      "text/plain": new Blob([plainText], { type: "text/plain" }),
      "text/html": new Blob([html], { type: "text/html" }),
    });
    await navigator.clipboard.write([item]);
    return;
  }
  await navigator.clipboard.writeText(plainText);
}

function firstExample(type: GuideType): string {
  return type.examples[0]?.correct_citation ?? "";
}

function Field({
  component,
  fields,
  onChange,
  flagMissing = false,
}: {
  component: GuideComponent;
  fields: CitationFields;
  onChange: (id: string, value: string) => void;
  flagMissing?: boolean;
}) {
  const helpId = `${component.id}-help`;
  const current = fields[component.id] ?? "";
  const isEmpty = !current.trim();
  const needed = flagMissing && component.required && isEmpty;
  return (
    <label className={needed ? "field field-needed" : "field"}>
      <span className="field-label">
        {component.label}
        {component.required && <span aria-hidden="true"> *</span>}
        {needed && <span className="needed-pill">Needed</span>}
      </span>
      <input
        aria-describedby={component.formatting ? helpId : undefined}
        autoComplete="off"
        id={`input-${component.id}`}
        type="text"
        value={current}
        onChange={(event) => onChange(component.id, event.target.value)}
      />
      {component.formatting && (
        <span className="field-help field-help-clamp" id={helpId} title={component.formatting}>
          {component.formatting}
        </span>
      )}
    </label>
  );
}

function TypePicker({
  onSelect,
  query,
  setQuery,
}: {
  onSelect: (id: string) => void;
  query: string;
  setQuery: (value: string) => void;
}) {
  const needle = query.toLowerCase().trim();
  const filtered = guideTypes.filter((type) => {
    const haystack =
      `${type.name} ${type.group} ${type.rule} ${firstExample(type)}`.toLowerCase();
    return haystack.includes(needle);
  });

  return (
    <section aria-labelledby="format-heading" className="type-picker">
      <div className="section-heading-row">
        <div>
          <p className="eyebrow">Every Style Guide format</p>
          <h2 id="format-heading">What are you citing?</h2>
        </div>
        <span className="coverage-count">{guideTypes.length} source types</span>
      </div>
      <label className="search-field">
        <span className="sr-only">Search citation formats</span>
        <span aria-hidden="true" className="search-symbol">
          /
        </span>
        <input
          placeholder="Search case, Act, treaty, Hansard, journal, thesis…"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && filtered.length > 0) {
              event.preventDefault();
              onSelect(filtered[0].id);
            }
          }}
        />
      </label>
      {guideGroupOrder.map((group) => {
        const items = filtered.filter((type) => type.group === group);
        if (!items.length) return null;
        return (
          <div className="type-group" key={group}>
            <h3>{group}</h3>
            <div className="type-grid">
              {items.map((type) => (
                <button
                  className="type-card"
                  key={type.id}
                  onClick={() => onSelect(type.id)}
                  type="button"
                >
                  <span className="type-rule">Rule {type.rule}</span>
                  <strong>{type.name}</strong>
                  <span className="type-example">{firstExample(type)}</span>
                  <span aria-hidden="true" className="type-arrow">
                    →
                  </span>
                </button>
              ))}
            </div>
          </div>
        );
      })}
      {!filtered.length && (
        <div className="empty-state">
          <strong>No format matches that search.</strong>
          <span>Try a broader term, or the source’s jurisdiction.</span>
        </div>
      )}
    </section>
  );
}

function App() {
  const [mode, setMode] = useState<Mode>("paste");
  const [pasteText, setPasteText] = useState("");
  const [italicRuns, setItalicRuns] = useState<ItalicRun[]>([]);
  const [detections, setDetections] = useState<ReturnType<typeof detectTypes>>([]);
  const [analysisAttempted, setAnalysisAttempted] = useState(false);
  /** Index into `references` — which of several pasted citations is in hand. */
  const [activeReference, setActiveReference] = useState(0);
  /** Indices already added to the footnote, so the list shows progress. */
  const [doneReferences, setDoneReferences] = useState<number[]>([]);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [fields, setFields] = useState<CitationFields>({});
  const [reviewRequired, setReviewRequired] = useState(false);
  // Whether the fields came from a resolved LINK rather than a pasted reference.
  // The paste audit compares the citation word by word against what was pasted,
  // which is exactly wrong for a link: rule 4.1.1 gives an Act no URL at all, so
  // every part of the web address was reported as a detail the citation had lost.
  const [filledFromLink, setFilledFromLink] = useState(false);
  const [query, setQuery] = useState("");
  // A fragment offers no type, so the reader picks one in place — without
  // leaving the paste behind, which is the whole point of picking here.
  const [pickingForPaste, setPickingForPaste] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const [linkStatus, setLinkStatus] = useState("");
  const [linkBusy, setLinkBusy] = useState(false);
  const [footnoteEntries, setFootnoteEntries] = useState<FootnoteEntry[]>(() =>
    loadSavedFootnote(),
  );

  const type = selectedType ? guideTypeById[selectedType] : null;
  const result = useMemo(
    () => (selectedType ? buildCitation(selectedType, fields) : null),
    [selectedType, fields],
  );
  const components = type ? visibleComponents(type) : [];
  const extractedCount = type
    ? components.filter((c) => (fields[c.id] ?? "").trim()).length
    : 0;
  const missing = type ? missingRequiredComponents(type, fields) : [];
  // Copying is gated on the citation being complete, not on a tick box. The
  // auto-filled fields are still flagged as read from the paste so they invite
  // a skim, but the extra confirmation step was pure friction.
  const copyReady = result?.status === "ready";
  // Compare the finished citation against what was pasted. Choosing the source
  // type is the least reliable part of the tool, and a wrong choice fails
  // quietly: a detail is dropped, or written twice, and the citation still
  // reads perfectly well. This is the one moment that is catchable.
  const citationWarnings = useMemo(() => {
    if (!reviewRequired || filledFromLink || result?.status !== "ready") return [];
    const source = splitReferences(pasteText)[activeReference] ?? pasteText;
    return auditAgainstPaste(source, result.text);
  }, [reviewRequired, filledFromLink, result, pasteText, activeReference]);

  // A paste in full capitals came out of a case list or a judgment database, and
  // rule 3.2's "exactly as on the first page of the report" is something only the
  // reader can supply — so the tool keeps the capitals and says so, rather than
  // guessing whether "ANZ" is an initialism or a name.
  const shoutedPaste = useMemo(
    () =>
      reviewRequired &&
      !filledFromLink &&
      result?.status === "ready" &&
      pasteIsAllCaps(splitReferences(pasteText)[activeReference] ?? pasteText),
    [reviewRequired, filledFromLink, result, pasteText, activeReference],
  );

  // A paste with no citation apparatus in it — no year, no report locus, no
  // pinpoint, no web address — is PART of a reference rather than one. Nothing
  // in it can say which rule it belongs to, so no type is offered and the
  // interface says what is missing instead of guessing.
  const isFragment = useMemo(
    () =>
      Boolean(pasteText.trim()) &&
      !looksLikeLink(pasteText.trim()) &&
      !pasteCarriesCitationApparatus(
        splitReferences(pasteText)[activeReference] ?? pasteText,
      ),
    [pasteText, activeReference],
  );

  // A reference pasted in APA, Bluebook or Chicago is rewritten into the Guide's
  // shape before it is read. Those formats can LOSE what the Guide requires —
  // APA initialises given names, so "Carter, R." can only become "R Carter" —
  // and the tool must not invent the rest back. Saying which style was
  // recognised and exactly what it could not carry is the difference between a
  // citation the reader knows to finish and one they trust as complete.
  const foreignFormat = useMemo(() => {
    if (!reviewRequired || filledFromLink) return null;
    const source = splitReferences(pasteText)[activeReference] ?? pasteText;
    const read = normaliseForeignFormat(source);
    return read.style ? read : null;
  }, [reviewRequired, filledFromLink, pasteText, activeReference]);

  // "ibid" is a habit from other disciplines; rule 2.3 does not use it.
  const shortFormWarning = useMemo(
    () => forbiddenShortForm(splitReferences(pasteText)[activeReference] ?? pasteText),
    [pasteText, activeReference],
  );

  const footnoteResults = useMemo(
    () => footnoteEntries.map((entry) => buildCitation(entry.typeId, entry.fields)),
    [footnoteEntries],
  );
  const footnote = useMemo(() => composeFootnote(footnoteResults), [footnoteResults]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(footnoteEntries));
  }, [footnoteEntries]);

  useEffect(() => {
    if (!copyStatus) return;
    const timeout = window.setTimeout(() => setCopyStatus(""), 2200);
    return () => window.clearTimeout(timeout);
  }, [copyStatus]);

  // Live paste detection.
  useEffect(() => {
    if (mode !== "paste" || selectedType) return;
    // A link/DOI/ISBN is looked up, not type-detected — don't run text detection.
    if (!pasteText.trim() || looksLikeLink(pasteText.trim())) {
      setDetections([]);
      setAnalysisAttempted(false);
      return;
    }
    const handle = window.setTimeout(() => {
      const parts = splitReferences(pasteText);
      const target = parts[activeReference] ?? parts[0] ?? pasteText;
      setDetections(detectTypes(target));
      setAnalysisAttempted(true);
    }, 220);
    return () => window.clearTimeout(handle);
  }, [pasteText, mode, selectedType, activeReference]);

  const switchMode = (nextMode: Mode) => {
    setMode(nextMode);
    setPickingForPaste(false);
    setSelectedType(null);
    setFields({});
    setItalicRuns([]);
    setDetections([]);
    setAnalysisAttempted(false);
    setReviewRequired(false);
    setFilledFromLink(false);
    setLinkStatus("");
  };

  const selectType = (id: string, fromPaste = mode === "paste") => {
    setSelectedType(id);
    const parts = splitReferences(pasteText);
    const source = parts[activeReference] ?? parts[0] ?? pasteText;
    const prefill = fromPaste
      ? prefillFromPaste(guideTypeById[id], source, parts.length > 1 ? [] : italicRuns)
      : {};
    setFields(prefill);
    setReviewRequired(fromPaste);
    setFilledFromLink(false);
    const missingNow = missingRequiredComponents(guideTypeById[id], prefill);
    const focusId = missingNow[0]
      ? `input-${missingNow[0].id}`
      : visibleComponents(guideTypeById[id])[0]
        ? `input-${visibleComponents(guideTypeById[id])[0].id}`
        : null;
    window.setTimeout(() => {
      document.getElementById("citation-form")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      const target = focusId ? document.getElementById(focusId) : null;
      if (target instanceof HTMLElement) target.focus({ preventScroll: true });
    }, 60);
  };

  const resolveLinkAndFill = async (rawUrl: string) => {
    const url = rawUrl.trim();
    if (!url || linkBusy) return;
    if (!looksLikeLink(url)) {
      setLinkStatus("That doesn’t look like a link, DOI or ISBN.");
      return;
    }
    setLinkBusy(true);
    setLinkStatus("Looking up the reference…");
    try {
      const resolved = await resolveLink(url, browserFetchers);
      if (!resolved) {
        setLinkStatus("No citation details were found at that link — paste the reference text above instead.");
        return;
      }
      if (resolved.source === "subscription-database") {
        // Recognised in order to decline. Producing anything here would put a
        // database session address into a case citation.
        setLinkStatus(
          `That is a ${resolved.sourceName} link. ${resolved.declined} Copy the reference itself off the page — the case name and citation, or the article's author and title — and paste that above instead.`,
        );
        return;
      }
      setSelectedType(resolved.typeId);
      setFields(resolved.fields);
      setReviewRequired(true);
      setFilledFromLink(true);
      if (resolved.source === "nz-legal-source" || resolved.source === "nz-legal-url") {
        // A New Zealand legal source: the web address itself settled what kind of
        // thing this is, so the type is right whether or not the page could be
        // read. Say which boxes the source cannot fill rather than implying it
        // filled them all.
        const site = resolved.sourceName ?? "the source";
        const needed = (resolved.stillNeeded ?? [])
          .map((id) => visibleComponents(guideTypeById[resolved.typeId]).find((c) => c.id === id)?.label ?? id)
          .join(", ");
        const read =
          resolved.source === "nz-legal-source"
            ? `Read from ${site}.`
            : `Recognised as ${site}, but the page itself could not be read.`;
        setLinkStatus(
          needed
            ? `${read} The web address gives the citation’s structure; please add ${needed} from the source itself, then check every field.`
            : `${read} Check every field against the source before you copy.`,
        );
      } else if (resolved.source === "url-only") {
        // The page blocked automated reading; only the URL/slug was usable.
        setLinkStatus(
          "This site blocked automatic reading, so the title was taken from the web address and the site name from the link. Please add the author and date, and check the title.",
        );
      } else {
        const label =
          resolved.source === "crossref"
            ? "Crossref"
            : resolved.source === "openlibrary"
              ? "Open Library"
              : "the page";
        setLinkStatus(
          `Filled from ${label}. Review every field — some parts (like a pinpoint) may still be needed.`,
        );
      }
      window.setTimeout(() => {
        document.getElementById("citation-form")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 60);
    } catch {
      setLinkStatus("That link couldn’t be read (the site may block automated access) — paste the reference text above instead.");
    } finally {
      setLinkBusy(false);
    }
  };

  const updateField = (id: string, value: string) => {
    setFields((current) => ({ ...current, [id]: value }));
  };

  const handleCopy = async (plainText: string, html: string, rich: boolean) => {
    try {
      await copyCitation(plainText, html, rich);
      setCopyStatus(rich ? "Formatted citation copied" : "Plain text copied");
    } catch {
      setCopyStatus("Copy was blocked — select the citation manually");
    }
  };

  const goBack = () => {
    setSelectedType(null);
    setFields({});
    setReviewRequired(false);
  };

  useEffect(() => {
    if (!selectedType) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        const tag = document.activeElement?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
        goBack();
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        if (result?.status === "ready") {
          event.preventDefault();
          void handleCopy(result.text, result.html, true);
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedType, result]);

  const addToFootnote = () => {
    if (!selectedType || !copyReady) return;
    setFootnoteEntries((current) => [...current, { typeId: selectedType, fields }]);
    const parts = splitReferences(pasteText);
    if (parts.length > 1) {
      setDoneReferences((done) =>
        done.includes(activeReference) ? done : [...done, activeReference],
      );
      // Move to the next reference that has not been dealt with yet.
      const next = parts.findIndex(
        (_, index) => index !== activeReference && !doneReferences.includes(index),
      );
      if (next >= 0) {
        setActiveReference(next);
        setSelectedType(null);
        setFields({});
        setCopyStatus(`Added — ${parts.length - doneReferences.length - 1} to go`);
        return;
      }
    }
    setCopyStatus("Added to footnote");
  };

  // A reading list or footnote block is pasted as several citations at once.
  // Each is handled in turn rather than the first being used and the rest
  // silently dropped.
  const references = useMemo(() => splitReferences(pasteText), [pasteText]);
  const currentReference = references[activeReference] ?? pasteText;
  const topDetection = detections[0];
  const pasteIsLink = looksLikeLink(pasteText.trim());

  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href="#top" aria-label="NZ Law Cite home">
          <span className="brand-mark" aria-hidden="true">
            NZ
          </span>
          <span>Law Cite</span>
        </a>
        <div className="header-meta">
          <span className="privacy-badge">
            <span aria-hidden="true" className="status-dot" />
            Runs only in your browser
          </span>
          <a
            href="https://lawfoundation.org.nz/style-guide2019/index.html"
            rel="noreferrer"
            target="_blank"
          >
            Official guide ↗
          </a>
        </div>
      </header>

      <main id="top">
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">New Zealand Law Style Guide · Third edition</p>
            <h1>
              Legal citations,
              <br />
              without the guesswork.
            </h1>
            <p className="hero-intro">
              Paste a reference to check it, or build one from scratch. Every one
              of the Style Guide’s {guideTypes.length} source types, generated to
              the letter, and never a confident guess when a fact is missing.
            </p>
          </div>
          <aside className="trust-card">
            <span className="trust-number">01</span>
            <div>
              <strong>Fail-closed by design</strong>
              <p>
                Missing a fact? You will see a question, not a confident-looking
                guess. Every part the format requires is marked until you supply
                it, and the finished citation is checked back against what you
                pasted.
              </p>
            </div>
          </aside>
        </section>

        <section className="workspace">
          <div className="mode-tabs" role="tablist" aria-label="Citation workflow">
            <button
              aria-selected={mode === "paste"}
              className={mode === "paste" ? "active" : ""}
              onClick={() => switchMode("paste")}
              role="tab"
              type="button"
            >
              <span>01</span> Check what I have
            </button>
            <button
              aria-selected={mode === "build"}
              className={mode === "build" ? "active" : ""}
              onClick={() => switchMode("build")}
              role="tab"
              type="button"
            >
              <span>02</span> Build from details
            </button>
          </div>

          {mode === "paste" && !selectedType && (
            <section className="paste-panel" aria-labelledby="paste-heading">
              <div className="paste-copy">
                <p className="eyebrow">Start anywhere</p>
                <h2 id="paste-heading">Paste a reference, or a link.</h2>
                <p>
                  Drop in a citation (even a partial or APA-style one) or a web
                  link, DOI or ISBN. The tool reads it and fills the boxes — you
                  skim to confirm, then copy the correct citation.
                </p>
                {/*
                  Rule 3.2 wants the parties' names exactly as printed on the
                  first page of the report, and a paste in capitals cannot say
                  what that is — "ANZ" and "Anz" are the same string once
                  shouted. The tool reads a shouted paste and keeps the capitals
                  rather than guessing, so asking for ordinary case up front
                  saves the reader retyping the names afterwards.
                */}
                <p className="paste-hint">
                  Best results in ordinary case. If you paste in{" "}
                  <strong>ALL CAPITALS</strong> the type is still recognised, but
                  the names come back in capitals — the Guide wants them exactly
                  as printed and a shouted paste can’t say what that is, so
                  you’ll have to retype them.
                </p>
              </div>
              <label className="paste-box">
                <span className="sr-only">A citation or a link to check</span>
                <textarea
                  placeholder={'Paste a reference, or a link / DOI / ISBN — e.g. Z v Dental Complaints Assessment Committee [2008] NZSC 55, [2009] 1 NZLR 1 at [26]'}
                  value={pasteText}
                  onChange={(event) => {
                    setPasteText(event.target.value);
                    setPickingForPaste(false);
                    setItalicRuns([]);
                    setLinkStatus("");
                    setActiveReference(0);
                    setDoneReferences([]);
                  }}
                  onPaste={(event) => {
                    const html = event.clipboardData?.getData("text/html");
                    if (html && html.trim()) {
                      event.preventDefault();
                      const parsed = parsePastedHtml(html);
                      setPasteText(parsed.text);
                      setItalicRuns(parsed.italicRuns);
                    }
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      if (pasteIsLink) {
                        event.preventDefault();
                        void resolveLinkAndFill(pasteText);
                      } else if (topDetection) {
                        event.preventDefault();
                        selectType(topDetection.typeId, true);
                      }
                    }
                  }}
                />
                <div className="paste-actions">
                  <span>
                    {pasteIsLink
                      ? "Looks like a link · press Enter to look it up"
                      : topDetection
                        ? "Detected live · press Enter to use the top match"
                        : `${pasteText.length} characters`}
                  </span>
                  {pasteIsLink ? (
                    <button
                      className="primary-button"
                      disabled={linkBusy}
                      onClick={() => void resolveLinkAndFill(pasteText)}
                      type="button"
                    >
                      {linkBusy ? "Looking up…" : "Look up link →"}
                    </button>
                  ) : (
                    <button
                      className="primary-button"
                      disabled={!topDetection}
                      onClick={() => topDetection && selectType(topDetection.typeId, true)}
                      type="button"
                    >
                      {topDetection
                        ? `Use ${guideTypeById[topDetection.typeId].name} →`
                        : "Waiting for a reference"}
                    </button>
                  )}
                </div>
                {linkStatus && (
                  <p className="link-status paste-link-status" aria-live="polite">
                    {linkStatus}
                  </p>
                )}
              </label>

              {references.length > 1 && (
                <div className="reference-list" aria-live="polite">
                  <div className="result-heading">
                    <div>
                      <span className="step-pill">
                        {references.length} references
                      </span>
                      <h3>Work through them one at a time</h3>
                    </div>
                    <span className="safe-note">
                      {doneReferences.length} of {references.length} added
                    </span>
                  </div>
                  <ol className="reference-items">
                    {references.map((reference, index) => {
                      const done = doneReferences.includes(index);
                      const active = index === activeReference;
                      return (
                        <li
                          className={`reference-item${active ? " reference-active" : ""}${
                            done ? " reference-done" : ""
                          }`}
                          key={`${index}-${reference.slice(0, 24)}`}
                        >
                          <button
                            onClick={() => {
                              setActiveReference(index);
                              setSelectedType(null);
                              setFields({});
                            }}
                            type="button"
                          >
                            <span aria-hidden="true">{done ? "✓" : index + 1}</span>
                            <span>{reference}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              )}

              {detections.length > 0 && (
                <div className="suggestions" aria-live="polite">
                  <div className="result-heading">
                    <div>
                      <span className="step-pill">Next</span>
                      <h3>Confirm the source type</h3>
                    </div>
                    <span className="safe-note">No output generated yet</span>
                  </div>
                  <div className="suggestion-grid">
                    {detections.map((detection, index) => {
                      const dt = guideTypeById[detection.typeId];
                      return (
                        <button
                          className={
                            index === 0
                              ? "suggestion-card suggestion-top"
                              : "suggestion-card"
                          }
                          key={detection.typeId}
                          onClick={() => selectType(detection.typeId, true)}
                          type="button"
                        >
                          <span className="confidence confidence-high">
                            {index === 0 ? "Top match · Enter" : `Rule ${dt.rule}`}
                          </span>
                          <strong>{dt.name}</strong>
                          <span>{firstExample(dt)}</span>
                          <span className="review-link">Review fields →</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {analysisAttempted && detections.length === 0 && (
                <div className="no-match" role="status">
                  {isFragment ? (
                    <>
                      {/*
                        A fragment carries no citation apparatus — no year, no
                        report, no pinpoint — so nothing can say which rule it
                        belongs to. Naming what is missing is more use than
                        "not recognised", and the words are kept: choosing a
                        format below still reads them into the boxes.
                      */}
                      <strong>That looks like part of a reference.</strong>
                      <span>
                        There is no year, report citation, pinpoint or web
                        address in it, so nothing here says which kind of source
                        it is — and guessing would give you a citation that
                        looks right and isn’t. Choose the format and it will be
                        read into the boxes, with whatever is still missing
                        marked.
                      </span>
                    </>
                  ) : (
                    <>
                      <strong>That structure was not recognised automatically.</strong>
                      <span>Choose the format and enter the details instead.</span>
                    </>
                  )}
                  <button
                    className="text-button"
                    onClick={() => setPickingForPaste(true)}
                    type="button"
                  >
                    Choose a format →
                  </button>
                </div>
              )}

              {pickingForPaste && (
                <TypePicker
                  onSelect={(id) => {
                    setPickingForPaste(false);
                    // fromPaste: the words the reader typed are still theirs, so
                    // the chosen type reads them rather than opening empty.
                    selectType(id, true);
                  }}
                  query={query}
                  setQuery={setQuery}
                />
              )}
            </section>
          )}

          {mode === "build" && !selectedType && (
            <TypePicker onSelect={(id) => selectType(id, false)} query={query} setQuery={setQuery} />
          )}

          {type && result && (
            <section className="builder" id="citation-form">
              <div className="form-column">
                <button className="back-button" onClick={goBack} type="button">
                  ← {mode === "paste" ? "Back to detection" : "Choose another format"}
                </button>
                <div className="form-heading">
                  <div>
                    <p className="eyebrow">
                      {type.group} · Rule {type.rule}
                    </p>
                    <h2>{type.name}</h2>
                    <p className="form-example">e.g. {firstExample(type)}</p>
                  </div>
                  <a href={type.ruleUrl} rel="noreferrer" target="_blank">
                    Read rule ↗
                  </a>
                </div>

                {shortFormWarning && (
                  <div className="review-banner extraction-summary">
                    <strong>“ibid” is not used in this Guide</strong>
                    <span>{shortFormWarning}</span>
                  </div>
                )}
                {filledFromLink && linkStatus && (
                  // Where the fields came from, shown beside them. The status was
                  // only rendered in the paste view, so the one thing a reader
                  // needs to know about a link fill — which site it was read from,
                  // and what that site could not tell us — disappeared the moment
                  // the form opened.
                  <div className="review-banner extraction-summary">
                    <strong>Filled from a link</strong>
                    <span>{linkStatus}</span>
                  </div>
                )}
                {reviewRequired && (
                  <div className="review-banner extraction-summary">
                    <strong>
                      {extractedCount > 0
                        ? `${extractedCount} ${
                            extractedCount === 1 ? "detail" : "details"
                          } read from your reference`
                        : "No details could be read automatically"}
                    </strong>
                    {missing.length > 0 ? (
                      <span>
                        Still needed before a citation is generated:{" "}
                        <strong className="needed-list">
                          {missing.map((component) => component.label).join(", ")}
                        </strong>
                        . Check every field against the source.
                      </span>
                    ) : (
                      <span>
                        Every required field was read from your reference. Check
                        each one against the source before you copy.
                      </span>
                    )}
                  </div>
                )}

                <div className="field-grid">
                  {components.map((component) => (
                    <Field
                      component={component}
                      fields={fields}
                      flagMissing={reviewRequired}
                      key={component.id}
                      onChange={updateField}
                    />
                  ))}
                </div>

              </div>

              <aside className="result-column" aria-live="polite">
                <div className="result-card">
                  <div className="result-card-head">
                    <span className={`result-status ${copyReady ? "ready" : "waiting"}`}>
                      <span aria-hidden="true">{copyReady ? "✓" : "!"}</span>
                      {copyReady
                        ? "Complete — every required part is filled in"
                        : missing.length === 1
                          ? `1 required part still missing: ${missing[0].label}`
                          : `${missing.length} required parts still missing`}
                    </span>
                    <span>NZLSG {type.rule}</span>
                  </div>

                  <div className={`citation-preview ${copyReady ? "" : "muted"}`}>
                    {result.status === "ready" ? (
                      <p dangerouslySetInnerHTML={{ __html: result.html }} />
                    ) : (
                      <p className="placeholder-copy">
                        Your citation will appear only after every required detail
                        is complete.
                      </p>
                    )}
                  </div>

                  <div className="issues">
                    {result.issues.map((issue, index) => (
                      <div
                        className={`issue issue-${issue.level}`}
                        key={`${issue.field}-${index}`}
                      >
                        <span aria-hidden="true">{issue.level === "error" ? "!" : "i"}</span>
                        <p>{issue.message}</p>
                      </div>
                    ))}
                    {shoutedPaste && (
                      <div className="issue issue-check">
                        <span aria-hidden="true">?</span>
                        <p>
                          You pasted this in capitals, so the citation is in
                          capitals too. Rule 3.2 wants the parties’ names{" "}
                          <strong>exactly as printed on the first page of the
                          report</strong> — and a paste in capitals can’t say what
                          that is, so nothing here has been re-capitalised for
                          you. Please fix the names by hand. The abbreviations
                          (NZLR, NZCA, CA, Ltd) are already right.
                        </p>
                      </div>
                    )}
                    {foreignFormat && (
                      <div className="issue issue-check">
                        <span aria-hidden="true">?</span>
                        <p>
                          That looked like{" "}
                          <strong>{foreignFormat.style}</strong>, so it has been
                          rearranged into the Style Guide’s order.
                          {foreignFormat.lossy.length > 0 ? (
                            <>
                              {" "}
                              {foreignFormat.style} can’t carry everything the
                              Guide needs, and nothing has been guessed for you —
                              please supply{" "}
                              <strong>{foreignFormat.lossy.join("; ")}</strong>{" "}
                              from the source itself.
                            </>
                          ) : (
                            " Check every field against the source before you copy."
                          )}
                        </p>
                      </div>
                    )}
                    {citationWarnings.length > 0 && (
                      <div className="issue issue-check">
                        <span aria-hidden="true">?</span>
                        <p>
                          {citationWarnings.some((w) => w.kind === "repeated")
                            ? "This citation repeats itself — check the format is right: "
                            : "These details are in what you pasted but not in the citation: "}
                          <strong>
                            {citationWarnings.slice(0, 6).map((w) => w.text).join("; ")}
                          </strong>
                          {citationWarnings.length > 6 ? " …" : ""}
                        </p>
                      </div>
                    )}
                    {copyReady && !result.issues.length && !citationWarnings.length && !shoutedPaste && !foreignFormat && (
                      <div className="issue issue-success">
                        <span aria-hidden="true">✓</span>
                        <p>All required fields for this format are complete.</p>
                      </div>
                    )}
                  </div>

                  <div className="copy-actions">
                    <button
                      className="primary-button"
                      disabled={!copyReady}
                      onClick={() => handleCopy(result.text, result.html, true)}
                      type="button"
                    >
                      Copy formatted
                    </button>
                    <button
                      className="secondary-button"
                      disabled={!copyReady}
                      onClick={() => handleCopy(result.text, result.html, false)}
                      type="button"
                    >
                      Plain text
                    </button>
                  </div>
                  <button
                    className="add-footnote-button"
                    disabled={!copyReady}
                    onClick={addToFootnote}
                    type="button"
                  >
                    + Add this authority to a footnote
                  </button>
                  {copyReady && (
                    <p className="copy-hint">
                      Tip: press <kbd>{navigatorMeta()}</kbd>
                      <kbd>Enter</kbd> to copy, or <kbd>Esc</kbd> to go back.
                    </p>
                  )}
                </div>

                <div className="provenance-card">
                  <div className="provenance-mark" aria-hidden="true">
                    §
                  </div>
                  <div>
                    <strong>Rule provenance</strong>
                    <p>
                      Output is rendered from{" "}
                      <a href={type.ruleUrl} rel="noreferrer" target="_blank">
                        NZLSG {type.rule}
                      </a>
                      . No bibliographic facts are fetched or invented.
                    </p>
                    {type.uncertainty && (
                      <p className="provenance-note">Note: {type.uncertainty}</p>
                    )}
                  </div>
                </div>
              </aside>
            </section>
          )}
        </section>

        <section className="footnote-section" aria-labelledby="footnote-heading">
          <div className="footnote-copy">
            <p className="eyebrow">Footnote composer</p>
            <h2 id="footnote-heading">More than one authority?</h2>
            <p>
              Add completed citations above. The composer applies semicolons,
              “and” before the final source, and one concluding full stop under
              rule 2.2.4.
            </p>
          </div>
          <div className="footnote-card">
            <div className="footnote-card-head">
              <span>Current footnote</span>
              <span>{footnoteEntries.length} authorities</span>
            </div>
            {footnoteResults.length ? (
              <>
                <ol className="authority-list">
                  {footnoteResults.map((item, index) => (
                    <li key={`${item.type.id}-${index}`}>
                      <div>
                        <span className="authority-number">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <p dangerouslySetInnerHTML={{ __html: item.html }} />
                      </div>
                      <button
                        aria-label={`Remove authority ${index + 1}`}
                        onClick={() =>
                          setFootnoteEntries((current) =>
                            current.filter((_, itemIndex) => itemIndex !== index),
                          )
                        }
                        type="button"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ol>
                <div className="composed-output">
                  <span>Composed result</span>
                  <p dangerouslySetInnerHTML={{ __html: footnote.html }} />
                </div>
                <div className="footnote-actions">
                  <button
                    className="primary-button"
                    onClick={() => handleCopy(footnote.text, footnote.html, true)}
                    type="button"
                  >
                    Copy footnote
                  </button>
                  <button
                    className="text-button danger"
                    onClick={() => setFootnoteEntries([])}
                    type="button"
                  >
                    Clear
                  </button>
                </div>
              </>
            ) : (
              <div className="footnote-empty">
                <span aria-hidden="true">+</span>
                <p>Completed authorities will collect here.</p>
              </div>
            )}
          </div>
        </section>

        <section className="coverage-section">
          <div>
            <p className="eyebrow">The whole guide, in code</p>
            <h2>Every format, verified against the Guide’s own examples.</h2>
          </div>
          <p>
            NZ Law Cite is built directly from the Style Guide: {guideTypes.length}{" "}
            source types spanning cases, legislation, parliamentary and official
            sources, secondary materials, and international and foreign authorities.
            The renderer is measured against the Guide’s own worked examples.
          </p>
        </section>
      </main>

      <footer>
        <div className="brand footer-brand">
          <span className="brand-mark" aria-hidden="true">
            NZ
          </span>
          <span>Law Cite</span>
        </div>
        <p>
          Independent study aid · NZLSG Third Edition · Your work stays on your
          device
        </p>
        <p className="disclaimer">
          Not affiliated with or endorsed by the New Zealand Law Foundation.
          Check any institution-specific requirements.
        </p>
      </footer>

      {copyStatus && (
        <div className="toast" role="status">
          {copyStatus}
        </div>
      )}
    </div>
  );
}

export default App;

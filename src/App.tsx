import { useEffect, useMemo, useState } from "react";
import {
  analyseCitation,
  buildCitation,
  composeFootnote,
  extractedFields,
  getVisibleFields,
  missingRequiredFields,
  prefillCitation,
  sourceTypeMap,
  sourceTypes,
  type CitationData,
  type CitationResult,
  type CitationSuggestion,
  type CitationTypeId,
  type FieldDefinition,
} from "./citationEngine";

type Mode = "paste" | "build";

const STORAGE_KEY = "nz-law-cite-footnote-v1";

const groupOrder = [
  "Secondary sources",
  "Cases & legislation",
  "Citation history",
] as const;

function navigatorMeta(): string {
  if (typeof navigator === "undefined") return "Ctrl";
  return /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent)
    ? "⌘"
    : "Ctrl";
}

function loadSavedFootnote(): CitationResult[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return [];
    const parsed = JSON.parse(saved) as CitationResult[];
    return Array.isArray(parsed)
      ? parsed.filter((item) => item.status === "ready" && Array.isArray(item.tokens))
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
  if (
    rich &&
    typeof ClipboardItem !== "undefined" &&
    navigator.clipboard?.write
  ) {
    const item = new ClipboardItem({
      "text/plain": new Blob([plainText], { type: "text/plain" }),
      "text/html": new Blob([html], { type: "text/html" }),
    });
    await navigator.clipboard.write([item]);
    return;
  }
  await navigator.clipboard.writeText(plainText);
}

function Field({
  field,
  data,
  onChange,
  flagMissing = false,
}: {
  field: FieldDefinition;
  data: CitationData;
  onChange: (field: string, value: string | boolean) => void;
  flagMissing?: boolean;
}) {
  const helpId = `${field.id}-help`;
  const current = data[field.id];
  const isEmpty = !(typeof current === "string" && current.trim());
  const needed = flagMissing && field.required === true && isEmpty;

  if (field.type === "checkbox") {
    return (
      <label className="check-field">
        <input
          checked={current === true}
          onChange={(event) => onChange(field.id, event.target.checked)}
          type="checkbox"
        />
        <span className="check-copy">
          <span className="field-label">{field.label}</span>
          {field.help && <span className="field-help">{field.help}</span>}
        </span>
      </label>
    );
  }

  return (
    <label className={needed ? "field field-needed" : "field"}>
      <span className="field-label">
        {field.label}
        {field.required && <span aria-hidden="true"> *</span>}
        {needed && <span className="needed-pill">Needed</span>}
      </span>
      {field.type === "select" ? (
        <select
          aria-describedby={field.help ? helpId : undefined}
          id={`input-${field.id}`}
          value={typeof current === "string" ? current : ""}
          onChange={(event) => onChange(field.id, event.target.value)}
        >
          <option value="">Choose one…</option>
          {field.options?.map((option) => (
            <option key={option.value || "empty"} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          aria-describedby={field.help ? helpId : undefined}
          autoComplete="off"
          id={`input-${field.id}`}
          placeholder={field.placeholder}
          type="text"
          value={typeof current === "string" ? current : ""}
          onChange={(event) => onChange(field.id, event.target.value)}
        />
      )}
      {field.help && (
        <span className="field-help" id={helpId}>
          {field.help}
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
  onSelect: (id: CitationTypeId) => void;
  query: string;
  setQuery: (value: string) => void;
}) {
  const filtered = sourceTypes.filter((sourceType) => {
    const haystack =
      `${sourceType.name} ${sourceType.description} ${sourceType.group}`.toLowerCase();
    return haystack.includes(query.toLowerCase().trim());
  });

  return (
    <section aria-labelledby="format-heading" className="type-picker">
      <div className="section-heading-row">
        <div>
          <p className="eyebrow">Verified formats</p>
          <h2 id="format-heading">What are you citing?</h2>
        </div>
        <span className="coverage-count">{sourceTypes.length} tested paths</span>
      </div>
      <label className="search-field">
        <span className="sr-only">Search citation formats</span>
        <span aria-hidden="true" className="search-symbol">
          /
        </span>
        <input
          placeholder="Search case, Act, journal, report…"
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
      {groupOrder.map((group) => {
        const items = filtered.filter((sourceType) => sourceType.group === group);
        if (!items.length) return null;
        return (
          <div className="type-group" key={group}>
            <h3>{group}</h3>
            <div className="type-grid">
              {items.map((sourceType) => (
                <button
                  className="type-card"
                  key={sourceType.id}
                  onClick={() => onSelect(sourceType.id)}
                  type="button"
                >
                  <span className="type-rule">Rule {sourceType.rule}</span>
                  <strong>{sourceType.name}</strong>
                  <span>{sourceType.description}</span>
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
          <strong>No verified format matches that search.</strong>
          <span>
            This version will not approximate an unsupported NZLSG source type.
          </span>
        </div>
      )}
    </section>
  );
}

function SuggestionCard({
  suggestion,
  onSelect,
  isTop = false,
}: {
  suggestion: CitationSuggestion;
  onSelect: (id: CitationTypeId) => void;
  isTop?: boolean;
}) {
  const sourceType = sourceTypeMap[suggestion.type];
  return (
    <button
      className={isTop ? "suggestion-card suggestion-top" : "suggestion-card"}
      onClick={() => onSelect(suggestion.type)}
      type="button"
    >
      <span className={`confidence confidence-${suggestion.confidence}`}>
        {isTop
          ? "Top match · Enter"
          : suggestion.confidence === "high"
            ? "Strong match"
            : "Possible match"}
      </span>
      <strong>{sourceType.name}</strong>
      <span>{suggestion.reason}</span>
      <span className="review-link">Review fields →</span>
    </button>
  );
}

function App() {
  const [mode, setMode] = useState<Mode>("paste");
  const [pasteText, setPasteText] = useState("");
  const [suggestions, setSuggestions] = useState<CitationSuggestion[]>([]);
  const [analysisAttempted, setAnalysisAttempted] = useState(false);
  const [selectedType, setSelectedType] = useState<CitationTypeId | null>(null);
  const [data, setData] = useState<CitationData>({});
  const [reviewRequired, setReviewRequired] = useState(false);
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const [query, setQuery] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const [footnoteItems, setFootnoteItems] = useState<CitationResult[]>(() =>
    loadSavedFootnote(),
  );

  const definition = selectedType ? sourceTypeMap[selectedType] : null;
  const result = useMemo(
    () => (selectedType ? buildCitation(selectedType, data) : null),
    [selectedType, data],
  );
  const copyReady =
    result?.status === "ready" && (!reviewRequired || reviewConfirmed);
  const extracted = selectedType ? extractedFields(selectedType, data) : [];
  const missing = selectedType ? missingRequiredFields(selectedType, data) : [];
  const footnote = useMemo(
    () => composeFootnote(footnoteItems),
    [footnoteItems],
  );

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(footnoteItems));
  }, [footnoteItems]);

  useEffect(() => {
    if (!copyStatus) return;
    const timeout = window.setTimeout(() => setCopyStatus(""), 2200);
    return () => window.clearTimeout(timeout);
  }, [copyStatus]);

  const switchMode = (nextMode: Mode) => {
    setMode(nextMode);
    setSelectedType(null);
    setData({});
    setSuggestions([]);
    setAnalysisAttempted(false);
    setReviewRequired(false);
    setReviewConfirmed(false);
  };

  const selectType = (id: CitationTypeId, fromPaste = mode === "paste") => {
    setSelectedType(id);
    const prefilled = fromPaste ? prefillCitation(id, pasteText) : {};
    setData(prefilled);
    setReviewRequired(fromPaste);
    setReviewConfirmed(false);
    const missing = missingRequiredFields(id, prefilled);
    const focusId = missing[0]
      ? `input-${missing[0].id}`
      : getVisibleFields(sourceTypeMap[id], prefilled)[0]
        ? `input-${getVisibleFields(sourceTypeMap[id], prefilled)[0].id}`
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

  // Live detection: suggestions update as the reference is typed or pasted, so
  // there is nothing to click before choosing a format.
  useEffect(() => {
    if (mode !== "paste" || selectedType) return;
    const trimmed = pasteText.trim();
    if (!trimmed) {
      setSuggestions([]);
      setAnalysisAttempted(false);
      return;
    }
    const handle = window.setTimeout(() => {
      setSuggestions(analyseCitation(pasteText));
      setAnalysisAttempted(true);
    }, 220);
    return () => window.clearTimeout(handle);
  }, [pasteText, mode, selectedType]);

  const updateField = (field: string, nextValue: string | boolean) => {
    setData((current) => ({ ...current, [field]: nextValue }));
    setReviewConfirmed(false);
  };

  const handleCopy = async (
    plainText: string,
    html: string,
    rich: boolean,
  ) => {
    try {
      await copyCitation(plainText, html, rich);
      setCopyStatus(rich ? "Formatted citation copied" : "Plain text copied");
    } catch {
      setCopyStatus("Copy was blocked — select the citation manually");
    }
  };

  const goBack = () => {
    setSelectedType(null);
    setData({});
    setReviewConfirmed(false);
    setReviewRequired(false);
  };

  // Keyboard accelerators inside the builder: Cmd/Ctrl+Enter copies a ready
  // citation, Escape steps back to the chooser.
  useEffect(() => {
    if (!selectedType) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        goBack();
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        if (result?.status === "ready" && (!reviewRequired || reviewConfirmed)) {
          event.preventDefault();
          void handleCopy(result.text, result.html, true);
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedType, result, reviewRequired, reviewConfirmed]);

  const addToFootnote = () => {
    if (!result || !copyReady) return;
    setFootnoteItems((current) => [...current, result]);
    setCopyStatus("Added to footnote");
  };

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
              Paste what you have or build from the source details. NZ Law Cite
              checks each required fact before it lets you copy.
            </p>
          </div>
          <aside className="trust-card">
            <span className="trust-number">01</span>
            <div>
              <strong>Fail-closed by design</strong>
              <p>
                Missing fact? Ambiguous rule? You will see a question—not a
                confident-looking guess.
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
                <h2 id="paste-heading">Paste the reference exactly as you found it.</h2>
                <p>
                  Detection only suggests a format. You will always review the
                  source type and every extracted field before copying.
                </p>
              </div>
              <label className="paste-box">
                <span className="sr-only">Citation text to check</span>
                <textarea
                  placeholder={'Burrows “Liability for Psychiatric Illness…” (1995) 3 Tort L Rev 220'}
                  value={pasteText}
                  onChange={(event) => setPasteText(event.target.value)}
                  onKeyDown={(event) => {
                    if (
                      event.key === "Enter" &&
                      !event.shiftKey &&
                      suggestions.length > 0
                    ) {
                      event.preventDefault();
                      selectType(suggestions[0].type, true);
                    }
                  }}
                />
                <div className="paste-actions">
                  <span>
                    {suggestions.length > 0
                      ? "Detected live · press Enter to use the top match"
                      : `${pasteText.length} characters`}
                  </span>
                  <button
                    className="primary-button"
                    disabled={suggestions.length === 0}
                    onClick={() => selectType(suggestions[0].type, true)}
                    type="button"
                  >
                    {suggestions.length > 0
                      ? `Use ${sourceTypeMap[suggestions[0].type].shortName} →`
                      : "Waiting for a reference"}
                  </button>
                </div>
              </label>

              {suggestions.length > 0 && (
                <div className="suggestions" aria-live="polite">
                  <div className="result-heading">
                    <div>
                      <span className="step-pill">Next</span>
                      <h3>Confirm the source type</h3>
                    </div>
                    <span className="safe-note">No output generated yet</span>
                  </div>
                  <div className="suggestion-grid">
                    {suggestions.map((suggestion, index) => (
                      <SuggestionCard
                        isTop={index === 0}
                        key={suggestion.type}
                        suggestion={suggestion}
                        onSelect={(id) => selectType(id, true)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {analysisAttempted && suggestions.length === 0 && (
                <div className="no-match" role="status">
                  <strong>That structure is not safe to identify automatically.</strong>
                  <span>
                    Choose a verified format and enter the details instead.
                  </span>
                  <button
                    className="text-button"
                    onClick={() => switchMode("build")}
                    type="button"
                  >
                    Choose a format →
                  </button>
                </div>
              )}
            </section>
          )}

          {mode === "build" && !selectedType && (
            <TypePicker onSelect={(id) => selectType(id, false)} query={query} setQuery={setQuery} />
          )}

          {definition && result && (
            <section className="builder" id="citation-form">
              <div className="form-column">
                <button
                  className="back-button"
                  onClick={goBack}
                  type="button"
                >
                  ← {mode === "paste" ? "Back to detection" : "Choose another format"}
                </button>
                <div className="form-heading">
                  <div>
                    <p className="eyebrow">Rule {definition.rule}</p>
                    <h2>{definition.name}</h2>
                    <p>{definition.description}</p>
                  </div>
                  <a href={definition.ruleUrl} rel="noreferrer" target="_blank">
                    Read rule ↗
                  </a>
                </div>

                {reviewRequired && (
                  <div className="review-banner extraction-summary">
                    <strong>
                      {extracted.length > 0
                        ? `${extracted.length} ${
                            extracted.length === 1 ? "detail" : "details"
                          } read from your reference`
                        : "No details could be read automatically"}
                    </strong>
                    {missing.length > 0 ? (
                      <span>
                        Still needed before a citation is generated:{" "}
                        <strong className="needed-list">
                          {missing.map((field) => field.label).join(", ")}
                        </strong>
                        . Check every field against the source.
                      </span>
                    ) : (
                      <span>
                        Every required field was found. Check each one against
                        the source, then confirm below.
                      </span>
                    )}
                  </div>
                )}

                <div className="field-grid">
                  {getVisibleFields(definition, data).map((field) => (
                    <Field
                      data={data}
                      field={field}
                      flagMissing={reviewRequired}
                      key={field.id}
                      onChange={updateField}
                    />
                  ))}
                </div>

                {reviewRequired && (
                  <label className="confirmation-box">
                    <input
                      checked={reviewConfirmed}
                      onChange={(event) => setReviewConfirmed(event.target.checked)}
                      type="checkbox"
                    />
                    <span>
                      <strong>I checked these details against the source.</strong>
                      <small>
                        Required before copying anything derived from pasted text.
                      </small>
                    </span>
                  </label>
                )}
              </div>

              <aside className="result-column" aria-live="polite">
                <div className="result-card">
                  <div className="result-card-head">
                    <span
                      className={`result-status ${
                        copyReady ? "ready" : "waiting"
                      }`}
                    >
                      <span aria-hidden="true" />
                      {copyReady ? "Ready to copy" : "Waiting for details"}
                    </span>
                    <span>NZLSG {definition.rule}</span>
                  </div>

                  <div className={`citation-preview ${copyReady ? "" : "muted"}`}>
                    {result.status === "ready" ? (
                      <p dangerouslySetInnerHTML={{ __html: result.html }} />
                    ) : (
                      <p className="placeholder-copy">
                        Your citation will appear only after every required
                        detail is complete.
                      </p>
                    )}
                  </div>

                  <div className="issues">
                    {result.issues.map((issue, index) => (
                      <div className={`issue issue-${issue.level}`} key={`${issue.field}-${index}`}>
                        <span aria-hidden="true">{issue.level === "error" ? "!" : "i"}</span>
                        <p>{issue.message}</p>
                      </div>
                    ))}
                    {result.status === "ready" &&
                      reviewRequired &&
                      !reviewConfirmed && (
                        <div className="issue issue-error">
                          <span aria-hidden="true">!</span>
                          <p>Confirm that you checked the extracted details.</p>
                        </div>
                      )}
                    {copyReady && !result.issues.length && (
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
                      onClick={() =>
                        handleCopy(result.text, result.html, true)
                      }
                      type="button"
                    >
                      Copy formatted
                    </button>
                    <button
                      className="secondary-button"
                      disabled={!copyReady}
                      onClick={() =>
                        handleCopy(result.text, result.html, false)
                      }
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
                      Tip: press{" "}
                      <kbd>{navigatorMeta()}</kbd>
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
                      <a href={definition.ruleUrl} rel="noreferrer" target="_blank">
                        NZLSG {definition.rule}
                      </a>
                      . No bibliographic facts are fetched or invented.
                    </p>
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
              <span>{footnoteItems.length} authorities</span>
            </div>
            {footnoteItems.length ? (
              <>
                <ol className="authority-list">
                  {footnoteItems.map((item, index) => (
                    <li key={`${item.type}-${index}`}>
                      <div>
                        <span className="authority-number">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <p dangerouslySetInnerHTML={{ __html: item.html }} />
                      </div>
                      <button
                        aria-label={`Remove authority ${index + 1}`}
                        onClick={() =>
                          setFootnoteItems((current) =>
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
                    onClick={() => setFootnoteItems([])}
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
            <p className="eyebrow">Accuracy before breadth</p>
            <h2>Unsupported means unsupported.</h2>
          </div>
          <p>
            This release covers the ten highest-use rule paths shown above.
            Remaining official, foreign, historical, and international formats
            are added only after their renderer and edge cases pass the same
            release gate.
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

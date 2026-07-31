/**
 * Four worked examples the Guide prints that our templates could not express.
 *
 * Found by `scripts/render-coverage.ts`, which reported 73 of the Guide's 216
 * worked examples with no hand-written field set. Writing those field sets by
 * hand turned four of them into citations that simply could not be built — not
 * a reading problem, a missing form.
 *
 *   3.4.7    Wellington International Airport … 1 June 2011 (Minute No 17) at [2].
 *   6.3.7    … McGechan on Procedure (looseleaf ed, Brookers, updated to 10 July 2009) …
 *   10.5.3(a) Adyan v Armenia ECHR 75604/11, 12 October 2017.
 *   2.1.2    At 535.
 *
 * Each is added as a component or an alternate form rather than by widening an
 * existing one, so a citation that does not use it is unaffected. Per-form
 * validation (`requiredForChosenForm` in build.ts) is what makes an alternate
 * form safe to add: a form asks only for the slots it actually has.
 *
 * Read off <https://lawfoundation.org.nz/style-guide2019/>.
 */
import { readFileSync, writeFileSync } from "node:fs";

const path = new URL("../src/data/styleGuide.json", import.meta.url);
const data = JSON.parse(readFileSync(path, "utf8"));
const byId = (id) => {
  const t = data.types.find((x) => x.id === id);
  if (!t) throw new Error(`${id} not found`);
  return t;
};

const addComponent = (type, component) => {
  if (type.components.some((c) => c.id === component.id)) return;
  type.components.push({
    label: component.label,
    required: false,
    italic: false,
    order: type.components.length + 1,
    separatorBefore: component.separatorBefore ?? "space",
    includedWhen: component.includedWhen ?? "",
    omittedWhen: component.omittedWhen ?? "omit when not applicable",
    formatting: component.formatting ?? "",
    notes: component.notes ?? "",
    id: component.id,
  });
};

// ---------------------------------------------------------------- 3.4.7
// A High Court minute is identified by number after the date of judgment.
const unreported = byId("unreported-case-file-number-nz");
addComponent(unreported, {
  id: "minute",
  label: "Minute number",
  separatorBefore: "space",
  includedWhen: "included where the judgment cited is a numbered minute",
  omittedWhen: "omit for an ordinary judgment",
  formatting: "'Minute No N' in round brackets",
  notes: "3.4.7",
});
unreported.outputTemplate =
  "*{caseName}* {courtAbbreviation} {registry} {fileNumber}, {dateOfJudgment} ({minute}) at {pinpoint}";

// ---------------------------------------------------------------- 6.3.7
// A looseleaf service is dated inside the publication parenthesis. The type
// already carried `serviceUpdate`; no form had a slot for it.
const looseleaf = byId("looseleaf-online-commentary");
looseleaf.outputTemplate = [
  "{editor} (ed) {title} ({edition}, {publisher}, {serviceUpdate}) at {pinpoint}",
  "{title} ({edition}, {publisher}, {serviceUpdate}) at {pinpoint}",
].join(" | ");

// ------------------------------------------------------------- 10.5.3(a)
// An unreported Strasbourg judgment: court identifier, application number and
// date, with the court in FRONT and no brackets.
const echr = byId("echr-case");
addComponent(echr, {
  id: "applicationNumber",
  label: "Application number",
  separatorBefore: "space",
  includedWhen: "included for an unreported judgment",
  omittedWhen: "omit where the judgment is reported",
  formatting: "application number as the Court gives it, e.g. '75604/11'",
  notes: "10.5.3(a)",
});
addComponent(echr, {
  id: "date",
  label: "Date of judgment",
  separatorBefore: "', '",
  includedWhen: "included for an unreported judgment",
  omittedWhen: "omit where the judgment is reported",
  formatting: "day month year",
  notes: "10.5.3(a)",
});
echr.outputTemplate = [
  "*{caseName}* {year} {volume} {reportSeries} {page} ({courtIdentifier}) at {pinpoint}",
  "*{caseName}* {courtIdentifier} {applicationNumber}, {date}",
].join(" | ");

// ---------------------------------------------------------------- 2.1.2
// Where the immediately preceding footnote cites the same source, the whole
// reference is the pinpoint, capitalised: "At 535."
const subsequent = byId("subsequent-references");
subsequent.outputTemplate = [
  "{identifier}, above n {footnoteNumber}, at {pinpoint}",
  "{identifier}, {pinpoint}",
  "At {pinpoint}",
].join(" | ");

writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
console.log("added: 3.4.7 minute, 6.3.7 service update, 10.5.3(a) unreported, 2.1.2 bare pinpoint");

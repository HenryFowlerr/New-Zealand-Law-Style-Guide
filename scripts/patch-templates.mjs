/**
 * Surgical corrections to a few templates whose source used an ad-hoc
 * "[optional]" / hard-coded notation the renderer cannot interpret. Each is
 * replaced with proper optional {placeholders}, and missing components added.
 * Idempotent: safe to re-run.
 */
import { readFileSync, writeFileSync } from "node:fs";

const path = "src/data/styleGuide.json";
const data = JSON.parse(readFileSync(path, "utf8"));
const byId = Object.fromEntries(data.types.map((t) => [t.id, t]));

const opt = (id, label) => ({
  id, label, required: false, italic: false, order: 99,
  separatorBefore: "", includedWhen: "when present", omittedWhen: "if absent",
  formatting: "", notes: "template correction",
});
const ensure = (t, id, label) => {
  if (!t.components.some((c) => c.id === id)) t.components.push(opt(id, label));
};

// UK modern statute: jurisdiction is a placeholder, not a literal "(UK)".
byId["uk-modern-statute"].outputTemplate = "{shortTitle} {year} ({jurisdiction}), {pinpoint}";

// Laws of New Zealand: reissue + online ed are optional bracketed placeholders.
byId["laws-of-new-zealand"].outputTemplate =
  "{author} {title} {topic} ({reissue}) ({onlineEd}) at {pinpoint}";
ensure(byId["laws-of-new-zealand"], "reissue", "Reissue");

// Legal encyclopaedia: online ed is an optional placeholder inside the brackets.
byId["legal-encyclopaedia"].outputTemplate =
  "{title} ({edition}, {reissue}, {year}, {onlineEd}) vol {volume} {topic} at {pinpoint}";
ensure(byId["legal-encyclopaedia"], "onlineEd", "Online edition");

// Newspaper: online ed is an optional placeholder; masthead is italic.
byId["newspaper-magazine-article"].outputTemplate =
  "{author} “{articleTitle}” *{newspaperTitle}* ({onlineEd}, {place}, {date}) at {pinpoint}";

writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
console.log("patched templates");

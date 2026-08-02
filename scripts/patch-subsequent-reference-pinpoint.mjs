/**
 * Rule 2.3 requires a PINPOINT. Without one there is no subsequent reference.
 *
 * A subsequent reference exists to send the reader to a place in a source
 * already cited. All three of the rule's forms carry the pinpoint —
 *
 *   {identifier}, above n {footnoteNumber}, at {pinpoint}
 *   {identifier}, {pinpoint}
 *   At {pinpoint}
 *
 * — and every one of the Guide's five worked examples has one: "At 535.",
 * "R v Wang, above n 49, at 533.", "Securities Act, s 63." A reference with no
 * pinpoint at all is not this rule; it is the full citation, under its own rule.
 *
 * The ingested data marked only `identifier` required, which left the type as a
 * catch-all: its template is close to the identity function, so ANY run of
 * words filled its one required box and came back as a finished citation.
 * A student who typed a half-remembered author's name got
 *
 *   Andrew Burrows.
 *   394.
 *   Burrows The Law of Restitution.
 *
 * each a complete citation under rule 2.3, each indistinguishable from a correct
 * one, and none of them a citation of anything. That is the single outcome this
 * project treats as unacceptable, so the requirement the rule already states is
 * written into the data.
 *
 * `identifier` is left as it is. It is genuinely absent from the "At {pinpoint}"
 * form, and `requiredForChosenForm` already asks only for what the chosen form
 * uses — so "At 535." is unaffected either way.
 */
import { readFileSync, writeFileSync } from "node:fs";

const path = new URL("../src/data/styleGuide.json", import.meta.url);
const data = JSON.parse(readFileSync(path, "utf8"));

const type = data.types.find((t) => t.id === "subsequent-references");
if (!type) throw new Error("subsequent-references is missing from the data");

const pinpoint = type.components.find((c) => c.id === "pinpoint");
if (!pinpoint) throw new Error("rule 2.3 has no pinpoint component to require");

// Every form must actually contain the slot, or requiring it would refuse a
// citation the rule allows. Checked rather than assumed.
const forms = type.outputTemplate.split("|").map((f) => f.trim());
const without = forms.filter((f) => !f.includes("{pinpoint}"));
if (without.length) {
  throw new Error(`a form of rule 2.3 has no pinpoint, so it cannot be required:\n  ${without.join("\n  ")}`);
}

if (pinpoint.required) {
  console.log("rule 2.3's pinpoint is already required — nothing to do");
} else {
  pinpoint.required = true;
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
  console.log("rule 2.3's pinpoint is now required, as all three of its forms and all five of its examples show");
}

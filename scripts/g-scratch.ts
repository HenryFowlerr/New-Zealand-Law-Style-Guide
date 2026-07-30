import { guideTypeById } from "../src/data/styleGuide";
for (const id of ["bill-select-committee-report-explanatory-note","text-book","ebook-electronic-only"]) {
  const t=guideTypeById[id];
  console.log(`${t.id}\n   tpl ${t.outputTemplate}\n   req ${t.components.filter(c=>c.required).map(c=>c.id).join(", ")}`);
}

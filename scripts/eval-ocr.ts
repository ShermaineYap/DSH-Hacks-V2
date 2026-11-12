// OCR + parse accuracy on mock slips, using tesseract.js (the same engine the app runs in the browser).
import { readFileSync, writeFileSync } from "node:fs";
import Tesseract from "tesseract.js";
import { parseLabText } from "../src/lib/labparse.ts";
const gold = JSON.parse(readFileSync(`eval/${process.env.OUT ?? "slips"}/gold.json`, "utf8"));
const worker = await Tesseract.createWorker("eng");
await worker.setParameters({ tessedit_pageseg_mode: "6" as any });
const F = ["hct", "plt", "hb", "wcc"] as const;
const rows: any[] = [];
for (const g of gold) {
  const t0 = Date.now();
  const { data } = await worker.recognize(g.file);
  const p = parseLabText(data.text);
  const res: any = { file: g.file, condition: g.condition, layout: g.layout, ms: Date.now() - t0 };
  for (const f of F) {
    const want = g[f], got = (p as any)[f];
    res[f] = got == null ? "missing" : Math.abs(got - want) < 0.051 * (f === "plt" ? 1 : 1) || (f === "plt" && got === Math.round(want)) ? "ok" : `wrong(${got} vs ${want})`;
  }
  rows.push(res);
}
await worker.terminate();
const summary: any = {};
for (const cond of ["clean", "photo", "dim", "all"]) {
  const r = rows.filter((x) => cond === "all" || x.condition === cond);
  const s: any = { n: r.length };
  for (const f of F) {
    s[f + "_ok"] = r.filter((x) => x[f] === "ok").length;
    s[f + "_missing"] = r.filter((x) => x[f] === "missing").length;
    s[f + "_wrong"] = r.filter((x) => x[f].startsWith("wrong")).length;
  }
  const crit = r.filter((x) => x.hct === "ok" && x.plt === "ok").length;
  s.hct_and_plt_both_ok = crit;
  s.silent_wrong_hct_or_plt = r.filter((x) => x.hct.startsWith("wrong") || x.plt.startsWith("wrong")).length;
  summary[cond] = s;
}
summary.median_ms = rows.map((r) => r.ms).sort((a, b) => a - b)[Math.floor(rows.length / 2)];
console.log(JSON.stringify(summary, null, 1));
for (const r of rows) if (F.some((f) => r[f] !== "ok")) console.log(r.file, F.map((f) => `${f}:${r[f]}`).join(" "));
writeFileSync(`eval/results/ocr_${process.env.OUT ?? "slips"}.json`, JSON.stringify({ summary, rows }, null, 1));

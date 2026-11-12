// Score the deployed Gemini paths on the held-out sets. One request per item, throttled for the free tier.
// Usage: node --experimental-strip-types scripts/eval-live.ts <baseUrl> <symptoms|slips>
import { readFileSync, writeFileSync } from "node:fs";
const base = process.argv[2], what = process.argv[3];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function retry<T>(fn: () => Promise<T>, ok: (x: T) => boolean): Promise<T> {
  let last: T | undefined;
  for (let i = 0; i < 4; i++) { last = await fn(); if (ok(last)) return last; await sleep(8000 * (i + 1)); }
  return last!;
}
if (what === "symptoms") {
  const all = JSON.parse(readFileSync("eval/symptom_messages.json", "utf8"));
  const h = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const items = all.filter((x: any) => h(x.id) % 2 !== 0); // test split, same as eval-symptoms.ts
  const KEYS = ["abdominal_pain","persistent_vomiting","persistent_diarrhoea","bleeding","lethargy","poor_oral_intake","low_urine","breathless","cold_clammy","fainting","seizure"];
  const modes: Record<string, any> = { lexicon: { tp: 0, fp: 0, fn: 0, exact: 0, errs: [] }, llm: { tp: 0, fp: 0, fn: 0, exact: 0, errs: [] }, union: { tp: 0, fp: 0, fn: 0, exact: 0, errs: [] } };
  const ms: number[] = []; let model = ""; let failures = 0;
  for (const it of items) {
    const j: any = await retry(async () => (await fetch(base + "/api/extract", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: it.text }) })).json(), (x: any) => !!x.llm);
    if (!j.llm) { failures++; console.log("LLM FAIL", it.id, j.llmError); }
    else { ms.push(j.llm.ms); model = j.llm.model; }
    const preds: Record<string, string[]> = { lexicon: j.lexicon.signs, llm: j.llm?.signs ?? [], union: j.signs };
    for (const [m, pred] of Object.entries(preds)) {
      const g = new Set(it.labels), p = new Set(pred); let ok = true;
      for (const k of KEYS) { if (g.has(k) && p.has(k)) modes[m].tp++; else if (p.has(k)) { modes[m].fp++; ok = false; } else if (g.has(k)) { modes[m].fn++; ok = false; } }
      if (ok) modes[m].exact++; else modes[m].errs.push({ id: it.id, text: it.text, gold: it.labels, pred });
    }
    await sleep(2500);
  }
  const out: any = { n: items.length, model, llm_failures: failures, llm_median_ms: ms.sort((a, b) => a - b)[Math.floor(ms.length / 2)] };
  for (const [m, s] of Object.entries(modes)) out[m] = { exact_match: +(s.exact / items.length).toFixed(3), micro_precision: +(s.tp / (s.tp + s.fp || 1)).toFixed(3), micro_recall: +(s.tp / (s.tp + s.fn || 1)).toFixed(3), missed_signs: s.fn, false_alarms: s.fp };
  console.log(JSON.stringify(out, null, 1));
  writeFileSync("eval/results/symptoms_test_live.json", JSON.stringify({ ...out, errors: Object.fromEntries(Object.entries(modes).map(([m, s]) => [m, s.errs])) }, null, 1));
} else {
  const gold = JSON.parse(readFileSync("eval/slips_test/gold.json", "utf8"));
  const rows: any[] = []; let model = "";
  for (const g of gold) {
    const fd = new FormData(); fd.append("image", new Blob([readFileSync(g.file)], { type: "image/jpeg" }), "slip.jpg");
    const j: any = await retry(async () => (await fetch(base + "/api/read-slip", { method: "POST", body: fd })).json(), (x: any) => !x.error);
    if (j.model) model = j.model;
    const r: any = { file: g.file, condition: g.condition, ms: j.ms, error: j.error };
    for (const f of ["hct", "plt", "hb", "wcc"]) { const got = j[f], want = g[f]; r[f] = got == null ? "missing" : Math.abs(got - want) < 0.051 || (f === "plt" && Math.round(got) === Math.round(want)) ? "ok" : `wrong(${got} vs ${want})`; }
    rows.push(r); await sleep(3000);
  }
  const summ: any = { model };
  for (const c of ["clean", "photo", "dim", "all"]) { const rr = rows.filter((x) => c === "all" || x.condition === c); summ[c] = { n: rr.length, both_ok: rr.filter((x) => x.hct === "ok" && x.plt === "ok").length, silent_wrong: rr.filter((x) => x.hct.startsWith("wrong") || x.plt.startsWith("wrong")).length, errors: rr.filter((x) => x.error).length }; }
  summ.median_ms = rows.map((r) => r.ms ?? 0).sort((a, b) => a - b)[Math.floor(rows.length / 2)];
  console.log(JSON.stringify(summ, null, 1));
  for (const r of rows) if (r.hct !== "ok" || r.plt !== "ok") console.log(JSON.stringify(r));
  writeFileSync("eval/results/ocr_vision_live.json", JSON.stringify({ summary: summ, rows }, null, 1));
}

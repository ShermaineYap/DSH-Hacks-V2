// Evaluate symptom extractors on the blind message set.
// Usage: node --experimental-strip-types scripts/eval-symptoms.ts <dev|test> [lexicon|llm|union] [baseUrl]
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { extractLexicon } from "../src/lib/lexicon.ts";

type Item = { id: string; lang: string; text: string; labels: string[] };
const all: Item[] = JSON.parse(readFileSync("eval/symptom_messages.json", "utf8"));
// deterministic split: hash of id
const h = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
const split = process.argv[2] ?? "dev";
const mode = process.argv[3] ?? "lexicon";
const base = process.argv[4];
const items = all.filter((x) => (h(x.id) % 2 === 0 ? "dev" : "test") === split);
const KEYS = ["abdominal_pain","persistent_vomiting","persistent_diarrhoea","bleeding","lethargy","poor_oral_intake","low_urine","breathless","cold_clammy","fainting","seizure"];

async function llm(text: string): Promise<string[]> {
  const r = await fetch(base + "/api/extract", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text, eval: true }) });
  const j = await r.json();
  if (!r.ok) throw new Error(JSON.stringify(j));
  return j.llm?.signs ?? [];
}

const tp: Record<string, number> = {}, fp: Record<string, number> = {}, fn: Record<string, number> = {};
let exact = 0; const errors: any[] = []; const lat: number[] = [];
for (const it of items) {
  let pred: string[] = [];
  const t0 = Date.now();
  if (mode === "lexicon" || mode === "union") pred = extractLexicon(it.text).signs;
  if (mode === "llm" || mode === "union") { const l = await llm(it.text); pred = mode === "llm" ? l : [...new Set([...pred, ...l])]; }
  lat.push(Date.now() - t0);
  const gold = new Set(it.labels), p = new Set(pred);
  let ok = true;
  for (const k of KEYS) {
    if (gold.has(k) && p.has(k)) tp[k] = (tp[k] ?? 0) + 1;
    else if (!gold.has(k) && p.has(k)) { fp[k] = (fp[k] ?? 0) + 1; ok = false; }
    else if (gold.has(k) && !p.has(k)) { fn[k] = (fn[k] ?? 0) + 1; ok = false; }
  }
  if (ok) exact++; else errors.push({ id: it.id, text: it.text, gold: it.labels, pred });
}
const sum = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0);
const TP = sum(tp), FP = sum(fp), FN = sum(fn);
const res = {
  split, mode, n: items.length,
  exact_match: +(exact / items.length).toFixed(3),
  micro_precision: +(TP / (TP + FP || 1)).toFixed(3),
  micro_recall: +(TP / (TP + FN || 1)).toFixed(3),
  missed_signs: FN, false_alarms: FP,
  per_sign: Object.fromEntries(KEYS.map((k) => [k, { tp: tp[k] ?? 0, fp: fp[k] ?? 0, fn: fn[k] ?? 0 }])),
  median_ms: lat.sort((a, b) => a - b)[Math.floor(lat.length / 2)],
};
console.log(JSON.stringify({ ...res, per_sign: undefined }, null, 1));
for (const e of errors) console.log("ERR", e.id, JSON.stringify(e.text), "gold", e.gold, "pred", e.pred);
mkdirSync("eval/results", { recursive: true });
writeFileSync(`eval/results/symptoms_${split}_${mode}.json`, JSON.stringify({ ...res, errors }, null, 1));

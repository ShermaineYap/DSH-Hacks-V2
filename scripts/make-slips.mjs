// Render mock Malaysian FBC slips (fictional facilities) as clean scans and as phone-photo-like images.
import { createRequire } from "node:module";
const req = createRequire(import.meta.url);
let pw; try { pw = req("playwright"); } catch { pw = req(process.env.PLAYWRIGHT_PATH ?? "/opt/npm-tools/node_modules/playwright/index.js"); }
const { chromium } = pw;
import { writeFileSync } from "node:fs";
let seed = Number(process.env.SEED ?? 42); const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const pick = (a) => a[Math.floor(rnd() * a.length)];
const facilities = ["KLINIK KESIHATAN TAMAN MELATI", "KLINIK KESIHATAN BANDAR BARU", "MAKMAL SIHAT DIAGNOSTIK", "POLIKLINIK SERI MAJU", "KLINIK KESIHATAN SUNGAI ARA"];
const names = ["AISYAH BINTI RAHMAN", "TAN WEI LING", "RAJESH A/L KUMAR", "NUR FARAH BT ISMAIL", "LIM KAH HOE", "SITI AMINAH BT YUSOF", "MUHAMMAD HAKIM", "PRIYA D/O SURESH", "WONG MEI CHEN", "AHMAD FAIZ"];
function vals() {
  const hct = +(34 + rnd() * 18).toFixed(1), hb = +(hct / 3 + (rnd() - 0.5)).toFixed(1);
  const wcc = +(1.8 + rnd() * 6).toFixed(1), plt = Math.round(20 + rnd() * 230);
  return { hct, hb, wcc, plt };
}
function layout(kind, v, f, n, date) {
  const style = `font-family:${kind === 2 ? "'DejaVu Sans Mono',monospace" : "'DejaVu Sans',Arial,sans-serif"};font-size:${kind === 1 ? 15 : 17}px;color:#111;`;
  const rows = kind === 0
    ? [["HAEMOGLOBIN", v.hb, "g/dL", "12.0 - 15.0"], ["HAEMATOCRIT (PCV)", v.hct, "%", "36 - 46"], ["WHITE BLOOD CELL", v.wcc, "x10^9/L", "4.0 - 10.0"], ["RED BLOOD CELL", (v.hb / 2.9).toFixed(2), "x10^12/L", "3.8 - 4.8"], ["MCV", 86.2, "fL", "80 - 100"], ["MCHC", 33.4, "g/dL", "31.5 - 34.5"], ["PLATELET", v.plt, "x10^9/L", "150 - 410"]]
    : kind === 1
    ? [["Hb", v.hb, "g/dL", ""], ["Hct", v.hct, "%", ""], ["WBC", v.wcc, "10^3/uL", ""], ["PLT", v.plt, "10^3/uL", ""]]
    : [["HGB", v.hb, "g/dL", "L"], ["PCV", (v.hct / 100).toFixed(3), "L/L", ""], ["TWC", v.wcc, "x10^9/L", "L"], ["PLATELETS", v.plt * 1000, "/uL", "L"]];
  return `<div style="${style}width:640px;padding:28px 34px;background:#fbfaf6">
  <div style="font-weight:700;font-size:20px;text-align:center">${f}</div>
  <div style="text-align:center;margin-bottom:10px">${kind === 1 ? "Dengue FBC Monitoring" : "FULL BLOOD COUNT REPORT"}</div>
  <div>Nama / Name: ${n}</div><div>Tarikh / Date: ${date}</div><div>No. Rujukan: KK${Math.floor(rnd() * 90000 + 10000)}</div>
  <table style="margin-top:12px;border-collapse:collapse;width:100%">${rows.map((r) => `<tr>${r.map((c) => `<td style="padding:4px 6px;border-bottom:1px solid #ccc">${c}</td>`).join("")}</tr>`).join("")}</table>
  <div style="margin-top:14px;font-size:12px">Disahkan oleh: Juruteknologi Makmal</div></div>`;
}
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
const gold = [];
for (let i = 0; i < 10; i++) {
  const v = vals(), kind = i % 3, f = pick(facilities), n = names[i], date = `${String(3 + (i % 5)).padStart(2, "0")}/11/2026`;
  const html = layout(kind, v, f, n, date);
  const conds = [
    { id: "clean", css: "" },
    { id: "photo", css: `transform:rotate(${(rnd() * 4 - 2).toFixed(1)}deg);filter:blur(0.8px) brightness(0.92) contrast(0.9);box-shadow:inset ${Math.round(rnd()*200)}px 0 120px rgba(0,0,0,.25)` },
    { id: "dim", css: `transform:rotate(${(rnd() * 6 - 3).toFixed(1)}deg) scale(0.8);filter:blur(1.3px) brightness(0.72) contrast(0.8) sepia(0.3)` },
  ];
  for (const c of conds) {
    await page.setContent(`<body style="margin:0;background:#6b6257;display:flex;align-items:center;justify-content:center;height:900px"><div style="${c.css}">${html}</div></body>`);
    const file = `eval/${process.env.OUT ?? "slips"}/slip${String(i).padStart(2, "0")}_${c.id}.jpg`;
    await page.screenshot({ path: file, type: "jpeg", quality: c.id === "clean" ? 92 : 60 });
    gold.push({ file, condition: c.id, layout: kind, hct: v.hct, plt: v.plt, hb: v.hb, wcc: v.wcc });
  }
}
writeFileSync(`eval/${process.env.OUT ?? "slips"}/gold.json`, JSON.stringify(gold, null, 1));
await browser.close();
console.log(gold.length, "slips");

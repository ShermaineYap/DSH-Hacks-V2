import { createRequire } from "node:module";
const req = createRequire(import.meta.url);
let pw; try { pw = req("playwright"); } catch { pw = req(process.env.PLAYWRIGHT_PATH ?? "/opt/npm-tools/node_modules/playwright/index.js"); }
const b = await pw.chromium.launch(); const p = await b.newPage({ viewport: { width: 1000, height: 1100 } });
const rows = [["HAEMOGLOBIN","14.6","g/dL","12.0 - 15.0"],["HAEMATOCRIT (PCV)","44.0","%","36 - 46"],["WHITE BLOOD CELL","2.6","x10^9/L","4.0 - 10.0"],["RED BLOOD CELL","5.02","x10^12/L","3.8 - 4.8"],["MCV","87.6","fL","80 - 100"],["MCHC","33.2","g/dL","31.5 - 34.5"],["PLATELET","71","x10^9/L","150 - 410"]];
await p.setContent(`<body style="margin:0;background:radial-gradient(circle at 30% 20%,#8a7f70,#4e463d);display:flex;align-items:center;justify-content:center;height:1100px"><div style="transform:rotate(-2.2deg);box-shadow:0 18px 40px rgba(0,0,0,.45);filter:brightness(.96) contrast(.95)"><div style="font-family:'DejaVu Sans',Arial;font-size:19px;color:#151515;width:720px;padding:34px 40px;background:linear-gradient(180deg,#fdfcf8,#f1eee6)">
<div style="font-weight:700;font-size:23px;text-align:center">KLINIK KESIHATAN TAMAN MELATI</div><div style="text-align:center;font-size:15px">(Contoh / Sample – fictional facility)</div>
<div style="text-align:center;margin:8px 0 14px">FULL BLOOD COUNT REPORT</div>
<div>Nama / Name: AISYAH (DEMO)</div><div>Tarikh / Date: 05/11/2026</div><div>No. Rujukan: KK48213</div>
<table style="margin-top:14px;border-collapse:collapse;width:100%">${rows.map(r=>`<tr>${r.map(c=>`<td style="padding:5px 6px;border-bottom:1px solid #c9c4b8">${c}</td>`).join("")}</tr>`).join("")}</table>
<div style="margin-top:16px;font-size:13px">Disahkan oleh: Juruteknologi Makmal</div></div></div></body>`);
await p.screenshot({ path: "public/sample-slip.jpg", type: "jpeg", quality: 80 }); await b.close(); console.log("ok");

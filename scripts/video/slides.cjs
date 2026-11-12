const { chromium } = require("/opt/npm-tools/node_modules/playwright");
const fs = require("fs");
const ev = JSON.parse(fs.readFileSync(process.argv[2] || "ev.json", "utf8"));
const only = process.argv[3];
const FONT = `<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">`;
const CSS = `*{box-sizing:border-box;margin:0}body{width:1920px;height:1080px;background:#f5f7fb;color:#1f2a5a;font-family:'Plus Jakarta Sans',sans-serif;font-feature-settings:"tnum" 1;overflow:hidden;position:relative}
.wm{position:absolute;left:120px;top:84px;font-size:40px;font-weight:800;letter-spacing:-.03em}
h1{font-size:84px;font-weight:800;letter-spacing:-.03em;line-height:1.05}
h2{font-size:58px;font-weight:800;letter-spacing:-.025em;line-height:1.1}
p{font-size:34px;line-height:1.45;color:#4a5585}
.src{position:absolute;left:120px;bottom:60px;font-size:22px;color:#7c86ad}
.red{color:#c2352b}.teal{color:#17766a}`;
const page = (body) => `<!doctype html><html><head><meta charset="utf-8">${FONT}<style>${CSS}</style></head><body>${body}</body></html>`;
const PHONE = { x: 250, y: 46, w: 458, h: 988 }; // screen slot (scaled 390x844)
const panel = (h, body) => page(`
<div style="position:absolute;left:${PHONE.x - 16}px;top:${PHONE.y - 16}px;width:${PHONE.w + 32}px;height:${PHONE.h + 32}px;border-radius:56px;background:#1f2a5a;box-shadow:0 30px 70px rgba(31,42,90,.28)"></div>
<div style="position:absolute;left:880px;top:0;width:900px;height:1080px;display:flex;flex-direction:column;justify-content:center">
<div style="font-size:30px;font-weight:800;margin-bottom:36px">Fasa</div><h2>${h}</h2><p style="margin-top:28px">${body}</p></div>`);
const S = {
  s1: page(`<div class="wm">Fasa</div><div style="position:absolute;left:120px;top:260px;width:1600px">
    <h1 style="font-size:150px">79,686</h1><p style="font-size:46px;color:#1f2a5a;font-weight:600;margin-top:10px">dengue cases in Malaysia this year, to 31 October.</p>
    <p style="font-size:40px;margin-top:56px;width:1300px">Most are sent home from a clinic. The critical phase usually starts after day 3, often as the fever comes down.</p></div>
    <div class="src">Cases: outbreak.my, aggregating MOH weekly data (31 Oct 2026). Critical phase: MOH CPG Management of Dengue Infection in Adults, 3rd ed. (2015).</div>`),
  s2: page(`<div class="wm">Fasa</div><div style="position:absolute;left:120px;top:250px;width:760px">
    <h2>What the guideline asks of a patient at home</h2>
    <p style="margin-top:40px;color:#1f2a5a"><b>Daily clinic review</b> from day 3 of illness.</p>
    <p style="margin-top:18px;color:#1f2a5a"><b>8 warning signs</b>, including abdominal pain, vomiting more than 3 times a day, bleeding, lethargy, and raised HCT with falling platelets.</p>
    <p style="margin-top:18px">The paper record they take home has columns for blood counts, but no space for symptoms.</p></div>
    <img src="file://${process.cwd()}/mohform.png" style="position:absolute;right:110px;top:250px;width:900px;border-radius:12px;box-shadow:0 20px 50px rgba(31,42,90,.18);transform:rotate(1.5deg)">
    <div class="src">MOH CPG Dengue (2015): Table 2, Table 3, Appendix 7 (Outpatient Dengue Monitoring Record, shown).</div>`),
  s3: panel("Day by day, from the first day of fever", "The critical days, 3 to 7, are shaded. Even a green day says when the next blood test is due."),
  s4: panel("Write it the way you’d say it", "Malay, English or both. Gemini finds the guideline’s warning signs and on-device rules run alongside. The results are combined, so the model can add a sign but never remove one."),
  s5: panel("Every number is checked before it counts", "Gemini vision reads the slip and shows the printed text beside each value. A big jump from yesterday is flagged for a second look."),
  s6: panel("The rules decide, and say why", "HCT 44% is over the 40% line for women while platelets fall from 104 to 71, with three warning signs. Each reason names the guideline table it comes from."),
  s7: panel("A handover the clinic already recognises", "Laid out like the MOH monitoring record, plus the warning signs it leaves out. Bahasa Melayu and English throughout."),
  s8: page(`<div class="wm">Fasa</div><div style="position:absolute;left:120px;top:200px;width:1680px">
    <h2>Measured, on data the tuned parts never saw</h2>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:60px;margin-top:70px">
      <div><div style="font-size:96px;font-weight:800">${ev.rules}</div><p style="margin-top:8px">guideline test cases pass. The decision is code transcribed from the CPG, not a model.</p></div>
      <div><div style="font-size:96px;font-weight:800">${ev.sym}</div><p style="margin-top:8px">${ev.symText}</p></div>
      <div><div style="font-size:96px;font-weight:800">${ev.slip}</div><p style="margin-top:8px">${ev.slipText}</p></div>
    </div></div>
    <div class="src">${ev.src}</div>`),
  s9: page(`<div class="wm">Fasa</div><div style="position:absolute;left:120px;top:190px"><h2>The language model structures. The rules decide.</h2></div>
    <div style="position:absolute;left:120px;top:400px;width:1680px;display:grid;grid-template-columns:1fr 70px 1fr 70px 1fr 70px 1fr;align-items:center;font-size:28px;line-height:1.35">
      ${[["Message or slip photo", "typed, tapped or photographed"], ["Gemini + on-device rules", "find signs and numbers, union"], ["The person confirms", "every value, against the slip"], ["CPG rules engine", "deterministic TypeScript, tested"]]
        .map(([a, b], i) => `${i ? '<div style="text-align:center;font-size:44px;color:#7c86ad">›</div>' : ""}<div style="background:${i === 3 ? "#1f2a5a" : "#fff"};color:${i === 3 ? "#f5f7fb" : "#1f2a5a"};border:2px solid #dde2ef;border-radius:28px;padding:34px 30px;min-height:220px"><div style="font-weight:800;font-size:32px">${a}</div><div style="margin-top:12px;opacity:.8">${b}</div></div>`).join("")}
    </div>
    <p style="position:absolute;left:120px;top:720px;width:1500px">Next.js on Vercel. The record lives on the phone; only a message or photo the person chooses is sent to Google’s Gemini API to be read. Fasa’s server stores nothing.</p>`),
  s10: page(`<div style="position:absolute;left:120px;top:300px"><h1 style="font-size:160px">Fasa</h1><p style="font-size:48px;color:#1f2a5a;margin-top:10px">Know which day it is, and what to do about it.</p>
    <p style="margin-top:60px;font-size:32px">dsh-hacks-v2-jade.vercel.app · github.com/ShermaineYap/DSH-Hacks-V2</p>
    <p style="margin-top:16px;font-size:28px">Built by Shermaine Yap for DSH Hacks V2.</p></div>
    <div class="src">Narration is an AI-generated voice (Piper, Lessac). Fasa follows the MOH dengue guideline; it is not a medical device and does not replace a doctor.</div>`),
};
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  for (const [k, html] of Object.entries(S)) {
    if (only && only !== k) continue;
    fs.writeFileSync(`${k}.html`, html); await p.goto(`file://${process.cwd()}/${k}.html`); await p.waitForTimeout(700);
    await p.screenshot({ path: `${k}.png` });
  }
  await b.close(); console.log("slides done");
})();

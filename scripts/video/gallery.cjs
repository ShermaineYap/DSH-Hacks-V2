const { chromium, devices } = require("/opt/npm-tools/node_modules/playwright");
const fs = require("fs");
const BASE = "https://dsh-hacks-v2-jade.vercel.app", OUT = "/home/claude/dsh-hacks-v2/submission/gallery";
const yOf = (p, s) => p.evaluate((x) => document.querySelector(x).getBoundingClientRect().top + window.scrollY - 16, s);
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices["iPhone 13"], viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }); const p = await ctx.newPage();
  const shots = [];
  const snap = async (name) => { const f = `${process.cwd()}/g_${name}.jpg`; await p.screenshot({ path: f, type: "jpeg", quality: 92 }); return f; };
  await p.goto(BASE); await p.waitForSelector("h1"); await p.waitForTimeout(600);
  shots.push(["1-verdict", await snap("v"), "Day 5: go to hospital now", "The rules engine names every reason and the CPG table it comes from."]);
  await p.locator('[data-day="3"]').click(); await p.waitForTimeout(600);
  shots.push(["2-day-clock", await snap("d"), "A day clock for the critical phase", "Days 3–7 are shaded. A green day still says tomorrow’s blood test is due."]);
  await p.locator('[data-day="5"]').click(); await p.waitForTimeout(400);
  for (const n of ["Stomach pain", "Vomiting more than 3 times today", "Very weak, drowsy or confused"]) await p.getByRole("button", { name: n }).click();
  await p.getByRole("button", { name: "Find signs in my message" }).click(); await p.waitForSelector("text=Found in your message", { timeout: 60000 });
  await p.evaluate((y) => window.scrollTo(0, y), (await yOf(p, "textarea")) - 330); await p.waitForTimeout(400);
  shots.push(["3-check-in", await snap("m"), "Check in in Malay, English or both", "Gemini and on-device rules find the warning signs. The model can add a sign, never remove one."]);
  for (let t = 0; t < 5; t++) {
    await p.getByRole("button", { name: "Try a sample slip" }).click(); await p.waitForSelector("text=Check each number", { timeout: 60000 });
    if (await p.locator("text=Gemini vision").count()) break;
    await p.waitForTimeout(8000);
  }
  await p.evaluate((y) => window.scrollTo(0, y), (await yOf(p, "#lab-h")) + 120); await p.waitForTimeout(400);
  shots.push(["4-slip", await snap("s"), "Every number confirmed against the slip", "Gemini vision reads the FBC slip and shows the printed text beside each value."]);
  await p.evaluate((y) => window.scrollTo(0, y), await yOf(p, "#trend-h")); await p.waitForTimeout(500);
  shots.push(["5-trend", await snap("t"), "Haematocrit up, platelets down", "Trend charts with the Malaysian HCT line, plus a printable MOH-style handover."]);
  await p.evaluate(() => window.scrollTo(0, 0)); await p.getByRole("button", { name: "BM", exact: true }).click(); await p.waitForTimeout(500);
  shots.push(["6-bahasa", await snap("bm"), "Bahasa Melayu throughout", "Every screen, reason and warning sign in Malay and English."]);
  const page = await b.newPage({ viewport: { width: 1500, height: 1000 } });
  for (const [name, img, h, sub] of shots) {
    await page.setContent(`<html><head><link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;800&display=swap" rel="stylesheet"></head><body style="margin:0;width:1500px;height:1000px;background:#f5f7fb;font-family:'Plus Jakarta Sans';color:#1f2a5a;position:relative;overflow:hidden">
      <div style="position:absolute;left:150px;top:40px;width:440px;height:920px;border-radius:52px;background:#1f2a5a;box-shadow:0 26px 60px rgba(31,42,90,.25)"></div>
      <img src="data:image/jpeg;base64,${fs.readFileSync(img).toString("base64")}" style="position:absolute;left:164px;top:54px;width:412px;height:892px;border-radius:40px;object-fit:cover;object-position:top">
      <div style="position:absolute;left:690px;top:0;width:680px;height:1000px;display:flex;flex-direction:column;justify-content:center">
      <div style="font-size:26px;font-weight:800">Fasa</div><div style="font-size:56px;font-weight:800;letter-spacing:-.025em;line-height:1.1;margin-top:26px">${h}</div>
      <div style="font-size:30px;line-height:1.45;color:#4a5585;margin-top:24px;font-weight:500">${sub}</div></div></body></html>`);
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${OUT}/${name}.jpg`, type: "jpeg", quality: 90 });
  }
  await b.close(); console.log(fs.readdirSync(OUT));
})();

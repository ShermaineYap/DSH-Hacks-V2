const { chromium, devices } = require("/opt/npm-tools/node_modules/playwright");
const fs = require("fs");
const BASE = "https://dsh-hacks-v2-jade.vercel.app";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function film(name, setup, act) {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices["iPhone 13"], viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  await p.goto(BASE + "/"); await p.waitForSelector("h1"); await p.addStyleTag({ content: "html{scroll-behavior:auto}" });
  if (setup) await setup(p);
  const dir = `frames/${name}`; fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  let running = true, i = 0; const stamps = []; const t0 = Date.now();
  const loop = (async () => { while (running) { const f = `${dir}/${String(i).padStart(5, "0")}.jpg`; await p.screenshot({ path: f, type: "jpeg", quality: 92 }); stamps.push([f, Date.now() - t0]); i++; } })();
  await act(p);
  running = false; await loop;
  // concat list with real durations
  let s = ""; for (let k = 0; k < stamps.length; k++) { const d = ((k + 1 < stamps.length ? stamps[k + 1][1] : stamps[k][1] + 100) - stamps[k][1]) / 1000; s += `file '${stamps[k][0].replace(dir + "/", "")}'\nduration ${d.toFixed(3)}\n`; }
  s += `file '${stamps[stamps.length - 1][0].replace(dir + "/", "")}'\n`;
  fs.writeFileSync(`${dir}/list.txt`, s);
  console.log(name, stamps.length, "frames", ((Date.now() - t0) / 1000).toFixed(1), "s");
  await b.close();
}
async function smooth(p, y, ms = 1200) {
  const start = await p.evaluate(() => window.scrollY); const steps = Math.round(ms / 60);
  for (let k = 1; k <= steps; k++) { const e = 0.5 - Math.cos(Math.PI * k / steps) / 2; await p.evaluate((v) => window.scrollTo(0, v), start + (y - start) * e); await sleep(60); }
}
const yOf = (p, sel) => p.evaluate((s) => document.querySelector(s).getBoundingClientRect().top + window.scrollY - 16, sel);
(async () => {
  const only = process.argv[2];
  const jobs = {
    days: [async (p) => { await p.locator('[data-day="1"]').click(); }, async (p) => {
      await sleep(1600);
      for (const d of [2, 3, 4]) { await p.locator(`[data-day="${d}"]`).click(); await sleep(2300); }
      await smooth(p, 260, 1000); await sleep(2500);
    }],
    message: [async (p) => {
      for (const n of ["Stomach pain", "Vomiting more than 3 times today", "Very weak, drowsy or confused"]) await p.getByRole("button", { name: n }).click();
      await p.evaluate((y) => window.scrollTo(0, y), await yOf(p, "#checkin-h"));
    }, async (p) => {
      await sleep(1500);
      await smooth(p, (await yOf(p, "textarea")) - 260, 1200); await sleep(1500);
      await p.getByRole("button", { name: "Find signs in my message" }).click();
      await p.waitForSelector("text=Found in your message", { timeout: 40000 }); await sleep(600);
      console.log("VIA", await p.locator('[role="status"]').textContent());
      await sleep(1200); await smooth(p, (await yOf(p, "textarea")) - 330, 900); await sleep(2500);
    }],
    slip: [async (p) => { await p.evaluate((y) => window.scrollTo(0, y), await yOf(p, "#lab-h")); }, async (p) => {
      await sleep(1500);
      await p.getByRole("button", { name: "Try a sample slip" }).click();
      await p.waitForSelector("text=Check each number", { timeout: 60000 }); await sleep(800);
      await smooth(p, (await yOf(p, "#lab-h")) + 120, 1200); await sleep(4000);
    }],
    verdict: [null, async (p) => {
      await sleep(3500); await smooth(p, 420, 1800); await sleep(3000);
      await smooth(p, await yOf(p, "#trend-h"), 2000); await sleep(4000);
    }],
    record: [async (p) => { await p.evaluate((y) => window.scrollTo(0, y), await yOf(p, "#record-h")); }, async (p) => {
      await sleep(2500); await p.locator("table").evaluate((t) => t.parentElement.scrollTo({ left: 400, behavior: "smooth" })); await sleep(2000);
      await smooth(p, 0, 1200); await sleep(500);
      await p.getByRole("button", { name: "BM", exact: true }).click(); await sleep(3000);
    }],
  };
  for (const [k, [setup, act]] of Object.entries(jobs)) if (!only || only === k) await film(k, setup, act);
})();

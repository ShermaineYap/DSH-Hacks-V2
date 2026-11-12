// Server-side Gemini helper. Model names and free-tier quotas change over time,
// so instead of hard-coding one model we list the Flash models this key can call
// and use the first one that actually answers (skipping retired or zero-quota ones).

let working: string | null = null; // first model that answered, reused afterwards
let candidates: string[] | null = null;
const dead = new Set<string>(); // models that returned 404 or a hard quota error

async function listCandidates(key: string): Promise<string[]> {
  if (process.env.GEMINI_MODEL) return [process.env.GEMINI_MODEL];
  if (candidates) return candidates;
  const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200", {
    headers: { "x-goog-api-key": key },
    signal: AbortSignal.timeout(8_000),
  });
  if (!r.ok) throw new Error(`gemini list ${r.status}`);
  const j = (await r.json()) as { models?: { name: string; supportedGenerationMethods?: string[] }[] };
  const usable = (j.models ?? [])
    .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
    .map((m) => m.name.replace(/^models\//, ""))
    .filter((n) => /flash/i.test(n) && !/(preview|exp|image|tts|audio|live|embedding|thinking|latest)/i.test(n));
  // Plain "gemini-<version>-flash" first (stable, widest free tier), newest version first; then lite; then any other flash.
  const ver = (n: string) => parseFloat(n.match(/(\d+(?:\.\d+)?)/)?.[1] ?? "0");
  const rank = (n: string) => (/^gemini-[\d.]+-flash$/i.test(n) ? 0 : /^gemini-[\d.]+-flash-lite$/i.test(n) ? 1 : 2);
  candidates = usable.sort((a, b) => rank(a) - rank(b) || ver(b) - ver(a));
  if (!candidates.length) throw new Error("no usable Gemini Flash model for this key");
  return candidates;
}

export async function generateJSON(parts: unknown[], schema: unknown, system?: string, timeoutMs = 12_000) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const t0 = Date.now();
  const call = (model: string) =>
    fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
        contents: [{ role: "user", parts }],
        generationConfig: { temperature: 0, responseMimeType: "application/json", responseSchema: schema },
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });

  const order = working ? [working] : (await listCandidates(key)).filter((m) => !dead.has(m));
  let lastErr = "no model tried";
  for (const model of order.slice(0, 5)) {
    const r = await call(model);
    if (r.ok) {
      working = model;
      const j = await r.json();
      const text = j?.candidates?.[0]?.content?.parts?.find((p: { text?: string }) => p.text)?.text ?? "{}";
      return { model, ms: Date.now() - t0, data: JSON.parse(text), tokens: j?.usageMetadata?.totalTokenCount ?? null };
    }
    const body = await r.text();
    const quota = body.match(/"quotaId": "([^"]+)"/)?.[1];
    lastErr = `gemini ${r.status} on ${model}${quota ? ` (${quota})` : ""}`;
    // A zero free-tier allowance shows up as 429 with "limit: 0"; a retired model as 404. Both: skip for good.
    const hardQuota = r.status === 429 && /limit: 0\b|"limit":\s*0\b|FreeTier/i.test(body) && !/retry in \d+(\.\d+)?s/i.test(body);
    if (r.status === 404 || hardQuota) {
      dead.add(model);
      if (working === model) working = null;
      continue;
    }
    if (r.status === 429 && working === model) {
      // per-minute limit on the model that was working: try the next one this time only
      working = null;
      continue;
    }
    break; // other errors: don't hammer the API
  }
  throw new Error(lastErr);
}

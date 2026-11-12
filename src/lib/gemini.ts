// Server-side Gemini helper. Model names change over time, so instead of
// hard-coding one we ask the API which Flash models this key can call.

let cached: string | null = null;

const PREFERRED = [/flash-lite/i, /flash/i]; // cheap & fast first; never "pro" for a free-tier demo

async function pickModel(key: string): Promise<string> {
  if (process.env.GEMINI_MODEL) return process.env.GEMINI_MODEL;
  if (cached) return cached;
  const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200", {
    headers: { "x-goog-api-key": key },
    signal: AbortSignal.timeout(8_000),
  });
  if (!r.ok) throw new Error(`gemini list ${r.status}`);
  const j = (await r.json()) as { models?: { name: string; supportedGenerationMethods?: string[] }[] };
  const usable = (j.models ?? [])
    .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
    .map((m) => m.name.replace(/^models\//, ""))
    .filter((n) => /gemini/i.test(n) && !/(preview|exp|image|tts|audio|live|embedding|thinking)/i.test(n));
  // Prefer the newest stable flash (not lite: better at Malay), then lite.
  const flash = usable.filter((n) => /flash/i.test(n) && !/lite/i.test(n)).sort().reverse();
  const lite = usable.filter((n) => PREFERRED[0].test(n)).sort().reverse();
  const choice = flash[0] ?? lite[0] ?? usable[0];
  if (!choice) throw new Error("no usable Gemini model for this key");
  cached = choice;
  return choice;
}

export async function generateJSON(parts: unknown[], schema: unknown, system?: string, timeoutMs = 12_000) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const t0 = Date.now();
  const call = async (model: string) =>
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
  let model = await pickModel(key);
  let r = await call(model);
  if (r.status === 404 && !process.env.GEMINI_MODEL) {
    cached = null; // model retired since we cached it: re-list once
    model = await pickModel(key);
    r = await call(model);
  }
  if (!r.ok) { const body = await r.text(); const lim = body.match(/"quotaId": "([^"]+)"[\s\S]*?"model": "([^"]+)"/); throw new Error(`gemini ${r.status} on ${model}${lim ? ` (${lim[1]})` : ""}: ${body.slice(0, 160)}`); }
  const j = await r.json();
  const text = j?.candidates?.[0]?.content?.parts?.find((p: { text?: string }) => p.text)?.text ?? "{}";
  return { model, ms: Date.now() - t0, data: JSON.parse(text), tokens: j?.usageMetadata?.totalTokenCount ?? null };
}

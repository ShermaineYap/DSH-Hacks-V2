import { NextResponse } from "next/server";
import { extractLexicon } from "@/lib/lexicon";
import type { SignKey } from "@/lib/types";

export const runtime = "nodejs";

const KEYS: SignKey[] = [
  "abdominal_pain", "persistent_vomiting", "persistent_diarrhoea", "bleeding", "lethargy",
  "poor_oral_intake", "low_urine", "breathless", "cold_clammy", "fainting", "seizure",
];

const SYSTEM = `You structure short check-in messages from Malaysian dengue outpatients (Malay, English or mixed, informal spelling).
Return ONLY signs that the message reports as present now / in the last 24 hours. Ignore negated, past-only or hypothetical mentions.
Definitions (Malaysian MOH Dengue CPG, Table 3 and Appendix 9):
- abdominal_pain: any abdominal/stomach pain or tenderness.
- persistent_vomiting: vomiting MORE THAN 3 times in 24 h, or non-stop / every time they drink. 3 or fewer times: do not return it; put it in "ask" if the count is unclear.
- persistent_diarrhoea: diarrhoea MORE THAN 3 times in 24 h or non-stop. Same rule.
- bleeding: gums, nose, red/purple skin spots, blood in vomit/urine/stool, black stool, unusually heavy period, bruising.
- lethargy: unusual drowsiness, extreme weakness/can't get up, restlessness, confusion. Ordinary tiredness is NOT lethargy.
- poor_oral_intake: unable to drink or keep fluids down.
- low_urine: much less urine than usual or no urine for many hours.
- breathless: difficulty breathing.
- cold_clammy: cold, pale or clammy skin, cold hands/feet.
- fainting: fainted, nearly fainted, very dizzy on standing.
- seizure: fit/convulsion.
For each sign give the exact words from the message as evidence.`;

const SCHEMA = {
  type: "OBJECT",
  properties: {
    signs: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: { key: { type: "STRING", enum: KEYS }, evidence: { type: "STRING" } },
        required: ["key", "evidence"],
      },
    },
    ask: { type: "ARRAY", items: { type: "STRING", enum: KEYS } },
  },
  required: ["signs", "ask"],
};

// Small per-instance limiter so a public demo cannot drain the free tier.
const hits = new Map<string, number[]>();
function limited(ip: string) {
  const now = Date.now();
  const arr = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length > 30;
}

async function callGemini(text: string) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const t0 = Date.now();
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents: [{ role: "user", parts: [{ text }] }],
      generationConfig: { temperature: 0, responseMimeType: "application/json", responseSchema: SCHEMA, thinkingConfig: { thinkingBudget: 0 } },
    }),
    signal: AbortSignal.timeout(12_000),
  });
  if (!r.ok) throw new Error(`gemini ${r.status}`);
  const j = await r.json();
  const raw = j?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
  const parsed = JSON.parse(raw) as { signs?: { key: SignKey; evidence: string }[]; ask?: SignKey[] };
  const signs = (parsed.signs ?? []).filter((s) => KEYS.includes(s.key));
  return {
    model,
    ms: Date.now() - t0,
    signs: [...new Set(signs.map((s) => s.key))],
    evidence: Object.fromEntries(signs.map((s) => [s.key, s.evidence])) as Partial<Record<SignKey, string>>,
    ask: (parsed.ask ?? []).filter((k) => KEYS.includes(k)),
    tokens: j?.usageMetadata?.totalTokenCount ?? null,
  };
}

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (limited(ip)) return NextResponse.json({ error: "Too many requests, try again in a minute." }, { status: 429 });
  let body: { text?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }
  const text = (body.text ?? "").slice(0, 600);
  if (!text.trim()) return NextResponse.json({ error: "Empty message" }, { status: 400 });

  const lexicon = extractLexicon(text);
  let llm: Awaited<ReturnType<typeof callGemini>> = null;
  let llmError: string | null = null;
  try {
    llm = await callGemini(text);
  } catch (e) {
    llmError = e instanceof Error ? e.message : "LLM unavailable";
  }
  // Safety: union. The model can add a sign; it can never remove one the on-device rules found.
  const signs = [...new Set([...lexicon.signs, ...(llm?.signs ?? [])])];
  const ask = [...new Set([...lexicon.ask, ...(llm?.ask ?? [])])].filter((k) => !signs.includes(k));
  return NextResponse.json({
    signs,
    ask,
    evidence: { ...(llm?.evidence ?? {}), ...lexicon.evidence },
    lexicon: { signs: lexicon.signs, ask: lexicon.ask },
    llm: llm ? { signs: llm.signs, ask: llm.ask, model: llm.model, ms: llm.ms, tokens: llm.tokens } : null,
    llmError,
  });
}

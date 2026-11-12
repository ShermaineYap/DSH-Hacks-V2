import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

// Reads FBC values from a photo of a lab slip with Gemini vision.
// The image is sent to the model once and never stored by Fasa.
// Values come back with the exact text they were read from, and the app
// asks the person to confirm every one before it is saved.

const PROMPT = `This is a photo of a full blood count (FBC) result slip from a Malaysian clinic or lab.
Extract ONLY these values if printed: haematocrit/HCT/PCV, platelets/PLT, haemoglobin/Hb/HGB, white cells/WBC/WCC/TWC, and the result date.
Rules:
- Copy each number exactly as printed into "printed" together with its unit as printed.
- Do not guess. If a value is unreadable, cut off or absent, return null for it.
- Ignore reference ranges and derived indices (MCV, MCH, MCHC, RDW, RBC).
- Date as yyyy-mm-dd if readable (slips use dd/mm/yyyy).`;

const field = {
  type: "OBJECT",
  nullable: true,
  properties: { printed: { type: "STRING" }, unit: { type: "STRING" }, confidence: { type: "STRING", enum: ["high", "low"] } },
  required: ["printed", "unit", "confidence"],
};
const SCHEMA = {
  type: "OBJECT",
  properties: { hct: field, plt: field, hb: field, wcc: field, date: { type: "STRING", nullable: true } },
  required: ["hct", "plt", "hb", "wcc", "date"],
};

type Field = { printed: string; unit: string; confidence: "high" | "low" } | null;

function toValue(key: "hct" | "plt" | "hb" | "wcc", f: Field): number | undefined {
  if (!f) return undefined;
  const num = parseFloat(f.printed.replace(/,/g, "").replace(/[^\d.]/g, ""));
  if (!isFinite(num)) return undefined;
  const u = f.unit.toLowerCase();
  let v = num;
  if (key === "hct" && (u.includes("l/l") || v < 1)) v = v * 100;
  if (key === "plt" && (u.includes("/ul") || u.includes("/µl") || u.includes("/mm")) && v >= 1000) v = v / 1000;
  if (key === "hb" && u.includes("g/l") && !u.includes("dl")) v = v / 10;
  if (key === "wcc" && v >= 500) v = v / 1000;
  const R = { hct: [10, 75], plt: [1, 1500], hb: [3, 25], wcc: [0.2, 40] } as const;
  if (v < R[key][0] || v > R[key][1]) return undefined;
  return Math.round(v * 10) / 10;
}

export async function POST(req: Request) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return NextResponse.json({ error: "Vision reader not configured; use on-device reading." }, { status: 503 });
  const form = await req.formData().catch(() => null);
  const file = form?.get("image");
  if (!(file instanceof Blob)) return NextResponse.json({ error: "No image" }, { status: 400 });
  if (file.size > 6_000_000) return NextResponse.json({ error: "Image too large (max 6 MB)" }, { status: 413 });
  const b64 = Buffer.from(await file.arrayBuffer()).toString("base64");
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const t0 = Date.now();
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ inlineData: { mimeType: file.type || "image/jpeg", data: b64 } }, { text: PROMPT }] }],
        generationConfig: { temperature: 0, responseMimeType: "application/json", responseSchema: SCHEMA, thinkingConfig: { thinkingBudget: 0 } },
      }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!r.ok) return NextResponse.json({ error: `Vision model error ${r.status}` }, { status: 502 });
    const j = await r.json();
    const raw = JSON.parse(j?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}") as Record<string, Field | string | null>;
    const out: Record<string, unknown> = { model, ms: Date.now() - t0, date: raw.date ?? undefined, printed: {}, lowConfidence: [] };
    for (const k of ["hct", "plt", "hb", "wcc"] as const) {
      const f = raw[k] as Field;
      const v = toValue(k, f);
      if (v != null) out[k] = v;
      if (f) (out.printed as Record<string, string>)[k] = `${f.printed} ${f.unit}`.trim();
      if (f?.confidence === "low") (out.lowConfidence as string[]).push(k);
    }
    return NextResponse.json(out);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Vision failed" }, { status: 502 });
  }
}

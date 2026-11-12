// Parse full-blood-count values out of OCR text from a Malaysian lab / clinic slip.
// Values are normalised to: HCT %, platelets x10^3/uL (= x10^9/L), Hb g/dL, WCC x10^3/uL.
// Every value is shown to the person for confirmation before it is saved.

export interface ParsedLab {
  hct?: number;
  plt?: number;
  hb?: number;
  wcc?: number;
  date?: string; // ISO
  lines: Partial<Record<"hct" | "plt" | "hb" | "wcc", string>>;
}

const LABELS: { key: "hct" | "plt" | "hb" | "wcc"; re: RegExp }[] = [
  { key: "hct", re: /\b(ha?ematocrit|hct|het|hot|pcv|packed\s+cell\s+vol(ume)?)\b/i },
  { key: "plt", re: /\b(platelets?(\s+count)?|plt|thrombocytes?)\b/i },
  { key: "wcc", re: /\b(white\s+(blood\s+)?cells?(\s+count)?|wbc|wcc|twc|total\s+white|leu[ck]ocytes?|t\.?w\.?c\.?)\b/i },
  { key: "hb", re: /\b(ha?emoglobin|hgb|hb)\b/i },
];

// Common OCR confusions inside numbers.
function fixDigits(s: string): string {
  return s.replace(/(?<=\d|^)[oO](?=\d|\.|$)/g, "0").replace(/(?<=\d)[lI|](?=\d)/g, "1").replace(/(?<=\d),(?=\d{1,2}\b)/g, ".");
}

function firstNumber(rest: string): { v: number; dec: boolean } | undefined {
  const cleaned = fixDigits(rest.replace(/[x×]?\s*10\s*[\^*~°]?\s*[39]\s*\/?\s*\w*/gi, " "));
  const m = cleaned.match(/(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)/);
  if (!m) return undefined;
  return { v: parseFloat(m[1].replace(/,/g, "")), dec: m[1].includes(".") };
}

function inRange(key: "hct" | "plt" | "hb" | "wcc", v: number): boolean {
  const R = { hct: [10, 75], plt: [1, 1500], hb: [3, 25], wcc: [0.2, 40] } as const;
  return v >= R[key][0] && v <= R[key][1];
}

function normalise(key: "hct" | "plt" | "hb" | "wcc", v: number, hadDecimal: boolean): number | undefined {
  // unit conversions
  if (key === "hct" && v > 0 && v < 1) v = v * 100; // L/L
  if (key === "plt" && v >= 1000) v = v / 1000; // per uL
  if (key === "hb" && v >= 40 && v <= 250) v = v / 10; // g/L
  if (key === "wcc" && v >= 500) v = v / 1000; // per uL
  if (inRange(key, v)) return round(v, key === "plt" ? 0 : 1);
  // OCR often drops the decimal point ("44.3" -> "443"): try one shift, flagged as recovered
  if (!hadDecimal && key !== "plt" && inRange(key, v / 10)) return round(v / 10, 1);
  return undefined;
}

const round = (v: number, dp: number) => Math.round(v * 10 ** dp) / 10 ** dp;

function parseDate(text: string): string | undefined {
  const m = text.match(/\b(\d{1,2})[\/.-](\d{1,2})[\/.-](20\d{2})\b/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  const iso = text.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (iso) return iso[0];
  return undefined;
}

export function parseLabText(text: string): ParsedLab {
  const out: ParsedLab = { lines: {} };
  for (const raw of text.split(/\n/)) {
    const line = raw.trim();
    if (!line) continue;
    for (const { key, re } of LABELS) {
      if (out[key] != null) continue;
      const m = line.match(re);
      if (!m) continue;
      // skip derived indices that contain the label text (e.g. "MCHC", "Hb A1c")
      if (key === "hb" && /\b(mchc?|a1c|hba1c)\b/i.test(line)) continue;
      const num = firstNumber(line.slice((m.index ?? 0) + m[0].length));
      if (num == null) continue;
      const n = normalise(key, num.v, num.dec);
      if (n == null) continue;
      out[key] = n;
      out.lines[key] = line;
      break; // one label per line
    }
  }
  out.date = parseDate(text);
  return out;
}

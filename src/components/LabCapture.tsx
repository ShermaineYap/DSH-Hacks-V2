"use client";

import { useRef, useState } from "react";
import { t } from "@/lib/i18n";
import { parseLabText } from "@/lib/labparse";
import type { Lang, LabResult } from "@/lib/types";

type Field = "hct" | "plt" | "hb" | "wcc";
const FIELDS: { k: Field; en: string; ms: string; unit: string }[] = [
  { k: "plt", en: "Platelets", ms: "Platelet", unit: "×10³/µL" },
  { k: "hct", en: "Haematocrit (HCT/PCV)", ms: "Hematokrit (HCT/PCV)", unit: "%" },
  { k: "hb", en: "Haemoglobin (Hb)", ms: "Hemoglobin (Hb)", unit: "g/dL" },
  { k: "wcc", en: "White cells (WBC)", ms: "Sel darah putih (WBC)", unit: "×10³/µL" },
];

async function downscale(file: Blob, max = 1600): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file);
    const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * s);
    c.height = Math.round(bmp.height * s);
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    return await new Promise((res) => c.toBlob((b) => res(b ?? file), "image/jpeg", 0.88));
  } catch {
    return file;
  }
}

export function LabCapture({
  lang, today, demo, previous, existing, onSave,
}: {
  lang: Lang; today: string; demo: boolean; previous?: LabResult; existing?: LabResult; onSave: (l: LabResult) => void;
}) {
  const [vals, setVals] = useState<Record<Field, string>>({
    hct: existing?.hct?.toString() ?? "", plt: existing?.plt?.toString() ?? "", hb: existing?.hb?.toString() ?? "", wcc: existing?.wcc?.toString() ?? "",
  });
  const [printed, setPrinted] = useState<Partial<Record<Field, string>>>({});
  const [via, setVia] = useState<string | null>(null);
  const [open, setOpen] = useState(!!existing);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function read(file: Blob) {
    setBusy(true);
    setErr(null);
    setSaved(false);
    setOpen(true);
    setPreview(URL.createObjectURL(file));
    const img = await downscale(file);
    try {
      const fd = new FormData();
      fd.append("image", img, "slip.jpg");
      const r = await fetch("/api/read-slip", { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setVals({ hct: j.hct?.toString() ?? "", plt: j.plt?.toString() ?? "", hb: j.hb?.toString() ?? "", wcc: j.wcc?.toString() ?? "" });
      setPrinted(j.printed ?? {});
      setVia(`Gemini vision (${j.ms} ms)`);
    } catch {
      // Fallback: on-device OCR. Nothing leaves the phone.
      try {
        const { default: Tesseract } = await import("tesseract.js");
        const { data } = await Tesseract.recognize(img, "eng");
        const p = parseLabText(data.text);
        setVals({ hct: p.hct?.toString() ?? "", plt: p.plt?.toString() ?? "", hb: p.hb?.toString() ?? "", wcc: p.wcc?.toString() ?? "" });
        setPrinted(p.lines);
        setVia(t("onDevice", lang));
      } catch {
        setErr(lang === "ms" ? "Tidak dapat membaca gambar. Sila taip nombor." : "Couldn't read the photo. Please type the numbers.");
      }
    }
    setBusy(false);
  }

  const num = (k: Field) => {
    const v = parseFloat(vals[k]);
    return isFinite(v) ? v : undefined;
  };
  const suspicious = (k: Field) => {
    const v = num(k);
    const p = previous?.[k];
    if (v == null || p == null) return false;
    if (k === "plt") return v > p * 2.2 || v < p * 0.35;
    if (k === "hct") return Math.abs(v - p) > 9;
    return false;
  };

  return (
    <section className="no-print mt-10" aria-labelledby="lab-h">
      <h2 id="lab-h" className="text-xl font-bold">
        {t("bloodResult", lang)}
      </h2>
      <div className="mt-3 flex flex-wrap gap-2">
        <input ref={fileRef} type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => e.target.files?.[0] && read(e.target.files[0])} />
        <button onClick={() => fileRef.current?.click()} className="h-11 rounded-full px-4 text-[15px] font-semibold text-[var(--paper)]" style={{ background: "var(--ink)" }}>
          {t("addPhoto", lang)}
        </button>
        {demo && (
          <button
            onClick={async () => read(await (await fetch("/sample-slip.jpg")).blob())}
            className="h-11 rounded-full px-4 text-[15px] font-semibold"
            style={{ boxShadow: "inset 0 0 0 1.5px var(--ink)" }}
          >
            {lang === "ms" ? "Cuba slip contoh" : "Try a sample slip"}
          </button>
        )}
        <button onClick={() => setOpen(true)} className="h-11 rounded-full px-4 text-[15px] font-semibold underline underline-offset-4">
          {t("typeIt", lang)}
        </button>
      </div>

      {busy && <p className="mt-3 text-[15px] text-ink-2">{t("reading", lang)}</p>}
      {err && <p className="mt-3 text-[15px] font-semibold" style={{ color: "var(--ed)" }}>{err}</p>}

      {open && !busy && (
        <div className="mt-4 rounded-2xl border border-line bg-surface p-4">
          {(via || preview) && (
            <div className="mb-3 flex items-start gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {preview && <img src={preview} alt="Your slip" className="h-20 w-28 rounded-lg object-cover" />}
              <p className="text-[14px] font-semibold text-ink-2">{t("confirmValues", lang)}{via ? <span className="block font-normal text-ink-3">{t("readBy", lang)} {via}</span> : null}</p>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {FIELDS.map((f) => (
              <label key={f.k} className="block">
                <span className="text-[14px] font-semibold text-ink-2">
                  {f[lang]} <span className="font-normal text-ink-3">{f.unit}</span>
                </span>
                <input
                  inputMode="decimal"
                  value={vals[f.k]}
                  onChange={(e) => {
                    setVals((v) => ({ ...v, [f.k]: e.target.value }));
                    setSaved(false);
                  }}
                  className="mt-1 h-12 w-full rounded-xl border bg-surface px-3 text-[20px] font-bold"
                  style={{ borderColor: suspicious(f.k) ? "var(--clinic)" : "var(--line)" }}
                />
                {printed[f.k] && <span className="mt-0.5 block text-[12px] text-ink-3">{t("printedAs", lang)}: “{printed[f.k]}”</span>}
                {suspicious(f.k) && <span className="mt-0.5 block text-[13px] font-semibold" style={{ color: "var(--clinic)" }}>{t("plausibility", lang)}</span>}
              </label>
            ))}
          </div>
          <button
            onClick={() => {
              onSave({ date: today, hct: num("hct"), plt: num("plt"), hb: num("hb"), wcc: num("wcc"), source: via ? "ocr" : "manual" });
              setSaved(true);
            }}
            disabled={num("hct") == null && num("plt") == null}
            className="mt-4 h-12 w-full rounded-full text-[16px] font-bold text-[var(--paper)] disabled:opacity-40 sm:w-auto sm:px-8"
            style={{ background: "var(--ink)" }}
          >
            {saved ? `✓ ${t("saved", lang)}` : t("saveResult", lang)}
          </button>
        </div>
      )}
    </section>
  );
}

"use client";

import { useState } from "react";
import { SIGN_LABELS, SIGN_ORDER, t } from "@/lib/i18n";
import { extractLexicon } from "@/lib/lexicon";
import type { DailyEntry, Lang, SignKey } from "@/lib/types";

type Found = { signs: SignKey[]; ask: SignKey[]; via: string };

export function CheckIn({ lang, entry, onSave }: { lang: Lang; entry: DailyEntry; onSave: (e: DailyEntry) => void }) {
  const [temp, setTemp] = useState(entry.tempC?.toString() ?? "");
  const [para, setPara] = useState(!!entry.tookAntipyretic);
  const [reviewed, setReviewed] = useState(!!entry.reviewedByClinic);
  const [signs, setSigns] = useState<Partial<Record<SignKey, boolean>>>(entry.signs ?? {});
  const [fromText, setFromText] = useState<Set<SignKey>>(new Set());
  const [text, setText] = useState(entry.freeText ?? "");
  const [found, setFound] = useState<Found | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const toggle = (k: SignKey) => {
    setSaved(false);
    setSigns((s) => ({ ...s, [k]: !s[k] }));
  };

  async function readMessage() {
    if (!text.trim()) return;
    setBusy(true);
    setSaved(false);
    let res: Found;
    try {
      const r = await fetch("/api/extract", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }) });
      if (!r.ok) throw new Error();
      const j = await r.json();
      res = { signs: j.signs, ask: j.ask, via: j.llm ? `Gemini + on-device rules` : "on-device rules" };
    } catch {
      const l = extractLexicon(text); // offline fallback
      res = { signs: l.signs, ask: l.ask, via: "on-device rules (offline)" };
    }
    setFound(res);
    setSigns((s) => {
      const n = { ...s };
      for (const k of res.signs) n[k] = true; // only ever adds
      return n;
    });
    setFromText(new Set(res.signs));
    setBusy(false);
  }

  function submit() {
    const tc = parseFloat(temp);
    onSave({
      ...entry,
      tempC: isFinite(tc) && tc > 30 && tc < 45 ? tc : undefined,
      tookAntipyretic: para,
      reviewedByClinic: reviewed,
      signs: Object.fromEntries(Object.entries(signs).filter(([, v]) => v)),
      freeText: text || undefined,
    });
    setSaved(true);
  }

  const chip = (k: SignKey) => {
    const on = !!signs[k];
    const emergency = SIGN_LABELS[k].group === "emergency";
    return (
      <button
        key={k}
        type="button"
        onClick={() => toggle(k)}
        aria-pressed={on}
        className={`min-h-11 rounded-2xl px-3.5 py-2 text-left text-[15px] leading-snug transition-colors ${
          on ? "font-semibold text-white" : "text-ink hover:bg-window"
        }`}
        style={on ? { background: emergency ? "var(--emergency)" : "var(--ed)" } : { boxShadow: "inset 0 0 0 1.5px var(--line)", background: "var(--surface)" }}
      >
        {SIGN_LABELS[k][lang]}
        {on && fromText.has(k) && <span className="ml-1.5 text-[12px] font-medium opacity-85">· {lang === "ms" ? "dari mesej" : "from message"}</span>}
      </button>
    );
  };

  return (
    <section className="no-print mt-10" aria-labelledby="checkin-h">
      <h2 id="checkin-h" className="text-xl font-bold">
        {t("checkIn", lang)}
      </h2>

      <div className="mt-4 grid gap-3 sm:grid-cols-[160px_1fr] sm:items-end">
        <label className="block">
          <span className="text-[14px] font-semibold text-ink-2">{t("temp", lang)}</span>
          <input
            inputMode="decimal"
            value={temp}
            onChange={(e) => {
              setTemp(e.target.value);
              setSaved(false);
            }}
            placeholder="38.5"
            className="mt-1 h-12 w-full rounded-xl border border-line bg-surface px-3 text-[20px] font-bold"
          />
        </label>
        <div className="flex flex-col gap-2 text-[15px]">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={para} onChange={(e) => setPara(e.target.checked)} className="h-5 w-5 accent-[var(--ink)]" />
            {t("tookParacetamol", lang)}
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={reviewed} onChange={(e) => setReviewed(e.target.checked)} className="h-5 w-5 accent-[var(--ink)]" />
            {t("reviewed", lang)}
          </label>
        </div>
      </div>

      <p className="mt-6 text-[14px] font-semibold text-ink-2">{t("tapSigns", lang)}</p>
      <div className="mt-2 flex flex-wrap gap-2">{SIGN_ORDER.filter((k) => SIGN_LABELS[k].group === "warning").map(chip)}</div>
      <p className="mt-4 text-[14px] font-semibold text-ink-2">{t("emergencySigns", lang)}</p>
      <div className="mt-2 flex flex-wrap gap-2">{SIGN_ORDER.filter((k) => SIGN_LABELS[k].group === "emergency").map(chip)}</div>

      <label className="mt-6 block">
        <span className="text-[14px] font-semibold text-ink-2">{t("describe", lang)}</span>
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setFound(null);
          }}
          rows={3}
          maxLength={600}
          placeholder={t("describePh", lang)}
          className="mt-1 w-full rounded-xl border border-line bg-surface p-3 text-[16px] leading-relaxed"
        />
      </label>
      <button
        type="button"
        onClick={readMessage}
        disabled={busy || !text.trim()}
        className="mt-2 h-11 rounded-full px-4 text-[15px] font-semibold text-ink disabled:opacity-50"
        style={{ boxShadow: "inset 0 0 0 1.5px var(--ink)" }}
      >
        {busy ? t("reading", lang) : t("readMessage", lang)}
      </button>

      {found && (
        <div className="mt-3 rounded-2xl bg-window p-4 text-[15px]" role="status">
          {found.signs.length ? (
            <>
              <p className="font-semibold">{t("foundSigns", lang)}</p>
              <p className="mt-1">{found.signs.map((k) => SIGN_LABELS[k][lang]).join(" · ")}</p>
            </>
          ) : (
            <p>{t("noSignsFound", lang)}</p>
          )}
          {found.ask.map((k) => (
            <div key={k} className="mt-3">
              <p className="font-semibold">
                {SIGN_LABELS[k][lang].replace(/ (more than 3 times today|lebih 3 kali hari ini)/, "")}: {t("howMany", lang)}
              </p>
              <div className="mt-1.5 flex gap-2">
                {["1–3", "4+"].map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    className="h-10 rounded-full bg-surface px-4 font-semibold"
                    style={{ boxShadow: "inset 0 0 0 1.5px var(--line)" }}
                    onClick={() => {
                      if (opt === "4+") setSigns((s) => ({ ...s, [k]: true }));
                      setFound((f) => (f ? { ...f, ask: f.ask.filter((x) => x !== k) } : f));
                    }}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <p className="mt-3 text-[12px] text-ink-3">{found.via}</p>
        </div>
      )}

      <button
        type="button"
        onClick={submit}
        className="mt-6 h-12 w-full rounded-full text-[16px] font-bold text-[var(--paper)] sm:w-auto sm:px-8"
        style={{ background: "var(--ink)" }}
      >
        {saved ? `✓ ${t("saved", lang)}` : t("saveCheckIn", lang)}
      </button>
    </section>
  );
}

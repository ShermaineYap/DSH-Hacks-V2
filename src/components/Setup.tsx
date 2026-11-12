"use client";

import { useState } from "react";
import { t } from "@/lib/i18n";
import { addDays, todayISO } from "@/lib/store";
import type { Lang, Profile, Sex } from "@/lib/types";

export function Setup({ lang, onDone, onDemo }: { lang: Lang; onDone: (p: Profile) => void; onDemo: () => void }) {
  const [onset, setOnset] = useState(addDays(todayISO(), -1));
  const [age, setAge] = useState("");
  const [sex, setSex] = useState<Sex>("female");
  const [name, setName] = useState("");
  const [flags, setFlags] = useState({ pregnant: false, comorbidity: false, anticoagulant: false, livesAlone: false });
  const ageN = parseInt(age, 10);
  const valid = onset <= todayISO() && ageN >= 12 && ageN <= 110;

  return (
    <section className="mt-6 rounded-3xl border border-line bg-surface p-5">
      <h1 className="text-[26px] font-extrabold tracking-[-0.02em]">{t("setupTitle", lang)}</h1>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-[14px] font-semibold text-ink-2">{t("feverStart", lang)}</span>
          <input type="date" value={onset} max={todayISO()} onChange={(e) => setOnset(e.target.value)} className="mt-1 h-12 w-full rounded-xl border border-line bg-surface px-3 text-[16px]" />
        </label>
        <label className="block">
          <span className="text-[14px] font-semibold text-ink-2">{t("age", lang)}</span>
          <input inputMode="numeric" value={age} onChange={(e) => setAge(e.target.value)} className="mt-1 h-12 w-full rounded-xl border border-line bg-surface px-3 text-[16px]" />
        </label>
        <fieldset>
          <legend className="text-[14px] font-semibold text-ink-2">{t("sex", lang)}</legend>
          <div className="mt-1 flex gap-2">
            {(["female", "male"] as Sex[]).map((s) => (
              <button key={s} type="button" aria-pressed={sex === s} onClick={() => setSex(s)} className={`h-12 flex-1 rounded-xl text-[15px] font-semibold ${sex === s ? "bg-[var(--ink)] text-[var(--paper)]" : "border border-line"}`}>
                {t(s, lang)}
              </button>
            ))}
          </div>
        </fieldset>
        <label className="block">
          <span className="text-[14px] font-semibold text-ink-2">{lang === "ms" ? "Nama (pilihan)" : "Name (optional)"}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 h-12 w-full rounded-xl border border-line bg-surface px-3 text-[16px]" />
        </label>
      </div>
      <div className="mt-5 space-y-2.5 text-[15px]">
        {(["pregnant", "comorbidity", "anticoagulant", "livesAlone"] as const)
          .filter((k) => k !== "pregnant" || sex === "female")
          .map((k) => (
            <label key={k} className="flex items-start gap-2.5">
              <input type="checkbox" checked={flags[k]} onChange={(e) => setFlags((f) => ({ ...f, [k]: e.target.checked }))} className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--ink)]" />
              {t(k, lang)}
            </label>
          ))}
      </div>
      <p className="mt-5 text-[13px] text-ink-3">{t("storedHere", lang)}</p>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <button
          disabled={!valid}
          onClick={() => onDone({ feverOnset: onset, age: ageN, sex, name: name.trim() || undefined, ...flags, pregnant: sex === "female" && flags.pregnant })}
          className="h-12 rounded-full px-8 text-[16px] font-bold text-[var(--paper)] disabled:opacity-40"
          style={{ background: "var(--ink)" }}
        >
          {t("begin", lang)}
        </button>
        <button onClick={onDemo} className="text-[15px] font-semibold underline underline-offset-4">
          {t("backToDemo", lang)}
        </button>
      </div>
    </section>
  );
}

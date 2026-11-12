"use client";

import { assess, dayOfIllness } from "@/lib/rules";
import { SIGN_LABELS, t, TIER_TEXT } from "@/lib/i18n";
import type { DailyEntry, Lang, Profile, SignKey } from "@/lib/types";

// Mirrors the MOH Outpatient Dengue Monitoring Record (CPG Appendix 7) and adds the
// warning-sign column that the paper form does not have.
export function RecordTable({ profile, entries, lang, today }: { profile: Profile; entries: DailyEntry[]; lang: Lang; today: string }) {
  const rows = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const fmt = (iso: string) => iso.split("-").reverse().join("/");
  return (
    <section className="mt-10" aria-labelledby="record-h">
      <div className="print-only mb-4">
        <p className="text-[20px] font-extrabold">Fasa – outpatient dengue monitoring record</p>
        <p className="text-[13px]">
          Patient: {profile.name ?? "—"} · Age {profile.age} · {profile.sex} · Fever onset {fmt(profile.feverOnset)} · Printed {fmt(today)}
          {profile.pregnant ? " · Pregnant" : ""}
          {profile.comorbidity ? " · Co-morbidity" : ""}
          {profile.anticoagulant ? " · On anticoagulant/anti-platelet" : ""}
        </p>
        <p className="mt-1 text-[12px]">
          Patient-recorded; laboratory values were confirmed by the patient against the printed slip. Tier = Fasa’s reading of MOH CPG Dengue (2015) Tables 2–4 and 7.3.1. Not a clinical assessment.
        </p>
      </div>
      <h2 id="record-h" className="no-print text-xl font-bold">
        {t("record", lang)}
      </h2>
      <div className="mt-3 overflow-x-auto rounded-2xl border border-line bg-surface">
        <table className="w-full min-w-[640px] border-collapse text-[14px]">
          <thead>
            <tr className="text-left text-ink-2">
              {["Date", t("day", lang), "Temp °C", "Hb", "HCT %", "WCC", "Plt", lang === "ms" ? "Tanda amaran" : "Warning signs", "Fasa"].map((h) => (
                <th key={h} className="border-b border-line px-3 py-2 font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => {
              const a = assess(profile, entries, e.date);
              const signs = Object.entries(e.signs ?? {}).filter(([, v]) => v).map(([k]) => SIGN_LABELS[k as SignKey][lang]);
              return (
                <tr key={e.date} className="align-top">
                  <td className="border-b border-line px-3 py-2 whitespace-nowrap">{fmt(e.date)}</td>
                  <td className="border-b border-line px-3 py-2 font-bold">{dayOfIllness(profile.feverOnset, e.date)}</td>
                  <td className="border-b border-line px-3 py-2">{e.tempC ?? "—"}{e.tookAntipyretic ? "*" : ""}</td>
                  <td className="border-b border-line px-3 py-2">{e.lab?.hb ?? "—"}</td>
                  <td className="border-b border-line px-3 py-2 font-semibold">{e.lab?.hct ?? "—"}</td>
                  <td className="border-b border-line px-3 py-2">{e.lab?.wcc ?? "—"}</td>
                  <td className="border-b border-line px-3 py-2 font-semibold">{e.lab?.plt ?? "—"}</td>
                  <td className="border-b border-line px-3 py-2">{signs.length ? signs.join("; ") : "—"}</td>
                  <td className="border-b border-line px-3 py-2 whitespace-nowrap font-semibold">{TIER_TEXT[a.tier][lang === "ms" ? "shortMs" : "shortEn"]}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[12px] text-ink-3">* {lang === "ms" ? "selepas parasetamol" : "after paracetamol"} · Plt, WCC ×10³/µL</p>
    </section>
  );
}

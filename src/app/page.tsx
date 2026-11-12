"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { assess, dayOfIllness, hctThreshold } from "@/lib/rules";
import { DEFAULT_STATE, DEMO_ENTRIES, DEMO_PROFILE, addDays, load, save, todayISO, upsertEntry, type AppState } from "@/lib/store";
import { t, TIER_TEXT } from "@/lib/i18n";
import type { Assessment, DailyEntry, Lang, Profile, Tier } from "@/lib/types";
import { CheckIn } from "@/components/CheckIn";
import { LabCapture } from "@/components/LabCapture";
import { Trend } from "@/components/Trend";
import { RecordTable } from "@/components/RecordTable";
import { Setup } from "@/components/Setup";

export default function Home() {
  const [state, setState] = useState<AppState>(DEFAULT_STATE);
  const [demoEntries, setDemoEntries] = useState<DailyEntry[]>(DEMO_ENTRIES);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setState(load());
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready) save(state);
  }, [state, ready]);

  const lang = state.lang;
  const demo = state.mode === "demo";
  const profile: Profile | null = demo ? DEMO_PROFILE : state.profile;
  const entries = demo ? demoEntries : state.entries;
  const today = demo ? addDays(DEMO_PROFILE.feverOnset, state.demoDay - 1) : todayISO();

  const setEntries = (fn: (e: DailyEntry[]) => DailyEntry[]) => {
    if (demo) setDemoEntries(fn);
    else setState((s) => ({ ...s, entries: fn(s.entries) }));
  };

  const a = useMemo(() => (profile ? assess(profile, entries, today) : null), [profile, entries, today]);
  const todayEntry = entries.find((e) => e.date === today) ?? { date: today, signs: {} };

  if (!ready) return <main className="min-h-dvh" />;

  return (
    <main className="mx-auto max-w-[620px] px-4 pb-24 pt-5 sm:px-6">
      <Header lang={lang} setLang={(l) => setState((s) => ({ ...s, lang: l }))} />

      {demo && (
        <section className="no-print mt-4 rounded-2xl border border-line bg-surface p-4">
          <p className="text-[15px] text-ink-2">{t("demoBanner", lang)}</p>
          <button
            onClick={() => setState((s) => ({ ...s, mode: "mine" }))}
            className="mt-2 h-10 text-[15px] font-semibold text-ink underline decoration-2 underline-offset-4"
          >
            {t("startMine", lang)}
          </button>
        </section>
      )}

      {!demo && !profile && (
        <Setup
          lang={lang}
          onDone={(p) => setState((s) => ({ ...s, profile: p }))}
          onDemo={() => setState((s) => ({ ...s, mode: "demo" }))}
        />
      )}

      {profile && a && (
        <>
          <DayStrip profile={profile} entries={entries} today={today} lang={lang} onPick={demo ? (n) => setState((s) => ({ ...s, demoDay: n })) : undefined} maxPick={demo ? DEMO_ENTRIES.length : 0} />
          <Verdict a={a} lang={lang} name={profile.name} />

          <CheckIn
            key={today + (demo ? state.demoDay : "")}
            lang={lang}
            entry={todayEntry}
            onSave={(e) => setEntries((all) => upsertEntry(all, e))}
          />

          <LabCapture
            key={"lab" + today}
            lang={lang}
            today={today}
            demo={demo}
            previous={[...entries].filter((e) => e.lab && e.date < today).map((e) => e.lab!).pop()}
            existing={todayEntry.lab}
            onSave={(lab) => setEntries((all) => upsertEntry(all, { ...(all.find((e) => e.date === today) ?? { date: today, signs: {} }), lab }))}
          />

          <Trend entries={entries.filter((e) => e.date <= today)} profile={profile} lang={lang} threshold={hctThreshold(profile.sex, profile.age)} />

          <RecordTable profile={profile} entries={entries.filter((e) => e.date <= today)} lang={lang} today={today} />

          <section className="no-print mt-10">
            <h2 className="text-lg font-bold">{t("homeCare", lang)}</h2>
            <ul className="mt-2 space-y-2 text-[15px] leading-relaxed text-ink-2">
              {a.notes.map((n) => (
                <li key={n.code}>
                  {n[lang]} <span className="text-ink-3">({n.source})</span>
                </li>
              ))}
            </ul>
          </section>

          {!demo && (
            <div className="no-print mt-8 flex flex-wrap gap-4 text-[15px]">
              <button className="font-semibold underline underline-offset-4" onClick={() => setState((s) => ({ ...s, mode: "demo" }))}>
                {t("backToDemo", lang)}
              </button>
            </div>
          )}
        </>
      )}

      <footer className="no-print mt-12 border-t border-line pt-5 text-[13px] leading-relaxed text-ink-3">
        <p>{t("notDiagnosis", lang)}</p>
        <p className="mt-2">{t("storedHere", lang)}</p>
        <p className="mt-2">
          Rules: Malaysian MOH, <i>CPG Management of Dengue Infection in Adults</i>, 3rd ed. (2015).{" "}
          <Link href="/evidence" className="font-semibold text-ink-2 underline underline-offset-2">
            {t("evidence", lang)}
          </Link>
        </p>
      </footer>
    </main>
  );
}

function Header({ lang, setLang }: { lang: Lang; setLang: (l: Lang) => void }) {
  return (
    <header className="no-print flex items-center justify-between gap-3">
      <div className="flex items-baseline gap-3">
        <span className="text-[28px] font-extrabold tracking-[-0.03em]">Fasa</span>
        <span className="hidden text-[14px] text-ink-3 sm:inline">{t("tagline", lang)}</span>
      </div>
      <nav className="flex items-center gap-1 rounded-full border border-line p-1" aria-label="Language">
        {(["ms", "en"] as Lang[]).map((l) => (
          <button
            key={l}
            onClick={() => setLang(l)}
            aria-pressed={lang === l}
            className={`h-8 rounded-full px-3 text-[13px] font-bold ${lang === l ? "bg-[var(--ink)] text-[var(--paper)]" : "text-ink-2"}`}
          >
            {l === "ms" ? "BM" : "EN"}
          </button>
        ))}
      </nav>
    </header>
  );
}

function Cell({ n, pick, className, current, label, children }: { n: number; pick?: () => void; className: string; current: boolean; label: string; children: React.ReactNode }) {
  if (!pick) return <div className={className} data-day={n}>{children}</div>;
  return (
    <button type="button" onClick={pick} aria-pressed={current} aria-label={label} className={className} data-day={n}>
      {children}
    </button>
  );
}

const TIER_DOT: Record<Tier, string> = {
  home: "var(--home)",
  clinic_today: "var(--clinic)",
  ed_now: "var(--ed)",
  emergency: "var(--emergency)",
};

function DayStrip({ profile, entries, today, lang, onPick, maxPick }: { profile: Profile; entries: DailyEntry[]; today: string; lang: Lang; onPick?: (n: number) => void; maxPick: number }) {
  const current = dayOfIllness(profile.feverOnset, today);
  const span = Math.max(7, current);
  const days = Array.from({ length: span }, (_, i) => i + 1);
  return (
    <section className="mt-6" aria-label={t("criticalWindow", lang)}>
      <div className="relative grid gap-1" style={{ gridTemplateColumns: `repeat(${span}, minmax(0, 1fr))` }}>
        <div
          className="absolute inset-y-0 rounded-xl bg-window"
          style={{ left: `calc(${(2 / span) * 100}% )`, width: `calc(${(5 / span) * 100}% - 2px)` }}
          aria-hidden
        />
        {days.map((n) => {
          const date = addDays(profile.feverOnset, n - 1);
          const past = n <= current;
          const tier = past ? assess(profile, entries, date).tier : null;
          const isToday = n === current;
          return (
            <Cell key={n} n={n} pick={onPick && n <= maxPick ? () => onPick(n) : undefined} className={`relative flex flex-col items-center rounded-xl py-2 ${isToday ? "bg-surface shadow-[0_0_0_2px_var(--ink)]" : ""} ${onPick && n <= maxPick && !isToday ? "hover:bg-surface/70" : ""}`} current={isToday} label={`${t("day", lang)} ${n}`}>
              <span className={`text-[11px] font-semibold ${isToday ? "text-ink" : "text-ink-3"}`}>{t("day", lang)}</span>
              <span className={`text-[22px] font-extrabold leading-tight ${past ? "text-ink" : "text-ink-3"}`}>{n}</span>
              <span
                className="mt-1 h-2.5 w-2.5 rounded-full"
                style={{ background: tier ? TIER_DOT[tier] : "transparent", boxShadow: tier ? "none" : "inset 0 0 0 1.5px var(--line)" }}
                title={tier ? TIER_TEXT[tier][lang === "ms" ? "shortMs" : "shortEn"] : undefined}
              />
            </Cell>
          );
        })}
      </div>
      <p className="mt-2 text-[13px] text-ink-3">
        <span className="mr-1 inline-block h-2.5 w-5 rounded-sm bg-window align-middle" /> {t("criticalWindow", lang)} (3–7)
      </p>
    </section>
  );
}

function Verdict({ a, lang, name }: { a: Assessment; lang: Lang; name?: string }) {
  const tt = TIER_TEXT[a.tier];
  const urgent = a.tier === "emergency" || a.tier === "ed_now";
  return (
    <section key={a.tier + a.dayOfIllness} className={`tier-${a.tier} verdict-enter mt-5 rounded-3xl p-5 sm:p-6`} style={{ background: "var(--tb)" }} aria-live="polite">
      <p className="text-[15px] font-semibold" style={{ color: "var(--tc)" }}>
        {name ? `${name}, ` : ""}
        {lang === "ms" ? `hari ini hari ke-${a.dayOfIllness} sakit anda` : `${name ? "today" : "Today"} is day ${a.dayOfIllness} of your illness`}
      </p>
      <h1 className="mt-2 text-[30px] font-extrabold leading-[1.12] tracking-[-0.02em] sm:text-[36px]" style={{ color: "var(--tc)" }}>
        {tt[lang]}
      </h1>

      {!urgent && a.dayOfIllness >= 2 && a.dayOfIllness <= 7 && (
        <p className="mt-3 text-[16px] font-semibold text-ink">
          {lang === "ms"
            ? `Esok hari ke-${a.dayOfIllness + 1}: buat ujian darah dan pemeriksaan klinik, walaupun anda rasa lebih baik.`
            : `Tomorrow is day ${a.dayOfIllness + 1}: get a blood test and clinic review, even if you feel better.`}
        </p>
      )}

      {a.reasons.length > 0 && (
        <div className="mt-4">
          <h2 className="text-[14px] font-bold text-ink">{t("why", lang)}</h2>
          <ul className="mt-1.5 space-y-1.5 text-[15px] leading-snug text-ink">
            {a.reasons.map((r) => (
              <li key={r.code} className="flex gap-2">
                <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "var(--tc)" }} />
                <span>
                  {r[lang]} <span className="text-[13px] text-ink-3">{r.source}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {a.missing.length > 0 && (
        <div className="mt-4">
          <h2 className="text-[14px] font-bold text-ink">{t("stillNeeded", lang)}</h2>
          <ul className="mt-1.5 space-y-1 text-[15px] text-ink-2">
            {a.missing.map((r) => (
              <li key={r.code}>{r[lang]}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="no-print mt-5 flex flex-wrap gap-2">
        {a.tier === "emergency" && (
          <a href="tel:999" className="inline-flex h-12 items-center rounded-full px-5 text-[16px] font-bold text-white" style={{ background: "var(--tc)" }}>
            {t("call999", lang)}
          </a>
        )}
        {urgent && (
          <a
            href="https://www.google.com/maps/search/hospital+emergency+department"
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-12 items-center rounded-full px-5 text-[16px] font-bold"
            style={a.tier === "emergency" ? { boxShadow: "inset 0 0 0 2px var(--tc)", color: "var(--tc)" } : { background: "var(--tc)", color: "white" }}
          >
            {t("findHospital", lang)}
          </a>
        )}
        {a.tier === "clinic_today" && (
          <a
            href="https://www.google.com/maps/search/klinik+kesihatan"
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-12 items-center rounded-full px-5 text-[16px] font-bold text-white"
            style={{ background: "var(--tc)" }}
          >
            {t("findClinic", lang)}
          </a>
        )}
        <button onClick={() => window.print()} className="inline-flex h-12 items-center rounded-full px-5 text-[16px] font-semibold text-ink" style={{ boxShadow: "inset 0 0 0 1.5px var(--line)", background: "var(--surface)" }}>
          {t("printHandover", lang)}
        </button>
      </div>
    </section>
  );
}

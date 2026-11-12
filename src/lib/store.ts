import type { DailyEntry, Lang, Profile } from "./types";

export interface AppState {
  mode: "demo" | "mine";
  lang: Lang;
  profile: Profile | null;
  entries: DailyEntry[];
  demoDay: number; // which demo day is "today"
}

const KEY = "fasa.v1";

export function todayISO(): string {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 10);
}

export function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Demo patient: Aisyah, 28, sent home from a Klinik Kesihatan on day 2.
export const DEMO_PROFILE: Profile = { name: "Aisyah", feverOnset: "2026-11-01", age: 28, sex: "female" };
export const DEMO_ENTRIES: DailyEntry[] = [
  { date: "2026-11-01", tempC: 39.4, tookAntipyretic: true, signs: {}, freeText: "demam tinggi, sakit kepala, sakit belakang mata" },
  { date: "2026-11-02", tempC: 39.1, tookAntipyretic: true, signs: {}, freeText: "badan sakit2, ada ruam sikit kat lengan, minum ok", reviewedByClinic: true },
  { date: "2026-11-03", tempC: 38.6, signs: {}, freeText: "penat sikit tapi boleh makan", lab: { date: "2026-11-03", hct: 38, plt: 118, hb: 12.9, wcc: 3.1, source: "demo" } },
  { date: "2026-11-04", tempC: 37.9, signs: {}, freeText: "demam dah kurang, rasa ok sikit", lab: { date: "2026-11-04", hct: 38, plt: 104, hb: 12.8, wcc: 2.8, source: "demo" } },
  {
    date: "2026-11-05", tempC: 37.2, signs: { abdominal_pain: true, persistent_vomiting: true, lethargy: true },
    freeText: "demam dah turun tapi sakit perut teruk, muntah 4 kali sejak pagi, lemah sgt",
    lab: { date: "2026-11-05", hct: 44, plt: 71, hb: 14.6, wcc: 2.6, source: "demo" },
  },
];

export const DEFAULT_STATE: AppState = { mode: "demo", lang: "en", profile: null, entries: [], demoDay: 5 };

export function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_STATE;
    return { ...DEFAULT_STATE, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_STATE;
  }
}

export function save(s: AppState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable: keep working in memory */
  }
}

export function upsertEntry(entries: DailyEntry[], e: DailyEntry): DailyEntry[] {
  const rest = entries.filter((x) => x.date !== e.date);
  return [...rest, e].sort((a, b) => a.date.localeCompare(b.date));
}

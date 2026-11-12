import { describe, expect, it } from "vitest";
import { assess, dayOfIllness, hctThreshold } from "./rules";
import type { DailyEntry, Profile, SignKey, Tier } from "./types";

const base: Profile = { feverOnset: "2026-11-01", age: 28, sex: "female" };
const d = (n: number) => `2026-11-${String(n).padStart(2, "0")}`; // day n of illness = d(n)

type Case = {
  name: string;
  profile?: Partial<Profile>;
  day: number;
  signs?: SignKey[];
  temp?: number | null;
  reviewed?: boolean;
  labs?: { day: number; hct?: number; plt?: number }[];
  tier: Tier;
  codes?: string[]; // reason codes that must be present
  absent?: string[]; // reason codes that must NOT be present
};

const cases: Case[] = [
  // --- day-of-illness clock and the daily-review rule (CPG Table 2)
  { name: "day 1, well", day: 1, tier: "home", absent: ["daily_review"] },
  { name: "day 2, well", day: 2, tier: "home", absent: ["daily_review"] },
  { name: "day 3, no review yet", day: 3, tier: "clinic_today", codes: ["daily_review"] },
  { name: "day 3, reviewed at clinic", day: 3, reviewed: true, labs: [{ day: 3, hct: 38, plt: 150 }], tier: "home" },
  { name: "day 4, lab today counts as review", day: 4, labs: [{ day: 4, hct: 38, plt: 140 }], tier: "home" },
  { name: "day 4, only yesterday's lab", day: 4, labs: [{ day: 3, hct: 38, plt: 140 }], tier: "clinic_today", codes: ["daily_review"] },
  { name: "day 7, no review", day: 7, tier: "clinic_today", codes: ["daily_review"] },

  // --- each warning sign alone (CPG Table 3 / 7.3.1) → ED now
  ...(["abdominal_pain", "persistent_vomiting", "persistent_diarrhoea", "bleeding", "lethargy", "poor_oral_intake", "low_urine"] as SignKey[]).map(
    (s): Case => ({ name: `day 2 sign ${s}`, day: 2, signs: [s], tier: "ed_now" }),
  ),
  ...(["abdominal_pain", "persistent_vomiting", "bleeding", "lethargy"] as SignKey[]).map(
    (s): Case => ({ name: `day 5 reviewed, sign ${s}`, day: 5, reviewed: true, labs: [{ day: 5, hct: 37, plt: 120 }], signs: [s], tier: "ed_now" }),
  ),

  // --- shock / emergency signs (Appendix 9, 7.2, 7.3.1) → emergency
  ...(["cold_clammy", "breathless", "seizure", "fainting"] as SignKey[]).map(
    (s): Case => ({ name: `day 4 sign ${s}`, day: 4, signs: [s], tier: "emergency" }),
  ),
  { name: "emergency beats ED", day: 5, signs: ["abdominal_pain", "cold_clammy"], tier: "emergency", codes: ["shock_skin", "abdominal_pain"] },

  // --- raised HCT with falling platelets (Table 3), sex/age thresholds
  { name: "female HCT 40 + plt falling", day: 4, labs: [{ day: 3, hct: 37, plt: 130 }, { day: 4, hct: 40, plt: 95 }], tier: "ed_now", codes: ["hct_raised_plt_drop"] },
  { name: "female HCT 39 + plt falling, hct rising", day: 4, labs: [{ day: 3, hct: 37, plt: 130 }, { day: 4, hct: 39, plt: 95 }], tier: "ed_now", codes: ["hct_rising_plt_falling"] },
  { name: "female HCT 41 + plt flat", day: 4, labs: [{ day: 3, hct: 41, plt: 130 }, { day: 4, hct: 41, plt: 130 }], tier: "home" },
  { name: "female HCT 41 + plt rising", day: 4, labs: [{ day: 3, hct: 41, plt: 90 }, { day: 4, hct: 41, plt: 110 }], tier: "home" },
  { name: "male<60 HCT 45 + plt falling, hct flat", profile: { sex: "male", age: 40 }, day: 4, labs: [{ day: 3, hct: 45, plt: 150 }, { day: 4, hct: 45, plt: 100 }], tier: "home" },
  { name: "male<60 HCT 46 + plt falling", profile: { sex: "male", age: 40 }, day: 4, labs: [{ day: 3, hct: 46, plt: 150 }, { day: 4, hct: 46, plt: 100 }], tier: "ed_now", codes: ["hct_raised_plt_drop"] },
  { name: "male age 60 uses 46", profile: { sex: "male", age: 60 }, day: 4, labs: [{ day: 3, hct: 44, plt: 150 }, { day: 4, hct: 44, plt: 100 }], tier: "home" },
  { name: "male age 61 uses 42", profile: { sex: "male", age: 61 }, day: 4, labs: [{ day: 3, hct: 42, plt: 150 }, { day: 4, hct: 42, plt: 100 }], tier: "ed_now", codes: ["hct_raised_plt_drop"] },
  { name: "male age 61 HCT 41", profile: { sex: "male", age: 61 }, day: 4, labs: [{ day: 3, hct: 41, plt: 150 }, { day: 4, hct: 41, plt: 100 }], tier: "home" },
  { name: "single lab only, raised HCT", day: 3, labs: [{ day: 3, hct: 45, plt: 90 }], tier: "home", absent: ["hct_raised_plt_drop"] },

  // --- rising HCT with falling platelets (7.3.1 lab criteria)
  { name: "hct rising plt falling below threshold", profile: { sex: "male", age: 30 }, day: 5, labs: [{ day: 4, hct: 40, plt: 120 }, { day: 5, hct: 43, plt: 80 }], tier: "ed_now", codes: ["hct_rising_plt_falling"] },
  { name: "hct rising plt rising", day: 5, labs: [{ day: 4, hct: 36, plt: 80 }, { day: 5, hct: 38, plt: 90 }], tier: "home" },
  { name: "hct falling plt falling", day: 5, labs: [{ day: 4, hct: 38, plt: 120 }, { day: 5, hct: 36, plt: 100 }], tier: "home" },
  { name: "three labs, trend uses last two", day: 6, labs: [{ day: 4, hct: 35, plt: 200 }, { day: 5, hct: 38, plt: 150 }, { day: 6, hct: 37, plt: 140 }], tier: "home" },
  { name: "three labs, last pair alarming", day: 6, labs: [{ day: 4, hct: 35, plt: 200 }, { day: 5, hct: 36, plt: 150 }, { day: 6, hct: 39, plt: 90 }], tier: "ed_now" },
  { name: "missing plt in previous", day: 5, labs: [{ day: 4, hct: 36 }, { day: 5, hct: 41, plt: 90 }], tier: "home" },
  { name: "missing hct today", day: 5, labs: [{ day: 4, hct: 36, plt: 120 }, { day: 5, plt: 90 }], tier: "home" },

  // --- special situations (7.3.1 item 3) → at least clinic today
  { name: "age 65 not special", profile: { age: 65 }, day: 2, tier: "home", absent: ["special_situation"] },
  { name: "age 66 special", profile: { age: 66 }, day: 2, tier: "clinic_today", codes: ["special_situation"] },
  { name: "pregnant", profile: { pregnant: true }, day: 1, tier: "clinic_today", codes: ["special_situation"] },
  { name: "comorbidity", profile: { comorbidity: true }, day: 2, tier: "clinic_today", codes: ["special_situation"] },
  { name: "anticoagulant", profile: { anticoagulant: true }, day: 2, tier: "clinic_today", codes: ["special_situation"] },
  { name: "lives alone", profile: { livesAlone: true }, day: 2, tier: "clinic_today", codes: ["special_situation"] },
  { name: "special + warning sign → ED", profile: { pregnant: true }, day: 2, signs: ["bleeding"], tier: "ed_now" },
  { name: "special + shock → emergency", profile: { age: 70 }, day: 4, signs: ["fainting"], tier: "emergency" },

  // --- missing-information flags
  { name: "no temperature flagged", day: 2, temp: null, tier: "home", codes: [] },

  // --- signs only count on the day they are reported
  { name: "yesterday's sign does not carry", day: 4, reviewed: true, labs: [{ day: 4, hct: 37, plt: 150 }], tier: "home" },

  // --- fever-coming-down trap: feeling better on day 5 with alarming labs
  { name: "afebrile day 5 but labs alarming", day: 5, temp: 36.8, labs: [{ day: 4, hct: 38, plt: 110 }, { day: 5, hct: 42, plt: 60 }], tier: "ed_now" },

  // --- the demo patient (Aisyah) day by day
  { name: "demo day 2", day: 2, temp: 39.1, tier: "home" },
  { name: "demo day 3", day: 3, temp: 38.6, labs: [{ day: 3, hct: 38, plt: 118 }], tier: "home" },
  { name: "demo day 4", day: 4, temp: 37.9, labs: [{ day: 3, hct: 38, plt: 118 }, { day: 4, hct: 38, plt: 104 }], tier: "home" },
  { name: "demo day 5", day: 5, temp: 37.2, signs: ["abdominal_pain", "persistent_vomiting", "lethargy"], labs: [{ day: 3, hct: 38, plt: 118 }, { day: 4, hct: 38, plt: 104 }, { day: 5, hct: 44, plt: 71 }], tier: "ed_now", codes: ["abdominal_pain", "vomiting", "lethargy", "hct_raised_plt_drop"] },
  { name: "a 1-point HCT rise with falling platelets still escalates", day: 4, labs: [{ day: 3, hct: 38, plt: 118 }, { day: 4, hct: 39, plt: 112 }], tier: "ed_now", codes: ["hct_rising_plt_falling"] },
];

function build(c: Case) {
  const profile: Profile = { ...base, ...c.profile };
  const byDay = new Map<number, DailyEntry>();
  const get = (n: number) => {
    if (!byDay.has(n)) byDay.set(n, { date: d(n), signs: {} });
    return byDay.get(n)!;
  };
  for (const l of c.labs ?? []) get(l.day).lab = { date: d(l.day), hct: l.hct, plt: l.plt };
  const t = get(c.day);
  if (c.temp !== null) t.tempC = c.temp ?? 38.5;
  t.reviewedByClinic = c.reviewed;
  for (const s of c.signs ?? []) t.signs[s] = true;
  // yesterday's sign for the "does not carry" case
  if (c.name === "yesterday's sign does not carry") get(c.day - 1).signs.abdominal_pain = true;
  return { profile, history: [...byDay.values()] };
}

describe("CPG rules engine", () => {
  it("counts the onset date as day 1", () => {
    expect(dayOfIllness("2026-11-01", "2026-11-01")).toBe(1);
    expect(dayOfIllness("2026-11-01", "2026-11-03")).toBe(3);
    expect(dayOfIllness("2026-10-30", "2026-11-02")).toBe(4);
  });
  it("uses the Malaysian median HCT lines", () => {
    expect(hctThreshold("female", 70)).toBe(40);
    expect(hctThreshold("male", 60)).toBe(46);
    expect(hctThreshold("male", 61)).toBe(42);
  });
  for (const c of cases) {
    it(c.name, () => {
      const { profile, history } = build(c);
      const a = assess(profile, history, d(c.day));
      const codes = a.reasons.map((r) => r.code);
      expect(a.tier).toBe(c.tier);
      for (const code of c.codes ?? []) expect(codes).toContain(code);
      for (const code of c.absent ?? []) expect(codes).not.toContain(code);
      if (c.temp === null) expect(a.missing.map((m) => m.code)).toContain("no_temp");
    });
  }
  it("has a large enough guideline test set", () => expect(cases.length).toBeGreaterThanOrEqual(50));
});

export { cases as RULE_CASES };

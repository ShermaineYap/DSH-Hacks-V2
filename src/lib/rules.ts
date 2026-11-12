// Deterministic triage rules transcribed from the Malaysian MOH
// "CPG Management of Dengue Infection in Adults" (3rd ed., 2015):
//   Table 2 (outpatient evaluation), Table 3 (warning signs),
//   Table 4 (home-care criteria), 7.2 (triage), 7.3.1 (referral criteria),
//   Appendix 9 (home-care leaflet danger signs).
// No machine-learned component can change the output of this module:
// the language model only proposes symptoms, the person confirms them,
// and these rules decide. Rules only ever escalate.

import type { Assessment, DailyEntry, LabResult, Profile, Reason, SignKey, Tier } from "./types";

const RANK: Record<Tier, number> = { home: 0, clinic_today: 1, ed_now: 2, emergency: 3 };

export function maxTier(a: Tier, b: Tier): Tier {
  return RANK[a] >= RANK[b] ? a : b;
}

/** Day of illness, counting the fever-onset date as day 1. */
export function dayOfIllness(onsetISO: string, onISO: string): number {
  const ms = Date.parse(onISO + "T00:00:00Z") - Date.parse(onsetISO + "T00:00:00Z");
  return Math.floor(ms / 86_400_000) + 1;
}

/** CPG Table 3 median normal HCT for Malaysians, used as the "raised HCT" line. */
export function hctThreshold(sex: Profile["sex"], age: number): number {
  if (sex === "female") return 40;
  return age > 60 ? 42 : 46;
}

const EMERGENCY_SIGNS: Partial<Record<SignKey, Reason>> = {
  cold_clammy: {
    code: "shock_skin",
    en: "Pale, cold or clammy skin can mean shock.",
    ms: "Kulit pucat, sejuk atau lembap boleh menandakan renjatan (shock).",
    source: "CPG Appendix 9 danger sign 5",
  },
  breathless: {
    code: "breathing",
    en: "Difficulty breathing.",
    ms: "Sukar bernafas.",
    source: "CPG Appendix 9 danger sign 6",
  },
  seizure: {
    code: "seizure",
    en: "A seizure (fit).",
    ms: "Sawan.",
    source: "CPG 7.3.1",
  },
  fainting: {
    code: "fainting",
    en: "Fainting or near-fainting.",
    ms: "Pengsan atau hampir pengsan.",
    source: "CPG 7.2 triage checklist",
  },
};

const ED_SIGNS: Partial<Record<SignKey, Reason>> = {
  abdominal_pain: {
    code: "abdominal_pain",
    en: "Abdominal pain or tenderness is a dengue warning sign.",
    ms: "Sakit atau senak perut ialah tanda amaran denggi.",
    source: "CPG Table 3",
  },
  persistent_vomiting: {
    code: "vomiting",
    en: "Vomiting more than 3 times in 24 hours is a warning sign.",
    ms: "Muntah lebih 3 kali dalam 24 jam ialah tanda amaran.",
    source: "CPG Table 3",
  },
  persistent_diarrhoea: {
    code: "diarrhoea",
    en: "Diarrhoea more than 3 times in 24 hours is a warning sign.",
    ms: "Cirit-birit lebih 3 kali dalam 24 jam ialah tanda amaran.",
    source: "CPG Table 3",
  },
  bleeding: {
    code: "bleeding",
    en: "Bleeding (gums, nose, red spots, black stool, heavy period) is a warning sign.",
    ms: "Pendarahan (gusi, hidung, bintik merah, najis hitam, haid berlebihan) ialah tanda amaran.",
    source: "CPG Table 3; Appendix 9",
  },
  lethargy: {
    code: "lethargy",
    en: "Unusual drowsiness, restlessness or confusion is a warning sign.",
    ms: "Terlalu lemah, gelisah atau keliru ialah tanda amaran.",
    source: "CPG Table 3",
  },
  poor_oral_intake: {
    code: "oral_intake",
    en: "Not able to keep fluids down.",
    ms: "Tidak boleh minum atau air keluar semula.",
    source: "CPG 7.3.1",
  },
  low_urine: {
    code: "urine",
    en: "Passing much less urine than usual.",
    ms: "Kencing jauh kurang daripada biasa.",
    source: "CPG 7.3.1",
  },
};

/** Latest lab strictly before `entry`'s lab date (for trend comparison). */
function previousLab(history: DailyEntry[], current: LabResult): LabResult | undefined {
  const labs = history
    .map((e) => e.lab)
    .filter((l): l is LabResult => !!l && l.date < current.date)
    .sort((a, b) => a.date.localeCompare(b.date));
  return labs[labs.length - 1];
}

function latestLab(history: DailyEntry[]): LabResult | undefined {
  const labs = history
    .map((e) => e.lab)
    .filter((l): l is LabResult => !!l)
    .sort((a, b) => a.date.localeCompare(b.date));
  return labs[labs.length - 1];
}

/** Assess the patient on `today`, given every entry up to and including today. */
export function assess(profile: Profile, history: DailyEntry[], today: string): Assessment {
  const entries = history.filter((e) => e.date <= today).sort((a, b) => a.date.localeCompare(b.date));
  const todayEntry = entries.find((e) => e.date === today);
  const day = dayOfIllness(profile.feverOnset, today);
  let tier: Tier = "home";
  const reasons: Reason[] = [];
  const missing: Reason[] = [];
  const notes: Reason[] = [];
  const bump = (t: Tier, r: Reason) => {
    tier = maxTier(tier, t);
    reasons.push(r);
  };

  // 1. Symptoms reported today (signs persist only for the day they are reported).
  const signs = todayEntry?.signs ?? {};
  for (const [k, r] of Object.entries(EMERGENCY_SIGNS)) if (signs[k as SignKey] && r) bump("emergency", r);
  for (const [k, r] of Object.entries(ED_SIGNS)) if (signs[k as SignKey] && r) bump("ed_now", r);

  // 2. Laboratory criteria (latest result vs the one before it).
  const lab = latestLab(entries);
  if (lab) {
    const prev = previousLab(entries, lab);
    const th = hctThreshold(profile.sex, profile.age);
    const pltFalling = prev?.plt != null && lab.plt != null && lab.plt < prev.plt;
    const hctRising = prev?.hct != null && lab.hct != null && lab.hct > prev.hct;
    if (lab.hct != null && lab.hct >= th && pltFalling) {
      bump("ed_now", {
        code: "hct_raised_plt_drop",
        en: `Haematocrit ${lab.hct}% is at or above ${th}% while platelets are falling (${prev!.plt} → ${lab.plt}).`,
        ms: `Hematokrit ${lab.hct}% mencapai atau melebihi ${th}% sementara platelet menurun (${prev!.plt} → ${lab.plt}).`,
        source: "CPG Table 3 (raised HCT with rapid drop in platelet)",
      });
    } else if (hctRising && pltFalling) {
      bump("ed_now", {
        code: "hct_rising_plt_falling",
        en: `Haematocrit is rising (${prev!.hct}% → ${lab.hct}%) while platelets are falling (${prev!.plt} → ${lab.plt}).`,
        ms: `Hematokrit meningkat (${prev!.hct}% → ${lab.hct}%) sementara platelet menurun (${prev!.plt} → ${lab.plt}).`,
        source: "CPG 7.3.1 laboratory criteria",
      });
    }
  }

  // 3. Daily review from day 3 of illness (Table 2, plan of management 4).
  if (day >= 3) {
    const reviewedToday = !!todayEntry?.reviewedByClinic || todayEntry?.lab?.date === today;
    if (!reviewedToday) {
      bump("clinic_today", {
        code: "daily_review",
        en: `Day ${day} of illness: the guideline asks for a clinic review and blood test every day from day 3.`,
        ms: `Hari ke-${day} sakit: garis panduan meminta pemeriksaan klinik dan ujian darah setiap hari bermula hari ke-3.`,
        source: "CPG Table 2 (daily follow-up from day 3)",
      });
    }
    if (!lab) {
      missing.push({
        code: "no_lab",
        en: "No blood result yet. Fasa cannot judge the critical phase without one.",
        ms: "Belum ada keputusan ujian darah. Fasa tidak dapat menilai fasa kritikal tanpanya.",
        source: "CPG Table 2 (FBC and HCT)",
      });
    }
  }

  // 4. Special situations that the CPG lists as referral criteria (7.3.1 item 3).
  const special: string[] = [];
  if (profile.age > 65) special.push("age over 65");
  if (profile.pregnant) special.push("pregnancy");
  if (profile.comorbidity) special.push("a long-term illness");
  if (profile.anticoagulant) special.push("blood-thinning medicine");
  if (profile.livesAlone) special.push("living alone");
  if (special.length) {
    bump("clinic_today", {
      code: "special_situation",
      en: `The guideline lists ${special.join(", ")} as reasons for hospital-based care. Ask your doctor whether you should be admitted.`,
      ms: `Garis panduan menyenaraikan keadaan anda sebagai sebab untuk rawatan di hospital. Tanya doktor sama ada anda perlu dimasukkan ke wad.`,
      source: "CPG 7.3.1 special situations",
    });
  }

  // 5. Missing temperature today.
  if (!todayEntry || todayEntry.tempC == null) {
    missing.push({
      code: "no_temp",
      en: "No temperature recorded today.",
      ms: "Tiada bacaan suhu hari ini.",
      source: "CPG Appendix 7 monitoring record",
    });
  }

  // Notes (never change the tier).
  if (day >= 3 && day <= 7) {
    notes.push({
      code: "critical_window",
      en: "Days 3 to 7 are when the critical phase usually happens, often as the fever comes down. Feeling better is not a reason to stop checking.",
      ms: "Hari ke-3 hingga ke-7 ialah masa fasa kritikal biasanya berlaku, selalunya ketika demam mula turun. Rasa lebih baik bukan sebab untuk berhenti memeriksa.",
      source: "CPG 6 (critical phase after day 3, lasts 24-48 h)",
    });
  }
  notes.push({
    code: "home_care",
    en: "Drink more than 2 litres a day (not plain water only), take paracetamol (max 4 g/day), and avoid aspirin, mefenamic acid and other NSAIDs.",
    ms: "Minum lebih 2 liter sehari (bukan air kosong sahaja), ambil parasetamol (maksimum 4 g sehari), dan elakkan aspirin, asid mefenamik dan NSAID lain.",
    source: "CPG Appendix 9",
  });

  return { tier, dayOfIllness: day, reasons, missing, notes };
}

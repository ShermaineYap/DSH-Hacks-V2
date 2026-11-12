// Core data model for Fasa. Everything is stored on the device only.

export type Sex = "male" | "female";
export type Lang = "en" | "ms";

/** Patient-reportable symptoms. Keys map to MOH CPG Dengue (3rd ed., 2015) Table 3,
 *  section 7.3.1 and the Appendix 9 home-care leaflet "danger signs". */
export type SignKey =
  | "abdominal_pain" // Table 3: any abdominal pain/tenderness
  | "persistent_vomiting" // Table 3: >3 times over 24 h
  | "persistent_diarrhoea" // Table 3: >3 times over 24 h
  | "bleeding" // Table 3 + 7.3.1: spontaneous bleeding tendency
  | "lethargy" // Table 3: lethargy / restlessness / confusion
  | "poor_oral_intake" // 7.3.1: inability to tolerate oral fluids
  | "low_urine" // 7.3.1: reduced urine output
  | "breathless" // Appendix 9 danger sign 6 (+ Table 3 fluid accumulation)
  | "cold_clammy" // Appendix 9 danger sign 5 (shock)
  | "fainting" // 7.2 triage checklist: dizziness/fainting
  | "seizure"; // 7.3.1

export interface LabResult {
  date: string; // ISO yyyy-mm-dd
  hct?: number; // %
  plt?: number; // x10^3 /uL
  hb?: number; // g/dL
  wcc?: number; // x10^3 /uL
  source?: "ocr" | "manual" | "demo";
}

export interface DailyEntry {
  date: string; // ISO yyyy-mm-dd
  tempC?: number;
  tookAntipyretic?: boolean;
  signs: Partial<Record<SignKey, boolean>>;
  freeText?: string;
  reviewedByClinic?: boolean; // seen by a clinic today
  lab?: LabResult;
}

export interface Profile {
  name?: string;
  feverOnset: string; // ISO date, day 1 of illness
  age: number;
  sex: Sex;
  pregnant?: boolean;
  comorbidity?: boolean; // diabetes, hypertension, heart, kidney, liver, COPD, obesity, bleeding disorder
  anticoagulant?: boolean; // anti-platelet / anticoagulant medicine
  livesAlone?: boolean; // social factor limiting follow-up
}

export type Tier = "emergency" | "ed_now" | "clinic_today" | "home";

export interface Reason {
  code: string;
  en: string;
  ms: string;
  source: string; // where in the CPG this rule comes from
}

export interface Assessment {
  tier: Tier;
  dayOfIllness: number;
  reasons: Reason[];
  missing: Reason[]; // information Fasa needs but does not have
  notes: Reason[]; // non-escalating guidance
}

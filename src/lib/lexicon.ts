// Offline, on-device symptom extractor for Malay, English and code-switched
// messages. It runs everywhere (no network) and is combined with the LLM
// extractor by UNION, so the model can add a sign but never remove one.

import type { SignKey } from "./types";

export interface Extraction {
  signs: SignKey[];
  /** Signs mentioned but not clearly meeting the CPG definition; the app asks a follow-up. */
  ask: SignKey[];
  evidence: Partial<Record<SignKey, string>>;
}

const NUM: Record<string, number> = {
  satu: 1, sekali: 1, one: 1, once: 1, dua: 2, two: 2, twice: 2, tiga: 3, three: 3, thrice: 3,
  empat: 4, four: 4, lima: 5, five: 5, enam: 6, six: 6, tujuh: 7, seven: 7, lapan: 8, eight: 8,
  sembilan: 9, nine: 9, sepuluh: 10, ten: 10, belas: 11, puluh: 20,
};

const NEGATORS =
  /\b(tak|x|tidak|tiada|takde|xde|tade|tk|bukan|belum|no|not|never|without|nope|don't|doesn't|didn't|isn't|ain't|dah\s+tak|dah\s+x|xda|takda|tak\s+ada|tiada\s+lagi|no\s+more|stopped|berhenti|hilang|dah\s+ok|dah\s+okay)\b/;

type Rule = { key: SignKey; re: RegExp; count?: boolean };

const RULES: Rule[] = [
  { key: "abdominal_pain", re: /(sakit\s+(kat\s+|di\s+|dekat\s+)?perut|perut\s+(rasa\s+)?(sakit|pedih|senak|memulas|ngilu|tak\s+selesa|bengkak)|\bsenak\b|memulas|pedih\s+perut|ulu\s+hati|(stomach|tummy|belly|abdomen|abdominal)\s*(ache|pain|cramp|hurt|is\s+painful|very\s+painful|sakit|pain(ful)?)|(stomach|tummy|belly)\s*(really\s+|very\s+|so\s+)?(hurts?|sore|painful)|abdominal\s+pain|stomachache|tummyache|cramps?\s+in\s+(my\s+)?(stomach|tummy))/ },
  { key: "persistent_vomiting", re: /(muntah|mntah|mutah|vomit\w*|throw(ing|n)?\s+up|threw\s+up|puk(e|ing))/, count: true },
  { key: "persistent_diarrhoea", re: /(cirit[\s-]*birit|cirit|berak\s+cair|buang\s+air\s+besar\s+cair|bab\s+cair|najis\s+cair|diarr?h?o?ea|diarrhea|loose\s+(stool|motion)s?|watery\s+stools?|lo+se\s+motion)/, count: true },
  { key: "bleeding", re: /(berdarah|\bdarah\b|blood|bleed\w*|nosebleed|bintik[\s-]*(bintik[\s-]*)?(merah|ungu)|tompok\s+merah|red\s+(dots?|spots?|patches)|purple\s+(dots?|spots?)|petechia\w*|lebam|bruis\w*|(najis|berak|tahi|stool|poo|poop)\s+(warna\s+)?hitam|black\s+(stools?|poo|poop|motion)|(haid|period|datang\s+bulan|menstruation)\s+(sangat\s+|terlalu\s+|very\s+|so\s+)?(banyak|heavy|lebat)(\s+sangat)?|tukar\s+pad\s+(setiap|tiap)|heavy\s+(period|menstruation|bleeding))/ },
  { key: "lethargy", re: /(lemah\s+(sangat|sgt|sangat2|giler|gila|teruk)|(sangat|sgt|terlalu|amat)\s+lemah|lembik|lesu\s+(sangat|sgt)|tak\s+larat\s+(nak\s+)?bangun|x\s+larat|tak\s+larat|tak\s+boleh\s+bangun|x\s+boleh\s+bangun|tak\s+bermaya|mengantuk\s+(sangat|sgt|luar\s+biasa|je|aje|sahaja|semacam)|asyik\s+(tidur|mengantuk)|susah\s+(nak\s+)?(bangun|dikejut)|gelisah|resah|keliru|merepek|meracau|confus\w*|disorient\w*|restless|drows\w*|letharg\w*|(very|extremely|so|super|too)\s+(weak|sleepy|lethargic)|can'?t\s+(get\s+up|wake)|cannot\s+(get\s+up|wake)|hard\s+to\s+wake|no\s+energy\s+at\s+all|very\s+the\s+(weak|tired|sleepy))/ },
  { key: "poor_oral_intake", re: /((tak|x|tidak|tk)\s+(boleh|lalu|dapat|mampu|nak|mahu)\s+minum|minum\s+(pun|je|sikit\s+pun)?\s*(muntah|keluar|termuntah)|setiap\s+kali\s+minum|tiap\s+kali\s+minum|can'?t\s+(drink|keep\s+(anything|water|fluids?|drinks?)\s+down)|cannot\s+(drink|keep\s+(anything|water|fluids?)\s+down)|unable\s+to\s+drink|refus\w+\s+(to\s+)?(drink|fluids?|water)|won'?t\s+drink|not\s+drinking|every\s*time\s+(i|he|she)\s+drink)/ },
  { key: "low_urine", re: /((kurang|sikit|sedikit|jarang)\s+(sangat\s+)?kencing|kencing\s+(sangat\s+)?(kurang|sikit|sedikit|jarang)|(tak|x|tidak|belum|tk)\s+(lagi\s+)?(kencing|buang\s+air\s+kecil|pee\w*|urinat\w*)|(not|haven'?t|hasn'?t|didn'?t|no)\s+(peed?|urinat\w*|pass(ed)?\s+urine)|hardly\s+(pee|urinat)\w*|(less|little|very\s+little|no)\s+(urine|pee)|pee\w*\s+(very\s+)?(little|less)|urine\s+(very\s+)?(little|less))/ },
  { key: "breathless", re: /(sesak\s+nafas|susah\s+(nak\s+)?(bernafas|nafas)|sukar\s+bernafas|susah\s+(nak\s+)?breath\w*|tercungap|semput|nafas\s+(laju|pendek|tersekat)|short(ness)?\s+of\s+breath|breathless|hard\s+to\s+breathe|difficult\w*\s+(to\s+)?breath\w*|can'?t\s+breathe|cannot\s+breathe|trouble\s+breathing|breathing\s+(is\s+)?(hard|difficult|fast))/ },
  { key: "cold_clammy", re: /((tangan|kaki|badan|kulit)\s+(dan\s+(kaki|tangan)\s+)?(rasa\s+)?sejuk|peluh\s+sejuk|berpeluh\s+sejuk|\bpucat\b|cold\s+(hands|feet|sweat|and\s+clammy|skin)|clammy|\bpale\b|hands?\s+(and\s+feet\s+)?(are\s+|very\s+|so\s+)?cold|feet\s+(are\s+|very\s+)?cold)/ },
  { key: "fainting", re: /(pengsan|pitam|nak\s+pitam|berpinar|pandangan\s+gelap|pening\s+(sangat|sgt|teruk|gila)\s*(bila|masa|kalau)?\s*(bangun|berdiri)?|pening\s+(bila|masa|kalau)\s+(bangun|berdiri)|faint\w*|black(ed)?\s*out|pass(ed)?\s+out|(very|so|super)\s+dizzy|dizzy\s+(when|whenever|if)\s+(i\s+|she\s+|he\s+)?(stand|get\s+up|got\s+up))/ },
  { key: "seizure", re: /(sawan|kejang|seizure|convuls\w*|tersentak[\s-]*sentak|(had|having|kena)\s+(a\s+)?fits?)/ },
];

const PERSISTENT_WORDS =
  /(banyak\s+kali|berkali[\s-]*kali|asyik|tak\s+berhenti|x\s+berhenti|tak\s+henti|non[\s-]?stop|continuous\w*|keep(s)?\s+(on\s+)?(vomit|throw|puk|go|having)|many\s+times|so\s+many\s+times|all\s+(day|night)|whole\s+(day|night)|setiap\s+kali|tiap\s+kali|every\s*time|repeated\w*|can'?t\s+stop|cannot\s+stop|lots?\s+of\s+times|sepanjang\s+(hari|malam)|teruk|countless|banyak\s+sangat)/;

const PAST = /\b(semalam|kelmarin|yesterday|last\s+week|minggu\s+lepas|the\s+other\s+day|hari\s+tu)\b/;
const SINCE = /\b(sejak|dari|since|from)\s+(semalam|kelmarin|yesterday)\b/;
const TODAY = /\b(hari\s+ini|harini|arini|today|now|sekarang|pagi\s+ni|still|masih)\b/;

function toNumber(tok: string): number | undefined {
  if (/^\d+$/.test(tok)) return parseInt(tok, 10);
  return NUM[tok];
}

/** Find a count like "4 kali", "4x", "5 times", "dua kali", "lebih 3 kali" near the match. */
function countNear(clause: string, at: number, len: number): { n?: number; more?: boolean } {
  const win = clause.slice(Math.max(0, at - 30), Math.min(clause.length, at + len + 30));
  const m =
    win.match(/(lebih\s+(dari(pada)?\s+)?|more\s+than\s+|over\s+|>\s*)?(\d+|satu|dua|tiga|empat|lima|enam|tujuh|lapan|sembilan|sepuluh|one|two|three|four|five|six|seven|eight|nine|ten)\s*(kali|x|times|kli|kalii)\b/) ||
    win.match(/\b(sekali|once|twice|thrice)\b/);
  if (!m) return {};
  if (m.length === 2) return { n: toNumber(m[1]) };
  const n = toNumber(m[4]);
  return { n, more: !!m[1] };
}

function normalise(s: string): string {
  return s
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .replace(/\bsgt\b/g, "sangat")
    .replace(/\b(byk|bnyk|bnyak)\b/g, "banyak")
    .replace(/\b(sakti|skt|sakt)\b/g, "sakit")
    .replace(/\bdont\b/g, "don't")
    .replace(/\b(doesnt|didnt|havent|cant|wont|isnt)\b/g, (w) => w.slice(0, -1) + "'t")
    .replace(/\bmcm\b/g, "macam")
    .replace(/\bdlm\b/g, "dalam")
    .replace(/\bkt\b/g, "kat")
    .replace(/\bpstu\b/g, "lepas tu")
    .replace(/(\d)\s*x\b/g, "$1 kali")
    .replace(/\s+/g, " ");
}

function clauses(s: string): string[] {
  return s.split(/[.;!?\n]|,|\btapi\b|\bbut\b|\bcuma\b|\bjust\b|\bhowever\b|\bpun\s+dah\b/).map((c) => c.trim()).filter(Boolean);
}

function negated(clause: string, at: number): boolean {
  const before = clause.slice(Math.max(0, at - 28), at);
  if (NEGATORS.test(before)) return true;
  const after = clause.slice(at, at + 60);
  return /\b(dah\s+(berhenti|hilang|ok|okay|baik|takde|tak\s+ada)|stopped|gone|no\s+more|tak\s+ada\s+dah|tiada\s+lagi|takde\s+dah|xde\s+dah)\b/.test(after);
}

export function extractLexicon(text: string): Extraction {
  const out = new Set<SignKey>();
  const ask = new Set<SignKey>();
  const evidence: Extraction["evidence"] = {};
  const norm = normalise(text);
  for (const clause of clauses(norm)) {
    for (const r of RULES) {
      const re = new RegExp(r.re.source, "g");
      let m: RegExpExecArray | null;
      while ((m = re.exec(clause))) {
        // low_urine and poor_oral_intake patterns contain their own negation words
        const selfNegating = r.key === "low_urine" || r.key === "poor_oral_intake";
        if (!selfNegating && negated(clause, m.index)) continue;
        if (PAST.test(clause) && !TODAY.test(clause) && !SINCE.test(clause)) {
          ask.add(r.key); // reported for an earlier day: confirm whether it is still happening
          continue;
        }
        if (r.count) {
          const c = countNear(clause, m.index, m[0].length);
          if (c.n != null) {
            if (c.n > 3 || (c.more && c.n >= 3)) out.add(r.key);
            // <=3 times: below the CPG threshold, not a warning sign
          } else if (PERSISTENT_WORDS.test(clause)) {
            out.add(r.key);
          } else {
            ask.add(r.key); // mentioned without a count: ask how many times
          }
        } else {
          out.add(r.key);
        }
        if (out.has(r.key) && !evidence[r.key]) evidence[r.key] = clause;
      }
    }
  }
  for (const k of out) ask.delete(k);
  return { signs: [...out], ask: [...ask], evidence };
}

# Fasa: dengue at home, one day at a time

**Live:** https://dsh-hacks-v2-jade.vercel.app · **Evidence:** https://dsh-hacks-v2-jade.vercel.app/evidence · Built for DSH Hacks V2 (AI × Healthcare)

Most Malaysian dengue patients are sent home. The Ministry of Health's dengue guideline says the critical phase usually starts after day 3, that outpatients should be reviewed every day from day 3, and that any of eight warning signs means hospital. Fasa turns that guideline into a daily companion. Each day it answers one question: **rest at home, get checked at a clinic today, or go to hospital now**, and it says why.

## What it does

- **Day clock** from the first day of fever, with the critical days (3–7) shaded.
- **Check-in** by tapping symptoms or writing in Malay, English or both. Gemini and on-device rules find the CPG warning signs; the results are combined by union, so the model can add a sign but never remove one.
- **Blood-slip reading.** Gemini vision reads HCT, platelets, Hb and WBC. Every value is shown beside the text it was read from and confirmed by the person before it counts. Big day-to-day jumps are flagged. On-device Tesseract is the offline fallback.
- **Deterministic rules engine** transcribed from the MOH *CPG Management of Dengue Infection in Adults* (3rd ed., 2015): Tables 2–4, section 7.3.1 and Appendix 9, including the Malaysian HCT lines (40% women, 46% men ≤60, 42% men >60).
- **Trend charts** and a **printable handover** laid out like the MOH Outpatient Dengue Monitoring Record, plus a warning-sign column.
- **Bahasa Melayu / English**, a demo patient, and no account. The record stays in the phone's local storage.

## Evaluation

| What | Result | Script |
|---|---|---|
| Rules engine | 56/56 CPG cases | `npm test` |
| Free-text signs (held-out, n=61) | Union (shipped): 97% fully right, recall 1.00 (0 signs missed), 2 false alarms. On-device only: 87%, recall 0.85 | `scripts/eval-symptoms.ts`, `scripts/eval-live.ts` |
| Slip reading (held-out, 30 slips) | Gemini vision: HCT + platelets right on 30/30, 0 wrong values. On-device OCR: 13/30, 3 wrong values | `scripts/eval-ocr.ts`, `scripts/eval-live.ts` |

Details, splits and limits are on the [evidence page](https://dsh-hacks-v2-jade.vercel.app/evidence) and in `eval/results/`.

## Run it

```bash
npm install
echo "GEMINI_API_KEY=your-key" > .env.local   # optional; without it Fasa uses on-device rules and OCR
npm run dev
npm test                                       # rules + slip-parser unit tests
```

## Safety and limits

Fasa follows the guideline to tell people **when to get checked**. It does not diagnose, it is not a medical device, and it has not been tested with patients or clinicians. The rules cover adults only. Messages or slip photos that a person chooses to have read are sent to Google's Gemini API; Fasa's server stores nothing.

## Licence

MIT. Narration in the demo video is an AI-generated voice (Piper, Lessac).

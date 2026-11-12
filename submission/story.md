## Inspiration

Malaysia has recorded 79,686 dengue cases this year (to 31 October 2026), up about 29% on last year in the first half, with deaths up by two-thirds. Most patients are not admitted. They are sent home from a Klinik Kesihatan with a reminder to come back tomorrow.

The Ministry of Health's dengue guideline (CPG, 3rd edition) is very clear about what should happen next. The critical phase usually starts **after day 3**, often just as the fever comes down. Outpatients should be reviewed **every day from day 3**. And there are **eight warning signs**, any one of which means hospital. One study at Hospital Universiti Sains Malaysia found that "any warning sign" catches 91% of severe dengue, while single signs on their own are weak.

So the guideline asks a feverish person at home to track a day count, eight signs and a blood-count trend. What they actually carry home is the MOH *Outpatient Dengue Monitoring Record*: a paper form with columns for temperature and blood counts and no space at all for symptoms. The one Malaysian app trial for dengue home monitoring (DengueAid, University of Malaya, n=37) found limited utility, and its authors called for a redesign.

**Fasa** (Malay for *phase*) is that redesign: the guideline, turned into a daily companion that tells you which day it is and what to do about it.

## What it does

Fasa is a mobile-first web app with three possible answers each day:

- **You can keep resting at home today** (with the next blood test due tomorrow),
- **Get checked at a clinic today**, or
- **Go to a hospital emergency department now** (or **call 999** for shock signs).

Every answer lists its reasons, and each reason cites the guideline table it comes from.

1. **A day clock.** Fasa counts days from the first day of fever and shades the critical days, 3 to 7. On a green day it still says "Tomorrow is day 4: get a blood test and clinic review, even if you feel better."
2. **A check-in in your own words.** Tap symptoms, or write how you feel in Malay, English or both ("sakit perut teruk, muntah 4 kali sejak pagi, lemah sgt"). Gemini picks out the guideline's warning signs. On-device rules run alongside, and the two are **combined by union, so the model can add a sign but never remove one**. If a count is missing ("muntah" with no number), Fasa asks "how many times in 24 hours?" instead of guessing, because the guideline threshold is *more than 3*.
3. **Blood-slip reading with a confirm step.** Photograph the FBC slip. Gemini vision reads haematocrit, platelets, Hb and white cells and shows the **printed text beside each number**. Nothing is saved until the person confirms it, and a big jump from yesterday's value is flagged for a second look. With no network or no key, an on-device Tesseract reader is the fallback.
4. **A rules engine that decides.** Deterministic TypeScript transcribed from CPG Tables 2–4, section 7.3.1 and Appendix 9. This includes the Malaysian haematocrit lines (40% for women, 46% for men up to 60, 42% for men over 60), "rising HCT with falling platelets", the special situations the CPG refers to hospital (over 65, pregnancy, long-term illness, blood thinners, living alone) and the daily-review rule.
5. **Trend charts** for platelets and haematocrit, with the person's own HCT line drawn on the chart.
6. **A handover** printed in the layout of the MOH monitoring record, plus the warning-sign column the paper form lacks.
7. **Bahasa Melayu and English** throughout. A demo patient (Aisyah, days 1–5) lets judges step through the story without typing anything.

## How we built it

- **Next.js 15 + TypeScript + Tailwind on Vercel.** The record lives in the phone's local storage, with no account and no database. Only a message or slip photo the person chooses is sent to Google's Gemini API, and Fasa's server stores nothing.
- **`src/lib/rules.ts`**: the decision. It is pure functions, with 56 hand-written guideline cases in Vitest covering every warning sign, every threshold boundary and each special situation.
- **`src/lib/lexicon.ts`**: an offline Malay/English/code-switched extractor that handles SMS spelling ("x", "sgt", "byk"), negation ("tak muntah dah", "dont have"), counts ("muntah 4x", "lebih 3 kali") and past-only mentions ("semalam pengsan").
- **`/api/extract` and `/api/read-slip`**: Gemini with JSON response schemas at temperature 0. Model names change, so the server lists the Flash models the key can call and falls through to the next one when a model is retired, overloaded or has no free-tier quota.
- **Evaluation scripts** in `scripts/`, with results in `eval/results/`.

## How well it works (measured)

All of these are on data the tuned component never saw:

| What | Result |
|---|---|
| Guideline rules engine | **56 / 56** hand-written CPG cases pass |
| Free-text signs, on-device rules only | {{LEX}} |
| Free-text signs, Gemini alone | {{LLM}} |
| Free-text signs, union (as shipped) | {{UNION}} |
| Blood slips, on-device OCR | {{OCR}} |
| Blood slips, Gemini vision | {{VISION}} |

The symptom test set is 120 Malay/English/mixed messages written and labelled by a separate agent that never saw the extractor. It was split 50/50 with a fixed hash. I tuned the on-device rules on the development half only and scored the held-out half once. The slip test set is 30 mock FBC slips (three layouts, fictional clinics) in clean, phone-photo and dim conditions, generated with a different random seed from the 30 slips I tuned on.

## Challenges we ran into

- **Raw OCR was not good enough to trust.** On held-out dim phone photos, Tesseract read haematocrit and platelets correctly on 0 of 10, and it sometimes showed a *wrong* number with no warning. A silently wrong platelet count is the most dangerous failure this app could have. So the confirm-every-value step, the printed-text echo and the jump flag became core features, not polish.
- **Keeping the model out of the decision.** It's tempting to let an LLM "assess" dengue. Instead the LLM only structures input, the person confirms it, and code decides. Union merging means a model miss cannot downgrade advice.
- **Code-switched Malay.** "x" means "not" in "x boleh minum" but "times" in "4x". "Semalam pengsan" (fainted yesterday) is different from "pengsan sejak semalam" (fainting since yesterday).
- **Shipping under real-world churn.** The Gemini model I first wired up had been retired, and the newest one had no free-tier quota, so the server now discovers a working model at runtime.

## Accomplishments that we're proud of

- A complete, deployed product that follows a real national guideline line by line, with every rule citing its source.
- Honest, reproducible numbers, including the ones that look bad.
- A design that answers one question at a time, in two languages, for someone who feels terrible.

## What we learned

The interesting AI problem here isn't diagnosis. It's turning messy human input (a code-switched message, a crumpled slip) into the exact structured facts a trusted rule needs, and being explicit about uncertainty when that fails.

## Limitations

- Fasa has **not been tested with patients or clinicians**, and the test messages and slips are synthetic.
- The rules cover the **adult** CPG (2015). Children are out of scope.
- People cannot assess some signs at home (tender liver, fluid in the chest or abdomen), and the CPG itself says decisions rest on a *total clinical assessment*. That is why Fasa sends people to the daily clinic review rather than replacing it.
- Handwritten slips were not tested.
- Fasa is not a medical device and does not replace a doctor.

## What's next

- Review of the rules and wording by Malaysian primary-care doctors, then a small usability study with outpatients.
- A WhatsApp check-in, since that's where Malaysians already are.
- A clinic-side view of the handover, and Tamil and Chinese language support.

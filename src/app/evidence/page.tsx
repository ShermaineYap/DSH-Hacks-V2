import Link from "next/link";
import summary from "../../../eval/results/summary.json";

export const metadata = { title: "How well Fasa works" };

type Scores = { exact_match: number; micro_precision: number; micro_recall: number; missed_signs: number; false_alarms: number } | null;
type OcrBlock = { n: number; hct_and_plt_both_ok: number; silent_wrong_hct_or_plt: number; by_condition: Record<string, { n: number; both_ok: number; silent_wrong: number }>; median_ms: number } | null;

const pct = (x: number) => `${Math.round(x * 100)}%`;

export default function Evidence() {
  const s = summary as unknown as {
    rules: { cases: number; passed: number };
    symptoms: { n: number; lexicon: Scores; llm: Scores; union: Scores; llm_median_ms?: number; llm_model?: string };
    ocr_on_device: OcrBlock;
    ocr_vision: OcrBlock & { model?: string };
  };
  const rows: [string, Scores][] = [
    ["On-device rules (offline)", s.symptoms.lexicon],
    ["Gemini alone", s.symptoms.llm],
    ["Union, as shipped", s.symptoms.union],
  ];
  return (
    <main className="mx-auto max-w-[720px] px-4 pb-24 pt-6 sm:px-6">
      <Link href="/" className="text-[15px] font-semibold underline underline-offset-4">
        Back to Fasa
      </Link>
      <h1 className="mt-6 text-[34px] font-extrabold leading-tight tracking-[-0.02em]">How well Fasa works</h1>
      <p className="mt-3 text-[16px] leading-relaxed text-ink-2">
        Every number on this page comes from a script in the public repository (<code>scripts/</code>), run on data that the tuned component never saw. The test sets are synthetic, so they measure the software, not clinical outcomes.
      </p>

      <h2 className="mt-10 text-xl font-bold">1. The decision: guideline rules</h2>
      <p className="mt-2 text-[16px] leading-relaxed">
        <b>{s.rules.passed} of {s.rules.cases}</b> hand-written guideline cases pass, covering every warning sign, the shock signs, the Malaysian HCT lines (40% women, 46% men up to 60, 42% men over 60), age 65/66 and day 2/3 boundaries, and falling vs flat platelets. The decision is deterministic code transcribed from the MOH dengue CPG (2015), so it is tested, not trained. No language model can lower the tier.
      </p>

      <h2 className="mt-10 text-xl font-bold">2. Reading a free-text message</h2>
      <p className="mt-2 text-[16px] leading-relaxed">
        {s.symptoms.n} held-out messages in Malay, English and mixed, written by a separate agent that never saw the extractor, labelled with the 11 CPG signs. The on-device rules were tuned on a separate development half and frozen before this half was scored once.
      </p>
      <div className="mt-3 overflow-x-auto rounded-2xl border border-line bg-surface">
        <table className="w-full min-w-[520px] text-[15px]">
          <thead className="text-left text-ink-2">
            <tr>
              {["Extractor", "Message fully right", "Precision", "Recall", "Missed signs", "False alarms"].map((h) => (
                <th key={h} className="border-b border-line px-3 py-2 font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(([name, r]) => (
              <tr key={name}>
                <td className="border-b border-line px-3 py-2 font-semibold">{name}</td>
                {r ? (
                  <>
                    <td className="border-b border-line px-3 py-2">{pct(r.exact_match)}</td>
                    <td className="border-b border-line px-3 py-2">{r.micro_precision.toFixed(2)}</td>
                    <td className="border-b border-line px-3 py-2">{r.micro_recall.toFixed(2)}</td>
                    <td className="border-b border-line px-3 py-2">{r.missed_signs}</td>
                    <td className="border-b border-line px-3 py-2">{r.false_alarms}</td>
                  </>
                ) : (
                  <td colSpan={5} className="border-b border-line px-3 py-2 text-ink-3">not yet measured</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[14px] text-ink-3">
        The tap-to-select symptom list is always shown, so a missed sign in the message can still be entered directly. When a count is missing (“muntah” with no number), Fasa asks how many times instead of guessing.
        {s.symptoms.llm_model ? ` Model: ${s.symptoms.llm_model}, median ${s.symptoms.llm_median_ms} ms per message. “Gemini alone” counts 2 API errors as misses; the shipped union still had the on-device result for those messages.` : ""}
      </p>

      <h2 className="mt-10 text-xl font-bold">3. Reading a blood-test slip</h2>
      <p className="mt-2 text-[16px] leading-relaxed">
        30 mock FBC slips (three layouts, fictional clinics, generated with a different random seed from the slips used while building) in three conditions: a clean scan, a tilted and blurred phone photo, and a dim, small, tilted photo. A slip counts as read correctly when both haematocrit and platelets are right, because those two drive the decision.
      </p>
      <div className="mt-3 overflow-x-auto rounded-2xl border border-line bg-surface">
        <table className="w-full min-w-[520px] text-[15px]">
          <thead className="text-left text-ink-2">
            <tr>
              {["Reader", "Clean", "Phone photo", "Dim photo", "Wrong number shown"].map((h) => (
                <th key={h} className="border-b border-line px-3 py-2 font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {([["On-device OCR (Tesseract)", s.ocr_on_device], ["Gemini vision", s.ocr_vision]] as [string, OcrBlock][]).map(([name, o]) => (
              <tr key={name}>
                <td className="border-b border-line px-3 py-2 font-semibold">{name}</td>
                {o ? (
                  <>
                    {["clean", "photo", "dim"].map((c) => (
                      <td key={c} className="border-b border-line px-3 py-2">{o.by_condition[c].both_ok}/{o.by_condition[c].n}</td>
                    ))}
                    <td className="border-b border-line px-3 py-2">{o.silent_wrong_hct_or_plt}/{o.n}</td>
                  </>
                ) : (
                  <td colSpan={4} className="border-b border-line px-3 py-2 text-ink-3">not yet measured</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[14px] text-ink-3">
        Because any reader can show a wrong number, Fasa never saves a value without the person checking it against the slip: each field shows the text it was read from, and a jump of more than about half the previous platelet count or 9 HCT points is flagged for a second look.
      </p>

      <h2 className="mt-10 text-xl font-bold">Limits</h2>
      <ul className="mt-2 list-disc space-y-2 pl-5 text-[16px] leading-relaxed">
        <li>Fasa has not been tested with patients or clinicians. The test messages and slips are synthetic.</li>
        <li>The rules follow the 2015 adult CPG. They do not cover children, and the CPG itself says decisions should rest on a total clinical assessment, which only a clinician can make.</li>
        <li>People cannot check some warning signs at home (tender liver, fluid in the chest or abdomen), so a home record is always less complete than a clinic review. That is why Fasa sends people to daily clinic reviews from day 3, as the CPG asks.</li>
        <li>Handwritten slips were not tested.</li>
      </ul>
    </main>
  );
}

"use client";

import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { dayOfIllness } from "@/lib/rules";
import { t } from "@/lib/i18n";
import type { DailyEntry, Lang, Profile } from "@/lib/types";

export function Trend({ entries, profile, lang, threshold }: { entries: DailyEntry[]; profile: Profile; lang: Lang; threshold: number }) {
  const data = entries
    .filter((e) => e.lab)
    .map((e) => ({ day: dayOfIllness(profile.feverOnset, e.lab!.date), hct: e.lab!.hct, plt: e.lab!.plt }));
  if (data.length < 1) return null;
  const dayLabel = t("day", lang);
  return (
    <section className="mt-10" aria-labelledby="trend-h">
      <h2 id="trend-h" className="text-xl font-bold">
        {t("trend", lang)}
      </h2>
      <p className="mt-1 text-[14px] text-ink-2">
        {lang === "ms"
          ? `Bahaya apabila hematokrit naik (garis putus-putus = ${threshold}%) sementara platelet jatuh.`
          : `The danger pattern is haematocrit rising (dashed line = ${threshold}%) while platelets fall.`}
      </p>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <Panel title={lang === "ms" ? "Platelet (×10³/µL)" : "Platelets (×10³/µL)"} data={data} k="plt" color="var(--ed)" dayLabel={dayLabel} domain={[0, "auto"]} />
        <Panel title={lang === "ms" ? "Hematokrit (%)" : "Haematocrit (%)"} data={data} k="hct" color="var(--ink)" dayLabel={dayLabel} domain={[30, 55]} refLine={threshold} />
      </div>
    </section>
  );
}

function Panel({
  title, data, k, color, dayLabel, domain, refLine,
}: {
  title: string; data: { day: number; hct?: number; plt?: number }[]; k: "hct" | "plt"; color: string; dayLabel: string; domain: [number, number | "auto"]; refLine?: number;
}) {
  return (
    <figure className="rounded-2xl border border-line bg-surface p-3">
      <figcaption className="text-[14px] font-semibold text-ink-2">{title}</figcaption>
      <div className="mt-2 h-40">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
            <CartesianGrid stroke="var(--line)" vertical={false} />
            <XAxis dataKey="day" tickFormatter={(d) => `${dayLabel} ${d}`} tick={{ fontSize: 12, fill: "var(--ink-3)" }} stroke="var(--line)" />
            <YAxis domain={domain} tick={{ fontSize: 12, fill: "var(--ink-3)" }} stroke="var(--line)" />
            {refLine != null && <ReferenceLine y={refLine} stroke="var(--ed)" strokeDasharray="5 4" />}
            <Tooltip formatter={(v: number) => [v, title]} labelFormatter={(d) => `${dayLabel} ${d}`} contentStyle={{ borderRadius: 12, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink)" }} />
            <Line type="monotone" dataKey={k} stroke={color} strokeWidth={2.5} dot={{ r: 4, fill: color }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}

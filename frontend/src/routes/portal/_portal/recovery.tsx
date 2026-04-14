import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueries } from "@tanstack/react-query";
import { portalApi } from "@/features/portal/api";
import {
  calcVitalsScore,
  calcLabsScore,
  calcScalesScore,
  calcExerciseScore,
  calcTreatmentScore,
  calcOverallIndex,
} from "@/features/recovery/lib/recovery-calculator";
import type { DomainScore, PeriodKey } from "@/features/recovery/types";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceArea,
} from "recharts";
import { subDays, subMonths } from "date-fns";

export const Route = createFileRoute("/portal/_portal/recovery")({
  component: PortalRecovery,
});

// ─── Period helpers ──────────────────────────────────────────────────────────

function getPeriodRange(key: PeriodKey) {
  const to = new Date();
  let from: Date;
  switch (key) {
    case "7d":  from = subDays(to, 7);   break;
    case "30d": from = subDays(to, 30);  break;
    case "3m":  from = subMonths(to, 3); break;
    default:    from = new Date(2000, 0, 1);
  }
  return { from, to };
}

function filterByPeriod<T extends Record<string, unknown>>(
  items: T[],
  dateField: string,
  from: Date,
  to: Date
): T[] {
  return items.filter((item) => {
    const d = item[dateField];
    if (!d) return false;
    const date = new Date(d as string);
    return date >= from && date <= to;
  });
}

// ─── Score colours ───────────────────────────────────────────────────────────

function scoreColor(score: number | null): string {
  if (score === null) return "var(--color-text-tertiary)";
  if (score >= 70) return "#4ade80";
  if (score >= 40) return "#f59e0b";
  return "#ef4444";
}

function scoreTextClass(score: number | null): string {
  if (score === null) return "text-[var(--color-text-tertiary)]";
  if (score >= 70) return "text-emerald-400";
  if (score >= 40) return "text-amber-400";
  return "text-red-400";
}

function scoreBg(score: number | null): string {
  if (score === null) return "var(--color-muted)";
  if (score >= 70) return "#4ade8015";
  if (score >= 40) return "#f59e0b15";
  return "#ef444415";
}

// ─── Domain config ───────────────────────────────────────────────────────────

const DOMAIN_CONFIG = {
  VITALS:    { label: "Витальные показатели", color: "#3b82f6", icon: "M22 12h-4l-3 9L9 3l-3 9H2" },
  LABS:      { label: "Анализы", color: "#f59e0b", icon: "M14 2v6a2 2 0 0 0 2 2h4M10 2v3.3a4 4 0 0 1-1.17 2.83L4 13v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6l-4.83-4.87A4 4 0 0 1 14 5.3V2" },
  SCALES:    { label: "Клинические шкалы", color: "#f43f5e", icon: "M12 2a10 10 0 1 0 10 10M12 2v10l5 5" },
  EXERCISES: { label: "Упражнения", color: "#06b6d4", icon: "M17 8h2a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-2v4l-4-4H9a1.994 1.994 0 0 1-1.414-.586M3 6V4a2 2 0 0 1 2-2h2" },
  TREATMENT: { label: "План лечения", color: "#8b5cf6", icon: "M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m-6 9 2 2 4-4" },
} as const;

type DomainKey = keyof typeof DOMAIN_CONFIG;

// ─── Guide text ──────────────────────────────────────────────────────────────

const GUIDE = [
  {
    range: "70 – 100%",
    color: "#4ade80",
    title: "Хорошо",
    text: "Показатели в норме. Продолжайте придерживаться плана лечения.",
  },
  {
    range: "40 – 69%",
    color: "#f59e0b",
    title: "Умеренно",
    text: "Есть отклонения от нормы. Обсудите с врачом возможные корректировки.",
  },
  {
    range: "0 – 39%",
    color: "#ef4444",
    title: "Требует внимания",
    text: "Значительные отклонения. Рекомендуется незамедлительно связаться с врачом.",
  },
];

// ─── Main component ───────────────────────────────────────────────────────────

function PortalRecovery() {
  const [period, setPeriod] = useState<PeriodKey>("30d");
  const [expanded, setExpanded] = useState<DomainKey | null>(null);

  const queries = useQueries({
    queries: [
      { queryKey: ["portal-recovery-vitals"],    queryFn: () => portalApi.getRecoveryVitals(90),   retry: 1 },
      { queryKey: ["portal-recovery-labs"],       queryFn: () => portalApi.getRecoveryLabResults(),  retry: 1 },
      { queryKey: ["portal-recovery-assess"],     queryFn: () => portalApi.getRecoveryAssessments(), retry: 1 },
      { queryKey: ["portal-recovery-exercises"],  queryFn: () => portalApi.getRecoveryExerciseSessions(), retry: 1 },
      { queryKey: ["portal-treatment-plans"],     queryFn: () => portalApi.getTreatmentPlans(),     retry: 1 },
    ],
  });

  const isLoading = queries.some((q) => q.isLoading);
  const [vitalsQ, labsQ, assessQ, exercisesQ, plansQ] = queries;

  const recoveryIndex = useMemo(() => {
    if (isLoading) return null;

    const { from, to } = getPeriodRange(period);
    const periodDays = Math.max(1, Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)));

    const vitals    = filterByPeriod((vitalsQ.data    ?? []) as Record<string, unknown>[], "recorded_at", from, to);
    const labs      = filterByPeriod((labsQ.data      ?? []) as Record<string, unknown>[], "resulted_at", from, to);
    const assessments = filterByPeriod((assessQ.data  ?? []) as Record<string, unknown>[], "assessed_at", from, to);
    const exercises = filterByPeriod((exercisesQ.data ?? []) as Record<string, unknown>[], "started_at", from, to);
    const plans     = (plansQ.data ?? []) as Record<string, unknown>[];

    const vitalsResult    = calcVitalsScore(vitals as never[], []);
    const labsResult      = calcLabsScore(labs as never[], []);
    const scalesResult    = calcScalesScore(assessments as never[]);
    const exerciseResult  = calcExerciseScore(exercises as never[], 5, periodDays);
    const treatmentResult = calcTreatmentScore(plans as never[]);

    // Trend: compare with previous equal period
    const prevFrom = new Date(from.getTime() - (to.getTime() - from.getTime()));
    const pVitals    = filterByPeriod((vitalsQ.data    ?? []) as Record<string, unknown>[], "recorded_at", prevFrom, from);
    const pLabs      = filterByPeriod((labsQ.data      ?? []) as Record<string, unknown>[], "resulted_at", prevFrom, from);
    const pAssess    = filterByPeriod((assessQ.data    ?? []) as Record<string, unknown>[], "assessed_at", prevFrom, from);
    const pExercises = filterByPeriod((exercisesQ.data ?? []) as Record<string, unknown>[], "started_at", prevFrom, from);

    const pVitalsResult   = calcVitalsScore(pVitals as never[], []);
    const pLabsResult     = calcLabsScore(pLabs as never[], []);
    const pScalesResult   = calcScalesScore(pAssess as never[]);
    const pExerciseResult = calcExerciseScore(pExercises as never[], 5, periodDays);

    function trend(cur: number | null, prev: number | null): number | null {
      if (cur === null || prev === null) return null;
      return Math.round((cur - prev) * 10) / 10;
    }

    const domainScores: DomainScore[] = [
      { domain: "VITALS",    score: vitalsResult.score,    trend: trend(vitalsResult.score, pVitalsResult.score),       dataPoints: vitalsResult.dataPoints },
      { domain: "LABS",      score: labsResult.score,      trend: trend(labsResult.score, pLabsResult.score),           dataPoints: labsResult.dataPoints },
      { domain: "SCALES",    score: scalesResult.score,    trend: trend(scalesResult.score, pScalesResult.score),       dataPoints: scalesResult.dataPoints },
      { domain: "EXERCISES", score: exerciseResult.score,  trend: trend(exerciseResult.score, pExerciseResult.score),   dataPoints: exerciseResult.dataPoints },
      { domain: "TREATMENT", score: treatmentResult.score, trend: null,                                                  dataPoints: treatmentResult.dataPoints },
    ];

    return calcOverallIndex(domainScores, []);
  }, [isLoading, period, vitalsQ.data, labsQ.data, assessQ.data, exercisesQ.data, plansQ.data]);

  const overall = recoveryIndex?.overall ?? null;
  const overallTrend = recoveryIndex?.trend ?? null;
  const sparkline = recoveryIndex?.sparkline ?? [];
  const domains = recoveryIndex?.domains ?? [];

  const PERIODS: { key: PeriodKey; label: string }[] = [
    { key: "7d",  label: "7 дней" },
    { key: "30d", label: "30 дней" },
    { key: "3m",  label: "3 месяца" },
    { key: "all", label: "Всё время" },
  ];

  return (
    <div className="space-y-3 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <h1 className="text-lg font-bold text-foreground">Динамика восстановления</h1>
      </div>

      {/* Period selector */}
      <div className="flex gap-1.5 flex-wrap">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
              period === p.key
                ? "bg-secondary text-secondary-foreground"
                : "bg-[var(--color-surface)] border border-border text-[var(--color-text-secondary)] hover:bg-[var(--color-muted)]"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Overall index card */}
      {isLoading ? (
        <div className="h-28 bg-[var(--color-surface)] rounded-2xl border border-border animate-pulse" />
      ) : (
        <div
          className="rounded-2xl border border-border p-5"
          style={{
            background: `linear-gradient(135deg, ${scoreBg(overall)}, var(--color-surface))`,
          }}
        >
          <p className="text-[11px] font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-2">
            Индекс восстановления
          </p>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-baseline gap-3">
              <span className={`text-4xl font-bold ${scoreTextClass(overall)}`}>
                {overall !== null ? `${Math.round(overall)}%` : "—"}
              </span>
              {overallTrend !== null && (
                <span
                  className={`text-sm font-semibold ${overallTrend >= 0 ? "text-emerald-400" : "text-red-400"}`}
                >
                  {overallTrend >= 0 ? "▲ +" : "▼ "}
                  {overallTrend}%
                </span>
              )}
            </div>
            {sparkline.length > 2 && (
              <div className="w-28 h-10 flex-shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={sparkline}>
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke={scoreColor(overall)}
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
          {overall === null && (
            <p className="text-xs text-[var(--color-text-secondary)] mt-2">
              Недостаточно данных за выбранный период. Попробуйте расширить диапазон.
            </p>
          )}
        </div>
      )}

      {/* Domain cards */}
      <div className="space-y-2">
        {isLoading
          ? [0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-14 bg-[var(--color-surface)] rounded-xl border border-border animate-pulse"
              />
            ))
          : domains.map((d) => {
              const key = d.domain as DomainKey;
              const cfg = DOMAIN_CONFIG[key];
              if (!cfg) return null;
              const isExp = expanded === key;
              const hasData = d.score !== null;

              return (
                <div
                  key={key}
                  className="bg-[var(--color-surface)] rounded-xl border border-border overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => hasData && setExpanded(isExp ? null : key)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                      hasData
                        ? "hover:bg-[var(--color-muted)]/50 cursor-pointer"
                        : "cursor-default opacity-50"
                    }`}
                  >
                    {/* Icon */}
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: `${cfg.color}18` }}
                    >
                      <svg
                        className="w-4 h-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke={cfg.color}
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d={cfg.icon} />
                      </svg>
                    </div>

                    {/* Label */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{cfg.label}</p>
                      {!hasData && (
                        <p className="text-[11px] text-[var(--color-text-tertiary)]">
                          Нет данных за период
                        </p>
                      )}
                    </div>

                    {/* Score + trend + sparkline */}
                    {hasData && (
                      <div className="flex items-center gap-3 flex-shrink-0">
                        {d.dataPoints.length > 1 && !isExp && (
                          <div className="w-16 h-7">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={d.dataPoints}>
                                <Line
                                  type="monotone"
                                  dataKey="value"
                                  stroke={cfg.color}
                                  strokeWidth={1.5}
                                  dot={false}
                                />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        )}
                        <span
                          className="text-base font-bold"
                          style={{ color: scoreColor(d.score) }}
                        >
                          {Math.round(d.score!)}%
                        </span>
                        {d.trend !== null && (
                          <span
                            className={`text-xs font-semibold ${
                              d.trend >= 0 ? "text-emerald-400" : "text-red-400"
                            }`}
                          >
                            {d.trend >= 0 ? "▲" : "▼"}
                          </span>
                        )}
                        <span className="text-[var(--color-text-tertiary)]">
                          <svg
                            className={`w-4 h-4 transition-transform ${isExp ? "rotate-180" : ""}`}
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path d="m6 9 6 6 6-6" />
                          </svg>
                        </span>
                      </div>
                    )}
                  </button>

                  {/* Expanded chart */}
                  {isExp && hasData && d.dataPoints.length > 1 && (
                    <div className="px-4 pb-4 border-t border-border pt-3">
                      <div className="h-44">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={d.dataPoints}>
                            <CartesianGrid
                              strokeDasharray="3 3"
                              stroke="var(--color-border)"
                            />
                            <XAxis
                              dataKey="date"
                              tick={{ fontSize: 10, fill: "var(--color-text-tertiary)" }}
                              tickFormatter={(v: string) =>
                                new Date(v).toLocaleDateString("ru-RU", {
                                  day: "2-digit",
                                  month: "2-digit",
                                })
                              }
                            />
                            <YAxis
                              domain={[0, 100]}
                              tick={{ fontSize: 10, fill: "var(--color-text-tertiary)" }}
                              unit="%"
                            />
                            <Tooltip
                              contentStyle={{
                                background: "var(--color-surface)",
                                border: "1px solid var(--color-border)",
                                borderRadius: "8px",
                                fontSize: "12px",
                              }}
                              labelFormatter={(v: string) =>
                                new Date(v).toLocaleDateString("ru-RU", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                })
                              }
                              formatter={(v: number) => [`${v}%`, "Счёт"]}
                            />
                            <ReferenceArea y1={70} y2={100} fill="#4ade80" fillOpacity={0.06} />
                            <ReferenceArea y1={40} y2={70} fill="#f59e0b" fillOpacity={0.06} />
                            <ReferenceArea y1={0}  y2={40} fill="#ef4444" fillOpacity={0.06} />
                            <Line
                              type="monotone"
                              dataKey="value"
                              stroke={cfg.color}
                              strokeWidth={2}
                              dot={{ r: 3, fill: cfg.color }}
                              activeDot={{ r: 5 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}
                  {isExp && hasData && d.dataPoints.length <= 1 && (
                    <div className="px-4 pb-4 pt-3 border-t border-border">
                      <p className="text-xs text-[var(--color-text-secondary)] text-center py-4">
                        Нужно больше точек данных для отображения графика
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
      </div>

      {/* Guide */}
      <div className="bg-[var(--color-surface)] rounded-xl border border-border p-4">
        <p className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-3">
          Как читать показатели
        </p>
        <div className="space-y-2.5">
          {GUIDE.map((g) => (
            <div key={g.range} className="flex items-start gap-3">
              <div
                className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1"
                style={{ background: g.color }}
              />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground">
                  {g.title}{" "}
                  <span
                    className="font-normal text-[var(--color-text-tertiary)]"
                    style={{ fontSize: "10px" }}
                  >
                    ({g.range})
                  </span>
                </p>
                <p className="text-[11px] text-[var(--color-text-secondary)] leading-snug">
                  {g.text}
                </p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-[var(--color-text-tertiary)] mt-3 leading-snug">
          Индекс рассчитывается автоматически на основе ваших витальных показателей, анализов, результатов клинических шкал и выполнения упражнений. Он не заменяет медицинское заключение.
        </p>
      </div>
    </div>
  );
}

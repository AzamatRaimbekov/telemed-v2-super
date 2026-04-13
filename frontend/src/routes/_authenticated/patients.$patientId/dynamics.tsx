import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceArea, ReferenceLine,
} from "recharts";
import { Activity, TestTube, Brain, Dumbbell, ClipboardList, ChevronDown, ChevronUp, Info, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useRecoveryData } from "@/features/recovery/hooks/useRecoveryData";
import type { PeriodKey, DomainScore, RecoveryDomainKey } from "@/features/recovery/types";

export const Route = createFileRoute(
  "/_authenticated/patients/$patientId/dynamics"
)({
  component: DynamicsPage,
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PERIOD_OPTIONS: { key: PeriodKey; label: string }[] = [
  { key: "7d", label: "7 дней" },
  { key: "30d", label: "30 дней" },
  { key: "3m", label: "3 мес" },
  { key: "all", label: "Всё время" },
];

const DOMAIN_META: Record<RecoveryDomainKey, {
  label: string;
  description: string;
  color: string;
  gradient: [string, string];
  icon: typeof Activity;
  source: string;
  goodMeans: string;
}> = {
  VITALS: {
    label: "Витальные показатели",
    description: "АД, пульс, SpO₂, температура, глюкоза, ЧДД",
    color: "#3b82f6",
    gradient: ["#3b82f6", "#1d4ed8"],
    icon: Activity,
    source: "Записи витальных показателей",
    goodMeans: "Все показатели в пределах нормы",
  },
  LABS: {
    label: "Лабораторные анализы",
    description: "Результаты анализов с числовыми значениями",
    color: "#f59e0b",
    gradient: ["#f59e0b", "#d97706"],
    icon: TestTube,
    source: "Результаты лабораторных исследований",
    goodMeans: "Значения в референсных диапазонах",
  },
  SCALES: {
    label: "Шкалы оценки",
    description: "NIHSS, MRS, Barthel, MMSE, Beck, Dysphagia",
    color: "#f43f5e",
    gradient: ["#f43f5e", "#e11d48"],
    icon: Brain,
    source: "Результаты клинических шкал",
    goodMeans: "Улучшение по каждой шкале с учётом полярности",
  },
  EXERCISES: {
    label: "Упражнения",
    description: "Точность, регулярность, прогресс выполнения",
    color: "#06b6d4",
    gradient: ["#06b6d4", "#0891b2"],
    icon: Dumbbell,
    source: "Сессии упражнений пациента",
    goodMeans: "Высокая точность + регулярные занятия + прогресс",
  },
  TREATMENT: {
    label: "План лечения",
    description: "Выполнение назначений и процедур",
    color: "#8b5cf6",
    gradient: ["#8b5cf6", "#7c3aed"],
    icon: ClipboardList,
    source: "Активные планы лечения и их пункты",
    goodMeans: "Высокий % выполненных пунктов, нет просроченных",
  },
};

const DEFAULT_WEIGHTS: Record<RecoveryDomainKey, number> = {
  VITALS: 0.25,
  LABS: 0.25,
  TREATMENT: 0.20,
  SCALES: 0.15,
  EXERCISES: 0.15,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });
}

function formatDateFull(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
}

function getScoreColor(score: number | null): string {
  if (score === null) return "var(--color-text-tertiary)";
  if (score >= 70) return "#4ade80";
  if (score >= 40) return "#f59e0b";
  return "#ef4444";
}

function getScoreLabel(score: number | null): string {
  if (score === null) return "Нет данных";
  if (score >= 70) return "Хорошо";
  if (score >= 40) return "Умеренно";
  return "Критично";
}

// ---------------------------------------------------------------------------
// Custom Tooltip
// ---------------------------------------------------------------------------

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length || !label) return null;
  return (
    <div className="bg-[var(--color-surface)] border border-border rounded-lg px-3 py-2 shadow-lg">
      <p className="text-xs text-[var(--color-text-tertiary)] mb-1">{formatDateFull(label)}</p>
      <p className="text-sm font-semibold text-foreground">{payload[0].value.toFixed(1)}%</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Score Ring (circular indicator)
// ---------------------------------------------------------------------------

function ScoreRing({ score, size = 64, strokeWidth = 5, color }: { score: number | null; size?: number; strokeWidth?: number; color: string }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = score !== null ? (score / 100) * circumference : 0;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth={strokeWidth}
        />
        {score !== null && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={circumference - progress}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        )}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-bold text-foreground">
          {score !== null ? Math.round(score) : "\u2014"}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Domain Section
// ---------------------------------------------------------------------------

function DomainSection({ domainScore }: { domainScore: DomainScore }) {
  const meta = DOMAIN_META[domainScore.domain];
  const Icon = meta.icon;
  const hasData = domainScore.score !== null;
  const hasChart = domainScore.dataPoints.length > 1;

  return (
    <div className="bg-[var(--color-surface)] rounded-2xl border border-border overflow-hidden">
      {/* Header */}
      <div className="p-5 flex items-center gap-4">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${meta.color}15` }}
        >
          <Icon size={20} style={{ color: meta.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">{meta.label}</h3>
            {hasData && domainScore.trend !== null && (
              <span className={`inline-flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded-full ${
                domainScore.trend > 0
                  ? "bg-emerald-500/10 text-emerald-400"
                  : domainScore.trend < 0
                  ? "bg-red-500/10 text-red-400"
                  : "bg-[var(--color-muted)] text-[var(--color-text-tertiary)]"
              }`}>
                {domainScore.trend > 0 ? <TrendingUp size={12} /> : domainScore.trend < 0 ? <TrendingDown size={12} /> : <Minus size={12} />}
                {domainScore.trend > 0 ? "+" : ""}{domainScore.trend}%
              </span>
            )}
          </div>
          <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">{meta.description}</p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {hasData ? (
            <>
              <div className="text-right">
                <p className="text-2xl font-bold" style={{ color: meta.color }}>
                  {domainScore.score}%
                </p>
                <p className="text-[10px] text-[var(--color-text-tertiary)] uppercase tracking-wide">
                  {getScoreLabel(domainScore.score)}
                </p>
              </div>
              <ScoreRing score={domainScore.score} color={meta.color} />
            </>
          ) : (
            <p className="text-sm text-[var(--color-text-tertiary)]">Нет данных</p>
          )}
        </div>
      </div>

      {/* Chart */}
      {hasChart && (
        <div className="px-5 pb-5">
          <div className="h-44 bg-[var(--color-muted)]/30 rounded-xl p-3">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={domainScore.dataPoints} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id={`grad-${domainScore.domain}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={meta.color} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={meta.color} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" strokeOpacity={0.5} vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: "var(--color-text-tertiary)" }}
                  tickFormatter={formatDateShort}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 10, fill: "var(--color-text-tertiary)" }}
                  axisLine={false}
                  tickLine={false}
                  ticks={[0, 25, 50, 75, 100]}
                />
                <Tooltip content={<ChartTooltip />} />
                <ReferenceArea y1={70} y2={100} fill="#4ade80" fillOpacity={0.04} />
                <ReferenceArea y1={0} y2={40} fill="#ef4444" fillOpacity={0.04} />
                <ReferenceLine y={70} stroke="#4ade80" strokeDasharray="4 4" strokeOpacity={0.4} />
                <ReferenceLine y={40} stroke="#ef4444" strokeDasharray="4 4" strokeOpacity={0.4} />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={meta.color}
                  strokeWidth={2}
                  fill={`url(#grad-${domainScore.domain})`}
                  dot={{ r: 3, fill: meta.color, strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: meta.color, stroke: "var(--color-surface)", strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Guide Section
// ---------------------------------------------------------------------------

function GuideSection() {
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-[var(--color-surface)] rounded-2xl border border-border overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full px-5 py-4 flex items-center justify-between gap-3 hover:bg-[var(--color-muted)]/30 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <Info size={16} className="text-[var(--color-text-tertiary)]" />
          <span className="text-sm font-medium text-foreground">Как рассчитывается индекс восстановления?</span>
        </div>
        {open ? (
          <ChevronUp size={16} className="text-[var(--color-text-tertiary)]" />
        ) : (
          <ChevronDown size={16} className="text-[var(--color-text-tertiary)]" />
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 space-y-4 border-t border-border pt-4">
              {/* Formula */}
              <div>
                <h4 className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-2">
                  Формула расчёта
                </h4>
                <div className="bg-[var(--color-muted)] rounded-xl p-4">
                  <p className="text-sm text-foreground font-mono">
                    Индекс = &Sigma; (Балл домена &times; Нормализованный вес)
                  </p>
                  <p className="text-xs text-[var(--color-text-secondary)] mt-2">
                    Если у пациента нет данных по домену, его вес автоматически перераспределяется на остальные домены.
                    Врач может задать собственные целевые значения и веса.
                  </p>
                </div>
              </div>

              {/* Domains table */}
              <div>
                <h4 className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-2">
                  Домены и источники данных
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 pr-4 text-xs font-medium text-[var(--color-text-tertiary)]">Домен</th>
                        <th className="text-left py-2 pr-4 text-xs font-medium text-[var(--color-text-tertiary)]">Вес</th>
                        <th className="text-left py-2 pr-4 text-xs font-medium text-[var(--color-text-tertiary)]">Источник данных</th>
                        <th className="text-left py-2 text-xs font-medium text-[var(--color-text-tertiary)]">Что означает 100%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(Object.entries(DOMAIN_META) as [RecoveryDomainKey, typeof DOMAIN_META.VITALS][]).map(([key, meta]) => (
                        <tr key={key} className="border-b border-border/50 last:border-0">
                          <td className="py-2.5 pr-4">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: meta.color }} />
                              <span className="font-medium text-foreground">{meta.label}</span>
                            </div>
                          </td>
                          <td className="py-2.5 pr-4 text-[var(--color-text-secondary)]">
                            {Math.round(DEFAULT_WEIGHTS[key] * 100)}%
                          </td>
                          <td className="py-2.5 pr-4 text-[var(--color-text-secondary)]">
                            {meta.source}
                          </td>
                          <td className="py-2.5 text-[var(--color-text-secondary)]">
                            {meta.goodMeans}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Color legend */}
              <div>
                <h4 className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-2">
                  Цветовые зоны
                </h4>
                <div className="flex gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-emerald-400" />
                    <span className="text-sm text-[var(--color-text-secondary)]">&ge; 70% &mdash; Хорошо</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-amber-400" />
                    <span className="text-sm text-[var(--color-text-secondary)]">40&ndash;69% &mdash; Умеренно</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-400" />
                    <span className="text-sm text-[var(--color-text-secondary)]">&lt; 40% &mdash; Критично</span>
                  </div>
                </div>
              </div>

              {/* Scales detail */}
              <div>
                <h4 className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-2">
                  Клинические шкалы — полярность
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { name: "NIHSS", dir: "\u2193 меньше = лучше", range: "0\u201342" },
                    { name: "MRS", dir: "\u2193 меньше = лучше", range: "0\u20136" },
                    { name: "Barthel", dir: "\u2191 больше = лучше", range: "0\u2013100" },
                    { name: "MMSE", dir: "\u2191 больше = лучше", range: "0\u201330" },
                    { name: "Beck", dir: "\u2193 меньше = лучше", range: "0\u201363" },
                    { name: "Dysphagia", dir: "\u2193 меньше = лучше", range: "0\u2013max" },
                  ].map((s) => (
                    <div key={s.name} className="bg-[var(--color-muted)] rounded-lg p-2.5">
                      <p className="text-xs font-semibold text-foreground">{s.name}</p>
                      <p className="text-[10px] text-[var(--color-text-tertiary)]">{s.dir}</p>
                      <p className="text-[10px] text-[var(--color-text-tertiary)]">Диапазон: {s.range}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

function DynamicsPage() {
  const { patientId } = Route.useParams();
  const [periodKey, setPeriodKey] = useState<PeriodKey>("30d");
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();
  const [showCustom, setShowCustom] = useState(false);
  const [fromInput, setFromInput] = useState("");
  const [toInput, setToInput] = useState("");

  const { recoveryIndex, isLoading } = useRecoveryData(
    patientId,
    periodKey,
    customFrom,
    customTo
  );

  function handlePeriodClick(key: PeriodKey) {
    if (key === "custom") {
      setShowCustom(true);
    } else {
      setShowCustom(false);
      setPeriodKey(key);
    }
  }

  function handleApplyCustom() {
    if (fromInput && toInput) {
      setPeriodKey("custom");
      setCustomFrom(new Date(fromInput));
      setCustomTo(new Date(toInput));
      setShowCustom(false);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-32 bg-[var(--color-muted)] rounded-2xl animate-pulse" />
        <div className="h-48 bg-[var(--color-muted)] rounded-2xl animate-pulse" />
        <div className="h-48 bg-[var(--color-muted)] rounded-2xl animate-pulse" />
      </div>
    );
  }

  const overall = recoveryIndex?.overall ?? null;
  const trend = recoveryIndex?.trend ?? null;
  const domains = recoveryIndex?.domains ?? [];
  const sparkline = recoveryIndex?.sparkline ?? [];
  const activeDomains = domains.filter((d) => d.score !== null);
  const inactiveDomains = domains.filter((d) => d.score === null);

  return (
    <div className="space-y-4">
      {/* Recovery Index Hero */}
      <div className="bg-gradient-to-br from-[#0f172a] to-[#1e1b4b] rounded-2xl border border-white/5 p-6 relative overflow-hidden">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-5">
          <svg width="100%" height="100%">
            <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
              <path d="M 32 0 L 0 0 0 32" fill="none" stroke="white" strokeWidth="0.5" />
            </pattern>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        <div className="relative z-10">
          <div className="flex items-start justify-between gap-6 flex-wrap">
            <div>
              <p className="text-xs font-medium text-white/40 uppercase tracking-widest mb-3">
                Индекс восстановления
              </p>
              <div className="flex items-baseline gap-4">
                <span
                  className="text-5xl font-bold tracking-tight"
                  style={{ color: getScoreColor(overall) }}
                >
                  {overall !== null ? `${overall}%` : "\u2014"}
                </span>
                {trend !== null && (
                  <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-medium ${
                    trend > 0
                      ? "bg-emerald-500/15 text-emerald-400"
                      : trend < 0
                      ? "bg-red-500/15 text-red-400"
                      : "bg-white/5 text-white/40"
                  }`}>
                    {trend > 0 ? <TrendingUp size={14} /> : trend < 0 ? <TrendingDown size={14} /> : <Minus size={14} />}
                    {trend > 0 ? "+" : ""}{trend}%
                  </div>
                )}
              </div>
              {overall !== null && (
                <p className="text-sm text-white/40 mt-1">{getScoreLabel(overall)}</p>
              )}
            </div>

            {/* Sparkline */}
            {sparkline.length > 1 && (
              <div className="w-48 h-16">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={sparkline} margin={{ top: 5, right: 0, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={getScoreColor(overall)} stopOpacity={0.4} />
                        <stop offset="100%" stopColor={getScoreColor(overall)} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke={getScoreColor(overall)}
                      strokeWidth={2}
                      fill="url(#sparkGrad)"
                      dot={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Domain mini scores */}
          {activeDomains.length > 0 && (
            <div className="flex gap-3 mt-5 flex-wrap">
              {activeDomains.map((d) => {
                const meta = DOMAIN_META[d.domain];
                return (
                  <div key={d.domain} className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: meta.color }} />
                    <span className="text-xs text-white/60">{meta.label}</span>
                    <span className="text-xs font-semibold" style={{ color: meta.color }}>
                      {d.score}%
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Period selector */}
          <div className="flex items-center gap-2 mt-5 flex-wrap">
            <div className="flex bg-white/5 rounded-lg p-0.5">
              {PERIOD_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => handlePeriodClick(opt.key)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    periodKey === opt.key && !showCustom
                      ? "bg-white/10 text-white shadow-sm"
                      : "text-white/40 hover:text-white/70"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => handlePeriodClick("custom")}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  showCustom || periodKey === "custom"
                    ? "bg-white/10 text-white shadow-sm"
                    : "text-white/40 hover:text-white/70"
                }`}
              >
                Период
              </button>
            </div>
            {showCustom && (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={fromInput}
                  onChange={(e) => setFromInput(e.target.value)}
                  className="px-2 py-1 text-xs rounded-md border border-white/10 bg-white/5 text-white"
                />
                <span className="text-xs text-white/30">&mdash;</span>
                <input
                  type="date"
                  value={toInput}
                  onChange={(e) => setToInput(e.target.value)}
                  className="px-2 py-1 text-xs rounded-md border border-white/10 bg-white/5 text-white"
                />
                <button
                  type="button"
                  onClick={handleApplyCustom}
                  disabled={!fromInput || !toInput}
                  className="px-2.5 py-1 text-xs font-medium rounded-md bg-white/10 text-white hover:bg-white/20 disabled:opacity-30 transition-colors"
                >
                  OK
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Domain sections */}
      {activeDomains.map((d) => (
        <DomainSection key={d.domain} domainScore={d} />
      ))}

      {/* Inactive domains */}
      {inactiveDomains.length > 0 && (
        <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-5">
          <p className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-3">
            Нет данных
          </p>
          <div className="flex flex-wrap gap-2">
            {inactiveDomains.map((d) => {
              const meta = DOMAIN_META[d.domain];
              const Icon = meta.icon;
              return (
                <div key={d.domain} className="flex items-center gap-2 bg-[var(--color-muted)] rounded-lg px-3 py-2">
                  <Icon size={14} className="text-[var(--color-text-tertiary)]" />
                  <span className="text-xs text-[var(--color-text-tertiary)]">{meta.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Guide */}
      <GuideSection />
    </div>
  );
}

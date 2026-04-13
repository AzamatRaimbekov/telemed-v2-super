import { LineChart, Line, ResponsiveContainer } from "recharts";
import type { RecoveryIndex, PeriodKey } from "../types";
import { PeriodSelector } from "./PeriodSelector";

function getScoreColor(score: number | null): string {
  if (score === null) return "var(--color-text-tertiary)";
  if (score >= 70) return "#4ade80";
  if (score >= 40) return "#f59e0b";
  return "#ef4444";
}

function getScoreColorClass(score: number | null): string {
  if (score === null) return "text-[var(--color-text-tertiary)]";
  if (score >= 70) return "text-emerald-400";
  if (score >= 40) return "text-amber-400";
  return "text-red-400";
}

interface Props {
  index: RecoveryIndex | null;
  isLoading: boolean;
  periodKey: PeriodKey;
  onPeriodChange: (key: PeriodKey, from?: Date, to?: Date) => void;
}

export function RecoveryIndexCard({ index, isLoading, periodKey, onPeriodChange }: Props) {
  if (isLoading) {
    return (
      <div className="bg-gradient-to-br from-[#1e3a5f]/50 to-[#2a1a4e]/50 rounded-2xl border border-border p-6 animate-pulse">
        <div className="h-20" />
      </div>
    );
  }

  const overall = index?.overall ?? null;
  const trend = index?.trend ?? null;
  const sparkline = index?.sparkline ?? [];

  return (
    <div className="bg-gradient-to-br from-[#1e3a5f]/30 to-[#2a1a4e]/30 rounded-2xl border border-border p-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <p className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-2">
            Индекс восстановления
          </p>
          <div className="flex items-baseline gap-3">
            <span className={`text-4xl font-bold ${getScoreColorClass(overall)}`}>
              {overall !== null ? `${overall}%` : "—"}
            </span>
            {trend !== null && (
              <span className={`text-sm font-medium ${trend >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {trend >= 0 ? "▲" : "▼"} {trend >= 0 ? "+" : ""}{trend}%
              </span>
            )}
          </div>
        </div>
        {sparkline.length > 1 && (
          <div className="w-32 h-12">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sparkline}>
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={getScoreColor(overall)}
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
      <PeriodSelector value={periodKey} onChange={onPeriodChange} />
    </div>
  );
}

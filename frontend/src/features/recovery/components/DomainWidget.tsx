import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, ReferenceArea, CartesianGrid } from "recharts";
import { Activity, TestTube, Brain, Dumbbell, ClipboardList, Target } from "lucide-react";
import type { DomainScore, RecoveryDomainKey } from "../types";

const DOMAIN_CONFIG: Record<
  RecoveryDomainKey,
  { label: string; color: string; icon: typeof Activity }
> = {
  VITALS: { label: "Витальные", color: "#3b82f6", icon: Activity },
  LABS: { label: "Анализы", color: "#f59e0b", icon: TestTube },
  SCALES: { label: "Шкалы", color: "#f43f5e", icon: Brain },
  EXERCISES: { label: "Упражнения", color: "#06b6d4", icon: Dumbbell },
  TREATMENT: { label: "План лечения", color: "#8b5cf6", icon: ClipboardList },
};

interface Props {
  domainScore: DomainScore;
  expandedContent?: React.ReactNode;
}

export function DomainWidget({ domainScore, expandedContent }: Props) {
  const [expanded, setExpanded] = useState(false);
  const config = DOMAIN_CONFIG[domainScore.domain];
  const Icon = config?.icon ?? Target;
  const color = config?.color ?? "#888";
  const label = config?.label ?? domainScore.domain;
  const hasData = domainScore.score !== null;

  return (
    <div
      className={`bg-[var(--color-surface)] rounded-xl border border-border transition-all ${
        expanded ? "col-span-2" : ""
      }`}
    >
      <button
        type="button"
        onClick={() => hasData && setExpanded(!expanded)}
        className={`w-full p-4 text-left ${hasData ? "cursor-pointer hover:bg-[var(--color-muted)]/50" : "cursor-default opacity-50"} rounded-xl transition-colors`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${color}15` }}
            >
              <Icon size={16} style={{ color }} />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">{label}</p>
              {!hasData && (
                <p className="text-xs text-[var(--color-text-tertiary)]">Нет данных</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {hasData && (
              <>
                <span className="text-lg font-bold" style={{ color }}>
                  {domainScore.score}%
                </span>
                {domainScore.trend !== null && (
                  <span
                    className={`text-xs font-medium ${
                      domainScore.trend >= 0 ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    {domainScore.trend >= 0 ? "▲" : "▼"}
                  </span>
                )}
              </>
            )}
          </div>
        </div>
        {hasData && domainScore.dataPoints.length > 1 && !expanded && (
          <div className="mt-2 h-8">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={domainScore.dataPoints}>
                <Line type="monotone" dataKey="value" stroke={color} strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </button>

      <AnimatePresence>
        {expanded && hasData && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 border-t border-border pt-4">
              {expandedContent || (
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={domainScore.dataPoints}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 10, fill: "var(--color-text-tertiary)" }}
                        tickFormatter={(v: string) => new Date(v).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" })}
                      />
                      <YAxis
                        domain={[0, 100]}
                        tick={{ fontSize: 10, fill: "var(--color-text-tertiary)" }}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "var(--color-surface)",
                          border: "1px solid var(--color-border)",
                          borderRadius: "8px",
                          fontSize: "12px",
                        }}
                        labelFormatter={(v: string) => new Date(v).toLocaleString("ru-RU")}
                      />
                      <ReferenceArea y1={70} y2={100} fill="#4ade80" fillOpacity={0.05} />
                      <ReferenceArea y1={40} y2={70} fill="#f59e0b" fillOpacity={0.05} />
                      <ReferenceArea y1={0} y2={40} fill="#ef4444" fillOpacity={0.05} />
                      <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={{ r: 3, fill: color }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

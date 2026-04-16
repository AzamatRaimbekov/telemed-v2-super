// frontend/src/routes/portal/_portal/results.tsx
// Patient portal — lab results list with detail view and trend chart
import { createFileRoute } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { portalApi } from "@/features/portal/api"
import { useState } from "react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceArea,
  ResponsiveContainer,
} from "recharts"

export const Route = createFileRoute("/portal/_portal/results")({
  component: ResultsPage,
})

// ─── Types ────────────────────────────────────────────────────────────────────

type ResultItem = {
  /** Unique result identifier */
  id: string
  /** Name of the lab test */
  test_name: string
  /** Short code (e.g. "HGB") */
  test_code: string
  /** Category grouping */
  category: string
  /** Numeric or text result value */
  value: string | number
  /** Measurement unit */
  unit?: string
  /** Whether the value falls outside reference range */
  is_abnormal: boolean
  /** Human-readable reference range string */
  reference_range?: string
  /** ISO date when the result was finalized */
  resulted_at: string
  /** Doctor's note */
  notes?: string
}

type TrendPoint = {
  /** ISO date of the measurement */
  date: string
  /** Numeric value */
  value: number
  /** Measurement unit */
  unit: string
  /** Whether this point is outside normal range */
  is_abnormal: boolean
  /** Lower bound of the reference range */
  ref_min?: number
  /** Upper bound of the reference range */
  ref_max?: number
}

type TrendData = {
  /** Test name for the chart title */
  test_name: string
  /** Measurement unit */
  unit: string
  /** Lower bound of the reference range */
  ref_min?: number
  /** Upper bound of the reference range */
  ref_max?: number
  /** Historical data points sorted by date ascending */
  points: TrendPoint[]
}

// ─── Trend chart tooltip ──────────────────────────────────────────────────────

function TrendTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value: number; payload: { unit: string; is_abnormal: boolean } }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  const point = payload?.[0]
  if (!point) return null
  return (
    <div className="bg-[var(--color-surface)] border border-border rounded-xl shadow-lg p-3 text-xs">
      <p className="text-[var(--color-text-tertiary)] mb-0.5">{label}</p>
      <p className={`font-bold ${point.payload?.is_abnormal ? "text-destructive" : "text-foreground"}`}>
        {point.value} {point.payload?.unit}
      </p>
    </div>
  )
}

// ─── Custom dot — red when out of range, blue when normal ─────────────────────

function TrendDot(props: {
  cx?: number
  cy?: number
  payload?: { is_abnormal: boolean }
}) {
  const { cx, cy, payload } = props
  if (cx === undefined || cy === undefined) return null
  const color = payload?.is_abnormal ? "#EF4444" : "#3B82F6"
  return (
    <circle
      cx={cx}
      cy={cy}
      r={4}
      fill={color}
      stroke="var(--color-surface)"
      strokeWidth={2}
    />
  )
}

// ─── Trend chart component ────────────────────────────────────────────────────

function ResultTrendChart({ testId }: { testId: string }) {
  const { data: trendRaw, isLoading, isError } = useQuery({
    queryKey: ["portal-result-trend", testId],
    queryFn: () => portalApi.getResultTrend(testId),
    enabled: !!testId,
  })

  const trend = trendRaw as TrendData | undefined
  const points = trend?.points ?? []

  // Loading state — skeleton
  if (isLoading) {
    return (
      <div className="mt-6 bg-[var(--color-surface)] rounded-2xl border border-border p-6">
        <div className="h-4 w-48 bg-[var(--color-muted)] rounded animate-pulse mb-4" />
        <div className="h-[220px] bg-[var(--color-muted)] rounded-xl animate-pulse" />
      </div>
    )
  }

  // Error state
  if (isError) {
    return (
      <div className="mt-6 bg-[var(--color-surface)] rounded-2xl border border-border p-6 text-center">
        <svg
          className="w-10 h-10 mx-auto mb-2 text-[var(--color-text-tertiary)]"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <p className="text-sm text-[var(--color-text-secondary)]">Не удалось загрузить динамику</p>
      </div>
    )
  }

  // Empty state — no trend data available
  if (points.length === 0) {
    return (
      <div className="mt-6 bg-[var(--color-surface)] rounded-2xl border border-border p-6 text-center">
        <svg
          className="w-10 h-10 mx-auto mb-2 text-[var(--color-text-tertiary)]"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
        </svg>
        <p className="text-sm text-[var(--color-text-secondary)]">Нет данных для отображения динамики</p>
        <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
          Динамика появится после повторных анализов
        </p>
      </div>
    )
  }

  // Determine reference range from trend-level data or first point
  const refMin = trend?.ref_min ?? points[0]?.ref_min
  const refMax = trend?.ref_max ?? points[0]?.ref_max
  const unit = trend?.unit ?? points[0]?.unit ?? ""
  const hasRefRange = refMin !== undefined && refMax !== undefined

  // Prepare chart data with formatted dates
  const chartData = points.map((p) => ({
    ...p,
    dateLabel: new Date(p.date).toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
    }),
  }))

  // Calculate Y-axis domain with padding so points are not clipped at edges
  const allValues = points.map((p) => p.value)
  const domainValues = [...allValues]
  if (refMin !== undefined) domainValues.push(refMin)
  if (refMax !== undefined) domainValues.push(refMax)
  const minVal = Math.min(...domainValues)
  const maxVal = Math.max(...domainValues)
  const padding = (maxVal - minVal) * 0.15 || 1
  const yMin = Math.floor(minVal - padding)
  const yMax = Math.ceil(maxVal + padding)

  return (
    <div className="mt-6 bg-[var(--color-surface)] rounded-2xl border border-border p-6 animate-scale-in">
      <h3 className="text-sm font-semibold text-foreground mb-1">Динамика результатов</h3>
      <p className="text-xs text-[var(--color-text-tertiary)] mb-4">
        {points.length === 1
          ? "Единственное измерение"
          : `${points.length} измерений`}
        {hasRefRange && (
          <span> · Норма: {refMin}–{refMax} {unit}</span>
        )}
      </p>

      <ResponsiveContainer width="100%" height={220}>
        <LineChart
          data={chartData}
          margin={{ top: 4, right: 12, left: -10, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis
            dataKey="dateLabel"
            tick={{ fontSize: 10, fill: "var(--color-text-tertiary)" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            domain={[yMin, yMax]}
            tick={{ fontSize: 10, fill: "var(--color-text-tertiary)" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => `${v}`}
            label={{
              value: unit,
              position: "insideTopLeft",
              offset: 10,
              style: { fontSize: 10, fill: "var(--color-text-tertiary)" },
            }}
          />
          <Tooltip content={<TrendTooltip />} />

          {/* Reference range band — shaded area between min and max normal */}
          {hasRefRange && (
            <ReferenceArea
              y1={refMin}
              y2={refMax}
              fill="#10B981"
              fillOpacity={0.08}
              label={{
                value: "Норма",
                position: "insideTopRight",
                style: { fontSize: 10, fill: "#10B981", fontWeight: 500 },
              }}
            />
          )}

          <Line
            type="monotone"
            dataKey="value"
            name="Значение"
            stroke="#3B82F6"
            strokeWidth={2}
            dot={<TrendDot />}
            activeDot={{ r: 6, fill: "#3B82F6", stroke: "var(--color-surface)", strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>

      {hasRefRange && (
        <div className="flex items-center gap-4 mt-3 text-[10px] text-[var(--color-text-tertiary)]">
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-sm bg-[#10B981]/20 border border-[#10B981]/30" />
            Норма ({refMin}–{refMax})
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#3B82F6]" />
            В пределах нормы
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#EF4444]" />
            Отклонение
          </span>
        </div>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

function ResultsPage() {
  const { data: results, isLoading } = useQuery({
    queryKey: ["portal-results"],
    queryFn: portalApi.getResults,
  })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const { data: detail } = useQuery({
    queryKey: ["portal-result", selectedId],
    queryFn: () => portalApi.getResultDetail(selectedId!),
    enabled: !!selectedId,
  })

  const typedDetail = detail as ResultItem | undefined

  return (
    <div className="max-w-4xl">
      <h1 className="text-[24px] font-bold text-foreground tracking-tight mb-6 animate-float-up">
        Результаты анализов
      </h1>

      {selectedId && typedDetail ? (
        <div className="animate-scale-in">
          <button
            type="button"
            onClick={() => setSelectedId(null)}
            className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-foreground mb-4 transition-colors"
          >
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m12 19-7-7 7-7" />
              <path d="M19 12H5" />
            </svg>
            Назад к списку
          </button>

          <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-foreground">{typedDetail.test_name}</h2>
                <p className="text-xs text-[var(--color-text-tertiary)] font-mono">
                  {typedDetail.test_code} · {typedDetail.category}
                </p>
              </div>
              {typedDetail.is_abnormal && (
                <span className="px-2.5 py-1 bg-destructive/10 text-destructive text-xs font-semibold rounded-lg">
                  Отклонение
                </span>
              )}
            </div>

            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="p-4 rounded-xl bg-[var(--color-muted)]/50 text-center">
                <p className="text-xs text-[var(--color-text-tertiary)] mb-1">Результат</p>
                <p className={`text-xl font-bold ${typedDetail.is_abnormal ? "text-destructive" : "text-foreground"}`}>
                  {typedDetail.value}
                </p>
                {typedDetail.unit && (
                  <p className="text-xs text-[var(--color-text-tertiary)]">{typedDetail.unit}</p>
                )}
              </div>
              <div className="p-4 rounded-xl bg-[var(--color-muted)]/50 text-center">
                <p className="text-xs text-[var(--color-text-tertiary)] mb-1">Норма</p>
                <p className="text-sm font-medium text-foreground">
                  {typedDetail.reference_range || "—"}
                </p>
              </div>
              <div className="p-4 rounded-xl bg-[var(--color-muted)]/50 text-center">
                <p className="text-xs text-[var(--color-text-tertiary)] mb-1">Дата</p>
                <p className="text-sm font-medium text-foreground">
                  {new Date(typedDetail.resulted_at).toLocaleDateString("ru-RU")}
                </p>
              </div>
            </div>

            {typedDetail.notes && (
              <div className="p-4 rounded-xl bg-secondary/5 border border-secondary/10">
                <p className="text-xs font-semibold text-secondary mb-1">Комментарий врача</p>
                <p className="text-sm text-foreground">{typedDetail.notes}</p>
              </div>
            )}
          </div>

          {/* Trend chart — historical values for this test */}
          <ResultTrendChart testId={selectedId} />
        </div>
      ) : (
        <div
          className="space-y-2 animate-float-up"
          style={{ animationDelay: "100ms" }}
        >
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-16 bg-[var(--color-muted)] rounded-xl animate-pulse"
                />
              ))}
            </div>
          ) : ((results as ResultItem[]) ?? []).length === 0 ? (
            <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-8 text-center">
              <svg
                className="w-12 h-12 mx-auto mb-3 text-[var(--color-text-tertiary)]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M14 2v6a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V2" />
                <path d="M10 2v3.3a4 4 0 0 1-1.17 2.83L4 13v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6l-4.83-4.87A4 4 0 0 1 14 5.3V2" />
              </svg>
              <p className="text-[var(--color-text-secondary)]">Нет доступных результатов</p>
              <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
                Результаты появятся после одобрения врачом
              </p>
            </div>
          ) : (
            <div className="bg-[var(--color-surface)] rounded-2xl border border-border divide-y divide-border">
              {(results as ResultItem[]).map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setSelectedId(r.id)}
                  className="w-full flex items-center gap-4 p-4 hover:bg-[var(--color-muted)]/50 transition-colors text-left"
                >
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      r.is_abnormal
                        ? "bg-destructive/10 text-destructive"
                        : "bg-primary/10 text-[var(--color-primary-deep)]"
                    }`}
                  >
                    <svg
                      className="w-5 h-5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    >
                      <path d="M14 2v6a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V2" />
                      <path d="M10 2v3.3a4 4 0 0 1-1.17 2.83L4 13v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6l-4.83-4.87A4 4 0 0 1 14 5.3V2" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{r.test_name}</p>
                    <p className="text-xs text-[var(--color-text-tertiary)]">
                      {r.category} · {new Date(r.resulted_at).toLocaleDateString("ru-RU")}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`text-sm font-bold ${r.is_abnormal ? "text-destructive" : "text-foreground"}`}>
                      {r.value} {r.unit || ""}
                    </p>
                    {r.reference_range && (
                      <p className="text-[10px] text-[var(--color-text-tertiary)]">
                        Норма: {r.reference_range}
                      </p>
                    )}
                  </div>
                  <svg
                    className="w-4 h-4 text-[var(--color-text-tertiary)] flex-shrink-0"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

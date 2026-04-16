import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { portalApi } from "@/features/portal/api";
import { useState, useMemo } from "react";
import { formatDate, formatDateTime } from "@/lib/utils";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  ReferenceArea,
} from "recharts";

export const Route = createFileRoute("/portal/_portal/history")({
  component: HistoryPage,
});

// ─── Types ────────────────────────────────────────────────────────────────────

type HistoryTab = "visits" | "diagnoses" | "labs" | "documents";

interface RawVisit {
  id: string;
  visit_date?: string;
  created_at?: string;
  visit_type?: string;
  doctor_name?: string;
  doctor_specialization?: string;
  chief_complaint?: string;
  diagnosis_code?: string;
  diagnosis_text?: string;
  examination_notes?: string;
  prescriptions?: Array<{ name: string; dosage?: string; duration?: string }>;
  lab_results?: Array<{ test_name: string; value: string; unit?: string }>;
}

interface RawDiagnosis {
  id: string;
  icd_code: string;
  diagnosis_text: string;
  established_at: string;
  doctor_name?: string;
  status?: "ACTIVE" | "RESOLVED" | "CHRONIC";
}

interface RawResult {
  id: string;
  test_name: string;
  test_code?: string;
  category?: string;
  value: string;
  unit?: string;
  reference_range?: string;
  is_abnormal?: boolean;
  resulted_at: string;
  notes?: string;
}

interface RawDocument {
  id: string;
  title?: string;
  filename?: string;
  document_type?: string;
  created_at: string;
  file_url?: string;
  mime_type?: string;
}

// ─── Visit type labels ────────────────────────────────────────────────────────

const VISIT_TYPE_LABELS: Record<string, string> = {
  INITIAL: "Первичный",
  FOLLOW_UP: "Повторный",
  EMERGENCY: "Экстренный",
  CONSULTATION: "Консультация",
  PROCEDURE: "Процедура",
  TELEMEDICINE: "Телемедицина",
};

const VISIT_TYPE_COLORS: Record<string, string> = {
  INITIAL: "bg-secondary/10 text-secondary",
  FOLLOW_UP: "bg-primary/10 text-[var(--color-primary-deep)]",
  EMERGENCY: "bg-destructive/10 text-destructive",
  CONSULTATION: "bg-[#3B82F6]/10 text-[#3B82F6]",
  PROCEDURE: "bg-[#F59E0B]/10 text-[#F59E0B]",
  TELEMEDICINE: "bg-[#14B8A6]/10 text-[#14B8A6]",
};

// ─── Trend chart for a single lab test ───────────────────────────────────────

function LabTrendChart({ testId }: { testId: string }) {
  const { data: trendRaw } = useQuery({
    queryKey: ["portal-result-trend", testId],
    queryFn: () => portalApi.getResultTrend(testId),
    retry: false,
  });

  const trend = (trendRaw as Array<Record<string, unknown>>) ?? [];
  if (trend.length < 2) {
    return (
      <p className="text-xs text-[var(--color-text-tertiary)] py-4 text-center">
        Недостаточно данных для графика динамики
      </p>
    );
  }

  const chartData = trend.map((t) => ({
    date: new Date(String(t.resulted_at)).toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
    }),
    value: Number(t.value ?? 0),
  }));

  // Parse reference range e.g. "3.5-5.0" → [3.5, 5.0]
  const refRange = String(trend[0]?.reference_range ?? "");
  const rangeMatch = refRange.match(/^([\d.]+)[–\-]([\d.]+)$/);
  const refLow = rangeMatch ? parseFloat(rangeMatch[1]) : undefined;
  const refHigh = rangeMatch ? parseFloat(rangeMatch[2]) : undefined;

  const allValues = chartData.map((d) => d.value);
  const minVal = Math.min(...allValues, refLow ?? Infinity);
  const maxVal = Math.max(...allValues, refHigh ?? -Infinity);
  const padding = (maxVal - minVal) * 0.15 || 1;

  return (
    <div className="mt-3">
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={chartData} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: "var(--color-text-tertiary)" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            domain={[minVal - padding, maxVal + padding]}
            tick={{ fontSize: 10, fill: "var(--color-text-tertiary)" }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              return (
                <div className="bg-[var(--color-surface)] border border-border rounded-xl shadow-lg p-2.5 text-xs">
                  <p className="text-[var(--color-text-tertiary)]">{label}</p>
                  <p className="font-bold text-foreground">
                    {payload[0].value} {String(trend[0]?.unit ?? "")}
                  </p>
                  {refRange && (
                    <p className="text-[var(--color-text-tertiary)]">Норма: {refRange}</p>
                  )}
                </div>
              );
            }}
          />
          {/* Reference range shaded area */}
          {refLow !== undefined && refHigh !== undefined && (
            <ReferenceArea
              y1={refLow}
              y2={refHigh}
              fill="#10B981"
              fillOpacity={0.08}
              stroke="#10B981"
              strokeOpacity={0.3}
            />
          )}
          {refLow !== undefined && (
            <ReferenceLine y={refLow} stroke="#10B981" strokeDasharray="3 3" strokeWidth={1} />
          )}
          {refHigh !== undefined && (
            <ReferenceLine y={refHigh} stroke="#10B981" strokeDasharray="3 3" strokeWidth={1} />
          )}
          <Line
            type="monotone"
            dataKey="value"
            stroke="#7E78D2"
            strokeWidth={2}
            dot={{ r: 3, fill: "#7E78D2" }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
      {refRange && (
        <p className="text-[10px] text-[var(--color-text-tertiary)] mt-1">
          Зелёная полоса — референсный диапазон ({refRange} {String(trend[0]?.unit ?? "")})
        </p>
      )}
    </div>
  );
}

// ─── Visit card ───────────────────────────────────────────────────────────────

function VisitCard({ visit }: { visit: RawVisit }) {
  const [expanded, setExpanded] = useState(false);
  const date = visit.visit_date ?? visit.created_at ?? "";

  return (
    <div className="border-b border-border last:border-0">
      <button
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-start gap-4 p-5 hover:bg-[var(--color-muted)]/30 transition-colors text-left"
      >
        {/* Timeline dot */}
        <div className="flex flex-col items-center pt-1 flex-shrink-0">
          <div className="w-3 h-3 rounded-full bg-secondary border-2 border-[var(--color-surface)] ring-2 ring-secondary/30" />
          <div className="w-px flex-1 bg-border mt-1 min-h-[20px]" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <div>
              <p className="text-sm font-semibold text-foreground">
                {visit.doctor_name ?? "Врач не указан"}
              </p>
              <p className="text-xs text-[var(--color-text-tertiary)]">
                {visit.doctor_specialization ?? ""}
                {visit.doctor_specialization && date ? " · " : ""}
                {date ? formatDate(date) : ""}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {visit.visit_type && (
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                    VISIT_TYPE_COLORS[visit.visit_type] ??
                    "bg-[var(--color-muted)] text-[var(--color-text-secondary)]"
                  }`}
                >
                  {VISIT_TYPE_LABELS[visit.visit_type] ?? visit.visit_type}
                </span>
              )}
              <svg
                className={`w-4 h-4 text-[var(--color-text-tertiary)] transition-transform ${expanded ? "rotate-90" : ""}`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="m9 18 6-6-6-6" />
              </svg>
            </div>
          </div>

          {visit.chief_complaint && (
            <p className="text-xs text-[var(--color-text-secondary)] line-clamp-1">
              <span className="text-[var(--color-text-tertiary)]">Жалоба:</span>{" "}
              {visit.chief_complaint}
            </p>
          )}
          {visit.diagnosis_code && (
            <div className="flex items-center gap-1.5 mt-1">
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-muted)] text-[var(--color-text-secondary)]">
                {visit.diagnosis_code}
              </span>
              {visit.diagnosis_text && (
                <span className="text-xs text-foreground line-clamp-1">{visit.diagnosis_text}</span>
              )}
            </div>
          )}
        </div>
      </button>

      {expanded && (
        <div className="ml-12 mr-5 mb-4 space-y-3">
          {visit.examination_notes && (
            <div className="bg-[var(--color-muted)]/60 rounded-xl p-4">
              <p className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-2">
                Осмотр
              </p>
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">
                {visit.examination_notes}
              </p>
            </div>
          )}

          {visit.prescriptions && visit.prescriptions.length > 0 && (
            <div className="bg-secondary/5 border border-secondary/10 rounded-xl p-4">
              <p className="text-xs font-semibold text-secondary uppercase tracking-wider mb-2">
                Назначения
              </p>
              <ul className="space-y-1.5">
                {visit.prescriptions.map((rx, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-secondary mt-0.5">•</span>
                    <span className="text-foreground">{rx.name}</span>
                    {rx.dosage && (
                      <span className="text-[var(--color-text-tertiary)]">— {rx.dosage}</span>
                    )}
                    {rx.duration && (
                      <span className="text-[var(--color-text-tertiary)]">{rx.duration}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {visit.lab_results && visit.lab_results.length > 0 && (
            <div className="bg-[var(--color-muted)]/40 rounded-xl p-4">
              <p className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-2">
                Анализы
              </p>
              <div className="space-y-1">
                {visit.lab_results.map((lr, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="text-[var(--color-text-secondary)]">{lr.test_name}</span>
                    <span className="font-medium text-foreground">
                      {lr.value} {lr.unit ?? ""}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!visit.examination_notes &&
            (!visit.prescriptions || visit.prescriptions.length === 0) &&
            (!visit.lab_results || visit.lab_results.length === 0) && (
              <p className="text-xs text-[var(--color-text-tertiary)] py-2">
                Подробности визита не заполнены
              </p>
            )}
        </div>
      )}
    </div>
  );
}

// ─── Lab result row with expandable trend chart ───────────────────────────────

function LabResultRow({ result }: { result: RawResult }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-b border-border last:border-0">
      <button
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center gap-4 p-4 hover:bg-[var(--color-muted)]/30 transition-colors text-left"
      >
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
            result.is_abnormal ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-[var(--color-primary-deep)]"
          }`}
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M14 2v6a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V2" />
            <path d="M10 2v3.3a4 4 0 0 1-1.17 2.83L4 13v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6l-4.83-4.87A4 4 0 0 1 14 5.3V2" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">{result.test_name}</p>
          <p className="text-xs text-[var(--color-text-tertiary)]">
            {result.category ?? ""}
            {result.category && result.resulted_at ? " · " : ""}
            {result.resulted_at ? formatDate(result.resulted_at) : ""}
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <p
            className={`text-sm font-bold ${result.is_abnormal ? "text-destructive" : "text-foreground"}`}
          >
            {result.value} {result.unit ?? ""}
          </p>
          {result.reference_range && (
            <p className="text-[10px] text-[var(--color-text-tertiary)]">
              Норма: {result.reference_range}
            </p>
          )}
        </div>
        {result.is_abnormal && (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-destructive/10 text-destructive flex-shrink-0">
            ↑ Откл.
          </span>
        )}
        <svg
          className={`w-4 h-4 text-[var(--color-text-tertiary)] flex-shrink-0 transition-transform ${expanded ? "rotate-90" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="m9 18 6-6-6-6" />
        </svg>
      </button>

      {expanded && (
        <div className="px-5 pb-4">
          {result.notes && (
            <div className="bg-secondary/5 border border-secondary/10 rounded-xl p-3 mb-3">
              <p className="text-xs font-semibold text-secondary mb-1">Комментарий врача</p>
              <p className="text-sm text-foreground">{result.notes}</p>
            </div>
          )}
          <p className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-1">
            Динамика
          </p>
          <LabTrendChart testId={result.id} />
        </div>
      )}
    </div>
  );
}

// ─── Document card ────────────────────────────────────────────────────────────

function DocumentCard({ doc }: { doc: RawDocument }) {
  const isPdf = doc.mime_type?.includes("pdf") || doc.filename?.endsWith(".pdf");
  const title = doc.title ?? doc.filename ?? "Документ";
  const typeLabel: Record<string, string> = {
    DISCHARGE_SUMMARY: "Выписка",
    LAB_REPORT: "Анализ",
    IMAGING: "Снимок",
    PRESCRIPTION: "Рецепт",
    CONSENT: "Согласие",
    OTHER: "Прочее",
  };

  return (
    <a
      href={doc.file_url ?? "#"}
      target="_blank"
      rel="noopener noreferrer"
      className="bg-[var(--color-surface)] border border-border rounded-2xl p-4 flex flex-col gap-3 hover:border-secondary/40 hover:shadow-sm transition-all"
    >
      <div
        className={`w-full aspect-[4/3] rounded-xl flex items-center justify-center ${isPdf ? "bg-destructive/5" : "bg-secondary/5"}`}
      >
        {isPdf ? (
          <svg className="w-10 h-10 text-destructive/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
            <path d="M14 2v4a2 2 0 0 0 2 2h4" />
            <path d="M10 12a1 1 0 0 0-1 1v1a1 1 0 0 1-1 1 1 1 0 0 1 1 1v1a1 1 0 0 0 1 1" />
            <path d="M14 18a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1 1 1 0 0 1-1-1v-1a1 1 0 0 0-1-1" />
          </svg>
        ) : (
          <svg className="w-10 h-10 text-secondary/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
            <circle cx="9" cy="9" r="2" />
            <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
          </svg>
        )}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-foreground truncate">{title}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          {doc.document_type && (
            <span className="text-[10px] text-[var(--color-text-tertiary)]">
              {typeLabel[doc.document_type] ?? doc.document_type}
            </span>
          )}
          {doc.created_at && (
            <span className="text-[10px] text-[var(--color-text-tertiary)]">
              · {formatDate(doc.created_at)}
            </span>
          )}
        </div>
      </div>
    </a>
  );
}

// ─── Filter bar ───────────────────────────────────────────────────────────────

interface Filters {
  from: string;
  to: string;
  search: string;
  type: string;
}

function FiltersBar({
  filters,
  onChange,
}: {
  filters: Filters;
  onChange: (f: Partial<Filters>) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2 mb-5 animate-float-up" style={{ animationDelay: "200ms" }}>
      <input
        type="date"
        value={filters.from}
        onChange={(e) => onChange({ from: e.target.value })}
        className="text-xs rounded-xl border border-border bg-[var(--color-surface)] px-3 py-2 text-foreground placeholder-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-secondary/30"
        placeholder="С"
      />
      <input
        type="date"
        value={filters.to}
        onChange={(e) => onChange({ to: e.target.value })}
        className="text-xs rounded-xl border border-border bg-[var(--color-surface)] px-3 py-2 text-foreground placeholder-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-secondary/30"
        placeholder="По"
      />
      <div className="relative flex-1 min-w-[180px]">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--color-text-tertiary)]"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
        </svg>
        <input
          type="text"
          value={filters.search}
          onChange={(e) => onChange({ search: e.target.value })}
          placeholder="Поиск…"
          className="w-full text-xs rounded-xl border border-border bg-[var(--color-surface)] pl-8 pr-3 py-2 text-foreground placeholder-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-secondary/30"
        />
      </div>
      {(filters.from || filters.to || filters.search) && (
        <button
          onClick={() => onChange({ from: "", to: "", search: "" })}
          className="px-3 py-2 rounded-xl text-xs text-[var(--color-text-secondary)] hover:text-destructive hover:bg-destructive/5 transition-colors border border-border"
        >
          Сбросить
        </button>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

function HistoryPage() {
  const [tab, setTab] = useState<HistoryTab>("visits");
  const [filters, setFilters] = useState<Filters>({ from: "", to: "", search: "", type: "" });

  const updateFilters = (partial: Partial<Filters>) =>
    setFilters((f) => ({ ...f, ...partial }));

  // Visits: pass server-side filters
  const { data: visitsRaw, isLoading: visitsLoading } = useQuery({
    queryKey: ["portal-visits", filters.from, filters.to, filters.search],
    queryFn: () =>
      portalApi.getVisits({
        from: filters.from || undefined,
        to: filters.to || undefined,
        search: filters.search || undefined,
      }),
    enabled: tab === "visits",
  });

  const { data: diagnosesRaw, isLoading: diagnosesLoading } = useQuery({
    queryKey: ["portal-diagnoses"],
    queryFn: portalApi.getDiagnoses,
    enabled: tab === "diagnoses",
  });

  const { data: resultsRaw, isLoading: resultsLoading } = useQuery({
    queryKey: ["portal-results"],
    queryFn: portalApi.getResults,
    enabled: tab === "labs",
  });

  const { data: documentsRaw, isLoading: documentsLoading } = useQuery({
    queryKey: ["portal-documents"],
    queryFn: portalApi.getDocuments,
    retry: false,
    enabled: tab === "documents",
  });

  const visits: RawVisit[] = (visitsRaw as RawVisit[]) ?? [];
  const diagnoses: RawDiagnosis[] = (diagnosesRaw as RawDiagnosis[]) ?? [];
  const results: RawResult[] = (resultsRaw as RawResult[]) ?? [];
  const documents: RawDocument[] = (documentsRaw as RawDocument[]) ?? [];

  // Client-side filter for labs/documents (server doesn't support it yet)
  const filteredResults = useMemo(() => {
    let r = results;
    if (filters.from) r = r.filter((x) => x.resulted_at >= filters.from);
    if (filters.to) r = r.filter((x) => x.resulted_at <= filters.to + "T23:59:59");
    if (filters.search) {
      const q = filters.search.toLowerCase();
      r = r.filter(
        (x) =>
          x.test_name.toLowerCase().includes(q) || (x.category ?? "").toLowerCase().includes(q)
      );
    }
    return r;
  }, [results, filters]);

  const activeDiagnoses = diagnoses.filter(
    (d) => d.status === "ACTIVE" || d.status === "CHRONIC" || !d.status
  );
  const archivedDiagnoses = diagnoses.filter((d) => d.status === "RESOLVED");

  const tabs: Array<{ id: HistoryTab; label: string }> = [
    { id: "visits", label: "Визиты" },
    { id: "diagnoses", label: "Диагнозы" },
    { id: "labs", label: "Анализы" },
    { id: "documents", label: "Документы" },
  ];

  return (
    <div className="max-w-4xl">
      <h1 className="text-[24px] font-bold text-foreground tracking-tight mb-2 animate-float-up">
        История
      </h1>
      <p
        className="text-[var(--color-text-secondary)] text-sm mb-6 animate-float-up"
        style={{ animationDelay: "50ms" }}
      >
        Медицинская история и документы
      </p>

      {/* ── Tab bar ───────────────────────────────────────────────── */}
      <div
        className="flex gap-1 p-1 bg-[var(--color-muted)] rounded-xl mb-5 animate-float-up"
        style={{ animationDelay: "100ms" }}
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-2 px-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
              tab === t.id
                ? "bg-[var(--color-surface)] text-foreground shadow-sm"
                : "text-[var(--color-text-secondary)] hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Filters bar ───────────────────────────────────────────── */}
      <FiltersBar filters={filters} onChange={updateFilters} />

      {/* ── VISITS tab ────────────────────────────────────────────── */}
      {tab === "visits" && (
        <div
          className="bg-[var(--color-surface)] rounded-2xl border border-border animate-float-up"
          style={{ animationDelay: "240ms" }}
        >
          {visitsLoading ? (
            <div className="p-5 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 bg-[var(--color-muted)] rounded-xl animate-pulse" />
              ))}
            </div>
          ) : visits.length === 0 ? (
            <div className="p-10 text-center">
              <svg
                className="w-10 h-10 mx-auto mb-3 text-[var(--color-text-tertiary)]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
                <line x1="16" x2="16" y1="2" y2="6" /><line x1="8" x2="8" y1="2" y2="6" />
                <line x1="3" x2="21" y1="10" y2="10" />
              </svg>
              <p className="text-[var(--color-text-secondary)] text-sm">
                {filters.search || filters.from || filters.to
                  ? "Визиты по фильтрам не найдены"
                  : "История визитов пуста"}
              </p>
            </div>
          ) : (
            <div>
              {visits.map((v) => (
                <VisitCard key={v.id} visit={v} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── DIAGNOSES tab ─────────────────────────────────────────── */}
      {tab === "diagnoses" && (
        <div className="space-y-5 animate-float-up" style={{ animationDelay: "240ms" }}>
          {diagnosesLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-[var(--color-muted)] rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : diagnoses.length === 0 ? (
            <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-10 text-center">
              <p className="text-[var(--color-text-secondary)] text-sm">Диагнозы не найдены</p>
            </div>
          ) : (
            <>
              {activeDiagnoses.length > 0 && (
                <section>
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)] mb-3">
                    Активные диагнозы
                  </h2>
                  <div className="bg-[var(--color-surface)] rounded-2xl border border-border divide-y divide-border">
                    {activeDiagnoses.map((d) => (
                      <div key={d.id} className="flex items-start gap-4 p-4">
                        <span className="font-mono text-xs px-2 py-1 rounded-lg bg-destructive/10 text-destructive font-bold flex-shrink-0 mt-0.5">
                          {d.icd_code}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">
                            {d.diagnosis_text}
                          </p>
                          <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">
                            {d.doctor_name ? `${d.doctor_name} · ` : ""}
                            {d.established_at ? formatDate(d.established_at) : ""}
                          </p>
                        </div>
                        {d.status === "CHRONIC" && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-warning/10 text-warning flex-shrink-0">
                            Хроническое
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {archivedDiagnoses.length > 0 && (
                <section>
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)] mb-3">
                    Архивные диагнозы
                  </h2>
                  <div className="bg-[var(--color-surface)] rounded-2xl border border-border divide-y divide-border opacity-70">
                    {archivedDiagnoses.map((d) => (
                      <div key={d.id} className="flex items-start gap-4 p-4">
                        <span className="font-mono text-xs px-2 py-1 rounded-lg bg-[var(--color-muted)] text-[var(--color-text-secondary)] font-bold flex-shrink-0 mt-0.5">
                          {d.icd_code}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[var(--color-text-secondary)] line-through">
                            {d.diagnosis_text}
                          </p>
                          <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">
                            {d.doctor_name ? `${d.doctor_name} · ` : ""}
                            {d.established_at ? formatDate(d.established_at) : ""}
                          </p>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-success/10 text-success flex-shrink-0">
                          Вылечен
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      )}

      {/* ── LABS tab ──────────────────────────────────────────────── */}
      {tab === "labs" && (
        <div
          className="bg-[var(--color-surface)] rounded-2xl border border-border animate-float-up"
          style={{ animationDelay: "240ms" }}
        >
          {resultsLoading ? (
            <div className="p-5 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-[var(--color-muted)] rounded-xl animate-pulse" />
              ))}
            </div>
          ) : filteredResults.length === 0 ? (
            <div className="p-10 text-center">
              <svg
                className="w-10 h-10 mx-auto mb-3 text-[var(--color-text-tertiary)]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M14 2v6a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V2" />
                <path d="M10 2v3.3a4 4 0 0 1-1.17 2.83L4 13v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6l-4.83-4.87A4 4 0 0 1 14 5.3V2" />
              </svg>
              <p className="text-[var(--color-text-secondary)] text-sm">
                {filters.search || filters.from || filters.to
                  ? "Результаты по фильтрам не найдены"
                  : "Нет доступных результатов"}
              </p>
            </div>
          ) : (
            <div>
              {/* Abnormal results first */}
              {filteredResults.some((r) => r.is_abnormal) && (
                <div className="px-5 pt-4 pb-1">
                  <p className="text-xs font-semibold text-destructive uppercase tracking-wider">
                    Отклонения
                  </p>
                </div>
              )}
              {filteredResults
                .filter((r) => r.is_abnormal)
                .map((r) => (
                  <LabResultRow key={r.id} result={r} />
                ))}
              {filteredResults.some((r) => !r.is_abnormal) && (
                <div className="px-5 pt-4 pb-1">
                  <p className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">
                    Норма
                  </p>
                </div>
              )}
              {filteredResults
                .filter((r) => !r.is_abnormal)
                .map((r) => (
                  <LabResultRow key={r.id} result={r} />
                ))}
            </div>
          )}
        </div>
      )}

      {/* ── DOCUMENTS tab ─────────────────────────────────────────── */}
      {tab === "documents" && (
        <div className="animate-float-up" style={{ animationDelay: "240ms" }}>
          {documentsLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="aspect-[4/3] bg-[var(--color-muted)] rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : documents.length === 0 ? (
            <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-10 text-center">
              <svg
                className="w-10 h-10 mx-auto mb-3 text-[var(--color-text-tertiary)]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
                <path d="M14 2v4a2 2 0 0 0 2 2h4" />
              </svg>
              <p className="text-[var(--color-text-secondary)] text-sm">Нет загруженных документов</p>
              <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
                Документы добавляются персоналом клиники
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {documents.map((doc) => (
                <DocumentCard key={doc.id} doc={doc} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

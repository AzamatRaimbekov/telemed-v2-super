import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { patientsApi } from "@/features/patients/api";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute(
  "/_authenticated/patients/$patientId/diagnoses"
)({
  component: DiagnosesPage,
});

interface Diagnosis {
  id: string;
  code: string;
  text: string | null;
  visit_type: string;
  visit_status: string;
  chief_complaint: string | null;
  doctor_id: string;
  doctor_name: string;
  date: string | null;
  status: string;
}

const VISIT_TYPE_LABELS: Record<string, string> = {
  CONSULTATION: "Консультация",
  FOLLOW_UP: "Повторный приём",
  EMERGENCY: "Экстренный",
  TELEMEDICINE: "Телемедицина",
  PROCEDURE: "Процедура",
};

const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "Все" },
  { value: "active", label: "Активные" },
  { value: "pending", label: "В процессе" },
];

function DiagnosesPage() {
  const { patientId } = Route.useParams();
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  const { data: rawDiagnoses, isLoading } = useQuery({
    queryKey: ["patient-diagnoses", patientId],
    queryFn: () => patientsApi.getDiagnoses(patientId),
  });

  const diagnoses = useMemo(() => {
    let items = (rawDiagnoses as Diagnosis[]) || [];

    if (statusFilter !== "all") {
      items = items.filter((d) => d.status === statusFilter);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(
        (d) =>
          d.code.toLowerCase().includes(q) ||
          (d.text && d.text.toLowerCase().includes(q)) ||
          (d.doctor_name && d.doctor_name.toLowerCase().includes(q))
      );
    }

    return items;
  }, [rawDiagnoses, statusFilter, search]);

  // Unique codes count
  const uniqueCodes = useMemo(() => {
    const codes = new Set((rawDiagnoses as Diagnosis[] || []).map((d) => d.code));
    return codes.size;
  }, [rawDiagnoses]);

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-10 w-48 bg-[var(--color-muted)] rounded-lg" />
        <div className="h-32 bg-[var(--color-muted)] rounded-2xl" />
        <div className="h-32 bg-[var(--color-muted)] rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-foreground">Диагнозы</h2>
          {uniqueCodes > 0 && (
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-secondary/10 text-secondary">
              {uniqueCodes} {uniqueCodes === 1 ? "диагноз" : uniqueCodes < 5 ? "диагноза" : "диагнозов"}
            </span>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Status filter tabs */}
        <div className="flex bg-[var(--color-muted)] rounded-lg p-0.5">
          {STATUS_FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setStatusFilter(opt.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                statusFilter === opt.value
                  ? "bg-[var(--color-surface)] text-foreground shadow-sm"
                  : "text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-tertiary)]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по коду или тексту..."
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-border bg-[var(--color-surface)] text-foreground placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-secondary/30"
          />
        </div>
      </div>

      {/* Diagnosis list */}
      {diagnoses.length === 0 ? (
        <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[var(--color-muted)] flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-7 h-7 text-[var(--color-text-tertiary)]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6 6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3" />
              <path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4" />
              <circle cx="20" cy="10" r="2" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-foreground mb-1">
            {search || statusFilter !== "all" ? "Ничего не найдено" : "Нет диагнозов"}
          </h3>
          <p className="text-sm text-[var(--color-text-secondary)]">
            {search || statusFilter !== "all"
              ? "Попробуйте изменить фильтры"
              : "Диагнозы появятся после визитов к врачу"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {diagnoses.map((d, idx) => (
            <div
              key={`${d.id}-${idx}`}
              className="bg-[var(--color-surface)] rounded-2xl border border-border p-5 hover:border-secondary/20 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  {/* Code + status row */}
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <span className="px-3 py-1 rounded-lg text-sm font-mono font-bold bg-secondary/10 text-secondary">
                      {d.code}
                    </span>
                    <Badge
                      variant={d.status === "active" ? "success" : "warning"}
                      dot
                    >
                      {d.status === "active" ? "Активный" : "В процессе"}
                    </Badge>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-[var(--color-muted)] text-[var(--color-text-secondary)]">
                      {VISIT_TYPE_LABELS[d.visit_type] || d.visit_type}
                    </span>
                  </div>

                  {/* Diagnosis text */}
                  {d.text && (
                    <p className="text-sm text-foreground leading-relaxed mb-2">
                      {d.text}
                    </p>
                  )}

                  {/* Chief complaint */}
                  {d.chief_complaint && (
                    <p className="text-xs text-[var(--color-text-secondary)] mb-2">
                      <span className="text-[var(--color-text-tertiary)]">Жалоба:</span>{" "}
                      {d.chief_complaint}
                    </p>
                  )}

                  {/* Doctor + date */}
                  <div className="flex items-center gap-4 text-xs text-[var(--color-text-tertiary)]">
                    {d.doctor_name && (
                      <span className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                          <circle cx="12" cy="7" r="4" />
                        </svg>
                        {d.doctor_name}
                      </span>
                    )}
                    {d.date && (
                      <span className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
                          <line x1="16" x2="16" y1="2" y2="6" />
                          <line x1="8" x2="8" y1="2" y2="6" />
                          <line x1="3" x2="21" y1="10" y2="10" />
                        </svg>
                        {formatDate(d.date)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

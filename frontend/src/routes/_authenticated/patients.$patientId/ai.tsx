import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { patientsApi } from "@/features/patients/api";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute(
  "/_authenticated/patients/$patientId/ai"
)({
  component: AiAssistantPage,
});

interface AiAnalysis {
  summary: string;
  recommendations: string[];
  risks: string[];
  trends: string[];
  source: string;
  model?: string;
  medications_count?: number;
  diagnoses_count?: number;
  abnormal_labs_count?: number;
}

function AiAssistantPage() {
  const { patientId } = Route.useParams();

  const {
    data: analysis,
    isLoading,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["patient-ai-summary", patientId],
    queryFn: () => patientsApi.getAiSummary(patientId),
  });

  const ai = analysis as AiAnalysis | undefined;

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-10 bg-[var(--color-muted)] rounded-xl w-64" />
        <div className="h-40 bg-[var(--color-muted)] rounded-2xl" />
        <div className="h-52 bg-[var(--color-muted)] rounded-2xl" />
        <div className="h-40 bg-[var(--color-muted)] rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-blue-500/20 flex items-center justify-center">
            <svg
              className="w-5 h-5 text-violet-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">ИИ Ассистент</h2>
            <p className="text-xs text-[var(--color-text-tertiary)]">
              {ai?.source === "ai"
                ? `Анализ: ${ai.model || "AI"}`
                : ai?.source === "rules"
                  ? "Анализ на основе правил"
                  : "Клинический анализ"}
            </p>
          </div>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => refetch()}
          loading={isFetching}
        >
          Обновить анализ
        </Button>
      </div>

      {/* Source badge */}
      {ai?.source && (
        <div className="flex items-center gap-2">
          {ai.source === "ai" ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-violet-500/10 text-violet-400 border border-violet-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
              GPT-4o-mini — AI анализ
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
              Локальный анализ (без AI-ключа)
            </span>
          )}
        </div>
      )}

      {/* Summary */}
      {ai?.summary && (
        <div className="bg-gradient-to-br from-[#0f172a] to-[#1e1b4b] rounded-2xl border border-white/5 p-6">
          <p className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-3">
            Сводка
          </p>
          <p className="text-sm text-white/80 leading-relaxed">{ai.summary}</p>
          {(ai.medications_count != null || ai.diagnoses_count != null) && (
            <div className="flex flex-wrap gap-3 mt-4">
              {ai.diagnoses_count != null && (
                <div className="px-3 py-1.5 bg-white/5 rounded-lg">
                  <span className="text-xs text-white/40">Диагнозы: </span>
                  <span className="text-sm font-semibold text-white">
                    {ai.diagnoses_count}
                  </span>
                </div>
              )}
              {ai.medications_count != null && (
                <div className="px-3 py-1.5 bg-white/5 rounded-lg">
                  <span className="text-xs text-white/40">Препараты: </span>
                  <span className="text-sm font-semibold text-white">
                    {ai.medications_count}
                  </span>
                </div>
              )}
              {ai.abnormal_labs_count != null && ai.abnormal_labs_count > 0 && (
                <div className="px-3 py-1.5 bg-red-500/10 rounded-lg">
                  <span className="text-xs text-red-400">
                    Отклонения в анализах:{" "}
                  </span>
                  <span className="text-sm font-semibold text-red-400">
                    {ai.abnormal_labs_count}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Risks */}
      {ai?.risks && ai.risks.length > 0 && (
        <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-5">
          <div className="flex items-center gap-2 mb-4">
            <svg
              className="w-5 h-5 text-red-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
              <path d="M12 9v4" />
              <path d="M12 17h.01" />
            </svg>
            <h3 className="text-sm font-semibold text-foreground">
              Риски и предупреждения
            </h3>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-500/10 text-red-400">
              {ai.risks.length}
            </span>
          </div>
          <div className="space-y-2">
            {ai.risks.map((risk, i) => (
              <div
                key={i}
                className="flex items-start gap-3 p-3 bg-red-500/5 rounded-xl border border-red-500/10"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1.5 flex-shrink-0" />
                <p className="text-sm text-foreground">{risk}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {ai?.recommendations && ai.recommendations.length > 0 && (
        <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-5">
          <div className="flex items-center gap-2 mb-4">
            <svg
              className="w-5 h-5 text-emerald-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
            <h3 className="text-sm font-semibold text-foreground">
              Рекомендации
            </h3>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400">
              {ai.recommendations.length}
            </span>
          </div>
          <div className="space-y-2">
            {ai.recommendations.map((rec, i) => (
              <div
                key={i}
                className="flex items-start gap-3 p-3 bg-emerald-500/5 rounded-xl border border-emerald-500/10"
              >
                <span className="text-xs font-bold text-emerald-400 mt-0.5 flex-shrink-0 w-5 text-center">
                  {i + 1}
                </span>
                <p className="text-sm text-foreground">{rec}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trends */}
      {ai?.trends && ai.trends.length > 0 && (
        <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-5">
          <div className="flex items-center gap-2 mb-4">
            <svg
              className="w-5 h-5 text-blue-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
              <polyline points="16 7 22 7 22 13" />
            </svg>
            <h3 className="text-sm font-semibold text-foreground">Динамика</h3>
          </div>
          <div className="space-y-2">
            {ai.trends.map((trend, i) => {
              const isPositive =
                trend.includes("улучшение") ||
                trend.includes("положительная") ||
                trend.includes("снижение");
              return (
                <div
                  key={i}
                  className={`flex items-start gap-3 p-3 rounded-xl border ${
                    isPositive
                      ? "bg-emerald-500/5 border-emerald-500/10"
                      : "bg-amber-500/5 border-amber-500/10"
                  }`}
                >
                  <span
                    className={`text-sm font-bold flex-shrink-0 ${isPositive ? "text-emerald-400" : "text-amber-400"}`}
                  >
                    {isPositive ? "▲" : "▼"}
                  </span>
                  <p className="text-sm text-foreground">{trend}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state — no data at all */}
      {ai &&
        !ai.summary &&
        (!ai.recommendations || ai.recommendations.length === 0) &&
        (!ai.risks || ai.risks.length === 0) && (
          <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-[var(--color-muted)] flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-6 h-6 text-[var(--color-text-tertiary)]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-foreground mb-1">
              Недостаточно данных
            </p>
            <p className="text-xs text-[var(--color-text-secondary)]">
              Заполните данные пациента (витальные показатели, диагнозы,
              анализы) для генерации анализа.
            </p>
          </div>
        )}
    </div>
  );
}

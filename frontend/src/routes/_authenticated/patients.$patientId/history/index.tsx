import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { patientsApi } from "@/features/patients/api";
import { formatDate, formatDateTime } from "@/lib/utils";
import { CustomSelect } from "@/components/ui/select-custom";

type HistorySearch = {
  entry_type?: string;
  period?: string;
  author_id?: string;
};

export const Route = createFileRoute(
  "/_authenticated/patients/$patientId/history/"
)({
  validateSearch: (search: Record<string, unknown>): HistorySearch => ({
    entry_type: (search.entry_type as string) || undefined,
    period: (search.period as string) || undefined,
    author_id: (search.author_id as string) || undefined,
  }),
  component: HistoryIndexPage,
});

const ENTRY_TYPE_META: Record<
  string,
  { label: string; color: string; bg: string; dotColor: string }
> = {
  initial_exam: {
    label: "Первичный осмотр",
    color: "text-destructive",
    bg: "bg-destructive/10",
    dotColor: "bg-destructive",
  },
  daily_note: {
    label: "Дневниковая запись",
    color: "text-blue-600",
    bg: "bg-blue-50",
    dotColor: "bg-blue-500",
  },
  specialist_consult: {
    label: "Консультация специалиста",
    color: "text-purple-600",
    bg: "bg-purple-50",
    dotColor: "bg-purple-500",
  },
  procedure_note: {
    label: "Запись о процедуре",
    color: "text-success",
    bg: "bg-success/10",
    dotColor: "bg-success",
  },
  ai_generated: {
    label: "ИИ",
    color: "text-amber-600",
    bg: "bg-amber-50",
    dotColor: "bg-amber-400",
  },
  imaging_description: {
    label: "Описание снимка",
    color: "text-cyan-600",
    bg: "bg-cyan-50",
    dotColor: "bg-cyan-500",
  },
};

function getTypeMeta(type: string) {
  return (
    ENTRY_TYPE_META[type] || {
      label: type,
      color: "text-[var(--color-text-secondary)]",
      bg: "bg-[var(--color-muted)]",
      dotColor: "bg-[var(--color-text-tertiary)]",
    }
  );
}

const PERIOD_OPTIONS = [
  { value: "", label: "Вся история" },
  { value: "current", label: "Текущая госпитализация" },
  { value: "1m", label: "За 1 месяц" },
  { value: "3m", label: "За 3 месяца" },
];

const TYPE_OPTIONS = [
  { value: "", label: "Все типы" },
  { value: "initial_exam", label: "Первичный осмотр" },
  { value: "daily_note", label: "Дневниковая запись" },
  { value: "specialist_consult", label: "Консультация" },
  { value: "procedure_note", label: "Запись о процедуре" },
  { value: "ai_generated", label: "ИИ запись" },
  { value: "imaging_description", label: "Описание снимка" },
];

function HistoryIndexPage() {
  const { patientId } = Route.useParams();
  const { entry_type, period, author_id } = Route.useSearch();
  const navigate = useNavigate();

  const { data: historyData, isLoading } = useQuery({
    queryKey: ["patient-history", patientId, { entry_type, period, author_id }],
    queryFn: () =>
      patientsApi.getHistory(patientId, {
        entry_type: entry_type || undefined,
        period: period || undefined,
        author_id: author_id || undefined,
        limit: 100,
      }),
  });

  const { data: statsData } = useQuery({
    queryKey: ["patient-history-stats", patientId],
    queryFn: () => patientsApi.getHistoryStats(patientId),
  });

  const entries: Array<Record<string, unknown>> = Array.isArray(historyData)
    ? historyData
    : (historyData as { items?: Array<Record<string, unknown>> })?.items ?? [];

  // Group entries by date
  const grouped = entries.reduce<Record<string, Array<Record<string, unknown>>>>(
    (acc, entry) => {
      const dateStr = entry.created_at
        ? formatDate(entry.created_at as string)
        : "Неизвестная дата";
      if (!acc[dateStr]) acc[dateStr] = [];
      acc[dateStr].push(entry);
      return acc;
    },
    {}
  );

  const setFilter = (key: keyof HistorySearch, value: string) => {
    navigate({
      search: (prev) => ({ ...prev, [key]: value || undefined }),
      replace: true,
    });
  };

  return (
    <div className="flex gap-6">
      {/* Main timeline — 70% */}
      <div className="flex-1 min-w-0">
        {/* Filters */}
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <CustomSelect
            value={period || ""}
            onChange={(val) => setFilter("period", val)}
            options={PERIOD_OPTIONS}
            placeholder="Вся история"
          />
          <CustomSelect
            value={entry_type || ""}
            onChange={(val) => setFilter("entry_type", val)}
            options={TYPE_OPTIONS}
            placeholder="Все типы"
          />
          <div className="flex-1" />
          <Link
            to="/patients/$patientId/history/new"
            params={{ patientId }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-secondary text-white text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="12" x2="12" y1="5" y2="19" />
              <line x1="5" x2="19" y1="12" y2="12" />
            </svg>
            Добавить запись
          </Link>
        </div>

        {/* Timeline */}
        {isLoading ? (
          <div className="space-y-4 animate-pulse">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 bg-[var(--color-muted)] rounded-2xl" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-12 text-center">
            <svg
              className="w-10 h-10 text-[var(--color-text-tertiary)] mx-auto mb-3"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            <p className="text-[var(--color-text-secondary)]">Записи не найдены</p>
            <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
              Попробуйте изменить фильтры или добавьте первую запись
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(grouped).map(([date, dayEntries]) => (
              <div key={date}>
                {/* Date header */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider px-2">
                    {date}
                  </span>
                  <div className="h-px flex-1 bg-border" />
                </div>

                {/* Entries */}
                <div className="relative pl-6 space-y-3">
                  {/* Vertical line */}
                  <div className="absolute left-2 top-0 bottom-0 w-px bg-border" />

                  {dayEntries.map((entry) => {
                    const meta = getTypeMeta(String(entry.entry_type || ""));
                    const isAI = entry.entry_type === "ai_generated";
                    const time = entry.created_at
                      ? formatDateTime(entry.created_at as string).split(" ")[1]
                      : "";

                    return (
                      <Link
                        key={entry.id as string}
                        to="/patients/$patientId/history/$entryId"
                        params={{
                          patientId,
                          entryId: entry.id as string,
                        }}
                        className="relative block bg-[var(--color-surface)] rounded-2xl border border-border p-4 hover:border-secondary/30 hover:shadow-sm transition-all group"
                      >
                        {/* Timeline dot */}
                        <div
                          className={`absolute -left-[17px] top-5 w-2.5 h-2.5 rounded-full border-2 border-background ${meta.dotColor}`}
                        />

                        <div className="flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span
                                className={`px-2 py-0.5 rounded-full text-xs font-medium ${meta.bg} ${meta.color}`}
                              >
                                {meta.label}
                              </span>
                              {isAI && (
                                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700">
                                  ИИ
                                </span>
                              )}
                              {isAI && !entry.is_verified && (
                                <span className="px-2 py-0.5 rounded-full text-xs bg-warning/10 text-warning">
                                  Требует подтверждения
                                </span>
                              )}
                              {isAI && entry.confidence_score != null && (
                                <span className="text-xs text-[var(--color-text-tertiary)]">
                                  {Math.round(
                                    (entry.confidence_score as number) * 100
                                  )}
                                  % достоверность
                                </span>
                              )}
                            </div>
                            {entry.title && (
                              <p className="text-sm font-semibold text-foreground mb-1">
                                {String(entry.title)}
                              </p>
                            )}
                            {entry.content && (
                              <p className="text-sm text-[var(--color-text-secondary)] line-clamp-3">
                                {String(entry.content)}
                              </p>
                            )}
                            {entry.author_name && (
                              <p className="text-xs text-[var(--color-text-tertiary)] mt-1.5">
                                {String(entry.author_name)}
                              </p>
                            )}
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-xs font-mono text-[var(--color-text-tertiary)]">
                              {time}
                            </p>
                            <svg
                              className="w-4 h-4 text-[var(--color-text-tertiary)] mt-1 ml-auto opacity-0 group-hover:opacity-100 transition-opacity"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <path d="m9 18 6-6-6-6" />
                            </svg>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sidebar — 30% */}
      <aside className="w-64 flex-shrink-0 space-y-4">
        {/* Stats by type */}
        <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-4">
          <h4 className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-3">
            Статистика
          </h4>
          {statsData ? (
            <div className="space-y-2">
              {Object.entries(
                (statsData as Record<string, unknown>) || {}
              ).map(([type, count]) => {
                const meta = getTypeMeta(type);
                return (
                  <button
                    key={type}
                    onClick={() =>
                      setFilter("entry_type", entry_type === type ? "" : type)
                    }
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-all ${
                      entry_type === type
                        ? `${meta.bg} ${meta.color} font-medium`
                        : "hover:bg-[var(--color-muted)] text-foreground"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full ${meta.dotColor}`}
                      />
                      {meta.label}
                    </span>
                    <span className="font-mono text-xs">{String(count)}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-8 bg-[var(--color-muted)] rounded-xl animate-pulse"
                />
              ))}
            </div>
          )}
        </div>

        {/* Quick filters */}
        <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-4">
          <h4 className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-3">
            Быстрые фильтры
          </h4>
          <div className="space-y-1">
            {PERIOD_OPTIONS.filter((o) => o.value).map((o) => (
              <button
                key={o.value}
                onClick={() =>
                  setFilter("period", period === o.value ? "" : o.value)
                }
                className={`w-full text-left px-3 py-2 rounded-xl text-sm transition-all ${
                  period === o.value
                    ? "bg-secondary/10 text-secondary font-medium"
                    : "hover:bg-[var(--color-muted)] text-[var(--color-text-secondary)]"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}

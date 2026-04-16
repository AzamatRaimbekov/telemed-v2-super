import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { patientsApi } from "@/features/patients/api";
import { formatDateTime } from "@/lib/utils";
import { toast } from "sonner";

type LabsSearch = {
  status?: string;
  from?: string;
  to?: string;
};

export const Route = createFileRoute(
  "/_authenticated/patients/$patientId/labs"
)({
  validateSearch: (search: Record<string, unknown>): LabsSearch => ({
    status: (search.status as string) || undefined,
    from: (search.from as string) || undefined,
    to: (search.to as string) || undefined,
  }),
  component: LabsPage,
});

function LabsPage() {
  const { patientId } = Route.useParams();
  const { status } = Route.useSearch();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: labResults, isLoading } = useQuery({
    queryKey: ["patient-results", patientId],
    queryFn: () => patientsApi.getLabResults(patientId),
  });

  const approveMutation = useMutation({
    mutationFn: ({
      resultId,
      visible,
    }: {
      resultId: string;
      visible: boolean;
    }) => patientsApi.approveResult(resultId, visible),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patient-results", patientId] });
      toast.success("Результат обновлён");
    },
    onError: () => toast.error("Не удалось обновить результат"),
  });

  const results = (labResults as Array<Record<string, unknown>> | undefined) ?? [];
  const filtered = status
    ? results.filter((r) =>
        status === "abnormal"
          ? r.is_abnormal
          : status === "visible"
          ? r.visible_to_patient
          : !r.visible_to_patient
      )
    : results;

  if (isLoading) {
    return (
      <div className="space-y-3 animate-pulse">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-16 bg-[var(--color-muted)] rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        {[
          { value: "", label: "Все результаты" },
          { value: "abnormal", label: "Отклонения" },
          { value: "visible", label: "Видны пациенту" },
          { value: "hidden", label: "Скрыты" },
        ].map((f) => (
          <button
            key={f.value}
            onClick={() => navigate({ search: (prev: Record<string, unknown>) => ({ ...prev, status: f.value || undefined }) })}
            className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${
              (status || "") === f.value
                ? "bg-secondary text-white"
                : "bg-[var(--color-muted)] text-[var(--color-text-secondary)] hover:text-foreground"
            }`}
          >
            {f.label}
            {f.value === "abnormal" && results.filter((r) => r.is_abnormal).length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-xs bg-destructive/20 text-destructive">
                {results.filter((r) => r.is_abnormal).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Results list */}
      <div className="bg-[var(--color-surface)] rounded-2xl border border-border divide-y divide-border">
        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <svg
              className="w-10 h-10 text-[var(--color-text-tertiary)] mx-auto mb-3"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M14 2v6a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V2" />
              <path d="M10 2v3.3a4 4 0 0 1-1.17 2.83L4 13v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6l-4.83-4.87A4 4 0 0 1 14 5.3V2" />
            </svg>
            <p className="text-[var(--color-text-secondary)]">Нет результатов анализов</p>
          </div>
        ) : (
          filtered.map((r) => (
            <div key={r.id as string} className="flex items-center gap-4 p-4">
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
                <p className="text-sm font-medium text-foreground">{String(r.test_name || "")}</p>
                <p className="text-xs text-[var(--color-text-tertiary)]">
                  {r.test_code ? `${String(r.test_code)} · ` : ""}
                  {r.resulted_at ? formatDateTime(r.resulted_at as string) : "—"}
                </p>
              </div>
              <div className="text-right mr-4">
                <p
                  className={`text-sm font-bold ${
                    r.is_abnormal ? "text-destructive" : "text-foreground"
                  }`}
                >
                  {String(r.value || "")} {r.unit ? String(r.unit) : ""}
                </p>
                {r.reference_range && (
                  <p className="text-[10px] text-[var(--color-text-tertiary)]">
                    Норма: {String(r.reference_range)}
                  </p>
                )}
              </div>
              {r.is_abnormal && (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-destructive/10 text-destructive flex-shrink-0">
                  Отклонение
                </span>
              )}
              <button
                onClick={() =>
                  approveMutation.mutate({
                    resultId: r.id as string,
                    visible: !r.visible_to_patient,
                  })
                }
                disabled={approveMutation.isPending}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex-shrink-0 ${
                  r.visible_to_patient
                    ? "bg-success/10 text-success hover:bg-destructive/10 hover:text-destructive"
                    : "bg-secondary/10 text-secondary hover:bg-secondary/20"
                }`}
              >
                {r.visible_to_patient ? "Скрыть" : "Открыть пациенту"}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

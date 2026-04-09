import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { portalApi } from "@/features/portal/api";
import { useState } from "react";

export const Route = createFileRoute("/portal/_portal/results")({
  component: ResultsPage,
});

function ResultsPage() {
  const { data: results, isLoading } = useQuery({ queryKey: ["portal-results"], queryFn: portalApi.getResults });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data: detail } = useQuery({
    queryKey: ["portal-result", selectedId],
    queryFn: () => portalApi.getResultDetail(selectedId!),
    enabled: !!selectedId,
  });

  return (
    <div className="max-w-4xl">
      <h1 className="text-[24px] font-bold text-foreground tracking-tight mb-6 animate-float-up">Результаты анализов</h1>

      {selectedId && detail ? (
        <div className="animate-scale-in">
          <button onClick={() => setSelectedId(null)} className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-foreground mb-4 transition-colors">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
            Назад к списку
          </button>
          <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-foreground">{(detail as Record<string, any>).test_name}</h2>
                <p className="text-xs text-[var(--color-text-tertiary)] font-mono">{(detail as Record<string, any>).test_code} · {(detail as Record<string, any>).category}</p>
              </div>
              {(detail as Record<string, any>).is_abnormal && (
                <span className="px-2.5 py-1 bg-destructive/10 text-destructive text-xs font-semibold rounded-lg">Отклонение</span>
              )}
            </div>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="p-4 rounded-xl bg-[var(--color-muted)]/50 text-center">
                <p className="text-xs text-[var(--color-text-tertiary)] mb-1">Результат</p>
                <p className={`text-xl font-bold ${(detail as Record<string, any>).is_abnormal ? "text-destructive" : "text-foreground"}`}>{(detail as Record<string, any>).value}</p>
                {(detail as Record<string, any>).unit && <p className="text-xs text-[var(--color-text-tertiary)]">{(detail as Record<string, any>).unit}</p>}
              </div>
              <div className="p-4 rounded-xl bg-[var(--color-muted)]/50 text-center">
                <p className="text-xs text-[var(--color-text-tertiary)] mb-1">Норма</p>
                <p className="text-sm font-medium text-foreground">{(detail as Record<string, any>).reference_range || "—"}</p>
              </div>
              <div className="p-4 rounded-xl bg-[var(--color-muted)]/50 text-center">
                <p className="text-xs text-[var(--color-text-tertiary)] mb-1">Дата</p>
                <p className="text-sm font-medium text-foreground">{new Date((detail as Record<string, any>).resulted_at).toLocaleDateString("ru-RU")}</p>
              </div>
            </div>
            {(detail as Record<string, any>).notes && (
              <div className="p-4 rounded-xl bg-secondary/5 border border-secondary/10">
                <p className="text-xs font-semibold text-secondary mb-1">Комментарий врача</p>
                <p className="text-sm text-foreground">{(detail as Record<string, any>).notes}</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-2 animate-float-up" style={{ animationDelay: '100ms' }}>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="h-16 bg-[var(--color-muted)] rounded-xl animate-pulse" />)}
            </div>
          ) : (results as Array<Record<string, any>> || []).length === 0 ? (
            <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-8 text-center">
              <svg className="w-12 h-12 mx-auto mb-3 text-[var(--color-text-tertiary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2v6a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V2"/><path d="M10 2v3.3a4 4 0 0 1-1.17 2.83L4 13v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6l-4.83-4.87A4 4 0 0 1 14 5.3V2"/></svg>
              <p className="text-[var(--color-text-secondary)]">Нет доступных результатов</p>
              <p className="text-xs text-[var(--color-text-tertiary)] mt-1">Результаты появятся после одобрения врачом</p>
            </div>
          ) : (
            <div className="bg-[var(--color-surface)] rounded-2xl border border-border divide-y divide-border">
              {(results as Array<Record<string, any>>).map((r) => (
                <button key={r.id} onClick={() => setSelectedId(r.id)} className="w-full flex items-center gap-4 p-4 hover:bg-[var(--color-muted)]/50 transition-colors text-left">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${r.is_abnormal ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-[var(--color-primary-deep)]"}`}>
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14 2v6a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V2"/><path d="M10 2v3.3a4 4 0 0 1-1.17 2.83L4 13v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6l-4.83-4.87A4 4 0 0 1 14 5.3V2"/></svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{r.test_name}</p>
                    <p className="text-xs text-[var(--color-text-tertiary)]">{r.category} · {new Date(r.resulted_at).toLocaleDateString("ru-RU")}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`text-sm font-bold ${r.is_abnormal ? "text-destructive" : "text-foreground"}`}>{r.value} {r.unit || ""}</p>
                    {r.reference_range && <p className="text-[10px] text-[var(--color-text-tertiary)]">Норма: {r.reference_range}</p>}
                  </div>
                  <svg className="w-4 h-4 text-[var(--color-text-tertiary)] flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6"/></svg>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

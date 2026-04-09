import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { portalApi } from "@/features/portal/api";
import { useState } from "react";

export const Route = createFileRoute("/portal/_portal/exercises")({
  component: ExercisesPage,
});

const categoryLabels: Record<string, string> = {
  UPPER_LIMB: "Верхние конечности",
  LOWER_LIMB: "Нижние конечности",
  BALANCE: "Баланс",
  GAIT: "Ходьба",
  COGNITIVE: "Когнитивные",
};

const categoryColors: Record<string, string> = {
  UPPER_LIMB: "#7E78D2",
  LOWER_LIMB: "#10B981",
  BALANCE: "#F59E0B",
  GAIT: "#3B82F6",
  COGNITIVE: "#EC4899",
};

const difficultyLabels: Record<string, string> = {
  EASY: "Лёгкое",
  MEDIUM: "Среднее",
  HARD: "Сложное",
};

function ExercisesPage() {
  const { data: exercises } = useQuery({ queryKey: ["portal-exercises"], queryFn: portalApi.getExercises });
  const { data: progress } = useQuery({ queryKey: ["portal-progress"], queryFn: portalApi.getProgress });
  const { data: sessions } = useQuery({ queryKey: ["portal-sessions"], queryFn: portalApi.getSessions });
  const [filter, setFilter] = useState<string>("all");

  const categories = ["all", ...new Set((exercises as Array<Record<string, any>> || []).map((e: Record<string, any>) => e.category))];
  const filtered = filter === "all" ? exercises : (exercises as Array<Record<string, any>> || []).filter((e: Record<string, any>) => e.category === filter);

  return (
    <div className="max-w-4xl">
      <h1 className="text-[24px] font-bold text-foreground tracking-tight mb-2 animate-float-up">Упражнения</h1>
      <p className="text-[var(--color-text-secondary)] text-sm mb-6 animate-float-up" style={{ animationDelay: '50ms' }}>Программа реабилитации</p>

      {/* Progress stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { label: "За неделю", value: String(progress?.this_week_sessions ?? 0), sub: "сессий" },
          { label: "Всего", value: String(progress?.total_sessions ?? 0), sub: "сессий" },
          { label: "Точность", value: `${progress?.avg_accuracy ?? 0}%`, sub: "средняя" },
          { label: "Повторений", value: String(progress?.total_reps ?? 0), sub: "всего" },
        ].map((s, i) => (
          <div key={s.label} className="bg-[var(--color-surface)] rounded-xl border border-border p-4 animate-float-up" style={{ animationDelay: `${100 + i * 50}ms` }}>
            <p className="text-xl font-bold text-foreground">{s.value}</p>
            <p className="text-xs text-[var(--color-text-secondary)]">{s.label}</p>
            <p className="text-[10px] text-[var(--color-text-tertiary)]">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Category filter */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-2 animate-float-up" style={{ animationDelay: '250ms' }}>
        {categories.map((cat) => (
          <button key={cat} onClick={() => setFilter(cat)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${filter === cat ? "bg-secondary text-white" : "bg-[var(--color-muted)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]"}`}>
            {cat === "all" ? "Все" : categoryLabels[cat] || cat}
          </button>
        ))}
      </div>

      {/* Exercise cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 animate-float-up" style={{ animationDelay: '300ms' }}>
        {(filtered as Array<Record<string, any>> || []).map((ex: Record<string, any>) => {
          const color = categoryColors[ex.category] || "#7E78D2";
          const sessionCount = (sessions as Array<Record<string, any>> || []).filter((s: Record<string, any>) => s.exercise_id === ex.id).length;
          return (
            <div key={ex.id} className="group bg-[var(--color-surface)] rounded-xl border border-border p-5 hover:border-[var(--color-text-tertiary)]/30 transition-all cursor-pointer">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${color}15`, color }}>
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${ex.difficulty === "EASY" ? "bg-success/10 text-success" : ex.difficulty === "MEDIUM" ? "bg-warning/10 text-warning" : "bg-destructive/10 text-destructive"}`}>
                    {difficultyLabels[ex.difficulty] || ex.difficulty}
                  </span>
                </div>
              </div>
              <h3 className="text-sm font-semibold text-foreground mb-1">{ex.name}</h3>
              <p className="text-xs text-[var(--color-text-tertiary)] line-clamp-2 mb-3">{ex.description}</p>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[var(--color-text-tertiary)]">{ex.default_sets}×{ex.default_reps} повт.</span>
                {sessionCount > 0 && <span className="text-[10px] text-secondary font-medium">{sessionCount} сессий</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Recent sessions */}
      {(sessions as Array<Record<string, any>> || []).length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)] mb-3">Последние сессии</h2>
          <div className="bg-[var(--color-surface)] rounded-xl border border-border divide-y divide-border">
            {(sessions as Array<Record<string, any>>).slice(0, 5).map((s: Record<string, any>) => (
              <div key={s.id} className="flex items-center gap-4 p-4">
                <div className="w-8 h-8 rounded-lg bg-secondary/10 flex items-center justify-center">
                  <svg className="w-4 h-4 text-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
                </div>
                <div className="flex-1">
                  <p className="text-sm text-foreground">{s.reps_completed} повт. · {Math.round(s.accuracy_score * 100)}% точность</p>
                  <p className="text-xs text-[var(--color-text-tertiary)]">{new Date(s.started_at).toLocaleDateString("ru-RU")} · {Math.floor(s.duration_seconds / 60)} мин</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

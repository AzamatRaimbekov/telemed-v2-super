import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { portalApi } from "@/features/portal/api";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/portal/_portal/exercises")({
  component: ExercisesPage,
});

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  UPPER_LIMB: "Верхние конечности",
  LOWER_LIMB: "Нижние конечности",
  BALANCE: "Баланс",
  GAIT: "Ходьба",
  COGNITIVE: "Когнитивные",
};

const CATEGORY_COLORS: Record<string, string> = {
  UPPER_LIMB: "#7E78D2",
  LOWER_LIMB: "#10B981",
  BALANCE: "#F59E0B",
  GAIT: "#3B82F6",
  COGNITIVE: "#EC4899",
};

const DIFFICULTY_LABELS: Record<string, string> = {
  EASY: "Лёгкое",
  MEDIUM: "Среднее",
  HARD: "Сложное",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function difficultyClass(difficulty: string): string {
  if (difficulty === "EASY") return "bg-success/10 text-success";
  if (difficulty === "MEDIUM") return "bg-warning/10 text-warning";
  return "bg-destructive/10 text-destructive";
}

/** Returns last N sessions for a given exercise id, most-recent first */
function sessionsForExercise(
  sessions: Array<Record<string, unknown>>,
  exerciseId: string,
  limit = 3,
): Array<Record<string, unknown>> {
  return sessions
    .filter((s) => s.exercise_id === exerciseId)
    .sort(
      (a, b) =>
        new Date(b.started_at as string).getTime() -
        new Date(a.started_at as string).getTime(),
    )
    .slice(0, limit);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Thin bar representing accuracy of a single past session */
function AccuracyBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color = pct >= 80 ? "#10B981" : pct >= 60 ? "#F59E0B" : "#EF4444";
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="w-5 h-8 rounded bg-[var(--color-muted)] overflow-hidden flex flex-col-reverse">
        <div
          className="w-full rounded transition-all"
          style={{ height: `${pct}%`, background: color }}
        />
      </div>
      <span className="text-[9px] text-[var(--color-text-tertiary)] tabular-nums">{pct}%</span>
    </div>
  );
}

/** Circular progress ring for session completion */
function SessionRing({
  done,
  total,
}: {
  done: number;
  total: number;
}) {
  const r = 16;
  const circ = 2 * Math.PI * r;
  const pct = total > 0 ? Math.min(done / total, 1) : 0;
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" className="shrink-0">
      <circle cx="22" cy="22" r={r} fill="none" stroke="var(--color-muted)" strokeWidth="4" />
      <circle
        cx="22"
        cy="22"
        r={r}
        fill="none"
        stroke="#7E78D2"
        strokeWidth="4"
        strokeDasharray={`${circ * pct} ${circ * (1 - pct)}`}
        strokeLinecap="round"
        transform="rotate(-90 22 22)"
        className="transition-all duration-500"
      />
      <text x="22" y="26" textAnchor="middle" className="fill-foreground" style={{ fontSize: 10, fontWeight: 700 }}>
        {done}/{total}
      </text>
    </svg>
  );
}

/** Card for a prescribed exercise */
function PrescribedCard({
  exercise,
  sessionsDone,
  recentSessions,
  onStart,
}: {
  exercise: Record<string, unknown>;
  sessionsDone: number;
  recentSessions: Array<Record<string, unknown>>;
  onStart: () => void;
}) {
  const color = CATEGORY_COLORS[exercise.category as string] ?? "#7E78D2";
  const targetSessions = Number(exercise.target_sessions ?? exercise.default_sets ?? 14);

  return (
    <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-5 flex flex-col gap-4 hover:border-[#7E78D2]/30 transition-all animate-float-up">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: `${color}18`, color }}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-foreground leading-snug">{String(exercise.name ?? "")}</h3>
            <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5 line-clamp-2">
              {String(exercise.description ?? "")}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <Badge variant="secondary" className={difficultyClass(exercise.difficulty as string)}>
            {DIFFICULTY_LABELS[exercise.difficulty as string] ?? String(exercise.difficulty ?? "")}
          </Badge>
          <span
            className="text-[10px] font-medium px-2 py-0.5 rounded-full"
            style={{ background: `${color}15`, color }}
          >
            {CATEGORY_LABELS[exercise.category as string] ?? String(exercise.category ?? "")}
          </span>
        </div>
      </div>

      {/* Prescription row */}
      <div className="flex items-center gap-2 bg-secondary/5 border border-secondary/10 rounded-xl px-3 py-2">
        <svg className="w-3.5 h-3.5 text-secondary shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 12l2 2 4-4" /><rect x="3" y="3" width="18" height="18" rx="3" />
        </svg>
        <span className="text-xs text-[var(--color-text-secondary)]">
          Назначено врачом:&nbsp;
          <strong className="text-foreground">
            {String(exercise.default_sets ?? 3)}×{String(exercise.default_reps ?? 10)}
          </strong>
          ,&nbsp;ежедневно
        </span>
      </div>

      {/* Progress row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <SessionRing done={sessionsDone} total={targetSessions} />
          <div>
            <p className="text-xs font-semibold text-foreground">
              Выполнено {sessionsDone} из {targetSessions} сессий
            </p>
            <p className="text-[10px] text-[var(--color-text-tertiary)] mt-0.5">
              {targetSessions - sessionsDone > 0
                ? `Осталось ${targetSessions - sessionsDone}`
                : "Курс завершён"}
            </p>
          </div>
        </div>

        {/* Mini accuracy bars for last 3 sessions */}
        {recentSessions.length > 0 && (
          <div className="flex items-end gap-1.5">
            {recentSessions.map((s, i) => (
              <AccuracyBar key={i} score={Number(s.accuracy_score ?? 0)} />
            ))}
          </div>
        )}
      </div>

      {/* Start button */}
      <Button
        onClick={onStart}
        className="w-full py-3 rounded-xl bg-secondary text-white font-semibold text-sm hover:bg-secondary/90 active:scale-[0.98] transition-all shadow-md shadow-secondary/20"
      >
        Начать тренировку
      </Button>
    </div>
  );
}

/** Compact card for the library section */
function LibraryCard({
  exercise,
  sessionCount,
  onStart,
}: {
  exercise: Record<string, unknown>;
  sessionCount: number;
  onStart: () => void;
}) {
  const color = CATEGORY_COLORS[exercise.category as string] ?? "#7E78D2";
  return (
    <div className="group bg-[var(--color-surface)] rounded-xl border border-border p-4 hover:border-[var(--color-text-tertiary)]/30 transition-all">
      <div className="flex items-start justify-between mb-2">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: `${color}15`, color }}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
          </svg>
        </div>
        <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${difficultyClass(exercise.difficulty as string)}`}>
          {DIFFICULTY_LABELS[exercise.difficulty as string] ?? String(exercise.difficulty ?? "")}
        </span>
      </div>
      <h4 className="text-xs font-semibold text-foreground mb-1">{String(exercise.name ?? "")}</h4>
      <p className="text-[10px] text-[var(--color-text-tertiary)] line-clamp-2 mb-3">
        {String(exercise.description ?? "")}
      </p>
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-[var(--color-text-tertiary)]">
          {String(exercise.default_sets ?? 3)}×{String(exercise.default_reps ?? 10)} повт.
        </span>
        {sessionCount > 0 && (
          <span className="text-[10px] text-secondary font-medium">{sessionCount} сессий</span>
        )}
      </div>
      <button
        onClick={onStart}
        className="mt-3 w-full py-1.5 rounded-lg bg-secondary/10 text-secondary text-xs font-semibold hover:bg-secondary/20 active:scale-[0.98] transition-all"
      >
        Начать
      </button>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function ExercisesPage() {
  const navigate = useNavigate();
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryFilter, setLibraryFilter] = useState<string>("all");

  const { data: prescribed, isLoading: prescribedLoading } = useQuery({
    queryKey: ["portal-prescribed-exercises"],
    queryFn: portalApi.getMyPrescribedExercises,
  });

  const { data: allExercises } = useQuery({
    queryKey: ["portal-exercises"],
    queryFn: portalApi.getExercises,
  });

  const { data: progress } = useQuery({
    queryKey: ["portal-progress"],
    queryFn: portalApi.getProgress,
  });

  const { data: sessions } = useQuery({
    queryKey: ["portal-sessions"],
    queryFn: portalApi.getSessions,
  });

  const prescribedList = (prescribed as Array<Record<string, unknown>>) ?? [];
  const allList = (allExercises as Array<Record<string, unknown>>) ?? [];
  const sessionList = (sessions as Array<Record<string, unknown>>) ?? [];

  // Prescribed IDs so we can exclude them from the library
  const prescribedIds = new Set(prescribedList.map((e) => String(e.id)));

  const libraryExercises = allList.filter((e) => !prescribedIds.has(String(e.id)));
  const categories = ["all", ...new Set(libraryExercises.map((e) => String(e.category)))];
  const filteredLibrary =
    libraryFilter === "all"
      ? libraryExercises
      : libraryExercises.filter((e) => String(e.category) === libraryFilter);

  const progressData = progress as Record<string, unknown> | undefined;

  return (
    <div className="max-w-4xl space-y-8">
      {/* ── Page heading ──────────────────────────────────────────────── */}
      <div className="animate-float-up">
        <h1 className="text-[24px] font-bold text-foreground tracking-tight mb-1">Упражнения</h1>
        <p className="text-sm text-[var(--color-text-secondary)]">Программа реабилитации</p>
      </div>

      {/* ── Progress stats strip ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "За неделю", value: String(progressData?.this_week_sessions ?? 0), sub: "сессий" },
          { label: "Всего", value: String(progressData?.total_sessions ?? 0), sub: "сессий" },
          { label: "Точность", value: `${progressData?.avg_accuracy ?? 0}%`, sub: "средняя" },
          { label: "Повторений", value: String(progressData?.total_reps ?? 0), sub: "всего" },
        ].map((s, i) => (
          <div
            key={s.label}
            className="bg-[var(--color-surface)] rounded-xl border border-border p-4 animate-float-up"
            style={{ animationDelay: `${50 + i * 40}ms` }}
          >
            <p className="text-xl font-bold text-foreground">{s.value}</p>
            <p className="text-xs text-[var(--color-text-secondary)]">{s.label}</p>
            <p className="text-[10px] text-[var(--color-text-tertiary)]">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Prescribed exercises ─────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-4 animate-float-up" style={{ animationDelay: "120ms" }}>
          <div className="w-5 h-5 rounded bg-secondary/15 flex items-center justify-center">
            <svg className="w-3 h-3 text-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 12l2 2 4-4" /><rect x="3" y="3" width="18" height="18" rx="3" />
            </svg>
          </div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--color-text-tertiary)]">
            Мои назначения
          </h2>
        </div>

        {prescribedLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-56 bg-[var(--color-muted)] rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : prescribedList.length === 0 ? (
          <div
            className="bg-[var(--color-surface)] rounded-2xl border border-border p-8 text-center animate-float-up"
            style={{ animationDelay: "140ms" }}
          >
            <div className="w-12 h-12 rounded-full bg-[var(--color-muted)] flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-[var(--color-text-tertiary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
            </div>
            <p className="text-sm font-medium text-[var(--color-text-secondary)]">
              Врач ещё не назначил упражнения
            </p>
            <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
              Упражнения появятся здесь после составления плана лечения
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {prescribedList.map((ex, i) => {
              const exSessions = sessionsForExercise(sessionList, String(ex.id));
              const done = sessionList.filter((s) => s.exercise_id === ex.id).length;
              return (
                <div key={String(ex.id)} style={{ animationDelay: `${140 + i * 60}ms` }}>
                  <PrescribedCard
                    exercise={ex}
                    sessionsDone={done}
                    recentSessions={exSessions}
                    onStart={() =>
                      navigate({
                        to: "/portal/exercise-session",
                        search: { exerciseId: String(ex.id) },
                      })
                    }
                  />
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Recent sessions ──────────────────────────────────────────── */}
      {sessionList.length > 0 && (
        <section className="animate-float-up" style={{ animationDelay: "200ms" }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--color-text-tertiary)]">
              Последние сессии
            </h2>
            <Link
              to="/portal/exercise-progress"
              className="text-xs text-secondary font-medium hover:underline"
            >
              Вся статистика →
            </Link>
          </div>
          <div className="bg-[var(--color-surface)] rounded-xl border border-border divide-y divide-border">
            {sessionList.slice(0, 5).map((s) => {
              const ex = allList.find((e) => e.id === s.exercise_id);
              const accuracy = Math.round(Number(s.accuracy_score ?? 0) * 100);
              const color = accuracy >= 80 ? "#10B981" : accuracy >= 60 ? "#F59E0B" : "#EF4444";
              return (
                <div key={String(s.id)} className="flex items-center gap-4 p-4">
                  <div className="w-8 h-8 rounded-lg bg-secondary/10 flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4 text-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground font-medium truncate">
                      {ex ? String(ex.name) : "Упражнение"}
                    </p>
                    <p className="text-xs text-[var(--color-text-tertiary)]">
                      {new Date(String(s.started_at)).toLocaleDateString("ru-RU")}
                      &nbsp;·&nbsp;
                      {Number(s.reps_completed ?? 0)} повт.
                      &nbsp;·&nbsp;
                      {Math.floor(Number(s.duration_seconds ?? 0) / 60)} мин
                    </p>
                  </div>
                  <span
                    className="text-xs font-bold tabular-nums"
                    style={{ color }}
                  >
                    {accuracy}%
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Exercise library (collapsible) ───────────────────────────── */}
      <section className="animate-float-up" style={{ animationDelay: "240ms" }}>
        <button
          onClick={() => setLibraryOpen((o) => !o)}
          className="flex items-center justify-between w-full mb-3 group"
        >
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--color-text-tertiary)]">
              Библиотека упражнений
            </h2>
            <span className="text-[10px] text-[var(--color-text-tertiary)] bg-[var(--color-muted)] rounded-full px-2 py-0.5">
              {libraryExercises.length}
            </span>
          </div>
          <svg
            className={`w-4 h-4 text-[var(--color-text-tertiary)] transition-transform duration-200 ${libraryOpen ? "rotate-180" : ""}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>

        {libraryOpen && (
          <>
            {/* Category filter */}
            <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setLibraryFilter(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                    libraryFilter === cat
                      ? "bg-secondary text-white"
                      : "bg-[var(--color-muted)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]"
                  }`}
                >
                  {cat === "all" ? "Все" : CATEGORY_LABELS[cat] ?? cat}
                </button>
              ))}
            </div>

            <p className="text-xs text-[var(--color-text-tertiary)] mb-3">
              Справочник — для ознакомления. Для тренировок используйте назначенные упражнения выше.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredLibrary.map((ex) => {
                const count = sessionList.filter((s) => s.exercise_id === ex.id).length;
                return (
                  <LibraryCard
                    key={String(ex.id)}
                    exercise={ex}
                    sessionCount={count}
                    onStart={() =>
                      navigate({
                        to: "/portal/exercise-session",
                        search: { exerciseId: String(ex.id) },
                      })
                    }
                  />
                );
              })}
            </div>

            {filteredLibrary.length === 0 && (
              <p className="text-xs text-[var(--color-text-tertiary)] text-center py-6">
                Нет упражнений в этой категории
              </p>
            )}
          </>
        )}
      </section>
    </div>
  );
}

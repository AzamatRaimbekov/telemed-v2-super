import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { portalApi } from "@/features/portal/api";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { formatDate } from "@/lib/utils";

export const Route = createFileRoute("/portal/_portal/exercise-progress")({
  component: ExerciseProgressPage,
});

// ─── Custom tooltips ──────────────────────────────────────────────────────────

function AccuracyTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[var(--color-surface)] border border-border rounded-xl shadow-lg p-3 text-xs">
      <p className="text-[var(--color-text-tertiary)] mb-0.5">{label}</p>
      <p className="font-bold text-foreground">{payload[0].value}% точность</p>
    </div>
  );
}

function SessionsTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[var(--color-surface)] border border-border rounded-xl shadow-lg p-3 text-xs">
      <p className="text-[var(--color-text-tertiary)] mb-0.5">{label}</p>
      <p className="font-bold text-foreground">{payload[0].value} сессий</p>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface RawSession {
  id: string;
  exercise_id?: string;
  started_at: string;
  duration_seconds?: number;
  reps_completed?: number;
  sets_completed?: number;
  accuracy_score?: number;
}

function buildAccuracyTimeline(sessions: RawSession[]) {
  return sessions
    .filter((s) => s.accuracy_score !== undefined && s.accuracy_score !== null)
    .sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime())
    .map((s) => ({
      date: new Date(s.started_at).toLocaleDateString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
      }),
      accuracy: Math.round((s.accuracy_score ?? 0) * 100),
    }));
}

function buildWeeklySessions(sessions: RawSession[]) {
  const weekMap: Record<string, number> = {};
  for (const s of sessions) {
    const d = new Date(s.started_at);
    // ISO week start (Monday)
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d);
    monday.setDate(diff);
    const key = monday.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });
    weekMap[key] = (weekMap[key] ?? 0) + 1;
  }
  const currentYear = new Date().getFullYear();
  return Object.entries(weekMap)
    .sort(([a], [b]) => {
      const parse = (s: string) => {
        const [d, m] = s.split(".");
        return new Date(currentYear, parseInt(m) - 1, parseInt(d)).getTime();
      };
      return parse(a) - parse(b);
    })
    .slice(-8) // last 8 weeks
    .map(([week, count]) => ({ week: `Нед. ${week}`, count }));
}

function calcStreak(sessions: RawSession[]): number {
  if (!sessions.length) return 0;
  const days = [
    ...new Set(
      sessions.map((s) => new Date(s.started_at).toLocaleDateString("ru-RU"))
    ),
  ].sort((a, b) => {
    const yr = new Date().getFullYear();
    const parse = (s: string) => {
      const [d, m] = s.split(".");
      return new Date(yr, parseInt(m) - 1, parseInt(d)).getTime();
    };
    return parse(b) - parse(a); // newest first
  });

  let streak = 0;
  const today = new Date();
  const yr = today.getFullYear();
  for (let i = 0; i < days.length; i++) {
    const [d, m] = days[i].split(".");
    const sessionDate = new Date(yr, parseInt(m) - 1, parseInt(d));
    const expectedDate = new Date(today);
    expectedDate.setDate(today.getDate() - i);
    if (
      sessionDate.getDate() === expectedDate.getDate() &&
      sessionDate.getMonth() === expectedDate.getMonth()
    ) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

// ─── Main page ────────────────────────────────────────────────────────────────

function ExerciseProgressPage() {
  const { data: progressRaw } = useQuery({
    queryKey: ["portal-progress"],
    queryFn: portalApi.getProgress,
  });
  const { data: sessionsRaw, isLoading } = useQuery({
    queryKey: ["portal-sessions"],
    queryFn: portalApi.getSessions,
  });
  const { data: exercisesRaw } = useQuery({
    queryKey: ["portal-exercises"],
    queryFn: portalApi.getExercises,
  });

  const progress = progressRaw as Record<string, unknown> | undefined;
  const sessions: RawSession[] = (sessionsRaw as RawSession[]) ?? [];
  const exercises = (exercisesRaw as Array<Record<string, unknown>>) ?? [];

  const accuracyTimeline = buildAccuracyTimeline(sessions);
  const weeklyData = buildWeeklySessions(sessions);
  const streak = calcStreak(sessions);

  const bestAccuracy =
    sessions.length > 0
      ? Math.max(...sessions.map((s) => Math.round((s.accuracy_score ?? 0) * 100)))
      : 0;

  const totalMinutes = sessions.reduce(
    (acc, s) => acc + Math.floor((s.duration_seconds ?? 0) / 60),
    0
  );

  const exerciseNameMap = Object.fromEntries(
    exercises.map((e) => [String(e.id), String(e.name ?? "—")])
  );

  return (
    <div className="max-w-4xl">
      <h1
        className="text-[24px] font-bold text-foreground tracking-tight mb-2 animate-float-up"
      >
        Прогресс тренировок
      </h1>
      <p
        className="text-[var(--color-text-secondary)] text-sm mb-6 animate-float-up"
        style={{ animationDelay: "50ms" }}
      >
        Ваша статистика и история сессий
      </p>

      {/* ── Stats cards ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          {
            label: "Серия дней",
            value: `${streak}`,
            sub: "подряд",
            icon: (
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            ),
            color: "#F59E0B",
          },
          {
            label: "Лучшая точность",
            value: `${bestAccuracy}%`,
            sub: "рекорд",
            icon: (
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="6" /><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
              </svg>
            ),
            color: "#7E78D2",
          },
          {
            label: "Всего времени",
            value: totalMinutes >= 60 ? `${Math.floor(totalMinutes / 60)}ч ${totalMinutes % 60}м` : `${totalMinutes}м`,
            sub: "потрачено",
            icon: (
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
              </svg>
            ),
            color: "#10B981",
          },
          {
            label: "Всего сессий",
            value: String(progress?.total_sessions ?? sessions.length),
            sub: "завершено",
            icon: (
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
            ),
            color: "#3B82F6",
          },
        ].map((stat, i) => (
          <div
            key={stat.label}
            className="bg-[var(--color-surface)] rounded-2xl border border-border p-4 animate-float-up"
            style={{ animationDelay: `${100 + i * 50}ms` }}
          >
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
              style={{ background: `${stat.color}15`, color: stat.color }}
            >
              {stat.icon}
            </div>
            <p className="text-xl font-bold text-foreground">{stat.value}</p>
            <p className="text-xs text-[var(--color-text-secondary)]">{stat.label}</p>
            <p className="text-[10px] text-[var(--color-text-tertiary)]">{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Charts ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Accuracy over time */}
        <div
          className="bg-[var(--color-surface)] rounded-2xl border border-border p-5 animate-float-up"
          style={{ animationDelay: "300ms" }}
        >
          <h2 className="text-sm font-semibold text-foreground mb-1">Точность по сессиям</h2>
          <p className="text-xs text-[var(--color-text-tertiary)] mb-4">Динамика качества выполнения</p>
          {accuracyTimeline.length < 2 ? (
            <div className="h-[200px] flex items-center justify-center">
              <p className="text-xs text-[var(--color-text-tertiary)]">Недостаточно данных</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={accuracyTimeline} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: "var(--color-text-tertiary)" }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 10, fill: "var(--color-text-tertiary)" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip content={<AccuracyTooltip />} />
                <ReferenceLine y={80} stroke="#10B981" strokeDasharray="4 3" strokeWidth={1} />
                <Line
                  type="monotone"
                  dataKey="accuracy"
                  name="Точность"
                  stroke="#7E78D2"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "#7E78D2" }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
          {accuracyTimeline.length >= 2 && (
            <p className="text-[10px] text-[var(--color-text-tertiary)] mt-2">
              Зелёная линия — целевой уровень 80%
            </p>
          )}
        </div>

        {/* Sessions per week */}
        <div
          className="bg-[var(--color-surface)] rounded-2xl border border-border p-5 animate-float-up"
          style={{ animationDelay: "360ms" }}
        >
          <h2 className="text-sm font-semibold text-foreground mb-1">Сессии по неделям</h2>
          <p className="text-xs text-[var(--color-text-tertiary)] mb-4">Частота тренировок</p>
          {weeklyData.length === 0 ? (
            <div className="h-[200px] flex items-center justify-center">
              <p className="text-xs text-[var(--color-text-tertiary)]">Нет данных</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={weeklyData} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis
                  dataKey="week"
                  tick={{ fontSize: 9, fill: "var(--color-text-tertiary)" }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 10, fill: "var(--color-text-tertiary)" }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip content={<SessionsTooltip />} />
                <Bar dataKey="count" name="Сессий" fill="#10B981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Session history table ─────────────────────────────────── */}
      <div
        className="bg-[var(--color-surface)] rounded-2xl border border-border animate-float-up"
        style={{ animationDelay: "420ms" }}
      >
        <div className="p-5 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">История сессий</h2>
          <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">
            {sessions.length} сессий всего
          </p>
        </div>

        {isLoading ? (
          <div className="p-5 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 bg-[var(--color-muted)] rounded-xl animate-pulse" />
            ))}
          </div>
        ) : sessions.length === 0 ? (
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
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
            <p className="text-[var(--color-text-secondary)] text-sm">Нет завершённых сессий</p>
            <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
              Начните первую тренировку, чтобы увидеть статистику
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {[...sessions]
              .sort(
                (a, b) =>
                  new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
              )
              .map((s) => {
                const accuracy = Math.round((s.accuracy_score ?? 0) * 100);
                const minutes = Math.floor((s.duration_seconds ?? 0) / 60);
                const seconds = (s.duration_seconds ?? 0) % 60;
                return (
                  <div
                    key={s.id}
                    className="flex items-center gap-4 px-5 py-4 hover:bg-[var(--color-muted)]/30 transition-colors"
                  >
                    <div className="w-9 h-9 rounded-xl bg-secondary/10 flex items-center justify-center flex-shrink-0">
                      <svg
                        className="w-4 h-4 text-secondary"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {s.exercise_id ? (exerciseNameMap[s.exercise_id] ?? "Упражнение") : "Упражнение"}
                      </p>
                      <p className="text-xs text-[var(--color-text-tertiary)]">
                        {formatDate(s.started_at)} ·{" "}
                        {minutes > 0 ? `${minutes} мин ` : ""}
                        {seconds > 0 ? `${seconds} сек` : ""}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0 space-y-0.5">
                      <p className="text-sm font-bold text-foreground">
                        {s.reps_completed ?? 0} повт.
                      </p>
                      <div className="flex items-center gap-1.5 justify-end">
                        <div className="w-16 h-1.5 rounded-full bg-[var(--color-muted)]">
                          <div
                            className="h-1.5 rounded-full"
                            style={{
                              width: `${accuracy}%`,
                              background:
                                accuracy >= 80
                                  ? "#10B981"
                                  : accuracy >= 60
                                    ? "#F59E0B"
                                    : "#EF4444",
                            }}
                          />
                        </div>
                        <span
                          className={`text-xs font-semibold ${
                            accuracy >= 80
                              ? "text-success"
                              : accuracy >= 60
                                ? "text-warning"
                                : "text-destructive"
                          }`}
                        >
                          {accuracy}%
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
}

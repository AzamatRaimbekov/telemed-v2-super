import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import apiClient from "@/lib/api-client";

export const Route = createFileRoute("/_authenticated/analytics")({
  component: AnalyticsDashboard,
});

interface DashboardData {
  period_days: number;
  patients: {
    total: number;
    active: number;
    new_current: number;
    new_previous: number;
  };
  staff: {
    doctors: number;
    nurses: number;
  };
  appointments: {
    total: number;
    completed: number;
    cancelled: number;
    no_show: number;
    completion_rate: number;
    by_day: { date: string; count: number }[];
  };
  prescriptions: { active: number };
  procedures: { total: number; completed: number };
  lab_orders: { total: number; completed: number };
  top_doctors: {
    id: string;
    name: string;
    specialization: string | null;
    appointments: number;
  }[];
  registrations_by_day: { date: string; count: number }[];
}

const PERIOD_OPTIONS = [
  { label: "7 дней", value: 7 },
  { label: "30 дней", value: 30 },
  { label: "90 дней", value: 90 },
  { label: "365 дней", value: 365 },
];

function formatDate(dateStr: string, periodDays: number): string {
  const date = new Date(dateStr);
  if (periodDays <= 30) {
    return date.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
  }
  return date.toLocaleDateString("ru-RU", { month: "short", day: "numeric" });
}

function getDelta(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

interface KpiCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  delta?: number | null;
  icon: React.ReactNode;
  accent: string;
}

function KpiCard({ title, value, subtitle, delta, icon, accent }: KpiCardProps) {
  return (
    <div className="bg-[var(--color-surface)] border border-border rounded-2xl p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center ${accent}`}
        >
          {icon}
        </div>
        {delta !== null && delta !== undefined && (
          <span
            className={`text-xs font-semibold px-2 py-1 rounded-full ${
              delta >= 0
                ? "bg-emerald-500/10 text-emerald-400"
                : "bg-red-500/10 text-red-400"
            }`}
          >
            {delta >= 0 ? "+" : ""}
            {delta}%
          </span>
        )}
      </div>
      <div>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <p className="text-sm font-medium text-[var(--color-text-secondary)] mt-0.5">
          {title}
        </p>
        {subtitle && (
          <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}

const tooltipStyle = {
  backgroundColor: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: "10px",
  fontSize: "12px",
  color: "var(--color-text-secondary)",
};

function AnalyticsDashboard() {
  const [periodDays, setPeriodDays] = useState(30);

  const { data, isLoading, isError } = useQuery<DashboardData>({
    queryKey: ["analytics-dashboard", periodDays],
    queryFn: () =>
      apiClient
        .get("/analytics/dashboard", { params: { period_days: periodDays } })
        .then((r) => r.data as DashboardData),
    staleTime: 60_000,
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Аналитика</h1>
          <p className="text-sm text-[var(--color-text-tertiary)] mt-0.5">
            Статистика клиники за выбранный период
          </p>
        </div>
        {/* Period selector */}
        <div className="flex gap-1 p-1 bg-[var(--color-muted)] rounded-xl self-start sm:self-auto">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setPeriodDays(opt.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                periodDays === opt.value
                  ? "bg-[var(--color-surface)] text-foreground shadow-sm"
                  : "text-[var(--color-text-secondary)] hover:text-foreground"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {isError && (
        <div className="rounded-2xl bg-destructive/10 border border-destructive/20 p-4 text-sm text-destructive">
          Нет доступа или произошла ошибка загрузки данных. Эта страница доступна только администраторам клиники.
        </div>
      )}

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Total patients */}
        <KpiCard
          title="Всего пациентов"
          value={isLoading ? "—" : (data?.patients.total ?? 0)}
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-blue-400">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          }
          accent="bg-blue-500/10"
        />

        {/* Active patients */}
        <KpiCard
          title="Активных"
          value={isLoading ? "—" : (data?.patients.active ?? 0)}
          subtitle="пациентов"
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-emerald-400">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          }
          accent="bg-emerald-500/10"
        />

        {/* New patients */}
        <KpiCard
          title="Новых пациентов"
          value={isLoading ? "—" : (data?.patients.new_current ?? 0)}
          subtitle={`за ${periodDays} дн.`}
          delta={
            data
              ? getDelta(data.patients.new_current, data.patients.new_previous)
              : null
          }
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-violet-400">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <line x1="19" x2="19" y1="8" y2="14" />
              <line x1="22" x2="16" y1="11" y2="11" />
            </svg>
          }
          accent="bg-violet-500/10"
        />

        {/* Doctors */}
        <KpiCard
          title="Врачей"
          value={isLoading ? "—" : (data?.staff.doctors ?? 0)}
          subtitle={`медсестёр: ${data?.staff.nurses ?? 0}`}
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-cyan-400">
              <path d="M3 9a2 2 0 0 1 2-2h.93a2 2 0 0 0 1.664-.89l.812-1.22A2 2 0 0 1 10.07 4h3.86a2 2 0 0 1 1.664.89l.812 1.22A2 2 0 0 0 18.07 7H19a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z" />
              <circle cx="12" cy="13" r="3" />
            </svg>
          }
          accent="bg-cyan-500/10"
        />

        {/* Appointments */}
        <KpiCard
          title="Приёмов"
          value={isLoading ? "—" : (data?.appointments.total ?? 0)}
          subtitle={`за ${periodDays} дн.`}
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-amber-400">
              <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
              <line x1="16" x2="16" y1="2" y2="6" />
              <line x1="8" x2="8" y1="2" y2="6" />
              <line x1="3" x2="21" y1="10" y2="10" />
            </svg>
          }
          accent="bg-amber-500/10"
        />

        {/* Completion rate */}
        <KpiCard
          title="Завершено"
          value={
            isLoading ? "—" : `${data?.appointments.completion_rate ?? 0}%`
          }
          subtitle="приёмов"
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-rose-400">
              <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
          }
          accent="bg-rose-500/10"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Appointments area chart */}
        <div className="bg-[var(--color-surface)] border border-border rounded-2xl p-5">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-foreground">
              Приёмы по дням
            </h2>
            <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">
              Количество записей за период
            </p>
          </div>
          {isLoading ? (
            <div className="h-52 flex items-center justify-center text-sm text-[var(--color-text-tertiary)]">
              Загрузка...
            </div>
          ) : !data?.appointments.by_day.length ? (
            <div className="h-52 flex items-center justify-center text-sm text-[var(--color-text-tertiary)]">
              Нет данных за период
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart
                data={data.appointments.by_day.map((d) => ({
                  date: formatDate(d.date, periodDays),
                  count: d.count,
                }))}
                margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorAppt" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--color-border)"
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: "var(--color-text-tertiary)" }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "var(--color-text-tertiary)" }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelStyle={{ color: "var(--color-text-secondary)", fontWeight: 600 }}
                  formatter={(v: number) => [v, "Приёмов"]}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="#6366f1"
                  strokeWidth={2}
                  fill="url(#colorAppt)"
                  dot={false}
                  activeDot={{ r: 4, fill: "#6366f1" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Registrations bar chart */}
        <div className="bg-[var(--color-surface)] border border-border rounded-2xl p-5">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-foreground">
              Регистрации пациентов
            </h2>
            <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">
              Новые пациенты по дням
            </p>
          </div>
          {isLoading ? (
            <div className="h-52 flex items-center justify-center text-sm text-[var(--color-text-tertiary)]">
              Загрузка...
            </div>
          ) : !data?.registrations_by_day.length ? (
            <div className="h-52 flex items-center justify-center text-sm text-[var(--color-text-tertiary)]">
              Нет данных за период
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={data.registrations_by_day.map((d) => ({
                  date: formatDate(d.date, periodDays),
                  count: d.count,
                }))}
                margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--color-border)"
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: "var(--color-text-tertiary)" }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "var(--color-text-tertiary)" }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelStyle={{ color: "var(--color-text-secondary)", fontWeight: 600 }}
                  formatter={(v: number) => [v, "Пациентов"]}
                />
                <Bar
                  dataKey="count"
                  fill="#10b981"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={32}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Bottom row: appointment breakdown + top doctors + secondary KPIs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Appointment status breakdown */}
        <div className="bg-[var(--color-surface)] border border-border rounded-2xl p-5">
          <h2 className="text-base font-semibold text-foreground mb-4">
            Статусы приёмов
          </h2>
          {isLoading ? (
            <div className="space-y-3 animate-pulse">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-9 bg-[var(--color-muted)] rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {[
                {
                  label: "Завершено",
                  value: data?.appointments.completed ?? 0,
                  total: data?.appointments.total ?? 1,
                  color: "bg-emerald-500",
                },
                {
                  label: "Отменено",
                  value: data?.appointments.cancelled ?? 0,
                  total: data?.appointments.total ?? 1,
                  color: "bg-red-500",
                },
                {
                  label: "Неявка",
                  value: data?.appointments.no_show ?? 0,
                  total: data?.appointments.total ?? 1,
                  color: "bg-amber-500",
                },
                {
                  label: "Прочие",
                  value:
                    (data?.appointments.total ?? 0) -
                    (data?.appointments.completed ?? 0) -
                    (data?.appointments.cancelled ?? 0) -
                    (data?.appointments.no_show ?? 0),
                  total: data?.appointments.total ?? 1,
                  color: "bg-blue-500",
                },
              ].map((item) => {
                const pct = data?.appointments.total
                  ? Math.round((item.value / data.appointments.total) * 100)
                  : 0;
                return (
                  <div key={item.label} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-[var(--color-text-secondary)]">
                        {item.label}
                      </span>
                      <span className="font-semibold text-foreground">
                        {item.value}{" "}
                        <span className="font-normal text-[var(--color-text-tertiary)]">
                          ({pct}%)
                        </span>
                      </span>
                    </div>
                    <div className="h-1.5 bg-[var(--color-muted)] rounded-full overflow-hidden">
                      <div
                        className={`h-full ${item.color} rounded-full transition-all duration-500`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Secondary metrics */}
          <div className="mt-5 pt-4 border-t border-border grid grid-cols-2 gap-3">
            {[
              {
                label: "Рецепты",
                value: data?.prescriptions.active ?? 0,
                sub: "активных",
              },
              {
                label: "Процедуры",
                value: data?.procedures.total ?? 0,
                sub: `выполнено: ${data?.procedures.completed ?? 0}`,
              },
              {
                label: "Лаб. заказы",
                value: data?.lab_orders.total ?? 0,
                sub: `готово: ${data?.lab_orders.completed ?? 0}`,
              },
              {
                label: "Мед. персонал",
                value: (data?.staff.doctors ?? 0) + (data?.staff.nurses ?? 0),
                sub: `врачей: ${data?.staff.doctors ?? 0}`,
              },
            ].map((item) => (
              <div
                key={item.label}
                className="bg-[var(--color-muted)] rounded-xl p-3"
              >
                <p className="text-lg font-bold text-foreground">
                  {isLoading ? "—" : item.value}
                </p>
                <p className="text-xs font-medium text-[var(--color-text-secondary)]">
                  {item.label}
                </p>
                <p className="text-[10px] text-[var(--color-text-tertiary)]">
                  {isLoading ? "" : item.sub}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Top doctors */}
        <div className="lg:col-span-2 bg-[var(--color-surface)] border border-border rounded-2xl p-5">
          <h2 className="text-base font-semibold text-foreground mb-4">
            Топ врачей по приёмам
          </h2>
          {isLoading ? (
            <div className="space-y-3 animate-pulse">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-12 bg-[var(--color-muted)] rounded-xl" />
              ))}
            </div>
          ) : !data?.top_doctors.length ? (
            <div className="h-48 flex items-center justify-center text-sm text-[var(--color-text-tertiary)]">
              Нет данных за выбранный период
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left pb-2 text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wide">
                      #
                    </th>
                    <th className="text-left pb-2 text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wide">
                      Врач
                    </th>
                    <th className="text-left pb-2 text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wide hidden sm:table-cell">
                      Специализация
                    </th>
                    <th className="text-right pb-2 text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wide">
                      Приёмов
                    </th>
                    <th className="pb-2 hidden sm:table-cell" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {data.top_doctors.map((doc, idx) => {
                    const maxAppts = data.top_doctors[0]?.appointments ?? 1;
                    const pct = Math.round((doc.appointments / maxAppts) * 100);
                    return (
                      <tr key={doc.id} className="group">
                        <td className="py-3 pr-3 text-[var(--color-text-tertiary)] font-mono text-xs w-6">
                          {idx + 1}
                        </td>
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                              {doc.name
                                .split(" ")
                                .map((n) => n[0])
                                .join("")
                                .toUpperCase()
                                .slice(0, 2)}
                            </div>
                            <span className="font-medium text-foreground text-sm truncate max-w-[140px]">
                              {doc.name}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 pr-4 text-[var(--color-text-secondary)] text-xs hidden sm:table-cell">
                          {doc.specialization ?? "—"}
                        </td>
                        <td className="py-3 text-right font-bold text-foreground tabular-nums">
                          {doc.appointments}
                        </td>
                        <td className="py-3 pl-4 w-32 hidden sm:table-cell">
                          <div className="h-1.5 bg-[var(--color-muted)] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full transition-all duration-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

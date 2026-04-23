import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend,
} from "recharts";
import {
  useDoctorEfficiency,
  useDoctorRanking,
  useDepartmentLoad,
  useDepartmentSummary,
  usePL,
  useDailyRevenue,
} from "@/features/reports/api";

export const Route = createFileRoute("/_authenticated/reports")({
  component: ReportsPage,
});

const tabList = [
  { key: "doctors", label: "Врачи" },
  { key: "departments", label: "Отделения" },
  { key: "finance", label: "Финансы" },
] as const;

function ReportsPage() {
  const [tab, setTab] = useState<"doctors" | "departments" | "finance">("doctors");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Отчёты</h1>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1">Аналитика по врачам, отделениям и финансам</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[var(--color-muted)] p-1 rounded-xl w-fit">
        {tabList.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${tab === key ? "bg-[var(--color-surface)] text-foreground shadow-sm" : "text-[var(--color-text-secondary)] hover:text-foreground"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "doctors" && <DoctorsTab />}
      {tab === "departments" && <DepartmentsTab />}
      {tab === "finance" && <FinanceTab />}
    </div>
  );
}

function DoctorsTab() {
  const { data: efficiency, isLoading: loadEff } = useDoctorEfficiency();
  const { data: ranking, isLoading: loadRank } = useDoctorRanking();

  if (loadEff || loadRank) return <div className="text-center py-12 text-[var(--color-text-tertiary)]">Загрузка...</div>;

  return (
    <div className="space-y-6">
      {/* Top-5 ranking */}
      {ranking && ranking.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-3">Топ-5 врачей</h2>
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
            {ranking.slice(0, 5).map((doc, i) => (
              <div key={doc.doctor_id} className="bg-[var(--color-surface)] rounded-xl border border-border shadow-sm p-4 text-center">
                <div className={`w-8 h-8 rounded-full mx-auto mb-2 flex items-center justify-center text-white font-bold text-sm ${i === 0 ? "bg-amber-500" : i === 1 ? "bg-gray-400" : i === 2 ? "bg-amber-700" : "bg-[var(--color-border)]"}`}>
                  {i + 1}
                </div>
                <p className="font-semibold text-foreground text-sm truncate">{doc.doctor_name}</p>
                <p className="text-xs text-[var(--color-text-tertiary)]">{doc.specialty}</p>
                <p className="text-lg font-bold text-primary mt-1">{doc.score}</p>
                <p className="text-xs text-[var(--color-text-tertiary)]">{doc.appointments_count} приёмов</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Efficiency table */}
      {efficiency && efficiency.length > 0 && (
        <div className="bg-[var(--color-surface)] rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="text-lg font-semibold text-foreground">Эффективность врачей</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--color-muted)]">
                  <th className="text-left px-5 py-3 font-medium text-[var(--color-text-secondary)]">Врач</th>
                  <th className="text-left px-5 py-3 font-medium text-[var(--color-text-secondary)]">Специальность</th>
                  <th className="text-center px-5 py-3 font-medium text-[var(--color-text-secondary)]">Приёмы</th>
                  <th className="text-center px-5 py-3 font-medium text-[var(--color-text-secondary)]">Завершено</th>
                  <th className="text-center px-5 py-3 font-medium text-[var(--color-text-secondary)]">% завершения</th>
                  <th className="text-center px-5 py-3 font-medium text-[var(--color-text-secondary)]">Сред./день</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {efficiency.map((doc) => (
                  <tr key={doc.doctor_id} className="hover:bg-[var(--color-muted)] transition-colors">
                    <td className="px-5 py-3 font-medium text-foreground">{doc.doctor_name}</td>
                    <td className="px-5 py-3 text-[var(--color-text-secondary)]">{doc.specialty}</td>
                    <td className="px-5 py-3 text-center text-foreground">{doc.appointments_count}</td>
                    <td className="px-5 py-3 text-center text-foreground">{doc.completed_count}</td>
                    <td className="px-5 py-3 text-center">
                      <Badge variant={doc.completion_rate >= 80 ? "success" : doc.completion_rate >= 50 ? "warning" : "destructive"}>
                        {doc.completion_rate.toFixed(0)}%
                      </Badge>
                    </td>
                    <td className="px-5 py-3 text-center text-foreground">{doc.avg_per_day.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function DepartmentsTab() {
  const { data: departments, isLoading: loadDept } = useDepartmentLoad();
  const { data: summary, isLoading: loadSum } = useDepartmentSummary();

  if (loadDept || loadSum) return <div className="text-center py-12 text-[var(--color-text-tertiary)]">Загрузка...</div>;

  return (
    <div className="space-y-6">
      {/* Summary */}
      {summary && (
        <div className="bg-[var(--color-surface)] rounded-xl border border-border shadow-sm p-5">
          <h2 className="text-lg font-semibold text-foreground mb-3">Общая сводка</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-2xl font-bold text-foreground">{summary.total_departments}</p>
              <p className="text-sm text-[var(--color-text-secondary)]">Отделений</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{summary.total_beds}</p>
              <p className="text-sm text-[var(--color-text-secondary)]">Всего коек</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{summary.total_occupied}</p>
              <p className="text-sm text-[var(--color-text-secondary)]">Занято</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-primary">{summary.overall_occupancy.toFixed(0)}%</p>
              <p className="text-sm text-[var(--color-text-secondary)]">Загруженность</p>
            </div>
          </div>
        </div>
      )}

      {/* Department cards */}
      {departments && departments.length > 0 && (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
          {departments.map((dept) => {
            const pct = dept.occupancy_rate;
            const barColor = pct >= 90 ? "bg-destructive" : pct >= 70 ? "bg-warning" : "bg-success";
            return (
              <div key={dept.department_id} className="bg-[var(--color-surface)] rounded-xl border border-border shadow-sm p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-foreground">{dept.department_name}</h3>
                  <Badge variant={pct >= 90 ? "destructive" : pct >= 70 ? "warning" : "success"}>
                    {pct.toFixed(0)}%
                  </Badge>
                </div>
                <div className="w-full h-2 bg-[var(--color-muted)] rounded-full mb-3">
                  <div className={`h-2 rounded-full transition-all ${barColor}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-[var(--color-text-tertiary)]">Коек:</span>{" "}
                    <span className="text-foreground font-medium">{dept.occupied_beds}/{dept.total_beds}</span>
                  </div>
                  <div>
                    <span className="text-[var(--color-text-tertiary)]">Поступило:</span>{" "}
                    <span className="text-foreground font-medium">{dept.admissions_today}</span>
                  </div>
                  <div>
                    <span className="text-[var(--color-text-tertiary)]">Выписано:</span>{" "}
                    <span className="text-foreground font-medium">{dept.discharges_today}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FinanceTab() {
  const { data: plData, isLoading: loadPL } = usePL();
  const { data: dailyData, isLoading: loadDaily } = useDailyRevenue();

  if (loadPL || loadDaily) return <div className="text-center py-12 text-[var(--color-text-tertiary)]">Загрузка...</div>;

  const collectionRate = plData && plData.length > 0
    ? ((plData.reduce((s, p) => s + p.revenue, 0) / Math.max(plData.reduce((s, p) => s + p.billed, 0), 1)) * 100).toFixed(1)
    : "0";

  return (
    <div className="space-y-6">
      {/* Collection rate card */}
      <div className="bg-[var(--color-surface)] rounded-xl border border-border shadow-sm p-5">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6 text-success">
              <line x1="12" x2="12" y1="2" y2="22" />
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{collectionRate}%</p>
            <p className="text-sm text-[var(--color-text-secondary)]">Коэффициент сбора</p>
          </div>
        </div>
      </div>

      {/* P&L Bar Chart */}
      {plData && plData.length > 0 && (
        <div className="bg-[var(--color-surface)] rounded-xl border border-border shadow-sm p-5">
          <h2 className="text-lg font-semibold text-foreground mb-4">Доходы и расходы по месяцам</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={plData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: "var(--color-text-secondary)" }} />
              <YAxis tick={{ fontSize: 12, fill: "var(--color-text-secondary)" }} />
              <Tooltip contentStyle={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "12px", fontSize: "13px" }} />
              <Legend />
              <Bar dataKey="revenue" name="Доход" fill="var(--color-success)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="billed" name="Начислено" fill="var(--color-secondary)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Daily revenue line chart */}
      {dailyData && dailyData.length > 0 && (
        <div className="bg-[var(--color-surface)] rounded-xl border border-border shadow-sm p-5">
          <h2 className="text-lg font-semibold text-foreground mb-4">Ежедневный доход</h2>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={dailyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="date" tick={{ fontSize: 12, fill: "var(--color-text-secondary)" }} />
              <YAxis tick={{ fontSize: 12, fill: "var(--color-text-secondary)" }} />
              <Tooltip contentStyle={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "12px", fontSize: "13px" }} />
              <Line type="monotone" dataKey="revenue" name="Доход" stroke="var(--color-primary)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

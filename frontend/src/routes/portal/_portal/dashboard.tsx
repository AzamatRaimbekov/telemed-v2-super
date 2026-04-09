import { createFileRoute } from "@tanstack/react-router";
import { usePortalAuthStore } from "@/stores/portal-auth-store";
import { useQuery } from "@tanstack/react-query";
import { portalApi } from "@/features/portal/api";

export const Route = createFileRoute("/portal/_portal/dashboard")({
  component: PortalDashboard,
});

function PortalDashboard() {
  const patient = usePortalAuthStore((s) => s.patient);
  const { data: todayTreatment } = useQuery({ queryKey: ["portal-today"], queryFn: portalApi.getTodayTreatment, retry: false });
  const { data: appointments } = useQuery({ queryKey: ["portal-appointments"], queryFn: portalApi.getAppointments, retry: false });
  const { data: progress } = useQuery({ queryKey: ["portal-progress"], queryFn: portalApi.getProgress, retry: false });
  const { data: notifications } = useQuery({ queryKey: ["portal-notifications"], queryFn: portalApi.getNotifications, retry: false });

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Доброе утро";
    if (h < 18) return "Добрый день";
    return "Добрый вечер";
  })();

  const statusLabel: Record<string, string> = { ACTIVE: "Стационар", DISCHARGED: "Выписан", TRANSFERRED: "Переведён" };
  const statusColor: Record<string, string> = { ACTIVE: "bg-success/10 text-success", DISCHARGED: "bg-[var(--color-muted)] text-[var(--color-text-secondary)]", TRANSFERRED: "bg-warning/10 text-warning" };

  const nextAppt = (appointments as Array<Record<string, unknown>> || []).find((a: Record<string, unknown>) => a.status === "SCHEDULED" || a.status === "CONFIRMED");
  const unreadCount = (notifications as Array<Record<string, unknown>> || []).filter((n: Record<string, unknown>) => !n.is_read).length;

  const progressData = progress as Record<string, unknown> | null | undefined;

  return (
    <div className="max-w-4xl">
      {/* Greeting */}
      <div className="mb-8 animate-float-up" style={{ animationDelay: '0ms', opacity: 0 }}>
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-[24px] font-bold text-foreground tracking-tight">
            {greeting}{patient ? `, ${patient.first_name}` : ""}
          </h1>
          {patient?.status && (
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusColor[patient.status] || "bg-[var(--color-muted)]"}`}>
              {statusLabel[patient.status] || patient.status}
            </span>
          )}
        </div>
        <p className="text-[var(--color-text-secondary)] text-[15px]">Ваша панель здоровья</p>
      </div>

      {/* Next appointment */}
      {nextAppt && (
        <div className="mb-6 animate-float-up" style={{ animationDelay: '100ms', opacity: 0 }}>
          <div className="bg-gradient-to-br from-secondary/10 to-secondary/5 rounded-2xl border border-secondary/20 p-6">
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-5 h-5 text-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              <span className="text-sm font-semibold text-secondary">Ближайший приём</span>
            </div>
            <p className="text-lg font-bold text-foreground">
              {new Date(nextAppt.scheduled_start as string).toLocaleDateString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}
            </p>
            <p className="text-sm text-[var(--color-text-secondary)] mt-1">{(nextAppt.reason as string) || "Консультация"}</p>
          </div>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Упражнений", value: String((progressData?.this_week_sessions as number) ?? 0), sub: "на этой неделе", color: "#10B981" },
          { label: "Точность", value: `${(progressData?.avg_accuracy as number) ?? 0}%`, sub: "средняя", color: "#7E78D2" },
          { label: "Уведомления", value: String(unreadCount), sub: "непрочитано", color: "#F59E0B" },
          { label: "Лечение", value: String((todayTreatment as unknown[] || []).length), sub: "задач сегодня", color: "#3B82F6" },
        ].map((s, i) => (
          <div key={s.label} className="stat-card bg-[var(--color-surface)] rounded-xl border border-border p-4 animate-float-up" style={{ animationDelay: `${200 + i * 80}ms`, opacity: 0 }}>
            <p className="text-[22px] font-bold text-foreground">{s.value}</p>
            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{s.label}</p>
            <p className="text-[10px] text-[var(--color-text-tertiary)]">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)] mb-3 animate-float-up" style={{ animationDelay: '500ms', opacity: 0 }}>Быстрые действия</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        {[
          { label: "Начать упражнение", icon: "M22 12h-4l-3 9L9 3l-3 9H2", color: "#10B981", to: "/portal/exercises" },
          { label: "Написать врачу", icon: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z", color: "#7E78D2", to: "/portal/messages" },
          { label: "Записаться на приём", icon: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z", color: "#3B82F6", to: "/portal/appointments" },
        ].map((a, i) => (
          <a key={a.label} href={a.to}
            className="group flex items-center gap-3 p-4 rounded-xl border border-border bg-[var(--color-surface)] hover:border-[var(--color-text-tertiary)]/30 transition-all animate-float-up"
            style={{ animationDelay: `${600 + i * 80}ms`, opacity: 0 }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${a.color}15`, color: a.color }}>
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d={a.icon} />
              </svg>
            </div>
            <span className="text-sm font-medium text-foreground">{a.label}</span>
          </a>
        ))}
      </div>

      {/* Today's treatment plan */}
      {(todayTreatment as unknown[] || []).length > 0 && (
        <div className="animate-float-up" style={{ animationDelay: '800ms', opacity: 0 }}>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)] mb-3">План на сегодня</h2>
          <div className="bg-[var(--color-surface)] rounded-xl border border-border divide-y divide-border">
            {(todayTreatment as Array<Record<string, unknown>>).map((item) => (
              <div key={item.id as string} className="flex items-center gap-3 p-4">
                <div className={`w-5 h-5 rounded-full border-2 ${item.status === "COMPLETED" ? "bg-success border-success" : "border-border"} flex items-center justify-center`}>
                  {item.status === "COMPLETED" && (
                    <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 13l4 4L19 7"/></svg>
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm text-foreground">{item.title as string}</p>
                  <p className="text-xs text-[var(--color-text-tertiary)]">{item.type as string}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

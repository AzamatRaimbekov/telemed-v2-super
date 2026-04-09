import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { portalApi } from "@/features/portal/api";

export const Route = createFileRoute("/portal/_portal/appointments")({
  component: AppointmentsPage,
});

const statusLabels: Record<string, string> = {
  SCHEDULED: "Запланирован", CONFIRMED: "Подтверждён", CHECKED_IN: "Вы на месте",
  IN_PROGRESS: "Идёт приём", COMPLETED: "Завершён", CANCELLED: "Отменён", NO_SHOW: "Не явился",
};
const statusColors: Record<string, string> = {
  SCHEDULED: "bg-secondary/10 text-secondary", CONFIRMED: "bg-primary/10 text-[var(--color-primary-deep)]",
  IN_PROGRESS: "bg-success/10 text-success", COMPLETED: "bg-[var(--color-muted)] text-[var(--color-text-secondary)]",
  CANCELLED: "bg-destructive/10 text-destructive",
};

function AppointmentsPage() {
  const { data: appointments, isLoading } = useQuery({ queryKey: ["portal-appointments"], queryFn: portalApi.getAppointments });

  const upcoming = (appointments as Array<Record<string, any>> || []).filter((a: Record<string, any>) => ["SCHEDULED", "CONFIRMED"].includes(a.status));
  const past = (appointments as Array<Record<string, any>> || []).filter((a: Record<string, any>) => ["COMPLETED", "CANCELLED", "NO_SHOW"].includes(a.status));

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[24px] font-bold text-foreground tracking-tight animate-float-up">Записи на приём</h1>
        <button className="px-4 py-2 rounded-xl bg-secondary text-white text-sm font-medium hover:bg-secondary/90 transition-colors animate-float-up" style={{ animationDelay: '50ms' }}>
          + Записаться
        </button>
      </div>

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <div className="mb-6 animate-float-up" style={{ animationDelay: '100ms' }}>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)] mb-3">Предстоящие</h2>
          <div className="space-y-3">
            {upcoming.map((a: Record<string, any>) => (
              <div key={a.id} className="bg-[var(--color-surface)] rounded-xl border border-border p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[a.status] || ""}`}>
                    {statusLabels[a.status] || a.status}
                  </span>
                  <span className="text-xs text-[var(--color-text-tertiary)]">{a.appointment_type === "CONSULTATION" ? "Консультация" : a.appointment_type === "FOLLOW_UP" ? "Повторный" : a.appointment_type}</span>
                </div>
                <p className="text-lg font-bold text-foreground">
                  {new Date(a.scheduled_start).toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" })}
                </p>
                <p className="text-sm text-[var(--color-text-secondary)]">
                  {new Date(a.scheduled_start).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })} — {new Date(a.scheduled_end).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                </p>
                {a.reason && <p className="text-sm text-[var(--color-text-tertiary)] mt-2">{a.reason}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Past */}
      <div className="animate-float-up" style={{ animationDelay: '200ms' }}>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)] mb-3">История</h2>
        {past.length === 0 && !isLoading ? (
          <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-8 text-center">
            <p className="text-[var(--color-text-secondary)]">Нет записей</p>
          </div>
        ) : (
          <div className="bg-[var(--color-surface)] rounded-2xl border border-border divide-y divide-border">
            {past.map((a: Record<string, any>) => (
              <div key={a.id} className="flex items-center gap-4 p-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${a.status === "COMPLETED" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    {a.status === "COMPLETED" ? <path d="M5 13l4 4L19 7"/> : <path d="M18 6 6 18M6 6l12 12"/>}
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-sm text-foreground">{new Date(a.scheduled_start).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}</p>
                  <p className="text-xs text-[var(--color-text-tertiary)]">{a.reason || "Консультация"}</p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs ${statusColors[a.status] || ""}`}>
                  {statusLabels[a.status] || a.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { portalApi } from "@/features/portal/api";
import { useState } from "react";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";

export const Route = createFileRoute("/portal/_portal/treatment")({
  component: TreatmentPage,
});

// ---------- types ----------

interface TreatmentItem {
  id: string;
  type: "MEDICATION" | "PROCEDURE" | "LAB_TEST" | "THERAPY" | "EXERCISE";
  title: string;
  description?: string;
  frequency?: string;
  scheduled_time?: string;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "SKIPPED" | "CANCELLED";
  prescription_id?: string;
  confirmed_at?: string;
}

interface TreatmentPlan {
  id: string;
  title: string;
  status: "ACTIVE" | "COMPLETED" | "CANCELLED" | "DRAFT";
  start_date: string;
  end_date?: string;
  items: TreatmentItem[];
  doctor_name?: string;
}

// ---------- constants ----------

const PLAN_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Активный",
  COMPLETED: "Завершён",
  CANCELLED: "Отменён",
  DRAFT: "Черновик",
};

const PLAN_STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-success/10 text-success",
  COMPLETED: "bg-[var(--color-muted)] text-[var(--color-text-secondary)]",
  CANCELLED: "bg-destructive/10 text-destructive",
  DRAFT: "bg-warning/10 text-warning",
};

const ITEM_TYPE_LABELS: Record<string, string> = {
  MEDICATION: "Лекарство",
  PROCEDURE: "Процедура",
  LAB_TEST: "Анализ",
  THERAPY: "Терапия",
  EXERCISE: "Упражнение",
};

const ITEM_TYPE_COLORS: Record<string, string> = {
  MEDICATION: "#22C55E",
  PROCEDURE: "#3B82F6",
  LAB_TEST: "#F59E0B",
  THERAPY: "#14B8A6",
  EXERCISE: "#7E78D2",
};

const ITEM_STATUS_LABELS: Record<string, string> = {
  PENDING: "Ожидает",
  IN_PROGRESS: "В процессе",
  COMPLETED: "Выполнено",
  SKIPPED: "Пропущено",
  CANCELLED: "Отменено",
};

const ITEM_STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-[var(--color-muted)] text-[var(--color-text-secondary)]",
  IN_PROGRESS: "bg-secondary/10 text-secondary",
  COMPLETED: "bg-success/10 text-success",
  SKIPPED: "bg-warning/10 text-warning",
  CANCELLED: "bg-destructive/10 text-destructive",
};

// ---------- item type icon ----------

function TypeIcon({ type, color }: { type: string; color: string }) {
  const icons: Record<string, React.ReactNode> = {
    MEDICATION: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/>
      </svg>
    ),
    PROCEDURE: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4.5 6.375a4.125 4.125 0 1 1 8.25 0"/><path d="M14.25 9.75v4.875c0 2.071-1.679 3.75-3.75 3.75S6.75 16.696 6.75 14.625V9.75"/><path d="M14.25 9.75h-7.5"/>
      </svg>
    ),
    LAB_TEST: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2v6a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V2"/><path d="M10 2v3.3a4 4 0 0 1-1.17 2.83L4 13v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6l-4.83-4.87A4 4 0 0 1 14 5.3V2"/>
      </svg>
    ),
    THERAPY: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="M12 8v8"/><path d="M8 12h8"/>
      </svg>
    ),
    EXERCISE: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
      </svg>
    ),
  };

  return (
    <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${color}18`, color }}>
      {icons[type] || icons.MEDICATION}
    </div>
  );
}

// ---------- timeline bar ----------

function PlanTimeline({ startDate, endDate }: { startDate: string; endDate?: string }) {
  const start = new Date(startDate).getTime();
  const end = endDate ? new Date(endDate).getTime() : start + 30 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const total = end - start;
  const elapsed = Math.max(0, Math.min(now - start, total));
  const pct = total > 0 ? Math.round((elapsed / total) * 100) : 0;
  const isActive = now >= start && now <= end;
  const todayPct = Math.min(pct, 100);

  return (
    <div className="mt-4">
      <div className="flex justify-between text-xs text-[var(--color-text-tertiary)] mb-1">
        <span>{formatDate(startDate)}</span>
        {endDate && <span>{formatDate(endDate)}</span>}
      </div>
      <div className="relative h-2 bg-[var(--color-muted)] rounded-full overflow-visible">
        <div
          className="absolute left-0 top-0 h-2 rounded-full"
          style={{ width: `${pct}%`, background: "linear-gradient(90deg, #BDEDE0, #7E78D2)" }}
        />
        {isActive && (
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-secondary border-2 border-white shadow"
            style={{ left: `${todayPct}%`, transform: "translate(-50%, -50%)" }}
            title="Сегодня"
          />
        )}
      </div>
    </div>
  );
}

// ---------- treatment item row ----------

function TreatmentItemRow({ item, onConfirm, confirming }: { item: TreatmentItem; onConfirm: (prescId: string) => void; confirming: boolean }) {
  const color = ITEM_TYPE_COLORS[item.type] || "#7E78D2";
  const isDone = item.status === "COMPLETED";

  return (
    <div className={`flex items-start gap-3 p-3 rounded-xl transition-colors ${isDone ? "opacity-60" : "hover:bg-[var(--color-muted)]/40"}`}>
      <TypeIcon type={item.type} color={color} />
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-0.5">
          <p className={`text-sm font-medium ${isDone ? "line-through text-[var(--color-text-tertiary)]" : "text-foreground"}`}>
            {item.title}
          </p>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${ITEM_STATUS_COLORS[item.status] || ""}`}>
            {ITEM_STATUS_LABELS[item.status] || item.status}
          </span>
        </div>
        {item.description && <p className="text-xs text-[var(--color-text-tertiary)] mb-1">{item.description}</p>}
        <div className="flex flex-wrap gap-3 text-xs text-[var(--color-text-tertiary)]">
          {item.frequency && <span>Частота: {item.frequency}</span>}
          {item.scheduled_time && <span>Время: {item.scheduled_time}</span>}
          {item.confirmed_at && (
            <span className="text-success">
              Принято: {new Date(item.confirmed_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>
      </div>
      {item.type === "MEDICATION" && item.prescription_id && !isDone && (
        <button
          onClick={() => onConfirm(item.prescription_id!)}
          disabled={confirming}
          className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-success/10 text-success hover:bg-success/20 disabled:opacity-50 transition-colors"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 13l4 4L19 7"/></svg>
          Принял
        </button>
      )}
      {item.type === "EXERCISE" && !isDone && (
        <Link
          to="/portal/exercise-session"
          search={{ exerciseId: String(
            (item as Record<string, unknown>).exercise_id ??
            ((item as Record<string, unknown>).configuration as Record<string, unknown> | undefined)?.exercise_id ??
            item.id
          ) }}
          className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-secondary/10 text-secondary hover:bg-secondary/20 transition-colors"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polygon points="5 3 19 12 5 21 5 3"/>
          </svg>
          Начать тренировку
        </Link>
      )}
      {item.type === "THERAPY" && !isDone && (
        <span className="flex-shrink-0 px-2 py-1 rounded-lg text-[10px] font-medium bg-[var(--color-muted)] text-[var(--color-text-tertiary)]">
          Выполняется на приёме
        </span>
      )}
    </div>
  );
}

// ---------- medication today section ----------

function MedicationTracker({ plans }: { plans: TreatmentPlan[] }) {
  const queryClient = useQueryClient();
  const confirmMutation = useMutation({
    mutationFn: portalApi.confirmPrescription,
    onSuccess: () => {
      toast.success("Приём лекарства подтверждён");
      queryClient.invalidateQueries({ queryKey: ["portal-treatment-plans"] });
    },
    onError: () => toast.error("Не удалось подтвердить приём"),
  });

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const todayMeds = plans
    .filter((p) => p.status === "ACTIVE")
    .flatMap((p) => p.items.filter((i) => i.type === "MEDICATION"));

  if (todayMeds.length === 0) {
    return (
      <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-6 text-center">
        <svg className="w-8 h-8 mx-auto mb-2 text-[var(--color-text-tertiary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/>
        </svg>
        <p className="text-sm text-[var(--color-text-secondary)]">Нет лекарств на сегодня</p>
      </div>
    );
  }

  return (
    <div className="bg-[var(--color-surface)] rounded-2xl border border-border overflow-hidden">
      <div className="p-4 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground">Лекарства на сегодня</h3>
      </div>
      <div className="divide-y divide-border">
        {todayMeds.map((med) => {
          const isDone = med.status === "COMPLETED";
          // Check if the scheduled time has passed but not confirmed (missed)
          let isMissed = false;
          if (med.scheduled_time && !isDone) {
            const parts = med.scheduled_time.split(":");
            const hPart = Number(parts[0] ?? "");
            const mPart = Number(parts[1] ?? "");
            if (!isNaN(hPart) && !isNaN(mPart)) {
              isMissed = (hPart * 60 + mPart) < nowMinutes;
            }
          }

          return (
            <div key={med.id} className={`flex items-center gap-3 p-4 ${isDone ? "opacity-70" : ""}`}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isDone ? "bg-success/10" : isMissed ? "bg-destructive/10" : "bg-[#22C55E]/10"}`}>
                {isDone ? (
                  <svg className="w-5 h-5 text-success" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 13l4 4L19 7"/></svg>
                ) : isMissed ? (
                  <svg className="w-5 h-5 text-destructive" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                ) : (
                  <svg className="w-5 h-5 text-[#22C55E]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/></svg>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${isDone ? "line-through text-[var(--color-text-tertiary)]" : "text-foreground"}`}>
                  {med.title}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  {med.scheduled_time && (
                    <span className="text-xs text-[var(--color-text-tertiary)]">{med.scheduled_time}</span>
                  )}
                  {isDone && med.confirmed_at && (
                    <span className="text-xs text-success">
                      Принято в {new Date(med.confirmed_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  )}
                  {isMissed && !isDone && (
                    <span className="text-xs text-destructive font-medium">Пропущено</span>
                  )}
                </div>
              </div>
              {!isDone && med.prescription_id && (
                <button
                  onClick={() => confirmMutation.mutate(med.prescription_id!)}
                  disabled={confirmMutation.isPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-success text-white hover:bg-success/90 disabled:opacity-50 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 13l4 4L19 7"/></svg>
                  Принял
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- plan card (accordion) ----------

function PlanCard({ plan }: { plan: TreatmentPlan }) {
  const [expanded, setExpanded] = useState(plan.status === "ACTIVE");
  const [activeType, setActiveType] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const confirmMutation = useMutation({
    mutationFn: portalApi.confirmPrescription,
    onSuccess: () => {
      toast.success("Приём лекарства подтверждён");
      queryClient.invalidateQueries({ queryKey: ["portal-treatment-plans"] });
    },
    onError: () => toast.error("Не удалось подтвердить приём"),
  });

  const items = plan.items || [];
  const completedCount = items.filter((i) => i.status === "COMPLETED").length;
  const progress = items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0;

  const itemsByType = items.reduce<Record<string, TreatmentItem[]>>((acc, item) => {
    if (!acc[item.type]) acc[item.type] = [];
    (acc[item.type] as TreatmentItem[]).push(item);
    return acc;
  }, {});

  const types = Object.keys(itemsByType);
  const displayTypes = activeType ? [activeType] : types;

  return (
    <div className="bg-[var(--color-surface)] rounded-2xl border border-border overflow-hidden">
      {/* Card header — always visible */}
      <button
        className="w-full text-left p-5 flex items-start gap-4 hover:bg-[var(--color-muted)]/30 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h3 className="text-base font-semibold text-foreground">{plan.title}</h3>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PLAN_STATUS_COLORS[plan.status] || ""}`}>
              {PLAN_STATUS_LABELS[plan.status] || plan.status}
            </span>
          </div>
          {plan.doctor_name && (
            <p className="text-sm text-[var(--color-text-secondary)] mb-2">Врач: {plan.doctor_name}</p>
          )}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-[var(--color-muted)] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{ width: `${progress}%`, background: "linear-gradient(90deg, #BDEDE0, #7E78D2)" }}
              />
            </div>
            <span className="text-xs text-[var(--color-text-tertiary)] whitespace-nowrap">
              {completedCount}/{items.length} · {progress}%
            </span>
          </div>
          {(plan.start_date || plan.end_date) && (
            <p className="text-xs text-[var(--color-text-tertiary)] mt-1.5">
              {plan.start_date && formatDate(plan.start_date)}
              {plan.end_date && ` — ${formatDate(plan.end_date)}`}
            </p>
          )}
        </div>
        <svg
          className={`w-5 h-5 text-[var(--color-text-tertiary)] flex-shrink-0 transition-transform mt-0.5 ${expanded ? "rotate-180" : ""}`}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-border">
          {/* Timeline */}
          {plan.start_date && (
            <div className="px-5 pt-4 pb-2">
              <PlanTimeline startDate={plan.start_date} endDate={plan.end_date} />
            </div>
          )}

          {/* Type filter tabs */}
          {types.length > 1 && (
            <div className="flex gap-1 px-5 py-3 overflow-x-auto">
              <button
                onClick={() => setActiveType(null)}
                className={`flex-shrink-0 px-3 py-1 rounded-lg text-xs font-medium transition-colors ${activeType === null ? "bg-secondary text-white" : "bg-[var(--color-muted)] text-[var(--color-text-secondary)] hover:text-foreground"}`}
              >
                Все ({items.length})
              </button>
              {types.map((t) => (
                <button
                  key={t}
                  onClick={() => setActiveType(activeType === t ? null : t)}
                  className={`flex-shrink-0 flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium transition-colors ${activeType === t ? "bg-secondary text-white" : "bg-[var(--color-muted)] text-[var(--color-text-secondary)] hover:text-foreground"}`}
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ background: ITEM_TYPE_COLORS[t] || "#7E78D2" }}
                  />
                  {ITEM_TYPE_LABELS[t] || t} ({itemsByType[t]?.length ?? 0})
                </button>
              ))}
            </div>
          )}

          {/* Items grouped by type */}
          <div className="px-5 pb-5 space-y-4">
            {displayTypes.map((type) => (
              <div key={type}>
                {types.length > 1 && !activeType && (
                  <h4
                    className="text-xs font-semibold uppercase tracking-wider mb-2"
                    style={{ color: ITEM_TYPE_COLORS[type] || "var(--color-text-tertiary)" }}
                  >
                    {ITEM_TYPE_LABELS[type] || type}
                  </h4>
                )}
                <div className="space-y-1">
                  {itemsByType[type]?.map((item) => (
                    <TreatmentItemRow
                      key={item.id}
                      item={item}
                      onConfirm={(id) => confirmMutation.mutate(id)}
                      confirming={confirmMutation.isPending}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- skeleton ----------

function PlanSkeleton() {
  return (
    <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-5 animate-pulse">
      <div className="h-5 bg-[var(--color-muted)] rounded w-1/2 mb-2" />
      <div className="h-3 bg-[var(--color-muted)] rounded w-1/4 mb-4" />
      <div className="h-2 bg-[var(--color-muted)] rounded-full" />
    </div>
  );
}

// ---------- main component ----------

function TreatmentPage() {
  const { data: plans, isLoading } = useQuery({
    queryKey: ["portal-treatment-plans"],
    queryFn: portalApi.getTreatmentPlans,
    retry: false,
  });

  const planList = (plans as TreatmentPlan[] || []);
  const activePlans = planList.filter((p) => p.status === "ACTIVE");
  const otherPlans = planList.filter((p) => p.status !== "ACTIVE");

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="animate-float-up" style={{ animationDelay: "0ms" }}>
        <h1 className="text-[24px] font-bold text-foreground tracking-tight">Планы лечения</h1>
        <p className="text-[var(--color-text-secondary)] mt-1">Ваши текущие и прошлые программы лечения</p>
      </div>

      {/* Medication tracker */}
      {!isLoading && activePlans.length > 0 && (
        <div className="animate-float-up" style={{ animationDelay: "80ms" }}>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)] mb-3">Трекер лекарств</h2>
          <MedicationTracker plans={activePlans} />
        </div>
      )}

      {/* Active plans */}
      {(isLoading || activePlans.length > 0) && (
        <div className="animate-float-up" style={{ animationDelay: "160ms" }}>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)] mb-3">Активные планы</h2>
          {isLoading ? (
            <div className="space-y-4">
              <PlanSkeleton />
              <PlanSkeleton />
            </div>
          ) : (
            <div className="space-y-4">
              {activePlans.map((plan) => (
                <PlanCard key={plan.id} plan={plan} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Other plans */}
      {!isLoading && otherPlans.length > 0 && (
        <div className="animate-float-up" style={{ animationDelay: "240ms" }}>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)] mb-3">История</h2>
          <div className="space-y-4">
            {otherPlans.map((plan) => (
              <PlanCard key={plan.id} plan={plan} />
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && planList.length === 0 && (
        <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-12 text-center animate-float-up">
          <svg className="w-12 h-12 mx-auto mb-3 text-[var(--color-text-tertiary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3">
            <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
            <rect width="6" height="4" x="9" y="3" rx="1"/><path d="m9 14 2 2 4-4"/>
          </svg>
          <p className="text-lg font-semibold text-foreground mb-1">Нет планов лечения</p>
          <p className="text-sm text-[var(--color-text-secondary)]">Ваш врач ещё не назначил план лечения</p>
        </div>
      )}
    </div>
  );
}

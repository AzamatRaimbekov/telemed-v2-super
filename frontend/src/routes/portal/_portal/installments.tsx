import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { usePortalAuthStore } from "@/stores/portal-auth-store";
import portalClient from "@/lib/portal-api-client";

export const Route = createFileRoute("/portal/_portal/installments")({
  component: InstallmentsPage,
});

type PaymentSchedule = {
  number: number;
  amount: number;
  date: string;
  is_paid: boolean;
};

type Plan = {
  id: string;
  total_amount: number;
  paid_amount: number;
  monthly_payment: number;
  installments_count: number;
  start_date: string;
  description: string;
  is_active: boolean;
  is_completed: boolean;
  schedule: PaymentSchedule[];
};

function InstallmentsPage() {
  const { patient } = usePortalAuthStore();
  const patientId = patient?.id;

  const { data: plans, isLoading } = useQuery({
    queryKey: ["installments", patientId],
    queryFn: () =>
      portalClient.get("/portal/installments/my", { params: { patient_id: patientId } }).then((r) => r.data),
    enabled: !!patientId,
  });

  const activePlans = (plans ?? []).filter((p: Plan) => p.is_active);
  const completedPlans = (plans ?? []).filter((p: Plan) => p.is_completed);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Рассрочка</h1>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="animate-pulse rounded-2xl bg-muted h-40" />
          ))}
        </div>
      ) : plans && plans.length === 0 ? (
        <div className="rounded-2xl border border-border bg-[var(--color-surface)] p-8 text-center">
          <p className="text-[var(--color-text-tertiary)]">У вас нет планов рассрочки</p>
        </div>
      ) : (
        <>
          {/* Active plans */}
          {activePlans.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-foreground">Активные ({activePlans.length})</h2>
              {activePlans.map((plan: Plan) => (
                <PlanCard key={plan.id} plan={plan} />
              ))}
            </div>
          )}

          {/* Completed plans */}
          {completedPlans.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-[var(--color-text-secondary)]">
                Завершённые ({completedPlans.length})
              </h2>
              {completedPlans.map((plan: Plan) => (
                <PlanCard key={plan.id} plan={plan} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function PlanCard({ plan }: { plan: Plan }) {
  const progress = plan.total_amount > 0 ? (plan.paid_amount / plan.total_amount) * 100 : 0;
  const remaining = plan.total_amount - plan.paid_amount;

  return (
    <div className="rounded-2xl border border-border bg-[var(--color-surface)] p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-foreground">{plan.description}</h3>
          <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">
            с {new Date(plan.start_date).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <span
          className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
            plan.is_completed
              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
              : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
          }`}
        >
          {plan.is_completed ? "Завершено" : "Активно"}
        </span>
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex justify-between text-sm mb-1">
          <span className="text-[var(--color-text-secondary)]">
            {plan.paid_amount.toLocaleString("ru-RU")} / {plan.total_amount.toLocaleString("ru-RU")} сом
          </span>
          <span className="font-semibold text-foreground">{Math.round(progress)}%</span>
        </div>
        <div className="h-2.5 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${plan.is_completed ? "bg-green-500" : "bg-primary"}`}
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
        {remaining > 0 && (
          <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
            Осталось: {remaining.toLocaleString("ru-RU")} сом ({plan.monthly_payment.toLocaleString("ru-RU")} сом/мес)
          </p>
        )}
      </div>

      {/* Payment schedule */}
      {plan.schedule && plan.schedule.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-[var(--color-text-secondary)]">График платежей:</p>
          <div className="max-h-48 overflow-y-auto space-y-1">
            {plan.schedule.map((pay) => (
              <div
                key={pay.number}
                className="flex items-center justify-between py-1.5 px-2 rounded-lg text-sm hover:bg-muted/30"
              >
                <div className="flex items-center gap-2">
                  {pay.is_paid ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-green-500">
                      <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
                  )}
                  <span className={pay.is_paid ? "text-[var(--color-text-tertiary)] line-through" : "text-foreground"}>
                    Платёж #{pay.number}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-[var(--color-text-tertiary)]">
                    {new Date(pay.date).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
                  </span>
                  <span className={`font-semibold ${pay.is_paid ? "text-green-600" : "text-foreground"}`}>
                    {pay.amount.toLocaleString("ru-RU")} сом
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

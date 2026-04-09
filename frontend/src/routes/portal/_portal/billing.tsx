import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { portalApi } from "@/features/portal/api";
import { useState } from "react";
import { formatCurrency } from "@/lib/utils";

export const Route = createFileRoute("/portal/_portal/billing")({
  component: BillingPage,
});

function BillingPage() {
  const { data: summary } = useQuery({ queryKey: ["portal-billing-summary"], queryFn: portalApi.getBillingSummary });
  const { data: invoices } = useQuery({ queryKey: ["portal-invoices"], queryFn: portalApi.getInvoices });
  const { data: payments } = useQuery({ queryKey: ["portal-payments"], queryFn: portalApi.getPayments });
  const [tab, setTab] = useState<"invoices" | "payments">("invoices");

  const statusLabels: Record<string, string> = {
    DRAFT: "Черновик",
    ISSUED: "Выставлен",
    PAID: "Оплачен",
    PARTIALLY_PAID: "Частично",
    CANCELLED: "Отменён",
    OVERDUE: "Просрочен",
  };
  const statusColors: Record<string, string> = {
    PAID: "bg-success/10 text-success",
    PARTIALLY_PAID: "bg-warning/10 text-warning",
    OVERDUE: "bg-destructive/10 text-destructive",
    ISSUED: "bg-secondary/10 text-secondary",
  };

  const s = summary as Record<string, any> | undefined;

  return (
    <div className="max-w-4xl">
      <h1 className="text-[24px] font-bold text-foreground tracking-tight mb-6 animate-float-up">Финансы и счета</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Итого", value: s?.total_amount ?? 0, color: "text-foreground" },
          { label: "Оплачено", value: s?.total_paid ?? 0, color: "text-success" },
          { label: "Страховка", value: s?.insurance_covered ?? 0, color: "text-secondary" },
          { label: "К оплате", value: s?.patient_balance ?? 0, color: s?.patient_balance && s.patient_balance > 0 ? "text-destructive" : "text-foreground" },
        ].map((item, i) => (
          <div key={item.label} className="stat-card bg-[var(--color-surface)] rounded-xl border border-border p-4 animate-float-up" style={{ animationDelay: `${100 + i * 60}ms` }}>
            <p className="text-xs text-[var(--color-text-tertiary)] mb-1">{item.label}</p>
            <p className={`text-xl font-bold ${item.color}`}>{formatCurrency(item.value)}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-[var(--color-muted)] rounded-xl mb-4 animate-float-up" style={{ animationDelay: '300ms' }}>
        <button onClick={() => setTab("invoices")} className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${tab === "invoices" ? "bg-[var(--color-surface)] text-foreground shadow-sm" : "text-[var(--color-text-secondary)]"}`}>Счета</button>
        <button onClick={() => setTab("payments")} className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${tab === "payments" ? "bg-[var(--color-surface)] text-foreground shadow-sm" : "text-[var(--color-text-secondary)]"}`}>Платежи</button>
      </div>

      <div className="animate-float-up" style={{ animationDelay: '350ms' }}>
        {tab === "invoices" ? (
          <div className="bg-[var(--color-surface)] rounded-2xl border border-border divide-y divide-border">
            {(invoices as Array<Record<string, any>> || []).length === 0 ? (
              <div className="p-8 text-center"><p className="text-[var(--color-text-secondary)]">Нет счетов</p></div>
            ) : (invoices as Array<Record<string, any>>).map((inv) => (
              <div key={inv.id} className="flex items-center gap-4 p-4">
                <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">Счёт №{inv.invoice_number}</p>
                  <p className="text-xs text-[var(--color-text-tertiary)]">{new Date(inv.issued_at).toLocaleDateString("ru-RU")}</p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[inv.status] || "bg-[var(--color-muted)]"}`}>
                  {statusLabels[inv.status] || inv.status}
                </span>
                <p className="text-sm font-bold text-foreground">{formatCurrency(inv.total)}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-[var(--color-surface)] rounded-2xl border border-border divide-y divide-border">
            {(payments as Array<Record<string, any>> || []).length === 0 ? (
              <div className="p-8 text-center"><p className="text-[var(--color-text-secondary)]">Нет платежей</p></div>
            ) : (payments as Array<Record<string, any>>).map((p) => (
              <div key={p.id} className="flex items-center gap-4 p-4">
                <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-success" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 13l4 4L19 7"/></svg>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{formatCurrency(p.amount)}</p>
                  <p className="text-xs text-[var(--color-text-tertiary)]">{p.payment_method} · {new Date(p.paid_at).toLocaleDateString("ru-RU")}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/portal/_portal/billing")({
  component: BillingPage,
});

function BillingPage() {
  return (
    <div className="max-w-4xl">
      <h1 className="text-[24px] font-bold text-foreground tracking-tight mb-6 animate-float-up" style={{ opacity: 0 }}>Финансы и счета</h1>
      <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-8 text-center animate-float-up" style={{ animationDelay: '100ms', opacity: 0 }}>
        <p className="text-[var(--color-text-secondary)]">Раздел в разработке</p>
      </div>
    </div>
  );
}

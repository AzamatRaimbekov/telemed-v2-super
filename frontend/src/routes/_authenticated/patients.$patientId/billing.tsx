import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute(
  "/_authenticated/patients/$patientId/billing"
)({
  component: BillingPage,
});

function BillingPage() {
  return (
    <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-12 text-center">
      <div className="w-14 h-14 rounded-2xl bg-[var(--color-muted)] flex items-center justify-center mx-auto mb-4">
        <svg
          className="w-7 h-7 text-[var(--color-text-tertiary)]"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="12" x2="12" y1="2" y2="22" />
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
      </div>
      <h3 className="text-base font-semibold text-foreground mb-1">Биллинг</h3>
      <p className="text-sm text-[var(--color-text-secondary)]">Раздел в разработке</p>
    </div>
  );
}

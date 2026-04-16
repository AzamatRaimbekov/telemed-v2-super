// routes/_authenticated/finance.tsx — Clinic-wide finance management page
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { financeApi } from "@/features/finance/api";
import { Button } from "@/components/ui/button";
import { InputField } from "@/components/ui/input-field";
import { TextareaField } from "@/components/ui/textarea-field";
import { CustomSelect } from "@/components/ui/select-custom";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/finance")({
  component: FinancePage,
});

// ── Constants ──────────────────────────────────────────────────────────────────

const TABS = [
  { id: "invoices", label: "Счета" },
  { id: "payments", label: "Оплаты" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const INVOICE_STATUSES = [
  { value: "", label: "Все" },
  { value: "DRAFT", label: "Черновик" },
  { value: "ISSUED", label: "Выставлен" },
  { value: "PAID", label: "Оплачен" },
  { value: "PARTIALLY_PAID", label: "Частично" },
  { value: "OVERDUE", label: "Просрочен" },
  { value: "CANCELLED", label: "Отменён" },
];

const INVOICE_STATUS_META: Record<
  string,
  { label: string; variant: "muted" | "primary" | "success" | "warning" | "destructive" | "secondary" }
> = {
  DRAFT: { label: "Черновик", variant: "muted" },
  ISSUED: { label: "Выставлен", variant: "primary" },
  PAID: { label: "Оплачен", variant: "success" },
  PARTIALLY_PAID: { label: "Частично оплачен", variant: "warning" },
  OVERDUE: { label: "Просрочен", variant: "destructive" },
  CANCELLED: { label: "Отменён", variant: "muted" },
};

const PAYMENT_METHOD_META: Record<string, { label: string; variant: "success" | "primary" | "secondary" | "warning" | "muted" }> = {
  CASH: { label: "Наличные", variant: "success" },
  CARD: { label: "Карта", variant: "primary" },
  INSURANCE: { label: "Страховка", variant: "secondary" },
  BANK_TRANSFER: { label: "Перевод", variant: "warning" },
  OTHER: { label: "Другое", variant: "muted" },
};

const ITEM_TYPES = [
  { value: "CONSULTATION", label: "Консультация" },
  { value: "PROCEDURE", label: "Процедура" },
  { value: "LAB_TEST", label: "Анализ" },
  { value: "MEDICATION", label: "Лекарство" },
  { value: "ROOM", label: "Палата" },
  { value: "OTHER", label: "Другое" },
];

const PAYMENT_METHODS = [
  { value: "CASH", label: "Наличные" },
  { value: "CARD", label: "Карта" },
  { value: "INSURANCE", label: "Страховка" },
  { value: "BANK_TRANSFER", label: "Перевод" },
  { value: "OTHER", label: "Другое" },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatCurrency(v: number | null | undefined): string {
  if (v == null) return "—";
  return new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 0 }).format(v) + " сом";
}

function formatDate(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ru-RU");
}

function formatDateTime(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// ── SVG Icons ─────────────────────────────────────────────────────────────────

function BanknoteIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="12" x="2" y="6" rx="2" />
      <circle cx="12" cy="12" r="2" />
      <path d="M6 12h.01M18 12h.01" />
    </svg>
  );
}

function CheckCircleIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><path d="m9 11 3 3L22 4" />
    </svg>
  );
}

function ClockIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function AlertTriangleIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><path d="M12 9v4" /><path d="M12 17h.01" />
    </svg>
  );
}

function PlusIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="12" x2="12" y1="5" y2="19" /><line x1="5" x2="19" y1="12" y2="12" />
    </svg>
  );
}

function TrashIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}

function ChevronDownIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function ReceiptIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
      <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" /><path d="M12 17.5v-11" />
    </svg>
  );
}

// ── Skeleton / Empty ──────────────────────────────────────────────────────────

function SkeletonRows({ count = 5 }: { count?: number }) {
  return (
    <div className="p-4 space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-14 bg-[var(--color-muted)] rounded-xl animate-pulse" />
      ))}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="p-12 text-center">
      <ReceiptIcon className="w-12 h-12 mx-auto mb-3 text-[var(--color-text-tertiary)]" />
      <p className="text-[var(--color-text-secondary)] text-sm">{message}</p>
    </div>
  );
}

// ── Generic Modal ──────────────────────────────────────────────────────────────

function FinanceModal({
  title,
  onClose,
  onSubmit,
  isLoading,
  children,
  submitLabel = "Сохранить",
  maxWidth = "max-w-lg",
}: {
  title: string;
  onClose: () => void;
  onSubmit?: (e: React.FormEvent) => void;
  isLoading?: boolean;
  children: React.ReactNode;
  submitLabel?: string;
  maxWidth?: string;
}) {
  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)" }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={`w-full ${maxWidth} bg-[var(--color-surface)] rounded-2xl border border-border shadow-2xl animate-scale-in flex flex-col max-h-[90vh]`}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <h2 className="text-base font-bold text-foreground">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--color-text-tertiary)] hover:text-foreground hover:bg-[var(--color-muted)] transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" x2="6" y1="6" y2="18" /><line x1="6" x2="18" y1="6" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        {onSubmit ? (
          <form onSubmit={onSubmit} className="flex flex-col flex-1 overflow-hidden">
            <div className="px-6 py-5 overflow-y-auto flex-1 space-y-4">
              {children}
            </div>
            <div className="px-6 py-4 border-t border-border flex justify-end gap-3 flex-shrink-0">
              <Button type="button" variant="outline" onClick={onClose}>
                Отмена
              </Button>
              <Button type="submit" loading={isLoading}>
                {submitLabel}
              </Button>
            </div>
          </form>
        ) : (
          <div className="px-6 py-5 overflow-y-auto flex-1 space-y-4">
            {children}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// STATS ROW
// ══════════════════════════════════════════════════════════════════════════════

function StatsRow() {
  const { data, isLoading } = useQuery({
    queryKey: ["finance-stats"],
    queryFn: financeApi.getStats,
    staleTime: 30 * 1000,
  });

  const stats = data as Record<string, unknown> | undefined;

  const kpiItems = [
    {
      label: "Выставлено",
      value: stats?.total_invoiced != null ? formatCurrency(Number(stats.total_invoiced)) : "—",
      sub: `${stats?.invoice_count ?? 0} счетов`,
      color: "text-primary",
      icon: <ReceiptIcon className="w-6 h-6" />,
    },
    {
      label: "Оплачено",
      value: stats?.total_paid != null ? formatCurrency(Number(stats.total_paid)) : "—",
      sub: `${stats?.paid_count ?? 0} оплачено`,
      color: "text-success",
      icon: <CheckCircleIcon className="w-6 h-6" />,
    },
    {
      label: "Задолженность",
      value: stats?.total_outstanding != null ? formatCurrency(Number(stats.total_outstanding)) : "—",
      sub: null,
      color: "text-warning",
      icon: <ClockIcon className="w-6 h-6" />,
    },
    {
      label: "Просрочено",
      value: stats?.total_overdue != null ? formatCurrency(Number(stats.total_overdue)) : "—",
      sub: `${stats?.overdue_count ?? 0} просрочено`,
      color: "text-destructive",
      icon: <AlertTriangleIcon className="w-6 h-6" />,
    },
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 bg-[var(--color-muted)] rounded-2xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {kpiItems.map((item, i) => (
        <div
          key={item.label}
          className="bg-[var(--color-surface)] rounded-2xl border border-border p-4 animate-float-up"
          style={{ animationDelay: `${i * 50}ms` }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className={`${item.color} opacity-60`}>{item.icon}</span>
          </div>
          <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)] mt-1">{item.label}</p>
          {item.sub && (
            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{item.sub}</p>
          )}
        </div>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB: INVOICES
// ══════════════════════════════════════════════════════════════════════════════

function InvoicesTab({ onCreateInvoice, onRecordPayment }: { onCreateInvoice: () => void; onRecordPayment: (invoiceId?: string) => void }) {
  const [statusFilter, setStatusFilter] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["finance-invoices", statusFilter],
    queryFn: () => financeApi.getInvoices({ status: statusFilter || undefined, limit: 100 }),
    staleTime: 15 * 1000,
  });

  const updateMut = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) => financeApi.updateInvoice(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["finance-stats"] });
      toast.success("Счёт обновлён");
    },
    onError: () => toast.error("Ошибка обновления счёта"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => financeApi.deleteInvoice(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["finance-stats"] });
      toast.success("Счёт удалён");
    },
    onError: () => toast.error("Ошибка удаления счёта"),
  });

  const invoices: Array<Record<string, unknown>> = Array.isArray(data) ? data : (data as Record<string, unknown>)?.items as Array<Record<string, unknown>> ?? [];

  return (
    <>
      {/* Status filter pills */}
      <div className="flex flex-wrap gap-3 mb-4 animate-float-up" style={{ animationDelay: "200ms" }}>
        <div className="flex gap-1 p-1 bg-[var(--color-muted)] rounded-xl flex-wrap">
          {INVOICE_STATUSES.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => setStatusFilter(s.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                statusFilter === s.value
                  ? "bg-secondary text-white shadow-sm"
                  : "text-[var(--color-text-secondary)] hover:text-foreground hover:bg-[var(--color-surface)]"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <Button size="sm" onClick={onCreateInvoice}>
          <PlusIcon className="w-4 h-4 mr-1" />
          Создать счёт
        </Button>
      </div>

      {/* Table */}
      <div className="bg-[var(--color-surface)] rounded-2xl border border-border overflow-hidden animate-float-up" style={{ animationDelay: "250ms" }}>
        {isLoading ? (
          <SkeletonRows />
        ) : invoices.length === 0 ? (
          <EmptyState message={statusFilter ? "Счета не найдены" : "Нет выставленных счетов"} />
        ) : (
          <>
            {/* Header */}
            <div className="hidden md:grid grid-cols-[100px_2fr_120px_120px_110px_110px_80px] gap-2 px-4 py-3 border-b border-border bg-[var(--color-muted)]/30">
              <span className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase">Номер</span>
              <span className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase">Пациент</span>
              <span className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase">Статус</span>
              <span className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase">Сумма</span>
              <span className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase">Создан</span>
              <span className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase">Срок</span>
              <span className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase">Действия</span>
            </div>
            <div className="divide-y divide-border">
              {invoices.map((inv, idx) => {
                const id = String(inv.id ?? idx);
                const isExpanded = expandedId === id;
                const st = String(inv.status ?? "DRAFT");
                const meta = INVOICE_STATUS_META[st] ?? INVOICE_STATUS_META.DRAFT;
                const total = Number(inv.total ?? 0);
                const amountPaid = Number(inv.amount_paid ?? 0);
                const remaining = total - amountPaid;
                const items = (inv.items as Array<Record<string, unknown>>) ?? [];
                const payments = (inv.payments as Array<Record<string, unknown>>) ?? [];
                const canPay = st !== "PAID" && st !== "CANCELLED" && st !== "DRAFT";

                return (
                  <div key={id}>
                    {/* Main row */}
                    <div
                      className="grid grid-cols-1 md:grid-cols-[100px_2fr_120px_120px_110px_110px_80px] gap-2 px-4 py-3 hover:bg-[var(--color-muted)]/40 transition-colors cursor-pointer animate-float-up"
                      style={{ animationDelay: `${idx * 30}ms` }}
                      onClick={() => setExpandedId(isExpanded ? null : id)}
                    >
                      <div className="flex items-center gap-2">
                        <ChevronDownIcon className={`w-4 h-4 text-[var(--color-text-tertiary)] transition-transform flex-shrink-0 ${isExpanded ? "rotate-180" : ""}`} />
                        <span className="text-sm font-mono text-foreground">{String(inv.invoice_number ?? id.slice(0, 8))}</span>
                      </div>
                      <p className="text-sm text-foreground truncate">{String(inv.patient_name ?? "—")}</p>
                      <div>
                        <Badge variant={meta.variant}>{meta.label}</Badge>
                      </div>
                      <p className={`text-sm font-semibold ${st === "CANCELLED" ? "line-through text-[var(--color-text-tertiary)]" : "text-foreground"}`}>
                        {formatCurrency(total)}
                      </p>
                      <p className="text-sm text-[var(--color-text-secondary)]">{formatDate(inv.issued_at as string ?? inv.created_at as string)}</p>
                      <p className="text-sm text-[var(--color-text-secondary)]">{formatDate(inv.due_date as string)}</p>
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        {st === "DRAFT" && (
                          <button
                            type="button"
                            title="Выставить"
                            className="p-1.5 rounded-lg text-primary hover:bg-primary/10 transition-colors"
                            onClick={() => updateMut.mutate({ id, payload: { status: "ISSUED" } })}
                          >
                            <BanknoteIcon className="w-4 h-4" />
                          </button>
                        )}
                        {st !== "CANCELLED" && st !== "PAID" && (
                          <button
                            type="button"
                            title="Отменить"
                            className="p-1.5 rounded-lg text-[var(--color-text-tertiary)] hover:text-destructive hover:bg-destructive/10 transition-colors"
                            onClick={() => updateMut.mutate({ id, payload: { status: "CANCELLED" } })}
                          >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                              <circle cx="12" cy="12" r="10" /><path d="m15 9-6 6" /><path d="m9 9 6 6" />
                            </svg>
                          </button>
                        )}
                        <button
                          type="button"
                          title="Удалить"
                          className="p-1.5 rounded-lg text-[var(--color-text-tertiary)] hover:text-destructive hover:bg-destructive/10 transition-colors"
                          onClick={() => {
                            if (window.confirm("Удалить счёт?")) deleteMut.mutate(id);
                          }}
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div className="px-6 pb-4 bg-[var(--color-muted)]/20 border-t border-border">
                        {/* Items */}
                        {items.length > 0 && (
                          <div className="mt-3">
                            <h4 className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-2">Позиции</h4>
                            <div className="bg-[var(--color-surface)] rounded-xl border border-border overflow-hidden">
                              <div className="hidden md:grid grid-cols-[2fr_1fr_100px_100px_100px] gap-2 px-4 py-2 bg-[var(--color-muted)]/30 border-b border-border">
                                <span className="text-xs font-semibold text-[var(--color-text-tertiary)]">Описание</span>
                                <span className="text-xs font-semibold text-[var(--color-text-tertiary)]">Тип</span>
                                <span className="text-xs font-semibold text-[var(--color-text-tertiary)]">Кол-во</span>
                                <span className="text-xs font-semibold text-[var(--color-text-tertiary)]">Цена</span>
                                <span className="text-xs font-semibold text-[var(--color-text-tertiary)]">Итого</span>
                              </div>
                              <div className="divide-y divide-border">
                                {items.map((item, ii) => (
                                  <div key={ii} className="grid grid-cols-1 md:grid-cols-[2fr_1fr_100px_100px_100px] gap-2 px-4 py-2">
                                    <p className="text-sm text-foreground">{String(item.description ?? "—")}</p>
                                    <p className="text-sm text-[var(--color-text-secondary)]">
                                      {ITEM_TYPES.find((t) => t.value === item.item_type)?.label ?? String(item.item_type ?? "—")}
                                    </p>
                                    <p className="text-sm text-[var(--color-text-secondary)]">{String(item.quantity ?? 1)}</p>
                                    <p className="text-sm text-[var(--color-text-secondary)]">{formatCurrency(Number(item.unit_price ?? 0))}</p>
                                    <p className="text-sm font-medium text-foreground">{formatCurrency(Number(item.quantity ?? 1) * Number(item.unit_price ?? 0))}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Payments */}
                        {payments.length > 0 && (
                          <div className="mt-3">
                            <h4 className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-2">Оплаты</h4>
                            <div className="space-y-2">
                              {payments.map((pay, pi) => {
                                const pm = PAYMENT_METHOD_META[String(pay.payment_method ?? "OTHER")] ?? PAYMENT_METHOD_META.OTHER;
                                return (
                                  <div key={pi} className="flex items-center gap-3 bg-[var(--color-surface)] rounded-xl border border-border px-4 py-2">
                                    <Badge variant={pm.variant}>{pm.label}</Badge>
                                    <span className="text-sm font-semibold text-foreground">{formatCurrency(Number(pay.amount ?? 0))}</span>
                                    {pay.reference_number && (
                                      <span className="text-xs text-[var(--color-text-tertiary)]">Реф: {String(pay.reference_number)}</span>
                                    )}
                                    <span className="text-xs text-[var(--color-text-secondary)] ml-auto">{formatDateTime(pay.paid_at as string ?? pay.created_at as string)}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Notes */}
                        {inv.notes && (
                          <div className="mt-3">
                            <h4 className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-1">Примечания</h4>
                            <p className="text-sm text-[var(--color-text-secondary)]">{String(inv.notes)}</p>
                          </div>
                        )}

                        {/* Summary row */}
                        <div className="mt-3 flex items-center justify-between bg-[var(--color-surface)] rounded-xl border border-border px-4 py-3">
                          <div className="flex gap-6">
                            {inv.discount != null && Number(inv.discount) > 0 && (
                              <div>
                                <p className="text-xs text-[var(--color-text-tertiary)]">Скидка</p>
                                <p className="text-sm font-semibold text-foreground">{formatCurrency(Number(inv.discount))}</p>
                              </div>
                            )}
                            {inv.tax != null && Number(inv.tax) > 0 && (
                              <div>
                                <p className="text-xs text-[var(--color-text-tertiary)]">Налог</p>
                                <p className="text-sm font-semibold text-foreground">{formatCurrency(Number(inv.tax))}</p>
                              </div>
                            )}
                            <div>
                              <p className="text-xs text-[var(--color-text-tertiary)]">Оплачено</p>
                              <p className="text-sm font-semibold text-success">{formatCurrency(amountPaid)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-[var(--color-text-tertiary)]">Остаток</p>
                              <p className={`text-sm font-semibold ${remaining > 0 ? "text-warning" : "text-success"}`}>{formatCurrency(remaining)}</p>
                            </div>
                          </div>
                          {canPay && remaining > 0 && (
                            <Button size="sm" onClick={() => onRecordPayment(id)}>
                              Записать оплату
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB: PAYMENTS
// ══════════════════════════════════════════════════════════════════════════════

function PaymentsTab({ onRecordPayment }: { onRecordPayment: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ["finance-payments"],
    queryFn: () => financeApi.getPayments({ limit: 100 }),
    staleTime: 15 * 1000,
  });

  const payments: Array<Record<string, unknown>> = Array.isArray(data) ? data : (data as Record<string, unknown>)?.items as Array<Record<string, unknown>> ?? [];

  return (
    <>
      <div className="flex justify-end mb-4 animate-float-up" style={{ animationDelay: "200ms" }}>
        <Button size="sm" onClick={onRecordPayment}>
          <PlusIcon className="w-4 h-4 mr-1" />
          Записать оплату
        </Button>
      </div>

      <div className="bg-[var(--color-surface)] rounded-2xl border border-border overflow-hidden animate-float-up" style={{ animationDelay: "250ms" }}>
        {isLoading ? (
          <SkeletonRows />
        ) : payments.length === 0 ? (
          <EmptyState message="Нет записей об оплате" />
        ) : (
          <>
            <div className="hidden md:grid grid-cols-[120px_120px_1fr_140px_180px_1fr] gap-2 px-4 py-3 border-b border-border bg-[var(--color-muted)]/30">
              <span className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase">Сумма</span>
              <span className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase">Метод</span>
              <span className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase">Референс</span>
              <span className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase">Дата</span>
              <span className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase">Принял</span>
              <span className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase">Счёт</span>
            </div>
            <div className="divide-y divide-border">
              {payments.map((pay, idx) => {
                const pm = PAYMENT_METHOD_META[String(pay.payment_method ?? "OTHER")] ?? PAYMENT_METHOD_META.OTHER;
                return (
                  <div
                    key={String(pay.id ?? idx)}
                    className="grid grid-cols-1 md:grid-cols-[120px_120px_1fr_140px_180px_1fr] gap-2 px-4 py-3 hover:bg-[var(--color-muted)]/40 transition-colors animate-float-up"
                    style={{ animationDelay: `${idx * 30}ms` }}
                  >
                    <p className="text-sm font-semibold text-foreground">{formatCurrency(Number(pay.amount ?? 0))}</p>
                    <div><Badge variant={pm.variant}>{pm.label}</Badge></div>
                    <p className="text-sm text-[var(--color-text-secondary)] truncate">{String(pay.reference_number ?? "—")}</p>
                    <p className="text-sm text-[var(--color-text-secondary)]">{formatDateTime(pay.paid_at as string ?? pay.created_at as string)}</p>
                    <p className="text-sm text-[var(--color-text-secondary)] truncate">{String(pay.received_by_name ?? "—")}</p>
                    <p className="text-sm text-[var(--color-text-tertiary)] font-mono truncate">{String(pay.invoice_number ?? pay.invoice_id ?? "—")}</p>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MODAL: CREATE INVOICE
// ══════════════════════════════════════════════════════════════════════════════

type InvoiceItem = {
  item_type: string;
  description: string;
  quantity: number;
  unit_price: number;
};

const emptyItem = (): InvoiceItem => ({ item_type: "CONSULTATION", description: "", quantity: 1, unit_price: 0 });

function CreateInvoiceModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [patientId, setPatientId] = useState("");
  const [items, setItems] = useState<InvoiceItem[]>([emptyItem()]);
  const [discount, setDiscount] = useState("0");
  const [tax, setTax] = useState("0");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");

  const createMut = useMutation({
    mutationFn: (data: Record<string, unknown>) => financeApi.createInvoice(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["finance-stats"] });
      toast.success("Счёт создан");
      onClose();
    },
    onError: () => toast.error("Ошибка создания счёта"),
  });

  const subtotal = items.reduce((sum, it) => sum + it.quantity * it.unit_price, 0);
  const totalValue = subtotal - Number(discount || 0) + Number(tax || 0);

  const handleItemChange = useCallback((index: number, field: keyof InvoiceItem, value: string | number) => {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, [field]: value } : it)));
  }, []);

  const handleAddItem = useCallback(() => {
    setItems((prev) => [...prev, emptyItem()]);
  }, []);

  const handleRemoveItem = useCallback((index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!patientId.trim()) { toast.error("Укажите ID пациента"); return; }
      if (items.length === 0) { toast.error("Добавьте хотя бы одну позицию"); return; }
      createMut.mutate({
        patient_id: patientId.trim(),
        items: items.map((it) => ({
          item_type: it.item_type,
          description: it.description,
          quantity: it.quantity,
          unit_price: it.unit_price,
        })),
        discount: Number(discount || 0),
        tax: Number(tax || 0),
        due_date: dueDate || undefined,
        notes: notes || undefined,
      });
    },
    [patientId, items, discount, tax, dueDate, notes, createMut],
  );

  return (
    <FinanceModal title="Новый счёт" onClose={onClose} onSubmit={handleSubmit} isLoading={createMut.isPending} submitLabel="Создать" maxWidth="max-w-2xl">
      <InputField label="ID пациента" value={patientId} onChange={(e) => setPatientId(e.target.value)} placeholder="UUID пациента" required />

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-foreground">Позиции</label>
          <button type="button" onClick={handleAddItem} className="text-xs text-primary hover:underline flex items-center gap-1">
            <PlusIcon className="w-3 h-3" /> Добавить
          </button>
        </div>
        <div className="space-y-3">
          {items.map((item, i) => (
            <div key={i} className="flex flex-wrap gap-2 items-start bg-[var(--color-muted)]/30 rounded-xl p-3 border border-border">
              <div className="w-36">
                <CustomSelect
                  value={item.item_type}
                  onChange={(v) => handleItemChange(i, "item_type", v)}
                  options={ITEM_TYPES}
                  placeholder="Тип"
                />
              </div>
              <div className="flex-1 min-w-[140px]">
                <InputField
                  value={item.description}
                  onChange={(e) => handleItemChange(i, "description", e.target.value)}
                  placeholder="Описание"
                />
              </div>
              <div className="w-20">
                <InputField
                  type="number"
                  value={String(item.quantity)}
                  onChange={(e) => handleItemChange(i, "quantity", Number(e.target.value))}
                  placeholder="Кол-во"
                  min={1}
                />
              </div>
              <div className="w-28">
                <InputField
                  type="number"
                  value={String(item.unit_price)}
                  onChange={(e) => handleItemChange(i, "unit_price", Number(e.target.value))}
                  placeholder="Цена"
                  min={0}
                />
              </div>
              <div className="flex items-center gap-2 pt-1">
                <span className="text-sm font-medium text-foreground w-24 text-right">{formatCurrency(item.quantity * item.unit_price)}</span>
                {items.length > 1 && (
                  <button type="button" onClick={() => handleRemoveItem(i)} className="p-1 text-[var(--color-text-tertiary)] hover:text-destructive transition-colors">
                    <TrashIcon className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <InputField label="Скидка (сом)" type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} min={0} />
        <InputField label="Налог (сом)" type="number" value={tax} onChange={(e) => setTax(e.target.value)} min={0} />
      </div>

      <InputField label="Срок оплаты" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />

      <TextareaField label="Примечания" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Комментарий к счёту..." rows={2} />

      {/* Total preview */}
      <div className="bg-[var(--color-muted)]/30 rounded-xl border border-border p-4">
        <div className="flex justify-between text-sm">
          <span className="text-[var(--color-text-secondary)]">Подитого:</span>
          <span className="text-foreground font-medium">{formatCurrency(subtotal)}</span>
        </div>
        {Number(discount || 0) > 0 && (
          <div className="flex justify-between text-sm mt-1">
            <span className="text-[var(--color-text-secondary)]">Скидка:</span>
            <span className="text-destructive">-{formatCurrency(Number(discount))}</span>
          </div>
        )}
        {Number(tax || 0) > 0 && (
          <div className="flex justify-between text-sm mt-1">
            <span className="text-[var(--color-text-secondary)]">Налог:</span>
            <span className="text-foreground">+{formatCurrency(Number(tax))}</span>
          </div>
        )}
        <div className="flex justify-between text-base font-bold mt-2 pt-2 border-t border-border">
          <span className="text-foreground">Итого:</span>
          <span className="text-primary">{formatCurrency(totalValue)}</span>
        </div>
      </div>
    </FinanceModal>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MODAL: RECORD PAYMENT
// ══════════════════════════════════════════════════════════════════════════════

function RecordPaymentModal({ onClose, preselectedInvoiceId }: { onClose: () => void; preselectedInvoiceId?: string }) {
  const queryClient = useQueryClient();

  // Fetch unpaid invoices for the dropdown
  const { data: allInvoices } = useQuery({
    queryKey: ["finance-invoices-unpaid"],
    queryFn: () => financeApi.getInvoices({ limit: 200 }),
    staleTime: 15 * 1000,
  });

  const unpaidInvoices: Array<Record<string, unknown>> = (
    Array.isArray(allInvoices) ? allInvoices : (allInvoices as Record<string, unknown>)?.items as Array<Record<string, unknown>> ?? []
  ).filter((inv) => {
    const st = String(inv.status ?? "");
    return st === "ISSUED" || st === "PARTIALLY_PAID" || st === "OVERDUE";
  });

  const [invoiceId, setInvoiceId] = useState(preselectedInvoiceId ?? "");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("CASH");
  const [reference, setReference] = useState("");

  // Auto-fill remaining balance when selecting invoice
  const selectedInvoice = unpaidInvoices.find((inv) => String(inv.id) === invoiceId);
  const remaining = selectedInvoice ? Number(selectedInvoice.total ?? 0) - Number(selectedInvoice.amount_paid ?? 0) : 0;

  const handleInvoiceSelect = useCallback((val: string) => {
    setInvoiceId(val);
    const inv = unpaidInvoices.find((i) => String(i.id) === val);
    if (inv) {
      const rem = Number(inv.total ?? 0) - Number(inv.amount_paid ?? 0);
      setAmount(String(rem));
    }
  }, [unpaidInvoices]);

  const recordMut = useMutation({
    mutationFn: (data: Record<string, unknown>) => financeApi.recordPayment(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["finance-payments"] });
      queryClient.invalidateQueries({ queryKey: ["finance-stats"] });
      queryClient.invalidateQueries({ queryKey: ["finance-invoices-unpaid"] });
      toast.success("Оплата записана");
      onClose();
    },
    onError: () => toast.error("Ошибка записи оплаты"),
  });

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!invoiceId) { toast.error("Выберите счёт"); return; }
      if (!amount || Number(amount) <= 0) { toast.error("Укажите сумму"); return; }
      recordMut.mutate({
        invoice_id: invoiceId,
        amount: Number(amount),
        payment_method: method,
        reference_number: reference || undefined,
      });
    },
    [invoiceId, amount, method, reference, recordMut],
  );

  const invoiceOptions = unpaidInvoices.map((inv) => {
    const rem = Number(inv.total ?? 0) - Number(inv.amount_paid ?? 0);
    return {
      value: String(inv.id),
      label: `${String(inv.invoice_number ?? String(inv.id).slice(0, 8))} — ${String(inv.patient_name ?? "—")} (${formatCurrency(rem)})`,
    };
  });

  return (
    <FinanceModal title="Записать оплату" onClose={onClose} onSubmit={handleSubmit} isLoading={recordMut.isPending} submitLabel="Записать">
      <CustomSelect
        label="Счёт"
        value={invoiceId}
        onChange={handleInvoiceSelect}
        options={invoiceOptions}
        placeholder="Выберите счёт"
      />

      {selectedInvoice && (
        <div className="bg-[var(--color-muted)]/30 rounded-xl border border-border p-3 flex gap-4 text-sm">
          <div>
            <p className="text-[var(--color-text-tertiary)]">Сумма счёта</p>
            <p className="font-semibold text-foreground">{formatCurrency(Number(selectedInvoice.total ?? 0))}</p>
          </div>
          <div>
            <p className="text-[var(--color-text-tertiary)]">Оплачено</p>
            <p className="font-semibold text-success">{formatCurrency(Number(selectedInvoice.amount_paid ?? 0))}</p>
          </div>
          <div>
            <p className="text-[var(--color-text-tertiary)]">Остаток</p>
            <p className="font-semibold text-warning">{formatCurrency(remaining)}</p>
          </div>
        </div>
      )}

      <InputField
        label="Сумма (сом)"
        type="number"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="0"
        min={0}
        required
      />

      <CustomSelect
        label="Метод оплаты"
        value={method}
        onChange={setMethod}
        options={PAYMENT_METHODS}
        placeholder="Выберите метод"
      />

      <InputField
        label="Номер референса"
        value={reference}
        onChange={(e) => setReference(e.target.value)}
        placeholder="Номер чека, транзакции и т.д."
      />
    </FinanceModal>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════════════════

function FinancePage() {
  const [activeTab, setActiveTab] = useState<TabId>("invoices");
  const [showCreateInvoice, setShowCreateInvoice] = useState(false);
  const [showRecordPayment, setShowRecordPayment] = useState(false);
  const [paymentInvoiceId, setPaymentInvoiceId] = useState<string | undefined>(undefined);

  const handleRecordPayment = useCallback((invoiceId?: string) => {
    setPaymentInvoiceId(invoiceId);
    setShowRecordPayment(true);
  }, []);

  const handleClosePayment = useCallback(() => {
    setShowRecordPayment(false);
    setPaymentInvoiceId(undefined);
  }, []);

  return (
    <div className="max-w-7xl">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6 animate-float-up">
        <div>
          <h1 className="text-[26px] font-bold text-foreground tracking-tight">Финансы</h1>
          <p className="text-[var(--color-text-secondary)] text-sm mt-1">
            Управление счетами, оплатами и финансовой отчётностью
          </p>
        </div>
        <Button onClick={() => setShowCreateInvoice(true)}>
          <PlusIcon className="w-4 h-4 mr-1" />
          Создать счёт
        </Button>
      </div>

      {/* Stats row */}
      <div className="mb-6">
        <StatsRow />
      </div>

      {/* Tab bar */}
      <div
        className="flex gap-1 bg-[var(--color-surface)] rounded-xl border border-border p-1 mb-6 w-fit animate-float-up"
        style={{ animationDelay: "250ms" }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`py-2 px-6 rounded-lg text-sm font-medium transition-all duration-200 ${
              activeTab === tab.id
                ? "bg-secondary text-white shadow-sm"
                : "text-[var(--color-text-secondary)] hover:text-foreground hover:bg-[var(--color-muted)]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "invoices" && (
        <InvoicesTab onCreateInvoice={() => setShowCreateInvoice(true)} onRecordPayment={handleRecordPayment} />
      )}
      {activeTab === "payments" && (
        <PaymentsTab onRecordPayment={() => handleRecordPayment()} />
      )}

      {/* Modals */}
      {showCreateInvoice && <CreateInvoiceModal onClose={() => setShowCreateInvoice(false)} />}
      {showRecordPayment && <RecordPaymentModal onClose={handleClosePayment} preselectedInvoiceId={paymentInvoiceId} />}
    </div>
  );
}

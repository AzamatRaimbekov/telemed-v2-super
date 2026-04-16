import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { pharmacyApi } from "@/features/pharmacy/api";
import { Button } from "@/components/ui/button";
import { InputField } from "@/components/ui/input-field";
import { TextareaField } from "@/components/ui/textarea-field";
import { CustomSelect } from "@/components/ui/select-custom";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/pharmacy")({
  component: PharmacyPage,
});

// ── Constants ──────────────────────────────────────────────────────────────────

const TABS = [
  { id: "dashboard", label: "Обзор" },
  { id: "inventory", label: "Склад" },
  { id: "dispensing", label: "Рецепты" },
  { id: "orders", label: "Закупки" },
  { id: "suppliers", label: "Поставщики" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const DRUG_FORMS = [
  { value: "TABLET", label: "Таблетки" },
  { value: "CAPSULE", label: "Капсулы" },
  { value: "INJECTION", label: "Инъекции" },
  { value: "SYRUP", label: "Сироп" },
  { value: "CREAM", label: "Крем" },
  { value: "DROPS", label: "Капли" },
  { value: "INHALER", label: "Ингалятор" },
  { value: "OTHER", label: "Другое" },
];

const DRUG_CATEGORIES = [
  { value: "ANTICOAGULANT", label: "Антикоагулянты" },
  { value: "ANTIHYPERTENSIVE", label: "Антигипертензивные" },
  { value: "NOOTROPIC", label: "Ноотропы" },
  { value: "ANALGESIC", label: "Анальгетики" },
  { value: "ANTIBIOTIC", label: "Антибиотики" },
  { value: "VITAMIN", label: "Витамины" },
  { value: "OTHER", label: "Другое" },
];

const INVENTORY_STATUSES = [
  { value: "ok", label: "В наличии" },
  { value: "low", label: "Низкий остаток" },
  { value: "out", label: "Нет в наличии" },
  { value: "expired", label: "Просрочен" },
];

const WRITEOFF_REASONS = [
  { value: "EXPIRED", label: "Просрочено" },
  { value: "DAMAGED", label: "Повреждено" },
  { value: "LOST", label: "Утеря" },
  { value: "OTHER", label: "Другое" },
];

const ORDER_STATUSES = [
  { value: "", label: "Все" },
  { value: "DRAFT", label: "Черновик" },
  { value: "SUBMITTED", label: "Отправлен" },
  { value: "RECEIVED", label: "Получен" },
  { value: "CANCELLED", label: "Отменён" },
];

const ORDER_STATUS_META: Record<string, { label: string; variant: "muted" | "primary" | "success" | "destructive" }> = {
  DRAFT: { label: "Черновик", variant: "muted" },
  SUBMITTED: { label: "Отправлен", variant: "primary" },
  RECEIVED: { label: "Получен", variant: "success" },
  CANCELLED: { label: "Отменён", variant: "destructive" },
};

const DATE_FILTER_OPTIONS = [
  { value: "", label: "Все" },
  { value: "today", label: "Сегодня" },
  { value: "week", label: "Неделя" },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

const searchIcon = (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </svg>
);

function labelFor(map: { value: string; label: string }[], val: string): string {
  return map.find((m) => m.value === val)?.label ?? val;
}

function formatDate(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ru-RU");
}

function formatDateTime(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatCurrency(v: number | null | undefined): string {
  if (v == null) return "—";
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "KGS", maximumFractionDigits: 0 }).format(v);
}

function statusBadgeVariant(status: string): "success" | "warning" | "destructive" | "muted" {
  if (status === "ok") return "success";
  if (status === "low") return "warning";
  if (status === "out" || status === "expired") return "destructive";
  return "muted";
}

function statusLabel(status: string): string {
  const map: Record<string, string> = { ok: "В наличии", low: "Низкий остаток", out: "Нет в наличии", expired: "Просрочен" };
  return map[status] ?? status;
}

// ── useDebounce ────────────────────────────────────────────────────────────────

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ── Generic Modal ──────────────────────────────────────────────────────────────

interface ModalProps {
  title: string;
  onClose: () => void;
  onSubmit?: (e: React.FormEvent) => void;
  isLoading?: boolean;
  children: React.ReactNode;
  submitLabel?: string;
  maxWidth?: string;
}

function PharmacyModal({ title, onClose, onSubmit, isLoading, children, submitLabel = "Сохранить", maxWidth = "max-w-lg" }: ModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

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

function EmptyState({ message, icon }: { message: string; icon?: React.ReactNode }) {
  return (
    <div className="p-12 text-center">
      {icon || (
        <svg className="w-12 h-12 mx-auto mb-3 text-[var(--color-text-tertiary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /><line x1="11" x2="11" y1="8" y2="14" /><line x1="8" x2="14" y1="11" y2="11" />
        </svg>
      )}
      <p className="text-[var(--color-text-secondary)] text-sm">{message}</p>
    </div>
  );
}

// ── SVG Icons ─────────────────────────────────────────────────────────────────

function PillIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m10.5 1.5 3 3-8.5 8.5a4.95 4.95 0 1 1-3-3z" /><path d="m7.5 7.5 3-3" />
    </svg>
  );
}

function PackageIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m7.5 4.27 9 5.15" /><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" />
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

function TruckIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" /><path d="M15 18H9" />
      <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14" />
      <circle cx="17" cy="18" r="2" /><circle cx="7" cy="18" r="2" />
    </svg>
  );
}

function ClipboardIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="8" height="4" x="8" y="2" rx="1" ry="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="M12 11h4" /><path d="M12 16h4" /><path d="M8 11h.01" /><path d="M8 16h.01" />
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

function EditIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z" />
    </svg>
  );
}

function InfoIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" />
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

// ══════════════════════════════════════════════════════════════════════════════
// TAB: DASHBOARD
// ══════════════════════════════════════════════════════════════════════════════

function DashboardTab() {
  const { data, isLoading } = useQuery({
    queryKey: ["pharmacy-dashboard"],
    queryFn: pharmacyApi.getDashboard,
    staleTime: 30 * 1000,
  });

  const dashboard = data as Record<string, unknown> | undefined;
  const kpis = dashboard?.kpis as Record<string, unknown> | undefined;
  const alerts = (dashboard?.alerts as Array<Record<string, unknown>>) ?? [];
  const recentOps = (dashboard?.recent_operations as Array<Record<string, unknown>>) ?? [];

  const kpiItems = [
    { label: "Препаратов на складе", value: kpis?.total_drugs ?? "—", color: "text-secondary", icon: <PillIcon className="w-6 h-6" /> },
    { label: "Стоимость склада", value: kpis?.total_value != null ? formatCurrency(Number(kpis.total_value)) : "—", color: "text-success", icon: <PackageIcon className="w-6 h-6" /> },
    { label: "Рецептов к выдаче", value: kpis?.pending_prescriptions ?? "—", color: "text-primary", icon: <ClipboardIcon className="w-6 h-6" /> },
    { label: "Просроченные партии", value: kpis?.expired_batches ?? "—", color: "text-destructive", icon: <AlertTriangleIcon className="w-6 h-6" /> },
    { label: "Низкий остаток", value: kpis?.low_stock ?? "—", color: "text-warning", icon: <AlertTriangleIcon className="w-6 h-6" /> },
  ];

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-24 bg-[var(--color-muted)] rounded-2xl animate-pulse" />
          ))}
        </div>
        <SkeletonRows count={3} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
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
          </div>
        ))}
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-6 animate-float-up" style={{ animationDelay: "300ms" }}>
          <h3 className="text-sm font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-4">Уведомления</h3>
          <div className="space-y-3">
            {alerts.map((alert, i) => {
              const severity = String(alert.severity ?? "info");
              const borderColor = severity === "critical" ? "border-l-destructive" : severity === "warning" ? "border-l-warning" : "border-l-secondary";
              const bgColor = severity === "critical" ? "bg-destructive/5" : severity === "warning" ? "bg-warning/5" : "bg-secondary/5";
              const textColor = severity === "critical" ? "text-destructive" : severity === "warning" ? "text-warning" : "text-secondary";
              const severityLabel = severity === "critical" ? "Критично" : severity === "warning" ? "Внимание" : "Информация";
              const SeverityIcon = severity === "critical" ? AlertTriangleIcon : severity === "warning" ? AlertTriangleIcon : InfoIcon;
              return (
                <div
                  key={i}
                  className={`flex items-start gap-3 p-3 rounded-xl border-l-4 ${borderColor} ${bgColor}`}
                >
                  <SeverityIcon className={`w-5 h-5 ${textColor} flex-shrink-0 mt-0.5`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`text-xs font-bold uppercase ${textColor}`}>{severityLabel}</span>
                    </div>
                    <p className="text-sm text-foreground">{String(alert.message ?? "")}</p>
                    {alert.drug_name && (
                      <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">{String(alert.drug_name)}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent operations */}
      <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-6 animate-float-up" style={{ animationDelay: "350ms" }}>
        <h3 className="text-sm font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-4">Последние операции</h3>
        {recentOps.length === 0 ? (
          <p className="text-sm text-[var(--color-text-secondary)]">Нет операций</p>
        ) : (
          <div className="space-y-2">
            {recentOps.map((op, i) => (
              <div key={i} className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-[var(--color-muted)]/40 transition-colors">
                <div className="w-8 h-8 rounded-full bg-secondary/10 flex items-center justify-center flex-shrink-0">
                  <PillIcon className="w-4 h-4 text-secondary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground truncate">
                    <span className="font-medium">{String(op.type ?? "")}</span>
                    {op.drug_name && <> — {String(op.drug_name)}</>}
                    {op.quantity != null && <span className="text-[var(--color-text-tertiary)]"> ({String(op.quantity)} шт.)</span>}
                  </p>
                  <p className="text-xs text-[var(--color-text-tertiary)]">
                    {op.performer && <>{String(op.performer)} · </>}
                    {formatDateTime(String(op.created_at ?? ""))}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB: INVENTORY
// ══════════════════════════════════════════════════════════════════════════════

function InventoryTab() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [form, setForm] = useState("");
  const [status, setStatus] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [writeOffModal, setWriteOffModal] = useState<{ drugId: string; batchId: string; batchNumber: string; maxQty: number } | null>(null);
  const [adjustModal, setAdjustModal] = useState<{ drugId: string; batchId: string; batchNumber: string; currentQty: number } | null>(null);

  const debouncedSearch = useDebounce(search, 300);

  const { data, isLoading } = useQuery({
    queryKey: ["pharmacy-inventory", debouncedSearch, category, form, status],
    queryFn: () =>
      pharmacyApi.getInventory({
        search: debouncedSearch || undefined,
        category: category || undefined,
        form: form || undefined,
        status: status || undefined,
      }),
  });

  const items: Array<Record<string, unknown>> = (data as Record<string, unknown>)?.items as Array<Record<string, unknown>> ?? (Array.isArray(data) ? data : []);

  // Fetch batches for expanded row
  const { data: batchesData } = useQuery({
    queryKey: ["pharmacy-batches", expandedId],
    queryFn: () => pharmacyApi.getBatches(expandedId!),
    enabled: !!expandedId,
  });
  const batches: Array<Record<string, unknown>> = Array.isArray(batchesData) ? batchesData : (batchesData as Record<string, unknown>)?.items as Array<Record<string, unknown>> ?? [];

  const categoryOptions = [{ value: "", label: "Все категории" }, ...DRUG_CATEGORIES];
  const formOptions = [{ value: "", label: "Все формы" }, ...DRUG_FORMS];
  const statusOptions = [{ value: "", label: "Все статусы" }, ...INVENTORY_STATUSES];

  return (
    <>
      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4 animate-float-up" style={{ animationDelay: "200ms" }}>
        <InputField
          icon={searchIcon}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск препаратов..."
          className="flex-1 min-w-[200px] max-w-sm"
        />
        <CustomSelect value={category} onChange={setCategory} options={categoryOptions} placeholder="Все категории" className="w-48" />
        <CustomSelect value={form} onChange={setForm} options={formOptions} placeholder="Все формы" className="w-44" />
        <CustomSelect value={status} onChange={setStatus} options={statusOptions} placeholder="Все статусы" className="w-44" />
      </div>

      {/* Table */}
      <div className="bg-[var(--color-surface)] rounded-2xl border border-border overflow-hidden animate-float-up" style={{ animationDelay: "250ms" }}>
        {isLoading ? (
          <SkeletonRows />
        ) : items.length === 0 ? (
          <EmptyState message={debouncedSearch || category || form || status ? "Препараты не найдены" : "Склад пуст"} />
        ) : (
          <>
            {/* Header */}
            <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1fr] gap-2 px-4 py-2.5 border-b border-border bg-[var(--color-muted)]/30">
              <span className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Препарат</span>
              <span className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Форма</span>
              <span className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Категория</span>
              <span className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider text-right">Остаток</span>
              <span className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider text-right">Мин. порог</span>
              <span className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Ближ. срок</span>
              <span className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Статус</span>
            </div>

            <div className="divide-y divide-border">
              {items.map((item, idx) => {
                const id = String(item.id ?? item.drug_id ?? idx);
                const isExpanded = expandedId === id;
                return (
                  <div key={id}>
                    {/* Main row */}
                    <div
                      className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1fr] gap-2 px-4 py-3 hover:bg-[var(--color-muted)]/40 transition-colors cursor-pointer animate-float-up"
                      style={{ animationDelay: `${idx * 30}ms` }}
                      onClick={() => setExpandedId(isExpanded ? null : id)}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <ChevronDownIcon className={`w-4 h-4 text-[var(--color-text-tertiary)] transition-transform flex-shrink-0 ${isExpanded ? "rotate-180" : ""}`} />
                        <p className="text-sm font-semibold text-foreground truncate">{String(item.name ?? item.drug_name ?? "")}</p>
                      </div>
                      <p className="text-sm text-[var(--color-text-secondary)]">{item.form ? labelFor(DRUG_FORMS, String(item.form)) : "—"}</p>
                      <p className="text-sm text-[var(--color-text-secondary)]">{item.category ? labelFor(DRUG_CATEGORIES, String(item.category)) : "—"}</p>
                      <p className="text-sm text-foreground font-medium text-right">{item.total_quantity ?? item.quantity ?? "—"}</p>
                      <p className="text-sm text-[var(--color-text-tertiary)] text-right">{item.min_threshold ?? "—"}</p>
                      <p className="text-sm text-[var(--color-text-secondary)]">{formatDate(item.nearest_expiry as string | undefined)}</p>
                      <div>
                        <Badge variant={statusBadgeVariant(String(item.status ?? "ok"))} dot>
                          {statusLabel(String(item.status ?? "ok"))}
                        </Badge>
                      </div>
                    </div>

                    {/* Expanded batches */}
                    {isExpanded && (
                      <div className="bg-[var(--color-muted)]/20 px-4 py-3 border-t border-border">
                        <p className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-3">Партии</p>
                        {batches.length === 0 ? (
                          <p className="text-sm text-[var(--color-text-secondary)] py-2">Нет партий</p>
                        ) : (
                          <div className="space-y-2">
                            {/* Batch header */}
                            <div className="hidden md:grid grid-cols-[1fr_1fr_80px_80px_1fr_1fr_120px] gap-2 text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">
                              <span>Партия №</span>
                              <span>Поставщик</span>
                              <span className="text-right">Кол-во</span>
                              <span className="text-right">Цена</span>
                              <span>Дата получения</span>
                              <span>Срок годности</span>
                              <span>Действия</span>
                            </div>
                            {batches.map((batch, bi) => {
                              const batchId = String(batch.id ?? bi);
                              const batchQty = Number(batch.quantity ?? 0);
                              const isExpiredBatch = batch.expiry_date ? new Date(String(batch.expiry_date)) < new Date() : false;
                              return (
                                <div
                                  key={batchId}
                                  className={`grid grid-cols-1 md:grid-cols-[1fr_1fr_80px_80px_1fr_1fr_120px] gap-2 py-2 px-2 rounded-lg text-sm ${isExpiredBatch ? "bg-destructive/5" : "hover:bg-[var(--color-muted)]/40"} transition-colors`}
                                >
                                  <p className="text-foreground font-medium">{String(batch.batch_number ?? "—")}</p>
                                  <p className="text-[var(--color-text-secondary)]">{String(batch.supplier_name ?? batch.supplier ?? "—")}</p>
                                  <p className="text-foreground text-right">{batchQty}</p>
                                  <p className="text-[var(--color-text-secondary)] text-right">{batch.unit_price != null ? formatCurrency(Number(batch.unit_price)) : "—"}</p>
                                  <p className="text-[var(--color-text-secondary)]">{formatDate(batch.received_date as string | undefined)}</p>
                                  <p className={`${isExpiredBatch ? "text-destructive font-medium" : "text-[var(--color-text-secondary)]"}`}>
                                    {formatDate(batch.expiry_date as string | undefined)}
                                    {isExpiredBatch && " (просрочен)"}
                                  </p>
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); setWriteOffModal({ drugId: id, batchId, batchNumber: String(batch.batch_number ?? ""), maxQty: batchQty }); }}
                                      title="Списать"
                                      className="px-2 py-1 rounded-lg text-xs text-destructive hover:bg-destructive/10 transition-colors"
                                    >
                                      Списать
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); setAdjustModal({ drugId: id, batchId, batchNumber: String(batch.batch_number ?? ""), currentQty: batchQty }); }}
                                      title="Корректировка"
                                      className="px-2 py-1 rounded-lg text-xs text-secondary hover:bg-secondary/10 transition-colors"
                                    >
                                      Корр.
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Write-off modal */}
      {writeOffModal && (
        <WriteOffModal
          drugId={writeOffModal.drugId}
          batchId={writeOffModal.batchId}
          batchNumber={writeOffModal.batchNumber}
          maxQty={writeOffModal.maxQty}
          onClose={() => setWriteOffModal(null)}
        />
      )}

      {/* Adjust modal */}
      {adjustModal && (
        <AdjustModal
          drugId={adjustModal.drugId}
          batchId={adjustModal.batchId}
          batchNumber={adjustModal.batchNumber}
          currentQty={adjustModal.currentQty}
          onClose={() => setAdjustModal(null)}
        />
      )}
    </>
  );
}

// ── Write-off Modal ───────────────────────────────────────────────────────────

function WriteOffModal({ drugId, batchId, batchNumber, maxQty, onClose }: {
  drugId: string; batchId: string; batchNumber: string; maxQty: number; onClose: () => void;
}) {
  const qc = useQueryClient();
  const [quantity, setQuantity] = useState("1");
  const [reason, setReason] = useState("EXPIRED");

  const mutation = useMutation({
    mutationFn: () => pharmacyApi.writeOff(drugId, { batch_id: batchId, quantity: Number(quantity), reason }),
    onSuccess: () => {
      toast.success("Партия списана");
      qc.invalidateQueries({ queryKey: ["pharmacy-inventory"] });
      qc.invalidateQueries({ queryKey: ["pharmacy-batches", drugId] });
      qc.invalidateQueries({ queryKey: ["pharmacy-dashboard"] });
      onClose();
    },
    onError: () => toast.error("Ошибка при списании"),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const qty = Number(quantity);
    if (qty < 1 || qty > maxQty) {
      toast.error(`Количество должно быть от 1 до ${maxQty}`);
      return;
    }
    mutation.mutate();
  }

  return (
    <PharmacyModal title={`Списание — партия ${batchNumber}`} onClose={onClose} onSubmit={handleSubmit} isLoading={mutation.isPending} submitLabel="Списать">
      <InputField
        label="Количество"
        type="number"
        min="1"
        max={String(maxQty)}
        required
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
      />
      <p className="text-xs text-[var(--color-text-tertiary)]">Максимум: {maxQty} шт.</p>
      <CustomSelect
        label="Причина списания"
        value={reason}
        onChange={setReason}
        options={WRITEOFF_REASONS}
        placeholder="Выберите причину"
      />
    </PharmacyModal>
  );
}

// ── Adjust Modal ──────────────────────────────────────────────────────────────

function AdjustModal({ drugId, batchId, batchNumber, currentQty, onClose }: {
  drugId: string; batchId: string; batchNumber: string; currentQty: number; onClose: () => void;
}) {
  const qc = useQueryClient();
  const [newQuantity, setNewQuantity] = useState(String(currentQty));
  const [reason, setReason] = useState("");

  const mutation = useMutation({
    mutationFn: () => pharmacyApi.adjust(drugId, { batch_id: batchId, new_quantity: Number(newQuantity), reason }),
    onSuccess: () => {
      toast.success("Количество скорректировано");
      qc.invalidateQueries({ queryKey: ["pharmacy-inventory"] });
      qc.invalidateQueries({ queryKey: ["pharmacy-batches", drugId] });
      qc.invalidateQueries({ queryKey: ["pharmacy-dashboard"] });
      onClose();
    },
    onError: () => toast.error("Ошибка корректировки"),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim()) {
      toast.error("Укажите причину корректировки");
      return;
    }
    mutation.mutate();
  }

  return (
    <PharmacyModal title={`Корректировка — партия ${batchNumber}`} onClose={onClose} onSubmit={handleSubmit} isLoading={mutation.isPending} submitLabel="Корректировка">
      <p className="text-sm text-[var(--color-text-secondary)]">Текущее количество: <span className="font-bold text-foreground">{currentQty}</span></p>
      <InputField
        label="Новое количество"
        type="number"
        min="0"
        required
        value={newQuantity}
        onChange={(e) => setNewQuantity(e.target.value)}
      />
      <TextareaField
        label="Причина корректировки"
        required
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={2}
        placeholder="Укажите причину..."
      />
    </PharmacyModal>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB: DISPENSING
// ══════════════════════════════════════════════════════════════════════════════

function DispensingTab() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [dispenseModal, setDispenseModal] = useState<string | null>(null);

  const debouncedSearch = useDebounce(search, 300);

  const { data, isLoading } = useQuery({
    queryKey: ["pharmacy-prescriptions", debouncedSearch, dateFilter],
    queryFn: () =>
      pharmacyApi.getPrescriptions({
        search: debouncedSearch || undefined,
        date_filter: dateFilter || undefined,
        status: "ACTIVE",
      }),
  });

  const prescriptions: Array<Record<string, unknown>> = (data as Record<string, unknown>)?.items as Array<Record<string, unknown>> ?? (Array.isArray(data) ? data : []);

  return (
    <>
      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4 animate-float-up" style={{ animationDelay: "200ms" }}>
        <InputField
          icon={searchIcon}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск по пациенту..."
          className="flex-1 min-w-[200px] max-w-sm"
        />
        <CustomSelect
          value={dateFilter}
          onChange={setDateFilter}
          options={DATE_FILTER_OPTIONS}
          placeholder="Все"
          className="w-36"
        />
      </div>

      {/* Table */}
      <div className="bg-[var(--color-surface)] rounded-2xl border border-border overflow-hidden animate-float-up" style={{ animationDelay: "250ms" }}>
        {isLoading ? (
          <SkeletonRows />
        ) : prescriptions.length === 0 ? (
          <EmptyState message={debouncedSearch ? "Рецепты не найдены" : "Нет активных рецептов к выдаче"} />
        ) : (
          <>
            {/* Header */}
            <div className="hidden md:grid grid-cols-[2fr_1.5fr_1fr_80px_100px] gap-2 px-4 py-2.5 border-b border-border bg-[var(--color-muted)]/30">
              <span className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Пациент</span>
              <span className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Врач</span>
              <span className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Дата назначения</span>
              <span className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider text-center">Позиций</span>
              <span className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider text-center">Выдать</span>
            </div>
            <div className="divide-y divide-border">
              {prescriptions.map((rx, idx) => (
                <div
                  key={String(rx.id ?? idx)}
                  className="grid grid-cols-1 md:grid-cols-[2fr_1.5fr_1fr_80px_100px] gap-2 px-4 py-3 hover:bg-[var(--color-muted)]/40 transition-colors animate-float-up"
                  style={{ animationDelay: `${idx * 30}ms` }}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{String(rx.patient_name ?? "—")}</p>
                    {rx.patient_iin && <p className="text-xs text-[var(--color-text-tertiary)]">ИИН: {String(rx.patient_iin)}</p>}
                  </div>
                  <p className="text-sm text-[var(--color-text-secondary)] truncate">{String(rx.doctor_name ?? "—")}</p>
                  <p className="text-sm text-[var(--color-text-secondary)]">{formatDate(rx.prescribed_at as string | undefined ?? rx.created_at as string | undefined)}</p>
                  <p className="text-sm text-foreground text-center font-medium">{String(rx.items_count ?? (rx.items as Array<unknown>)?.length ?? "—")}</p>
                  <div className="flex justify-center">
                    <Button
                      size="sm"
                      onClick={() => setDispenseModal(String(rx.id))}
                    >
                      Выдать
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Dispense modal */}
      {dispenseModal && (
        <DispenseModal prescriptionId={dispenseModal} onClose={() => setDispenseModal(null)} />
      )}
    </>
  );
}

// ── Dispense Modal ────────────────────────────────────────────────────────────

function DispenseModal({ prescriptionId, onClose }: { prescriptionId: string; onClose: () => void }) {
  const qc = useQueryClient();

  const { data: rxData, isLoading } = useQuery({
    queryKey: ["pharmacy-prescription", prescriptionId],
    queryFn: () => pharmacyApi.getPrescription(prescriptionId),
  });

  const rx = rxData as Record<string, unknown> | undefined;
  const rxItems = (rx?.items as Array<Record<string, unknown>>) ?? [];

  const [selections, setSelections] = useState<Record<string, { batch_id: string; quantity: number }>>({});

  // Initialize selections from rx items when data loads
  useEffect(() => {
    if (rxItems.length > 0 && Object.keys(selections).length === 0) {
      const initial: Record<string, { batch_id: string; quantity: number }> = {};
      rxItems.forEach((item) => {
        const itemId = String(item.id);
        const autoSelectedBatch = item.auto_batch_id ?? item.recommended_batch_id ?? "";
        initial[itemId] = {
          batch_id: String(autoSelectedBatch),
          quantity: Number(item.quantity ?? item.qty_to_dispense ?? 1),
        };
      });
      setSelections(initial);
    }
  }, [rxItems]);

  const dispenseMut = useMutation({
    mutationFn: () => {
      const items = Object.entries(selections).map(([item_id, sel]) => ({
        item_id,
        batch_id: sel.batch_id,
        quantity: sel.quantity,
      }));
      return pharmacyApi.dispense(prescriptionId, { items });
    },
    onSuccess: () => {
      toast.success("Лекарства выданы");
      qc.invalidateQueries({ queryKey: ["pharmacy-prescriptions"] });
      qc.invalidateQueries({ queryKey: ["pharmacy-inventory"] });
      qc.invalidateQueries({ queryKey: ["pharmacy-dashboard"] });
      onClose();
    },
    onError: () => toast.error("Ошибка выдачи"),
  });

  function handleDispense() {
    dispenseMut.mutate();
  }

  return (
    <PharmacyModal title="Выдача лекарств" onClose={onClose} maxWidth="max-w-2xl">
      {isLoading ? (
        <SkeletonRows count={3} />
      ) : rxItems.length === 0 ? (
        <p className="text-sm text-[var(--color-text-secondary)]">Нет позиций для выдачи</p>
      ) : (
        <>
          <div className="mb-2">
            <p className="text-sm text-[var(--color-text-secondary)]">
              Пациент: <span className="font-medium text-foreground">{String(rx?.patient_name ?? "—")}</span>
            </p>
            <p className="text-sm text-[var(--color-text-secondary)]">
              Врач: <span className="font-medium text-foreground">{String(rx?.doctor_name ?? "—")}</span>
            </p>
          </div>

          <div className="space-y-3">
            {rxItems.map((item) => {
              const itemId = String(item.id);
              const drugName = String(item.drug_name ?? (item.drug as Record<string, unknown>)?.name ?? "—");
              const dosage = String(item.dosage ?? "");
              const qtyNeeded = Number(item.quantity ?? item.qty_to_dispense ?? 1);
              const availableStock = Number(item.available_stock ?? item.stock ?? 0);
              const insufficient = availableStock < qtyNeeded;
              const batchLabel = item.auto_batch_number ?? item.recommended_batch_number ?? "—";

              return (
                <div key={itemId} className={`p-3 rounded-xl border ${insufficient ? "border-destructive/30 bg-destructive/5" : "border-border"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">{drugName}</p>
                      {dosage && <p className="text-xs text-[var(--color-text-tertiary)]">{dosage}</p>}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm text-foreground">
                        К выдаче: <span className="font-bold">{qtyNeeded}</span>
                      </p>
                      <p className={`text-xs ${insufficient ? "text-destructive font-medium" : "text-[var(--color-text-tertiary)]"}`}>
                        {insufficient ? "Недостаточно" : `На складе: ${availableStock}`}
                      </p>
                    </div>
                  </div>
                  {!insufficient && (
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-xs text-[var(--color-text-tertiary)]">Партия (ближ. срок):</span>
                      <span className="text-xs font-medium text-foreground">{String(batchLabel)}</span>
                      {item.auto_batch_expiry && (
                        <span className="text-xs text-[var(--color-text-tertiary)]">до {formatDate(String(item.auto_batch_expiry))}</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button type="button" variant="outline" onClick={onClose}>
              Отмена
            </Button>
            <Button onClick={handleDispense} loading={dispenseMut.isPending}>
              Выдать
            </Button>
          </div>
        </>
      )}
    </PharmacyModal>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB: ORDERS
// ══════════════════════════════════════════════════════════════════════════════

function OrdersTab() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [receiveModal, setReceiveModal] = useState<string | null>(null);
  const [editOrder, setEditOrder] = useState<Record<string, unknown> | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["pharmacy-orders", statusFilter],
    queryFn: () => pharmacyApi.getOrders({ status: statusFilter || undefined }),
  });

  const orders: Array<Record<string, unknown>> = (data as Record<string, unknown>)?.items as Array<Record<string, unknown>> ?? (Array.isArray(data) ? data : []);

  const submitMut = useMutation({
    mutationFn: (id: string) => pharmacyApi.submitOrder(id),
    onSuccess: () => { toast.success("Заказ отправлен"); qc.invalidateQueries({ queryKey: ["pharmacy-orders"] }); },
    onError: () => toast.error("Ошибка отправки заказа"),
  });

  const cancelMut = useMutation({
    mutationFn: (id: string) => pharmacyApi.cancelOrder(id),
    onSuccess: () => { toast.success("Заказ отменён"); qc.invalidateQueries({ queryKey: ["pharmacy-orders"] }); },
    onError: () => toast.error("Ошибка отмены"),
  });

  function handleCancel(id: string) {
    if (!window.confirm("Отменить заказ? Это действие необратимо.")) return;
    cancelMut.mutate(id);
  }

  return (
    <>
      {/* Status filter tabs */}
      <div className="flex flex-wrap gap-3 mb-4 animate-float-up" style={{ animationDelay: "200ms" }}>
        <div className="flex gap-1 p-1 bg-[var(--color-muted)] rounded-xl">
          {ORDER_STATUSES.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => setStatusFilter(s.value)}
              className={`py-1.5 px-3 rounded-lg text-sm font-medium transition-all ${
                statusFilter === s.value
                  ? "bg-[var(--color-surface)] text-foreground shadow-sm"
                  : "text-[var(--color-text-secondary)] hover:text-foreground"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <Button icon={<PlusIcon />} onClick={() => { setEditOrder(null); setCreateOpen(true); }}>
          Создать заказ
        </Button>
      </div>

      {/* Table */}
      <div className="bg-[var(--color-surface)] rounded-2xl border border-border overflow-hidden animate-float-up" style={{ animationDelay: "250ms" }}>
        {isLoading ? (
          <SkeletonRows />
        ) : orders.length === 0 ? (
          <EmptyState message={statusFilter ? "Заказы не найдены" : "Нет заказов"} />
        ) : (
          <>
            {/* Header */}
            <div className="hidden md:grid grid-cols-[80px_1.5fr_1fr_1fr_120px_1fr] gap-2 px-4 py-2.5 border-b border-border bg-[var(--color-muted)]/30">
              <span className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">№</span>
              <span className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Поставщик</span>
              <span className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Дата</span>
              <span className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider text-right">Сумма</span>
              <span className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Статус</span>
              <span className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider text-right">Действия</span>
            </div>
            <div className="divide-y divide-border">
              {orders.map((order, idx) => {
                const id = String(order.id ?? idx);
                const st = String(order.status ?? "DRAFT");
                const meta = ORDER_STATUS_META[st] ?? ORDER_STATUS_META.DRAFT;
                return (
                  <div
                    key={id}
                    className="grid grid-cols-1 md:grid-cols-[80px_1.5fr_1fr_1fr_120px_1fr] gap-2 px-4 py-3 hover:bg-[var(--color-muted)]/40 transition-colors animate-float-up"
                    style={{ animationDelay: `${idx * 30}ms` }}
                  >
                    <p className="text-sm font-mono text-foreground">{String(order.order_number ?? order.number ?? id.slice(0, 8))}</p>
                    <p className="text-sm text-foreground truncate">{String(order.supplier_name ?? "—")}</p>
                    <p className="text-sm text-[var(--color-text-secondary)]">{formatDate(order.created_at as string | undefined)}</p>
                    <p className="text-sm text-foreground font-medium text-right">{formatCurrency(order.total_amount != null ? Number(order.total_amount) : null)}</p>
                    <div>
                      <Badge variant={meta.variant}>{meta.label}</Badge>
                    </div>
                    <div className="flex items-center justify-end gap-1">
                      {st === "DRAFT" && (
                        <>
                          <button
                            type="button"
                            onClick={() => { setEditOrder(order); setCreateOpen(true); }}
                            className="p-1.5 rounded-lg text-[var(--color-text-tertiary)] hover:text-foreground hover:bg-[var(--color-muted)] transition-colors"
                            title="Редактировать"
                          >
                            <EditIcon />
                          </button>
                          <Button size="sm" variant="outline" onClick={() => submitMut.mutate(id)} loading={submitMut.isPending}>
                            Отправить
                          </Button>
                          <button
                            type="button"
                            onClick={() => handleCancel(id)}
                            className="p-1.5 rounded-lg text-[var(--color-text-tertiary)] hover:text-destructive hover:bg-destructive/10 transition-colors"
                            title="Отменить"
                          >
                            <TrashIcon />
                          </button>
                        </>
                      )}
                      {st === "SUBMITTED" && (
                        <Button size="sm" onClick={() => setReceiveModal(id)}>
                          Принять поставку
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Create / Edit order modal */}
      {createOpen && (
        <CreateOrderModal editing={editOrder} onClose={() => { setCreateOpen(false); setEditOrder(null); }} />
      )}

      {/* Receive order modal */}
      {receiveModal && (
        <ReceiveOrderModal orderId={receiveModal} onClose={() => setReceiveModal(null)} />
      )}
    </>
  );
}

// ── Create Order Modal ────────────────────────────────────────────────────────

type OrderItemForm = {
  drug_name: string;
  drug_id: string;
  quantity: string;
  unit_price: string;
};

function CreateOrderModal({ editing, onClose }: { editing: Record<string, unknown> | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [supplierId, setSupplierId] = useState(editing ? String(editing.supplier_id ?? "") : "");
  const [notes, setNotes] = useState(editing ? String(editing.notes ?? "") : "");
  const [items, setItems] = useState<OrderItemForm[]>(
    editing && Array.isArray(editing.items)
      ? (editing.items as Array<Record<string, unknown>>).map((it) => ({
          drug_name: String(it.drug_name ?? ""),
          drug_id: String(it.drug_id ?? ""),
          quantity: String(it.quantity ?? "1"),
          unit_price: String(it.unit_price ?? "0"),
        }))
      : [{ drug_name: "", drug_id: "", quantity: "1", unit_price: "0" }],
  );

  // Fetch suppliers for dropdown
  const { data: suppliersData } = useQuery({
    queryKey: ["pharmacy-suppliers-list"],
    queryFn: () => pharmacyApi.getSuppliers({ limit: 100 }),
  });
  const suppliers: Array<Record<string, unknown>> = (suppliersData as Record<string, unknown>)?.items as Array<Record<string, unknown>> ?? (Array.isArray(suppliersData) ? suppliersData : []);
  const supplierOptions = suppliers.map((s) => ({ value: String(s.id), label: String(s.name) }));

  const createMut = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      editing ? pharmacyApi.updateOrder(String(editing.id), data) : pharmacyApi.createOrder(data),
    onSuccess: () => {
      toast.success(editing ? "Заказ обновлён" : "Заказ создан");
      qc.invalidateQueries({ queryKey: ["pharmacy-orders"] });
      onClose();
    },
    onError: () => toast.error("Ошибка"),
  });

  function addItem() {
    setItems((prev) => [...prev, { drug_name: "", drug_id: "", quantity: "1", unit_price: "0" }]);
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateItem(idx: number, field: keyof OrderItemForm, value: string) {
    setItems((prev) => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      supplier_id: supplierId,
      notes: notes || undefined,
      items: items.map((it) => ({
        drug_id: it.drug_id || undefined,
        drug_name: it.drug_name,
        quantity: Number(it.quantity),
        unit_price: Number(it.unit_price),
      })),
    };
    createMut.mutate(payload);
  }

  const totalAmount = items.reduce((sum, it) => sum + Number(it.quantity) * Number(it.unit_price), 0);

  return (
    <PharmacyModal
      title={editing ? "Редактировать заказ" : "Новый заказ"}
      onClose={onClose}
      onSubmit={handleSubmit}
      isLoading={createMut.isPending}
      submitLabel={editing ? "Сохранить" : "Создать"}
      maxWidth="max-w-2xl"
    >
      <CustomSelect
        label="Поставщик"
        value={supplierId}
        onChange={setSupplierId}
        options={supplierOptions}
        placeholder="Выберите поставщика"
      />

      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-foreground">Позиции</p>
          <button type="button" onClick={addItem} className="flex items-center gap-1 text-xs text-secondary hover:text-secondary/80 transition-colors">
            <PlusIcon className="w-3 h-3" /> Добавить
          </button>
        </div>
        <div className="space-y-3">
          {items.map((item, idx) => (
            <div key={idx} className="flex gap-2 items-start p-3 rounded-xl bg-[var(--color-muted)]/30 border border-border">
              <div className="flex-1 space-y-2">
                <InputField
                  label="Препарат"
                  value={item.drug_name}
                  onChange={(e) => updateItem(idx, "drug_name", e.target.value)}
                  placeholder="Название препарата"
                />
                <div className="grid grid-cols-2 gap-2">
                  <InputField
                    label="Кол-во"
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => updateItem(idx, "quantity", e.target.value)}
                  />
                  <InputField
                    label="Цена за ед."
                    type="number"
                    min="0"
                    value={item.unit_price}
                    onChange={(e) => updateItem(idx, "unit_price", e.target.value)}
                  />
                </div>
              </div>
              {items.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeItem(idx)}
                  className="p-1.5 rounded-lg text-[var(--color-text-tertiary)] hover:text-destructive hover:bg-destructive/10 transition-colors mt-6"
                >
                  <TrashIcon />
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="mt-3 text-right">
          <p className="text-sm text-[var(--color-text-secondary)]">Итого: <span className="font-bold text-foreground">{formatCurrency(totalAmount)}</span></p>
        </div>
      </div>

      <TextareaField
        label="Примечания"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
        placeholder="Дополнительные комментарии..."
      />
    </PharmacyModal>
  );
}

// ── Receive Order Modal ───────────────────────────────────────────────────────

function ReceiveOrderModal({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const qc = useQueryClient();

  const { data: orderData, isLoading } = useQuery({
    queryKey: ["pharmacy-order", orderId],
    queryFn: () => pharmacyApi.getOrder(orderId),
  });

  const order = orderData as Record<string, unknown> | undefined;
  const orderItems = (order?.items as Array<Record<string, unknown>>) ?? [];

  const [receiveItems, setReceiveItems] = useState<Array<{
    item_id: string;
    actual_quantity: string;
    batch_number: string;
    expiry_date: string;
  }>>([]);

  // Initialize receive items when order data loads
  useEffect(() => {
    if (orderItems.length > 0 && receiveItems.length === 0) {
      setReceiveItems(
        orderItems.map((item) => ({
          item_id: String(item.id),
          actual_quantity: String(item.quantity ?? ""),
          batch_number: "",
          expiry_date: "",
        })),
      );
    }
  }, [orderItems]);

  const receiveMut = useMutation({
    mutationFn: () => {
      const items = receiveItems.map((ri) => ({
        item_id: ri.item_id,
        actual_quantity: Number(ri.actual_quantity),
        batch_number: ri.batch_number,
        expiry_date: ri.expiry_date,
      }));
      return pharmacyApi.receiveOrder(orderId, { items });
    },
    onSuccess: () => {
      toast.success("Поставка принята");
      qc.invalidateQueries({ queryKey: ["pharmacy-orders"] });
      qc.invalidateQueries({ queryKey: ["pharmacy-inventory"] });
      qc.invalidateQueries({ queryKey: ["pharmacy-dashboard"] });
      onClose();
    },
    onError: () => toast.error("Ошибка приёмки"),
  });

  function updateReceiveItem(idx: number, field: string, value: string) {
    setReceiveItems((prev) => prev.map((ri, i) => i === idx ? { ...ri, [field]: value } : ri));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    receiveMut.mutate();
  }

  return (
    <PharmacyModal title="Приём поставки" onClose={onClose} onSubmit={handleSubmit} isLoading={receiveMut.isPending} submitLabel="Принять поставку" maxWidth="max-w-3xl">
      {isLoading ? (
        <SkeletonRows count={3} />
      ) : orderItems.length === 0 ? (
        <p className="text-sm text-[var(--color-text-secondary)]">Нет позиций</p>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-[var(--color-text-secondary)]">
            Поставщик: <span className="font-medium text-foreground">{String(order?.supplier_name ?? "—")}</span>
          </p>
          {orderItems.map((item, idx) => (
            <div key={String(item.id ?? idx)} className="p-3 rounded-xl border border-border space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">{String(item.drug_name ?? "—")}</p>
                <p className="text-xs text-[var(--color-text-tertiary)]">Заказано: {String(item.quantity ?? "—")}</p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <InputField
                  label="Факт. кол-во"
                  type="number"
                  min="0"
                  value={receiveItems[idx]?.actual_quantity ?? ""}
                  onChange={(e) => updateReceiveItem(idx, "actual_quantity", e.target.value)}
                />
                <InputField
                  label="Номер партии"
                  value={receiveItems[idx]?.batch_number ?? ""}
                  onChange={(e) => updateReceiveItem(idx, "batch_number", e.target.value)}
                  placeholder="BATCH-001"
                />
                <InputField
                  label="Срок годности"
                  type="date"
                  value={receiveItems[idx]?.expiry_date ?? ""}
                  onChange={(e) => updateReceiveItem(idx, "expiry_date", e.target.value)}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </PharmacyModal>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB: SUPPLIERS
// ══════════════════════════════════════════════════════════════════════════════

type SupplierForm = {
  name: string;
  contact_person: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
};

const EMPTY_SUPPLIER: SupplierForm = {
  name: "",
  contact_person: "",
  phone: "",
  email: "",
  address: "",
  notes: "",
};

function SuppliersTab() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [form, setForm] = useState<SupplierForm>(EMPTY_SUPPLIER);

  const debouncedSearch = useDebounce(search, 300);

  const { data, isLoading } = useQuery({
    queryKey: ["pharmacy-suppliers", debouncedSearch],
    queryFn: () => pharmacyApi.getSuppliers({ search: debouncedSearch || undefined }),
  });

  const suppliers: Array<Record<string, unknown>> = (data as Record<string, unknown>)?.items as Array<Record<string, unknown>> ?? (Array.isArray(data) ? data : []);

  const createMut = useMutation({
    mutationFn: pharmacyApi.createSupplier,
    onSuccess: () => { toast.success("Поставщик создан"); qc.invalidateQueries({ queryKey: ["pharmacy-suppliers"] }); closeModal(); },
    onError: () => toast.error("Ошибка создания"),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => pharmacyApi.updateSupplier(id, data),
    onSuccess: () => { toast.success("Поставщик обновлён"); qc.invalidateQueries({ queryKey: ["pharmacy-suppliers"] }); closeModal(); },
    onError: () => toast.error("Ошибка обновления"),
  });

  const deleteMut = useMutation({
    mutationFn: pharmacyApi.deleteSupplier,
    onSuccess: () => { toast.success("Поставщик удалён"); qc.invalidateQueries({ queryKey: ["pharmacy-suppliers"] }); },
    onError: () => toast.error("Ошибка удаления"),
  });

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_SUPPLIER);
    setModalOpen(true);
  }

  function openEdit(item: Record<string, unknown>) {
    setEditing(item);
    setForm({
      name: String(item.name ?? ""),
      contact_person: String(item.contact_person ?? ""),
      phone: String(item.phone ?? ""),
      email: String(item.email ?? ""),
      address: String(item.address ?? ""),
      notes: String(item.notes ?? ""),
    });
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: Record<string, unknown> = {
      name: form.name,
      contact_person: form.contact_person || undefined,
      phone: form.phone || undefined,
      email: form.email || undefined,
      address: form.address || undefined,
      notes: form.notes || undefined,
    };
    if (editing) {
      updateMut.mutate({ id: String(editing.id), data: payload });
    } else {
      createMut.mutate(payload);
    }
  }

  function handleDelete(id: string, hasOrders: boolean) {
    if (hasOrders) {
      toast.error("Невозможно удалить поставщика с заказами");
      return;
    }
    if (!window.confirm("Удалить поставщика? Это действие необратимо.")) return;
    deleteMut.mutate(id);
  }

  const isSubmitting = createMut.isPending || updateMut.isPending;

  return (
    <>
      {/* Controls */}
      <div className="flex flex-wrap gap-3 mb-4 animate-float-up" style={{ animationDelay: "200ms" }}>
        <InputField
          icon={searchIcon}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск поставщиков..."
          className="flex-1 min-w-[200px] max-w-sm"
        />
        <Button icon={<PlusIcon />} onClick={openCreate}>
          Добавить
        </Button>
      </div>

      {/* Table */}
      <div className="bg-[var(--color-surface)] rounded-2xl border border-border overflow-hidden animate-float-up" style={{ animationDelay: "250ms" }}>
        {isLoading ? (
          <SkeletonRows />
        ) : suppliers.length === 0 ? (
          <EmptyState message={debouncedSearch ? "Поставщики не найдены" : "Нет поставщиков"} />
        ) : (
          <>
            {/* Header */}
            <div className="hidden md:grid grid-cols-[2fr_1.5fr_1fr_1.5fr_80px_100px] gap-2 px-4 py-2.5 border-b border-border bg-[var(--color-muted)]/30">
              <span className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Название</span>
              <span className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Контакт</span>
              <span className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Телефон</span>
              <span className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Email</span>
              <span className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider text-center">Заказов</span>
              <span className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider text-right">Действия</span>
            </div>
            <div className="divide-y divide-border">
              {suppliers.map((item, idx) => {
                const id = String(item.id ?? idx);
                const ordersCount = Number(item.orders_count ?? 0);
                return (
                  <div
                    key={id}
                    className="grid grid-cols-1 md:grid-cols-[2fr_1.5fr_1fr_1.5fr_80px_100px] gap-2 px-4 py-3 hover:bg-[var(--color-muted)]/40 transition-colors animate-float-up"
                    style={{ animationDelay: `${idx * 30}ms` }}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{String(item.name ?? "—")}</p>
                      {item.address && <p className="text-xs text-[var(--color-text-tertiary)] truncate">{String(item.address)}</p>}
                    </div>
                    <p className="text-sm text-[var(--color-text-secondary)] truncate">{String(item.contact_person ?? "—")}</p>
                    <p className="text-sm text-[var(--color-text-secondary)]">{String(item.phone ?? "—")}</p>
                    <p className="text-sm text-[var(--color-text-secondary)] truncate">{String(item.email ?? "—")}</p>
                    <p className="text-sm text-foreground text-center">{ordersCount}</p>
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(item)}
                        title="Редактировать"
                        className="p-1.5 rounded-lg text-[var(--color-text-tertiary)] hover:text-foreground hover:bg-[var(--color-muted)] transition-colors"
                      >
                        <EditIcon />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(id, ordersCount > 0)}
                        disabled={deleteMut.isPending}
                        title={ordersCount > 0 ? "Нельзя удалить (есть заказы)" : "Удалить"}
                        className={`p-1.5 rounded-lg transition-colors disabled:opacity-40 ${
                          ordersCount > 0
                            ? "text-[var(--color-text-tertiary)] opacity-40 cursor-not-allowed"
                            : "text-[var(--color-text-tertiary)] hover:text-destructive hover:bg-destructive/10"
                        }`}
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Modal */}
      {modalOpen && (
        <PharmacyModal
          title={editing ? "Редактировать поставщика" : "Новый поставщик"}
          onClose={closeModal}
          onSubmit={handleSubmit}
          isLoading={isSubmitting}
          submitLabel={editing ? "Сохранить" : "Создать"}
        >
          <InputField
            label="Название"
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="ООО «Фармасервис»"
          />
          <InputField
            label="Контактное лицо"
            value={form.contact_person}
            onChange={(e) => setForm((f) => ({ ...f, contact_person: e.target.value }))}
            placeholder="Иванов Иван Иванович"
          />
          <div className="grid grid-cols-2 gap-4">
            <InputField
              label="Телефон"
              type="tel"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              placeholder="+7 (700) 123-45-67"
            />
            <InputField
              label="Email"
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="info@supplier.kz"
            />
          </div>
          <InputField
            label="Адрес"
            value={form.address}
            onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            placeholder="г. Бишкек, ул. Примерная, д. 1"
          />
          <TextareaField
            label="Примечания"
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            rows={2}
            placeholder="Дополнительная информация..."
          />
        </PharmacyModal>
      )}
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════════════════

function PharmacyPage() {
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");

  return (
    <div className="max-w-7xl">
      {/* Page header */}
      <div className="mb-6 animate-float-up">
        <h1 className="text-[26px] font-bold text-foreground tracking-tight">Аптека</h1>
        <p className="text-[var(--color-text-secondary)] text-sm mt-1">
          Управление складом, выдача лекарств, закупки и поставщики
        </p>
      </div>

      {/* Tab bar */}
      <div
        className="flex gap-1 bg-[var(--color-surface)] rounded-xl border border-border p-1 mb-6 animate-float-up"
        style={{ animationDelay: "150ms" }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all duration-200 ${
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
      {activeTab === "dashboard" && <DashboardTab />}
      {activeTab === "inventory" && <InventoryTab />}
      {activeTab === "dispensing" && <DispensingTab />}
      {activeTab === "orders" && <OrdersTab />}
      {activeTab === "suppliers" && <SuppliersTab />}
    </div>
  );
}

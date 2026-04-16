import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { laboratoryApi } from "@/features/laboratory/api";
import { Button } from "@/components/ui/button";
import { InputField } from "@/components/ui/input-field";
import { TextareaField } from "@/components/ui/textarea-field";
import { CustomSelect } from "@/components/ui/select-custom";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/laboratory")({
  component: LaboratoryPage,
});

// ── Constants ──────────────────────────────────────────────────────────────────

const TABS = [
  { id: "orders", label: "Заказы" },
  { id: "results", label: "Результаты" },
  { id: "catalog", label: "Каталог" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const ORDER_STATUSES = [
  { value: "", label: "Все" },
  { value: "ORDERED", label: "Назначен" },
  { value: "SAMPLE_COLLECTED", label: "Сбор" },
  { value: "IN_PROGRESS", label: "В работе" },
  { value: "COMPLETED", label: "Завершён" },
  { value: "CANCELLED", label: "Отменён" },
];

const ORDER_STATUS_META: Record<string, { label: string; variant: "primary" | "secondary" | "warning" | "success" | "destructive" | "muted" }> = {
  ORDERED: { label: "Назначен", variant: "primary" },
  SAMPLE_COLLECTED: { label: "Сбор", variant: "secondary" },
  IN_PROGRESS: { label: "В работе", variant: "warning" },
  COMPLETED: { label: "Завершён", variant: "success" },
  CANCELLED: { label: "Отменён", variant: "muted" },
};

const PRIORITY_OPTIONS = [
  { value: "", label: "Все" },
  { value: "ROUTINE", label: "Обычный" },
  { value: "URGENT", label: "Срочный" },
  { value: "STAT", label: "STAT" },
];

const PRIORITY_META: Record<string, { label: string; variant: "muted" | "warning" | "destructive" }> = {
  ROUTINE: { label: "Обычный", variant: "muted" },
  URGENT: { label: "Срочный", variant: "warning" },
  STAT: { label: "STAT", variant: "destructive" },
};

const STATUS_TRANSITIONS: Record<string, string[]> = {
  ORDERED: ["SAMPLE_COLLECTED", "CANCELLED"],
  SAMPLE_COLLECTED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

const SAMPLE_TYPES = [
  { value: "BLOOD", label: "Кровь" },
  { value: "URINE", label: "Моча" },
  { value: "SALIVA", label: "Слюна" },
  { value: "STOOL", label: "Кал" },
  { value: "SWAB", label: "Мазок" },
  { value: "CSF", label: "СМЖ" },
  { value: "OTHER", label: "Другое" },
];

const TEST_CATEGORIES = [
  { value: "", label: "Все категории" },
  { value: "HEMATOLOGY", label: "Гематология" },
  { value: "BIOCHEMISTRY", label: "Биохимия" },
  { value: "IMMUNOLOGY", label: "Иммунология" },
  { value: "MICROBIOLOGY", label: "Микробиология" },
  { value: "URINALYSIS", label: "Анализ мочи" },
  { value: "COAGULATION", label: "Коагулограмма" },
  { value: "HORMONES", label: "Гормоны" },
  { value: "OTHER", label: "Другое" },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function formatDate(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ru-RU");
}

function formatDateTime(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatPrice(v: number | null | undefined): string {
  if (v == null) return "—";
  return new Intl.NumberFormat("ru-RU").format(v) + " сом";
}

function labelFor(map: { value: string; label: string }[], val: string): string {
  return map.find((m) => m.value === val)?.label ?? val;
}

// ── SVG Icons ─────────────────────────────────────────────────────────────────

const searchIcon = (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </svg>
);

function FlaskIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2v6a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V2" />
      <path d="M10 2v3.3a4 4 0 0 1-1.17 2.83L4 13v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6l-4.83-4.87A4 4 0 0 1 14 5.3V2" />
    </svg>
  );
}

function ClipboardIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="M12 11h4" /><path d="M12 16h4" /><path d="M8 11h.01" /><path d="M8 16h.01" />
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

function CheckCircleIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><path d="m9 11 3 3L22 4" />
    </svg>
  );
}

function AlertIcon({ className = "w-5 h-5" }: { className?: string }) {
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

function EditIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z" />
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

// ── Generic Modal ──────────────────────────────────────────────────────────────

function LabModal({ title, onClose, onSubmit, isLoading, children, submitLabel = "Сохранить", maxWidth = "max-w-lg" }: {
  title: string;
  onClose: () => void;
  onSubmit?: (e: React.FormEvent) => void;
  isLoading?: boolean;
  children: React.ReactNode;
  submitLabel?: string;
  maxWidth?: string;
}) {
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
        <FlaskIcon className="w-12 h-12 mx-auto mb-3 text-[var(--color-text-tertiary)]" />
      )}
      <p className="text-[var(--color-text-secondary)] text-sm">{message}</p>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════════════════

function LaboratoryPage() {
  const [activeTab, setActiveTab] = useState<TabId>("orders");

  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ["lab-stats"],
    queryFn: laboratoryApi.getStats,
    staleTime: 30 * 1000,
  });

  const stats = statsData as Record<string, unknown> | undefined;

  const kpiItems = [
    { label: "Всего заказов", value: stats?.total_orders ?? "—", color: "text-secondary", icon: <ClipboardIcon className="w-6 h-6" /> },
    { label: "В ожидании", value: stats?.pending_orders ?? "—", color: "text-primary", icon: <ClockIcon className="w-6 h-6" /> },
    { label: "В работе", value: stats?.in_progress_orders ?? "—", color: "text-warning", icon: <FlaskIcon className="w-6 h-6" /> },
    { label: "Выполнено сегодня", value: stats?.completed_today ?? "—", color: "text-success", icon: <CheckCircleIcon className="w-6 h-6" /> },
  ];

  const urgentCount = Number(stats?.urgent_count ?? 0);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Лаборатория</h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">Управление анализами, заказами и результатами</p>
        </div>
        {urgentCount > 0 && (
          <Badge variant="destructive" className="text-sm px-3 py-1.5">
            <AlertIcon className="w-4 h-4 mr-1.5" />
            Срочные: {urgentCount}
          </Badge>
        )}
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {statsLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 bg-[var(--color-muted)] rounded-2xl animate-pulse" />
            ))
          : kpiItems.map((item, i) => (
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

      {/* Tabs */}
      <div className="flex gap-1 bg-[var(--color-muted)] rounded-xl p-1 w-fit animate-float-up" style={{ animationDelay: "250ms" }}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? "bg-[var(--color-surface)] text-foreground shadow-sm"
                : "text-[var(--color-text-secondary)] hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "orders" && <OrdersTab />}
      {activeTab === "results" && <ResultsTab />}
      {activeTab === "catalog" && <CatalogTab />}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB: ORDERS
// ══════════════════════════════════════════════════════════════════════════════

function OrdersTab() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [createModal, setCreateModal] = useState(false);
  const [resultModal, setResultModal] = useState<Record<string, unknown> | null>(null);
  const [statusDropdown, setStatusDropdown] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["lab-orders", statusFilter, priorityFilter],
    queryFn: () =>
      laboratoryApi.getOrders({
        status: statusFilter || undefined,
        priority: priorityFilter || undefined,
      }),
  });

  const orders: Array<Record<string, unknown>> = Array.isArray(data) ? data : (data as Record<string, unknown>)?.items as Array<Record<string, unknown>> ?? [];

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      laboratoryApi.updateOrder(id, { status }),
    onSuccess: () => {
      toast.success("Статус обновлён");
      qc.invalidateQueries({ queryKey: ["lab-orders"] });
      qc.invalidateQueries({ queryKey: ["lab-stats"] });
      setStatusDropdown(null);
    },
    onError: () => toast.error("Не удалось обновить статус"),
  });

  return (
    <>
      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4 animate-float-up" style={{ animationDelay: "300ms" }}>
        <CustomSelect
          value={statusFilter}
          onChange={setStatusFilter}
          options={ORDER_STATUSES}
          placeholder="Все статусы"
          className="w-44"
        />
        <CustomSelect
          value={priorityFilter}
          onChange={setPriorityFilter}
          options={PRIORITY_OPTIONS}
          placeholder="Все приоритеты"
          className="w-44"
        />
        <div className="flex-1" />
        <Button onClick={() => setCreateModal(true)}>
          <PlusIcon className="w-4 h-4 mr-1.5" />
          Назначить анализ
        </Button>
      </div>

      {/* Orders Table */}
      <div className="bg-[var(--color-surface)] rounded-2xl border border-border overflow-hidden animate-float-up" style={{ animationDelay: "350ms" }}>
        {isLoading ? (
          <SkeletonRows />
        ) : orders.length === 0 ? (
          <EmptyState message={statusFilter || priorityFilter ? "Заказы не найдены" : "Нет заказов"} />
        ) : (
          <>
            {/* Header */}
            <div className="hidden lg:grid grid-cols-[2fr_2fr_100px_100px_110px_120px_140px_120px] gap-2 px-4 py-2.5 border-b border-border bg-[var(--color-muted)]/30">
              <span className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Пациент</span>
              <span className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Тест</span>
              <span className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Код</span>
              <span className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Приоритет</span>
              <span className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Статус</span>
              <span className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Дата</span>
              <span className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Врач</span>
              <span className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Действия</span>
            </div>

            <div className="divide-y divide-border">
              {orders.map((order, idx) => {
                const id = String(order.id ?? idx);
                const status = String(order.status ?? "ORDERED");
                const priority = String(order.priority ?? "ROUTINE");
                const statusMeta = ORDER_STATUS_META[status] ?? { label: status, variant: "muted" as const };
                const priorityMeta = PRIORITY_META[priority] ?? { label: priority, variant: "muted" as const };
                const transitions = STATUS_TRANSITIONS[status] ?? [];
                const isDropdownOpen = statusDropdown === id;

                return (
                  <div
                    key={id}
                    className="grid grid-cols-1 lg:grid-cols-[2fr_2fr_100px_100px_110px_120px_140px_120px] gap-2 px-4 py-3 hover:bg-[var(--color-muted)]/40 transition-colors animate-float-up"
                    style={{ animationDelay: `${idx * 30}ms` }}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{String(order.patient_name ?? "—")}</p>
                      <p className="text-xs text-[var(--color-text-tertiary)] lg:hidden">
                        {String(order.test_name ?? "")} {order.test_code ? `(${String(order.test_code)})` : ""}
                      </p>
                    </div>
                    <p className="text-sm text-foreground truncate hidden lg:block">{String(order.test_name ?? "—")}</p>
                    <p className="text-sm text-[var(--color-text-secondary)] hidden lg:block">{String(order.test_code ?? "—")}</p>
                    <div>
                      <Badge variant={priorityMeta.variant} dot>
                        {priorityMeta.label}
                      </Badge>
                    </div>
                    <div>
                      <Badge variant={statusMeta.variant} dot>
                        {statusMeta.label}
                      </Badge>
                    </div>
                    <p className="text-sm text-[var(--color-text-secondary)] hidden lg:block">{formatDate(order.ordered_at as string | undefined ?? order.created_at as string | undefined)}</p>
                    <p className="text-sm text-[var(--color-text-secondary)] truncate hidden lg:block">{String(order.doctor_name ?? "—")}</p>
                    <div className="flex items-center gap-1">
                      {/* Status change dropdown */}
                      {transitions.length > 0 && (
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setStatusDropdown(isDropdownOpen ? null : id)}
                            className="px-2 py-1 rounded-lg text-xs text-secondary hover:bg-secondary/10 transition-colors flex items-center gap-1"
                          >
                            Статус
                            <ChevronDownIcon className="w-3 h-3" />
                          </button>
                          {isDropdownOpen && (
                            <div className="absolute right-0 top-full mt-1 z-50 bg-[var(--color-surface)] border border-border rounded-xl shadow-xl py-1 min-w-[140px]">
                              {transitions.map((s) => {
                                const meta = ORDER_STATUS_META[s];
                                return (
                                  <button
                                    key={s}
                                    type="button"
                                    onClick={() => updateStatusMutation.mutate({ id, status: s })}
                                    className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--color-muted)] transition-colors"
                                  >
                                    {meta?.label ?? s}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                      {/* Enter result button — only for actionable statuses */}
                      {(status === "ORDERED" || status === "SAMPLE_COLLECTED" || status === "IN_PROGRESS") && (
                        <button
                          type="button"
                          onClick={() => setResultModal(order)}
                          className="px-2 py-1 rounded-lg text-xs text-primary hover:bg-primary/10 transition-colors"
                        >
                          Результат
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Create Order Modal */}
      {createModal && <CreateOrderModal onClose={() => setCreateModal(false)} />}

      {/* Enter Result Modal */}
      {resultModal && <EnterResultModal order={resultModal} onClose={() => setResultModal(null)} />}
    </>
  );
}

// ── Create Order Modal ────────────────────────────────────────────────────────

function CreateOrderModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [patientId, setPatientId] = useState("");
  const [testId, setTestId] = useState("");
  const [priority, setPriority] = useState("ROUTINE");
  const [notes, setNotes] = useState("");

  const { data: catalogData } = useQuery({
    queryKey: ["lab-catalog"],
    queryFn: () => laboratoryApi.getCatalog(),
  });

  const catalog: Array<Record<string, unknown>> = Array.isArray(catalogData) ? catalogData : (catalogData as Record<string, unknown>)?.items as Array<Record<string, unknown>> ?? [];
  const testOptions = catalog.map((t) => ({ value: String(t.id ?? ""), label: `${String(t.name ?? "")} (${String(t.code ?? "")})` }));

  const mutation = useMutation({
    mutationFn: () =>
      laboratoryApi.createOrder({
        patient_id: patientId,
        test_id: testId,
        priority,
        notes: notes || undefined,
      }),
    onSuccess: () => {
      toast.success("Анализ назначен");
      qc.invalidateQueries({ queryKey: ["lab-orders"] });
      qc.invalidateQueries({ queryKey: ["lab-stats"] });
      onClose();
    },
    onError: () => toast.error("Ошибка при назначении анализа"),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!patientId.trim()) {
      toast.error("Укажите ID пациента");
      return;
    }
    if (!testId) {
      toast.error("Выберите тест");
      return;
    }
    mutation.mutate();
  }

  return (
    <LabModal title="Назначить анализ" onClose={onClose} onSubmit={handleSubmit} isLoading={mutation.isPending} submitLabel="Назначить">
      <InputField
        label="ID пациента"
        value={patientId}
        onChange={(e) => setPatientId(e.target.value)}
        placeholder="Введите ID пациента"
        required
      />
      <CustomSelect
        label="Тест"
        value={testId}
        onChange={setTestId}
        options={testOptions}
        placeholder="Выберите тест из каталога"
      />
      <CustomSelect
        label="Приоритет"
        value={priority}
        onChange={setPriority}
        options={PRIORITY_OPTIONS.filter((p) => p.value !== "")}
        placeholder="Приоритет"
      />
      <TextareaField
        label="Примечания"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
        placeholder="Дополнительные указания..."
      />
    </LabModal>
  );
}

// ── Enter Result Modal ────────────────────────────────────────────────────────

function EnterResultModal({ order, onClose }: { order: Record<string, unknown>; onClose: () => void }) {
  const qc = useQueryClient();
  const [value, setValue] = useState("");
  const [numericValue, setNumericValue] = useState("");
  const [unit, setUnit] = useState("");
  const [referenceRange, setReferenceRange] = useState("");
  const [isAbnormal, setIsAbnormal] = useState(false);
  const [notes, setNotes] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      laboratoryApi.createResult({
        order_id: String(order.id),
        test_name: order.test_name,
        test_code: order.test_code,
        patient_id: order.patient_id,
        value,
        numeric_value: numericValue ? Number(numericValue) : undefined,
        unit: unit || undefined,
        reference_range: referenceRange || undefined,
        is_abnormal: isAbnormal,
        notes: notes || undefined,
      }),
    onSuccess: () => {
      toast.success("Результат сохранён");
      qc.invalidateQueries({ queryKey: ["lab-orders"] });
      qc.invalidateQueries({ queryKey: ["lab-results"] });
      qc.invalidateQueries({ queryKey: ["lab-stats"] });
      onClose();
    },
    onError: () => toast.error("Ошибка при сохранении результата"),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim()) {
      toast.error("Введите значение результата");
      return;
    }
    mutation.mutate();
  }

  return (
    <LabModal title={`Результат: ${String(order.test_name ?? "")}`} onClose={onClose} onSubmit={handleSubmit} isLoading={mutation.isPending} submitLabel="Сохранить результат">
      <div className="p-3 rounded-xl bg-[var(--color-muted)]/50 text-sm space-y-1">
        <p><span className="text-[var(--color-text-tertiary)]">Пациент:</span> <span className="font-medium text-foreground">{String(order.patient_name ?? "—")}</span></p>
        <p><span className="text-[var(--color-text-tertiary)]">Тест:</span> <span className="font-medium text-foreground">{String(order.test_name ?? "")} ({String(order.test_code ?? "")})</span></p>
      </div>
      <InputField
        label="Значение"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Например: 5.2 или Отрицательный"
        required
      />
      <div className="grid grid-cols-2 gap-4">
        <InputField
          label="Числовое значение"
          type="number"
          step="any"
          value={numericValue}
          onChange={(e) => setNumericValue(e.target.value)}
          placeholder="5.2"
        />
        <InputField
          label="Ед. измерения"
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          placeholder="ммоль/л"
        />
      </div>
      <InputField
        label="Референсный диапазон"
        value={referenceRange}
        onChange={(e) => setReferenceRange(e.target.value)}
        placeholder="3.5 — 7.8"
      />
      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={isAbnormal}
          onChange={(e) => setIsAbnormal(e.target.checked)}
          className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
        />
        <span className="text-sm text-foreground">Отклонение от нормы</span>
      </label>
      <TextareaField
        label="Примечания"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
        placeholder="Комментарий к результату..."
      />
    </LabModal>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB: RESULTS
// ══════════════════════════════════════════════════════════════════════════════

function ResultsTab() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [createModal, setCreateModal] = useState(false);

  const RESULT_STATUSES = [
    { value: "", label: "Все" },
    { value: "PENDING", label: "В обработке" },
    { value: "FINAL", label: "Финальный" },
    { value: "CORRECTED", label: "Скорректирован" },
  ];

  const { data, isLoading } = useQuery({
    queryKey: ["lab-results", statusFilter],
    queryFn: () =>
      laboratoryApi.getResults({
        status: statusFilter || undefined,
      }),
  });

  const results: Array<Record<string, unknown>> = Array.isArray(data) ? data : (data as Record<string, unknown>)?.items as Array<Record<string, unknown>> ?? [];

  return (
    <>
      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4 animate-float-up" style={{ animationDelay: "300ms" }}>
        <CustomSelect
          value={statusFilter}
          onChange={setStatusFilter}
          options={RESULT_STATUSES}
          placeholder="Все статусы"
          className="w-44"
        />
        <div className="flex-1" />
        <Button onClick={() => setCreateModal(true)}>
          <PlusIcon className="w-4 h-4 mr-1.5" />
          Ввести результат
        </Button>
      </div>

      {/* Results Table */}
      <div className="bg-[var(--color-surface)] rounded-2xl border border-border overflow-hidden animate-float-up" style={{ animationDelay: "350ms" }}>
        {isLoading ? (
          <SkeletonRows />
        ) : results.length === 0 ? (
          <EmptyState message={statusFilter ? "Результаты не найдены" : "Нет результатов"} />
        ) : (
          <>
            {/* Header */}
            <div className="hidden lg:grid grid-cols-[2fr_1fr_2fr_1fr_1fr_100px_100px_120px] gap-2 px-4 py-2.5 border-b border-border bg-[var(--color-muted)]/30">
              <span className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Тест</span>
              <span className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Код</span>
              <span className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Пациент</span>
              <span className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Значение</span>
              <span className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Норма</span>
              <span className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Отклонение</span>
              <span className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Статус</span>
              <span className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Дата</span>
            </div>

            <div className="divide-y divide-border">
              {results.map((result, idx) => {
                const id = String(result.id ?? idx);
                const isExpanded = expandedId === id;

                return (
                  <div key={id}>
                    <div
                      className="grid grid-cols-1 lg:grid-cols-[2fr_1fr_2fr_1fr_1fr_100px_100px_120px] gap-2 px-4 py-3 hover:bg-[var(--color-muted)]/40 transition-colors cursor-pointer animate-float-up"
                      style={{ animationDelay: `${idx * 30}ms` }}
                      onClick={() => setExpandedId(isExpanded ? null : id)}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <ChevronDownIcon className={`w-4 h-4 text-[var(--color-text-tertiary)] transition-transform flex-shrink-0 ${isExpanded ? "rotate-180" : ""}`} />
                        <p className="text-sm font-semibold text-foreground truncate">{String(result.test_name ?? "—")}</p>
                      </div>
                      <p className="text-sm text-[var(--color-text-secondary)] hidden lg:block">{String(result.test_code ?? "—")}</p>
                      <p className="text-sm text-foreground truncate hidden lg:block">{String(result.patient_name ?? "—")}</p>
                      <p className={`text-sm font-bold hidden lg:block ${result.is_abnormal ? "text-destructive" : "text-foreground"}`}>
                        {String(result.value ?? "—")} {result.unit ? String(result.unit) : ""}
                      </p>
                      <p className="text-xs text-[var(--color-text-tertiary)] hidden lg:block">{String(result.reference_range ?? "—")}</p>
                      <div className="hidden lg:block">
                        {result.is_abnormal && (
                          <Badge variant="destructive" dot>Да</Badge>
                        )}
                      </div>
                      <div className="hidden lg:block">
                        <Badge variant={String(result.status) === "FINAL" ? "success" : String(result.status) === "CORRECTED" ? "warning" : "muted"} dot>
                          {String(result.status) === "FINAL" ? "Финальный" : String(result.status) === "CORRECTED" ? "Скорр." : "В обработке"}
                        </Badge>
                      </div>
                      <p className="text-sm text-[var(--color-text-secondary)] hidden lg:block">{formatDateTime(result.resulted_at as string | undefined ?? result.created_at as string | undefined)}</p>
                    </div>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div className="bg-[var(--color-muted)]/20 px-6 py-4 border-t border-border space-y-3">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-xs text-[var(--color-text-tertiary)] uppercase tracking-wider mb-1">Тест</p>
                            <p className="font-medium text-foreground">{String(result.test_name ?? "—")}</p>
                            <p className="text-xs text-[var(--color-text-tertiary)]">{String(result.test_code ?? "")}</p>
                          </div>
                          <div>
                            <p className="text-xs text-[var(--color-text-tertiary)] uppercase tracking-wider mb-1">Пациент</p>
                            <p className="font-medium text-foreground">{String(result.patient_name ?? "—")}</p>
                          </div>
                          <div>
                            <p className="text-xs text-[var(--color-text-tertiary)] uppercase tracking-wider mb-1">Значение</p>
                            <p className={`font-bold ${result.is_abnormal ? "text-destructive" : "text-foreground"}`}>
                              {String(result.value ?? "—")} {result.unit ? String(result.unit) : ""}
                            </p>
                            {result.reference_range && (
                              <p className="text-xs text-[var(--color-text-tertiary)]">Норма: {String(result.reference_range)}</p>
                            )}
                          </div>
                          <div>
                            <p className="text-xs text-[var(--color-text-tertiary)] uppercase tracking-wider mb-1">Дата результата</p>
                            <p className="font-medium text-foreground">{formatDateTime(result.resulted_at as string | undefined ?? result.created_at as string | undefined)}</p>
                          </div>
                        </div>
                        {result.notes && (
                          <div>
                            <p className="text-xs text-[var(--color-text-tertiary)] uppercase tracking-wider mb-1">Примечания</p>
                            <p className="text-sm text-foreground">{String(result.notes)}</p>
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

      {/* Create Result Modal */}
      {createModal && <CreateResultModal onClose={() => setCreateModal(false)} />}
    </>
  );
}

// ── Create Result Modal (standalone) ──────────────────────────────────────────

function CreateResultModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [orderId, setOrderId] = useState("");
  const [value, setValue] = useState("");
  const [numericValue, setNumericValue] = useState("");
  const [unit, setUnit] = useState("");
  const [referenceRange, setReferenceRange] = useState("");
  const [isAbnormal, setIsAbnormal] = useState(false);
  const [notes, setNotes] = useState("");

  // Load actionable orders for selection
  const { data: ordersData } = useQuery({
    queryKey: ["lab-orders-for-result"],
    queryFn: () => laboratoryApi.getOrders({ limit: 100 }),
  });

  const allOrders: Array<Record<string, unknown>> = Array.isArray(ordersData) ? ordersData : (ordersData as Record<string, unknown>)?.items as Array<Record<string, unknown>> ?? [];
  const actionableOrders = allOrders.filter((o) => {
    const s = String(o.status ?? "");
    return s === "ORDERED" || s === "SAMPLE_COLLECTED" || s === "IN_PROGRESS";
  });

  const orderOptions = actionableOrders.map((o) => ({
    value: String(o.id ?? ""),
    label: `${String(o.patient_name ?? "?")} — ${String(o.test_name ?? "")} (${String(o.test_code ?? "")})`,
  }));

  const selectedOrder = actionableOrders.find((o) => String(o.id) === orderId);

  const mutation = useMutation({
    mutationFn: () =>
      laboratoryApi.createResult({
        order_id: orderId,
        test_name: selectedOrder?.test_name,
        test_code: selectedOrder?.test_code,
        patient_id: selectedOrder?.patient_id,
        value,
        numeric_value: numericValue ? Number(numericValue) : undefined,
        unit: unit || undefined,
        reference_range: referenceRange || undefined,
        is_abnormal: isAbnormal,
        notes: notes || undefined,
      }),
    onSuccess: () => {
      toast.success("Результат сохранён");
      qc.invalidateQueries({ queryKey: ["lab-results"] });
      qc.invalidateQueries({ queryKey: ["lab-orders"] });
      qc.invalidateQueries({ queryKey: ["lab-stats"] });
      onClose();
    },
    onError: () => toast.error("Ошибка при сохранении результата"),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!orderId) {
      toast.error("Выберите заказ");
      return;
    }
    if (!value.trim()) {
      toast.error("Введите значение результата");
      return;
    }
    mutation.mutate();
  }

  return (
    <LabModal title="Ввести результат" onClose={onClose} onSubmit={handleSubmit} isLoading={mutation.isPending} submitLabel="Сохранить результат" maxWidth="max-w-xl">
      <CustomSelect
        label="Заказ"
        value={orderId}
        onChange={setOrderId}
        options={orderOptions}
        placeholder="Выберите заказ"
      />
      {selectedOrder && (
        <div className="p-3 rounded-xl bg-[var(--color-muted)]/50 text-sm space-y-1">
          <p><span className="text-[var(--color-text-tertiary)]">Пациент:</span> <span className="font-medium text-foreground">{String(selectedOrder.patient_name ?? "—")}</span></p>
          <p><span className="text-[var(--color-text-tertiary)]">Тест:</span> <span className="font-medium text-foreground">{String(selectedOrder.test_name ?? "")} ({String(selectedOrder.test_code ?? "")})</span></p>
        </div>
      )}
      <InputField
        label="Значение"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Например: 5.2 или Отрицательный"
        required
      />
      <div className="grid grid-cols-2 gap-4">
        <InputField
          label="Числовое значение"
          type="number"
          step="any"
          value={numericValue}
          onChange={(e) => setNumericValue(e.target.value)}
          placeholder="5.2"
        />
        <InputField
          label="Ед. измерения"
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          placeholder="ммоль/л"
        />
      </div>
      <InputField
        label="Референсный диапазон"
        value={referenceRange}
        onChange={(e) => setReferenceRange(e.target.value)}
        placeholder="3.5 — 7.8"
      />
      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={isAbnormal}
          onChange={(e) => setIsAbnormal(e.target.checked)}
          className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
        />
        <span className="text-sm text-foreground">Отклонение от нормы</span>
      </label>
      <TextareaField
        label="Примечания"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
        placeholder="Комментарий к результату..."
      />
    </LabModal>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB: CATALOG
// ══════════════════════════════════════════════════════════════════════════════

function CatalogTab() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [createModal, setCreateModal] = useState(false);
  const [editModal, setEditModal] = useState<Record<string, unknown> | null>(null);

  const debouncedSearch = useDebounce(search, 300);

  const { data, isLoading } = useQuery({
    queryKey: ["lab-catalog", debouncedSearch, categoryFilter],
    queryFn: () =>
      laboratoryApi.getCatalog(
        debouncedSearch || undefined,
        categoryFilter || undefined,
      ),
  });

  const tests: Array<Record<string, unknown>> = Array.isArray(data) ? data : (data as Record<string, unknown>)?.items as Array<Record<string, unknown>> ?? [];

  const deleteMutation = useMutation({
    mutationFn: (id: string) => laboratoryApi.deleteTest(id),
    onSuccess: () => {
      toast.success("Тест удалён");
      qc.invalidateQueries({ queryKey: ["lab-catalog"] });
    },
    onError: () => toast.error("Не удалось удалить тест"),
  });

  function handleDelete(id: string, name: string) {
    if (window.confirm(`Удалить тест "${name}"?`)) {
      deleteMutation.mutate(id);
    }
  }

  return (
    <>
      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4 animate-float-up" style={{ animationDelay: "300ms" }}>
        <InputField
          icon={searchIcon}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск тестов..."
          className="flex-1 min-w-[200px] max-w-sm"
        />
        <CustomSelect
          value={categoryFilter}
          onChange={setCategoryFilter}
          options={TEST_CATEGORIES}
          placeholder="Все категории"
          className="w-48"
        />
        <div className="flex-1" />
        <Button onClick={() => setCreateModal(true)}>
          <PlusIcon className="w-4 h-4 mr-1.5" />
          Добавить тест
        </Button>
      </div>

      {/* Catalog Table */}
      <div className="bg-[var(--color-surface)] rounded-2xl border border-border overflow-hidden animate-float-up" style={{ animationDelay: "350ms" }}>
        {isLoading ? (
          <SkeletonRows />
        ) : tests.length === 0 ? (
          <EmptyState message={debouncedSearch || categoryFilter ? "Тесты не найдены" : "Каталог пуст"} />
        ) : (
          <>
            {/* Header */}
            <div className="hidden md:grid grid-cols-[2fr_100px_1fr_1fr_100px_100px_100px] gap-2 px-4 py-2.5 border-b border-border bg-[var(--color-muted)]/30">
              <span className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Название</span>
              <span className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Код</span>
              <span className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Категория</span>
              <span className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Биоматериал</span>
              <span className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider text-right">Срок (ч)</span>
              <span className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider text-right">Цена</span>
              <span className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Действия</span>
            </div>

            <div className="divide-y divide-border">
              {tests.map((test, idx) => {
                const id = String(test.id ?? idx);
                return (
                  <div
                    key={id}
                    className="grid grid-cols-1 md:grid-cols-[2fr_100px_1fr_1fr_100px_100px_100px] gap-2 px-4 py-3 hover:bg-[var(--color-muted)]/40 transition-colors animate-float-up"
                    style={{ animationDelay: `${idx * 30}ms` }}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{String(test.name ?? "—")}</p>
                      <p className="text-xs text-[var(--color-text-tertiary)] md:hidden">{String(test.code ?? "")}</p>
                    </div>
                    <p className="text-sm text-[var(--color-text-secondary)] hidden md:block">{String(test.code ?? "—")}</p>
                    <p className="text-sm text-[var(--color-text-secondary)] hidden md:block">{test.category ? labelFor(TEST_CATEGORIES, String(test.category)) : "—"}</p>
                    <p className="text-sm text-[var(--color-text-secondary)] hidden md:block">{test.sample_type ? labelFor(SAMPLE_TYPES, String(test.sample_type)) : "—"}</p>
                    <p className="text-sm text-[var(--color-text-secondary)] text-right hidden md:block">{test.turnaround_hours != null ? String(test.turnaround_hours) : "—"}</p>
                    <p className="text-sm font-medium text-foreground text-right hidden md:block">{test.price != null ? formatPrice(Number(test.price)) : "—"}</p>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setEditModal(test)}
                        title="Редактировать"
                        className="p-1.5 rounded-lg text-[var(--color-text-tertiary)] hover:text-secondary hover:bg-secondary/10 transition-colors"
                      >
                        <EditIcon />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(id, String(test.name ?? ""))}
                        title="Удалить"
                        className="p-1.5 rounded-lg text-[var(--color-text-tertiary)] hover:text-destructive hover:bg-destructive/10 transition-colors"
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

      {/* Create / Edit Test Modal */}
      {createModal && <TestFormModal onClose={() => setCreateModal(false)} />}
      {editModal && <TestFormModal test={editModal} onClose={() => setEditModal(null)} />}
    </>
  );
}

// ── Test Form Modal ───────────────────────────────────────────────────────────

function TestFormModal({ test, onClose }: { test?: Record<string, unknown>; onClose: () => void }) {
  const qc = useQueryClient();
  const isEdit = !!test;

  const [name, setName] = useState(String(test?.name ?? ""));
  const [code, setCode] = useState(String(test?.code ?? ""));
  const [category, setCategory] = useState(String(test?.category ?? ""));
  const [sampleType, setSampleType] = useState(String(test?.sample_type ?? ""));
  const [turnaroundHours, setTurnaroundHours] = useState(test?.turnaround_hours != null ? String(test.turnaround_hours) : "");
  const [price, setPrice] = useState(test?.price != null ? String(test.price) : "");
  const [description, setDescription] = useState(String(test?.description ?? ""));

  const mutation = useMutation({
    mutationFn: () => {
      const payload: Record<string, unknown> = {
        name,
        code,
        category: category || undefined,
        sample_type: sampleType || undefined,
        turnaround_hours: turnaroundHours ? Number(turnaroundHours) : undefined,
        price: price ? Number(price) : undefined,
        description: description || undefined,
      };
      return isEdit
        ? laboratoryApi.updateTest(String(test.id), payload)
        : laboratoryApi.createTest(payload);
    },
    onSuccess: () => {
      toast.success(isEdit ? "Тест обновлён" : "Тест добавлен");
      qc.invalidateQueries({ queryKey: ["lab-catalog"] });
      onClose();
    },
    onError: () => toast.error(isEdit ? "Ошибка при обновлении" : "Ошибка при создании теста"),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Введите название теста");
      return;
    }
    if (!code.trim()) {
      toast.error("Введите код теста");
      return;
    }
    mutation.mutate();
  }

  const categoryOptions = TEST_CATEGORIES.filter((c) => c.value !== "");
  const sampleOptions = SAMPLE_TYPES;

  return (
    <LabModal
      title={isEdit ? "Редактировать тест" : "Добавить тест"}
      onClose={onClose}
      onSubmit={handleSubmit}
      isLoading={mutation.isPending}
      submitLabel={isEdit ? "Сохранить" : "Добавить"}
    >
      <InputField
        label="Название"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Общий анализ крови"
        required
      />
      <InputField
        label="Код"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="CBC"
        required
      />
      <div className="grid grid-cols-2 gap-4">
        <CustomSelect
          label="Категория"
          value={category}
          onChange={setCategory}
          options={categoryOptions}
          placeholder="Выберите"
        />
        <CustomSelect
          label="Биоматериал"
          value={sampleType}
          onChange={setSampleType}
          options={sampleOptions}
          placeholder="Выберите"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <InputField
          label="Срок выполнения (ч)"
          type="number"
          min="0"
          value={turnaroundHours}
          onChange={(e) => setTurnaroundHours(e.target.value)}
          placeholder="24"
        />
        <InputField
          label="Цена (сом)"
          type="number"
          min="0"
          step="any"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="500"
        />
      </div>
      <TextareaField
        label="Описание"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={3}
        placeholder="Описание теста..."
      />
    </LabModal>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { patientsApi } from "@/features/patients/api";
import { formatDate, formatDateTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InputField } from "@/components/ui/input-field";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

export const Route = createFileRoute(
  "/_authenticated/patients/$patientId/procedures"
)({
  component: ProceduresPage,
});

interface ProcedureInfo {
  id: string;
  name: string;
  code: string | null;
  category: string | null;
  description: string | null;
  duration_minutes: number | null;
  price: number | null;
  requires_consent: boolean;
}

interface ProcedureOrder {
  id: string;
  patient_id: string;
  procedure: ProcedureInfo | null;
  status: string;
  ordered_by_id: string;
  ordered_by_name: string;
  performed_by_id: string | null;
  performed_by_name: string;
  treatment_plan_id: string | null;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  notes: string | null;
  consent_signed: boolean;
  created_at: string;
  updated_at: string;
}

interface CatalogItem {
  id: string;
  name: string;
  code: string | null;
  category: string | null;
  duration_minutes: number | null;
  description: string | null;
}

const STATUS_META: Record<string, { label: string; variant: "secondary" | "warning" | "primary" | "success" | "destructive"; step: number }> = {
  ORDERED: { label: "Назначена", variant: "secondary", step: 1 },
  SCHEDULED: { label: "Запланирована", variant: "primary", step: 2 },
  IN_PROGRESS: { label: "Выполняется", variant: "warning", step: 3 },
  COMPLETED: { label: "Выполнена", variant: "success", step: 4 },
  CANCELLED: { label: "Отменена", variant: "destructive", step: 0 },
};

const FILTER_OPTIONS = [
  { value: "all", label: "Все" },
  { value: "ORDERED", label: "Назначенные" },
  { value: "SCHEDULED", label: "Запланированные" },
  { value: "IN_PROGRESS", label: "В процессе" },
  { value: "COMPLETED", label: "Выполненные" },
];

function ProceduresPage() {
  const { patientId } = Route.useParams();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: rawOrders, isLoading } = useQuery({
    queryKey: ["patient-procedure-orders", patientId],
    queryFn: () => patientsApi.getProcedureOrders(patientId),
  });

  const updateMutation = useMutation({
    mutationFn: ({ orderId, params }: { orderId: string; params: Record<string, unknown> }) =>
      patientsApi.updateProcedureOrder(patientId, orderId, params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patient-procedure-orders", patientId] });
      toast.success("Процедура обновлена");
    },
    onError: () => toast.error("Не удалось обновить"),
  });

  const deleteMutation = useMutation({
    mutationFn: (orderId: string) => patientsApi.deleteProcedureOrder(patientId, orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patient-procedure-orders", patientId] });
      toast.success("Процедура удалена");
      setExpandedId(null);
    },
    onError: () => toast.error("Не удалось удалить"),
  });

  const orders = useMemo(() => {
    let items = (rawOrders as ProcedureOrder[]) || [];
    if (statusFilter !== "all") {
      items = items.filter((o) => o.status === statusFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(
        (o) =>
          (o.procedure?.name && o.procedure.name.toLowerCase().includes(q)) ||
          (o.procedure?.code && o.procedure.code.toLowerCase().includes(q)) ||
          (o.notes && o.notes.toLowerCase().includes(q))
      );
    }
    return items;
  }, [rawOrders, statusFilter, search]);

  const stats = useMemo(() => {
    const all = (rawOrders as ProcedureOrder[]) || [];
    return {
      total: all.length,
      completed: all.filter((o) => o.status === "COMPLETED").length,
      active: all.filter((o) => ["ORDERED", "SCHEDULED", "IN_PROGRESS"].includes(o.status)).length,
    };
  }, [rawOrders]);

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-10 w-48 bg-[var(--color-muted)] rounded-lg" />
        <div className="h-24 bg-[var(--color-muted)] rounded-2xl" />
        <div className="h-32 bg-[var(--color-muted)] rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header + stats */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-foreground">Процедуры</h2>
          {stats.total > 0 && (
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-success/10 text-success">{stats.completed} выполн.</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-secondary/10 text-secondary">{stats.active} актив.</span>
            </div>
          )}
        </div>
        <Button variant="primary" size="sm" onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? "Отмена" : "+ Назначить процедуру"}
        </Button>
      </div>

      {/* Create form */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <CreateProcedureForm
              patientId={patientId}
              onSuccess={() => {
                queryClient.invalidateQueries({ queryKey: ["patient-procedure-orders", patientId] });
                setShowCreate(false);
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex bg-[var(--color-muted)] rounded-lg p-0.5">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setStatusFilter(opt.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                statusFilter === opt.value
                  ? "bg-[var(--color-surface)] text-foreground shadow-sm"
                  : "text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-xs">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-tertiary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по названию..."
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-border bg-[var(--color-surface)] text-foreground placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-secondary/30"
          />
        </div>
      </div>

      {/* List */}
      {orders.length === 0 ? (
        <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[var(--color-muted)] flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-[var(--color-text-tertiary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-foreground mb-1">
            {search || statusFilter !== "all" ? "Ничего не найдено" : "Нет процедур"}
          </h3>
          <p className="text-sm text-[var(--color-text-secondary)]">
            {search || statusFilter !== "all" ? "Попробуйте изменить фильтры" : "Назначьте первую процедуру"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => {
            const isExpanded = expandedId === o.id;
            const meta = STATUS_META[o.status] || { label: o.status, variant: "secondary" as const, step: 0 };
            const proc = o.procedure;
            return (
              <div key={o.id} className={`bg-[var(--color-surface)] rounded-2xl border transition-colors ${isExpanded ? "border-secondary/30" : "border-border hover:border-secondary/20"}`}>
                <button type="button" onClick={() => setExpandedId(isExpanded ? null : o.id)} className="w-full p-5 text-left">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        {proc?.code && (
                          <span className="px-2 py-0.5 rounded-md text-xs font-mono font-bold bg-[var(--color-muted)] text-[var(--color-text-secondary)]">{proc.code}</span>
                        )}
                        <Badge variant={meta.variant} dot>{meta.label}</Badge>
                        {proc?.category && (
                          <span className="px-2 py-0.5 rounded-full text-[11px] bg-secondary/5 text-secondary">{proc.category}</span>
                        )}
                        {proc?.requires_consent && !o.consent_signed && (
                          <span className="px-2 py-0.5 rounded-full text-[11px] bg-warning/10 text-warning font-medium">Требует согласия</span>
                        )}
                        {o.consent_signed && (
                          <span className="px-2 py-0.5 rounded-full text-[11px] bg-success/10 text-success font-medium">Согласие подписано</span>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-foreground">{proc?.name || "Процедура"}</p>
                      <div className="flex items-center gap-4 mt-1.5 text-xs text-[var(--color-text-tertiary)]">
                        {o.ordered_by_name && <span>Назначил: {o.ordered_by_name}</span>}
                        {o.scheduled_at && <span>Дата: {formatDate(o.scheduled_at)}</span>}
                        {proc?.duration_minutes && <span>{proc.duration_minutes} мин</span>}
                        {proc?.price && <span>{proc.price} сом</span>}
                      </div>
                    </div>
                    {/* Status progress dots */}
                    <div className="flex items-center gap-1 flex-shrink-0 mt-1">
                      {[1, 2, 3, 4].map((step) => (
                        <div key={step} className={`w-2.5 h-2.5 rounded-full transition-colors ${step <= meta.step ? "bg-secondary" : "bg-[var(--color-border)]"}`} />
                      ))}
                    </div>
                  </div>
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                      <div className="px-5 pb-5 border-t border-border pt-4 space-y-4">
                        {/* Description */}
                        {proc?.description && (
                          <div>
                            <p className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-1">Описание</p>
                            <p className="text-sm text-foreground">{proc.description}</p>
                          </div>
                        )}

                        {/* Notes */}
                        {o.notes && (
                          <div>
                            <p className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-1">Заметки</p>
                            <p className="text-sm text-[var(--color-text-secondary)] whitespace-pre-wrap">{o.notes}</p>
                          </div>
                        )}

                        {/* Timestamps */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div>
                            <p className="text-xs text-[var(--color-text-tertiary)] mb-0.5">Назначена</p>
                            <p className="text-sm font-medium text-foreground">{formatDateTime(o.created_at)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-[var(--color-text-tertiary)] mb-0.5">Запланирована</p>
                            <p className="text-sm font-medium text-foreground">{o.scheduled_at ? formatDateTime(o.scheduled_at) : "—"}</p>
                          </div>
                          <div>
                            <p className="text-xs text-[var(--color-text-tertiary)] mb-0.5">Начата</p>
                            <p className="text-sm font-medium text-foreground">{o.started_at ? formatDateTime(o.started_at) : "—"}</p>
                          </div>
                          <div>
                            <p className="text-xs text-[var(--color-text-tertiary)] mb-0.5">Завершена</p>
                            <p className="text-sm font-medium text-foreground">{o.completed_at ? formatDateTime(o.completed_at) : "—"}</p>
                          </div>
                        </div>

                        {/* Staff */}
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-xs text-[var(--color-text-tertiary)] mb-0.5">Назначил</p>
                            <p className="text-sm font-medium text-foreground">{o.ordered_by_name || "—"}</p>
                          </div>
                          <div>
                            <p className="text-xs text-[var(--color-text-tertiary)] mb-0.5">Выполняет</p>
                            <p className="text-sm font-medium text-foreground">{o.performed_by_name || "—"}</p>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 pt-2 flex-wrap">
                          {o.status === "ORDERED" && (
                            <Button size="sm" variant="primary" onClick={() => updateMutation.mutate({ orderId: o.id, params: { status: "IN_PROGRESS" } })}>
                              Начать выполнение
                            </Button>
                          )}
                          {o.status === "IN_PROGRESS" && (
                            <Button size="sm" variant="primary" onClick={() => updateMutation.mutate({ orderId: o.id, params: { status: "COMPLETED" } })}>
                              Завершить
                            </Button>
                          )}
                          {o.status !== "COMPLETED" && o.status !== "CANCELLED" && !o.consent_signed && proc?.requires_consent && (
                            <Button size="sm" variant="secondary" onClick={() => updateMutation.mutate({ orderId: o.id, params: { consent_signed: true } })}>
                              Отметить согласие
                            </Button>
                          )}
                          {o.status !== "COMPLETED" && o.status !== "CANCELLED" && (
                            <Button size="sm" variant="secondary" onClick={() => updateMutation.mutate({ orderId: o.id, params: { status: "CANCELLED" } })}>
                              Отменить
                            </Button>
                          )}
                          <div className="flex-1" />
                          <button type="button" onClick={() => { if (confirm("Удалить процедуру?")) deleteMutation.mutate(o.id); }} className="px-3 py-1.5 text-xs font-medium rounded-lg text-destructive hover:bg-destructive/10 transition-colors">
                            Удалить
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// --- Create Form ---

function CreateProcedureForm({ patientId, onSuccess }: { patientId: string; onSuccess: () => void }) {
  const [catalogSearch, setCatalogSearch] = useState("");
  const [selectedProcedure, setSelectedProcedure] = useState<CatalogItem | null>(null);
  const [scheduledAt, setScheduledAt] = useState("");
  const [notes, setNotes] = useState("");
  const [isPending, setIsPending] = useState(false);

  const { data: catalog } = useQuery({
    queryKey: ["procedure-catalog", catalogSearch],
    queryFn: () => patientsApi.getProcedureCatalog(catalogSearch || undefined),
    enabled: true,
  });

  const catalogItems = (catalog as CatalogItem[]) || [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProcedure) {
      toast.error("Выберите процедуру из каталога");
      return;
    }
    setIsPending(true);
    try {
      await patientsApi.createProcedureOrder(
        patientId,
        selectedProcedure.id,
        scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
        notes || undefined,
      );
      toast.success("Процедура назначена");
      onSuccess();
    } catch {
      toast.error("Не удалось назначить процедуру");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-[var(--color-surface)] rounded-2xl border border-secondary/20 p-5 space-y-4">
      <h3 className="text-sm font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Назначить процедуру</h3>

      {/* Catalog search */}
      {!selectedProcedure ? (
        <div>
          <InputField
            label="Поиск процедуры"
            value={catalogSearch}
            onChange={(e) => setCatalogSearch(e.target.value)}
            placeholder="Введите название процедуры..."
          />
          {catalogItems.length > 0 && (
            <div className="mt-2 max-h-48 overflow-y-auto rounded-xl border border-border divide-y divide-border">
              {catalogItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedProcedure(item)}
                  className="w-full px-4 py-3 text-left hover:bg-[var(--color-muted)] transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-foreground">{item.name}</p>
                      <p className="text-xs text-[var(--color-text-tertiary)]">
                        {[item.code, item.category, item.duration_minutes ? `${item.duration_minutes} мин` : null].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    {item.code && <span className="text-xs font-mono text-[var(--color-text-tertiary)]">{item.code}</span>}
                  </div>
                </button>
              ))}
            </div>
          )}
          {catalogSearch && catalogItems.length === 0 && (
            <p className="text-xs text-[var(--color-text-tertiary)] mt-2">Ничего не найдено</p>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3 p-3 bg-secondary/5 rounded-xl border border-secondary/20">
          <div>
            <p className="text-sm font-semibold text-foreground">{selectedProcedure.name}</p>
            <p className="text-xs text-[var(--color-text-tertiary)]">
              {[selectedProcedure.code, selectedProcedure.category].filter(Boolean).join(" · ")}
            </p>
          </div>
          <button type="button" onClick={() => setSelectedProcedure(null)} className="text-xs text-secondary hover:underline">Изменить</button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <InputField
          label="Дата и время (необязательно)"
          type="datetime-local"
          value={scheduledAt}
          onChange={(e) => setScheduledAt(e.target.value)}
        />
        <InputField
          label="Заметки (необязательно)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Дополнительные указания..."
        />
      </div>

      <div className="flex justify-end">
        <Button type="submit" variant="primary" size="sm" loading={isPending} disabled={isPending || !selectedProcedure}>
          Назначить
        </Button>
      </div>
    </form>
  );
}

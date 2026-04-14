import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { patientsApi } from "@/features/patients/api";
import { formatDate, formatDateTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InputField } from "@/components/ui/input-field";
import { CustomSelect } from "@/components/ui/select-custom";
import { PrintLayout } from "@/components/ui/print-layout";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

export const Route = createFileRoute(
  "/_authenticated/patients/$patientId/medications"
)({
  component: MedicationsPage,
});

interface DrugInfo {
  id: string;
  name: string;
  generic_name: string | null;
  brand: string | null;
  form: string;
  category: string | null;
}

interface PrescriptionItemData {
  id: string;
  drug: DrugInfo | null;
  dosage: string | null;
  frequency: string | null;
  route: string;
  duration_days: number | null;
  quantity: number | null;
  is_prn: boolean;
  notes: string | null;
}

interface PrescriptionData {
  id: string;
  patient_id: string;
  doctor_id: string;
  doctor_name: string;
  status: string;
  notes: string | null;
  prescribed_at: string | null;
  items: PrescriptionItemData[];
  treatment_plan_id: string | null;
  created_at: string;
  updated_at: string;
}

interface CatalogDrug {
  id: string;
  name: string;
  generic_name: string | null;
  brand: string | null;
  form: string;
  category: string | null;
  unit: string | null;
  price: number | null;
}

const STATUS_META: Record<string, { label: string; variant: "success" | "primary" | "destructive" | "muted" }> = {
  ACTIVE: { label: "Активный", variant: "success" },
  DISPENSED: { label: "Выдан", variant: "primary" },
  CANCELLED: { label: "Отменён", variant: "destructive" },
  EXPIRED: { label: "Истёк", variant: "muted" },
};

const ROUTE_LABELS: Record<string, string> = {
  ORAL: "Перорально",
  IV: "Внутривенно",
  IM: "Внутримышечно",
  TOPICAL: "Наружно",
  SUBLINGUAL: "Сублингвально",
  RECTAL: "Ректально",
  INHALATION: "Ингаляция",
  OTHER: "Другое",
};

const FORM_LABELS: Record<string, string> = {
  TABLET: "Таблетки",
  CAPSULE: "Капсулы",
  INJECTION: "Инъекции",
  SYRUP: "Сироп",
  CREAM: "Крем",
  DROPS: "Капли",
  INHALER: "Ингалятор",
  OTHER: "Другое",
};

const ROUTE_OPTIONS = [
  { value: "ORAL", label: "Перорально" },
  { value: "IV", label: "Внутривенно" },
  { value: "IM", label: "Внутримышечно" },
  { value: "TOPICAL", label: "Наружно" },
  { value: "SUBLINGUAL", label: "Сублингвально" },
  { value: "INHALATION", label: "Ингаляция" },
  { value: "OTHER", label: "Другое" },
];

const FILTER_OPTIONS = [
  { value: "all", label: "Все" },
  { value: "ACTIVE", label: "Активные" },
  { value: "DISPENSED", label: "Выданные" },
  { value: "CANCELLED", label: "Отменённые" },
];

function MedicationsPage() {
  const { patientId } = Route.useParams();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [printRx, setPrintRx] = useState<PrescriptionData | null>(null);

  const { data: rawPrescriptions, isLoading } = useQuery({
    queryKey: ["patient-prescriptions", patientId],
    queryFn: () => patientsApi.getPrescriptions(patientId),
  });

  const updateMutation = useMutation({
    mutationFn: ({ rxId, params }: { rxId: string; params: Record<string, unknown> }) =>
      patientsApi.updatePrescription(patientId, rxId, params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patient-prescriptions", patientId] });
      toast.success("Рецепт обновлён");
    },
    onError: () => toast.error("Ошибка обновления"),
  });

  const deleteMutation = useMutation({
    mutationFn: (rxId: string) => patientsApi.deletePrescription(patientId, rxId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patient-prescriptions", patientId] });
      toast.success("Рецепт удалён");
      setExpandedId(null);
    },
    onError: () => toast.error("Ошибка удаления"),
  });

  const prescriptions = useMemo(() => {
    let items = (rawPrescriptions as PrescriptionData[]) || [];
    if (statusFilter !== "all") items = items.filter((p) => p.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter((p) =>
        p.items.some((item) =>
          item.drug?.name.toLowerCase().includes(q) ||
          item.drug?.generic_name?.toLowerCase().includes(q)
        ) || p.doctor_name.toLowerCase().includes(q)
      );
    }
    return items;
  }, [rawPrescriptions, statusFilter, search]);

  const stats = useMemo(() => {
    const all = (rawPrescriptions as PrescriptionData[]) || [];
    const totalDrugs = all.reduce((sum, p) => sum + p.items.length, 0);
    return {
      total: all.length,
      active: all.filter((p) => p.status === "ACTIVE").length,
      drugs: totalDrugs,
    };
  }, [rawPrescriptions]);

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-10 w-48 bg-[var(--color-muted)] rounded-lg" />
        <div className="h-32 bg-[var(--color-muted)] rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-foreground">Препараты</h2>
          {stats.total > 0 && (
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-success/10 text-success">{stats.active} активн.</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-secondary/10 text-secondary">{stats.drugs} препар.</span>
            </div>
          )}
        </div>
        <Button variant="primary" size="sm" onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? "Отмена" : "+ Новый рецепт"}
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
            <CreatePrescriptionForm
              patientId={patientId}
              onSuccess={() => {
                queryClient.invalidateQueries({ queryKey: ["patient-prescriptions", patientId] });
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
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-tertiary)]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по препарату..."
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-border bg-[var(--color-surface)] text-foreground placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-secondary/30"
          />
        </div>
      </div>

      {/* Prescriptions list */}
      {prescriptions.length === 0 ? (
        <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[var(--color-muted)] flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-7 h-7 text-[var(--color-text-tertiary)]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z" />
              <path d="m8.5 8.5 7 7" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-foreground mb-1">
            {search || statusFilter !== "all" ? "Ничего не найдено" : "Нет назначений"}
          </h3>
          <p className="text-sm text-[var(--color-text-secondary)]">
            {search || statusFilter !== "all" ? "Попробуйте изменить фильтры" : "Создайте первый рецепт"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {prescriptions.map((rx) => {
            const isExpanded = expandedId === rx.id;
            const meta = STATUS_META[rx.status] || { label: rx.status, variant: "muted" as const };
            return (
              <div
                key={rx.id}
                className={`bg-[var(--color-surface)] rounded-2xl border transition-colors ${
                  isExpanded ? "border-secondary/30" : "border-border hover:border-secondary/20"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : rx.id)}
                  className="w-full p-5 text-left"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <Badge variant={meta.variant} dot>{meta.label}</Badge>
                        {rx.treatment_plan_id && (
                          <span className="px-2 py-0.5 rounded-full text-[11px] bg-secondary/5 text-secondary">
                            Из плана лечения
                          </span>
                        )}
                        <span className="text-xs text-[var(--color-text-tertiary)]">
                          {rx.items.length}{" "}
                          {rx.items.length === 1
                            ? "препарат"
                            : rx.items.length < 5
                            ? "препарата"
                            : "препаратов"}
                        </span>
                      </div>
                      {/* Drug names preview */}
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {rx.items.slice(0, 4).map((item) => (
                          <span
                            key={item.id}
                            className="px-2.5 py-1 rounded-lg text-xs font-medium bg-[var(--color-muted)] text-foreground"
                          >
                            {item.drug?.name || "—"}
                            {item.dosage && (
                              <span className="text-[var(--color-text-tertiary)] ml-1">{item.dosage}</span>
                            )}
                          </span>
                        ))}
                        {rx.items.length > 4 && (
                          <span className="px-2 py-1 text-xs text-[var(--color-text-tertiary)]">
                            +{rx.items.length - 4}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-[var(--color-text-tertiary)]">
                        {rx.doctor_name && <span>Врач: {rx.doctor_name}</span>}
                        {rx.prescribed_at && <span>{formatDate(rx.prescribed_at)}</span>}
                      </div>
                    </div>
                    <svg
                      className={`w-5 h-5 text-[var(--color-text-tertiary)] transition-transform flex-shrink-0 ${
                        isExpanded ? "rotate-180" : ""
                      }`}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </div>
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-5 pb-5 border-t border-border pt-4 space-y-4">
                        {/* Drug items */}
                        <div className="space-y-2">
                          {rx.items.map((item) => (
                            <div key={item.id} className="bg-[var(--color-muted)]/50 rounded-xl p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 flex-wrap mb-1">
                                    <p className="text-sm font-semibold text-foreground">
                                      {item.drug?.name || "—"}
                                    </p>
                                    {item.drug?.form && (
                                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-secondary/10 text-secondary">
                                        {FORM_LABELS[item.drug.form] || item.drug.form}
                                      </span>
                                    )}
                                    {item.is_prn && (
                                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-warning/10 text-warning">
                                        По требованию
                                      </span>
                                    )}
                                  </div>
                                  {item.drug?.generic_name && (
                                    <p className="text-xs text-[var(--color-text-tertiary)] mb-1">
                                      {item.drug.generic_name}
                                    </p>
                                  )}
                                  <div className="flex items-center gap-3 flex-wrap text-sm text-[var(--color-text-secondary)]">
                                    {item.dosage && (
                                      <span className="font-medium text-foreground">{item.dosage}</span>
                                    )}
                                    {item.frequency && <span>· {item.frequency}</span>}
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[var(--color-surface)] text-[var(--color-text-secondary)]">
                                      {ROUTE_LABELS[item.route] || item.route}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-3 mt-1 text-xs text-[var(--color-text-tertiary)]">
                                    {item.duration_days && <span>{item.duration_days} дней</span>}
                                    {item.quantity && <span>· {item.quantity} шт</span>}
                                  </div>
                                  {item.notes && (
                                    <p className="text-xs text-[var(--color-text-tertiary)] mt-1 italic">
                                      {item.notes}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                          {rx.items.length === 0 && (
                            <p className="text-sm text-[var(--color-text-tertiary)] italic">
                              Препараты не добавлены
                            </p>
                          )}
                        </div>

                        {/* Notes */}
                        {rx.notes && (
                          <div>
                            <p className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-1">
                              Заметки
                            </p>
                            <p className="text-sm text-[var(--color-text-secondary)]">{rx.notes}</p>
                          </div>
                        )}

                        {/* Dates */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          <div>
                            <p className="text-xs text-[var(--color-text-tertiary)] mb-0.5">Назначен</p>
                            <p className="text-sm font-medium text-foreground">
                              {rx.prescribed_at ? formatDateTime(rx.prescribed_at) : "—"}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-[var(--color-text-tertiary)] mb-0.5">Обновлён</p>
                            <p className="text-sm font-medium text-foreground">
                              {formatDateTime(rx.updated_at)}
                            </p>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 pt-2 flex-wrap">
                          {rx.status === "ACTIVE" && (
                            <>
                              <Button
                                size="sm"
                                variant="primary"
                                onClick={() =>
                                  updateMutation.mutate({ rxId: rx.id, params: { status: "DISPENSED" } })
                                }
                                loading={updateMutation.isPending}
                              >
                                Выдать
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() =>
                                  updateMutation.mutate({ rxId: rx.id, params: { status: "CANCELLED" } })
                                }
                                loading={updateMutation.isPending}
                              >
                                Отменить
                              </Button>
                            </>
                          )}
                          <Button size="sm" variant="secondary" onClick={() => setPrintRx(rx)}>
                            Печать
                          </Button>
                          <div className="flex-1" />
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm("Удалить рецепт?")) deleteMutation.mutate(rx.id);
                            }}
                            className="px-3 py-1.5 text-xs font-medium rounded-lg text-destructive hover:bg-destructive/10 transition-colors"
                          >
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

      {printRx && (
        <PrintLayout title={`Рецепт — ${printRx.doctor_name}`} onClose={() => setPrintRx(null)}>
          <PrescriptionPrintContent rx={printRx} />
        </PrintLayout>
      )}
    </div>
  );
}

// ─── Create Prescription Form ─────────────────────────────────────────────────

function CreatePrescriptionForm({
  patientId,
  onSuccess,
}: {
  patientId: string;
  onSuccess: () => void;
}) {
  const [prescriptionId, setPrescriptionId] = useState<string | null>(null);
  const [addedItems, setAddedItems] = useState<PrescriptionItemData[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  // Drug selection state
  const [drugSearch, setDrugSearch] = useState("");
  const [selectedDrug, setSelectedDrug] = useState<CatalogDrug | null>(null);
  const [dosage, setDosage] = useState("");
  const [frequency, setFrequency] = useState("");
  const [route, setRoute] = useState("ORAL");
  const [durationDays, setDurationDays] = useState("");
  const [quantity, setQuantity] = useState("");
  const [isPrn, setIsPrn] = useState(false);
  const [itemNotes, setItemNotes] = useState("");

  const { data: catalog } = useQuery({
    queryKey: ["drug-catalog", drugSearch],
    queryFn: () => patientsApi.getDrugCatalog(drugSearch || undefined),
    enabled: true,
  });
  const catalogItems = (catalog as CatalogDrug[]) || [];

  const createRx = async () => {
    if (prescriptionId) return prescriptionId;
    setIsCreating(true);
    try {
      const rx = await patientsApi.createPrescription(patientId);
      setPrescriptionId(rx.id);
      return rx.id as string;
    } catch {
      toast.error("Не удалось создать рецепт");
      return null;
    } finally {
      setIsCreating(false);
    }
  };

  const handleAddItem = async () => {
    if (!selectedDrug) {
      toast.error("Выберите препарат");
      return;
    }
    if (!dosage.trim()) {
      toast.error("Укажите дозировку");
      return;
    }

    const rxId = await createRx();
    if (!rxId) return;

    try {
      const item = await patientsApi.addPrescriptionItem(patientId, rxId, {
        drug_id: selectedDrug.id,
        dosage: dosage.trim(),
        frequency: frequency.trim() || undefined,
        route,
        duration_days: durationDays ? parseInt(durationDays) : undefined,
        quantity: quantity ? parseInt(quantity) : undefined,
        is_prn: isPrn,
        notes: itemNotes.trim() || undefined,
      });
      setAddedItems((prev) => [...prev, item as PrescriptionItemData]);
      toast.success(`${selectedDrug.name} добавлен`);
      // Reset item fields but keep prescription
      setSelectedDrug(null);
      setDrugSearch("");
      setDosage("");
      setFrequency("");
      setRoute("ORAL");
      setDurationDays("");
      setQuantity("");
      setIsPrn(false);
      setItemNotes("");
    } catch {
      toast.error("Не удалось добавить препарат");
    }
  };

  const handleFinish = () => {
    if (addedItems.length === 0) {
      toast.error("Добавьте хотя бы один препарат");
      return;
    }
    onSuccess();
  };

  return (
    <div className="bg-[var(--color-surface)] rounded-2xl border border-secondary/20 p-5 space-y-4">
      <h3 className="text-sm font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">
        Новый рецепт
      </h3>

      {/* Added items list */}
      {addedItems.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">
            Добавленные препараты
          </p>
          {addedItems.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 p-3 bg-success/5 rounded-xl border border-success/20"
            >
              <svg
                className="w-4 h-4 text-success flex-shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{item.drug?.name}</p>
                <p className="text-xs text-[var(--color-text-tertiary)]">
                  {[item.dosage, item.frequency, ROUTE_LABELS[item.route]].filter(Boolean).join(" · ")}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Drug selection */}
      {!selectedDrug ? (
        <div>
          <InputField
            label="Поиск препарата"
            value={drugSearch}
            onChange={(e) => setDrugSearch(e.target.value)}
            placeholder="Введите название..."
          />
          {catalogItems.length > 0 && (
            <div className="mt-2 max-h-48 overflow-y-auto rounded-xl border border-border divide-y divide-border">
              {catalogItems.map((drug) => (
                <button
                  key={drug.id}
                  type="button"
                  onClick={() => setSelectedDrug(drug)}
                  className="w-full px-4 py-3 text-left hover:bg-[var(--color-muted)] transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-foreground">{drug.name}</p>
                      <p className="text-xs text-[var(--color-text-tertiary)]">
                        {[
                          drug.generic_name,
                          drug.form ? FORM_LABELS[drug.form] || drug.form : null,
                          drug.category,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    {drug.price && (
                      <span className="text-xs text-[var(--color-text-tertiary)]">{drug.price} сом</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
          {catalogItems.length === 0 && drugSearch.trim() && (
            <p className="mt-2 text-sm text-[var(--color-text-tertiary)]">Препараты не найдены</p>
          )}
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between gap-3 p-3 bg-secondary/5 rounded-xl border border-secondary/20 mb-3">
            <div>
              <p className="text-sm font-semibold text-foreground">{selectedDrug.name}</p>
              <p className="text-xs text-[var(--color-text-tertiary)]">
                {[
                  selectedDrug.generic_name,
                  selectedDrug.form ? FORM_LABELS[selectedDrug.form] || selectedDrug.form : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedDrug(null)}
              className="text-xs text-secondary hover:underline"
            >
              Изменить
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <InputField
              label="Дозировка *"
              value={dosage}
              onChange={(e) => setDosage(e.target.value)}
              placeholder="500 мг"
            />
            <InputField
              label="Частота"
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
              placeholder="3 раза в день"
            />
            <CustomSelect
              label="Путь введения"
              value={route}
              onChange={setRoute}
              options={ROUTE_OPTIONS}
            />
            <InputField
              label="Длительность (дней)"
              type="number"
              value={durationDays}
              onChange={(e) => setDurationDays(e.target.value)}
              placeholder="14"
            />
            <InputField
              label="Количество"
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="30"
            />
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPrn}
                  onChange={(e) => setIsPrn(e.target.checked)}
                  className="w-4 h-4 rounded border-border text-secondary focus:ring-secondary"
                />
                <span className="text-sm text-[var(--color-text-secondary)]">По требованию</span>
              </label>
            </div>
          </div>
          <div className="mt-3">
            <InputField
              label="Заметки (необязательно)"
              value={itemNotes}
              onChange={(e) => setItemNotes(e.target.value)}
              placeholder="Принимать после еды..."
            />
          </div>
          <div className="flex justify-end gap-2 mt-3">
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleAddItem}
              loading={isCreating}
            >
              Добавить препарат
            </Button>
          </div>
        </div>
      )}

      {/* Finish button */}
      {addedItems.length > 0 && (
        <div className="flex justify-end pt-2 border-t border-border">
          <Button variant="primary" size="sm" onClick={handleFinish}>
            Завершить рецепт ({addedItems.length}{" "}
            {addedItems.length === 1 ? "препарат" : "препаратов"})
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Prescription Print Content ────────────────────────────────────────────────

function PrescriptionPrintContent({ rx }: { rx: PrescriptionData }) {
  return (
    <div>
      <div className="header">
        <h1>Рецепт</h1>
        <div className="subtitle">MedCore KG · {rx.prescribed_at ? new Date(rx.prescribed_at).toLocaleDateString("ru-RU") : ""}</div>
      </div>

      <div className="section">
        <div className="section-title">Информация о назначении</div>
        <div className="row"><span className="label">Врач:</span><span className="value">{rx.doctor_name}</span></div>
        <div className="row"><span className="label">Дата назначения:</span><span className="value">{rx.prescribed_at ? new Date(rx.prescribed_at).toLocaleDateString("ru-RU") : "—"}</span></div>
        <div className="row"><span className="label">Статус:</span><span className="value"><span className={`badge ${rx.status === "ACTIVE" ? "badge-active" : ""}`}>{STATUS_META[rx.status]?.label || rx.status}</span></span></div>
      </div>

      <div className="section">
        <div className="section-title">Препараты</div>
        <table>
          <thead>
            <tr>
              <th>Препарат</th>
              <th>Дозировка</th>
              <th>Частота</th>
              <th>Путь</th>
              <th>Длительность</th>
              <th>Кол-во</th>
            </tr>
          </thead>
          <tbody>
            {rx.items.map((item) => (
              <tr key={item.id}>
                <td>
                  <strong>{item.drug?.name || "—"}</strong>
                  {item.drug?.generic_name && <div style={{ fontSize: "10px", color: "#666" }}>{item.drug.generic_name}</div>}
                  {item.is_prn && <span className="badge" style={{ marginLeft: "4px" }}>PRN</span>}
                </td>
                <td>{item.dosage || "—"}</td>
                <td>{item.frequency || "—"}</td>
                <td>{ROUTE_LABELS[item.route] || item.route}</td>
                <td>{item.duration_days ? `${item.duration_days} дн.` : "—"}</td>
                <td>{item.quantity || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rx.notes && (
        <div className="section">
          <div className="section-title">Заметки</div>
          <p>{rx.notes}</p>
        </div>
      )}

      <div className="signature-line">
        <div className="signature-block">
          <div className="line">Подпись врача</div>
        </div>
        <div className="signature-block">
          <div className="line">Печать</div>
        </div>
      </div>

      <div className="footer">
        <span>Дата печати: {new Date().toLocaleDateString("ru-RU")}</span>
        <span>MedCore KG</span>
      </div>
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { patientsApi } from "@/features/patients/api";
import { formatDate, formatDateTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InputField } from "@/components/ui/input-field";
import { TextareaField } from "@/components/ui/textarea-field";
import { CustomSelect } from "@/components/ui/select-custom";
import { PrintLayout } from "@/components/ui/print-layout";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

export const Route = createFileRoute(
  "/_authenticated/patients/$patientId/diagnoses"
)({
  component: DiagnosesPage,
});

interface DiagnosisItem {
  id: string;
  patient_id: string;
  icd_code: string;
  title: string;
  description: string | null;
  status: string;
  diagnosed_at: string | null;
  resolved_at: string | null;
  diagnosed_by_id: string;
  diagnosed_by_name: string;
  visit: { id: string; visit_type: string; chief_complaint: string | null; started_at: string | null } | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

const STATUS_OPTIONS = [
  { value: "active", label: "Активный" },
  { value: "chronic", label: "Хронический" },
  { value: "suspected", label: "Подозрение" },
  { value: "resolved", label: "Излечен" },
  { value: "ruled_out", label: "Исключён" },
];

const STATUS_BADGES: Record<string, { variant: "success" | "warning" | "secondary" | "muted" | "destructive"; label: string }> = {
  active: { variant: "success", label: "Активный" },
  chronic: { variant: "warning", label: "Хронический" },
  suspected: { variant: "secondary", label: "Подозрение" },
  resolved: { variant: "muted", label: "Излечен" },
  ruled_out: { variant: "destructive", label: "Исключён" },
};

const VISIT_TYPE_LABELS: Record<string, string> = {
  CONSULTATION: "Консультация",
  FOLLOW_UP: "Повторный приём",
  EMERGENCY: "Экстренный",
  TELEMEDICINE: "Телемедицина",
  PROCEDURE: "Процедура",
};

const FILTER_OPTIONS = [
  { value: "all", label: "Все" },
  { value: "active", label: "Активные" },
  { value: "chronic", label: "Хронические" },
  { value: "suspected", label: "Подозрения" },
  { value: "resolved", label: "Излеченные" },
];

function DiagnosesPage() {
  const { patientId } = Route.useParams();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showPrint, setShowPrint] = useState(false);

  const { data: rawList, isLoading } = useQuery({
    queryKey: ["patient-diagnoses-list", patientId],
    queryFn: () => patientsApi.getDiagnosesList(patientId),
  });

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => patientsApi.createDiagnosis(patientId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patient-diagnoses-list", patientId] });
      toast.success("Диагноз добавлен");
      setShowCreate(false);
    },
    onError: () => toast.error("Не удалось добавить диагноз"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      patientsApi.updateDiagnosis(patientId, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patient-diagnoses-list", patientId] });
      toast.success("Диагноз обновлён");
    },
    onError: () => toast.error("Не удалось обновить диагноз"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => patientsApi.deleteDiagnosis(patientId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patient-diagnoses-list", patientId] });
      toast.success("Диагноз удалён");
      setExpandedId(null);
    },
    onError: () => toast.error("Не удалось удалить диагноз"),
  });

  const diagnoses = useMemo(() => {
    let items = (rawList as DiagnosisItem[]) || [];
    if (statusFilter !== "all") {
      items = items.filter((d) => d.status === statusFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(
        (d) =>
          d.icd_code.toLowerCase().includes(q) ||
          d.title.toLowerCase().includes(q) ||
          (d.description && d.description.toLowerCase().includes(q))
      );
    }
    return items;
  }, [rawList, statusFilter, search]);

  const totalCount = ((rawList as DiagnosisItem[]) || []).length;

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-10 w-48 bg-[var(--color-muted)] rounded-lg" />
        <div className="h-32 bg-[var(--color-muted)] rounded-2xl" />
        <div className="h-32 bg-[var(--color-muted)] rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-foreground">Диагнозы</h2>
          {totalCount > 0 && (
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-secondary/10 text-secondary">
              {totalCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => setShowPrint(true)}>Печать</Button>
          <Button variant="primary" size="sm" onClick={() => setShowCreate(!showCreate)}>
            {showCreate ? "Отмена" : "+ Добавить диагноз"}
          </Button>
        </div>
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
            <CreateDiagnosisForm
              onSubmit={(data) => createMutation.mutate(data)}
              isPending={createMutation.isPending}
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
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по коду или названию..."
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-border bg-[var(--color-surface)] text-foreground placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-secondary/30"
          />
        </div>
      </div>

      {/* List */}
      {diagnoses.length === 0 ? (
        <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[var(--color-muted)] flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-[var(--color-text-tertiary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6 6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3" />
              <path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4" />
              <circle cx="20" cy="10" r="2" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-foreground mb-1">
            {search || statusFilter !== "all" ? "Ничего не найдено" : "Нет диагнозов"}
          </h3>
          <p className="text-sm text-[var(--color-text-secondary)]">
            {search || statusFilter !== "all" ? "Попробуйте изменить фильтры" : "Добавьте первый диагноз"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {diagnoses.map((d) => {
            const isExpanded = expandedId === d.id;
            const statusMeta = STATUS_BADGES[d.status] || { variant: "muted" as const, label: d.status };
            return (
              <div
                key={d.id}
                className={`bg-[var(--color-surface)] rounded-2xl border transition-colors ${
                  isExpanded ? "border-secondary/30" : "border-border hover:border-secondary/20"
                }`}
              >
                {/* Summary row */}
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : d.id)}
                  className="w-full p-5 text-left"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        <span className="px-3 py-1 rounded-lg text-sm font-mono font-bold bg-secondary/10 text-secondary">
                          {d.icd_code}
                        </span>
                        <Badge variant={statusMeta.variant} dot>{statusMeta.label}</Badge>
                      </div>
                      <p className="text-sm font-medium text-foreground">{d.title}</p>
                      <div className="flex items-center gap-4 mt-1.5 text-xs text-[var(--color-text-tertiary)]">
                        {d.diagnosed_by_name && (
                          <span className="flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                            </svg>
                            {d.diagnosed_by_name}
                          </span>
                        )}
                        {d.diagnosed_at && (
                          <span className="flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <rect width="18" height="18" x="3" y="4" rx="2" /><line x1="16" x2="16" y1="2" y2="6" /><line x1="8" x2="8" y1="2" y2="6" /><line x1="3" x2="21" y1="10" y2="10" />
                            </svg>
                            {formatDate(d.diagnosed_at)}
                          </span>
                        )}
                      </div>
                    </div>
                    <svg
                      className={`w-5 h-5 text-[var(--color-text-tertiary)] transition-transform flex-shrink-0 ${isExpanded ? "rotate-180" : ""}`}
                      viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                    >
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </div>
                </button>

                {/* Expanded detail */}
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
                        {/* Description */}
                        {d.description && (
                          <div>
                            <p className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-1">Описание</p>
                            <p className="text-sm text-foreground whitespace-pre-wrap">{d.description}</p>
                          </div>
                        )}

                        {/* Notes */}
                        {d.notes && (
                          <div>
                            <p className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-1">Заметки врача</p>
                            <p className="text-sm text-[var(--color-text-secondary)] whitespace-pre-wrap">{d.notes}</p>
                          </div>
                        )}

                        {/* Visit info */}
                        {d.visit && (
                          <div className="bg-[var(--color-muted)] rounded-xl p-3">
                            <p className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-1.5">Связанный визит</p>
                            <div className="flex items-center gap-2 flex-wrap text-sm">
                              <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-[var(--color-surface)] text-[var(--color-text-secondary)]">
                                {VISIT_TYPE_LABELS[d.visit.visit_type] || d.visit.visit_type}
                              </span>
                              {d.visit.chief_complaint && (
                                <span className="text-[var(--color-text-secondary)]">{d.visit.chief_complaint}</span>
                              )}
                              {d.visit.started_at && (
                                <span className="text-[var(--color-text-tertiary)]">{formatDateTime(d.visit.started_at)}</span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Dates */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          <div>
                            <p className="text-xs text-[var(--color-text-tertiary)] mb-0.5">Дата постановки</p>
                            <p className="text-sm font-medium text-foreground">{d.diagnosed_at ? formatDateTime(d.diagnosed_at) : "—"}</p>
                          </div>
                          <div>
                            <p className="text-xs text-[var(--color-text-tertiary)] mb-0.5">Дата излечения</p>
                            <p className="text-sm font-medium text-foreground">{d.resolved_at ? formatDateTime(d.resolved_at) : "—"}</p>
                          </div>
                          <div>
                            <p className="text-xs text-[var(--color-text-tertiary)] mb-0.5">Последнее обновление</p>
                            <p className="text-sm font-medium text-foreground">{formatDateTime(d.updated_at)}</p>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 pt-2">
                          <CustomSelect
                            value={d.status}
                            onChange={(val) => updateMutation.mutate({ id: d.id, data: { status: val } })}
                            options={STATUS_OPTIONS}
                            placeholder="Статус"
                          />
                          <div className="flex-1" />
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm("Удалить диагноз?")) deleteMutation.mutate(d.id);
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

      {showPrint && (
        <PrintLayout title="Диагнозы пациента" onClose={() => setShowPrint(false)}>
          <DiagnosesPrintContent diagnoses={diagnoses} />
        </PrintLayout>
      )}
    </div>
  );
}

// ─── Create Form ────────────────────────────────────────────────────────────

function CreateDiagnosisForm({
  onSubmit,
  isPending,
}: {
  onSubmit: (data: Record<string, unknown>) => void;
  isPending: boolean;
}) {
  const [icdCode, setIcdCode] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("active");
  const [notes, setNotes] = useState("");
  const [icdSearch, setIcdSearch] = useState("");
  const [showIcdDropdown, setShowIcdDropdown] = useState(false);

  const { data: icdResults } = useQuery({
    queryKey: ["icd10-search", icdSearch],
    queryFn: () => patientsApi.searchIcd10(icdSearch),
    enabled: icdSearch.length >= 1,
  });
  const icdItems = (icdResults as { code: string; title: string }[]) || [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!icdCode.trim() || !title.trim()) {
      toast.error("Заполните код МКБ и название диагноза");
      return;
    }
    onSubmit({
      icd_code: icdCode.trim(),
      title: title.trim(),
      description: description.trim() || undefined,
      status,
      notes: notes.trim() || undefined,
      diagnosed_at: new Date().toISOString(),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="bg-[var(--color-surface)] rounded-2xl border border-secondary/20 p-5 space-y-4">
      <h3 className="text-sm font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">
        Новый диагноз
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="relative">
          <InputField
            label="Код МКБ-10"
            value={icdCode}
            onChange={(e) => {
              setIcdCode(e.target.value);
              setIcdSearch(e.target.value);
              setShowIcdDropdown(true);
            }}
            onFocus={() => { if (icdCode) setShowIcdDropdown(true); }}
            onBlur={() => setTimeout(() => setShowIcdDropdown(false), 200)}
            placeholder="I63.5"
          />
          {showIcdDropdown && icdItems.length > 0 && (
            <div className="absolute z-20 top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto rounded-xl border border-border bg-[var(--color-surface)] shadow-lg divide-y divide-border">
              {icdItems.map((item) => (
                <button
                  key={item.code}
                  type="button"
                  onClick={() => {
                    setIcdCode(item.code);
                    setTitle(item.title);
                    setShowIcdDropdown(false);
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-[var(--color-muted)] transition-colors"
                >
                  <span className="text-xs font-mono font-bold text-secondary">{item.code}</span>
                  <span className="text-xs text-[var(--color-text-secondary)] ml-2">{item.title}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="sm:col-span-2">
          <InputField
            label="Название диагноза"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ишемический инсульт..."
          />
        </div>
      </div>
      <TextareaField
        label="Описание (необязательно)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={2}
        placeholder="Подробное описание диагноза..."
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <CustomSelect
          label="Статус"
          value={status}
          onChange={setStatus}
          options={STATUS_OPTIONS}
        />
        <InputField
          label="Заметки (необязательно)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Дополнительные заметки..."
        />
      </div>
      <div className="flex justify-end">
        <Button type="submit" variant="primary" size="sm" loading={isPending} disabled={isPending}>
          Добавить диагноз
        </Button>
      </div>
    </form>
  );
}

// ─── Diagnoses Print Content ───────────────────────────────────────────────────

function DiagnosesPrintContent({ diagnoses }: { diagnoses: DiagnosisItem[] }) {
  return (
    <div>
      <div className="header">
        <h1>Лист диагнозов</h1>
        <div className="subtitle">MedCore KG · {new Date().toLocaleDateString("ru-RU")}</div>
      </div>
      <div className="section">
        <table>
          <thead>
            <tr>
              <th>Код МКБ-10</th>
              <th>Диагноз</th>
              <th>Статус</th>
              <th>Врач</th>
              <th>Дата</th>
            </tr>
          </thead>
          <tbody>
            {diagnoses.map((d) => {
              const statusLabel = STATUS_BADGES[d.status]?.label || d.status;
              return (
                <tr key={d.id}>
                  <td><strong>{d.icd_code}</strong></td>
                  <td>{d.title}{d.description ? <div style={{ fontSize: "10px", color: "#666" }}>{d.description}</div> : null}</td>
                  <td><span className={`badge ${d.status === "active" ? "badge-active" : d.status === "resolved" ? "badge-completed" : ""}`}>{statusLabel}</span></td>
                  <td>{d.diagnosed_by_name || "—"}</td>
                  <td>{d.diagnosed_at ? new Date(d.diagnosed_at).toLocaleDateString("ru-RU") : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="signature-line">
        <div className="signature-block"><div className="line">Подпись врача</div></div>
        <div className="signature-block"><div className="line">Печать</div></div>
      </div>
      <div className="footer">
        <span>Дата печати: {new Date().toLocaleDateString("ru-RU")}</span>
        <span>MedCore KG</span>
      </div>
    </div>
  );
}

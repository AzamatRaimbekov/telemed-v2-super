import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { settingsApi } from "@/features/settings/api";
import { patientsApi } from "@/features/patients/api";
import { Button } from "@/components/ui/button";
import { InputField } from "@/components/ui/input-field";
import { TextareaField } from "@/components/ui/textarea-field";
import { CustomSelect } from "@/components/ui/select-custom";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/medicine-settings")({
  component: MedicineSettingsPage,
});

// ── Constants ──────────────────────────────────────────────────────────────────

const EXERCISE_CATEGORIES = [
  { value: "UPPER_LIMB", label: "Верхние конечности" },
  { value: "LOWER_LIMB", label: "Нижние конечности" },
  { value: "BALANCE", label: "Баланс" },
  { value: "GAIT", label: "Ходьба" },
  { value: "COGNITIVE", label: "Когнитивные" },
];

const EXERCISE_DIFFICULTIES = [
  { value: "EASY", label: "Лёгкое" },
  { value: "MEDIUM", label: "Среднее" },
  { value: "HARD", label: "Сложное" },
];

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

const TABS = [
  { id: "exercises", label: "Упражнения" },
  { id: "drugs", label: "Лекарства" },
  { id: "procedures", label: "Процедуры" },
  { id: "lab-tests", label: "Анализы" },
  { id: "wards", label: "Палаты" },
] as const;

type TabId = (typeof TABS)[number]["id"];

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

function categoryBadgeVariant(category: string): "secondary" | "success" | "warning" | "primary" | "muted" {
  const map: Record<string, "secondary" | "success" | "warning" | "primary" | "muted"> = {
    UPPER_LIMB: "secondary",
    LOWER_LIMB: "primary",
    BALANCE: "success",
    GAIT: "warning",
    COGNITIVE: "muted",
  };
  return map[category] ?? "muted";
}

function difficultyVariant(d: string): "success" | "warning" | "destructive" | "muted" {
  if (d === "EASY") return "success";
  if (d === "MEDIUM") return "warning";
  if (d === "HARD") return "destructive";
  return "muted";
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
  onSubmit: (e: React.FormEvent) => void;
  isLoading: boolean;
  children: React.ReactNode;
}

function EntityModal({ title, onClose, onSubmit, isLoading, children }: ModalProps) {
  // Close on Escape
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
      <div className="w-full max-w-lg bg-[var(--color-surface)] rounded-2xl border border-border shadow-2xl animate-scale-in flex flex-col max-h-[90vh]">
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
        <form onSubmit={onSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="px-6 py-5 overflow-y-auto flex-1 space-y-4">
            {children}
          </div>
          <div className="px-6 py-4 border-t border-border flex justify-end gap-3 flex-shrink-0">
            <Button type="button" variant="outline" onClick={onClose}>
              Отмена
            </Button>
            <Button type="submit" loading={isLoading}>
              Сохранить
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}

// ── Confirm Delete helper ──────────────────────────────────────────────────────

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
      <svg className="w-12 h-12 mx-auto mb-3 text-[var(--color-text-tertiary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /><line x1="11" x2="11" y1="8" y2="14" /><line x1="8" x2="14" y1="11" y2="11" />
      </svg>
      <p className="text-[var(--color-text-secondary)] text-sm">{message}</p>
    </div>
  );
}

// ── Action buttons for each card row ──────────────────────────────────────────

interface RowActionsProps {
  isActive?: boolean;
  onToggle?: () => void;
  onEdit: () => void;
  onDelete: () => void;
  isToggling?: boolean;
  isDeleting?: boolean;
}

function RowActions({ isActive, onToggle, onEdit, onDelete, isToggling, isDeleting }: RowActionsProps) {
  return (
    <div className="flex items-center gap-1 flex-shrink-0">
      {onToggle && (
        <button
          type="button"
          onClick={onToggle}
          disabled={isToggling}
          title={isActive ? "Деактивировать" : "Активировать"}
          className="p-1.5 rounded-lg text-[var(--color-text-tertiary)] hover:text-foreground hover:bg-[var(--color-muted)] transition-colors disabled:opacity-40"
        >
          {isActive ? (
            <svg className="w-4 h-4 text-success" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <rect width="20" height="12" x="2" y="6" rx="6" /><circle cx="16" cy="12" r="3" fill="currentColor" />
            </svg>
          ) : (
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <rect width="20" height="12" x="2" y="6" rx="6" /><circle cx="8" cy="12" r="3" />
            </svg>
          )}
        </button>
      )}
      <button
        type="button"
        onClick={onEdit}
        title="Редактировать"
        className="p-1.5 rounded-lg text-[var(--color-text-tertiary)] hover:text-foreground hover:bg-[var(--color-muted)] transition-colors"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z" />
        </svg>
      </button>
      <button
        type="button"
        onClick={onDelete}
        disabled={isDeleting}
        title="Удалить"
        className="p-1.5 rounded-lg text-[var(--color-text-tertiary)] hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-40"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
          <path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
        </svg>
      </button>
    </div>
  );
}

// ── Stats Strip ────────────────────────────────────────────────────────────────

interface StatsData {
  exercises?: number;
  drugs?: number;
  procedures?: number;
  lab_tests?: number;
}

function StatsStrip({ stats }: { stats: StatsData | undefined }) {
  const items = [
    { label: "Упражнения", value: stats?.exercises ?? "—", color: "text-secondary" },
    { label: "Лекарства", value: stats?.drugs ?? "—", color: "text-success" },
    { label: "Процедуры", value: stats?.procedures ?? "—", color: "text-warning" },
    { label: "Анализы", value: stats?.lab_tests ?? "—", color: "text-primary" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      {items.map((item, i) => (
        <div
          key={item.label}
          className="bg-[var(--color-surface)] rounded-2xl border border-border p-4 animate-float-up"
          style={{ animationDelay: `${i * 50}ms` }}
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)] mb-1">{item.label}</p>
          <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
        </div>
      ))}
    </div>
  );
}

// ── Pagination ─────────────────────────────────────────────────────────────────

interface PaginationProps {
  page: number;
  total: number;
  limit: number;
  onPageChange: (p: number) => void;
}

function Pagination({ page, total, limit, onPageChange }: PaginationProps) {
  if (total <= limit) return null;
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-border">
      <p className="text-sm text-[var(--color-text-tertiary)]">
        Стр. {page + 1} из {Math.ceil(total / limit)} · Всего: {total}
      </p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => onPageChange(Math.max(0, page - 1))} disabled={page === 0}>
          Назад
        </Button>
        <Button variant="outline" size="sm" onClick={() => onPageChange(page + 1)} disabled={(page + 1) * limit >= total}>
          Далее
        </Button>
      </div>
    </div>
  );
}

// ── Checkbox ───────────────────────────────────────────────────────────────────

interface CheckboxFieldProps {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}

function CheckboxField({ label, checked, onChange }: CheckboxFieldProps) {
  return (
    <label className="flex items-center gap-3 cursor-pointer group">
      <div
        onClick={() => onChange(!checked)}
        className={`w-5 h-5 rounded flex items-center justify-center border transition-all duration-200 cursor-pointer ${
          checked ? "bg-secondary border-secondary" : "border-border bg-[var(--color-surface)] group-hover:border-secondary/50"
        }`}
      >
        {checked && (
          <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
            <path d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>
      <span className="text-sm text-foreground">{label}</span>
    </label>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB: EXERCISES
// ══════════════════════════════════════════════════════════════════════════════

type ExerciseForm = {
  name: string;
  description: string;
  category: string;
  difficulty: string;
  sets: string;
  repetitions: string;
  instructions: string;
  video_url: string;
};

const EMPTY_EXERCISE: ExerciseForm = {
  name: "",
  description: "",
  category: "",
  difficulty: "EASY",
  sets: "3",
  repetitions: "10",
  instructions: "",
  video_url: "",
};

function ExercisesTab() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [page, setPage] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [form, setForm] = useState<ExerciseForm>(EMPTY_EXERCISE);
  const limit = 20;

  const debouncedSearch = useDebounce(search, 300);

  const { data, isLoading } = useQuery({
    queryKey: ["exercises", debouncedSearch, category, difficulty, page],
    queryFn: () =>
      settingsApi.getExercises({
        search: debouncedSearch || undefined,
        category: category || undefined,
        difficulty: difficulty || undefined,
        skip: page * limit,
        limit,
      }),
  });

  const items: Record<string, unknown>[] = data?.items ?? [];
  const total: number = data?.total ?? 0;

  const invalidate = () => qc.invalidateQueries({ queryKey: ["exercises"] });

  const createMut = useMutation({
    mutationFn: settingsApi.createExercise,
    onSuccess: () => { toast.success("Упражнение создано"); invalidate(); closeModal(); },
    onError: () => toast.error("Ошибка при создании"),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      settingsApi.updateExercise(id, data),
    onSuccess: () => { toast.success("Упражнение обновлено"); invalidate(); closeModal(); },
    onError: () => toast.error("Ошибка при обновлении"),
  });

  const deleteMut = useMutation({
    mutationFn: settingsApi.deleteExercise,
    onSuccess: () => { toast.success("Упражнение удалено"); invalidate(); },
    onError: () => toast.error("Ошибка при удалении"),
  });

  const toggleMut = useMutation({
    mutationFn: settingsApi.toggleExercise,
    onSuccess: () => { toast.success("Статус изменён"); invalidate(); },
    onError: () => toast.error("Ошибка"),
  });

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_EXERCISE);
    setModalOpen(true);
  }

  function openEdit(item: Record<string, unknown>) {
    setEditing(item);
    setForm({
      name: String(item.name ?? ""),
      description: String(item.description ?? ""),
      category: String(item.category ?? ""),
      difficulty: String(item.difficulty ?? "EASY"),
      sets: String(item.sets ?? "3"),
      repetitions: String(item.repetitions ?? "10"),
      instructions: String(item.instructions ?? ""),
      video_url: String(item.video_url ?? ""),
    });
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      name: form.name,
      description: form.description || undefined,
      category: form.category || undefined,
      difficulty: form.difficulty || undefined,
      sets: form.sets ? Number(form.sets) : undefined,
      repetitions: form.repetitions ? Number(form.repetitions) : undefined,
      instructions: form.instructions || undefined,
      video_url: form.video_url || undefined,
    };
    if (editing) {
      updateMut.mutate({ id: String(editing.id), data: payload });
    } else {
      createMut.mutate(payload);
    }
  }

  function handleDelete(id: string) {
    if (!window.confirm("Удалить упражнение? Это действие необратимо.")) return;
    deleteMut.mutate(id);
  }

  const isSubmitting = createMut.isPending || updateMut.isPending;

  const categoryOptions = [{ value: "", label: "Все категории" }, ...EXERCISE_CATEGORIES];
  const difficultyOptions = [{ value: "", label: "Любая сложность" }, ...EXERCISE_DIFFICULTIES];

  return (
    <>
      {/* Controls */}
      <div className="flex flex-wrap gap-3 mb-4 animate-float-up" style={{ animationDelay: "200ms" }}>
        <InputField
          icon={searchIcon}
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          placeholder="Поиск упражнений..."
          className="flex-1 min-w-[200px] max-w-sm"
        />
        <CustomSelect value={category} onChange={(v) => { setCategory(v); setPage(0); }} options={categoryOptions} placeholder="Все категории" className="w-52" />
        <CustomSelect value={difficulty} onChange={(v) => { setDifficulty(v); setPage(0); }} options={difficultyOptions} placeholder="Любая сложность" className="w-44" />
        <Button
          icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/></svg>}
          onClick={openCreate}
        >
          Добавить
        </Button>
      </div>

      {/* List */}
      <div className="bg-[var(--color-surface)] rounded-2xl border border-border overflow-hidden animate-float-up" style={{ animationDelay: "250ms" }}>
        {isLoading ? (
          <SkeletonRows />
        ) : items.length === 0 ? (
          <EmptyState message={debouncedSearch || category || difficulty ? "Упражнения не найдены" : "Нет упражнений"} />
        ) : (
          <div className="divide-y divide-border">
            {items.map((item, idx) => (
              <div
                key={String(item.id)}
                className="flex items-center gap-4 px-4 py-3 hover:bg-[var(--color-muted)]/40 transition-colors animate-float-up"
                style={{ animationDelay: `${idx * 30}ms` }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-foreground truncate">{String(item.name)}</p>
                    {item.category && (
                      <Badge variant={categoryBadgeVariant(String(item.category))}>
                        {labelFor(EXERCISE_CATEGORIES, String(item.category))}
                      </Badge>
                    )}
                    {item.difficulty && (
                      <Badge variant={difficultyVariant(String(item.difficulty))}>
                        {labelFor(EXERCISE_DIFFICULTIES, String(item.difficulty))}
                      </Badge>
                    )}
                    <Badge variant={item.is_active ? "success" : "muted"} dot>
                      {item.is_active ? "Активно" : "Неактивно"}
                    </Badge>
                  </div>
                  <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">
                    {item.sets && item.repetitions ? `${item.sets} подх. × ${item.repetitions} повт.` : ""}
                    {item.description ? ` · ${String(item.description).slice(0, 60)}${String(item.description).length > 60 ? "…" : ""}` : ""}
                  </p>
                </div>
                <RowActions
                  isActive={Boolean(item.is_active)}
                  onToggle={() => toggleMut.mutate(String(item.id))}
                  onEdit={() => openEdit(item)}
                  onDelete={() => handleDelete(String(item.id))}
                  isToggling={toggleMut.isPending}
                  isDeleting={deleteMut.isPending}
                />
              </div>
            ))}
          </div>
        )}
        <Pagination page={page} total={total} limit={limit} onPageChange={setPage} />
      </div>

      {/* Modal */}
      {modalOpen && (
        <EntityModal
          title={editing ? "Редактировать упражнение" : "Новое упражнение"}
          onClose={closeModal}
          onSubmit={handleSubmit}
          isLoading={isSubmitting}
        >
          <InputField
            label="Название"
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Упражнение для баланса"
          />
          <TextareaField
            label="Описание"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            rows={2}
            placeholder="Краткое описание..."
          />
          <div className="grid grid-cols-2 gap-4">
            <CustomSelect
              label="Категория"
              value={form.category}
              onChange={(v) => setForm((f) => ({ ...f, category: v }))}
              options={EXERCISE_CATEGORIES}
              placeholder="Выберите категорию"
            />
            <CustomSelect
              label="Сложность"
              value={form.difficulty}
              onChange={(v) => setForm((f) => ({ ...f, difficulty: v }))}
              options={EXERCISE_DIFFICULTIES}
              placeholder="Выберите сложность"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <InputField
              label="Подходы"
              type="number"
              min="1"
              value={form.sets}
              onChange={(e) => setForm((f) => ({ ...f, sets: e.target.value }))}
            />
            <InputField
              label="Повторения"
              type="number"
              min="1"
              value={form.repetitions}
              onChange={(e) => setForm((f) => ({ ...f, repetitions: e.target.value }))}
            />
          </div>
          <TextareaField
            label="Инструкции"
            value={form.instructions}
            onChange={(e) => setForm((f) => ({ ...f, instructions: e.target.value }))}
            rows={3}
            placeholder="Пошаговые инструкции..."
          />
          <InputField
            label="URL демо-видео"
            type="url"
            value={form.video_url}
            onChange={(e) => setForm((f) => ({ ...f, video_url: e.target.value }))}
            placeholder="https://..."
          />
        </EntityModal>
      )}
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB: DRUGS
// ══════════════════════════════════════════════════════════════════════════════

type DrugForm = {
  name: string;
  generic_name: string;
  brand_name: string;
  category: string;
  form: string;
  unit: string;
  price: string;
  requires_prescription: boolean;
  contraindications: string;
};

const EMPTY_DRUG: DrugForm = {
  name: "",
  generic_name: "",
  brand_name: "",
  category: "",
  form: "",
  unit: "",
  price: "",
  requires_prescription: false,
  contraindications: "",
};

function DrugsTab() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [form_filter, setFormFilter] = useState("");
  const [page, setPage] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [form, setForm] = useState<DrugForm>(EMPTY_DRUG);
  const limit = 20;

  const debouncedSearch = useDebounce(search, 300);

  const { data: catData } = useQuery({
    queryKey: ["drug-categories"],
    queryFn: settingsApi.getDrugCategories,
    staleTime: 5 * 60 * 1000,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["drugs", debouncedSearch, category, form_filter, page],
    queryFn: () =>
      settingsApi.getDrugs({
        search: debouncedSearch || undefined,
        category: category || undefined,
        form: form_filter || undefined,
        skip: page * limit,
        limit,
      }),
  });

  const items: Record<string, unknown>[] = data?.items ?? [];
  const total: number = data?.total ?? 0;

  const catList: string[] = Array.isArray(catData) ? catData : catData?.items ?? [];
  const categoryOptions = [
    { value: "", label: "Все категории" },
    ...catList.map((c: string) => ({ value: c, label: c })),
  ];
  const formOptions = [{ value: "", label: "Все формы" }, ...DRUG_FORMS];

  const invalidate = () => qc.invalidateQueries({ queryKey: ["drugs"] });

  const createMut = useMutation({
    mutationFn: settingsApi.createDrug,
    onSuccess: () => { toast.success("Лекарство создано"); invalidate(); closeModal(); },
    onError: () => toast.error("Ошибка при создании"),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      settingsApi.updateDrug(id, data),
    onSuccess: () => { toast.success("Лекарство обновлено"); invalidate(); closeModal(); },
    onError: () => toast.error("Ошибка при обновлении"),
  });

  const deleteMut = useMutation({
    mutationFn: settingsApi.deleteDrug,
    onSuccess: () => { toast.success("Лекарство удалено"); invalidate(); },
    onError: () => toast.error("Ошибка при удалении"),
  });

  const toggleMut = useMutation({
    mutationFn: settingsApi.toggleDrug,
    onSuccess: () => { toast.success("Статус изменён"); invalidate(); },
    onError: () => toast.error("Ошибка"),
  });

  function openCreate() { setEditing(null); setForm(EMPTY_DRUG); setModalOpen(true); }

  function openEdit(item: Record<string, unknown>) {
    setEditing(item);
    setForm({
      name: String(item.name ?? ""),
      generic_name: String(item.generic_name ?? ""),
      brand_name: String(item.brand_name ?? ""),
      category: String(item.category ?? ""),
      form: String(item.form ?? ""),
      unit: String(item.unit ?? ""),
      price: item.price != null ? String(item.price) : "",
      requires_prescription: Boolean(item.requires_prescription),
      contraindications: String(item.contraindications ?? ""),
    });
    setModalOpen(true);
  }

  function closeModal() { setModalOpen(false); setEditing(null); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      name: form.name,
      generic_name: form.generic_name || undefined,
      brand_name: form.brand_name || undefined,
      category: form.category || undefined,
      form: form.form || undefined,
      unit: form.unit || undefined,
      price: form.price ? Number(form.price) : undefined,
      requires_prescription: form.requires_prescription,
      contraindications: form.contraindications || undefined,
    };
    if (editing) {
      updateMut.mutate({ id: String(editing.id), data: payload });
    } else {
      createMut.mutate(payload);
    }
  }

  function handleDelete(id: string) {
    if (!window.confirm("Удалить лекарство? Это действие необратимо.")) return;
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
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          placeholder="Поиск лекарств..."
          className="flex-1 min-w-[200px] max-w-sm"
        />
        <CustomSelect value={category} onChange={(v) => { setCategory(v); setPage(0); }} options={categoryOptions} placeholder="Все категории" className="w-52" />
        <CustomSelect value={form_filter} onChange={(v) => { setFormFilter(v); setPage(0); }} options={formOptions} placeholder="Все формы" className="w-44" />
        <Button
          icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/></svg>}
          onClick={openCreate}
        >
          Добавить
        </Button>
      </div>

      {/* List */}
      <div className="bg-[var(--color-surface)] rounded-2xl border border-border overflow-hidden animate-float-up" style={{ animationDelay: "250ms" }}>
        {isLoading ? (
          <SkeletonRows />
        ) : items.length === 0 ? (
          <EmptyState message={debouncedSearch || category || form_filter ? "Лекарства не найдены" : "Нет лекарств"} />
        ) : (
          <div className="divide-y divide-border">
            {items.map((item, idx) => (
              <div
                key={String(item.id)}
                className="flex items-center gap-4 px-4 py-3 hover:bg-[var(--color-muted)]/40 transition-colors animate-float-up"
                style={{ animationDelay: `${idx * 30}ms` }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-foreground truncate">{String(item.name)}</p>
                    {item.form && (
                      <Badge variant="secondary">{labelFor(DRUG_FORMS, String(item.form))}</Badge>
                    )}
                    {item.requires_prescription && (
                      <Badge variant="warning">Рецептурный</Badge>
                    )}
                    <Badge variant={item.is_active ? "success" : "muted"} dot>
                      {item.is_active ? "Активно" : "Неактивно"}
                    </Badge>
                  </div>
                  <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">
                    {item.generic_name ? `МНН: ${String(item.generic_name)}` : ""}
                    {item.category ? ` · ${String(item.category)}` : ""}
                    {item.price != null ? ` · ${String(item.price)} сом` : ""}
                  </p>
                </div>
                <RowActions
                  isActive={Boolean(item.is_active)}
                  onToggle={() => toggleMut.mutate(String(item.id))}
                  onEdit={() => openEdit(item)}
                  onDelete={() => handleDelete(String(item.id))}
                  isToggling={toggleMut.isPending}
                  isDeleting={deleteMut.isPending}
                />
              </div>
            ))}
          </div>
        )}
        <Pagination page={page} total={total} limit={limit} onPageChange={setPage} />
      </div>

      {/* Modal */}
      {modalOpen && (
        <EntityModal
          title={editing ? "Редактировать лекарство" : "Новое лекарство"}
          onClose={closeModal}
          onSubmit={handleSubmit}
          isLoading={isSubmitting}
        >
          <InputField label="Название" required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Парацетамол" />
          <InputField label="Международное название (МНН)" value={form.generic_name} onChange={(e) => setForm((f) => ({ ...f, generic_name: e.target.value }))} placeholder="Paracetamol" />
          <InputField label="Бренд" value={form.brand_name} onChange={(e) => setForm((f) => ({ ...f, brand_name: e.target.value }))} placeholder="Панадол" />
          <div className="grid grid-cols-2 gap-4">
            <InputField label="Категория" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} placeholder="Анальгетики" />
            <CustomSelect label="Форма" value={form.form} onChange={(v) => setForm((f) => ({ ...f, form: v }))} options={DRUG_FORMS} placeholder="Форма выпуска" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <InputField label="Единица измерения" value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))} placeholder="мг, мл, шт" />
            <InputField label="Цена (сом)" type="number" min="0" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} />
          </div>
          <CheckboxField label="Рецептурный препарат" checked={form.requires_prescription} onChange={(v) => setForm((f) => ({ ...f, requires_prescription: v }))} />
          <TextareaField label="Противопоказания" value={form.contraindications} onChange={(e) => setForm((f) => ({ ...f, contraindications: e.target.value }))} rows={3} placeholder="Гиперчувствительность, печёночная недостаточность..." />
        </EntityModal>
      )}
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB: PROCEDURES
// ══════════════════════════════════════════════════════════════════════════════

type ProcedureForm = {
  name: string;
  code: string;
  category: string;
  description: string;
  duration_minutes: string;
  price: string;
  requires_consent: boolean;
};

const EMPTY_PROCEDURE: ProcedureForm = {
  name: "",
  code: "",
  category: "",
  description: "",
  duration_minutes: "",
  price: "",
  requires_consent: false,
};

function ProceduresTab() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [form, setForm] = useState<ProcedureForm>(EMPTY_PROCEDURE);
  const limit = 20;

  const debouncedSearch = useDebounce(search, 300);

  const { data: catData } = useQuery({
    queryKey: ["procedure-categories"],
    queryFn: settingsApi.getProcedureCategories,
    staleTime: 5 * 60 * 1000,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["procedures", debouncedSearch, category, page],
    queryFn: () =>
      settingsApi.getProcedures({
        search: debouncedSearch || undefined,
        category: category || undefined,
        skip: page * limit,
        limit,
      }),
  });

  const items: Record<string, unknown>[] = data?.items ?? [];
  const total: number = data?.total ?? 0;

  const catList: string[] = Array.isArray(catData) ? catData : catData?.items ?? [];
  const categoryOptions = [
    { value: "", label: "Все категории" },
    ...catList.map((c: string) => ({ value: c, label: c })),
  ];

  const invalidate = () => qc.invalidateQueries({ queryKey: ["procedures"] });

  const createMut = useMutation({
    mutationFn: settingsApi.createProcedure,
    onSuccess: () => { toast.success("Процедура создана"); invalidate(); closeModal(); },
    onError: () => toast.error("Ошибка при создании"),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      settingsApi.updateProcedure(id, data),
    onSuccess: () => { toast.success("Процедура обновлена"); invalidate(); closeModal(); },
    onError: () => toast.error("Ошибка при обновлении"),
  });

  const deleteMut = useMutation({
    mutationFn: settingsApi.deleteProcedure,
    onSuccess: () => { toast.success("Процедура удалена"); invalidate(); },
    onError: () => toast.error("Ошибка при удалении"),
  });

  function openCreate() { setEditing(null); setForm(EMPTY_PROCEDURE); setModalOpen(true); }

  function openEdit(item: Record<string, unknown>) {
    setEditing(item);
    setForm({
      name: String(item.name ?? ""),
      code: String(item.code ?? ""),
      category: String(item.category ?? ""),
      description: String(item.description ?? ""),
      duration_minutes: item.duration_minutes != null ? String(item.duration_minutes) : "",
      price: item.price != null ? String(item.price) : "",
      requires_consent: Boolean(item.requires_consent),
    });
    setModalOpen(true);
  }

  function closeModal() { setModalOpen(false); setEditing(null); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      name: form.name,
      code: form.code || undefined,
      category: form.category || undefined,
      description: form.description || undefined,
      duration_minutes: form.duration_minutes ? Number(form.duration_minutes) : undefined,
      price: form.price ? Number(form.price) : undefined,
      requires_consent: form.requires_consent,
    };
    if (editing) {
      updateMut.mutate({ id: String(editing.id), data: payload });
    } else {
      createMut.mutate(payload);
    }
  }

  function handleDelete(id: string) {
    if (!window.confirm("Удалить процедуру? Это действие необратимо.")) return;
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
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          placeholder="Поиск процедур..."
          className="flex-1 min-w-[200px] max-w-sm"
        />
        <CustomSelect value={category} onChange={(v) => { setCategory(v); setPage(0); }} options={categoryOptions} placeholder="Все категории" className="w-52" />
        <Button
          icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/></svg>}
          onClick={openCreate}
        >
          Добавить
        </Button>
      </div>

      {/* List */}
      <div className="bg-[var(--color-surface)] rounded-2xl border border-border overflow-hidden animate-float-up" style={{ animationDelay: "250ms" }}>
        {isLoading ? (
          <SkeletonRows />
        ) : items.length === 0 ? (
          <EmptyState message={debouncedSearch || category ? "Процедуры не найдены" : "Нет процедур"} />
        ) : (
          <div className="divide-y divide-border">
            {items.map((item, idx) => (
              <div
                key={String(item.id)}
                className="flex items-center gap-4 px-4 py-3 hover:bg-[var(--color-muted)]/40 transition-colors animate-float-up"
                style={{ animationDelay: `${idx * 30}ms` }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-foreground truncate">{String(item.name)}</p>
                    {item.code && <Badge variant="muted">{String(item.code)}</Badge>}
                    {item.requires_consent && <Badge variant="warning">Требует согласия</Badge>}
                  </div>
                  <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">
                    {item.category ? String(item.category) : ""}
                    {item.duration_minutes ? ` · ${String(item.duration_minutes)} мин` : ""}
                    {item.price != null ? ` · ${String(item.price)} сом` : ""}
                  </p>
                </div>
                <RowActions
                  onEdit={() => openEdit(item)}
                  onDelete={() => handleDelete(String(item.id))}
                  isDeleting={deleteMut.isPending}
                />
              </div>
            ))}
          </div>
        )}
        <Pagination page={page} total={total} limit={limit} onPageChange={setPage} />
      </div>

      {/* Modal */}
      {modalOpen && (
        <EntityModal
          title={editing ? "Редактировать процедуру" : "Новая процедура"}
          onClose={closeModal}
          onSubmit={handleSubmit}
          isLoading={isSubmitting}
        >
          <InputField label="Название" required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="УЗИ брюшной полости" />
          <div className="grid grid-cols-2 gap-4">
            <InputField label="Код процедуры" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} placeholder="A01.01" />
            <InputField label="Категория" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} placeholder="Диагностика" />
          </div>
          <TextareaField label="Описание" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} />
          <div className="grid grid-cols-2 gap-4">
            <InputField label="Длительность (мин)" type="number" min="0" value={form.duration_minutes} onChange={(e) => setForm((f) => ({ ...f, duration_minutes: e.target.value }))} />
            <InputField label="Цена (сом)" type="number" min="0" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} />
          </div>
          <CheckboxField label="Требует информированного согласия" checked={form.requires_consent} onChange={(v) => setForm((f) => ({ ...f, requires_consent: v }))} />
        </EntityModal>
      )}
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB: LAB TESTS
// ══════════════════════════════════════════════════════════════════════════════

type LabTestForm = {
  name: string;
  code: string;
  category: string;
  description: string;
  sample_type: string;
  turnaround_hours: string;
  price: string;
};

const EMPTY_LAB_TEST: LabTestForm = {
  name: "",
  code: "",
  category: "",
  description: "",
  sample_type: "",
  turnaround_hours: "",
  price: "",
};

function LabTestsTab() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [form, setForm] = useState<LabTestForm>(EMPTY_LAB_TEST);
  const limit = 20;

  const debouncedSearch = useDebounce(search, 300);

  const { data: catData } = useQuery({
    queryKey: ["lab-test-categories"],
    queryFn: settingsApi.getLabTestCategories,
    staleTime: 5 * 60 * 1000,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["lab-tests", debouncedSearch, category, page],
    queryFn: () =>
      settingsApi.getLabTests({
        search: debouncedSearch || undefined,
        category: category || undefined,
        skip: page * limit,
        limit,
      }),
  });

  const items: Record<string, unknown>[] = data?.items ?? [];
  const total: number = data?.total ?? 0;

  const catList: string[] = Array.isArray(catData) ? catData : catData?.items ?? [];
  const categoryOptions = [
    { value: "", label: "Все категории" },
    ...catList.map((c: string) => ({ value: c, label: c })),
  ];

  const invalidate = () => qc.invalidateQueries({ queryKey: ["lab-tests"] });

  const createMut = useMutation({
    mutationFn: settingsApi.createLabTest,
    onSuccess: () => { toast.success("Анализ создан"); invalidate(); closeModal(); },
    onError: () => toast.error("Ошибка при создании"),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      settingsApi.updateLabTest(id, data),
    onSuccess: () => { toast.success("Анализ обновлён"); invalidate(); closeModal(); },
    onError: () => toast.error("Ошибка при обновлении"),
  });

  const deleteMut = useMutation({
    mutationFn: settingsApi.deleteLabTest,
    onSuccess: () => { toast.success("Анализ удалён"); invalidate(); },
    onError: () => toast.error("Ошибка при удалении"),
  });

  function openCreate() { setEditing(null); setForm(EMPTY_LAB_TEST); setModalOpen(true); }

  function openEdit(item: Record<string, unknown>) {
    setEditing(item);
    setForm({
      name: String(item.name ?? ""),
      code: String(item.code ?? ""),
      category: String(item.category ?? ""),
      description: String(item.description ?? ""),
      sample_type: String(item.sample_type ?? ""),
      turnaround_hours: item.turnaround_hours != null ? String(item.turnaround_hours) : "",
      price: item.price != null ? String(item.price) : "",
    });
    setModalOpen(true);
  }

  function closeModal() { setModalOpen(false); setEditing(null); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      name: form.name,
      code: form.code,
      category: form.category || undefined,
      description: form.description || undefined,
      sample_type: form.sample_type || undefined,
      turnaround_hours: form.turnaround_hours ? Number(form.turnaround_hours) : undefined,
      price: form.price ? Number(form.price) : undefined,
    };
    if (editing) {
      updateMut.mutate({ id: String(editing.id), data: payload });
    } else {
      createMut.mutate(payload);
    }
  }

  function handleDelete(id: string) {
    if (!window.confirm("Удалить анализ? Это действие необратимо.")) return;
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
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          placeholder="Поиск анализов..."
          className="flex-1 min-w-[200px] max-w-sm"
        />
        <CustomSelect value={category} onChange={(v) => { setCategory(v); setPage(0); }} options={categoryOptions} placeholder="Все категории" className="w-52" />
        <Button
          icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/></svg>}
          onClick={openCreate}
        >
          Добавить
        </Button>
      </div>

      {/* List */}
      <div className="bg-[var(--color-surface)] rounded-2xl border border-border overflow-hidden animate-float-up" style={{ animationDelay: "250ms" }}>
        {isLoading ? (
          <SkeletonRows />
        ) : items.length === 0 ? (
          <EmptyState message={debouncedSearch || category ? "Анализы не найдены" : "Нет анализов"} />
        ) : (
          <div className="divide-y divide-border">
            {items.map((item, idx) => (
              <div
                key={String(item.id)}
                className="flex items-center gap-4 px-4 py-3 hover:bg-[var(--color-muted)]/40 transition-colors animate-float-up"
                style={{ animationDelay: `${idx * 30}ms` }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-foreground truncate">{String(item.name)}</p>
                    {item.code && <Badge variant="muted">{String(item.code)}</Badge>}
                    {item.category && <Badge variant="primary">{String(item.category)}</Badge>}
                  </div>
                  <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">
                    {item.sample_type ? `Образец: ${String(item.sample_type)}` : ""}
                    {item.turnaround_hours != null ? ` · ${String(item.turnaround_hours)} ч` : ""}
                    {item.price != null ? ` · ${String(item.price)} сом` : ""}
                  </p>
                </div>
                <RowActions
                  onEdit={() => openEdit(item)}
                  onDelete={() => handleDelete(String(item.id))}
                  isDeleting={deleteMut.isPending}
                />
              </div>
            ))}
          </div>
        )}
        <Pagination page={page} total={total} limit={limit} onPageChange={setPage} />
      </div>

      {/* Modal */}
      {modalOpen && (
        <EntityModal
          title={editing ? "Редактировать анализ" : "Новый анализ"}
          onClose={closeModal}
          onSubmit={handleSubmit}
          isLoading={isSubmitting}
        >
          <InputField label="Название" required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Общий анализ крови" />
          <div className="grid grid-cols-2 gap-4">
            <InputField label="Код" required value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} placeholder="B01.003" />
            <InputField label="Категория" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} placeholder="Гематология" />
          </div>
          <TextareaField label="Описание" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} />
          <div className="grid grid-cols-2 gap-4">
            <InputField label="Тип образца" value={form.sample_type} onChange={(e) => setForm((f) => ({ ...f, sample_type: e.target.value }))} placeholder="Венозная кровь" />
            <InputField label="Время исполнения (часы)" type="number" min="0" value={form.turnaround_hours} onChange={(e) => setForm((f) => ({ ...f, turnaround_hours: e.target.value }))} />
          </div>
          <InputField label="Цена (сом)" type="number" min="0" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} />
        </EntityModal>
      )}
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB: WARDS (Палаты)
// ══════════════════════════════════════════════════════════════════════════════

const ROOM_TYPES = [
  { value: "CONSULTATION", label: "Кабинет" },
  { value: "WARD", label: "Палата" },
  { value: "ICU", label: "Реанимация" },
  { value: "OPERATING", label: "Операционная" },
  { value: "LAB", label: "Лаборатория" },
  { value: "PHARMACY", label: "Аптека" },
  { value: "RECEPTION", label: "Приёмная" },
  { value: "OTHER", label: "Другое" },
];

const BED_STATUSES: { value: string; label: string; variant: "success" | "destructive" | "warning" | "primary" | "muted" }[] = [
  { value: "AVAILABLE", label: "Свободна", variant: "success" },
  { value: "OCCUPIED", label: "Занята", variant: "destructive" },
  { value: "MAINTENANCE", label: "Обслуживание", variant: "warning" },
  { value: "RESERVED", label: "Забронирована", variant: "primary" },
];

type DepartmentForm = {
  name: string;
  description: string;
};

const EMPTY_DEPARTMENT: DepartmentForm = {
  name: "",
  description: "",
};

type RoomForm = {
  name: string;
  room_number: string;
  room_type: string;
  capacity: string;
  floor: string;
};

const EMPTY_ROOM: RoomForm = {
  name: "",
  room_number: "",
  room_type: "WARD",
  capacity: "4",
  floor: "1",
};

function WardsTab() {
  const qc = useQueryClient();

  // Selection state
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);

  // Department modal
  const [deptModalOpen, setDeptModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Record<string, unknown> | null>(null);
  const [deptForm, setDeptForm] = useState<DepartmentForm>(EMPTY_DEPARTMENT);

  // Room modal
  const [roomModalOpen, setRoomModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Record<string, unknown> | null>(null);
  const [roomForm, setRoomForm] = useState<RoomForm>(EMPTY_ROOM);

  // Bed inline form
  const [bedFormOpen, setBedFormOpen] = useState(false);
  const [bedNumber, setBedNumber] = useState("");
  const [editingBedId, setEditingBedId] = useState<string | null>(null);
  const [editingBedStatus, setEditingBedStatus] = useState<string>("");

  // ── Queries ─────────────────────────────────────────────────────────────────

  const { data: departments, isLoading: loadingDepts } = useQuery({
    queryKey: ["ward-departments"],
    queryFn: patientsApi.getDepartments,
  });

  const deptList: Record<string, unknown>[] = Array.isArray(departments) ? departments : departments?.items ?? [];

  const { data: rooms, isLoading: loadingRooms } = useQuery({
    queryKey: ["ward-rooms", selectedDeptId],
    queryFn: () => patientsApi.getRooms(selectedDeptId!),
    enabled: !!selectedDeptId,
  });

  const roomList: Record<string, unknown>[] = Array.isArray(rooms) ? rooms : rooms?.items ?? [];

  const { data: beds, isLoading: loadingBeds } = useQuery({
    queryKey: ["ward-beds", selectedRoomId],
    queryFn: () => patientsApi.getAllBeds(selectedRoomId!),
    enabled: !!selectedRoomId,
  });

  const bedList: Record<string, unknown>[] = Array.isArray(beds) ? beds : beds?.items ?? [];

  // ── Department mutations ────────────────────────────────────────────────────

  const invalidateDepts = () => qc.invalidateQueries({ queryKey: ["ward-departments"] });

  const createDeptMut = useMutation({
    mutationFn: patientsApi.createDepartment,
    onSuccess: () => { toast.success("Отделение создано"); invalidateDepts(); closeDeptModal(); },
    onError: () => toast.error("Ошибка при создании отделения"),
  });

  const updateDeptMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      patientsApi.updateDepartment(id, data),
    onSuccess: () => { toast.success("Отделение обновлено"); invalidateDepts(); closeDeptModal(); },
    onError: () => toast.error("Ошибка при обновлении"),
  });

  const deleteDeptMut = useMutation({
    mutationFn: patientsApi.deleteDepartment,
    onSuccess: () => {
      toast.success("Отделение удалено");
      invalidateDepts();
      if (selectedDeptId) { setSelectedDeptId(null); setSelectedRoomId(null); }
    },
    onError: () => toast.error("Ошибка при удалении"),
  });

  // ── Room mutations ──────────────────────────────────────────────────────────

  const invalidateRooms = () => qc.invalidateQueries({ queryKey: ["ward-rooms", selectedDeptId] });

  const createRoomMut = useMutation({
    mutationFn: patientsApi.createRoom,
    onSuccess: () => { toast.success("Палата создана"); invalidateRooms(); closeRoomModal(); },
    onError: () => toast.error("Ошибка при создании палаты"),
  });

  const updateRoomMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      patientsApi.updateRoom(id, data),
    onSuccess: () => { toast.success("Палата обновлена"); invalidateRooms(); closeRoomModal(); },
    onError: () => toast.error("Ошибка при обновлении"),
  });

  const deleteRoomMut = useMutation({
    mutationFn: patientsApi.deleteRoom,
    onSuccess: () => {
      toast.success("Палата удалена");
      invalidateRooms();
      if (selectedRoomId) setSelectedRoomId(null);
    },
    onError: () => toast.error("Ошибка при удалении"),
  });

  // ── Bed mutations ───────────────────────────────────────────────────────────

  const invalidateBeds = () => qc.invalidateQueries({ queryKey: ["ward-beds", selectedRoomId] });

  const createBedMut = useMutation({
    mutationFn: ({ roomId, data }: { roomId: string; data: { bed_number: string } }) =>
      patientsApi.createBed(roomId, data),
    onSuccess: () => { toast.success("Койка добавлена"); invalidateBeds(); setBedFormOpen(false); setBedNumber(""); },
    onError: () => toast.error("Ошибка при создании койки"),
  });

  const updateBedMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      patientsApi.updateBed(id, data),
    onSuccess: () => { toast.success("Койка обновлена"); invalidateBeds(); setEditingBedId(null); },
    onError: () => toast.error("Ошибка при обновлении"),
  });

  const deleteBedMut = useMutation({
    mutationFn: patientsApi.deleteBed,
    onSuccess: () => { toast.success("Койка удалена"); invalidateBeds(); },
    onError: () => toast.error("Ошибка при удалении"),
  });

  // ── Department handlers ─────────────────────────────────────────────────────

  function openCreateDept() {
    setEditingDept(null);
    setDeptForm(EMPTY_DEPARTMENT);
    setDeptModalOpen(true);
  }

  function openEditDept(item: Record<string, unknown>) {
    setEditingDept(item);
    setDeptForm({
      name: String(item.name ?? ""),
      description: String(item.description ?? ""),
    });
    setDeptModalOpen(true);
  }

  function closeDeptModal() { setDeptModalOpen(false); setEditingDept(null); }

  function handleDeptSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      name: deptForm.name,
      description: deptForm.description || undefined,
    };
    if (editingDept) {
      updateDeptMut.mutate({ id: String(editingDept.id), data: payload });
    } else {
      createDeptMut.mutate(payload as { name: string; description?: string });
    }
  }

  function handleDeleteDept(id: string) {
    if (!window.confirm("Удалить отделение? Все палаты и койки в нём будут удалены.")) return;
    deleteDeptMut.mutate(id);
  }

  // ── Room handlers ───────────────────────────────────────────────────────────

  function openCreateRoom() {
    setEditingRoom(null);
    setRoomForm(EMPTY_ROOM);
    setRoomModalOpen(true);
  }

  function openEditRoom(item: Record<string, unknown>) {
    setEditingRoom(item);
    setRoomForm({
      name: String(item.name ?? ""),
      room_number: String(item.room_number ?? ""),
      room_type: String(item.room_type ?? "WARD"),
      capacity: item.capacity != null ? String(item.capacity) : "4",
      floor: item.floor != null ? String(item.floor) : "",
    });
    setRoomModalOpen(true);
  }

  function closeRoomModal() { setRoomModalOpen(false); setEditingRoom(null); }

  function handleRoomSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      department_id: selectedDeptId!,
      name: roomForm.name,
      room_number: roomForm.room_number,
      room_type: roomForm.room_type,
      capacity: Number(roomForm.capacity),
      floor: roomForm.floor ? Number(roomForm.floor) : undefined,
    };
    if (editingRoom) {
      updateRoomMut.mutate({ id: String(editingRoom.id), data: payload });
    } else {
      createRoomMut.mutate(payload);
    }
  }

  function handleDeleteRoom(id: string) {
    if (!window.confirm("Удалить палату? Все койки в ней будут удалены.")) return;
    deleteRoomMut.mutate(id);
  }

  // ── Bed handlers ────────────────────────────────────────────────────────────

  function handleCreateBed(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedRoomId || !bedNumber.trim()) return;
    createBedMut.mutate({ roomId: selectedRoomId, data: { bed_number: bedNumber.trim() } });
  }

  function handleDeleteBed(id: string) {
    if (!window.confirm("Удалить койку?")) return;
    deleteBedMut.mutate(id);
  }

  function handleBedStatusChange(bedId: string, newStatus: string) {
    updateBedMut.mutate({ id: bedId, data: { status: newStatus } });
    setEditingBedId(null);
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  function bedStatusInfo(status: string) {
    return BED_STATUSES.find((s) => s.value === status) ?? { value: status, label: status, variant: "muted" as const };
  }

  const isDeptSubmitting = createDeptMut.isPending || updateDeptMut.isPending;
  const isRoomSubmitting = createRoomMut.isPending || updateRoomMut.isPending;

  // Find selected dept/room names for breadcrumbs
  const selectedDept = deptList.find((d) => String(d.id) === selectedDeptId);
  const selectedRoom = roomList.find((r) => String(r.id) === selectedRoomId);

  return (
    <>
      {/* Three-panel layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-float-up" style={{ animationDelay: "200ms" }}>

        {/* ── Panel 1: Departments ──────────────────────────────────────────── */}
        <div className="bg-[var(--color-surface)] rounded-2xl border border-border overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="text-sm font-bold text-foreground">Отделения</h3>
            <button
              type="button"
              onClick={openCreateDept}
              className="flex items-center gap-1 text-xs font-medium text-secondary hover:text-secondary/80 transition-colors"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="12" x2="12" y1="5" y2="19" /><line x1="5" x2="19" y1="12" y2="12" />
              </svg>
              Добавить
            </button>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[500px]">
            {loadingDepts ? (
              <SkeletonRows count={4} />
            ) : deptList.length === 0 ? (
              <EmptyState message="Нет отделений" />
            ) : (
              <div className="divide-y divide-border">
                {deptList.map((dept) => {
                  const isSelected = String(dept.id) === selectedDeptId;
                  return (
                    <div
                      key={String(dept.id)}
                      onClick={() => {
                        setSelectedDeptId(String(dept.id));
                        setSelectedRoomId(null);
                      }}
                      className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
                        isSelected
                          ? "bg-secondary/10 border-l-2 border-l-secondary"
                          : "hover:bg-[var(--color-muted)]/40"
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${isSelected ? "text-secondary" : "text-foreground"}`}>
                          {String(dept.name)}
                        </p>
                        {dept.description && (
                          <p className="text-xs text-[var(--color-text-tertiary)] truncate mt-0.5">
                            {String(dept.description)}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); openEditDept(dept); }}
                          title="Редактировать"
                          className="p-1 rounded-lg text-[var(--color-text-tertiary)] hover:text-foreground hover:bg-[var(--color-muted)] transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleDeleteDept(String(dept.id)); }}
                          disabled={deleteDeptMut.isPending}
                          title="Удалить"
                          className="p-1 rounded-lg text-[var(--color-text-tertiary)] hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-40"
                        >
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                            <path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Panel 2: Rooms ────────────────────────────────────────────────── */}
        <div className="bg-[var(--color-surface)] rounded-2xl border border-border overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="text-sm font-bold text-foreground">
              Палаты
              {selectedDept && (
                <span className="font-normal text-[var(--color-text-tertiary)]"> — {String(selectedDept.name)}</span>
              )}
            </h3>
            {selectedDeptId && (
              <button
                type="button"
                onClick={openCreateRoom}
                className="flex items-center gap-1 text-xs font-medium text-secondary hover:text-secondary/80 transition-colors"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="12" x2="12" y1="5" y2="19" /><line x1="5" x2="19" y1="12" y2="12" />
                </svg>
                Добавить
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto max-h-[500px]">
            {!selectedDeptId ? (
              <div className="p-12 text-center">
                <svg className="w-10 h-10 mx-auto mb-2 text-[var(--color-text-tertiary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" x2="9" y1="12" y2="12" />
                </svg>
                <p className="text-xs text-[var(--color-text-tertiary)]">Выберите отделение слева</p>
              </div>
            ) : loadingRooms ? (
              <SkeletonRows count={4} />
            ) : roomList.length === 0 ? (
              <EmptyState message="Нет палат в этом отделении" />
            ) : (
              <div className="divide-y divide-border">
                {roomList.map((room) => {
                  const isSelected = String(room.id) === selectedRoomId;
                  return (
                    <div
                      key={String(room.id)}
                      onClick={() => setSelectedRoomId(String(room.id))}
                      className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
                        isSelected
                          ? "bg-secondary/10 border-l-2 border-l-secondary"
                          : "hover:bg-[var(--color-muted)]/40"
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className={`text-sm font-medium truncate ${isSelected ? "text-secondary" : "text-foreground"}`}>
                            {String(room.name || room.room_number)}
                          </p>
                          <Badge variant="muted">
                            {labelFor(ROOM_TYPES, String(room.room_type ?? "OTHER"))}
                          </Badge>
                        </div>
                        <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">
                          №{String(room.room_number)}
                          {room.capacity ? ` · ${String(room.capacity)} мест` : ""}
                          {room.floor ? ` · ${String(room.floor)} этаж` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); openEditRoom(room); }}
                          title="Редактировать"
                          className="p-1 rounded-lg text-[var(--color-text-tertiary)] hover:text-foreground hover:bg-[var(--color-muted)] transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleDeleteRoom(String(room.id)); }}
                          disabled={deleteRoomMut.isPending}
                          title="Удалить"
                          className="p-1 rounded-lg text-[var(--color-text-tertiary)] hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-40"
                        >
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                            <path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Panel 3: Beds ─────────────────────────────────────────────────── */}
        <div className="bg-[var(--color-surface)] rounded-2xl border border-border overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="text-sm font-bold text-foreground">
              Койки
              {selectedRoom && (
                <span className="font-normal text-[var(--color-text-tertiary)]"> — {String(selectedRoom.name || selectedRoom.room_number)}</span>
              )}
            </h3>
            {selectedRoomId && (
              <button
                type="button"
                onClick={() => { setBedFormOpen(true); setBedNumber(""); }}
                className="flex items-center gap-1 text-xs font-medium text-secondary hover:text-secondary/80 transition-colors"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="12" x2="12" y1="5" y2="19" /><line x1="5" x2="19" y1="12" y2="12" />
                </svg>
                Добавить
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto max-h-[500px]">
            {!selectedRoomId ? (
              <div className="p-12 text-center">
                <svg className="w-10 h-10 mx-auto mb-2 text-[var(--color-text-tertiary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" x2="9" y1="12" y2="12" />
                </svg>
                <p className="text-xs text-[var(--color-text-tertiary)]">Выберите палату слева</p>
              </div>
            ) : loadingBeds ? (
              <SkeletonRows count={3} />
            ) : (
              <>
                {/* Inline add form */}
                {bedFormOpen && (
                  <form onSubmit={handleCreateBed} className="flex items-center gap-2 px-4 py-3 border-b border-border bg-[var(--color-muted)]/30">
                    <InputField
                      value={bedNumber}
                      onChange={(e) => setBedNumber(e.target.value)}
                      placeholder="Номер койки"
                      className="flex-1"
                      autoFocus
                    />
                    <Button type="submit" size="sm" loading={createBedMut.isPending} disabled={!bedNumber.trim()}>
                      Добавить
                    </Button>
                    <button
                      type="button"
                      onClick={() => setBedFormOpen(false)}
                      className="p-1.5 rounded-lg text-[var(--color-text-tertiary)] hover:text-foreground hover:bg-[var(--color-muted)] transition-colors"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <line x1="18" x2="6" y1="6" y2="18" /><line x1="6" x2="18" y1="6" y2="18" />
                      </svg>
                    </button>
                  </form>
                )}

                {bedList.length === 0 && !bedFormOpen ? (
                  <EmptyState message="Нет коек в этой палате" />
                ) : (
                  <div className="divide-y divide-border">
                    {bedList.map((bed) => {
                      const status = bedStatusInfo(String(bed.status ?? "AVAILABLE"));
                      const isEditingThis = editingBedId === String(bed.id);
                      return (
                        <div
                          key={String(bed.id)}
                          className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--color-muted)]/40 transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-foreground">
                                Койка {String(bed.bed_number)}
                              </p>
                              <Badge variant={status.variant} dot>
                                {status.label}
                              </Badge>
                            </div>
                          </div>

                          {/* Status editing dropdown */}
                          {isEditingThis ? (
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <CustomSelect
                                value={editingBedStatus}
                                onChange={(v) => {
                                  setEditingBedStatus(v);
                                  handleBedStatusChange(String(bed.id), v);
                                }}
                                options={BED_STATUSES.map((s) => ({ value: s.value, label: s.label }))}
                                placeholder="Статус"
                                className="w-40"
                              />
                              <button
                                type="button"
                                onClick={() => setEditingBedId(null)}
                                className="p-1 rounded-lg text-[var(--color-text-tertiary)] hover:text-foreground hover:bg-[var(--color-muted)] transition-colors"
                              >
                                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                  <line x1="18" x2="6" y1="6" y2="18" /><line x1="6" x2="18" y1="6" y2="18" />
                                </svg>
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingBedId(String(bed.id));
                                  setEditingBedStatus(String(bed.status ?? "AVAILABLE"));
                                }}
                                title="Изменить статус"
                                className="p-1 rounded-lg text-[var(--color-text-tertiary)] hover:text-foreground hover:bg-[var(--color-muted)] transition-colors"
                              >
                                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z" />
                                </svg>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteBed(String(bed.id))}
                                disabled={deleteBedMut.isPending}
                                title="Удалить"
                                className="p-1 rounded-lg text-[var(--color-text-tertiary)] hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-40"
                              >
                                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                  <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                                  <path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                                </svg>
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Department Modal ────────────────────────────────────────────────── */}
      {deptModalOpen && (
        <EntityModal
          title={editingDept ? "Редактировать отделение" : "Новое отделение"}
          onClose={closeDeptModal}
          onSubmit={handleDeptSubmit}
          isLoading={isDeptSubmitting}
        >
          <InputField
            label="Название"
            required
            value={deptForm.name}
            onChange={(e) => setDeptForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Неврология"
          />
          <TextareaField
            label="Описание"
            value={deptForm.description}
            onChange={(e) => setDeptForm((f) => ({ ...f, description: e.target.value }))}
            rows={2}
            placeholder="Описание отделения..."
          />
        </EntityModal>
      )}

      {/* ── Room Modal ──────────────────────────────────────────────────────── */}
      {roomModalOpen && (
        <EntityModal
          title={editingRoom ? "Редактировать палату" : "Новая палата"}
          onClose={closeRoomModal}
          onSubmit={handleRoomSubmit}
          isLoading={isRoomSubmitting}
        >
          <InputField
            label="Название"
            required
            value={roomForm.name}
            onChange={(e) => setRoomForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Палата 201"
          />
          <div className="grid grid-cols-2 gap-4">
            <InputField
              label="Номер"
              required
              value={roomForm.room_number}
              onChange={(e) => setRoomForm((f) => ({ ...f, room_number: e.target.value }))}
              placeholder="201"
            />
            <CustomSelect
              label="Тип"
              value={roomForm.room_type}
              onChange={(v) => setRoomForm((f) => ({ ...f, room_type: v }))}
              options={ROOM_TYPES}
              placeholder="Тип помещения"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <InputField
              label="Вместимость"
              type="number"
              min="1"
              required
              value={roomForm.capacity}
              onChange={(e) => setRoomForm((f) => ({ ...f, capacity: e.target.value }))}
            />
            <InputField
              label="Этаж"
              type="number"
              min="1"
              value={roomForm.floor}
              onChange={(e) => setRoomForm((f) => ({ ...f, floor: e.target.value }))}
            />
          </div>
        </EntityModal>
      )}
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════════════════

function MedicineSettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>("exercises");

  const { data: stats } = useQuery({
    queryKey: ["medicine-settings-stats"],
    queryFn: settingsApi.getStats,
    staleTime: 60 * 1000,
  });

  return (
    <div className="max-w-7xl">
      {/* Page header */}
      <div className="mb-6 animate-float-up">
        <h1 className="text-[26px] font-bold text-foreground tracking-tight">Настройки медицины</h1>
        <p className="text-[var(--color-text-secondary)] text-sm mt-1">
          Справочники упражнений, лекарств, процедур, анализов и палат
        </p>
      </div>

      {/* Stats strip */}
      <StatsStrip stats={stats} />

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
      {activeTab === "exercises" && <ExercisesTab />}
      {activeTab === "drugs" && <DrugsTab />}
      {activeTab === "procedures" && <ProceduresTab />}
      {activeTab === "lab-tests" && <LabTestsTab />}
      {activeTab === "wards" && <WardsTab />}
    </div>
  );
}

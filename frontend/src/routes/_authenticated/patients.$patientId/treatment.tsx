import { createFileRoute } from "@tanstack/react-router";
import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import {
  useState,
  useRef,
  useEffect,
  useCallback,
  Fragment,
} from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { patientsApi } from "@/features/patients/api";
import { Button } from "@/components/ui/button";
import { InputField } from "@/components/ui/input-field";
import { TextareaField } from "@/components/ui/textarea-field";
import { CustomSelect } from "@/components/ui/select-custom";
import { DatePicker } from "@/components/ui/date-picker";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute(
  "/_authenticated/patients/$patientId/treatment"
)({
  component: TreatmentPage,
});

// ─── Types ────────────────────────────────────────────────────────────────────

interface TreatmentPlan {
  id: string;
  title: string;
  status: string;
  start_date: string;
  end_date: string;
  description?: string;
  items?: TreatmentItem[];
}

interface TreatmentItem {
  id: string;
  item_type: string;
  status: string;
  scheduled_at?: string;
  notes?: string;
  // Medication fields
  drug_id?: string;
  drug_name?: string;
  dosage?: string;
  route?: string;
  frequency?: string;
  duration_days?: number;
  is_prn?: boolean;
  // Procedure fields
  procedure_id?: string;
  procedure_name?: string;
  // Lab test fields
  test_id?: string;
  test_name?: string;
  priority?: string;
  // Exercise fields
  exercise_id?: string;
  exercise_name?: string;
  sets?: number;
  reps?: number;
  // Therapy fields
  title?: string;
  description?: string;
}

type ItemType = "MEDICATION" | "PROCEDURE" | "LAB_TEST" | "EXERCISE" | "THERAPY";

interface CalendarCell {
  day: Date;
  hour: number;
  minute: number;
}

interface QuickAddState {
  cell: CalendarCell;
  anchorRect: DOMRect;
  step: "type" | "form";
  itemType: ItemType | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_COLOR: Record<ItemType, string> = {
  MEDICATION: "#22C55E",
  PROCEDURE: "#3B82F6",
  LAB_TEST: "#F59E0B",
  EXERCISE: "#14B8A6",
  THERAPY: "#7E78D2",
};

const TYPE_EMOJI: Record<ItemType, string> = {
  MEDICATION: "💊",
  PROCEDURE: "🔧",
  LAB_TEST: "🧪",
  EXERCISE: "🏃",
  THERAPY: "📋",
};

const TYPE_LABEL: Record<ItemType, string> = {
  MEDICATION: "Лекарство",
  PROCEDURE: "Процедура",
  LAB_TEST: "Анализ",
  EXERCISE: "Упражнение",
  THERAPY: "Терапия",
};

const STATUS_META: Record<string, { label: string; variant: "warning" | "success" | "muted" | "destructive" }> = {
  DRAFT:     { label: "Черновик",  variant: "warning"     },
  ACTIVE:    { label: "Активный",  variant: "success"     },
  COMPLETED: { label: "Завершён",  variant: "muted"       },
  CANCELLED: { label: "Отменён",   variant: "destructive" },
};

const ITEM_STATUS_META: Record<string, { label: string; variant: "muted" | "warning" | "success" | "destructive" }> = {
  PENDING:     { label: "Ожидает",     variant: "muted"       },
  IN_PROGRESS: { label: "Выполняется", variant: "warning"     },
  COMPLETED:   { label: "Завершено",   variant: "success"     },
  CANCELLED:   { label: "Отменено",    variant: "destructive" },
  SKIPPED:     { label: "Пропущено",   variant: "muted"       },
};

const FREQUENCY_OPTIONS = [
  { value: "1 раз/день",   label: "1 раз в день"    },
  { value: "2 раза/день",  label: "2 раза в день"   },
  { value: "3 раза/день",  label: "3 раза в день"   },
  { value: "Каждые 8ч",   label: "Каждые 8 часов"  },
  { value: "Каждые 6ч",   label: "Каждые 6 часов"  },
  { value: "Утром",        label: "Утром"            },
  { value: "Вечером",      label: "Вечером"          },
  { value: "На ночь",      label: "На ночь"          },
  { value: "По необходимости", label: "По необходимости" },
];

const EXERCISE_FREQUENCY_OPTIONS = [
  { value: "Ежедневно",    label: "Ежедневно"        },
  { value: "Через день",   label: "Через день"       },
  { value: "3 раза/нед",  label: "3 раза в неделю"  },
  { value: "2 раза/нед",  label: "2 раза в неделю"  },
];

const DURATION_OPTIONS = [
  { value: "7",   label: "7 дней"    },
  { value: "14",  label: "14 дней"   },
  { value: "30",  label: "30 дней"   },
  { value: "60",  label: "60 дней"   },
  { value: "90",  label: "90 дней"   },
];

const PRIORITY_OPTIONS = [
  { value: "ROUTINE", label: "Плановый" },
  { value: "URGENT",  label: "Срочный"  },
  { value: "CITO",    label: "Cito"     },
];

const ROUTE_OPTIONS = [
  { value: "oral",        label: "Перорально" },
  { value: "iv",          label: "В/В"        },
  { value: "im",          label: "В/М"        },
  { value: "topical",     label: "Наружно"    },
  { value: "sublingual",  label: "Под язык"   },
  { value: "inhalation",  label: "Ингаляция"  },
  { value: "sc",          label: "Подкожно"   },
  { value: "rectal",      label: "Ректально"  },
];

const RU_DAYS = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
const RU_DAYS_FULL = ["Воскресенье", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"];

// ─── Exercise Picker ─────────────────────────────────────────────────────────

const CATEGORY_INFO: Record<string, { label: string; color: string; icon: string }> = {
  UPPER_LIMB: { label: "Верхние конечности", color: "#7E78D2", icon: "🤲" },
  LOWER_LIMB: { label: "Нижние конечности", color: "#22C55E", icon: "🦵" },
  BALANCE:    { label: "Баланс",            color: "#F59E0B", icon: "⚖️" },
  GAIT:       { label: "Ходьба",            color: "#3B82F6", icon: "🚶" },
  COGNITIVE:  { label: "Когнитивные",       color: "#EC4899", icon: "🧠" },
};

const DIFFICULTY_INFO: Record<string, { label: string; color: string }> = {
  EASY:   { label: "Лёгкое",  color: "#22C55E" },
  MEDIUM: { label: "Среднее", color: "#F59E0B" },
  HARD:   { label: "Сложное", color: "#EF4444" },
};

function ExercisePickerModal({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (exercise: Record<string, unknown>) => void;
}) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const debouncedSearch = useDebounce(search, 300);

  const { data } = useQuery({
    queryKey: ["exercise-picker-catalog", debouncedSearch, categoryFilter],
    queryFn: () =>
      patientsApi.getTreatmentCatalogExercises(
        debouncedSearch || undefined,
        categoryFilter || undefined
      ),
    enabled: open,
  });

  const exercises = (data ?? []) as Array<Record<string, unknown>>;
  const selected = selectedId ? exercises.find((e) => e.id === selectedId) : null;

  useEffect(() => {
    if (!open) {
      setSearch("");
      setCategoryFilter("");
      setSelectedId(null);
    }
  }, [open]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative bg-[var(--color-surface)] rounded-2xl border border-border shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col animate-float-up overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-foreground">Выбор упражнения</h2>
            <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">
              Выберите упражнение для назначения пациенту
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-[var(--color-text-tertiary)] hover:text-foreground hover:bg-[var(--color-muted)] transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search + Filter */}
        <div className="px-6 py-3 border-b border-border flex-shrink-0 space-y-2">
          <InputField
            placeholder="Поиск упражнения..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
          <div className="flex gap-1.5 flex-wrap">
            <button
              onClick={() => setCategoryFilter("")}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                !categoryFilter
                  ? "bg-secondary text-white"
                  : "bg-[var(--color-muted)] text-[var(--color-text-secondary)] hover:text-foreground"
              }`}
            >
              Все
            </button>
            {Object.entries(CATEGORY_INFO).map(([key, info]) => (
              <button
                key={key}
                onClick={() => setCategoryFilter(categoryFilter === key ? "" : key)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${
                  categoryFilter === key
                    ? "text-white"
                    : "bg-[var(--color-muted)] text-[var(--color-text-secondary)] hover:text-foreground"
                }`}
                style={categoryFilter === key ? { backgroundColor: info.color } : undefined}
              >
                <span>{info.icon}</span> {info.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content: List + Detail split */}
        <div className="flex flex-1 overflow-hidden min-h-0">
          {/* Exercise list */}
          <div className="w-1/2 overflow-y-auto border-r border-border">
            {exercises.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm text-[var(--color-text-tertiary)]">
                  {search ? "Ничего не найдено" : "Нет упражнений"}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {exercises.map((ex) => {
                  const cat = CATEGORY_INFO[ex.category as string];
                  const diff = DIFFICULTY_INFO[ex.difficulty as string];
                  const isSelected = selectedId === ex.id;
                  return (
                    <button
                      key={ex.id as string}
                      onClick={() => setSelectedId(ex.id as string)}
                      onDoubleClick={() => onSelect(ex)}
                      className={`w-full text-left p-4 transition-all ${
                        isSelected
                          ? "bg-secondary/10 border-l-4 border-l-secondary"
                          : "hover:bg-[var(--color-muted)]/50 border-l-4 border-l-transparent"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-foreground">
                          {ex.name as string}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {cat && (
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                            style={{ backgroundColor: `${cat.color}18`, color: cat.color }}
                          >
                            {cat.icon} {cat.label}
                          </span>
                        )}
                        {diff && (
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                            style={{ backgroundColor: `${diff.color}18`, color: diff.color }}
                          >
                            {diff.label}
                          </span>
                        )}
                        <span className="text-[10px] text-[var(--color-text-tertiary)]">
                          {ex.default_sets as number}×{ex.default_reps as number}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Detail panel */}
          <div className="w-1/2 overflow-y-auto p-5">
            {selected ? (
              <div className="space-y-4">
                {/* Exercise name and meta */}
                <div>
                  <h3 className="text-lg font-bold text-foreground mb-2">
                    {selected.name as string}
                  </h3>
                  <div className="flex items-center gap-2 flex-wrap mb-3">
                    {CATEGORY_INFO[selected.category as string] && (
                      <Badge variant="secondary">
                        {CATEGORY_INFO[selected.category as string].icon}{" "}
                        {CATEGORY_INFO[selected.category as string].label}
                      </Badge>
                    )}
                    {DIFFICULTY_INFO[selected.difficulty as string] && (
                      <Badge
                        variant={
                          selected.difficulty === "EASY"
                            ? "success"
                            : selected.difficulty === "HARD"
                            ? "destructive"
                            : "warning"
                        }
                      >
                        {DIFFICULTY_INFO[selected.difficulty as string].label}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Description */}
                {selected.description && (
                  <div className="bg-[var(--color-muted)]/50 rounded-xl p-4">
                    <p className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-2">
                      Описание
                    </p>
                    <p className="text-sm text-foreground leading-relaxed">
                      {selected.description as string}
                    </p>
                  </div>
                )}

                {/* Instructions */}
                {selected.instructions && (
                  <div className="bg-primary/5 rounded-xl p-4 border border-primary/10">
                    <p className="text-xs font-semibold text-[var(--color-primary-deep)] uppercase tracking-wider mb-2">
                      Инструкции для пациента
                    </p>
                    <div className="space-y-1.5">
                      {(selected.instructions as string).split("\n").map((line, i) => (
                        <p key={i} className="text-sm text-foreground flex gap-2">
                          {line.match(/^\d+\./) ? (
                            <>
                              <span className="text-secondary font-semibold flex-shrink-0 w-5 text-right">
                                {line.match(/^\d+/)?.[0]}.
                              </span>
                              <span>{line.replace(/^\d+\.\s*/, "")}</span>
                            </>
                          ) : (
                            <span>{line}</span>
                          )}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {/* Demo video placeholder */}
                {selected.demo_video_url ? (
                  <div className="rounded-xl overflow-hidden border border-border">
                    <video
                      src={selected.demo_video_url as string}
                      controls
                      className="w-full"
                      poster=""
                    />
                  </div>
                ) : (
                  <div className="rounded-xl bg-[var(--color-muted)] p-6 text-center border border-border">
                    <svg
                      className="w-10 h-10 mx-auto mb-2 text-[var(--color-text-tertiary)]"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    >
                      <rect width="18" height="18" x="3" y="3" rx="2" />
                      <path d="m10 8 6 4-6 4Z" />
                    </svg>
                    <p className="text-xs text-[var(--color-text-tertiary)]">
                      Видео-демонстрация будет доступна позже
                    </p>
                  </div>
                )}

                {/* Default parameters */}
                <div className="flex items-center gap-4 text-sm text-[var(--color-text-secondary)]">
                  <span>По умолчанию: <strong className="text-foreground">{selected.default_sets as number} подходов</strong></span>
                  <span>× <strong className="text-foreground">{selected.default_reps as number} повторений</strong></span>
                </div>

                {/* Select button */}
                <Button
                  variant="primary"
                  className="w-full"
                  onClick={() => onSelect(selected)}
                >
                  Выбрать это упражнение
                </Button>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <svg
                    className="w-12 h-12 mx-auto mb-3 text-[var(--color-text-tertiary)]"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                  </svg>
                  <p className="text-sm text-[var(--color-text-tertiary)]">
                    Выберите упражнение из списка слева
                  </p>
                  <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
                    Двойной клик для быстрого выбора
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function isToday(d: Date): boolean {
  return isSameDay(d, new Date());
}

function padZ(n: number): string {
  return String(n).padStart(2, "0");
}

function formatDateShort(d: Date): string {
  return `${padZ(d.getDate())}.${padZ(d.getMonth() + 1)}`;
}

function frequencyToTimes(frequency: string): string[] {
  if (!frequency) return ["08:00"];
  const f = frequency.toLowerCase().trim();

  // Exact matches
  const map: Record<string, string[]> = {
    "1 раз/день": ["08:00"], "2 раза/день": ["08:00", "20:00"],
    "3 раза/день": ["08:00", "14:00", "20:00"],
    "каждые 8ч": ["08:00", "16:00", "00:00"], "каждые 6ч": ["06:00", "12:00", "18:00", "00:00"],
    "утром": ["08:00"], "вечером": ["20:00"], "на ночь": ["22:00"],
    "ежедневно": ["09:00"], "через день": ["09:00"],
    "3 раза/нед": ["09:00"], "2 раза/нед": ["09:00"],
    "по необходимости": ["08:00"],
  };
  if (map[f]) return map[f];

  // Fuzzy patterns
  if (/1.*раз|1x|once|1\s*р/i.test(f)) return ["08:00"];
  if (/2.*раз|2x|twice|2\s*р/i.test(f)) return ["08:00", "20:00"];
  if (/3.*раз|3x|thrice|3\s*р/i.test(f)) return ["08:00", "14:00", "20:00"];
  if (/4.*раз|4x|4\s*р/i.test(f)) return ["07:00", "12:00", "17:00", "22:00"];
  if (/8.*час|8.*hour|q8h/i.test(f)) return ["08:00", "16:00", "00:00"];
  if (/6.*час|6.*hour|q6h/i.test(f)) return ["06:00", "12:00", "18:00", "00:00"];
  if (/daily|ежедн|каждый день/i.test(f)) return ["08:00"];
  if (/week|нед/i.test(f)) return ["09:00"];
  if (/утр|morn/i.test(f)) return ["08:00"];
  if (/вечер|even/i.test(f)) return ["20:00"];
  if (/ночь|night|bedtime/i.test(f)) return ["22:00"];

  return ["08:00"];
}

function getItemDisplayTitle(item: TreatmentItem): string {
  if (item.drug_name)      return item.drug_name;
  if (item.procedure_name) return item.procedure_name;
  if (item.test_name)      return item.test_name;
  if (item.exercise_name)  return item.exercise_name;
  if (item.title)          return item.title;
  return TYPE_LABEL[item.item_type as ItemType] ?? item.item_type;
}

/**
 * Returns { day ISO string -> { hour -> items[] } } for calendar rendering.
 * Repeating items (medications, exercises) are expanded across the plan's date range,
 * restricted to the displayed week.
 */
function buildCalendarMap(
  items: TreatmentItem[],
  weekDays: Date[],
  planStartDate: string,
  planEndDate: string
): Map<string, Map<number, TreatmentItem[]>> {
  const map = new Map<string, Map<number, TreatmentItem[]>>();

  const planStart = planStartDate ? new Date(planStartDate) : new Date(0);
  planStart.setHours(0, 0, 0, 0);
  const planEnd = planEndDate ? new Date(planEndDate) : new Date(2099, 0, 1);
  planEnd.setHours(23, 59, 59, 999);

  const ensureCell = (dayKey: string, hour: number) => {
    if (!map.has(dayKey)) map.set(dayKey, new Map());
    const dayMap = map.get(dayKey)!;
    if (!dayMap.has(hour)) dayMap.set(hour, []);
    return dayMap.get(hour)!;
  };

  for (const item of items) {
    // Try to find scheduled_at from item or its configuration
    const scheduledAt = item.scheduled_at
      || (item.configuration as Record<string, unknown> | undefined)?.scheduled_at as string | undefined;

    if (scheduledAt) {
      // One-time event at exact day/hour
      const dt = new Date(scheduledAt);
      const hour = dt.getHours();
      const dayKey = dt.toDateString();
      const matchingDay = weekDays.find(d => d.toDateString() === dayKey);
      if (matchingDay) {
        ensureCell(dayKey, hour).push(item);
      }
    } else if (item.frequency) {
      // Repeating: expand across week days within plan range
      const times = frequencyToTimes(item.frequency);
      const freq = (item.frequency || "").toLowerCase();
      // Determine which days of the week this repeats on
      const isWeekly = /нед|week/i.test(freq);
      const isEveryOther = /через день|every other/i.test(freq);
      // For "3 раза/нед" → Mon, Wed, Fri; "2 раза/нед" → Mon, Thu
      const weeklyDays3 = new Set([1, 3, 5]); // Mon, Wed, Fri
      const weeklyDays2 = new Set([1, 4]); // Mon, Thu
      const numPerWeek = /3/.test(freq) ? 3 : /2/.test(freq) ? 2 : 7;

      for (const day of weekDays) {
        if (day < planStart || day > planEnd) continue;
        const dow = day.getDay(); // 0=Sun..6=Sat
        if (isWeekly && numPerWeek === 3 && !weeklyDays3.has(dow)) continue;
        if (isWeekly && numPerWeek === 2 && !weeklyDays2.has(dow)) continue;
        if (isEveryOther) {
          const daysSinceStart = Math.floor((day.getTime() - planStart.getTime()) / 86400000);
          if (daysSinceStart % 2 !== 0) continue;
        }
        const dayKey = day.toDateString();
        for (const t of times) {
          const hour = parseInt(t.split(":")[0], 10);
          if (hour >= 6 && hour <= 23) {
            ensureCell(dayKey, hour).push(item);
          }
        }
      }
    } else {
      // No scheduled_at and no frequency — show on plan start or today
      const fallbackDate = planStartDate ? new Date(planStartDate) : new Date();
      const dayKey = fallbackDate.toDateString();
      const matchingDay = weekDays.find(d => d.toDateString() === dayKey);
      if (matchingDay) {
        ensureCell(dayKey, 8).push(item); // default to 08:00
      }
    }
  }

  return map;
}

// ─── Catalog Search Hook ───────────────────────────────────────────────────────

function useCatalogSearch(itemType: ItemType | null, search: string) {
  const debouncedSearch = useDebounce(search, 300);

  const drugQuery = useQuery({
    queryKey: ["catalog-drugs", debouncedSearch],
    queryFn: () => patientsApi.getTreatmentCatalogDrugs(debouncedSearch || undefined),
    enabled: itemType === "MEDICATION",
  });

  const procedureQuery = useQuery({
    queryKey: ["catalog-procedures", debouncedSearch],
    queryFn: () => patientsApi.getTreatmentCatalogProcedures(debouncedSearch || undefined),
    enabled: itemType === "PROCEDURE",
  });

  const labQuery = useQuery({
    queryKey: ["catalog-labs", debouncedSearch],
    queryFn: () => patientsApi.getTreatmentCatalogLabTests(debouncedSearch || undefined),
    enabled: itemType === "LAB_TEST",
  });

  const exerciseQuery = useQuery({
    queryKey: ["catalog-exercises", debouncedSearch],
    queryFn: () => patientsApi.getTreatmentCatalogExercises(debouncedSearch || undefined),
    enabled: itemType === "EXERCISE",
  });

  if (itemType === "MEDICATION") return { data: drugQuery.data ?? [], loading: drugQuery.isLoading };
  if (itemType === "PROCEDURE")  return { data: procedureQuery.data ?? [], loading: procedureQuery.isLoading };
  if (itemType === "LAB_TEST")   return { data: labQuery.data ?? [], loading: labQuery.isLoading };
  if (itemType === "EXERCISE")   return { data: exerciseQuery.data ?? [], loading: exerciseQuery.isLoading };
  return { data: [], loading: false };
}

// ─── Calendar Block ────────────────────────────────────────────────────────────

interface CalendarBlockProps {
  item: TreatmentItem;
  index: number;
  total: number;
  onClick: (e: React.MouseEvent) => void;
}

function CalendarBlock({ item, index, total: _total, onClick }: CalendarBlockProps) {
  const type = item.item_type as ItemType;
  const color = TYPE_COLOR[type] ?? "#6B7280";
  const title = getItemDisplayTitle(item);
  const isRepeating = !item.scheduled_at && !!item.frequency;

  // Stack vertically — each block is 18px tall
  const topPx = 2 + index * 20;

  return (
    <div
      onClick={(e) => { e.stopPropagation(); onClick(e); }}
      title={`${TYPE_LABEL[type]}: ${title}${item.frequency ? ` (${item.frequency})` : ""}`}
      className="absolute left-0.5 right-0.5 rounded-[5px] px-1 py-px text-[9px] font-medium truncate cursor-pointer transition-all hover:brightness-110 hover:z-20 select-none z-[2]"
      style={{
        backgroundColor: `${color}20`,
        color,
        borderLeft: `3px solid ${color}`,
        top: `${topPx}px`,
        height: "18px",
        lineHeight: "16px",
        opacity: isRepeating ? 0.85 : 1,
        borderStyle: isRepeating ? "dashed" : "solid",
        borderLeftStyle: "solid",
      }}
    >
      {TYPE_EMOJI[type]} {title}
    </div>
  );
}

// ─── Week Calendar ─────────────────────────────────────────────────────────────

interface WeekCalendarProps {
  weekStart: Date;
  items: TreatmentItem[];
  plan: TreatmentPlan;
  onCellClick: (cell: CalendarCell, rect: DOMRect) => void;
  onItemClick: (item: TreatmentItem, rect: DOMRect) => void;
}

function WeekCalendar({ weekStart, items, plan, onCellClick, onItemClick }: WeekCalendarProps) {
  const hours = Array.from({ length: 18 }, (_, i) => i + 6); // 06:00–23:00
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const calMap = buildCalendarMap(items, days, plan.start_date, plan.end_date);

  const now = new Date();
  const currentHour = now.getHours();
  const currentMinutes = now.getMinutes();
  // percentage offset within the visible grid (6:00 to 22:00 = 17 rows × 48px each = 816px)
  const totalGridMinutes = 17 * 60;
  const elapsedMinutes = (currentHour - 6) * 60 + currentMinutes;
  const redLineTop = Math.max(0, (elapsedMinutes / totalGridMinutes) * 100);
  const showRedLine = currentHour >= 6 && currentHour <= 22;
  const todayColIndex = days.findIndex(d => isToday(d));

  return (
    <div className="overflow-auto" style={{ maxHeight: "calc(100vh - 220px)" }}>
      <div
        className="grid border border-border rounded-xl overflow-hidden"
        style={{ gridTemplateColumns: "52px repeat(7, minmax(0, 1fr))" }}
      >
        {/* Header */}
        <div className="bg-[var(--color-muted)] p-2 border-b border-border" />
        {days.map((day, di) => (
          <div
            key={day.toISOString()}
            className={[
              "p-2 text-center border-l border-b border-border",
              di === todayColIndex ? "bg-secondary/5" : "bg-[var(--color-muted)]",
            ].join(" ")}
          >
            <p className="text-[11px] text-[var(--color-text-tertiary)] uppercase tracking-wide">
              {RU_DAYS[day.getDay()]}
            </p>
            <p className={[
              "text-sm font-bold mt-0.5",
              isToday(day) ? "text-secondary" : "text-foreground",
            ].join(" ")}>
              {day.getDate()}
            </p>
            <p className="text-[10px] text-[var(--color-text-tertiary)]">
              {formatDateShort(day)}
            </p>
          </div>
        ))}

        {/* Hour rows */}
        {hours.map((hour) => (
          <Fragment key={hour}>
            <div className="px-1 pt-1 text-[10px] text-[var(--color-text-tertiary)] text-right border-t border-border leading-none">
              {padZ(hour)}:00
            </div>
            {days.map((day, di) => {
              const dayKey = day.toDateString();
              const cellItems = calMap.get(dayKey)?.get(hour) ?? [];
              const planStart = plan.start_date ? new Date(plan.start_date) : null;
              const planEnd = plan.end_date ? new Date(plan.end_date) : null;
              const dayMs = day.getTime();
              const isInPlan = (!planStart || dayMs >= planStart.setHours(0,0,0,0)) && (!planEnd || dayMs <= planEnd.setHours(23,59,59,999));

              return (
                <div
                  key={`${dayKey}-${hour}`}
                  className={[
                    "relative border-l border-t border-border transition-colors",
                    !isInPlan ? "opacity-60" : "",
                    di === todayColIndex ? "bg-secondary/5" : "",
                  ].join(" ")}
                  style={{ minHeight: `${Math.max(48, 4 + cellItems.length * 20)}px` }}
                >
                  {/* Two 30-min click zones */}
                  <div
                    className="absolute inset-x-0 top-0 h-1/2 cursor-pointer hover:bg-secondary/5 transition-colors z-[1]"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCellClick({ day, hour, minute: 0 }, e.currentTarget.getBoundingClientRect());
                    }}
                    title={`${padZ(hour)}:00`}
                  />
                  <div
                    className="absolute inset-x-0 bottom-0 h-1/2 cursor-pointer hover:bg-secondary/5 transition-colors z-[1] border-t border-dashed border-border/30"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCellClick({ day, hour, minute: 30 }, e.currentTarget.getBoundingClientRect());
                    }}
                    title={`${padZ(hour)}:30`}
                  />
                  {/* Red current-time line */}
                  {showRedLine && isToday(day) && hour === currentHour && (
                    <div
                      className="absolute left-0 right-0 z-10 pointer-events-none"
                      style={{ top: `${(currentMinutes / 60) * 100}%` }}
                    >
                      <div className="h-px bg-red-500/70 w-full relative">
                        <div className="absolute -left-1 -top-1 w-2 h-2 rounded-full bg-red-500" />
                      </div>
                    </div>
                  )}
                  {cellItems.map((item, idx) => (
                    <CalendarBlock
                      key={`${item.id}-${idx}`}
                      item={item}
                      index={idx}
                      total={cellItems.length}
                      onClick={(e) => onItemClick(item, e.currentTarget.getBoundingClientRect())}
                    />
                  ))}
                </div>
              );
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

// ─── Catalog Search Input ──────────────────────────────────────────────────────

interface CatalogSearchInputProps {
  itemType: ItemType;
  value: string;
  selectedName: string;
  onSearchChange: (v: string) => void;
  onSelect: (id: string, name: string) => void;
}

function CatalogSearchInput({ itemType, value, selectedName, onSearchChange, onSelect }: CatalogSearchInputProps) {
  const { data, loading } = useCatalogSearch(itemType, value);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={wrapRef} className="relative">
      <InputField
        label="Поиск"
        value={selectedName || value}
        placeholder="Начните вводить..."
        onChange={(e) => {
          onSearchChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        autoFocus
      />
      {open && (value.length > 0 || data.length > 0) && (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-[var(--color-surface)] border border-border rounded-xl shadow-xl overflow-hidden">
          {loading && (
            <div className="px-3 py-2 text-xs text-[var(--color-text-tertiary)]">Загрузка...</div>
          )}
          {!loading && data.length === 0 && (
            <div className="px-3 py-2 text-xs text-[var(--color-text-tertiary)]">Ничего не найдено</div>
          )}
          <div className="max-h-[160px] overflow-y-auto">
            {(data as Array<{ id: string; name: string }>).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => { onSelect(item.id, item.name); setOpen(false); onSearchChange(""); }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--color-muted)] transition-colors text-foreground"
              >
                {item.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Quick Add Forms ───────────────────────────────────────────────────────────

interface QuickAddFormProps {
  itemType: ItemType;
  cell: CalendarCell;
  planId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

function QuickAddForm({ itemType, cell, planId, onSuccess, onCancel }: QuickAddFormProps) {
  const qc = useQueryClient();

  const addMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      patientsApi.addTreatmentPlanItem(planId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["treatment-plan", planId] });
      toast.success("Назначение добавлено");
      onSuccess();
    },
    onError: () => toast.error("Не удалось добавить назначение"),
  });

  const scheduledAt = (() => {
    const d = new Date(cell.day);
    d.setHours(cell.hour, cell.minute ?? 0, 0, 0);
    return d.toISOString();
  })();

  const timeLabel = `${padZ(cell.hour)}:${padZ(cell.minute ?? 0)}`;

  if (itemType === "MEDICATION") return (
    <MedicationForm
      scheduledAt={scheduledAt}
      timeLabel={timeLabel}
      loading={addMutation.isPending}
      onSubmit={(data) => addMutation.mutate({ item_type: "MEDICATION", scheduled_at: scheduledAt, ...data })}
      onCancel={onCancel}
    />
  );

  if (itemType === "PROCEDURE") return (
    <ProcedureForm
      scheduledAt={scheduledAt}
      loading={addMutation.isPending}
      onSubmit={(data) => addMutation.mutate({ item_type: "PROCEDURE", scheduled_at: scheduledAt, ...data })}
      onCancel={onCancel}
    />
  );

  if (itemType === "LAB_TEST") return (
    <LabTestForm
      scheduledAt={scheduledAt}
      loading={addMutation.isPending}
      onSubmit={(data) => addMutation.mutate({ item_type: "LAB_TEST", scheduled_at: scheduledAt, ...data })}
      onCancel={onCancel}
    />
  );

  if (itemType === "EXERCISE") return (
    <ExerciseForm
      loading={addMutation.isPending}
      onSubmit={(data) => addMutation.mutate({ item_type: "EXERCISE", scheduled_at: scheduledAt, ...data })}
      onCancel={onCancel}
    />
  );

  if (itemType === "THERAPY") return (
    <TherapyForm
      loading={addMutation.isPending}
      onSubmit={(data) => addMutation.mutate({ item_type: "THERAPY", ...data })}
      onCancel={onCancel}
    />
  );

  return null;
}

function MedicationForm({ scheduledAt: _scheduledAt, timeLabel, loading, onSubmit, onCancel }: {
  scheduledAt: string;
  timeLabel?: string;
  loading: boolean;
  onSubmit: (d: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  const [drugId, setDrugId] = useState("");
  const [drugName, setDrugName] = useState("");
  const [search, setSearch] = useState("");
  const [dosage, setDosage] = useState("");
  const [route, setRoute] = useState("oral");
  const [frequency, setFrequency] = useState("1 раз/день");
  const [durationDays, setDurationDays] = useState("7");

  const title = drugName || search.trim();

  return (
    <div className="space-y-2">
      <CatalogSearchInput
        itemType="MEDICATION"
        value={search}
        selectedName={drugName}
        onSearchChange={(v) => { setSearch(v); if (!drugId) setDrugName(""); }}
        onSelect={(id, name) => { setDrugId(id); setDrugName(name); }}
      />
      {timeLabel && (
        <p className="text-xs text-secondary font-medium">⏰ Время: {timeLabel}</p>
      )}
      {!drugId && search.trim() && (
        <p className="text-[10px] text-[var(--color-text-tertiary)]">Препарат не найден в каталоге — будет создан по названию</p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <InputField label="Доза" value={dosage} onChange={e => setDosage(e.target.value)} placeholder="500 мг" />
        <CustomSelect label="Путь" value={route} onChange={setRoute} options={ROUTE_OPTIONS} />
      </div>
      <CustomSelect label="Частота" value={frequency} onChange={setFrequency} options={FREQUENCY_OPTIONS} />
      <CustomSelect label="Длительность" value={durationDays} onChange={setDurationDays} options={DURATION_OPTIONS} />
      <div className="flex gap-2 pt-1">
        <Button
          size="sm"
          loading={loading}
          disabled={!title}
          onClick={() => onSubmit({ title, drug_id: drugId || undefined, drug_name: title, dosage, route, frequency, duration_days: parseInt(durationDays), configuration: { drug_id: drugId || undefined, dosage, route, frequency, duration_days: parseInt(durationDays) } })}
          className="flex-1"
        >
          Назначить
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>Отмена</Button>
      </div>
    </div>
  );
}

function ProcedureForm({ scheduledAt, loading, onSubmit, onCancel }: {
  scheduledAt: string;
  loading: boolean;
  onSubmit: (d: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  const [procId, setProcId] = useState("");
  const [procName, setProcName] = useState("");
  const [search, setSearch] = useState("");
  const [notes, setNotes] = useState("");

  const title = procName || search.trim();
  const timeLabel = (() => {
    const d = new Date(scheduledAt);
    return `${padZ(d.getHours())}:${padZ(d.getMinutes())}`;
  })();

  return (
    <div className="space-y-2">
      <CatalogSearchInput
        itemType="PROCEDURE"
        value={search}
        selectedName={procName}
        onSearchChange={(v) => { setSearch(v); if (!procId) setProcName(""); }}
        onSelect={(id, name) => { setProcId(id); setProcName(name); }}
      />
      {!procId && search.trim() && (
        <p className="text-[10px] text-[var(--color-text-tertiary)]">Процедура не в каталоге — будет создана по названию</p>
      )}
      <div className="text-xs text-[var(--color-text-tertiary)]">Время: {timeLabel}</div>
      <TextareaField label="Примечание" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Необязательно..." rows={2} />
      <div className="flex gap-2 pt-1">
        <Button
          size="sm"
          loading={loading}
          disabled={!title}
          onClick={() => onSubmit({ title, procedure_id: procId || undefined, procedure_name: title, notes, configuration: { procedure_id: procId || undefined, scheduled_at: scheduledAt, notes } })}
          className="flex-1"
        >
          Назначить
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>Отмена</Button>
      </div>
    </div>
  );
}

function LabTestForm({ scheduledAt: _scheduledAt, loading, onSubmit, onCancel }: {
  scheduledAt: string;
  loading: boolean;
  onSubmit: (d: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  const [testId, setTestId] = useState("");
  const [testName, setTestName] = useState("");
  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState("ROUTINE");

  const title = testName || search.trim();

  return (
    <div className="space-y-2">
      <CatalogSearchInput
        itemType="LAB_TEST"
        value={search}
        selectedName={testName}
        onSearchChange={(v) => { setSearch(v); if (!testId) setTestName(""); }}
        onSelect={(id, name) => { setTestId(id); setTestName(name); }}
      />
      {!testId && search.trim() && (
        <p className="text-[10px] text-[var(--color-text-tertiary)]">Анализ не в каталоге — будет создан по названию</p>
      )}
      <CustomSelect label="Приоритет" value={priority} onChange={setPriority} options={PRIORITY_OPTIONS} />
      <div className="flex gap-2 pt-1">
        <Button
          size="sm"
          loading={loading}
          disabled={!title}
          onClick={() => onSubmit({ title, test_id: testId || undefined, test_name: title, priority, configuration: { test_id: testId || undefined, priority } })}
          className="flex-1"
        >
          Назначить
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>Отмена</Button>
      </div>
    </div>
  );
}

function ExerciseForm({ loading, onSubmit, onCancel }: {
  loading: boolean;
  onSubmit: (d: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [exId, setExId] = useState("");
  const [exName, setExName] = useState("");
  const [exCategory, setExCategory] = useState("");
  const [exDifficulty, setExDifficulty] = useState("");
  const [sets, setSets] = useState("3");
  const [reps, setReps] = useState("10");
  const [frequency, setFrequency] = useState("Ежедневно");

  const handleSelectExercise = (ex: Record<string, unknown>) => {
    setExId(ex.id as string);
    setExName(ex.name as string);
    setExCategory(ex.category as string || "");
    setExDifficulty(ex.difficulty as string || "");
    setSets(String(ex.default_sets ?? 3));
    setReps(String(ex.default_reps ?? 10));
    setPickerOpen(false);
  };

  const cat = CATEGORY_INFO[exCategory];
  const diff = DIFFICULTY_INFO[exDifficulty];

  return (
    <div className="space-y-2">
      {/* Selected exercise or picker button */}
      {exId ? (
        <div className="flex items-center gap-2 p-2 rounded-xl bg-[var(--color-muted)]/50 border border-border">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{exName}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              {cat && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: `${cat.color}18`, color: cat.color }}>
                  {cat.icon} {cat.label}
                </span>
              )}
              {diff && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: `${diff.color}18`, color: diff.color }}>
                  {diff.label}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={() => setPickerOpen(true)}
            className="text-xs text-secondary hover:underline flex-shrink-0"
          >
            Изменить
          </button>
        </div>
      ) : (
        <button
          onClick={() => setPickerOpen(true)}
          className="w-full p-3 rounded-xl border-2 border-dashed border-border hover:border-secondary/40 hover:bg-secondary/5 transition-all text-center"
        >
          <span className="text-2xl block mb-1">🏃</span>
          <span className="text-sm font-medium text-secondary">Выбрать упражнение</span>
          <p className="text-[10px] text-[var(--color-text-tertiary)] mt-0.5">
            Откроется каталог с описаниями и инструкциями
          </p>
        </button>
      )}

      {exId && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <InputField label="Подходы" value={sets} onChange={e => setSets(e.target.value)} type="number" min={1} />
            <InputField label="Повторения" value={reps} onChange={e => setReps(e.target.value)} type="number" min={1} />
          </div>
          <CustomSelect label="Частота" value={frequency} onChange={setFrequency} options={EXERCISE_FREQUENCY_OPTIONS} />
          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              loading={loading}
              onClick={() => onSubmit({ title: exName, exercise_id: exId, exercise_name: exName, sets: parseInt(sets), reps: parseInt(reps), frequency, configuration: { exercise_id: exId, sets: parseInt(sets), reps: parseInt(reps) } })}
              className="flex-1"
            >
              Назначить
            </Button>
            <Button size="sm" variant="ghost" onClick={onCancel}>Отмена</Button>
          </div>
        </>
      )}

      {!exId && (
        <div className="flex justify-end">
          <Button size="sm" variant="ghost" onClick={onCancel}>Отмена</Button>
        </div>
      )}

      <ExercisePickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handleSelectExercise}
      />
    </div>
  );
}

function TherapyForm({ loading, onSubmit, onCancel }: {
  loading: boolean;
  onSubmit: (d: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [frequency, setFrequency] = useState("1 раз/день");

  return (
    <div className="space-y-2">
      <InputField label="Название" value={title} onChange={e => setTitle(e.target.value)} placeholder="Массаж, ЛФК..." autoFocus />
      <CustomSelect label="Частота" value={frequency} onChange={setFrequency} options={FREQUENCY_OPTIONS} />
      <div className="flex gap-2 pt-1">
        <Button
          size="sm"
          loading={loading}
          disabled={!title.trim()}
          onClick={() => onSubmit({ title, frequency })}
          className="flex-1"
        >
          Назначить
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>Отмена</Button>
      </div>
    </div>
  );
}

// ─── Quick Add Popup ───────────────────────────────────────────────────────────

interface QuickAddPopupProps {
  state: QuickAddState;
  planId: string;
  onClose: () => void;
}

function QuickAddPopup({ state, planId, onClose }: QuickAddPopupProps) {
  const [step, setStep] = useState<"type" | "form">(state.step);
  const [itemType, setItemType] = useState<ItemType | null>(state.itemType);
  const popupRef = useRef<HTMLDivElement>(null);

  const handleSelectType = (t: ItemType) => {
    setItemType(t);
    setStep("form");
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  // Position popup below (or above if near bottom)
  const style = (() => {
    const r = state.anchorRect;
    const vpH = window.innerHeight;
    const popH = 340;
    const top = r.bottom + 8 + popH > vpH ? r.top - popH - 8 : r.bottom + 8;
    const left = Math.min(Math.max(r.left, 8), window.innerWidth - 308);
    return { top, left, width: 300 };
  })();

  const typeItems: { type: ItemType; emoji: string; label: string }[] = [
    { type: "MEDICATION", emoji: "💊", label: "Лекарство" },
    { type: "PROCEDURE",  emoji: "🔧", label: "Процедура"  },
    { type: "LAB_TEST",   emoji: "🧪", label: "Анализ"     },
    { type: "EXERCISE",   emoji: "🏃", label: "Упражнение" },
    { type: "THERAPY",    emoji: "📋", label: "Терапия"    },
  ];

  return createPortal(
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} />
      {/* Popup */}
      <div
        ref={popupRef}
        className="fixed z-50 bg-[var(--color-surface)] border border-border rounded-2xl shadow-2xl p-4"
        style={style}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-foreground">
            {step === "type"
              ? `Назначить на ${padZ(state.cell.hour)}:${padZ(state.cell.minute ?? 0)}`
              : `${TYPE_EMOJI[itemType!]} ${TYPE_LABEL[itemType!]} — ${padZ(state.cell.hour)}:${padZ(state.cell.minute ?? 0)}`}
          </p>
          <button onClick={onClose} className="text-[var(--color-text-tertiary)] hover:text-foreground transition-colors p-0.5 rounded-lg hover:bg-[var(--color-muted)]">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {step === "type" ? (
          <div className="grid grid-cols-5 gap-1.5">
            {typeItems.map(({ type, emoji, label }) => (
              <button
                key={type}
                onClick={() => handleSelectType(type)}
                className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-[var(--color-muted)] transition-colors"
              >
                <span className="text-xl">{emoji}</span>
                <span className="text-[10px] text-[var(--color-text-secondary)] leading-tight text-center">{label}</span>
              </button>
            ))}
          </div>
        ) : (
          <div>
            <button
              onClick={() => { setStep("type"); setItemType(null); }}
              className="flex items-center gap-1 text-xs text-[var(--color-text-tertiary)] hover:text-foreground mb-3 transition-colors"
            >
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6" />
              </svg>
              Назад
            </button>
            <QuickAddForm
              itemType={itemType!}
              cell={state.cell}
              planId={planId}
              onSuccess={onClose}
              onCancel={onClose}
            />
          </div>
        )}
      </div>
    </>,
    document.body
  );
}

// ─── Item Detail Popup ─────────────────────────────────────────────────────────

interface ItemDetailPopupProps {
  item: TreatmentItem;
  planId: string;
  anchorRect: DOMRect;
  onClose: () => void;
}

function ItemDetailPopup({ item, planId, anchorRect, onClose }: ItemDetailPopupProps) {
  const qc = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const type = item.item_type as ItemType;
  const color = TYPE_COLOR[type] ?? "#6B7280";

  const updateMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      patientsApi.updateTreatmentPlanItem(planId, item.id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["treatment-plan", planId] });
      toast.success("Статус обновлён");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => patientsApi.deleteTreatmentPlanItem(planId, item.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["treatment-plan", planId] });
      toast.success("Назначение удалено");
      onClose();
    },
    onError: () => toast.error("Не удалось удалить"),
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const statusCycle: Record<string, string> = {
    PENDING: "IN_PROGRESS",
    IN_PROGRESS: "COMPLETED",
    COMPLETED: "PENDING",
  };

  const style = (() => {
    const r = anchorRect;
    const vpH = window.innerHeight;
    const popH = 280;
    const top = r.bottom + 8 + popH > vpH ? r.top - popH - 8 : r.bottom + 8;
    const left = Math.min(Math.max(r.left, 8), window.innerWidth - 268);
    return { top, left, width: 260 };
  })();

  const title = getItemDisplayTitle(item);
  const statusMeta = ITEM_STATUS_META[item.status] ?? { label: item.status, variant: "muted" as const };

  return createPortal(
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="fixed z-50 bg-[var(--color-surface)] border border-border rounded-2xl shadow-2xl p-4"
        style={style}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="w-7 h-7 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
              style={{ backgroundColor: `${color}18` }}
            >
              {TYPE_EMOJI[type]}
            </span>
            <p className="text-sm font-semibold text-foreground truncate">{title}</p>
          </div>
          <button onClick={onClose} className="text-[var(--color-text-tertiary)] hover:text-foreground transition-colors p-0.5 rounded-lg hover:bg-[var(--color-muted)] flex-shrink-0 ml-2">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-1.5 mb-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--color-text-tertiary)]">Тип</span>
            <span className="text-xs font-medium text-foreground">{TYPE_LABEL[type]}</span>
          </div>
          {item.frequency && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--color-text-tertiary)]">Частота</span>
              <span className="text-xs font-medium text-foreground">{item.frequency}</span>
            </div>
          )}
          {item.dosage && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--color-text-tertiary)]">Доза</span>
              <span className="text-xs font-medium text-foreground">{item.dosage}</span>
            </div>
          )}
          {item.scheduled_at && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--color-text-tertiary)]">Время</span>
              <span className="text-xs font-medium text-foreground">
                {new Date(item.scheduled_at).toLocaleString("ru", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          )}
          {item.sets && item.reps && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--color-text-tertiary)]">Подходы × повт.</span>
              <span className="text-xs font-medium text-foreground">{item.sets} × {item.reps}</span>
            </div>
          )}
          {item.priority && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--color-text-tertiary)]">Приоритет</span>
              <span className="text-xs font-medium text-foreground">
                {PRIORITY_OPTIONS.find(p => p.value === item.priority)?.label ?? item.priority}
              </span>
            </div>
          )}
          {item.notes && (
            <div>
              <span className="text-xs text-[var(--color-text-tertiary)]">Примечание</span>
              <p className="text-xs text-foreground mt-0.5">{item.notes}</p>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 pt-2 border-t border-border">
          <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
          {statusCycle[item.status] && (
            <button
              onClick={() => updateMutation.mutate({ status: statusCycle[item.status] })}
              disabled={updateMutation.isPending}
              className="text-[10px] text-secondary hover:underline disabled:opacity-50"
            >
              → {ITEM_STATUS_META[statusCycle[item.status]]?.label}
            </button>
          )}
          <div className="flex-1" />
          {confirmDelete ? (
            <div className="flex gap-1">
              <button
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                className="text-[10px] text-destructive font-medium hover:underline disabled:opacity-50"
              >
                Удалить
              </button>
              <button onClick={() => setConfirmDelete(false)} className="text-[10px] text-[var(--color-text-tertiary)] hover:text-foreground">
                Отмена
              </button>
            </div>
          ) : (
            <button onClick={() => setConfirmDelete(true)} className="text-[10px] text-[var(--color-text-tertiary)] hover:text-destructive transition-colors">
              Удалить
            </button>
          )}
        </div>
      </div>
    </>,
    document.body
  );
}

// ─── Side Panel ────────────────────────────────────────────────────────────────

interface SidePanelProps {
  items: TreatmentItem[];
  planId: string;
  open: boolean;
}

function SidePanel({ items, planId, open }: SidePanelProps) {
  const qc = useQueryClient();
  const types: ItemType[] = ["MEDICATION", "PROCEDURE", "LAB_TEST", "EXERCISE", "THERAPY"];

  const updateMutation = useMutation({
    mutationFn: ({ itemId, status }: { itemId: string; status: string }) =>
      patientsApi.updateTreatmentPlanItem(planId, itemId, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["treatment-plan", planId] }),
  });

  if (!open) return null;

  return (
    <div className="w-64 flex-shrink-0 border-l border-border bg-[var(--color-surface)] overflow-y-auto" style={{ maxHeight: "calc(100vh - 220px)" }}>
      <div className="p-3 border-b border-border">
        <p className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wide">Все назначения</p>
        <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">{items.length} элементов</p>
      </div>
      {types.map((type) => {
        const typeItems = items.filter(i => i.item_type === type);
        if (typeItems.length === 0) return null;
        const color = TYPE_COLOR[type];
        return (
          <div key={type} className="border-b border-border">
            <div className="px-3 py-2 flex items-center gap-2">
              <span className="text-sm">{TYPE_EMOJI[type]}</span>
              <span className="text-xs font-semibold text-foreground">{TYPE_LABEL[type]}</span>
              <span
                className="ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                style={{ backgroundColor: `${color}18`, color }}
              >
                {typeItems.length}
              </span>
            </div>
            <div className="pb-1">
              {typeItems.map(item => {
                const title = getItemDisplayTitle(item);
                const statusMeta = ITEM_STATUS_META[item.status] ?? { label: item.status, variant: "muted" as const };
                const nextStatus: Record<string, string> = { PENDING: "IN_PROGRESS", IN_PROGRESS: "COMPLETED" };
                return (
                  <div key={item.id} className="px-3 py-1.5 flex items-start gap-2 hover:bg-[var(--color-muted)]/50 transition-colors">
                    <button
                      onClick={() => nextStatus[item.status] && updateMutation.mutate({ itemId: item.id, status: nextStatus[item.status] })}
                      disabled={!nextStatus[item.status]}
                      className={[
                        "mt-0.5 w-3.5 h-3.5 rounded-full border flex-shrink-0 transition-all",
                        item.status === "COMPLETED" ? "bg-success border-success" : "border-[var(--color-text-tertiary)] hover:border-secondary",
                        !nextStatus[item.status] ? "cursor-default" : "cursor-pointer",
                      ].join(" ")}
                    />
                    <div className="flex-1 min-w-0">
                      <p className={["text-xs font-medium truncate", item.status === "COMPLETED" ? "line-through text-[var(--color-text-tertiary)]" : "text-foreground"].join(" ")}>
                        {title}
                      </p>
                      <p className="text-[10px] text-[var(--color-text-tertiary)]">
                        {item.frequency ?? (item.scheduled_at ? new Date(item.scheduled_at).toLocaleString("ru", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "")}
                      </p>
                    </div>
                    <Badge variant={statusMeta.variant} className="flex-shrink-0 mt-0.5">{statusMeta.label}</Badge>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      {items.length === 0 && (
        <div className="p-4 text-center text-xs text-[var(--color-text-tertiary)]">
          Нет назначений
        </div>
      )}
    </div>
  );
}

// ─── Create Plan Form ──────────────────────────────────────────────────────────

interface CreatePlanFormProps {
  patientId: string;
  onCreated: (plan: TreatmentPlan) => void;
}

function CreatePlanForm({ patientId, onCreated }: CreatePlanFormProps) {
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().slice(0, 10);
  });

  const createMutation = useMutation({
    mutationFn: () =>
      patientsApi.createTreatmentPlanFull({
        patient_id: patientId,
        title: title.trim(),
        start_date: startDate,
        end_date: endDate,
        items: [],
      }),
    onSuccess: (plan: TreatmentPlan) => {
      toast.success("План лечения создан");
      onCreated(plan);
    },
    onError: () => toast.error("Не удалось создать план"),
  });

  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="bg-[var(--color-surface)] border border-border rounded-2xl p-8 max-w-md w-full shadow-sm">
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-secondary/10 flex items-center justify-center mx-auto mb-3">
            <svg className="w-7 h-7 text-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <path d="M16 2v4M8 2v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-foreground">Создать план лечения</h3>
          <p className="text-sm text-[var(--color-text-tertiary)] mt-1">Укажите название и даты для нового плана</p>
        </div>
        <div className="space-y-4">
          <InputField
            label="Название плана"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Например: Послеоперационная реабилитация"
            autoFocus
          />
          <div className="grid grid-cols-2 gap-3">
            <DatePicker label="Дата начала" value={startDate} onChange={setStartDate} />
            <DatePicker label="Дата окончания" value={endDate} onChange={setEndDate} />
          </div>
          <Button
            className="w-full"
            loading={createMutation.isPending}
            disabled={!title.trim() || !startDate || !endDate}
            onClick={() => createMutation.mutate()}
          >
            Создать план
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

function TreatmentPage() {
  const { patientId } = Route.useParams();
  const qc = useQueryClient();

  // Week navigation
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));

  // Active plan
  const [activePlanId, setActivePlanId] = useState<string | null>(null);

  // Side panel
  const [panelOpen, setPanelOpen] = useState(true);

  // Quick-add popup
  const [quickAdd, setQuickAdd] = useState<QuickAddState | null>(null);

  // Item detail popup
  const [detailItem, setDetailItem] = useState<{ item: TreatmentItem; rect: DOMRect } | null>(null);

  // Plans list
  const plansQuery = useQuery({
    queryKey: ["treatment-plans", patientId],
    queryFn: () => patientsApi.getTreatmentPlans(patientId),
  });

  const plans: TreatmentPlan[] = plansQuery.data ?? [];

  // Auto-select first plan or most recent active
  useEffect(() => {
    if (plans.length > 0 && !activePlanId) {
      const active = plans.find(p => p.status === "ACTIVE") ?? plans[0];
      setActivePlanId(active.id);
    }
  }, [plans, activePlanId]);

  // Active plan detail with items
  const planQuery = useQuery({
    queryKey: ["treatment-plan", activePlanId],
    queryFn: () => patientsApi.getTreatmentPlanDetail(activePlanId!),
    enabled: !!activePlanId,
  });

  const plan: TreatmentPlan | null = planQuery.data ?? null;
  const items: TreatmentItem[] = plan?.items ?? [];

  // Mutations
  const activateMutation = useMutation({
    mutationFn: () => patientsApi.activateTreatmentPlan(activePlanId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["treatment-plans", patientId] });
      qc.invalidateQueries({ queryKey: ["treatment-plan", activePlanId] });
      toast.success("План активирован");
    },
    onError: () => toast.error("Не удалось активировать план"),
  });

  const completeMutation = useMutation({
    mutationFn: () => patientsApi.updateTreatmentPlan(activePlanId!, { status: "COMPLETED" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["treatment-plans", patientId] });
      qc.invalidateQueries({ queryKey: ["treatment-plan", activePlanId] });
      toast.success("План завершён");
    },
    onError: () => toast.error("Не удалось завершить план"),
  });

  const deletePlanMutation = useMutation({
    mutationFn: () => patientsApi.deleteTreatmentPlan(activePlanId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["treatment-plans", patientId] });
      setActivePlanId(null);
      toast.success("План удалён");
    },
    onError: () => toast.error("Не удалось удалить план"),
  });

  const handleCellClick = useCallback((cell: CalendarCell, rect: DOMRect) => {
    setDetailItem(null);
    setQuickAdd({ cell, anchorRect: rect, step: "type", itemType: null });
  }, []);

  const handleItemClick = useCallback((item: TreatmentItem, rect: DOMRect) => {
    setQuickAdd(null);
    setDetailItem({ item, rect });
  }, []);

  const handlePlanCreated = useCallback((newPlan: TreatmentPlan) => {
    qc.invalidateQueries({ queryKey: ["treatment-plans", patientId] });
    setActivePlanId(newPlan.id);
  }, [qc, patientId]);

  // Week navigation
  const prevWeek = () => {
    setWeekStart(d => { const n = new Date(d); n.setDate(n.getDate() - 7); return n; });
  };
  const nextWeek = () => {
    setWeekStart(d => { const n = new Date(d); n.setDate(n.getDate() + 7); return n; });
  };
  const goToday = () => setWeekStart(getMonday(new Date()));

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const planSelectOptions = [
    ...plans.map(p => ({ value: p.id, label: p.title })),
    { value: "__new__", label: "+ Новый план" },
  ];

  const statusMeta = plan ? (STATUS_META[plan.status] ?? { label: plan.status, variant: "muted" as const }) : null;

  // Loading skeleton
  if (plansQuery.isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 rounded-full border-2 border-secondary/30 border-t-secondary animate-spin mx-auto" />
          <p className="text-sm text-[var(--color-text-tertiary)]">Загрузка планов лечения...</p>
        </div>
      </div>
    );
  }

  // No plans — show create form
  if (plans.length === 0) {
    return (
      <div className="flex flex-col flex-1 h-full">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-[var(--color-surface)]">
          <h1 className="text-xl font-bold text-foreground">План лечения</h1>
        </div>
        <CreatePlanForm patientId={patientId} onCreated={handlePlanCreated} />
      </div>
    );
  }

  // Creating new plan
  if (activePlanId === "__new__") {
    return (
      <div className="flex flex-col flex-1 h-full">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-[var(--color-surface)]">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-foreground">План лечения</h1>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setActivePlanId(plans[0]?.id ?? null)}>
            Отмена
          </Button>
        </div>
        <CreatePlanForm patientId={patientId} onCreated={handlePlanCreated} />
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 h-full overflow-hidden">
      {/* Top Bar */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-border bg-[var(--color-surface)] flex-shrink-0 flex-wrap">
        <h1 className="text-xl font-bold text-foreground mr-1">План лечения</h1>

        {/* Plan selector */}
        <div className="w-56">
          <CustomSelect
            value={activePlanId ?? ""}
            onChange={(v) => setActivePlanId(v)}
            options={planSelectOptions}
            placeholder="Выберите план..."
          />
        </div>

        {/* Plan meta */}
        {plan && statusMeta && (
          <>
            <Badge variant={statusMeta.variant} dot>{statusMeta.label}</Badge>
            <span className="text-xs text-[var(--color-text-tertiary)]">
              {new Date(plan.start_date).toLocaleDateString("ru")} – {new Date(plan.end_date).toLocaleDateString("ru")}
            </span>
          </>
        )}

        <div className="flex-1" />

        {/* Action buttons */}
        {plan?.status === "DRAFT" && (
          <Button
            size="sm"
            variant="primary"
            loading={activateMutation.isPending}
            onClick={() => activateMutation.mutate()}
            icon={
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            }
          >
            Активировать
          </Button>
        )}
        {plan?.status === "ACTIVE" && (
          <Button
            size="sm"
            variant="outline"
            loading={completeMutation.isPending}
            onClick={() => completeMutation.mutate()}
          >
            Завершить
          </Button>
        )}
        {plan && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              if (window.confirm("Удалить план лечения?")) deletePlanMutation.mutate();
            }}
            className="text-[var(--color-text-tertiary)] hover:text-destructive"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2" />
            </svg>
          </Button>
        )}

        {/* Side panel toggle */}
        <button
          onClick={() => setPanelOpen(v => !v)}
          className={[
            "p-2 rounded-xl border transition-all",
            panelOpen ? "border-secondary/40 bg-secondary/8 text-secondary" : "border-border text-[var(--color-text-tertiary)] hover:text-foreground",
          ].join(" ")}
          title="Список назначений"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18" />
          </svg>
        </button>
      </div>

      {/* Week nav bar */}
      <div className="flex items-center gap-3 px-6 py-2.5 border-b border-border bg-[var(--color-surface)]/60 flex-shrink-0">
        <button
          onClick={prevWeek}
          className="p-1.5 rounded-lg hover:bg-[var(--color-muted)] transition-colors text-[var(--color-text-secondary)]"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <button
          onClick={goToday}
          className="text-xs font-medium text-foreground hover:text-secondary transition-colors min-w-[160px] text-center"
        >
          {RU_DAYS_FULL[weekStart.getDay() === 0 ? 1 : weekStart.getDay()].slice(0, 0)}
          Пн {formatDateShort(weekStart)} – Вс {formatDateShort(weekEnd)}
        </button>
        <button
          onClick={nextWeek}
          className="p-1.5 rounded-lg hover:bg-[var(--color-muted)] transition-colors text-[var(--color-text-secondary)]"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>
        <button
          onClick={goToday}
          className="ml-1 text-xs px-2.5 py-1 rounded-lg bg-[var(--color-muted)] text-[var(--color-text-secondary)] hover:text-foreground hover:bg-[var(--color-border)] transition-colors"
        >
          Сегодня
        </button>

        {/* Type legend */}
        <div className="flex-1" />
        <div className="hidden md:flex items-center gap-3 flex-wrap">
          {(["MEDICATION", "PROCEDURE", "LAB_TEST", "EXERCISE", "THERAPY"] as ItemType[]).map(t => (
            <div key={t} className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: TYPE_COLOR[t] }} />
              <span className="text-[10px] text-[var(--color-text-tertiary)]">{TYPE_LABEL[t]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Calendar + side panel */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-hidden p-4">
          {plan ? (
            planQuery.isLoading ? (
              <div className="flex items-center justify-center h-48">
                <div className="w-6 h-6 rounded-full border-2 border-secondary/30 border-t-secondary animate-spin" />
              </div>
            ) : (
              <WeekCalendar
                weekStart={weekStart}
                items={items}
                plan={plan}
                onCellClick={handleCellClick}
                onItemClick={handleItemClick}
              />
            )
          ) : (
            <div className="flex items-center justify-center h-48 text-sm text-[var(--color-text-tertiary)]">
              Выберите план лечения
            </div>
          )}
        </div>
        {plan && (
          <SidePanel
            items={items}
            planId={plan.id}
            open={panelOpen}
          />
        )}
      </div>

      {/* Quick-add popup */}
      {quickAdd && activePlanId && activePlanId !== "__new__" && (
        <QuickAddPopup
          state={quickAdd}
          planId={activePlanId}
          onClose={() => setQuickAdd(null)}
        />
      )}

      {/* Item detail popup */}
      {detailItem && activePlanId && (
        <ItemDetailPopup
          item={detailItem.item}
          planId={activePlanId}
          anchorRect={detailItem.rect}
          onClose={() => setDetailItem(null)}
        />
      )}
    </div>
  );
}

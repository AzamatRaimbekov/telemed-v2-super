import { createFileRoute } from "@tanstack/react-router";
import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { patientsApi } from "@/features/patients/api";
import { formatDate, formatDateTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { InputField } from "@/components/ui/input-field";
import { TextareaField } from "@/components/ui/textarea-field";
import { CustomSelect } from "@/components/ui/select-custom";
import { DatePicker } from "@/components/ui/date-picker";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";

export const Route = createFileRoute(
  "/_authenticated/patients/$patientId/stroke"
)({
  component: StrokePage,
});

// ─── Constants ────────────────────────────────────────────────────────────────

const STROKE_TABS = [
  { key: "overview", label: "Обзор" },
  { key: "scales", label: "Шкалы оценки" },
  { key: "goals", label: "Цели реабилитации" },
  { key: "exercises", label: "Упражнения" },
] as const;

type TabKey = (typeof STROKE_TABS)[number]["key"];

const ASSESSMENT_INFO: Record<
  string,
  { label: string; max: number; description: string }
> = {
  NIHSS: { label: "NIHSS", max: 42, description: "Шкала тяжести инсульта" },
  MRS: { label: "Модиф. Рэнкин", max: 6, description: "Функциональная шкала" },
  BARTHEL: { label: "Бартел", max: 100, description: "Индекс активности" },
  MMSE: { label: "MMSE", max: 30, description: "Когнитивный тест" },
  BECK_DEPRESSION: {
    label: "Шкала Бека",
    max: 63,
    description: "Оценка депрессии",
  },
  DYSPHAGIA: { label: "Дисфагия", max: 10, description: "Тест глотания" },
};

const ASSESSMENT_TYPE_OPTIONS = Object.entries(ASSESSMENT_INFO).map(
  ([value, info]) => ({
    value,
    label: `${info.label} — ${info.description}`,
  })
);

const DOMAIN_META: Record<string, { label: string; color: string }> = {
  MOBILITY: { label: "Подвижность", color: "#3B82F6" },
  SPEECH: { label: "Речь", color: "#7E78D2" },
  COGNITION: { label: "Когниция", color: "#F59E0B" },
  ADL: { label: "Быт. навыки", color: "#22C55E" },
  PSYCHOLOGICAL: { label: "Психол.", color: "#EC4899" },
  SOCIAL: { label: "Социальные", color: "#14B8A6" },
};

const DOMAIN_OPTIONS = Object.entries(DOMAIN_META).map(([value, meta]) => ({
  value,
  label: meta.label,
}));

const GOAL_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Активна",
  ACHIEVED: "Достигнута",
  PAUSED: "Приостановлена",
  CANCELLED: "Отменена",
};

const GOAL_STATUS_VARIANTS: Record<
  string,
  "warning" | "success" | "muted" | "destructive"
> = {
  ACTIVE: "warning",
  ACHIEVED: "success",
  PAUSED: "muted",
  CANCELLED: "destructive",
};

// Lower score = better for these scale types
const LOWER_IS_BETTER = new Set([
  "NIHSS",
  "MRS",
  "BECK_DEPRESSION",
  "DYSPHAGIA",
]);

// ─── Icon primitives ──────────────────────────────────────────────────────────

function IconX({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function IconChevronDown({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function IconPencil({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  );
}

function IconTrash({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2" />
    </svg>
  );
}

function IconPlus({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function IconTrendUp({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </svg>
  );
}

function IconTrendDown({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="22 17 13.5 8.5 8.5 13.5 2 7" />
      <polyline points="16 17 22 17 22 11" />
    </svg>
  );
}

// ─── Domain Badge ─────────────────────────────────────────────────────────────

function DomainBadge({ domain }: { domain: string }) {
  const meta = DOMAIN_META[domain];
  const color = meta?.color ?? "#6B7280";
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ backgroundColor: `${color}20`, color }}
    >
      {meta?.label ?? domain}
    </span>
  );
}

// ─── Modal Wrapper ────────────────────────────────────────────────────────────

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative bg-[var(--color-surface)] rounded-2xl border border-border shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col animate-float-up">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border flex-shrink-0">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-[var(--color-text-tertiary)] hover:text-foreground hover:bg-[var(--color-muted)] transition-colors"
            aria-label="Закрыть"
          >
            <IconX />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>,
    document.body
  );
}

// ─── Assessment Modal ─────────────────────────────────────────────────────────

function AssessmentModal({
  patientId,
  initial,
  onClose,
}: {
  patientId: string;
  initial?: Record<string, unknown> | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const isEdit = !!initial;

  const [type, setType] = useState(
    String(initial?.assessment_type ?? "NIHSS")
  );
  const [score, setScore] = useState(String(initial?.score ?? ""));
  const [maxScore, setMaxScore] = useState(
    String(
      initial?.max_score ??
        ASSESSMENT_INFO[String(initial?.assessment_type ?? "NIHSS")]?.max ??
        42
    )
  );
  const [interpretation, setInterpretation] = useState(
    String(initial?.interpretation ?? "")
  );
  const [notes, setNotes] = useState(String(initial?.notes ?? ""));
  const [assessedAt, setAssessedAt] = useState(
    String(initial?.assessed_at ?? new Date().toISOString()).slice(0, 10)
  );

  const saveMutation = useMutation({
    mutationFn: () => {
      const data = {
        assessment_type: type,
        score: Number(score),
        max_score: Number(maxScore),
        interpretation: interpretation.trim() || undefined,
        notes: notes.trim() || undefined,
        assessed_at: assessedAt,
      };
      return isEdit
        ? patientsApi.updateStrokeAssessment(
            patientId,
            String(initial!.id),
            data
          )
        : patientsApi.createStrokeAssessment(patientId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["stroke-assessments", patientId],
      });
      queryClient.invalidateQueries({
        queryKey: ["stroke-latest", patientId],
      });
      toast.success(isEdit ? "Оценка обновлена" : "Оценка добавлена");
      onClose();
    },
    onError: () => toast.error("Не удалось сохранить оценку"),
  });

  const handleTypeChange = (v: string) => {
    setType(v);
    setMaxScore(String(ASSESSMENT_INFO[v]?.max ?? ""));
  };

  return (
    <Modal
      title={isEdit ? "Редактировать оценку" : "Новая оценка"}
      onClose={onClose}
    >
      <div className="space-y-4">
        <CustomSelect
          label="Тип шкалы"
          value={type}
          onChange={handleTypeChange}
          options={ASSESSMENT_TYPE_OPTIONS}
        />
        <div className="grid grid-cols-2 gap-3">
          <InputField
            label="Балл"
            type="number"
            min={0}
            value={score}
            onChange={(e) => setScore(e.target.value)}
            placeholder="0"
          />
          <InputField
            label="Максимум"
            type="number"
            min={1}
            value={maxScore}
            onChange={(e) => setMaxScore(e.target.value)}
            placeholder="42"
          />
        </div>
        <TextareaField
          label="Интерпретация"
          value={interpretation}
          onChange={(e) => setInterpretation(e.target.value)}
          rows={2}
          placeholder="Описание клинического состояния..."
        />
        <TextareaField
          label="Примечания"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Дополнительные заметки..."
        />
        <DatePicker
          label="Дата оценки"
          value={assessedAt}
          onChange={setAssessedAt}
        />
        <div className="flex items-center gap-2 pt-2">
          <Button
            variant="primary"
            onClick={() => {
              if (!score) {
                toast.error("Введите балл");
                return;
              }
              saveMutation.mutate();
            }}
            loading={saveMutation.isPending}
          >
            {isEdit ? "Сохранить" : "Добавить оценку"}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Goal Modal ───────────────────────────────────────────────────────────────

function GoalModal({
  patientId,
  initial,
  onClose,
}: {
  patientId: string;
  initial?: Record<string, unknown> | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const isEdit = !!initial;

  const [domain, setDomain] = useState(String(initial?.domain ?? "MOBILITY"));
  const [description, setDescription] = useState(
    String(initial?.description ?? "")
  );
  const [targetDate, setTargetDate] = useState(
    String(initial?.target_date ?? "").slice(0, 10)
  );
  const [baselineValue, setBaselineValue] = useState(
    String(initial?.baseline_value ?? "0")
  );
  const [targetValue, setTargetValue] = useState(
    String(initial?.target_value ?? "100")
  );

  const saveMutation = useMutation({
    mutationFn: () => {
      const data = {
        domain,
        description: description.trim(),
        target_date: targetDate || undefined,
        baseline_value: Number(baselineValue),
        target_value: Number(targetValue),
      };
      return isEdit
        ? patientsApi.updateRehabGoal(patientId, String(initial!.id), data)
        : patientsApi.createRehabGoal(patientId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["rehab-goals", patientId],
      });
      toast.success(isEdit ? "Цель обновлена" : "Цель добавлена");
      onClose();
    },
    onError: () => toast.error("Не удалось сохранить цель"),
  });

  return (
    <Modal
      title={isEdit ? "Редактировать цель" : "Новая цель реабилитации"}
      onClose={onClose}
    >
      <div className="space-y-4">
        <CustomSelect
          label="Домен реабилитации"
          value={domain}
          onChange={setDomain}
          options={DOMAIN_OPTIONS}
        />
        <TextareaField
          label="Описание цели *"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Например: Самостоятельно ходить без вспомогательных средств..."
        />
        <DatePicker
          label="Целевая дата"
          value={targetDate}
          onChange={setTargetDate}
        />
        <div className="grid grid-cols-2 gap-3">
          <InputField
            label="Базовое значение (0-100)"
            type="number"
            min={0}
            max={100}
            value={baselineValue}
            onChange={(e) => setBaselineValue(e.target.value)}
            placeholder="0"
          />
          <InputField
            label="Целевое значение (0-100)"
            type="number"
            min={0}
            max={100}
            value={targetValue}
            onChange={(e) => setTargetValue(e.target.value)}
            placeholder="100"
          />
        </div>
        <div className="flex items-center gap-2 pt-2">
          <Button
            variant="primary"
            onClick={() => {
              if (!description.trim()) {
                toast.error("Введите описание цели");
                return;
              }
              saveMutation.mutate();
            }}
            loading={saveMutation.isPending}
          >
            {isEdit ? "Сохранить" : "Добавить цель"}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Goal Progress Form ───────────────────────────────────────────────────────

function GoalProgressForm({
  patientId,
  goalId,
  onSuccess,
  onCancel,
}: {
  patientId: string;
  goalId: string;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const queryClient = useQueryClient();
  const [value, setValue] = useState("");
  const [notes, setNotes] = useState("");

  const addMutation = useMutation({
    mutationFn: () =>
      patientsApi.addGoalProgress(patientId, goalId, {
        value: Number(value),
        notes: notes.trim() || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rehab-goals", patientId] });
      queryClient.invalidateQueries({
        queryKey: ["goal-progress", patientId, goalId],
      });
      toast.success("Прогресс добавлен");
      onSuccess();
    },
    onError: () => toast.error("Не удалось добавить прогресс"),
  });

  return (
    <div className="mt-3 p-3 rounded-xl bg-[var(--color-muted)]/40 border border-border space-y-3 animate-float-up">
      <div className="grid grid-cols-2 gap-3">
        <InputField
          label="Текущее значение (0-100)"
          type="number"
          min={0}
          max={100}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="0"
        />
        <InputField
          label="Заметки"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Необязательно"
        />
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="primary"
          onClick={() => {
            if (!value) {
              toast.error("Введите значение");
              return;
            }
            addMutation.mutate();
          }}
          loading={addMutation.isPending}
        >
          Сохранить
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Отмена
        </Button>
      </div>
    </div>
  );
}

// ─── Goal Card ────────────────────────────────────────────────────────────────

function GoalCard({
  goal,
  patientId,
}: {
  goal: Record<string, unknown>;
  patientId: string;
}) {
  const queryClient = useQueryClient();
  const [showProgress, setShowProgress] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const goalId = String(goal.id ?? "");
  const domain = String(goal.domain ?? "");
  const baseline = Number(goal.baseline_value ?? 0);
  const target = Number(goal.target_value ?? 100);
  const current = Number(goal.current_value ?? baseline);
  const status = String(goal.status ?? "ACTIVE");

  const range = target - baseline;
  const pct =
    range > 0
      ? Math.min(100, Math.round(((current - baseline) / range) * 100))
      : 0;

  const { data: progressHistory } = useQuery({
    queryKey: ["goal-progress", patientId, goalId],
    queryFn: () => patientsApi.getGoalProgress(patientId, goalId),
    enabled: showHistory,
  });

  const history =
    (progressHistory as Array<Record<string, unknown>>) ?? [];

  const deleteMutation = useMutation({
    mutationFn: () => patientsApi.deleteRehabGoal(patientId, goalId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rehab-goals", patientId] });
      toast.success("Цель удалена");
    },
    onError: () => toast.error("Не удалось удалить цель"),
  });

  const daysLeft = goal.target_date
    ? Math.ceil(
        (new Date(String(goal.target_date)).getTime() - Date.now()) / 86400000
      )
    : null;

  const progressColor =
    pct >= 75 ? "bg-success" : pct >= 40 ? "bg-warning" : "bg-secondary";

  return (
    <>
      <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-5 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2 flex-1 min-w-0 flex-wrap">
            <DomainBadge domain={domain} />
            <Badge variant={GOAL_STATUS_VARIANTS[status] ?? "muted"}>
              {GOAL_STATUS_LABELS[status] ?? status}
            </Badge>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className="w-6 h-6 rounded-lg flex items-center justify-center text-[var(--color-text-tertiary)] hover:text-secondary hover:bg-secondary/10 transition-colors"
              aria-label="Редактировать цель"
            >
              <IconPencil />
            </button>
            <button
              type="button"
              onClick={() => {
                if (window.confirm("Удалить цель?")) deleteMutation.mutate();
              }}
              disabled={deleteMutation.isPending}
              className="w-6 h-6 rounded-lg flex items-center justify-center text-[var(--color-text-tertiary)] hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
              aria-label="Удалить цель"
            >
              <IconTrash />
            </button>
          </div>
        </div>

        {/* Description */}
        <p className="text-sm text-foreground">
          {String(goal.description ?? "")}
        </p>

        {/* Progress bar: baseline → current → target */}
        <div>
          <div className="flex items-center justify-between text-xs text-[var(--color-text-tertiary)] mb-1.5">
            <span>
              Базовый:{" "}
              <strong className="text-foreground">{baseline}</strong>
            </span>
            <span className="font-semibold text-foreground">
              Текущий прогресс: {pct}%
            </span>
            <span>
              Цель: <strong className="text-foreground">{target}</strong>
            </span>
          </div>
          <div className="h-2 rounded-full bg-[var(--color-muted)] overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${progressColor}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
            Текущее значение:{" "}
            <strong className="text-foreground">{current}</strong>
          </p>
        </div>

        {/* Target date */}
        {goal.target_date && (
          <div className="flex items-center gap-2 text-xs text-[var(--color-text-tertiary)]">
            <span>
              Целевая дата:{" "}
              <strong className="text-foreground">
                {formatDate(String(goal.target_date))}
              </strong>
            </span>
            {daysLeft !== null && (
              <span
                className={`font-medium ${
                  daysLeft < 0
                    ? "text-destructive"
                    : daysLeft < 14
                    ? "text-warning"
                    : "text-[var(--color-text-tertiary)]"
                }`}
              >
                {daysLeft < 0
                  ? `${Math.abs(daysLeft)} дн. просрочено`
                  : `${daysLeft} дн. осталось`}
              </span>
            )}
          </div>
        )}

        {/* Add progress button */}
        {status === "ACTIVE" && (
          <div>
            {!showProgress ? (
              <button
                type="button"
                onClick={() => setShowProgress(true)}
                className="flex items-center gap-1.5 text-xs text-secondary hover:text-secondary/80 transition-colors font-medium"
              >
                <IconPlus className="w-3 h-3" />
                + Прогресс
              </button>
            ) : (
              <GoalProgressForm
                patientId={patientId}
                goalId={goalId}
                onSuccess={() => setShowProgress(false)}
                onCancel={() => setShowProgress(false)}
              />
            )}
          </div>
        )}

        {/* History toggle */}
        <button
          type="button"
          onClick={() => setShowHistory((v) => !v)}
          className="flex items-center gap-1.5 text-xs text-[var(--color-text-tertiary)] hover:text-foreground transition-colors"
        >
          <IconChevronDown
            className={`w-3.5 h-3.5 transition-transform ${
              showHistory ? "rotate-180" : ""
            }`}
          />
          История прогресса{history.length > 0 ? ` (${history.length})` : ""}
        </button>

        {showHistory && (
          <div className="space-y-1.5 border-t border-border pt-3">
            {history.length === 0 ? (
              <p className="text-xs text-[var(--color-text-tertiary)]">
                История прогресса пуста
              </p>
            ) : (
              history.map((entry, i) => (
                <div
                  key={String(entry.id ?? i)}
                  className="flex items-center justify-between text-xs"
                >
                  <span className="text-[var(--color-text-tertiary)]">
                    {entry.recorded_at
                      ? formatDate(String(entry.recorded_at))
                      : "—"}
                  </span>
                  <span className="font-semibold text-foreground">
                    {String(entry.value ?? "—")}
                  </span>
                  {entry.notes && (
                    <span className="text-[var(--color-text-tertiary)] truncate max-w-[140px]">
                      {String(entry.notes)}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {editOpen && (
        <GoalModal
          patientId={patientId}
          initial={goal}
          onClose={() => setEditOpen(false)}
        />
      )}
    </>
  );
}

// ─── Tab 1: Overview ──────────────────────────────────────────────────────────

function OverviewTab({ patientId }: { patientId: string }) {
  const { data: latest, isLoading: loadingLatest } = useQuery({
    queryKey: ["stroke-latest", patientId],
    queryFn: () => patientsApi.getLatestAssessments(patientId),
  });

  const { data: goals, isLoading: loadingGoals } = useQuery({
    queryKey: ["rehab-goals", patientId],
    queryFn: () => patientsApi.getRehabGoals(patientId),
  });

  const { data: progress } = useQuery({
    queryKey: ["stroke-progress", patientId],
    queryFn: () => patientsApi.getStrokeProgress(patientId),
  });

  const { data: sessions } = useQuery({
    queryKey: ["stroke-sessions", patientId],
    queryFn: () => patientsApi.getStrokeSessions(patientId),
  });

  const latestMap = (latest as Record<string, unknown>) ?? {};
  const goalList = (goals as Array<Record<string, unknown>>) ?? [];
  const activeGoals = goalList.filter(
    (g) => String(g.status ?? "") === "ACTIVE"
  );
  const progressData = (progress as Record<string, unknown>) ?? {};
  const sessionList = (sessions as Array<Record<string, unknown>>) ?? [];

  // Build summary cards from latest assessments
  const summaryCards = Object.entries(ASSESSMENT_INFO)
    .filter(([key]) => latestMap[key])
    .map(([key, info]) => {
      const entry = latestMap[key] as Record<string, unknown>;
      const score = Number(entry?.score ?? 0);
      const prevScore = Number(entry?.prev_score ?? score);
      const improving = LOWER_IS_BETTER.has(key)
        ? score < prevScore
        : score > prevScore;
      const changed = score !== prevScore;
      return { key, info, score, prevScore, improving, changed };
    });

  if (loadingLatest || loadingGoals) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-[var(--color-muted)] rounded-2xl" />
          ))}
        </div>
        <div className="h-40 bg-[var(--color-muted)] rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Assessment summary — 3 cards per row */}
      {summaryCards.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)] mb-3">
            Последние оценки
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {summaryCards.map(({ key, info, score, improving, changed }, i) => (
              <div
                key={key}
                className="bg-[var(--color-surface)] rounded-2xl border border-border p-4 animate-float-up"
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <div className="flex items-start justify-between mb-1">
                  <p className="text-xs font-medium text-[var(--color-text-tertiary)]">
                    {info.label}
                  </p>
                  {changed && (
                    <span
                      className={
                        improving ? "text-success" : "text-destructive"
                      }
                    >
                      {improving ? (
                        <IconTrendUp className="w-3.5 h-3.5" />
                      ) : (
                        <IconTrendDown className="w-3.5 h-3.5" />
                      )}
                    </span>
                  )}
                </div>
                <p
                  className={`text-2xl font-bold ${
                    changed
                      ? improving
                        ? "text-success"
                        : "text-destructive"
                      : "text-foreground"
                  }`}
                >
                  {score}
                </p>
                <p className="text-[10px] text-[var(--color-text-tertiary)] mt-0.5">
                  из {info.max} · {info.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Goals progress bars: baseline → current → target */}
      {activeGoals.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)] mb-3">
            Цели реабилитации
          </p>
          <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-5 space-y-4">
            {activeGoals.slice(0, 6).map((goal) => {
              const baseline = Number(goal.baseline_value ?? 0);
              const target = Number(goal.target_value ?? 100);
              const current = Number(goal.current_value ?? baseline);
              const range = target - baseline;
              const pct =
                range > 0
                  ? Math.min(
                      100,
                      Math.round(((current - baseline) / range) * 100)
                    )
                  : 0;
              return (
                <div key={String(goal.id)}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <DomainBadge domain={String(goal.domain ?? "")} />
                      <span className="text-xs text-foreground line-clamp-1">
                        {String(goal.description ?? "")}
                      </span>
                    </div>
                    <span className="text-xs font-semibold text-foreground flex-shrink-0 ml-2">
                      {pct}%
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[var(--color-muted)] overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        pct >= 75
                          ? "bg-success"
                          : pct >= 40
                          ? "bg-warning"
                          : "bg-secondary"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-0.5 text-[10px] text-[var(--color-text-tertiary)]">
                    <span>{baseline}</span>
                    <span className="font-medium text-foreground">
                      {current}
                    </span>
                    <span>{target}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Exercise stats strip — 4 mini-cards */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)] mb-3">
          Статистика упражнений
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            {
              label: "Сессий на неделе",
              value: String(
                progressData.sessions_this_week ?? sessionList.length
              ),
              sub: "сессий",
            },
            {
              label: "Средняя точность",
              value:
                sessionList.length > 0
                  ? `${Math.round(
                      (sessionList.reduce(
                        (s, x) => s + Number(x.accuracy_score ?? 0),
                        0
                      ) /
                        sessionList.length) *
                        100
                    )}%`
                  : "—",
              sub: "по всем сессиям",
            },
            {
              label: "Всего повторений",
              value: String(
                progressData.total_reps ??
                  sessionList.reduce(
                    (s, x) => s + Number(x.reps_completed ?? 0),
                    0
                  )
              ),
              sub: "повторений",
            },
            {
              label: "Всего сессий",
              value: String(sessionList.length),
              sub: "выполнено",
            },
          ].map(({ label, value, sub }, i) => (
            <div
              key={label}
              className="bg-[var(--color-surface)] rounded-2xl border border-border p-4 text-center animate-float-up"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <p className="text-xs text-[var(--color-text-tertiary)] mb-1">
                {label}
              </p>
              <p className="text-xl font-bold text-foreground">{value}</p>
              <p className="text-[10px] text-[var(--color-text-tertiary)] mt-0.5">
                {sub}
              </p>
            </div>
          ))}
        </div>
      </div>

      {summaryCards.length === 0 &&
        activeGoals.length === 0 &&
        sessionList.length === 0 && (
          <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-12 text-center">
            <svg
              className="w-10 h-10 text-[var(--color-text-tertiary)] mx-auto mb-3"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
            <p className="text-[var(--color-text-secondary)] font-medium">
              Данные о реабилитации отсутствуют
            </p>
            <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
              Добавьте оценки и цели в соответствующих вкладках
            </p>
          </div>
        )}
    </div>
  );
}

// ─── Tab 2: Scales (Шкалы оценки) ────────────────────────────────────────────

function ScalesTab({ patientId }: { patientId: string }) {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<Record<string, unknown> | null>(
    null
  );
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const { data: assessments, isLoading } = useQuery({
    queryKey: ["stroke-assessments", patientId],
    queryFn: () => patientsApi.getStrokeAssessments(patientId),
  });

  const list = (assessments as Array<Record<string, unknown>>) ?? [];

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      patientsApi.deleteStrokeAssessment(patientId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["stroke-assessments", patientId],
      });
      queryClient.invalidateQueries({
        queryKey: ["stroke-latest", patientId],
      });
      toast.success("Оценка удалена");
    },
    onError: () => toast.error("Не удалось удалить оценку"),
  });

  // Build trend summaries grouped by assessment type
  const trendsByType: Record<string, number[]> = {};
  for (const item of list) {
    const t = String(item.assessment_type ?? "");
    if (!trendsByType[t]) trendsByType[t] = [];
    trendsByType[t].push(Number(item.score ?? 0));
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">Шкалы оценки</p>
        <Button
          size="sm"
          variant="primary"
          onClick={() => {
            setEditItem(null);
            setModalOpen(true);
          }}
          icon={<IconPlus />}
        >
          + Новая оценка
        </Button>
      </div>

      {/* Trend summaries */}
      {Object.entries(trendsByType).filter(([, scores]) => scores.length >= 2)
        .length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Object.entries(trendsByType)
            .filter(([, scores]) => scores.length >= 2)
            .map(([type, scores]) => {
              const info = ASSESSMENT_INFO[type];
              if (!info) return null;
              const first = scores[scores.length - 1];
              const last = scores[0];
              const improving = LOWER_IS_BETTER.has(type)
                ? last < first
                : last > first;
              return (
                <div
                  key={type}
                  className="bg-[var(--color-surface)] rounded-xl border border-border p-3 flex items-center gap-3"
                >
                  <span
                    className={`flex-shrink-0 ${
                      improving ? "text-success" : "text-destructive"
                    }`}
                  >
                    {improving ? <IconTrendUp /> : <IconTrendDown />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground">
                      {info.label}
                    </p>
                    <p className="text-xs text-[var(--color-text-tertiary)]">
                      {improving ? "Улучшение: " : "Ухудшение: "}
                      {[...scores].reverse().join(" → ")}
                    </p>
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {/* Assessment list as cards grouped by type */}
      <DataTable
        isLoading={isLoading}
        data={list}
        emptyText="Нет оценок"
        emptySubtext='Нажмите «+ Новая оценка», чтобы добавить первую'
        columns={[
          {
            key: "assessed_at",
            header: "Дата",
            render: (item) => (
              <span className="font-mono text-xs text-[var(--color-text-tertiary)]">
                {item.assessed_at
                  ? formatDate(String(item.assessed_at))
                  : "—"}
              </span>
            ),
          },
          {
            key: "assessment_type",
            header: "Шкала",
            render: (item) => {
              const info =
                ASSESSMENT_INFO[String(item.assessment_type ?? "")];
              return (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-secondary/10 text-secondary">
                  {info?.label ?? String(item.assessment_type ?? "—")}
                </span>
              );
            },
          },
          {
            key: "score",
            header: "Балл",
            render: (item) => {
              const info =
                ASSESSMENT_INFO[String(item.assessment_type ?? "")];
              return (
                <span className="font-semibold text-foreground">
                  {String(item.score ?? "—")}
                  {info && (
                    <span className="text-[var(--color-text-tertiary)] font-normal">
                      {" "}
                      / {info.max}
                    </span>
                  )}
                </span>
              );
            },
          },
          {
            key: "interpretation",
            header: "Интерпретация",
            render: (item) => (
              <span className="text-xs text-[var(--color-text-secondary)] line-clamp-1">
                {String(item.interpretation ?? "—")}
              </span>
            ),
          },
          {
            key: "actions",
            header: "",
            className: "w-24",
            render: (item) => (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpandedRow(
                      expandedRow === String(item.id)
                        ? null
                        : String(item.id)
                    );
                  }}
                  className="w-6 h-6 rounded-md flex items-center justify-center text-[var(--color-text-tertiary)] hover:text-foreground hover:bg-[var(--color-muted)] transition-colors"
                  aria-label="Детали"
                >
                  <IconChevronDown
                    className={`w-3.5 h-3.5 transition-transform ${
                      expandedRow === String(item.id) ? "rotate-180" : ""
                    }`}
                  />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditItem(item);
                    setModalOpen(true);
                  }}
                  className="w-6 h-6 rounded-md flex items-center justify-center text-[var(--color-text-tertiary)] hover:text-secondary hover:bg-secondary/10 transition-colors"
                  aria-label="Редактировать"
                >
                  <IconPencil />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm("Удалить оценку?"))
                      deleteMutation.mutate(String(item.id));
                  }}
                  className="w-6 h-6 rounded-md flex items-center justify-center text-[var(--color-text-tertiary)] hover:text-destructive hover:bg-destructive/10 transition-colors"
                  aria-label="Удалить"
                >
                  <IconTrash />
                </button>
              </div>
            ),
          },
        ]}
        onRowClick={(item) =>
          setExpandedRow(
            expandedRow === String(item.id) ? null : String(item.id)
          )
        }
      />

      {/* Expanded details panel */}
      {expandedRow &&
        (() => {
          const item = list.find((i) => String(i.id) === expandedRow);
          if (!item) return null;
          const info =
            ASSESSMENT_INFO[String(item.assessment_type ?? "")];
          return (
            <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-5 animate-float-up">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-foreground">
                  {info?.label} — детали
                </p>
                <button
                  type="button"
                  onClick={() => setExpandedRow(null)}
                  className="w-6 h-6 rounded-lg flex items-center justify-center text-[var(--color-text-tertiary)] hover:text-foreground hover:bg-[var(--color-muted)] transition-colors"
                >
                  <IconX className="w-3.5 h-3.5" />
                </button>
              </div>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                {(
                  [
                    [
                      "Дата",
                      item.assessed_at
                        ? formatDate(String(item.assessed_at))
                        : "—",
                    ],
                    [
                      "Балл",
                      `${item.score ?? "—"} / ${info?.max ?? "—"}`,
                    ],
                    ["Интерпретация", item.interpretation ?? "—"],
                    ["Примечания", item.notes ?? "—"],
                  ] as [string, unknown][]
                ).map(([label, value]) => (
                  <div key={String(label)}>
                    <dt className="text-xs text-[var(--color-text-tertiary)] mb-0.5">
                      {label}
                    </dt>
                    <dd className="text-foreground">{String(value)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          );
        })()}

      {/* Modal */}
      {modalOpen && (
        <AssessmentModal
          patientId={patientId}
          initial={editItem}
          onClose={() => {
            setModalOpen(false);
            setEditItem(null);
          }}
        />
      )}
    </div>
  );
}

// ─── Tab 3: Rehab Goals (Цели реабилитации) ───────────────────────────────────

function GoalsTab({ patientId }: { patientId: string }) {
  const [modalOpen, setModalOpen] = useState(false);

  const { data: goals, isLoading } = useQuery({
    queryKey: ["rehab-goals", patientId],
    queryFn: () => patientsApi.getRehabGoals(patientId),
  });

  const goalList = (goals as Array<Record<string, unknown>>) ?? [];

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-pulse">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-48 bg-[var(--color-muted)] rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">
          Цели реабилитации ({goalList.length})
        </p>
        <Button
          size="sm"
          variant="primary"
          onClick={() => setModalOpen(true)}
          icon={<IconPlus />}
        >
          + Новая цель
        </Button>
      </div>

      {goalList.length === 0 ? (
        <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-12 text-center">
          <svg
            className="w-10 h-10 text-[var(--color-text-tertiary)] mx-auto mb-3"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="12" r="3" />
            <line x1="12" y1="2" x2="12" y2="5" />
            <line x1="12" y1="19" x2="12" y2="22" />
            <line x1="2" y1="12" x2="5" y2="12" />
            <line x1="19" y1="12" x2="22" y2="12" />
          </svg>
          <p className="text-[var(--color-text-secondary)] font-medium">
            Нет целей реабилитации
          </p>
          <p className="text-xs text-[var(--color-text-tertiary)] mt-1 mb-4">
            Добавьте цели для отслеживания восстановления пациента
          </p>
          <Button
            size="sm"
            variant="primary"
            onClick={() => setModalOpen(true)}
            icon={<IconPlus />}
          >
            Добавить первую цель
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {goalList.map((goal, i) => (
            <div
              key={String(goal.id ?? i)}
              className="animate-float-up"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <GoalCard goal={goal} patientId={patientId} />
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <GoalModal
          patientId={patientId}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  );
}

// ─── Tab 4: Exercises (Упражнения) ────────────────────────────────────────────

function ExercisesTab({ patientId }: { patientId: string }) {
  const { data: exercises, isLoading: loadingEx } = useQuery({
    queryKey: ["stroke-exercises", patientId],
    queryFn: () => patientsApi.getStrokeExercises(patientId),
  });

  const { data: sessions, isLoading: loadingSessions } = useQuery({
    queryKey: ["stroke-sessions", patientId],
    queryFn: () => patientsApi.getStrokeSessions(patientId),
  });

  const exerciseList = (exercises as Array<Record<string, unknown>>) ?? [];
  const sessionList = (sessions as Array<Record<string, unknown>>) ?? [];

  const DIFFICULTY_COLORS: Record<string, string> = {
    EASY: "text-success",
    MEDIUM: "text-warning",
    HARD: "text-destructive",
  };

  const DIFFICULTY_LABELS: Record<string, string> = {
    EASY: "Лёгкий",
    MEDIUM: "Средний",
    HARD: "Тяжёлый",
  };

  return (
    <div className="space-y-6">
      {/* Assigned exercises */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)] mb-3">
          Назначенные упражнения
        </p>
        {loadingEx ? (
          <div className="space-y-3 animate-pulse">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-20 bg-[var(--color-muted)] rounded-2xl"
              />
            ))}
          </div>
        ) : exerciseList.length === 0 ? (
          <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-8 text-center">
            <svg
              className="w-8 h-8 text-[var(--color-text-tertiary)] mx-auto mb-2"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
              <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
              <line x1="6" y1="1" x2="6" y2="4" />
              <line x1="10" y1="1" x2="10" y2="4" />
              <line x1="14" y1="1" x2="14" y2="4" />
            </svg>
            <p className="text-sm text-[var(--color-text-secondary)]">
              Назначьте упражнения через план лечения
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {exerciseList.map((ex, i) => {
              const difficulty = String(ex.difficulty ?? "");
              const category = String(ex.category ?? "");
              const accuracy = Number(ex.latest_accuracy ?? 0);
              return (
                <div
                  key={String(ex.id ?? i)}
                  className="bg-[var(--color-surface)] rounded-2xl border border-border p-4 animate-float-up"
                  style={{ animationDelay: `${i * 40}ms` }}
                >
                  <div className="flex items-start gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">
                        {String(ex.name ?? ex.exercise_name ?? "—")}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {category && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--color-muted)] text-[var(--color-text-secondary)] font-medium">
                            {category}
                          </span>
                        )}
                        {difficulty && (
                          <span
                            className={`text-[10px] font-semibold ${
                              DIFFICULTY_COLORS[difficulty] ??
                              "text-[var(--color-text-tertiary)]"
                            }`}
                          >
                            {DIFFICULTY_LABELS[difficulty] ?? difficulty}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-[var(--color-text-tertiary)]">
                    {[
                      ex.sets ? `${ex.sets} подходов` : null,
                      ex.reps ? `${ex.reps} повторений` : null,
                      ex.frequency ? String(ex.frequency) : null,
                    ]
                      .filter(Boolean)
                      .join(" × ")}
                  </p>
                  {ex.sessions_completed !== undefined && (
                    <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
                      Выполнено сессий:{" "}
                      <strong className="text-foreground">
                        {String(ex.sessions_completed)}
                      </strong>
                    </p>
                  )}
                  {accuracy > 0 && (
                    <div className="mt-2">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-[var(--color-text-tertiary)]">
                          Последняя точность
                        </span>
                        <span
                          className={`font-semibold ${
                            accuracy >= 0.8
                              ? "text-success"
                              : accuracy >= 0.5
                              ? "text-warning"
                              : "text-destructive"
                          }`}
                        >
                          {Math.round(accuracy * 100)}%
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-[var(--color-muted)] overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            accuracy >= 0.8
                              ? "bg-success"
                              : accuracy >= 0.5
                              ? "bg-warning"
                              : "bg-destructive"
                          }`}
                          style={{ width: `${accuracy * 100}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Session history table */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)] mb-3">
          История сессий
        </p>
        <DataTable
          isLoading={loadingSessions}
          data={sessionList}
          emptyText="Нет записей о сессиях"
          emptySubtext="Пациент ещё не выполнял упражнения"
          columns={[
            {
              key: "started_at",
              header: "Дата",
              render: (item) => (
                <span className="font-mono text-xs text-[var(--color-text-tertiary)]">
                  {item.started_at
                    ? formatDateTime(String(item.started_at))
                    : "—"}
                </span>
              ),
            },
            {
              key: "exercise_name",
              header: "Упражнение",
              render: (item) => (
                <span className="text-sm text-foreground">
                  {String(item.exercise_name ?? item.exercise_type ?? "—")}
                </span>
              ),
            },
            {
              key: "reps_completed",
              header: "Повт.",
              render: (item) => String(item.reps_completed ?? "—"),
            },
            {
              key: "sets_completed",
              header: "Подходы",
              render: (item) => String(item.sets_completed ?? "—"),
            },
            {
              key: "accuracy_score",
              header: "Точность",
              render: (item) => {
                const accuracy = Number(item.accuracy_score ?? 0);
                return (
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 bg-[var(--color-muted)] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          accuracy >= 0.8
                            ? "bg-success"
                            : accuracy >= 0.5
                            ? "bg-warning"
                            : "bg-destructive"
                        }`}
                        style={{ width: `${accuracy * 100}%` }}
                      />
                    </div>
                    <span
                      className={`font-semibold text-xs ${
                        accuracy >= 0.8
                          ? "text-success"
                          : accuracy >= 0.5
                          ? "text-warning"
                          : "text-destructive"
                      }`}
                    >
                      {Math.round(accuracy * 100)}%
                    </span>
                  </div>
                );
              },
            },
            {
              key: "duration_seconds",
              header: "Длительность",
              render: (item) => {
                const secs = Number(item.duration_seconds ?? 0);
                return (
                  <span className="text-[var(--color-text-secondary)]">
                    {Math.floor(secs / 60)} мин {secs % 60} сек
                  </span>
                );
              },
            },
          ]}
        />
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

function StrokePage() {
  const { patientId } = Route.useParams();
  const [activeTab, setActiveTab] = useState<TabKey>("overview");

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-semibold text-foreground">
          Реабилитация после инсульта
        </h2>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 p-1 bg-[var(--color-muted)] rounded-xl overflow-x-auto">
        {STROKE_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === tab.key
                ? "bg-[var(--color-surface)] text-foreground shadow-sm"
                : "text-[var(--color-text-tertiary)] hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="animate-float-up">
        {activeTab === "overview" && <OverviewTab patientId={patientId} />}
        {activeTab === "scales" && <ScalesTab patientId={patientId} />}
        {activeTab === "goals" && <GoalsTab patientId={patientId} />}
        {activeTab === "exercises" && <ExercisesTab patientId={patientId} />}
      </div>
    </div>
  );
}

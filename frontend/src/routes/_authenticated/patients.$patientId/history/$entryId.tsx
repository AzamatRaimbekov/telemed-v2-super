// routes/_authenticated/patients.$patientId/history/$entryId.tsx
// Medical history entry detail page with field-level AI confidence display
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useCallback } from "react";
import { patientsApi } from "@/features/patients/api";
import { formatDateTime } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute(
  "/_authenticated/patients/$patientId/history/$entryId"
)({
  component: EntryDetailPage,
});

const ENTRY_TYPE_LABELS: Record<string, string> = {
  initial_exam: "Первичный осмотр",
  daily_note: "Дневниковая запись",
  specialist_consult: "Консультация специалиста",
  procedure_note: "Запись о процедуре",
  discharge_summary: "Выписной эпикриз",
  anamnesis: "Анамнез",
  surgery_note: "Протокол операции",
  lab_interpretation: "Интерпретация анализов",
  imaging_description: "Описание снимка",
  ai_generated: "ИИ запись",
  manual: "Другое",
};

const FIELD_LABELS: Record<string, string> = {
  complaints: "Жалобы",
  dynamics: "Динамика",
  objective: "Объективно",
  vitals_summary: "Сводка показателей",
  current_therapy: "Текущая терапия",
  corrections: "Коррекции",
  plan: "План",
  chief_complaint: "Основная жалоба",
  anamnesis_morbi: "Anamnesis morbi",
  anamnesis_vitae: "Anamnesis vitae",
  objective_exam: "Объективный осмотр",
  preliminary_diagnosis: "Предварительный диагноз",
  specialist_role: "Специальность",
  specialist_name: "ФИО специалиста",
  reason: "Причина консультации",
  findings: "Данные осмотра",
  diagnosis: "Диагноз",
  recommendations: "Рекомендации",
  follow_up: "Наблюдение",
  text: "Содержание",
  anamnesis: "Анамнез",
  medications: "Назначения",
  examination: "Осмотр",
  conclusion: "Заключение",
  procedures: "Процедуры",
};

/** Confidence thresholds for color coding */
const HIGH_CONFIDENCE = 0.85;
const MEDIUM_CONFIDENCE = 0.60;

/**
 * Returns Tailwind classes for a confidence badge based on 0-1 score.
 * Green (>0.85), yellow (0.60-0.85), red (<0.60).
 */
function getConfidenceBadgeClasses(score: number): string {
  if (score >= HIGH_CONFIDENCE) {
    return "bg-emerald-100 text-emerald-700 border-emerald-200";
  }
  if (score >= MEDIUM_CONFIDENCE) {
    return "bg-amber-100 text-amber-700 border-amber-200";
  }
  return "bg-red-100 text-red-700 border-red-200";
}

/**
 * Returns the progress bar color class for a confidence score.
 */
function getConfidenceBarColor(score: number): string {
  if (score >= HIGH_CONFIDENCE) return "bg-emerald-500";
  if (score >= MEDIUM_CONFIDENCE) return "bg-amber-500";
  return "bg-red-500";
}

function EntryDetailPage() {
  const { patientId, entryId } = Route.useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [editFields, setEditFields] = useState<Record<string, string>>({});
  // Track which individual fields are being inline-edited (for low-confidence)
  const [inlineEditingFields, setInlineEditingFields] = useState<Set<string>>(
    new Set()
  );
  const [inlineEditValues, setInlineEditValues] = useState<
    Record<string, string>
  >({});

  const { data: entry, isLoading } = useQuery({
    queryKey: ["patient-history-entry", patientId, entryId],
    queryFn: () => patientsApi.getHistoryEntry(patientId, entryId),
  });

  const verifyMutation = useMutation({
    mutationFn: () => patientsApi.verifyHistoryEntry(patientId, entryId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["patient-history-entry", patientId, entryId],
      });
      queryClient.invalidateQueries({
        queryKey: ["patient-history", patientId],
      });
      toast.success("Запись подтверждена");
    },
    onError: () => toast.error("Не удалось подтвердить запись"),
  });

  const updateMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      patientsApi.updateHistoryEntry(patientId, entryId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["patient-history-entry", patientId, entryId],
      });
      queryClient.invalidateQueries({
        queryKey: ["patient-history", patientId],
      });
      setIsEditing(false);
      setInlineEditingFields(new Set());
      setInlineEditValues({});
      toast.success("Запись обновлена");
    },
    onError: () => toast.error("Не удалось сохранить изменения"),
  });

  const handleStartInlineEdit = useCallback(
    (fieldKey: string, currentValue: string) => {
      setInlineEditingFields((prev) => new Set(prev).add(fieldKey));
      setInlineEditValues((prev) => ({ ...prev, [fieldKey]: currentValue }));
    },
    []
  );

  const handleCancelInlineEdit = useCallback((fieldKey: string) => {
    setInlineEditingFields((prev) => {
      const next = new Set(prev);
      next.delete(fieldKey);
      return next;
    });
    setInlineEditValues((prev) => {
      const next = { ...prev };
      delete next[fieldKey];
      return next;
    });
  }, []);

  const handleSaveInlineEdit = useCallback(
    (fieldKey: string) => {
      if (!entry) return;
      const e = entry as Record<string, unknown>;
      const content = { ...(e.content as Record<string, unknown>) };
      content[fieldKey] = inlineEditValues[fieldKey];
      updateMutation.mutate({ content });
    },
    [entry, inlineEditValues, updateMutation]
  );

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-6 w-48 bg-[var(--color-muted)] rounded-lg" />
        <div className="h-64 bg-[var(--color-muted)] rounded-2xl" />
      </div>
    );
  }

  if (!entry) {
    return (
      <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-12 text-center">
        <p className="text-[var(--color-text-secondary)]">Запись не найдена</p>
        <Link
          to="/patients/$patientId/history"
          params={{ patientId }}
          className="mt-3 inline-block text-sm text-secondary hover:underline"
        >
          ← Вернуться к истории болезни
        </Link>
      </div>
    );
  }

  const e = entry as Record<string, unknown>;
  const isAI = e.entry_type === "ai_generated";
  const typeLabel =
    ENTRY_TYPE_LABELS[String(e.entry_type || "")] || String(e.entry_type || "");
  const hasSourceDoc = Boolean(e.source_document_url);
  const sourceUrl = String(e.source_document_url || "");
  const isAudioSource = /\.(webm|ogg|mp3|wav|m4a)$/i.test(sourceUrl);
  const isImageSource = /\.(jpg|jpeg|png|gif|webp)$/i.test(sourceUrl);

  // Determine if we should use split layout: AI entry with source document
  const useSplitLayout = isAI && hasSourceDoc;

  const handleEditStart = () => {
    const content = (e.content as Record<string, unknown>) || {};
    const fields: Record<string, string> = {};
    for (const [key, val] of Object.entries(content)) {
      if (key === "field_confidence") continue;
      fields[key] = val != null ? String(val) : "";
    }
    setEditFields(fields);
    setIsEditing(true);
  };

  const handleEditSave = () => {
    const content: Record<string, string> = {};
    for (const [key, val] of Object.entries(editFields)) {
      if (val.trim()) content[key] = val;
    }
    updateMutation.mutate({ content });
  };

  const setEditField = (key: string, value: string) => {
    setEditFields((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="max-w-6xl space-y-4">
      {/* Back */}
      <Link
        to="/patients/$patientId/history"
        params={{ patientId }}
        className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-foreground transition-colors"
      >
        <svg
          className="w-4 h-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="m12 19-7-7 7-7" />
          <path d="M19 12H5" />
        </svg>
        К истории болезни
      </Link>

      {/* Header card */}
      <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-secondary/10 text-secondary">
                {typeLabel}
              </span>
              {isAI && (
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700">
                  ИИ
                </span>
              )}
              {isAI && !e.is_verified && (
                <span className="px-2 py-0.5 rounded-full text-xs bg-warning/10 text-warning">
                  Требует подтверждения
                </span>
              )}
              {isAI && e.is_verified && (
                <span className="px-2 py-0.5 rounded-full text-xs bg-success/10 text-success">
                  Подтверждено
                </span>
              )}
            </div>
            {e.title && (
              <h2 className="text-[22px] font-bold text-foreground">
                {String(e.title)}
              </h2>
            )}
            <div className="flex items-center gap-4 mt-1 text-xs text-[var(--color-text-tertiary)]">
              {e.recorded_at && (
                <span>{formatDateTime(e.recorded_at as string)}</span>
              )}
              {e.author && (
                <span>
                  · {(e.author as Record<string, string>).last_name}{" "}
                  {(e.author as Record<string, string>).first_name}
                </span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {isAI && !e.is_verified && (
              <button
                type="button"
                onClick={() => verifyMutation.mutate()}
                disabled={verifyMutation.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-success/10 text-success text-sm font-medium hover:bg-success/20 transition-colors disabled:opacity-50"
              >
                <svg
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                Подтвердить
              </button>
            )}
            {!isEditing && (
              <button
                type="button"
                onClick={handleEditStart}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--color-muted)] text-[var(--color-text-secondary)] text-sm font-medium hover:text-foreground transition-colors"
              >
                <svg
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                Редактировать
              </button>
            )}
          </div>
        </div>

        {/* AI overall confidence indicator */}
        {isAI && e.confidence_score != null && (
          <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-amber-700">
                Общая достоверность ИИ
              </span>
              <span className="text-xs font-bold text-amber-700">
                {Math.round((e.confidence_score as number) * 100)}%
              </span>
            </div>
            <div className="h-1.5 bg-amber-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 rounded-full transition-all"
                style={{
                  width: `${(e.confidence_score as number) * 100}%`,
                }}
              />
            </div>
            {e.ai_notes && (
              <p className="text-xs text-amber-700 mt-2">
                {String(e.ai_notes)}
              </p>
            )}
          </div>
        )}

        {/* Content: split layout for AI entries with source doc, standard otherwise */}
        {isEditing ? (
          <div className="space-y-4">
            {Object.entries(editFields).map(([key, val]) => (
              <div key={key}>
                <label className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-1 block">
                  {FIELD_LABELS[key] || key.replace(/_/g, " ")}
                </label>
                <textarea
                  value={val}
                  onChange={(ev) => setEditField(key, ev.target.value)}
                  rows={key === "text" ? 8 : 3}
                  className="w-full px-4 py-3 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-secondary/30 resize-y"
                />
              </div>
            ))}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleEditSave}
                disabled={updateMutation.isPending}
                className="px-4 py-2 rounded-xl bg-secondary text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {updateMutation.isPending ? "Сохранение..." : "Сохранить"}
              </button>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 rounded-xl bg-[var(--color-muted)] text-[var(--color-text-secondary)] text-sm font-medium hover:text-foreground transition-colors"
              >
                Отмена
              </button>
            </div>
          </div>
        ) : useSplitLayout ? (
          /* Split view: source document (left) + extracted fields with confidence (right) */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Source document preview */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">
                Исходный документ
              </h3>
              <div className="rounded-xl overflow-hidden border border-border bg-[var(--color-muted)]">
                {isAudioSource ? (
                  <div className="p-4">
                    <audio
                      controls
                      className="w-full"
                      src={sourceUrl}
                    >
                      <track kind="captions" />
                    </audio>
                    {e.source_type === "ai_from_audio" && (
                      <p className="text-xs text-[var(--color-text-tertiary)] mt-2">
                        Текст записи получен из аудио с помощью ИИ
                      </p>
                    )}
                  </div>
                ) : isImageSource ? (
                  <img
                    src={sourceUrl}
                    alt="Исходный документ"
                    className="max-w-full h-auto"
                  />
                ) : (
                  <iframe
                    src={sourceUrl}
                    className="w-full h-[500px]"
                    title="Исходный документ"
                  />
                )}
              </div>
            </div>

            {/* Right: Extracted fields with per-field confidence */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">
                Извлечённые данные
              </h3>
              <AIFieldsWithConfidence
                entry={e}
                inlineEditingFields={inlineEditingFields}
                inlineEditValues={inlineEditValues}
                onStartEdit={handleStartInlineEdit}
                onCancelEdit={handleCancelInlineEdit}
                onSaveEdit={handleSaveInlineEdit}
                onChangeEditValue={(key, val) =>
                  setInlineEditValues((prev) => ({ ...prev, [key]: val }))
                }
                isSaving={updateMutation.isPending}
              />
            </div>
          </div>
        ) : isAI ? (
          /* AI entry without source doc: show fields with confidence inline */
          <AIFieldsWithConfidence
            entry={e}
            inlineEditingFields={inlineEditingFields}
            inlineEditValues={inlineEditValues}
            onStartEdit={handleStartInlineEdit}
            onCancelEdit={handleCancelInlineEdit}
            onSaveEdit={handleSaveInlineEdit}
            onChangeEditValue={(key, val) =>
              setInlineEditValues((prev) => ({ ...prev, [key]: val }))
            }
            isSaving={updateMutation.isPending}
          />
        ) : (
          <EntryTypeContent entry={e} />
        )}
      </div>

      {/* Standalone source document sections for non-split layout (non-AI entries) */}
      {!useSplitLayout && hasSourceDoc && isAudioSource && (
        <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-6">
          <h3 className="text-sm font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-4">
            Аудиозапись
          </h3>
          <audio
            controls
            className="w-full"
            src={sourceUrl}
          >
            <track kind="captions" />
          </audio>
          {e.source_type === "ai_from_audio" && (
            <p className="text-xs text-[var(--color-text-tertiary)] mt-2">
              Текст записи получен из аудио с помощью ИИ
            </p>
          )}
        </div>
      )}

      {!useSplitLayout && hasSourceDoc && !isAudioSource && (
        <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-6">
          <h3 className="text-sm font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-4">
            Исходный документ
          </h3>
          <div className="rounded-xl overflow-hidden border border-border bg-[var(--color-muted)]">
            {isImageSource ? (
              <img
                src={sourceUrl}
                alt="Исходный документ"
                className="max-w-full h-auto"
              />
            ) : (
              <iframe
                src={sourceUrl}
                className="w-full h-[600px]"
                title="Исходный документ"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// -- AI Fields with Confidence --

type AIFieldsWithConfidenceProps = {
  /** The full entry record */
  entry: Record<string, unknown>;
  /** Set of field keys currently being inline-edited */
  inlineEditingFields: Set<string>;
  /** Current inline edit values keyed by field name */
  inlineEditValues: Record<string, string>;
  /** Start inline editing for a field */
  onStartEdit: (key: string, currentValue: string) => void;
  /** Cancel inline edit for a field */
  onCancelEdit: (key: string) => void;
  /** Save inline edit for a field */
  onSaveEdit: (key: string) => void;
  /** Update inline edit value */
  onChangeEditValue: (key: string, value: string) => void;
  /** Whether a save mutation is in progress */
  isSaving: boolean;
};

/**
 * Renders extracted content fields with per-field confidence badges.
 * Fields with confidence < 0.60 show an inline edit button.
 */
function AIFieldsWithConfidence({
  entry,
  inlineEditingFields,
  inlineEditValues,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onChangeEditValue,
  isSaving,
}: AIFieldsWithConfidenceProps) {
  const content = (entry.content as Record<string, unknown>) || {};
  const fieldConfidence =
    (content.field_confidence as Record<string, number>) || {};

  // Filter out the field_confidence key itself from display
  const displayFields = Object.entries(content).filter(
    ([key]) => key !== "field_confidence"
  );

  if (displayFields.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm text-[var(--color-text-tertiary)]">
          Нет извлечённых данных
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {displayFields.map(([key, val]) => {
        if (val == null || String(val).trim() === "") return null;

        const confidence = fieldConfidence[key];
        const hasConfidence = confidence != null;
        const isLowConfidence = hasConfidence && confidence < MEDIUM_CONFIDENCE;
        const isFieldEditing = inlineEditingFields.has(key);
        const label = FIELD_LABELS[key] || key.replace(/_/g, " ");

        return (
          <div
            key={key}
            className="rounded-xl border border-border bg-[var(--color-muted)]/30 p-4"
          >
            {/* Field header: label + confidence badge */}
            <div className="flex items-center justify-between gap-2 mb-2">
              <p className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">
                {label}
              </p>
              <div className="flex items-center gap-2">
                {hasConfidence && (
                  <ConfidenceBadge score={confidence} />
                )}
                {isLowConfidence && !isFieldEditing && (
                  <button
                    type="button"
                    onClick={() => onStartEdit(key, String(val))}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs text-red-600 hover:bg-red-50 transition-colors"
                    aria-label={`Редактировать поле ${label}`}
                  >
                    <svg
                      className="w-3.5 h-3.5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                    Исправить
                  </button>
                )}
              </div>
            </div>

            {/* Field value or inline editor */}
            {isFieldEditing ? (
              <div className="space-y-2">
                <textarea
                  value={inlineEditValues[key] ?? ""}
                  onChange={(ev) => onChangeEditValue(key, ev.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-red-300 bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-red-300/50 resize-y"
                  aria-label={`Редактирование: ${label}`}
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => onSaveEdit(key)}
                    disabled={isSaving}
                    className="px-3 py-1 rounded-lg bg-secondary text-white text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {isSaving ? "..." : "Сохранить"}
                  </button>
                  <button
                    type="button"
                    onClick={() => onCancelEdit(key)}
                    className="px-3 py-1 rounded-lg bg-[var(--color-muted)] text-[var(--color-text-secondary)] text-xs font-medium hover:text-foreground transition-colors"
                  >
                    Отмена
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                {String(val)}
              </p>
            )}

            {/* Mini confidence bar under the field value */}
            {hasConfidence && (
              <div className="mt-2 flex items-center gap-2">
                <div className="flex-1 h-1 bg-[var(--color-muted)] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${getConfidenceBarColor(confidence)}`}
                    style={{ width: `${confidence * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// -- Confidence Badge --

type ConfidenceBadgeProps = {
  /** Confidence score from 0 to 1 */
  score: number;
};

/** Small badge showing confidence percentage with color coding */
function ConfidenceBadge({ score }: ConfidenceBadgeProps) {
  const percent = Math.round(score * 100);
  const classes = getConfidenceBadgeClasses(score);

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border ${classes}`}
      title={`Достоверность ИИ: ${percent}%`}
    >
      {percent}%
    </span>
  );
}

// -- Standard Entry Content (non-AI) --

function EntryTypeContent({ entry }: { entry: Record<string, unknown> }) {
  const type = String(entry.entry_type || "");
  const data = (entry.content as Record<string, unknown>) || {};

  const Field = ({
    label,
    value,
  }: {
    label: string;
    value: string | null | undefined;
  }) => {
    if (!value) return null;
    return (
      <div className="space-y-1">
        <p className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">
          {label}
        </p>
        <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
          {value}
        </p>
      </div>
    );
  };

  if (type === "daily_note") {
    return (
      <div className="space-y-5">
        <Field label="Жалобы" value={data.complaints as string} />
        <Field label="Динамика" value={data.dynamics as string} />
        <Field label="Объективно" value={data.objective as string} />
        <Field label="Сводка показателей" value={data.vitals_summary as string} />
        <Field label="Текущая терапия" value={data.current_therapy as string} />
        <Field label="Коррекции" value={data.corrections as string} />
        <Field label="План" value={data.plan as string} />
        <Field label="Содержание" value={data.text as string} />
      </div>
    );
  }

  if (type === "initial_exam") {
    return (
      <div className="space-y-5">
        <Field label="Основная жалоба" value={data.chief_complaint as string} />
        <Field label="Anamnesis morbi" value={data.anamnesis_morbi as string} />
        <Field label="Anamnesis vitae" value={data.anamnesis_vitae as string} />
        <Field
          label="Объективный осмотр"
          value={data.objective_exam as string}
        />
        <Field
          label="Предварительный диагноз"
          value={data.preliminary_diagnosis as string}
        />
        <Field label="План" value={data.plan as string} />
      </div>
    );
  }

  if (type === "specialist_consult") {
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Специальность"
            value={data.specialist_role as string}
          />
          <Field
            label="ФИО специалиста"
            value={data.specialist_name as string}
          />
        </div>
        <Field
          label="Причина консультации"
          value={data.reason as string}
        />
        <Field label="Данные осмотра" value={data.findings as string} />
        <Field label="Диагноз" value={data.diagnosis as string} />
        <Field
          label="Рекомендации"
          value={data.recommendations as string}
        />
        <Field label="Наблюдение" value={data.follow_up as string} />
      </div>
    );
  }

  // Generic fallback — show all fields from content dict
  return (
    <div className="space-y-4">
      {Object.entries(data).map(([key, val]) =>
        val ? (
          <Field
            key={key}
            label={FIELD_LABELS[key] || key.replace(/_/g, " ")}
            value={String(val)}
          />
        ) : null
      )}
    </div>
  );
}

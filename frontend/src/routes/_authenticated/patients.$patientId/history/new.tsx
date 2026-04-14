import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useRef, useCallback, useEffect } from "react";
import { patientsApi } from "@/features/patients/api";
import { toast } from "sonner";
import { CustomSelect } from "@/components/ui/select-custom";
import { InputField } from "@/components/ui/input-field";
import { TextareaField } from "@/components/ui/textarea-field";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute(
  "/_authenticated/patients/$patientId/history/new"
)({
  component: NewEntryPage,
});

type Method = "manual" | "upload" | "dictate";
type EntryType =
  | "daily_note"
  | "initial_exam"
  | "specialist_consult"
  | "procedure_note"
  | "discharge_summary"
  | "anamnesis"
  | "surgery_note"
  | "lab_interpretation"
  | "imaging_description"
  | "manual";

const ENTRY_TYPE_OPTIONS: Array<{ value: EntryType; label: string }> = [
  { value: "daily_note", label: "Дневниковая запись" },
  { value: "initial_exam", label: "Первичный осмотр" },
  { value: "specialist_consult", label: "Консультация специалиста" },
  { value: "procedure_note", label: "Запись о процедуре" },
  { value: "discharge_summary", label: "Выписной эпикриз" },
  { value: "anamnesis", label: "Анамнез" },
  { value: "surgery_note", label: "Протокол операции" },
  { value: "lab_interpretation", label: "Интерпретация анализов" },
  { value: "imaging_description", label: "Описание снимка" },
  { value: "manual", label: "Другое" },
];

interface AIAnalysisResult {
  entry_type?: string;
  title?: string;
  content?: string;
  data?: Record<string, unknown>;
  confidence_score?: number;
  ai_notes?: string;
  field_confidences?: Record<string, number>;
}

function NewEntryPage() {
  const { patientId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [method, setMethod] = useState<Method | null>(null);

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      patientsApi.createHistoryEntry(patientId, data),
    onSuccess: (entry: Record<string, unknown>) => {
      queryClient.invalidateQueries({ queryKey: ["patient-history", patientId] });
      queryClient.invalidateQueries({ queryKey: ["patient-history-stats", patientId] });
      toast.success("Запись сохранена");
      navigate({
        to: "/patients/$patientId/history/$entryId",
        params: { patientId, entryId: String(entry.id) },
      });
    },
    onError: () => toast.error("Не удалось сохранить запись"),
  });

  if (!method) {
    return <MethodSelection onSelect={setMethod} />;
  }

  return (
    <div className="max-w-4xl">
      <button
        onClick={() => setMethod(null)}
        className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-foreground mb-6 transition-colors"
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
        Выбрать другой способ
      </button>

      {method === "manual" && (
        <ManualEntryForm
          onSubmit={(data) => createMutation.mutate(data)}
          isPending={createMutation.isPending}
        />
      )}
      {method === "upload" && (
        <UploadEntryForm
          patientId={patientId}
          onSubmit={(data) => createMutation.mutate(data)}
          isPending={createMutation.isPending}
        />
      )}
      {method === "dictate" && (
        <DictateEntryForm
          onSubmit={(data) => createMutation.mutate(data)}
          isPending={createMutation.isPending}
        />
      )}
    </div>
  );
}

// ─── Method Selection ─────────────────────────────────────────────────────────

function MethodSelection({ onSelect }: { onSelect: (m: Method) => void }) {
  const methods: Array<{
    key: Method;
    label: string;
    description: string;
    icon: React.ReactNode;
    color: string;
  }> = [
    {
      key: "manual",
      label: "Ввести вручную",
      description: "Заполните форму с нужными полями",
      color: "bg-secondary/10 text-secondary hover:border-secondary/40",
      icon: (
        <svg
          className="w-8 h-8"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      ),
    },
    {
      key: "upload",
      label: "Загрузить документ",
      description: "Загрузите фото или PDF — ИИ извлечёт данные",
      color: "bg-amber-50 text-amber-600 hover:border-amber-300",
      icon: (
        <svg
          className="w-8 h-8"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" x2="12" y1="3" y2="15" />
        </svg>
      ),
    },
    {
      key: "dictate",
      label: "Надиктовать",
      description: "Запишите голосом и отредактируйте текст",
      color: "bg-success/10 text-success hover:border-success/30",
      icon: (
        <svg
          className="w-8 h-8"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" x2="12" y1="19" y2="22" />
        </svg>
      ),
    },
  ];

  return (
    <div className="max-w-3xl">
      <h2 className="text-[22px] font-bold text-foreground mb-2">
        Новая запись в истории болезни
      </h2>
      <p className="text-sm text-[var(--color-text-secondary)] mb-8">
        Выберите способ добавления записи
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {methods.map((m) => (
          <button
            key={m.key}
            onClick={() => onSelect(m.key)}
            className={`flex flex-col items-center gap-4 p-6 rounded-2xl border-2 border-border transition-all hover:shadow-md ${m.color}`}
          >
            <div className="w-16 h-16 rounded-2xl bg-white/70 flex items-center justify-center shadow-sm">
              {m.icon}
            </div>
            <div className="text-center">
              <p className="font-semibold text-sm">{m.label}</p>
              <p className="text-xs opacity-70 mt-1 leading-snug">{m.description}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Manual Entry Form ────────────────────────────────────────────────────────

interface FormProps {
  onSubmit: (data: Record<string, unknown>) => void;
  isPending: boolean;
  defaultValues?: Partial<AIAnalysisResult>;
  fieldConfidences?: Record<string, number>;
  showConfidenceIndicators?: boolean;
  formRef?: React.RefObject<HTMLFormElement | null>;
}

function ManualEntryForm({
  onSubmit,
  isPending,
  defaultValues,
  fieldConfidences,
  showConfidenceIndicators,
  formRef,
}: FormProps) {
  const now = new Date().toISOString().slice(0, 16);
  const [entryType, setEntryType] = useState<EntryType>(
    (defaultValues?.entry_type as EntryType) || "daily_note"
  );
  const [datetime, setDatetime] = useState(now);
  const [title, setTitle] = useState(defaultValues?.title || "");
  const [content, setContent] = useState(defaultValues?.content || "");
  const [formData, setFormData] = useState<Record<string, string>>(
    (defaultValues?.data as Record<string, string>) || {}
  );

  const setField = (key: string, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const getFieldClass = (key: string): string => {
    if (!showConfidenceIndicators || !fieldConfidences) {
      return "w-full px-4 py-3 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-secondary/30 resize-y";
    }
    const conf = fieldConfidences[key];
    if (conf == null)
      return "w-full px-4 py-3 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-secondary/30 resize-y";
    if (conf > 0.85)
      return "w-full px-4 py-3 rounded-xl border-2 border-success bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-success/30 resize-y";
    if (conf >= 0.6)
      return "w-full px-4 py-3 rounded-xl border border-amber-300 bg-amber-50 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-amber-300/30 resize-y";
    return "w-full px-4 py-3 rounded-xl border-2 border-destructive bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-destructive/30 resize-y";
  };

  const FieldLabel = ({
    label,
    fieldKey,
  }: {
    label: string;
    fieldKey: string;
  }) => {
    const conf = showConfidenceIndicators ? fieldConfidences?.[fieldKey] : null;
    return (
      <div className="flex items-center gap-2 mb-1">
        <label className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">
          {label}
        </label>
        {conf != null && (
          <span
            className={`text-xs px-1.5 py-0.5 rounded-md font-medium ${
              conf > 0.85
                ? "bg-success/10 text-success"
                : conf >= 0.6
                ? "bg-amber-100 text-amber-700"
                : "bg-destructive/10 text-destructive"
            }`}
          >
            {conf > 0.85
              ? "✓ Проверено"
              : conf >= 0.6
              ? "Проверьте"
              : "Заполните вручную"}
          </span>
        )}
      </div>
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Build content as dict — backend expects JSONB
    const hasStructuredFields = Object.values(formData).some((v) => v.trim());
    const contentDict: Record<string, unknown> = hasStructuredFields
      ? { ...formData }
      : { text: content || "" };

    // If content textarea was used (procedure_note, imaging_description, manual),
    // put that text into the content dict
    if (content && !hasStructuredFields) {
      contentDict.text = content;
    }

    // Auto-generate title if empty
    const entryLabel = ENTRY_TYPE_OPTIONS.find((o) => o.value === entryType)?.label || entryType;
    const finalTitle = title.trim() || `${entryLabel} — ${new Date(datetime).toLocaleDateString("ru-RU")}`;

    onSubmit({
      entry_type: entryType,
      title: finalTitle,
      content: contentDict,
      recorded_at: new Date(datetime).toISOString(),
      source_type: "manual",
    });
  };

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-6">
        <h3 className="text-sm font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-4">
          Основные параметры
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <CustomSelect
            label="Тип записи"
            value={entryType}
            onChange={(val) => setEntryType(val as EntryType)}
            options={ENTRY_TYPE_OPTIONS}
          />
          <InputField
            label="Дата и время"
            type="datetime-local"
            value={datetime}
            onChange={(e) => setDatetime(e.target.value)}
          />
        </div>
        <div className="mt-4">
          <InputField
            label="Заголовок (необязательно)"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Краткий заголовок записи"
          />
        </div>
      </div>

      {/* Dynamic form by type */}
      <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-6">
        <h3 className="text-sm font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-4">
          Содержание
        </h3>

        {entryType === "daily_note" && (
          <div className="space-y-4">
            {[
              { key: "complaints", label: "Жалобы" },
              { key: "dynamics", label: "Динамика" },
              { key: "objective", label: "Объективно" },
              { key: "vitals_summary", label: "Сводка показателей" },
              { key: "current_therapy", label: "Текущая терапия" },
              { key: "corrections", label: "Коррекции лечения" },
              { key: "plan", label: "План" },
            ].map(({ key, label }) => (
              <div key={key}>
                <FieldLabel label={label} fieldKey={key} />
                <textarea
                  value={formData[key] || ""}
                  onChange={(e) => setField(key, e.target.value)}
                  rows={3}
                  className={getFieldClass(key)}
                />
              </div>
            ))}
          </div>
        )}

        {entryType === "initial_exam" && (
          <div className="space-y-4">
            {[
              { key: "chief_complaint", label: "Основная жалоба", rows: 2 },
              { key: "anamnesis_morbi", label: "Anamnesis morbi", rows: 4 },
              { key: "anamnesis_vitae", label: "Anamnesis vitae", rows: 4 },
              { key: "objective_exam", label: "Объективный осмотр", rows: 4 },
              {
                key: "preliminary_diagnosis",
                label: "Предварительный диагноз",
                rows: 2,
              },
              { key: "plan", label: "План обследования и лечения", rows: 3 },
            ].map(({ key, label, rows }) => (
              <div key={key}>
                <FieldLabel label={label} fieldKey={key} />
                <textarea
                  value={formData[key] || ""}
                  onChange={(e) => setField(key, e.target.value)}
                  rows={rows}
                  className={getFieldClass(key)}
                />
              </div>
            ))}
          </div>
        )}

        {entryType === "specialist_consult" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <FieldLabel label="Специальность" fieldKey="specialist_role" />
                <input
                  type="text"
                  value={formData.specialist_role || ""}
                  onChange={(e) => setField("specialist_role", e.target.value)}
                  className={`${getFieldClass("specialist_role")} !resize-none`}
                  style={{ resize: "none" }}
                />
              </div>
              <div>
                <FieldLabel label="ФИО специалиста" fieldKey="specialist_name" />
                <input
                  type="text"
                  value={formData.specialist_name || ""}
                  onChange={(e) => setField("specialist_name", e.target.value)}
                  className={`${getFieldClass("specialist_name")} !resize-none`}
                  style={{ resize: "none" }}
                />
              </div>
            </div>
            {[
              { key: "reason", label: "Причина консультации", rows: 2 },
              { key: "findings", label: "Данные осмотра", rows: 4 },
              { key: "diagnosis", label: "Диагноз", rows: 2 },
              { key: "recommendations", label: "Рекомендации", rows: 3 },
              { key: "follow_up", label: "Наблюдение", rows: 2 },
            ].map(({ key, label, rows }) => (
              <div key={key}>
                <FieldLabel label={label} fieldKey={key} />
                <textarea
                  value={formData[key] || ""}
                  onChange={(e) => setField(key, e.target.value)}
                  rows={rows}
                  className={getFieldClass(key)}
                />
              </div>
            ))}
          </div>
        )}

        {(entryType === "procedure_note" ||
          entryType === "imaging_description" ||
          entryType === "discharge_summary" ||
          entryType === "anamnesis" ||
          entryType === "surgery_note" ||
          entryType === "lab_interpretation" ||
          entryType === "manual") && (
          <div className="space-y-4">
            <div>
              <FieldLabel label="Содержание" fieldKey="content" />
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={8}
                placeholder="Введите текст записи..."
                className={getFieldClass("content")}
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-3">
        <Button
          type="button"
          variant="secondary"
          onClick={() => window.history.back()}
        >
          Отмена
        </Button>
        <Button
          type="submit"
          variant="primary"
          disabled={isPending}
          loading={isPending}
        >
          {isPending ? "Сохранение..." : "Сохранить запись"}
        </Button>
      </div>
    </form>
  );
}

// ─── Upload Entry Form ────────────────────────────────────────────────────────

function UploadEntryForm({
  patientId,
  onSubmit,
  isPending,
}: {
  patientId: string;
  onSubmit: (data: Record<string, unknown>) => void;
  isPending: boolean;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<"image" | "pdf" | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AIAnalysisResult | null>(null);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const verifyFlagRef = useRef(false);

  const handleFile = useCallback(
    async (file: File) => {
      if (file.size > 20 * 1024 * 1024) {
        toast.error("Файл слишком большой. Максимум 20 МБ.");
        return;
      }
      const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
      if (!allowed.includes(file.type)) {
        toast.error("Допустимые форматы: JPG, PNG, PDF");
        return;
      }

      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      setPreviewType(file.type === "application/pdf" ? "pdf" : "image");
      setAnalyzeError(null);
      setIsAnalyzing(true);

      try {
        const result = await patientsApi.analyzeDocument(patientId, file);
        setAnalysisResult(result as AIAnalysisResult);
      } catch {
        setAnalyzeError("Не удалось проанализировать документ. Заполните данные вручную.");
        setAnalysisResult({ entry_type: "imaging_description" });
      } finally {
        setIsAnalyzing(false);
      }
    },
    [patientId]
  );

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleSave = (data: Record<string, unknown>) => {
    onSubmit({
      ...data,
      source_type: "ai_from_photo",
      source_document_url: previewUrl,
      ...(verifyFlagRef.current ? { is_verified: true } : {}),
    });
    verifyFlagRef.current = false;
  };

  if (!previewUrl) {
    return (
      <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-8">
        <h3 className="text-sm font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-6">
          Загрузить документ
        </h3>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${
            isDragging
              ? "border-secondary bg-secondary/5"
              : "border-border hover:border-secondary/50 hover:bg-[var(--color-muted)]"
          }`}
        >
          <svg
            className="w-12 h-12 text-[var(--color-text-tertiary)] mx-auto mb-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" x2="12" y1="3" y2="15" />
          </svg>
          <p className="text-sm font-medium text-foreground mb-1">
            Перетащите файл или нажмите для выбора
          </p>
          <p className="text-xs text-[var(--color-text-tertiary)]">
            JPG, PNG, PDF · до 20 МБ
          </p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.webp,.pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
      </div>
    );
  }

  if (isAnalyzing) {
    return (
      <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-12">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-amber-500 animate-spin"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
          </div>
          <div className="text-center">
            <p className="font-semibold text-foreground">ИИ анализирует документ...</p>
            <p className="text-sm text-[var(--color-text-secondary)] mt-1">
              Извлечение медицинских данных
            </p>
          </div>
          <div className="space-y-2 w-full max-w-sm">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-4 bg-[var(--color-muted)] rounded-lg animate-pulse"
                style={{ animationDelay: `${i * 150}ms`, width: `${80 - i * 15}%` }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Split view: document + form
  return (
    <div className="space-y-4">
      {analyzeError && (
        <div className="p-4 rounded-xl bg-warning/10 border border-warning/20 text-sm text-warning">
          {analyzeError}
        </div>
      )}
      {analysisResult?.ai_notes && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-700">
          <strong>Заметки ИИ:</strong> {analysisResult.ai_notes}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Document preview */}
        <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-4">
          <h3 className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-3">
            Документ
          </h3>
          <div className="rounded-xl overflow-hidden bg-[var(--color-muted)]">
            {previewType === "image" ? (
              <img src={previewUrl} alt="Загруженный документ" className="w-full h-auto" />
            ) : (
              <iframe
                src={previewUrl}
                className="w-full h-[500px]"
                title="Загруженный документ"
              />
            )}
          </div>
        </div>

        {/* Pre-filled form */}
        <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-4">
          <h3 className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-3">
            Извлечённые данные
          </h3>
          <div className="space-y-3">
            <ManualEntryForm
              onSubmit={handleSave}
              isPending={isPending}
              defaultValues={analysisResult || undefined}
              fieldConfidences={analysisResult?.field_confidences}
              showConfidenceIndicators
              formRef={formRef}
            />
          </div>
        </div>
      </div>

      {/* Extra "Save and verify" button */}
      <div className="flex justify-end">
        <button
          onClick={() => {
            verifyFlagRef.current = true;
            formRef.current?.requestSubmit();
          }}
          disabled={isPending}
          className="px-6 py-2.5 rounded-xl border border-success text-success text-sm font-medium hover:bg-success/10 transition-colors disabled:opacity-50"
        >
          Сохранить и подтвердить
        </button>
      </div>
    </div>
  );
}

// ─── Dictate Entry Form ───────────────────────────────────────────────────────

function DictateEntryForm({
  onSubmit,
  isPending,
}: {
  onSubmit: (data: Record<string, unknown>) => void;
  isPending: boolean;
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [transcription, setTranscription] = useState("");
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);

      timerRef.current = setInterval(() => {
        setRecordingSeconds((s) => s + 1);
      }, 1000);

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        if (timerRef.current) clearInterval(timerRef.current);
        setIsRecording(false);
        // In a real implementation this would send audio to speech-to-text API.
        // For now we leave the textarea for manual editing.
      };
    } catch {
      toast.error("Нет доступа к микрофону. Проверьте разрешения браузера.");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
  };

  const formatTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const now = new Date();
    onSubmit({
      entry_type: "daily_note",
      title: `Дневниковая запись — ${now.toLocaleDateString("ru-RU")}`,
      content: { complaints: transcription },
      recorded_at: now.toISOString(),
      source_type: "ai_from_audio",
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-6">
        <h3 className="text-sm font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-4">
          Голосовая запись
        </h3>

        <div className="flex flex-col items-center gap-4 py-6">
          <button
            type="button"
            onClick={isRecording ? stopRecording : startRecording}
            className={`w-20 h-20 rounded-full flex items-center justify-center transition-all shadow-lg ${
              isRecording
                ? "bg-destructive text-white scale-110 shadow-destructive/30 animate-pulse"
                : "bg-success/10 text-success hover:bg-success/20 hover:scale-105"
            }`}
          >
            {isRecording ? (
              <svg
                className="w-8 h-8"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
            ) : (
              <svg
                className="w-8 h-8"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" x2="12" y1="19" y2="22" />
              </svg>
            )}
          </button>

          {isRecording && (
            <p className="text-sm font-mono text-destructive font-semibold">
              {formatTime(recordingSeconds)} · Запись...
            </p>
          )}
          {!isRecording && recordingSeconds > 0 && (
            <p className="text-sm text-[var(--color-text-secondary)]">
              Запись остановлена · {formatTime(recordingSeconds)}
            </p>
          )}
          {!isRecording && recordingSeconds === 0 && (
            <p className="text-sm text-[var(--color-text-secondary)]">
              Нажмите для начала записи
            </p>
          )}
        </div>

        <TextareaField
          label="Текст записи"
          value={transcription}
          onChange={(e) => setTranscription(e.target.value)}
          rows={10}
          placeholder="Текст появится здесь после транскрипции. Вы также можете вводить или редактировать вручную..."
        />
      </div>

      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="secondary"
          onClick={() => window.history.back()}
        >
          Отмена
        </Button>
        <Button
          type="submit"
          variant="primary"
          disabled={isPending || !transcription.trim()}
          loading={isPending}
        >
          {isPending ? "Сохранение..." : "Сохранить запись"}
        </Button>
      </div>
    </form>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useRef, useCallback } from "react";
import { patientsApi } from "@/features/patients/api";
import { formatDateTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InputField } from "@/components/ui/input-field";
import { CustomSelect } from "@/components/ui/select-custom";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { aiApi } from "@/features/ai/api";
import { useAI } from "@/features/ai/useAI";
import { AITriggerButton } from "@/features/ai/components/AITriggerButton";
import { AIResultPanel } from "@/features/ai/components/AIResultPanel";
import { AIConclusionResult } from "@/features/ai/components/AIConclusionResult";

export const Route = createFileRoute(
  "/_authenticated/patients/$patientId/documents"
)({
  component: DocumentsPage,
});

interface DocumentItem {
  id: string;
  title: string;
  category: string;
  file_url: string;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  description: string | null;
  uploaded_by_name: string;
  uploaded_at: string | null;
  created_at: string;
}

const CATEGORY_OPTIONS = [
  { value: "lab_result", label: "Анализы" },
  { value: "imaging", label: "Снимки" },
  { value: "prescription", label: "Рецепты" },
  { value: "discharge", label: "Выписки" },
  { value: "consent", label: "Согласия" },
  { value: "referral", label: "Направления" },
  { value: "insurance", label: "Страховка" },
  { value: "identity", label: "Удостоверения" },
  { value: "other", label: "Другое" },
];

const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(CATEGORY_OPTIONS.map((o) => [o.value, o.label]));

const FILTER_OPTIONS = [
  { value: "all", label: "Все" },
  ...CATEGORY_OPTIONS.slice(0, 5),
];

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

function getFileIcon(mimeType: string | null): string {
  if (!mimeType) return "file";
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType.includes("word") || mimeType.includes("document")) return "doc";
  return "file";
}

function DocumentsPage() {
  const { patientId } = Route.useParams();
  const queryClient = useQueryClient();
  const aiConclusion = useAI("conclusion-generate", aiApi.generateConclusion);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<DocumentItem | null>(null);

  const { data: rawDocs, isLoading } = useQuery({
    queryKey: ["patient-documents", patientId],
    queryFn: () => patientsApi.getDocuments(patientId),
  });

  const deleteMutation = useMutation({
    mutationFn: (docId: string) => patientsApi.deleteDocument(patientId, docId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patient-documents", patientId] });
      toast.success("Документ удалён");
      setPreviewDoc(null);
    },
    onError: () => toast.error("Ошибка удаления"),
  });

  const documents = useMemo(() => {
    let items = (rawDocs as DocumentItem[]) || [];
    if (categoryFilter !== "all") items = items.filter((d) => d.category === categoryFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter((d) => d.title.toLowerCase().includes(q) || d.file_name.toLowerCase().includes(q));
    }
    return items;
  }, [rawDocs, categoryFilter, search]);

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
          <h2 className="text-lg font-bold text-foreground">Документы</h2>
          {((rawDocs as DocumentItem[]) || []).length > 0 && (
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-secondary/10 text-secondary">
              {((rawDocs as DocumentItem[]) || []).length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <AITriggerButton
            onClick={() => aiConclusion.trigger({ patient_id: patientId, diagnoses: [] })}
            isPending={aiConclusion.isPending}
            tooltip="AI: сгенерировать заключение"
          />
          <Button variant="primary" size="sm" onClick={() => setShowUpload(!showUpload)}>
            {showUpload ? "Отмена" : "+ Загрузить"}
          </Button>
        </div>
      </div>

      {/* Upload form */}
      <AnimatePresence>
        {showUpload && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <UploadForm
              patientId={patientId}
              onSuccess={() => {
                queryClient.invalidateQueries({ queryKey: ["patient-documents", patientId] });
                setShowUpload(false);
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* AI Conclusion Result */}
      <AnimatePresence>
        {aiConclusion.result && (
          <AIResultPanel
            provider={aiConclusion.result.provider}
            model={aiConclusion.result.model}
            acceptLabel="✓ Копировать"
            onAccept={() => {
              navigator.clipboard.writeText(aiConclusion.result!.conclusion_text);
              toast.success("Текст заключения скопирован в буфер обмена");
              aiConclusion.reset();
            }}
            onReject={() => aiConclusion.reset()}
            onRetry={() => aiConclusion.trigger({ patient_id: patientId, diagnoses: [] })}
          >
            <AIConclusionResult conclusionText={aiConclusion.result.conclusion_text} />
          </AIResultPanel>
        )}
      </AnimatePresence>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex bg-[var(--color-muted)] rounded-lg p-0.5 overflow-x-auto">
          {FILTER_OPTIONS.map((opt) => (
            <button key={opt.value} type="button" onClick={() => setCategoryFilter(opt.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${categoryFilter === opt.value ? "bg-[var(--color-surface)] text-foreground shadow-sm" : "text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]"}`}>
              {opt.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-xs">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-tertiary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
          </svg>
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Поиск..."
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-border bg-[var(--color-surface)] text-foreground placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-secondary/30" />
        </div>
      </div>

      {/* Document grid */}
      {documents.length === 0 ? (
        <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[var(--color-muted)] flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-[var(--color-text-tertiary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v4a2 2 0 0 0 2 2h4" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-foreground mb-1">{search || categoryFilter !== "all" ? "Ничего не найдено" : "Нет документов"}</h3>
          <p className="text-sm text-[var(--color-text-secondary)]">{search || categoryFilter !== "all" ? "Попробуйте изменить фильтры" : "Загрузите первый документ"}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {documents.map((doc) => {
            const iconType = getFileIcon(doc.mime_type);
            const isImage = doc.mime_type?.startsWith("image/");
            return (
              <div key={doc.id} className="bg-[var(--color-surface)] rounded-2xl border border-border hover:border-secondary/20 transition-colors overflow-hidden group">
                {/* Preview area */}
                <button type="button" onClick={() => setPreviewDoc(doc)} className="w-full h-32 bg-[var(--color-muted)] flex items-center justify-center overflow-hidden">
                  {isImage ? (
                    <img src={doc.file_url} alt={doc.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <svg className="w-10 h-10 text-[var(--color-text-tertiary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        {iconType === "pdf" ? (
                          <><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v4a2 2 0 0 0 2 2h4" /><path d="M10 12h4" /><path d="M10 16h4" /></>
                        ) : (
                          <><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v4a2 2 0 0 0 2 2h4" /></>
                        )}
                      </svg>
                      <span className="text-[10px] text-[var(--color-text-tertiary)] uppercase">{doc.file_name.split(".").pop()}</span>
                    </div>
                  )}
                </button>
                {/* Info */}
                <div className="p-3">
                  <p className="text-sm font-medium text-foreground truncate">{doc.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-secondary/10 text-secondary">{CATEGORY_LABELS[doc.category] || doc.category}</span>
                    {doc.file_size && <span className="text-[10px] text-[var(--color-text-tertiary)]">{formatFileSize(doc.file_size)}</span>}
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[10px] text-[var(--color-text-tertiary)]">
                      {doc.uploaded_by_name} · {doc.uploaded_at ? formatDateTime(doc.uploaded_at) : ""}
                    </span>
                    <button type="button" onClick={() => { if (confirm("Удалить документ?")) deleteMutation.mutate(doc.id); }}
                      className="opacity-0 group-hover:opacity-100 text-[10px] text-destructive hover:underline transition-opacity">Удалить</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Preview modal */}
      <AnimatePresence>
        {previewDoc && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
            onClick={() => setPreviewDoc(null)}
          >
            <motion.div
              initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="bg-[var(--color-surface)] rounded-2xl border border-border max-w-4xl w-full max-h-[90vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-4 border-b border-border">
                <div>
                  <p className="text-sm font-semibold text-foreground">{previewDoc.title}</p>
                  <p className="text-xs text-[var(--color-text-tertiary)]">{previewDoc.file_name} · {formatFileSize(previewDoc.file_size)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <a href={previewDoc.file_url} download={previewDoc.file_name}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg bg-secondary text-white hover:opacity-90 transition-opacity">
                    Скачать
                  </a>
                  <button type="button" onClick={() => setPreviewDoc(null)}
                    className="p-1.5 rounded-lg hover:bg-[var(--color-muted)] transition-colors">
                    <svg className="w-5 h-5 text-[var(--color-text-tertiary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6 6 18" /><path d="m6 6 12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="p-4 overflow-auto max-h-[70vh]">
                {previewDoc.mime_type?.startsWith("image/") ? (
                  <img src={previewDoc.file_url} alt={previewDoc.title} className="max-w-full mx-auto rounded-lg" />
                ) : previewDoc.mime_type === "application/pdf" ? (
                  <iframe src={previewDoc.file_url} className="w-full h-[60vh] rounded-lg" title={previewDoc.title} />
                ) : (
                  <div className="text-center py-12">
                    <p className="text-sm text-[var(--color-text-secondary)] mb-3">Предпросмотр недоступен</p>
                    <a href={previewDoc.file_url} download={previewDoc.file_name}
                      className="px-4 py-2 rounded-xl bg-secondary text-white text-sm font-medium hover:opacity-90">
                      Скачать файл
                    </a>
                  </div>
                )}
              </div>
              {previewDoc.description && (
                <div className="px-4 pb-4">
                  <p className="text-xs text-[var(--color-text-tertiary)]">{previewDoc.description}</p>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Upload Form ---

function UploadForm({ patientId, onSuccess }: { patientId: string; onSuccess: () => void }) {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("other");
  const [description, setDescription] = useState("");
  const [isPending, setIsPending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((f: File) => {
    if (f.size > 50 * 1024 * 1024) { toast.error("Файл слишком большой (макс 50 МБ)"); return; }
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, ""));
  }, [title]);

  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) { toast.error("Выберите файл"); return; }
    if (!title.trim()) { toast.error("Укажите название"); return; }
    setIsPending(true);
    try {
      await patientsApi.uploadDocument(patientId, file, title.trim(), category, description.trim() || undefined);
      toast.success("Документ загружен");
      onSuccess();
    } catch { toast.error("Ошибка загрузки"); } finally { setIsPending(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-[var(--color-surface)] rounded-2xl border border-secondary/20 p-5 space-y-4">
      <h3 className="text-sm font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Загрузить документ</h3>
      {!file ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${isDragging ? "border-secondary bg-secondary/5" : "border-border hover:border-secondary/50"}`}
        >
          <svg className="w-10 h-10 text-[var(--color-text-tertiary)] mx-auto mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" x2="12" y1="3" y2="15" />
          </svg>
          <p className="text-sm font-medium text-foreground mb-1">Перетащите файл или нажмите</p>
          <p className="text-xs text-[var(--color-text-tertiary)]">PDF, JPG, PNG, DOCX · до 50 МБ</p>
        </div>
      ) : (
        <div className="flex items-center gap-3 p-3 bg-success/5 rounded-xl border border-success/20">
          <svg className="w-5 h-5 text-success flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6 9 17l-5-5" /></svg>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
            <p className="text-xs text-[var(--color-text-tertiary)]">{formatFileSize(file.size)}</p>
          </div>
          <button type="button" onClick={() => { setFile(null); setTitle(""); }} className="text-xs text-secondary hover:underline">Изменить</button>
        </div>
      )}
      <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx" onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <InputField label="Название *" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Название документа" />
        <CustomSelect label="Категория" value={category} onChange={setCategory} options={CATEGORY_OPTIONS} />
      </div>
      <InputField label="Описание (необязательно)" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Краткое описание..." />
      <div className="flex justify-end">
        <Button type="submit" variant="primary" size="sm" loading={isPending} disabled={isPending || !file}>Загрузить</Button>
      </div>
    </form>
  );
}

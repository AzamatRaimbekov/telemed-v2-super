import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useDocumentTemplates, useCreateTemplate, type DocumentTemplate } from "@/features/document-templates/api";
import { Plus, FileText, Eye, Pencil, X, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/document-templates")({
  component: DocumentTemplatesPage,
});

const categoryConfig: Record<string, { label: string; variant: "primary" | "success" | "secondary" | "warning" }> = {
  prescription: { label: "Рецепт", variant: "primary" },
  discharge: { label: "Выписка", variant: "success" },
  referral: { label: "Направление", variant: "secondary" },
  certificate: { label: "Справка", variant: "warning" },
};

function DocumentTemplatesPage() {
  const { data: templates, isLoading } = useDocumentTemplates();
  const createMutation = useCreateTemplate();
  const [showCreate, setShowCreate] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<DocumentTemplate | null>(null);
  const [form, setForm] = useState({ name: "", category: "prescription", body_template: "", description: "" });

  const handleCreate = () => {
    createMutation.mutate(
      { ...form, description: form.description || undefined },
      {
        onSuccess: () => {
          setShowCreate(false);
          setForm({ name: "", category: "prescription", body_template: "", description: "" });
        },
      }
    );
  };

  return (
    <div className="p-6">
      <PageHeader
        title="Шаблоны документов"
        description="Управление шаблонами медицинских документов"
      >
        <Button
          icon={<Plus className="w-4 h-4" />}
          onClick={() => setShowCreate(true)}
        >
          Создать шаблон
        </Button>
      </PageHeader>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--color-text-tertiary)]" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && templates?.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <FileText className="w-16 h-16 text-[var(--color-text-tertiary)] mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-1">Шаблонов пока нет</h3>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Создайте первый шаблон документа для вашей клиники
          </p>
        </div>
      )}

      {/* Template Grid */}
      {templates && templates.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((template, i) => {
            const cat = categoryConfig[template.category] || { label: template.category, variant: "muted" as const };
            return (
              <div
                key={template.id}
                className="bg-[var(--color-surface)] rounded-xl border border-border shadow-sm p-5 hover:shadow-md transition-shadow animate-float-up"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-[var(--color-secondary)]/10 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-[var(--color-secondary)]" />
                  </div>
                  <Badge variant={cat.variant}>{cat.label}</Badge>
                </div>

                <h3 className="font-semibold text-foreground mb-1 line-clamp-1">{template.name}</h3>
                {template.description && (
                  <p className="text-xs text-[var(--color-text-secondary)] mb-4 line-clamp-2">
                    {template.description}
                  </p>
                )}
                {!template.description && <div className="mb-4" />}

                {template.is_system_default && (
                  <Badge variant="muted" className="mb-3">Системный</Badge>
                )}

                <div className="flex items-center gap-2 pt-3 border-t border-border">
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Eye className="w-3.5 h-3.5" />}
                    onClick={() => setPreviewTemplate(template)}
                  >
                    Предпросмотр
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Pencil className="w-3.5 h-3.5" />}
                  >
                    Редактировать
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Preview Modal */}
      {previewTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setPreviewTemplate(null)}>
          <div
            className="bg-[var(--color-surface)] rounded-2xl border border-border shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div>
                <h3 className="font-bold text-foreground">{previewTemplate.name}</h3>
                <p className="text-xs text-[var(--color-text-secondary)]">Предпросмотр шаблона</p>
              </div>
              <button
                onClick={() => setPreviewTemplate(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[var(--color-muted)] transition-colors"
              >
                <X className="w-4 h-4 text-[var(--color-text-secondary)]" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <pre className="text-sm text-foreground whitespace-pre-wrap font-mono bg-[var(--color-muted)] rounded-xl p-4">
                {previewTemplate.body_template}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowCreate(false)}>
          <div
            className="bg-[var(--color-surface)] rounded-2xl border border-border shadow-xl max-w-lg w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h3 className="font-bold text-foreground">Новый шаблон</h3>
              <button
                onClick={() => setShowCreate(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[var(--color-muted)] transition-colors"
              >
                <X className="w-4 h-4 text-[var(--color-text-secondary)]" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">Название</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Название шаблона"
                  className="w-full px-4 py-2.5 text-sm rounded-xl border border-border bg-[var(--color-surface)] text-foreground placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-secondary)]/30 focus:border-[var(--color-secondary)] transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">Категория</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full px-4 py-2.5 text-sm rounded-xl border border-border bg-[var(--color-surface)] text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--color-secondary)]/30 focus:border-[var(--color-secondary)] transition-all"
                >
                  <option value="prescription">Рецепт</option>
                  <option value="discharge">Выписка</option>
                  <option value="referral">Направление</option>
                  <option value="certificate">Справка</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">Описание</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Краткое описание (необязательно)"
                  className="w-full px-4 py-2.5 text-sm rounded-xl border border-border bg-[var(--color-surface)] text-foreground placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-secondary)]/30 focus:border-[var(--color-secondary)] transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">Тело шаблона</label>
                <textarea
                  value={form.body_template}
                  onChange={(e) => setForm({ ...form, body_template: e.target.value })}
                  placeholder="Текст шаблона с переменными: {{patient_name}}, {{date}}..."
                  rows={6}
                  className="w-full px-4 py-2.5 text-sm rounded-xl border border-border bg-[var(--color-surface)] text-foreground placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-secondary)]/30 focus:border-[var(--color-secondary)] transition-all resize-none"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
              <Button variant="outline" onClick={() => setShowCreate(false)}>Отмена</Button>
              <Button
                onClick={handleCreate}
                loading={createMutation.isPending}
                disabled={!form.name || !form.body_template}
              >
                Создать
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

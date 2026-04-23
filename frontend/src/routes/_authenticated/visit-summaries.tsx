import { createFileRoute } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import {
  Sparkles,
  Stethoscope,
  Clock,
  Eye,
  FileText,
  Pill,
  MessageSquare,
  CalendarDays,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  Bot,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  useVisitSummaries,
  useCreateSummary,
  useApproveSummary,
  useRejectSummary,
  type VisitSummary,
} from "@/features/visit-summary/api";

export const Route = createFileRoute("/_authenticated/visit-summaries")({
  component: VisitSummariesPage,
});

/* ---------- constants ---------- */

const statusConfig: Record<VisitSummary["status"], { label: string; variant: "warning" | "secondary" | "success" | "destructive" }> = {
  processing: { label: "Обработка", variant: "warning" },
  draft: { label: "Черновик", variant: "secondary" },
  approved: { label: "Утверждён", variant: "success" },
  rejected: { label: "Отклонён", variant: "destructive" },
};

const sectionsMeta = [
  { key: "chief_complaint", label: "Жалобы", icon: Stethoscope, color: "border-blue-500", bg: "bg-blue-500/10", text: "text-blue-600" },
  { key: "history_of_present_illness", label: "Анамнез", icon: Clock, color: "border-amber-500", bg: "bg-amber-500/10", text: "text-amber-600" },
  { key: "examination", label: "Осмотр", icon: Eye, color: "border-emerald-500", bg: "bg-emerald-500/10", text: "text-emerald-600" },
  { key: "diagnosis", label: "Диагноз", icon: FileText, color: "border-red-500", bg: "bg-red-500/10", text: "text-red-600" },
  { key: "treatment_plan", label: "Лечение", icon: Pill, color: "border-purple-500", bg: "bg-purple-500/10", text: "text-purple-600" },
  { key: "recommendations", label: "Рекомендации", icon: MessageSquare, color: "border-cyan-500", bg: "bg-cyan-500/10", text: "text-cyan-600" },
  { key: "follow_up", label: "Следующий приём", icon: CalendarDays, color: "border-pink-500", bg: "bg-pink-500/10", text: "text-pink-600" },
] as const;

/* ---------- page ---------- */

function VisitSummariesPage() {
  const [transcript, setTranscript] = useState("");
  const [patientId, setPatientId] = useState("");
  const [activeSummary, setActiveSummary] = useState<VisitSummary | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: summaries = [], isLoading: listLoading } = useVisitSummaries();
  const createMutation = useCreateSummary();
  const approveMutation = useApproveSummary();
  const rejectMutation = useRejectSummary();

  const handleSubmit = async () => {
    if (!transcript.trim() || !patientId.trim()) return;
    const result = await createMutation.mutateAsync({ patient_id: patientId, transcript });
    setActiveSummary(result);
    setTranscript("");
  };

  const isProcessing = createMutation.isPending;

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-sm shadow-purple-500/20">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">AI Суммаризация визита</h1>
            <p className="text-sm text-[var(--color-text-secondary)]">
              Введите или продиктуйте текст приёма — AI создаст структурированную запись
            </p>
          </div>
        </div>
      </motion.div>

      {/* Input Section */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="bg-[var(--color-surface)] border border-border rounded-2xl p-6 space-y-4"
      >
        <div className="flex items-center gap-3 mb-2">
          <Sparkles className="w-5 h-5 text-purple-500" />
          <h2 className="text-base font-semibold text-foreground">Новая суммаризация</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-1">
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">ID пациента</label>
            <input
              type="text"
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              placeholder="UUID пациента"
              className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">Текст визита</label>
          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder="Опишите визит пациента: жалобы, осмотр, назначения..."
            rows={6}
            className="w-full px-4 py-3 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all resize-none h-40"
          />
        </div>

        <div className="flex items-center justify-between">
          <p className="text-xs text-[var(--color-text-tertiary)]">
            {transcript.length > 0 ? `${transcript.length} символов` : "Минимум 20 символов для анализа"}
          </p>
          <Button
            onClick={handleSubmit}
            disabled={!transcript.trim() || !patientId.trim() || transcript.length < 20 || isProcessing}
            loading={isProcessing}
            icon={<Send className="w-4 h-4" />}
          >
            Суммаризировать
          </Button>
        </div>

        {/* Processing animation */}
        <AnimatePresence>
          {isProcessing && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center gap-3 py-3 px-4 bg-purple-500/5 border border-purple-500/20 rounded-xl"
            >
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-purple-500 rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-2 h-2 bg-purple-500 rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-2 h-2 bg-purple-500 rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
              <span className="text-sm text-purple-600 font-medium">AI анализирует текст визита...</span>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Active Summary Result */}
      <AnimatePresence>
        {activeSummary?.structured_summary && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold text-foreground">Результат анализа</h2>
                <Badge variant={statusConfig[activeSummary.status].variant} dot>
                  {statusConfig[activeSummary.status].label}
                </Badge>
                {activeSummary.ai_model_used && (
                  <Badge variant="muted">
                    <Bot className="w-3 h-3 mr-1 inline" />
                    {activeSummary.ai_model_used}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  icon={<XCircle className="w-4 h-4" />}
                  onClick={() => rejectMutation.mutate(activeSummary.id)}
                  loading={rejectMutation.isPending}
                  className="!text-destructive !border-destructive/30 hover:!bg-destructive/5"
                >
                  Отклонить
                </Button>
                <Button
                  size="sm"
                  icon={<CheckCircle2 className="w-4 h-4" />}
                  onClick={() => approveMutation.mutate(activeSummary.id)}
                  loading={approveMutation.isPending}
                  className="!bg-emerald-600 hover:!bg-emerald-700"
                >
                  Утвердить
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {sectionsMeta.map(({ key, label, icon: Icon, color, bg, text }) => {
                const value = activeSummary.structured_summary?.[key];
                return (
                  <motion.div
                    key={key}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3 }}
                    className={`bg-[var(--color-surface)] border border-border rounded-xl p-4 border-l-4 ${color}`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`w-7 h-7 rounded-lg ${bg} flex items-center justify-center`}>
                        <Icon className={`w-3.5 h-3.5 ${text}`} />
                      </div>
                      <h3 className="text-sm font-semibold text-foreground">{label}</h3>
                    </div>
                    <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                      {value || "Нет данных"}
                    </p>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* History Section */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="space-y-3"
      >
        <h2 className="text-lg font-semibold text-foreground">История суммаризаций</h2>

        {listLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-[var(--color-surface)] border border-border rounded-xl p-4 animate-pulse">
                <div className="flex items-center gap-4">
                  <div className="w-24 h-4 bg-[var(--color-muted)] rounded" />
                  <div className="w-16 h-5 bg-[var(--color-muted)] rounded-full" />
                  <div className="flex-1 h-4 bg-[var(--color-muted)] rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : summaries.length === 0 ? (
          <div className="bg-[var(--color-surface)] border border-border rounded-xl py-12 text-center">
            <FileText className="w-10 h-10 text-[var(--color-text-tertiary)] mx-auto mb-3" />
            <p className="text-sm text-[var(--color-text-secondary)]">Нет суммаризаций</p>
            <p className="text-xs text-[var(--color-text-tertiary)] mt-1">Создайте первую суммаризацию выше</p>
          </div>
        ) : (
          <div className="space-y-2">
            {summaries.map((s) => {
              const isExpanded = expandedId === s.id;
              const sc = statusConfig[s.status];
              const date = new Date(s.created_at).toLocaleDateString("ru-RU", {
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              });
              const diagnosis = s.structured_summary?.diagnosis;

              return (
                <motion.div
                  key={s.id}
                  layout
                  className="bg-[var(--color-surface)] border border-border rounded-xl overflow-hidden"
                >
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : s.id)}
                    className="w-full flex items-center gap-4 px-5 py-3.5 text-left hover:bg-[var(--color-muted)]/50 transition-colors"
                  >
                    <span className="text-xs text-[var(--color-text-tertiary)] whitespace-nowrap font-medium min-w-[140px]">
                      {date}
                    </span>
                    <Badge variant={sc.variant} dot>
                      {sc.label}
                    </Badge>
                    <span className="flex-1 text-sm text-[var(--color-text-secondary)] truncate">
                      {diagnosis || "Диагноз не указан"}
                    </span>
                    {s.ai_model_used && (
                      <span className="text-[10px] text-[var(--color-text-tertiary)] bg-[var(--color-muted)] px-2 py-0.5 rounded-full hidden md:inline">
                        {s.ai_model_used}
                      </span>
                    )}
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-[var(--color-text-tertiary)] flex-shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-[var(--color-text-tertiary)] flex-shrink-0" />
                    )}
                  </button>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden"
                      >
                        <div className="px-5 pb-5 pt-1 border-t border-border">
                          {s.structured_summary ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                              {sectionsMeta.map(({ key, label, icon: Icon, color, bg, text }) => {
                                const value = s.structured_summary?.[key];
                                if (!value) return null;
                                return (
                                  <div
                                    key={key}
                                    className={`rounded-lg p-3 border-l-4 ${color} bg-[var(--color-muted)]/30`}
                                  >
                                    <div className="flex items-center gap-2 mb-1.5">
                                      <div className={`w-6 h-6 rounded-md ${bg} flex items-center justify-center`}>
                                        <Icon className={`w-3 h-3 ${text}`} />
                                      </div>
                                      <span className="text-xs font-semibold text-foreground">{label}</span>
                                    </div>
                                    <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">{value}</p>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="text-sm text-[var(--color-text-tertiary)] py-4 text-center">
                              {s.status === "processing" ? "AI обрабатывает запрос..." : "Нет структурированных данных"}
                            </p>
                          )}

                          {s.status === "draft" && (
                            <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-border">
                              <Button
                                variant="outline"
                                size="sm"
                                icon={<XCircle className="w-3.5 h-3.5" />}
                                onClick={() => rejectMutation.mutate(s.id)}
                                loading={rejectMutation.isPending}
                                className="!text-destructive !border-destructive/30 hover:!bg-destructive/5"
                              >
                                Отклонить
                              </Button>
                              <Button
                                size="sm"
                                icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                                onClick={() => approveMutation.mutate(s.id)}
                                loading={approveMutation.isPending}
                                className="!bg-emerald-600 hover:!bg-emerald-700"
                              >
                                Утвердить
                              </Button>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>
    </div>
  );
}

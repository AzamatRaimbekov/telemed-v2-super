import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { aiApi } from "@/features/ai/api";
import { useAI } from "@/features/ai/useAI";
import { Button } from "@/components/ui/button";
import { AIResultPanel } from "@/features/ai/components/AIResultPanel";
import { AIDiagnosisSuggestions } from "@/features/ai/components/AIDiagnosisSuggestions";
import { AIExamResult } from "@/features/ai/components/AIExamResult";
import { AISummaryResult } from "@/features/ai/components/AISummaryResult";
import { AIConclusionResult } from "@/features/ai/components/AIConclusionResult";
import type { SuggestedDiagnosis } from "@/features/ai/api";
import { toast } from "sonner";

export const Route = createFileRoute(
  "/_authenticated/patients/$patientId/ai"
)({
  component: AiHubPage,
});

function AiHubPage() {
  const { patientId } = Route.useParams();
  const [activeTask, setActiveTask] = useState<string | null>(null);

  const aiDiagnosis = useAI("hub-diagnosis", aiApi.suggestDiagnoses);
  const aiExam = useAI("hub-exam", aiApi.generateExam);
  const aiSummary = useAI("hub-summary", aiApi.summarizePatient);
  const aiConclusion = useAI("hub-conclusion", aiApi.generateConclusion);

  const actions = [
    {
      key: "diagnosis",
      label: "Подсказка диагнозов",
      description: "AI предложит диагнозы по симптомам",
      isPending: aiDiagnosis.isPending,
      onClick: () => {
        setActiveTask("diagnosis");
        aiDiagnosis.trigger({ patient_id: patientId, symptoms: "Текущие жалобы пациента" });
      },
    },
    {
      key: "exam",
      label: "Генерация осмотра",
      description: "AI сгенерирует текст осмотра",
      isPending: aiExam.isPending,
      onClick: () => {
        setActiveTask("exam");
        aiExam.trigger({ patient_id: patientId, complaints: "Жалобы пациента" });
      },
    },
    {
      key: "summary",
      label: "Резюме пациента",
      description: "AI составит краткое резюме истории болезни",
      isPending: aiSummary.isPending,
      onClick: () => {
        setActiveTask("summary");
        aiSummary.trigger({ patient_id: patientId });
      },
    },
    {
      key: "conclusion",
      label: "Генерация заключения",
      description: "AI сформирует медицинское заключение",
      isPending: aiConclusion.isPending,
      onClick: () => {
        setActiveTask("conclusion");
        aiConclusion.trigger({ patient_id: patientId, diagnoses: [] });
      },
    },
  ];

  const handleAcceptDiagnosis = (d: SuggestedDiagnosis) => {
    toast.success(`Диагноз ${d.icd_code} ${d.title} — перейдите во вкладку Диагнозы для добавления`);
  };

  const resetAll = () => {
    aiDiagnosis.reset();
    aiExam.reset();
    aiSummary.reset();
    aiConclusion.reset();
    setActiveTask(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-blue-500/20 flex items-center justify-center">
          <svg className="w-5 h-5 text-violet-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
          </svg>
        </div>
        <div>
          <h2 className="text-lg font-bold text-foreground">ИИ Ассистент</h2>
          <p className="text-xs text-[var(--color-text-tertiary)]">
            Выберите действие — AI проанализирует данные пациента
          </p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {actions.map((a) => (
          <button
            key={a.key}
            type="button"
            onClick={a.onClick}
            disabled={a.isPending}
            className="p-4 rounded-xl border border-border bg-[var(--color-surface)] hover:border-primary/30 hover:bg-primary/5 transition-all text-left disabled:opacity-50"
          >
            <div className="flex items-center gap-2 mb-1">
              <svg className="w-4 h-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
              </svg>
              <span className="text-sm font-medium text-foreground">{a.label}</span>
              {a.isPending && (
                <svg className="w-3.5 h-3.5 animate-spin text-primary ml-auto" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
            </div>
            <p className="text-xs text-[var(--color-text-secondary)]">{a.description}</p>
          </button>
        ))}
      </div>

      {/* Results */}
      <AnimatePresence>
        {activeTask === "diagnosis" && aiDiagnosis.result && (
          <AIResultPanel
            provider={aiDiagnosis.result.provider}
            model={aiDiagnosis.result.model}
            onReject={resetAll}
            onRetry={() => aiDiagnosis.trigger({ patient_id: patientId, symptoms: "Текущие жалобы" })}
          >
            <AIDiagnosisSuggestions
              suggestions={aiDiagnosis.result.suggestions}
              onAcceptDiagnosis={handleAcceptDiagnosis}
            />
          </AIResultPanel>
        )}

        {activeTask === "exam" && aiExam.result && (
          <AIResultPanel
            provider={aiExam.result.provider}
            model={aiExam.result.model}
            acceptLabel="✓ Копировать"
            onAccept={() => {
              navigator.clipboard.writeText(aiExam.result!.examination_text);
              toast.success("Текст осмотра скопирован");
            }}
            onReject={resetAll}
            onRetry={() => aiExam.trigger({ patient_id: patientId, complaints: "Жалобы" })}
          >
            <AIExamResult examinationText={aiExam.result.examination_text} />
          </AIResultPanel>
        )}

        {activeTask === "summary" && aiSummary.result && (
          <AIResultPanel
            provider={aiSummary.result.provider}
            model={aiSummary.result.model}
            onReject={resetAll}
            onRetry={() => aiSummary.trigger({ patient_id: patientId })}
          >
            <AISummaryResult
              summary={aiSummary.result.summary}
              keyDiagnoses={aiSummary.result.key_diagnoses}
              keyMedications={aiSummary.result.key_medications}
              riskFactors={aiSummary.result.risk_factors}
            />
          </AIResultPanel>
        )}

        {activeTask === "conclusion" && aiConclusion.result && (
          <AIResultPanel
            provider={aiConclusion.result.provider}
            model={aiConclusion.result.model}
            acceptLabel="✓ Копировать"
            onAccept={() => {
              navigator.clipboard.writeText(aiConclusion.result!.conclusion_text);
              toast.success("Текст заключения скопирован");
            }}
            onReject={resetAll}
            onRetry={() => aiConclusion.trigger({ patient_id: patientId, diagnoses: [] })}
          >
            <AIConclusionResult conclusionText={aiConclusion.result.conclusion_text} />
          </AIResultPanel>
        )}
      </AnimatePresence>
    </div>
  );
}

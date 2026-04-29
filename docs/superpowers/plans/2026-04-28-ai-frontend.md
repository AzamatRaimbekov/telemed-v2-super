# AI Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add inline AI assistance buttons (✨) to patient detail pages with result panels, integrated with the AI Gateway backend.

**Architecture:** Shared `useAI` hook (wraps `useMutation`) + reusable `AITriggerButton` and `AIResultPanel` components. Task-specific result components render AI output. Buttons embedded in existing pages; results collected in AI hub tab.

**Tech Stack:** React 18, TanStack Router, TanStack React Query, Tailwind CSS, Framer Motion, Sonner (toasts), Axios

**Spec:** `docs/superpowers/specs/2026-04-28-ai-frontend-design.md`

---

## File Structure

```
frontend/src/
  features/ai/
    api.ts                         — AI API client (axios calls)
    useAI.ts                       — useMutation wrapper hook
    components/
      AITriggerButton.tsx          — compact ✨ icon button
      AIResultPanel.tsx            — inline result container with Accept/Reject/Retry
      AIDiagnosisSuggestions.tsx   — diagnosis suggestion cards
      AIExamResult.tsx             — generated exam text
      AISummaryResult.tsx          — patient summary with badges
      AIConclusionResult.tsx       — conclusion text
  routes/_authenticated/patients.$patientId/
    diagnoses.tsx                  — modify: embed AI diagnosis suggestions
    history/new.tsx                — modify: embed AI exam generation
    overview.tsx                   — modify: embed AI patient summary
    documents.tsx                  — modify: embed AI conclusion generation
    ai.tsx                         — rewrite: AI results hub
```

---

### Task 1: AI API Client

**Files:**
- Create: `frontend/src/features/ai/api.ts`

- [ ] **Step 1: Create the AI API client**

Create `frontend/src/features/ai/api.ts`:

```typescript
import apiClient from "@/lib/api-client";

export interface DiagnosisSuggestInput {
  patient_id: string;
  symptoms: string;
  age?: number;
  sex?: string;
  existing_diagnoses?: string[];
}

export interface SuggestedDiagnosis {
  icd_code: string;
  title: string;
  confidence: number;
  reasoning: string;
}

export interface DiagnosisSuggestOutput {
  suggestions: SuggestedDiagnosis[];
  provider: string;
  model: string;
}

export interface ExamGenerateInput {
  patient_id: string;
  complaints: string;
  visit_type?: string;
}

export interface ExamGenerateOutput {
  examination_text: string;
  provider: string;
  model: string;
}

export interface PatientSummaryInput {
  patient_id: string;
}

export interface PatientSummaryOutput {
  summary: string;
  key_diagnoses: string[];
  key_medications: string[];
  risk_factors: string[];
  provider: string;
  model: string;
}

export interface ConclusionGenerateInput {
  patient_id: string;
  visit_id?: string;
  diagnoses?: string[];
  exam_notes?: string;
  treatment?: string;
}

export interface ConclusionGenerateOutput {
  conclusion_text: string;
  provider: string;
  model: string;
}

export const aiApi = {
  suggestDiagnoses: (data: DiagnosisSuggestInput): Promise<DiagnosisSuggestOutput> =>
    apiClient.post("/ai/diagnosis/suggest", data).then((r) => r.data),

  generateExam: (data: ExamGenerateInput): Promise<ExamGenerateOutput> =>
    apiClient.post("/ai/exam/generate", data).then((r) => r.data),

  summarizePatient: (data: PatientSummaryInput): Promise<PatientSummaryOutput> =>
    apiClient.post("/ai/summary/patient", data).then((r) => r.data),

  generateConclusion: (data: ConclusionGenerateInput): Promise<ConclusionGenerateOutput> =>
    apiClient.post("/ai/conclusion/generate", data).then((r) => r.data),
};
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/ai/api.ts
git commit -m "feat(ai-ui): add AI API client with typed interfaces"
```

---

### Task 2: useAI Hook

**Files:**
- Create: `frontend/src/features/ai/useAI.ts`

- [ ] **Step 1: Create the useAI hook**

Create `frontend/src/features/ai/useAI.ts`:

```typescript
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

export function useAI<TInput, TOutput>(
  key: string,
  apiFn: (data: TInput) => Promise<TOutput>,
) {
  const mutation = useMutation({
    mutationKey: ["ai", key],
    mutationFn: apiFn,
    onError: (error: Error) => {
      toast.error(`AI ошибка: ${error.message || "Попробуйте ещё раз"}`);
    },
  });

  return {
    trigger: mutation.mutate,
    triggerAsync: mutation.mutateAsync,
    result: mutation.data ?? null,
    isPending: mutation.isPending,
    error: mutation.error,
    reset: mutation.reset,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/ai/useAI.ts
git commit -m "feat(ai-ui): add useAI mutation hook"
```

---

### Task 3: AITriggerButton Component

**Files:**
- Create: `frontend/src/features/ai/components/AITriggerButton.tsx`

- [ ] **Step 1: Create the trigger button component**

Create `frontend/src/features/ai/components/AITriggerButton.tsx`:

```tsx
import { cn } from "@/lib/utils";

interface AITriggerButtonProps {
  onClick: () => void;
  isPending?: boolean;
  disabled?: boolean;
  className?: string;
  tooltip?: string;
}

export function AITriggerButton({
  onClick,
  isPending = false,
  disabled = false,
  className,
  tooltip = "AI подсказка",
}: AITriggerButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || isPending}
      title={tooltip}
      className={cn(
        "inline-flex items-center justify-center w-6 h-6 rounded-md transition-all",
        "text-[var(--color-text-tertiary)] hover:text-primary hover:bg-primary/10",
        "disabled:opacity-40 disabled:cursor-not-allowed",
        isPending && "animate-pulse",
        className,
      )}
    >
      {isPending ? (
        <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : (
        <svg
          className="w-4 h-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
        </svg>
      )}
    </button>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/ai/components/AITriggerButton.tsx
git commit -m "feat(ai-ui): add AITriggerButton sparkle component"
```

---

### Task 4: AIResultPanel Component

**Files:**
- Create: `frontend/src/features/ai/components/AIResultPanel.tsx`

- [ ] **Step 1: Create the result panel component**

Create `frontend/src/features/ai/components/AIResultPanel.tsx`:

```tsx
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

interface AIResultPanelProps {
  provider?: string;
  model?: string;
  onAccept?: () => void;
  onReject: () => void;
  onRetry?: () => void;
  acceptLabel?: string;
  children: React.ReactNode;
}

export function AIResultPanel({
  provider,
  model,
  onAccept,
  onReject,
  onRetry,
  acceptLabel = "✓ Принять",
  children,
}: AIResultPanelProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className="rounded-xl bg-primary/5 border border-primary/20 p-4 my-3"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <svg
            className="w-3.5 h-3.5 text-primary"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
          </svg>
          <span className="text-xs font-medium text-primary">AI подсказка</span>
        </div>
        {provider && (
          <span className="text-[10px] text-[var(--color-text-tertiary)]">
            {provider}{model ? ` · ${model}` : ""}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="mb-3">{children}</div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {onAccept && (
          <Button variant="primary" size="sm" onClick={onAccept}>
            {acceptLabel}
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={onReject}>
          ✗ Отклонить
        </Button>
        {onRetry && (
          <Button variant="ghost" size="sm" onClick={onRetry}>
            ↻
          </Button>
        )}
      </div>
    </motion.div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/ai/components/AIResultPanel.tsx
git commit -m "feat(ai-ui): add AIResultPanel inline component"
```

---

### Task 5: Task-Specific Result Components

**Files:**
- Create: `frontend/src/features/ai/components/AIDiagnosisSuggestions.tsx`
- Create: `frontend/src/features/ai/components/AIExamResult.tsx`
- Create: `frontend/src/features/ai/components/AISummaryResult.tsx`
- Create: `frontend/src/features/ai/components/AIConclusionResult.tsx`

- [ ] **Step 1: Create AIDiagnosisSuggestions**

Create `frontend/src/features/ai/components/AIDiagnosisSuggestions.tsx`:

```tsx
import type { SuggestedDiagnosis } from "@/features/ai/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface AIDiagnosisSuggestionsProps {
  suggestions: SuggestedDiagnosis[];
  onAcceptDiagnosis: (diagnosis: SuggestedDiagnosis) => void;
}

function confidenceColor(c: number): string {
  if (c >= 0.7) return "bg-success";
  if (c >= 0.4) return "bg-warning";
  return "bg-destructive";
}

export function AIDiagnosisSuggestions({
  suggestions,
  onAcceptDiagnosis,
}: AIDiagnosisSuggestionsProps) {
  if (!suggestions.length) {
    return (
      <p className="text-sm text-[var(--color-text-secondary)]">
        AI не нашёл подходящих диагнозов.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {suggestions.map((s, i) => (
        <div
          key={`${s.icd_code}-${i}`}
          className="flex items-start gap-3 p-2 rounded-lg bg-[var(--color-surface)] border border-border"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="primary">{s.icd_code}</Badge>
              <span className="text-sm font-medium text-foreground truncate">
                {s.title}
              </span>
            </div>
            {/* Confidence bar */}
            <div className="flex items-center gap-2 mb-1">
              <div className="flex-1 h-1.5 bg-[var(--color-muted)] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${confidenceColor(s.confidence)}`}
                  style={{ width: `${Math.round(s.confidence * 100)}%` }}
                />
              </div>
              <span className="text-[10px] text-[var(--color-text-tertiary)] w-8 text-right">
                {Math.round(s.confidence * 100)}%
              </span>
            </div>
            <p className="text-xs text-[var(--color-text-secondary)] line-clamp-2">
              {s.reasoning}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onAcceptDiagnosis(s)}
            className="flex-shrink-0"
          >
            Принять
          </Button>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create AIExamResult**

Create `frontend/src/features/ai/components/AIExamResult.tsx`:

```tsx
interface AIExamResultProps {
  examinationText: string;
}

export function AIExamResult({ examinationText }: AIExamResultProps) {
  return (
    <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
      {examinationText}
    </div>
  );
}
```

- [ ] **Step 3: Create AISummaryResult**

Create `frontend/src/features/ai/components/AISummaryResult.tsx`:

```tsx
import { Badge } from "@/components/ui/badge";

interface AISummaryResultProps {
  summary: string;
  keyDiagnoses: string[];
  keyMedications: string[];
  riskFactors: string[];
}

export function AISummaryResult({
  summary,
  keyDiagnoses,
  keyMedications,
  riskFactors,
}: AISummaryResultProps) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-foreground leading-relaxed">{summary}</p>

      {keyDiagnoses.length > 0 && (
        <div>
          <span className="text-xs font-medium text-[var(--color-text-secondary)] mr-2">
            Диагнозы:
          </span>
          <div className="inline-flex flex-wrap gap-1">
            {keyDiagnoses.map((d, i) => (
              <Badge key={i} variant="primary">{d}</Badge>
            ))}
          </div>
        </div>
      )}

      {keyMedications.length > 0 && (
        <div>
          <span className="text-xs font-medium text-[var(--color-text-secondary)] mr-2">
            Лекарства:
          </span>
          <div className="inline-flex flex-wrap gap-1">
            {keyMedications.map((m, i) => (
              <Badge key={i} variant="secondary">{m}</Badge>
            ))}
          </div>
        </div>
      )}

      {riskFactors.length > 0 && (
        <div>
          <span className="text-xs font-medium text-[var(--color-text-secondary)] mr-2">
            Факторы риска:
          </span>
          <div className="inline-flex flex-wrap gap-1">
            {riskFactors.map((r, i) => (
              <Badge key={i} variant="warning">{r}</Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Create AIConclusionResult**

Create `frontend/src/features/ai/components/AIConclusionResult.tsx`:

```tsx
interface AIConclusionResultProps {
  conclusionText: string;
}

export function AIConclusionResult({ conclusionText }: AIConclusionResultProps) {
  return (
    <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
      {conclusionText}
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/ai/components/
git commit -m "feat(ai-ui): add task-specific AI result components"
```

---

### Task 6: Integrate AI into Diagnoses Page

**Files:**
- Modify: `frontend/src/routes/_authenticated/patients.$patientId/diagnoses.tsx`

- [ ] **Step 1: Read the existing diagnoses.tsx file**

Read the full file to understand structure and identify where to add the AI button.

- [ ] **Step 2: Add AI imports and hook**

Add these imports at the top of `diagnoses.tsx`:

```typescript
import { AnimatePresence } from "framer-motion";
import { aiApi } from "@/features/ai/api";
import type { SuggestedDiagnosis } from "@/features/ai/api";
import { useAI } from "@/features/ai/useAI";
import { AITriggerButton } from "@/features/ai/components/AITriggerButton";
import { AIResultPanel } from "@/features/ai/components/AIResultPanel";
import { AIDiagnosisSuggestions } from "@/features/ai/components/AIDiagnosisSuggestions";
```

- [ ] **Step 3: Add AI state and hook inside DiagnosesPage function**

Inside the `DiagnosesPage` function, after the existing state declarations, add:

```typescript
const ai = useAI("diagnosis-suggest", aiApi.suggestDiagnoses);

const handleAISuggest = () => {
  // Gather symptoms from latest visit or existing diagnoses
  const existingCodes = (rawList || []).map((d: DiagnosisItem) => `${d.icd_code} ${d.title}`);
  ai.trigger({
    patient_id: patientId,
    symptoms: "Текущие жалобы пациента",
    existing_diagnoses: existingCodes,
  });
};

const handleAcceptDiagnosis = (diagnosis: SuggestedDiagnosis) => {
  // Open create form with prefilled data
  setShowCreate(true);
  // The create form should pick up these values — we'll set them via state
  setAiPrefill({ icd_code: diagnosis.icd_code, title: diagnosis.title });
  ai.reset();
};

const [aiPrefill, setAiPrefill] = useState<{ icd_code: string; title: string } | null>(null);
```

- [ ] **Step 4: Add AI button next to the heading**

Find the heading area (where "Диагнозы" title is rendered) and add the AITriggerButton next to it:

```tsx
<div className="flex items-center gap-2">
  <h2 className="text-lg font-bold text-foreground">Диагнозы</h2>
  <AITriggerButton onClick={handleAISuggest} isPending={ai.isPending} />
</div>
```

- [ ] **Step 5: Add AI result panel below the heading**

Below the heading, before the list/filter area, add:

```tsx
<AnimatePresence>
  {ai.result && (
    <AIResultPanel
      provider={ai.result.provider}
      model={ai.result.model}
      onReject={() => ai.reset()}
      onRetry={handleAISuggest}
    >
      <AIDiagnosisSuggestions
        suggestions={ai.result.suggestions}
        onAcceptDiagnosis={handleAcceptDiagnosis}
      />
    </AIResultPanel>
  )}
</AnimatePresence>
```

- [ ] **Step 6: Wire aiPrefill to the create form**

In the create diagnosis form, use `aiPrefill` to prefill the ICD code and title fields. When the form opens, if `aiPrefill` is set, populate the fields and clear `aiPrefill`.

- [ ] **Step 7: Verify the page renders without errors**

Run:
```bash
cd frontend && npx vite build 2>&1 | head -20
```
Expected: Build succeeds or only unrelated warnings

- [ ] **Step 8: Commit**

```bash
git add frontend/src/routes/_authenticated/patients.\$patientId/diagnoses.tsx
git commit -m "feat(ai-ui): integrate AI diagnosis suggestions into diagnoses page"
```

---

### Task 7: Integrate AI into History New Entry Page

**Files:**
- Modify: `frontend/src/routes/_authenticated/patients.$patientId/history/new.tsx`

- [ ] **Step 1: Read the existing new.tsx file**

Read the full file to understand the form structure and where to add AI exam generation.

- [ ] **Step 2: Add AI imports**

Add at the top:

```typescript
import { AnimatePresence } from "framer-motion";
import { aiApi } from "@/features/ai/api";
import { useAI } from "@/features/ai/useAI";
import { AITriggerButton } from "@/features/ai/components/AITriggerButton";
import { AIResultPanel } from "@/features/ai/components/AIResultPanel";
import { AIExamResult } from "@/features/ai/components/AIExamResult";
```

- [ ] **Step 3: Add AI hook inside the component**

Inside the `NewEntryPage` function (or whichever sub-component renders the manual form with complaints), add:

```typescript
const aiExam = useAI("exam-generate", aiApi.generateExam);
```

- [ ] **Step 4: Add ✨ button next to the complaints field**

Find the complaints/жалобы textarea. Add the AITriggerButton next to its label:

```tsx
<div className="flex items-center gap-2">
  <label className="text-sm font-medium text-foreground">Жалобы</label>
  <AITriggerButton
    onClick={() => {
      if (complaints.length >= 3) {
        aiExam.trigger({ patient_id: patientId, complaints });
      }
    }}
    isPending={aiExam.isPending}
    disabled={complaints.length < 3}
    tooltip="AI: сгенерировать осмотр по жалобам"
  />
</div>
```

(Where `complaints` is the state variable holding the current complaints text.)

- [ ] **Step 5: Add AI result panel below the complaints field**

```tsx
<AnimatePresence>
  {aiExam.result && (
    <AIResultPanel
      provider={aiExam.result.provider}
      model={aiExam.result.model}
      onAccept={() => {
        // Insert exam text into the examination notes field
        setExaminationNotes(aiExam.result!.examination_text);
        aiExam.reset();
      }}
      onReject={() => aiExam.reset()}
      onRetry={() => aiExam.trigger({ patient_id: patientId, complaints })}
    >
      <AIExamResult examinationText={aiExam.result.examination_text} />
    </AIResultPanel>
  )}
</AnimatePresence>
```

(Where `setExaminationNotes` sets the examination_notes field value. Adapt to the actual state variable name used in the form.)

- [ ] **Step 6: Verify build**

Run:
```bash
cd frontend && npx vite build 2>&1 | head -20
```

- [ ] **Step 7: Commit**

```bash
git add frontend/src/routes/_authenticated/patients.\$patientId/history/new.tsx
git commit -m "feat(ai-ui): integrate AI exam generation into new history entry"
```

---

### Task 8: Integrate AI into Overview Page

**Files:**
- Modify: `frontend/src/routes/_authenticated/patients.$patientId/overview.tsx`

- [ ] **Step 1: Read the existing overview.tsx file**

Read the full file to understand layout and where to add summary.

- [ ] **Step 2: Add AI imports**

Add at the top:

```typescript
import { AnimatePresence } from "framer-motion";
import { aiApi } from "@/features/ai/api";
import { useAI } from "@/features/ai/useAI";
import { AITriggerButton } from "@/features/ai/components/AITriggerButton";
import { AIResultPanel } from "@/features/ai/components/AIResultPanel";
import { AISummaryResult } from "@/features/ai/components/AISummaryResult";
```

- [ ] **Step 3: Add AI hook inside OverviewPage**

```typescript
const aiSummary = useAI("patient-summary", aiApi.summarizePatient);
```

- [ ] **Step 4: Add ✨ button next to the page heading**

Find the "Обзор" heading area and add the trigger:

```tsx
<div className="flex items-center gap-2">
  <h2 className="text-lg font-bold text-foreground">Обзор</h2>
  <AITriggerButton
    onClick={() => aiSummary.trigger({ patient_id: patientId })}
    isPending={aiSummary.isPending}
    tooltip="AI: резюме пациента"
  />
</div>
```

- [ ] **Step 5: Add AI result panel at top of page content**

```tsx
<AnimatePresence>
  {aiSummary.result && (
    <AIResultPanel
      provider={aiSummary.result.provider}
      model={aiSummary.result.model}
      onReject={() => aiSummary.reset()}
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
</AnimatePresence>
```

- [ ] **Step 6: Verify build**

Run:
```bash
cd frontend && npx vite build 2>&1 | head -20
```

- [ ] **Step 7: Commit**

```bash
git add frontend/src/routes/_authenticated/patients.\$patientId/overview.tsx
git commit -m "feat(ai-ui): integrate AI patient summary into overview page"
```

---

### Task 9: Integrate AI into Documents Page

**Files:**
- Modify: `frontend/src/routes/_authenticated/patients.$patientId/documents.tsx`

- [ ] **Step 1: Read the existing documents.tsx file**

Read the full file to understand the upload flow and where to add conclusion generation.

- [ ] **Step 2: Add AI imports**

Add at the top:

```typescript
import { AnimatePresence } from "framer-motion";
import { aiApi } from "@/features/ai/api";
import { useAI } from "@/features/ai/useAI";
import { AITriggerButton } from "@/features/ai/components/AITriggerButton";
import { AIResultPanel } from "@/features/ai/components/AIResultPanel";
import { AIConclusionResult } from "@/features/ai/components/AIConclusionResult";
```

- [ ] **Step 3: Add AI hook inside DocumentsPage**

```typescript
const aiConclusion = useAI("conclusion-generate", aiApi.generateConclusion);
```

- [ ] **Step 4: Add ✨ button near document creation area**

Find where the "Загрузить документ" / create document button is and add:

```tsx
<AITriggerButton
  onClick={() => aiConclusion.trigger({
    patient_id: patientId,
    diagnoses: [],
  })}
  isPending={aiConclusion.isPending}
  tooltip="AI: сгенерировать заключение"
/>
```

- [ ] **Step 5: Add AI result panel**

```tsx
<AnimatePresence>
  {aiConclusion.result && (
    <AIResultPanel
      provider={aiConclusion.result.provider}
      model={aiConclusion.result.model}
      acceptLabel="✓ Создать документ"
      onAccept={() => {
        // Copy conclusion text to clipboard or trigger document creation
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
```

- [ ] **Step 6: Verify build**

Run:
```bash
cd frontend && npx vite build 2>&1 | head -20
```

- [ ] **Step 7: Commit**

```bash
git add frontend/src/routes/_authenticated/patients.\$patientId/documents.tsx
git commit -m "feat(ai-ui): integrate AI conclusion generation into documents page"
```

---

### Task 10: Rewrite AI Assistant Hub Page

**Files:**
- Modify: `frontend/src/routes/_authenticated/patients.$patientId/ai.tsx`

- [ ] **Step 1: Read the existing ai.tsx file**

Read the full file. It currently has a chat-based interface. We'll keep the chat and add an AI results history section at the top.

- [ ] **Step 2: Rewrite ai.tsx**

Replace the entire file with a new version that combines:
1. **AI Actions section** — quick-action buttons for all 4 AI tasks
2. **AI Results section** — shows results from any triggered action inline
3. **Chat section** — keeps the existing chat functionality below

The full file content:

```tsx
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
            <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
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
                <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
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
```

- [ ] **Step 3: Verify build**

Run:
```bash
cd frontend && npx vite build 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/routes/_authenticated/patients.\$patientId/ai.tsx
git commit -m "feat(ai-ui): rewrite AI Assistant hub with action cards and inline results"
```

---

## Summary

| Task | What | Files |
|------|------|-------|
| 1 | AI API client | 1 new |
| 2 | useAI hook | 1 new |
| 3 | AITriggerButton | 1 new |
| 4 | AIResultPanel | 1 new |
| 5 | 4 result components | 4 new |
| 6 | Diagnoses page integration | 1 modified |
| 7 | History new entry integration | 1 modified |
| 8 | Overview page integration | 1 modified |
| 9 | Documents page integration | 1 modified |
| 10 | AI Hub page rewrite | 1 modified |

**Total: 10 tasks, 8 new files, 5 modified files, ~10 commits**

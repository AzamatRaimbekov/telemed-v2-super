# AI Frontend — Doctor-Facing AI UI for MedCore KG

**Date:** 2026-04-28
**Status:** Approved
**Depends on:** AI Gateway backend (2026-04-27-ai-gateway-design.md)

---

## Overview

Add AI-powered inline assistance to the patient detail pages. Compact sparkle buttons (✨) trigger AI calls in context. Results appear as inline panels with Accept/Reject actions. All AI results are also collected in the "ИИ Ассистент" tab as a hub.

---

## Architecture

### Shared primitives (reuse everywhere)

- **`features/ai/api.ts`** — API client with all AI endpoints
- **`features/ai/useAI.ts`** — `useMutation` wrapper hook returning `{ trigger, result, isPending, error, reset }`
- **`AITriggerButton`** — 20x20px sparkle icon button with states: idle (gray), hover (primary), loading (spinning), done (green check). Tooltip: "AI подсказка"
- **`AIResultPanel`** — inline panel with primary/5 background, border-primary/20, framer-motion fade+slide animation. Header shows "✨ AI подсказка" + provider + latency. Footer has Accept / Reject / Retry buttons

### Task-specific result components

- **`AIDiagnosisSuggestions`** — list of cards: ICD code, title, confidence bar, reasoning. Per-item Accept button prefills diagnosis creation form
- **`AIExamResult`** — structured examination text. Accept inserts into exam notes field
- **`AISummaryResult`** — summary text + badge lists for key diagnoses, medications, risk factors
- **`AIConclusionResult`** — conclusion text. Accept creates document with this text

---

## File Structure

```
frontend/src/
  features/ai/
    api.ts                         — API client (suggestDiagnoses, generateExam, summarizePatient, generateConclusion)
    useAI.ts                       — useMutation wrapper hook
    components/
      AITriggerButton.tsx          — compact ✨ button
      AIResultPanel.tsx            — inline result panel with Accept/Reject/Retry
      AIDiagnosisSuggestions.tsx   — diagnosis suggestion cards
      AIExamResult.tsx             — generated exam display
      AISummaryResult.tsx          — patient summary display
      AIConclusionResult.tsx       — conclusion display
  routes/_authenticated/patients.$patientId/
    diagnoses.tsx                  — modify: add ✨ button + AIDiagnosisSuggestions
    history/new.tsx                — modify: add ✨ button + AIExamResult
    overview.tsx                   — modify: add ✨ button + AISummaryResult
    documents.tsx                  — modify: add ✨ button + AIConclusionResult
    ai.tsx                         — rewrite: AI hub with history of all AI results
```

---

## Integration Points

### Diagnoses page (`diagnoses.tsx`)

- ✨ button next to "Диагнозы" heading
- Sends: symptoms from latest visit + existing diagnoses list + patient age/sex
- Shows: `AIDiagnosisSuggestions` inline below heading
- Accept per diagnosis: opens create form prefilled with icd_code and title

### New history entry (`history/new.tsx`)

- ✨ button next to "Жалобы" field
- Enabled only when complaints field has 3+ characters
- Sends: complaints text + visit type
- Shows: `AIExamResult` inline below complaints field
- Accept: inserts text into examination_notes field

### Overview page (`overview.tsx`)

- ✨ button next to "Обзор" heading
- Sends: patient_id (backend fetches history from DB)
- Shows: `AISummaryResult` inline at top of page
- No accept action needed — informational only

### Documents page (`documents.tsx`)

- ✨ button next to "Создать документ"
- Sends: current diagnoses + latest exam notes + treatment
- Shows: `AIConclusionResult` inline
- Accept: creates document with conclusion text

### AI Assistant tab (`ai.tsx`)

- Full rewrite of existing page
- Shows: all AI-generated content for this patient (from GET /api/v1/ai endpoint or dedicated query)
- Each item shows: task type, timestamp, status (pending/accepted/rejected), provider, content preview
- Filter by task type
- Retry button for any previous request

---

## Component Specifications

### AITriggerButton

- Size: 20x20px inline icon
- Icon: sparkles (✨)
- States: idle (text-muted-foreground), hover (text-primary), loading (animate-spin), success (text-success, checkmark for 2s then back to idle)
- Tooltip on hover: "AI подсказка"
- Disabled when isPending

### AIResultPanel

- Container: rounded-xl, bg-primary/5, border border-primary/20, p-4
- Header row: "✨ AI подсказка" left, "{provider} · {latency}с" right in text-xs text-muted
- Content: slot for task-specific component
- Footer row: flex gap-2
  - Accept button: small, variant success, "✓ Принять"
  - Reject button: small, variant ghost, "✗ Отклонить"
  - Retry button: small, variant ghost, icon ↻
- Animation: framer-motion, initial={{ opacity: 0, y: -8 }}, animate={{ opacity: 1, y: 0 }}
- On reject: panel fades out and resets

### AIDiagnosisSuggestions

- List of cards, each with:
  - ICD code badge (monospace, primary variant)
  - Title (font-medium)
  - Confidence bar (w-full h-1.5 rounded, fill by percentage, color by level: >0.7 success, >0.4 warning, else destructive)
  - Reasoning text (text-sm text-muted)
  - Individual "Принять" button per diagnosis

### AIExamResult

- Single text block with examination_text
- Formatted with line breaks preserved (whitespace-pre-wrap)
- Accept button inserts entire text

### AISummaryResult

- Summary paragraph
- Three badge groups: "Диагнозы:", "Лекарства:", "Факторы риска:"
- Each group as flex-wrap badges

### AIConclusionResult

- Conclusion text block (whitespace-pre-wrap)
- Accept creates document

---

## API Client

```typescript
// features/ai/api.ts
const AI_BASE = "/api/v1/ai";

suggestDiagnoses(data: { patient_id, symptoms, age?, sex?, existing_diagnoses? })
generateExam(data: { patient_id, complaints, visit_type? })
summarizePatient(data: { patient_id })
generateConclusion(data: { patient_id, visit_id?, diagnoses?, exam_notes?, treatment? })
```

Uses existing `apiClient` from the project (same auth headers, base URL).

---

## useAI Hook

```typescript
// features/ai/useAI.ts
function useAI<TInput, TOutput>(
  key: string,
  apiFn: (data: TInput) => Promise<TOutput>
) {
  const mutation = useMutation({ mutationFn: apiFn });
  return {
    trigger: mutation.mutate,
    result: mutation.data,
    isPending: mutation.isPending,
    error: mutation.error,
    reset: mutation.reset,
  };
}
```

---

## Key Principles

- **Inline, not modal** — results appear in context, no popups
- **Compact triggers** — small ✨ icons, don't clutter the UI
- **Doctor approves** — every AI result needs explicit acceptance
- **Graceful degradation** — if AI fails, show error toast, page works normally
- **Russian language** — all UI labels in Russian

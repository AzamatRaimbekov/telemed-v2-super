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

export function AIDiagnosisSuggestions({ suggestions, onAcceptDiagnosis }: AIDiagnosisSuggestionsProps) {
  if (!suggestions.length) {
    return <p className="text-sm text-[var(--color-text-secondary)]">AI не нашёл подходящих диагнозов.</p>;
  }

  return (
    <div className="space-y-2">
      {suggestions.map((s, i) => (
        <div key={`${s.icd_code}-${i}`} className="flex items-start gap-3 p-2 rounded-lg bg-[var(--color-surface)] border border-border">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="primary">{s.icd_code}</Badge>
              <span className="text-sm font-medium text-foreground truncate">{s.title}</span>
            </div>
            <div className="flex items-center gap-2 mb-1">
              <div className="flex-1 h-1.5 bg-[var(--color-muted)] rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${confidenceColor(s.confidence)}`} style={{ width: `${Math.round(s.confidence * 100)}%` }} />
              </div>
              <span className="text-[10px] text-[var(--color-text-tertiary)] w-8 text-right">{Math.round(s.confidence * 100)}%</span>
            </div>
            <p className="text-xs text-[var(--color-text-secondary)] line-clamp-2">{s.reasoning}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => onAcceptDiagnosis(s)} className="flex-shrink-0">Принять</Button>
        </div>
      ))}
    </div>
  );
}

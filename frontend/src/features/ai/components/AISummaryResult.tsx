import { Badge } from "@/components/ui/badge";

interface AISummaryResultProps {
  summary: string;
  keyDiagnoses: string[];
  keyMedications: string[];
  riskFactors: string[];
}

export function AISummaryResult({ summary, keyDiagnoses, keyMedications, riskFactors }: AISummaryResultProps) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-foreground leading-relaxed">{summary}</p>
      {keyDiagnoses.length > 0 && (
        <div>
          <span className="text-xs font-medium text-[var(--color-text-secondary)] mr-2">Диагнозы:</span>
          <div className="inline-flex flex-wrap gap-1">
            {keyDiagnoses.map((d, i) => <Badge key={i} variant="primary">{d}</Badge>)}
          </div>
        </div>
      )}
      {keyMedications.length > 0 && (
        <div>
          <span className="text-xs font-medium text-[var(--color-text-secondary)] mr-2">Лекарства:</span>
          <div className="inline-flex flex-wrap gap-1">
            {keyMedications.map((m, i) => <Badge key={i} variant="secondary">{m}</Badge>)}
          </div>
        </div>
      )}
      {riskFactors.length > 0 && (
        <div>
          <span className="text-xs font-medium text-[var(--color-text-secondary)] mr-2">Факторы риска:</span>
          <div className="inline-flex flex-wrap gap-1">
            {riskFactors.map((r, i) => <Badge key={i} variant="warning">{r}</Badge>)}
          </div>
        </div>
      )}
    </div>
  );
}

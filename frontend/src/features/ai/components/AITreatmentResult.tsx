import { Badge } from "@/components/ui/badge";

interface AITreatmentResultProps {
  plan: string;
  medications: string[];
  procedures: string[];
}

export function AITreatmentResult({ plan, medications, procedures }: AITreatmentResultProps) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-foreground leading-relaxed">{plan}</p>
      {medications.length > 0 && (
        <div>
          <span className="text-xs font-medium text-[var(--color-text-secondary)] mr-2">Медикаменты:</span>
          <div className="inline-flex flex-wrap gap-1">
            {medications.map((m, i) => <Badge key={i} variant="primary">{m}</Badge>)}
          </div>
        </div>
      )}
      {procedures.length > 0 && (
        <div>
          <span className="text-xs font-medium text-[var(--color-text-secondary)] mr-2">Процедуры:</span>
          <div className="inline-flex flex-wrap gap-1">
            {procedures.map((p, i) => <Badge key={i} variant="secondary">{p}</Badge>)}
          </div>
        </div>
      )}
    </div>
  );
}

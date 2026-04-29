import { Badge } from "@/components/ui/badge";

interface AIDischargeResultProps {
  dischargeText: string;
  recommendations: string[];
}

export function AIDischargeResult({ dischargeText, recommendations }: AIDischargeResultProps) {
  return (
    <div className="space-y-3">
      <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{dischargeText}</div>
      {recommendations.length > 0 && (
        <div>
          <span className="text-xs font-medium text-[var(--color-text-secondary)] mr-2">Рекомендации:</span>
          <div className="flex flex-col gap-1 mt-1">
            {recommendations.map((r, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-primary text-xs mt-0.5">•</span>
                <span className="text-sm text-foreground">{r}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

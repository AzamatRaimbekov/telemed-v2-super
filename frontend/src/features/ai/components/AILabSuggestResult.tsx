import { Badge } from "@/components/ui/badge";

interface AILabSuggestResultProps {
  suggestedTests: string[];
  reasoning: string;
}

export function AILabSuggestResult({ suggestedTests, reasoning }: AILabSuggestResultProps) {
  return (
    <div className="space-y-3">
      {suggestedTests.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {suggestedTests.map((t, i) => <Badge key={i} variant="primary">{t}</Badge>)}
        </div>
      )}
      <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">{reasoning}</p>
    </div>
  );
}

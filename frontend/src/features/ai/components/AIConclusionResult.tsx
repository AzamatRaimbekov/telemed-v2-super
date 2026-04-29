interface AIConclusionResultProps {
  conclusionText: string;
}

export function AIConclusionResult({ conclusionText }: AIConclusionResultProps) {
  return <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{conclusionText}</div>;
}

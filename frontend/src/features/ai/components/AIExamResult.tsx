interface AIExamResultProps {
  examinationText: string;
}

export function AIExamResult({ examinationText }: AIExamResultProps) {
  return <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{examinationText}</div>;
}

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
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
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
      <div className="mb-3">{children}</div>
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

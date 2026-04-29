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
          <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
        </svg>
      )}
    </button>
  );
}

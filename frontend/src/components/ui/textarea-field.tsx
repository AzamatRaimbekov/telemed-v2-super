import { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface TextareaFieldProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const TextareaField = forwardRef<HTMLTextAreaElement, TextareaFieldProps>(
  ({ label, error, className, ...props }, ref) => {
    return (
      <div className={cn("space-y-1.5", className)}>
        {label && <label className="block text-[13px] font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">{label}</label>}
        <textarea
          ref={ref}
          className={cn(
            "input-glow w-full px-4 py-2.5 rounded-xl border bg-[var(--color-surface)] text-foreground text-sm resize-none",
            "placeholder:text-[var(--color-text-tertiary)]",
            "focus:outline-none focus:border-secondary/40 transition-all duration-200",
            error ? "border-destructive" : "border-border",
          )}
          {...props}
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    );
  }
);
TextareaField.displayName = "TextareaField";

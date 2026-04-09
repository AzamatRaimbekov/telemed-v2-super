import { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface InputFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  icon?: React.ReactNode;
  error?: string;
  hint?: string;
}

export const InputField = forwardRef<HTMLInputElement, InputFieldProps>(
  ({ label, icon, error, hint, className, ...props }, ref) => {
    return (
      <div className={cn("space-y-1.5", className)}>
        {label && <label className="block text-[13px] font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">{label}</label>}
        <div className="relative">
          {icon && (
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--color-text-tertiary)]">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            className={cn(
              "input-glow w-full py-2.5 rounded-xl border bg-[var(--color-surface)] text-foreground text-sm",
              "placeholder:text-[var(--color-text-tertiary)]",
              "focus:outline-none focus:border-secondary/40 transition-all duration-200",
              icon ? "pl-11 pr-4" : "px-4",
              error ? "border-destructive focus:border-destructive" : "border-border",
            )}
            {...props}
          />
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        {hint && !error && <p className="text-xs text-[var(--color-text-tertiary)]">{hint}</p>}
      </div>
    );
  }
);
InputField.displayName = "InputField";

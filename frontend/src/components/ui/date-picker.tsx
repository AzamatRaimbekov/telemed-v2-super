import { cn } from "@/lib/utils";

interface DatePickerProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  required?: boolean;
  className?: string;
}

export function DatePicker({ value, onChange, label, required, className }: DatePickerProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && <label className="block text-[13px] font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">{label}</label>}
      <div className="relative">
        <input
          type="date"
          value={value}
          onChange={e => onChange(e.target.value)}
          required={required}
          className="input-glow w-full px-4 py-2.5 rounded-xl border border-border bg-[var(--color-surface)] text-foreground text-sm focus:outline-none focus:border-secondary/40 transition-all duration-200 [&::-webkit-calendar-picker-indicator]:opacity-50 [&::-webkit-calendar-picker-indicator]:hover:opacity-100 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
        />
      </div>
    </div>
  );
}

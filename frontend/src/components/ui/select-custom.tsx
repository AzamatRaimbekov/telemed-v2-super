import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

interface SelectOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  description?: string;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  label?: string;
  className?: string;
  disabled?: boolean;
}

export function CustomSelect({ value, onChange, options, placeholder = "Выберите...", label, className, disabled }: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find(o => o.value === value);
  const filtered = search ? options.filter(o => o.label.toLowerCase().includes(search.toLowerCase())) : options;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  return (
    <div ref={ref} className={cn("relative", className)}>
      {label && <label className="block text-[13px] font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)] mb-1.5">{label}</label>}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className={cn(
          "w-full flex items-center justify-between px-4 py-2.5 rounded-xl border text-sm text-left transition-all duration-200",
          open ? "border-secondary/40 bg-[var(--color-surface)] shadow-[0_0_0_3px_rgba(126,120,210,0.12)]" : "border-border bg-[var(--color-surface)] hover:border-[var(--color-text-tertiary)]/30",
          disabled && "opacity-50 cursor-not-allowed",
        )}
      >
        <span className={selected ? "text-foreground" : "text-[var(--color-text-tertiary)]"}>
          {selected?.label || placeholder}
        </span>
        <svg
          className={cn("w-4 h-4 text-[var(--color-text-tertiary)] transition-transform duration-200", open && "rotate-180")}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 mt-1.5 w-full bg-[var(--color-surface)] border border-border rounded-xl shadow-lg shadow-black/8 overflow-hidden animate-scale-in" style={{ opacity: 1 }}>
          {options.length > 6 && (
            <div className="p-2 border-b border-border">
              <input
                ref={inputRef}
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Поиск..."
                className="w-full px-3 py-2 rounded-lg bg-[var(--color-muted)]/50 text-sm text-foreground placeholder:text-[var(--color-text-tertiary)] focus:outline-none"
              />
            </div>
          )}
          <div className="max-h-[240px] overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <div className="px-4 py-3 text-sm text-[var(--color-text-tertiary)] text-center">Ничего не найдено</div>
            ) : filtered.map(option => (
              <button
                key={option.value}
                type="button"
                onClick={() => { onChange(option.value); setOpen(false); setSearch(""); }}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors hover:bg-[var(--color-muted)]/70",
                  option.value === value && "bg-secondary/8 text-secondary font-medium",
                )}
              >
                {option.icon && <span className="flex-shrink-0">{option.icon}</span>}
                <div className="flex-1 min-w-0">
                  <p className={cn("truncate", option.value === value ? "text-secondary" : "text-foreground")}>{option.label}</p>
                  {option.description && <p className="text-xs text-[var(--color-text-tertiary)] truncate">{option.description}</p>}
                </div>
                {option.value === value && (
                  <svg className="w-4 h-4 text-secondary flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

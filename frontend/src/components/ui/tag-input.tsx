import { useState } from "react";
import { cn } from "@/lib/utils";

interface TagInputProps {
  label?: string;
  tags: string[];
  onAdd: (tag: string) => void;
  onRemove: (index: number) => void;
  placeholder?: string;
  tagColor?: "destructive" | "warning" | "success" | "secondary";
  className?: string;
}

const tagColorMap = {
  destructive: "bg-destructive/10 text-destructive",
  warning: "bg-warning/10 text-warning",
  success: "bg-success/10 text-success",
  secondary: "bg-secondary/10 text-secondary",
};

export function TagInput({ label, tags, onAdd, onRemove, placeholder = "Добавить...", tagColor = "secondary", className }: TagInputProps) {
  const [input, setInput] = useState("");

  const handleAdd = () => {
    const trimmed = input.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onAdd(trimmed);
      setInput("");
    }
  };

  return (
    <div className={cn("space-y-1.5", className)}>
      {label && <label className="block text-[13px] font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">{label}</label>}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleAdd(); } }}
            placeholder={placeholder}
            className="input-glow w-full px-4 py-2.5 rounded-xl border border-border bg-[var(--color-surface)] text-foreground text-sm placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-secondary/40 transition-all"
          />
        </div>
        <button
          type="button"
          onClick={handleAdd}
          className={cn(
            "px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap",
            tagColorMap[tagColor],
            "hover:opacity-80 active:scale-95",
          )}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" x2="12" y1="5" y2="19" /><line x1="5" x2="19" y1="12" y2="12" />
          </svg>
        </button>
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {tags.map((tag, i) => (
            <span key={i} className={cn("inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium", tagColorMap[tagColor])}>
              {tag}
              <button
                type="button"
                onClick={() => onRemove(i)}
                className="hover:opacity-60 transition-opacity"
              >
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                  <path d="M18 6 6 18" /><path d="m6 6 12 12" />
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

import { useState } from "react";
import type { PeriodKey } from "../types";

const PERIOD_OPTIONS: { key: PeriodKey; label: string }[] = [
  { key: "7d", label: "7 дней" },
  { key: "30d", label: "30 дней" },
  { key: "3m", label: "3 мес" },
  { key: "all", label: "Всё" },
  { key: "custom", label: "Период" },
];

interface Props {
  value: PeriodKey;
  onChange: (key: PeriodKey, from?: Date, to?: Date) => void;
}

export function PeriodSelector({ value, onChange }: Props) {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  function handleClick(key: PeriodKey) {
    if (key === "custom") {
      setShowDatePicker(true);
    } else {
      setShowDatePicker(false);
      onChange(key);
    }
  }

  function handleApplyCustom() {
    if (fromDate && toDate) {
      onChange("custom", new Date(fromDate), new Date(toDate));
      setShowDatePicker(false);
    }
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex bg-[var(--color-muted)] rounded-lg p-0.5">
        {PERIOD_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => handleClick(opt.key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              value === opt.key
                ? "bg-[var(--color-surface)] text-foreground shadow-sm"
                : "text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {showDatePicker && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="px-2 py-1 text-xs rounded-md border border-border bg-[var(--color-surface)] text-foreground"
          />
          <span className="text-xs text-[var(--color-text-tertiary)]">—</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="px-2 py-1 text-xs rounded-md border border-border bg-[var(--color-surface)] text-foreground"
          />
          <button
            type="button"
            onClick={handleApplyCustom}
            disabled={!fromDate || !toDate}
            className="px-2 py-1 text-xs font-medium rounded-md bg-secondary text-white disabled:opacity-40"
          >
            OK
          </button>
        </div>
      )}
    </div>
  );
}

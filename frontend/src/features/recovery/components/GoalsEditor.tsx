import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { recoveryApi } from "../api";
import type { RecoveryGoal, RecoveryDomainKey } from "../types";

const VITALS_METRICS = [
  { key: "systolic_bp", label: "АД систолическое", unit: "мм рт.ст." },
  { key: "diastolic_bp", label: "АД диастолическое", unit: "мм рт.ст." },
  { key: "pulse", label: "Пульс", unit: "уд/мин" },
  { key: "spo2", label: "SpO₂", unit: "%" },
  { key: "temperature", label: "Температура", unit: "°C" },
  { key: "blood_glucose", label: "Глюкоза", unit: "ммоль/л" },
  { key: "respiratory_rate", label: "ЧДД", unit: "/мин" },
];

interface Props {
  patientId: string;
  domain: RecoveryDomainKey;
  existingGoals: RecoveryGoal[];
}

export function GoalsEditor({ patientId, domain, existingGoals }: Props) {
  const queryClient = useQueryClient();
  const existingMap = new Map(
    existingGoals
      .filter((g) => g.domain === domain)
      .map((g) => [g.metric_key, g.target_value])
  );

  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const [key, val] of existingMap) {
      if (val !== null) initial[key] = String(val);
    }
    return initial;
  });

  const mutation = useMutation({
    mutationFn: (goals: { domain: string; metric_key: string; target_value: number }[]) =>
      recoveryApi.updateGoals(patientId, goals),
    onSuccess: () => {
      toast.success("Цели обновлены");
      queryClient.invalidateQueries({ queryKey: ["patient-recovery-goals", patientId] });
    },
    onError: () => toast.error("Ошибка при сохранении целей"),
  });

  function handleSave() {
    const goals = Object.entries(values)
      .filter(([, v]) => v !== "")
      .map(([key, v]) => ({
        domain,
        metric_key: key,
        target_value: parseFloat(v),
      }));
    mutation.mutate(goals);
  }

  const metrics = domain === "VITALS" ? VITALS_METRICS : [];

  if (metrics.length === 0) {
    return (
      <p className="text-xs text-[var(--color-text-tertiary)]">
        Настройка целей для этого домена пока недоступна
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">
        Целевые значения
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {metrics.map((m) => (
          <div key={m.key}>
            <label className="text-xs text-[var(--color-text-secondary)] mb-1 block">{m.label}</label>
            <div className="flex items-center gap-1">
              <input
                type="number"
                step="any"
                value={values[m.key] ?? ""}
                onChange={(e) => setValues((prev) => ({ ...prev, [m.key]: e.target.value }))}
                placeholder="—"
                className="w-full px-2 py-1 text-xs rounded-md border border-border bg-[var(--color-muted)] text-foreground"
              />
              <span className="text-[10px] text-[var(--color-text-tertiary)] whitespace-nowrap">{m.unit}</span>
            </div>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={handleSave}
        disabled={mutation.isPending}
        className="px-3 py-1.5 text-xs font-medium rounded-md bg-secondary text-white hover:bg-secondary/90 disabled:opacity-40 transition-colors"
      >
        {mutation.isPending ? "Сохранение..." : "Сохранить цели"}
      </button>
    </div>
  );
}

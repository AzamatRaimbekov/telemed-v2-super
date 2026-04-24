import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { usePortalAuthStore } from "@/stores/portal-auth-store";
import portalClient from "@/lib/portal-api-client";
import { useState } from "react";

export const Route = createFileRoute("/portal/_portal/dental-chart")({
  component: DentalChartPage,
});

const STATUS_COLORS: Record<string, { bg: string; label: string }> = {
  healthy: { bg: "bg-white border-gray-300", label: "Здоров" },
  caries: { bg: "bg-red-400 border-red-600 text-white", label: "Кариес" },
  filled: { bg: "bg-blue-400 border-blue-600 text-white", label: "Пломба" },
  crown: { bg: "bg-yellow-400 border-yellow-600", label: "Коронка" },
  implant: { bg: "bg-purple-400 border-purple-600 text-white", label: "Имплант" },
  missing: { bg: "bg-gray-300 border-gray-500", label: "Отсутствует" },
  root_canal: { bg: "bg-orange-400 border-orange-600 text-white", label: "Каналы" },
  bridge: { bg: "bg-teal-400 border-teal-600 text-white", label: "Мост" },
  veneer: { bg: "bg-cyan-300 border-cyan-500", label: "Винир" },
  temporary: { bg: "bg-amber-200 border-amber-400", label: "Временная" },
  planned: { bg: "bg-indigo-300 border-indigo-500 text-white", label: "Планируется" },
};

// FDI notation: upper right 18-11, upper left 21-28, lower left 38-31, lower right 41-48
const UPPER_RIGHT = [18, 17, 16, 15, 14, 13, 12, 11];
const UPPER_LEFT = [21, 22, 23, 24, 25, 26, 27, 28];
const LOWER_LEFT = [38, 37, 36, 35, 34, 33, 32, 31];
const LOWER_RIGHT = [41, 42, 43, 44, 45, 46, 47, 48];

type Treatment = {
  id: string;
  tooth_number: number;
  procedure: string;
  diagnosis: string | null;
  price: number | null;
  date: string;
  notes: string | null;
};

function DentalChartPage() {
  const { patient } = usePortalAuthStore();
  const patientId = patient?.id;
  const [selectedTooth, setSelectedTooth] = useState<number | null>(null);

  const { data: chartData } = useQuery({
    queryKey: ["dental-chart", patientId],
    queryFn: () => portalClient.get("/portal/dental/my-teeth", { params: { patient_id: patientId } }).then((r) => r.data),
    enabled: !!patientId,
  });

  const { data: reminder } = useQuery({
    queryKey: ["cleaning-reminder", patientId],
    queryFn: () => portalClient.get("/portal/dental/cleaning-reminder", { params: { patient_id: patientId } }).then((r) => r.data),
    enabled: !!patientId,
  });

  const { data: treatments } = useQuery({
    queryKey: ["dental-treatments", patientId],
    queryFn: () => portalClient.get("/portal/dental/my-treatments", { params: { patient_id: patientId } }).then((r) => r.data),
    enabled: !!patientId,
  });

  const teeth: Record<string, { status: string; notes?: string }> = chartData?.teeth ?? {};

  const getStatus = (num: number) => teeth[String(num)]?.status ?? "healthy";

  const toothTreatments: Treatment[] = selectedTooth
    ? (treatments ?? []).filter((t: Treatment) => t.tooth_number === selectedTooth)
    : [];

  const renderRow = (nums: number[], label: string) => (
    <div className="flex items-center gap-1">
      <span className="text-xs text-[var(--color-text-tertiary)] w-6 text-right mr-1">{label}</span>
      {nums.map((n) => {
        const status = getStatus(n);
        const cfg = STATUS_COLORS[status] ?? STATUS_COLORS.healthy;
        const isSelected = selectedTooth === n;
        return (
          <button
            key={n}
            onClick={() => setSelectedTooth(selectedTooth === n ? null : n)}
            className={`w-9 h-10 rounded border-2 text-xs font-bold flex items-center justify-center transition-all
              ${cfg.bg} ${isSelected ? "ring-2 ring-primary scale-110" : "hover:scale-105"}`}
          >
            {n}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Мои зубы</h1>

      {/* Cleaning reminder */}
      {reminder?.needs_cleaning && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 dark:bg-amber-900/20 p-4 flex items-start gap-3">
          <span className="text-2xl">🪥</span>
          <div>
            <p className="font-semibold text-amber-800 dark:text-amber-300">{reminder.message}</p>
            {reminder.months_since != null && (
              <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">
                Последняя чистка: {reminder.months_since} мес. назад
              </p>
            )}
          </div>
        </div>
      )}

      {/* Dental diagram */}
      <div className="rounded-2xl border border-border bg-[var(--color-surface)] p-6 space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Зубная карта (FDI)</h2>

        {/* Upper jaw */}
        <div className="space-y-1">
          <p className="text-xs text-[var(--color-text-tertiary)] text-center mb-1">Верхняя челюсть</p>
          <div className="flex justify-center gap-4">
            {renderRow(UPPER_RIGHT, "R")}
            <div className="w-px bg-border" />
            {renderRow(UPPER_LEFT, "L")}
          </div>
        </div>

        <div className="border-t border-dashed border-border" />

        {/* Lower jaw */}
        <div className="space-y-1">
          <div className="flex justify-center gap-4">
            {renderRow(LOWER_LEFT, "L")}
            <div className="w-px bg-border" />
            {renderRow(LOWER_RIGHT, "R")}
          </div>
          <p className="text-xs text-[var(--color-text-tertiary)] text-center mt-1">Нижняя челюсть</p>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-2 pt-3 border-t border-border">
          {Object.entries(STATUS_COLORS).map(([key, { bg, label }]) => (
            <span key={key} className={`inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded border ${bg}`}>
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* Selected tooth detail */}
      {selectedTooth && (
        <div className="rounded-2xl border border-border bg-[var(--color-surface)] p-6 space-y-3">
          <h2 className="text-lg font-semibold text-foreground">
            Зуб #{selectedTooth} &mdash; {STATUS_COLORS[getStatus(selectedTooth)]?.label ?? "Нет данных"}
          </h2>
          {teeth[String(selectedTooth)]?.notes && (
            <p className="text-sm text-[var(--color-text-secondary)]">{teeth[String(selectedTooth)].notes}</p>
          )}
          {toothTreatments.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-[var(--color-text-secondary)]">История лечения:</p>
              {toothTreatments.map((t: Treatment) => (
                <div key={t.id} className="rounded-xl bg-muted/50 p-3 text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="font-medium text-foreground">{t.procedure}</span>
                    {t.price != null && <span className="text-green-600 font-semibold">{t.price} сом</span>}
                  </div>
                  {t.diagnosis && <p className="text-[var(--color-text-tertiary)]">Диагноз: {t.diagnosis}</p>}
                  <p className="text-xs text-[var(--color-text-tertiary)]">
                    {new Date(t.date).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}
                  </p>
                  {t.notes && <p className="text-xs text-[var(--color-text-tertiary)]">{t.notes}</p>}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[var(--color-text-tertiary)]">Нет записей о лечении этого зуба</p>
          )}
        </div>
      )}

      {/* All treatments */}
      {treatments && treatments.length > 0 && (
        <div className="rounded-2xl border border-border bg-[var(--color-surface)] p-6">
          <h2 className="text-lg font-semibold text-foreground mb-3">Все процедуры ({treatments.length})</h2>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {treatments.map((t: Treatment) => (
              <div
                key={t.id}
                onClick={() => setSelectedTooth(t.tooth_number)}
                className="flex items-center justify-between py-2 border-b border-border last:border-0 cursor-pointer hover:bg-muted/30 rounded px-2 transition-colors"
              >
                <div>
                  <p className="text-sm text-foreground">
                    <span className="font-semibold">#{t.tooth_number}</span> {t.procedure}
                  </p>
                  <p className="text-xs text-[var(--color-text-tertiary)]">
                    {new Date(t.date).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>
                {t.price != null && <span className="text-sm font-semibold text-green-600">{t.price} сом</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

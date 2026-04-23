import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  useNurseDiary,
  useCreateEntry,
  type NurseDiaryEntry,
  type CreateEntryData,
} from "@/features/nurse-diary/api";

export const Route = createFileRoute("/_authenticated/nurse-diary")({
  component: NurseDiaryPage,
});

const shiftConfig: Record<string, { variant: "warning" | "secondary" | "muted"; label: string }> = {
  day: { variant: "warning", label: "Дневная" },
  evening: { variant: "secondary", label: "Вечерняя" },
  night: { variant: "muted", label: "Ночная" },
};

const conditionConfig: Record<string, { variant: "success" | "warning" | "destructive"; label: string }> = {
  satisfactory: { variant: "success", label: "Удовлетворительное" },
  moderate: { variant: "warning", label: "Средней тяжести" },
  severe: { variant: "destructive", label: "Тяжёлое" },
  critical: { variant: "destructive", label: "Критическое" },
};

function NurseDiaryPage() {
  const [patientId, setPatientId] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const { data: entries, isLoading } = useNurseDiary(patientId || undefined);
  const createEntry = useCreateEntry();

  const [form, setForm] = useState<CreateEntryData>({
    patient_id: "",
    shift: "day",
    condition: "satisfactory",
    temperature: undefined,
    blood_pressure_systolic: undefined,
    blood_pressure_diastolic: undefined,
    pulse: undefined,
    respiratory_rate: undefined,
    oxygen_saturation: undefined,
    consciousness: "",
    complaints: "",
    procedures_done: "",
    medications_given: "",
    diet: "",
    notes: "",
  });

  const handleSearch = () => {
    setPatientId(searchInput);
  };

  const handleCreate = () => {
    createEntry.mutate({ ...form, patient_id: patientId || form.patient_id }, {
      onSuccess: () => {
        setShowCreate(false);
        setForm({ patient_id: "", shift: "day", condition: "satisfactory" });
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Дневник наблюдений</h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">Записи медсестринского наблюдения за пациентами</p>
        </div>
        <Button onClick={() => setShowCreate(true)} icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M12 5v14M5 12h14"/></svg>}>
          Новая запись
        </Button>
      </div>

      {/* Patient search */}
      <div className="bg-[var(--color-surface)] rounded-xl border border-border shadow-sm p-4">
        <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">Поиск пациента</label>
        <div className="flex gap-3">
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="flex-1 px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            placeholder="Введите ID пациента"
          />
          <Button onClick={handleSearch} variant="secondary">Найти</Button>
        </div>
      </div>

      {/* Entries */}
      {!patientId ? (
        <div className="text-center py-12 text-[var(--color-text-tertiary)]">Выберите пациента для просмотра записей</div>
      ) : isLoading ? (
        <div className="text-center py-12 text-[var(--color-text-tertiary)]">Загрузка...</div>
      ) : !entries?.length ? (
        <div className="text-center py-12 text-[var(--color-text-tertiary)]">Нет записей для данного пациента</div>
      ) : (
        <div className="grid gap-4">
          {entries.map((e: NurseDiaryEntry) => {
            const shift = shiftConfig[e.shift] || shiftConfig.day;
            const cond = conditionConfig[e.condition] || conditionConfig.satisfactory;
            return (
              <div key={e.id} className="bg-[var(--color-surface)] rounded-xl border border-border shadow-sm p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Badge variant={shift.variant}>{shift.label} смена</Badge>
                  <Badge variant={cond.variant} dot>{cond.label}</Badge>
                  <span className="ml-auto text-xs text-[var(--color-text-tertiary)]">
                    {new Date(e.created_at).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>

                {/* Vitals grid */}
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-3">
                  {e.temperature != null && (
                    <div className="bg-[var(--color-muted)] rounded-lg p-2 text-center">
                      <span className="text-xs text-[var(--color-text-tertiary)]">Темп.</span>
                      <p className="text-sm font-semibold text-foreground">{e.temperature}°C</p>
                    </div>
                  )}
                  {e.blood_pressure_systolic != null && (
                    <div className="bg-[var(--color-muted)] rounded-lg p-2 text-center">
                      <span className="text-xs text-[var(--color-text-tertiary)]">АД</span>
                      <p className="text-sm font-semibold text-foreground">{e.blood_pressure_systolic}/{e.blood_pressure_diastolic}</p>
                    </div>
                  )}
                  {e.pulse != null && (
                    <div className="bg-[var(--color-muted)] rounded-lg p-2 text-center">
                      <span className="text-xs text-[var(--color-text-tertiary)]">Пульс</span>
                      <p className="text-sm font-semibold text-foreground">{e.pulse}</p>
                    </div>
                  )}
                  {e.respiratory_rate != null && (
                    <div className="bg-[var(--color-muted)] rounded-lg p-2 text-center">
                      <span className="text-xs text-[var(--color-text-tertiary)]">ЧДД</span>
                      <p className="text-sm font-semibold text-foreground">{e.respiratory_rate}</p>
                    </div>
                  )}
                  {e.oxygen_saturation != null && (
                    <div className="bg-[var(--color-muted)] rounded-lg p-2 text-center">
                      <span className="text-xs text-[var(--color-text-tertiary)]">SpO2</span>
                      <p className="text-sm font-semibold text-foreground">{e.oxygen_saturation}%</p>
                    </div>
                  )}
                </div>

                <div className="text-sm space-y-1 text-[var(--color-text-secondary)]">
                  {e.consciousness && <p><span className="text-[var(--color-text-tertiary)]">Сознание:</span> {e.consciousness}</p>}
                  {e.complaints && <p><span className="text-[var(--color-text-tertiary)]">Жалобы:</span> {e.complaints}</p>}
                  {e.procedures_done && <p><span className="text-[var(--color-text-tertiary)]">Процедуры:</span> {e.procedures_done}</p>}
                  {e.medications_given && <p><span className="text-[var(--color-text-tertiary)]">Медикаменты:</span> {e.medications_given}</p>}
                  {e.diet && <p><span className="text-[var(--color-text-tertiary)]">Диета:</span> {e.diet}</p>}
                  {e.notes && <p><span className="text-[var(--color-text-tertiary)]">Примечания:</span> {e.notes}</p>}
                </div>
                <p className="text-xs text-[var(--color-text-tertiary)] mt-2">Медсестра: {e.nurse_name}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowCreate(false)}>
          <div className="bg-[var(--color-surface)] rounded-2xl border border-border shadow-xl w-full max-w-lg p-6 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-foreground mb-4">Новая запись наблюдения</h2>
            <div className="space-y-4">
              {!patientId && (
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">ID пациента</label>
                  <input value={form.patient_id} onChange={(e) => setForm({ ...form, patient_id: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Смена</label>
                  <select value={form.shift} onChange={(e) => setForm({ ...form, shift: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                    <option value="day">Дневная</option>
                    <option value="evening">Вечерняя</option>
                    <option value="night">Ночная</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Состояние</label>
                  <select value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                    <option value="satisfactory">Удовлетворительное</option>
                    <option value="moderate">Средней тяжести</option>
                    <option value="severe">Тяжёлое</option>
                    <option value="critical">Критическое</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Темп. °C</label>
                  <input type="number" step="0.1" value={form.temperature ?? ""} onChange={(e) => setForm({ ...form, temperature: e.target.value ? Number(e.target.value) : undefined })} className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">АД сист.</label>
                  <input type="number" value={form.blood_pressure_systolic ?? ""} onChange={(e) => setForm({ ...form, blood_pressure_systolic: e.target.value ? Number(e.target.value) : undefined })} className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">АД диаст.</label>
                  <input type="number" value={form.blood_pressure_diastolic ?? ""} onChange={(e) => setForm({ ...form, blood_pressure_diastolic: e.target.value ? Number(e.target.value) : undefined })} className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Пульс</label>
                  <input type="number" value={form.pulse ?? ""} onChange={(e) => setForm({ ...form, pulse: e.target.value ? Number(e.target.value) : undefined })} className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">ЧДД</label>
                  <input type="number" value={form.respiratory_rate ?? ""} onChange={(e) => setForm({ ...form, respiratory_rate: e.target.value ? Number(e.target.value) : undefined })} className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">SpO2 %</label>
                  <input type="number" value={form.oxygen_saturation ?? ""} onChange={(e) => setForm({ ...form, oxygen_saturation: e.target.value ? Number(e.target.value) : undefined })} className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Жалобы</label>
                <textarea value={form.complaints} onChange={(e) => setForm({ ...form, complaints: e.target.value })} rows={2} className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Процедуры</label>
                <textarea value={form.procedures_done} onChange={(e) => setForm({ ...form, procedures_done: e.target.value })} rows={2} className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Медикаменты</label>
                <textarea value={form.medications_given} onChange={(e) => setForm({ ...form, medications_given: e.target.value })} rows={2} className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Примечания</label>
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <Button variant="outline" onClick={() => setShowCreate(false)}>Отмена</Button>
              <Button onClick={handleCreate} loading={createEntry.isPending}>Сохранить</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

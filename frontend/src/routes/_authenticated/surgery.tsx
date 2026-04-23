import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  useSurgeries,
  useCreateSurgery,
  useStartSurgery,
  useCompleteSurgery,
  useCancelSurgery,
  type Surgery,
  type CreateSurgeryData,
} from "@/features/surgery/api";

export const Route = createFileRoute("/_authenticated/surgery")({
  component: SurgeryPage,
});

const statusConfig: Record<string, { variant: "secondary" | "warning" | "success" | "muted" | "primary"; label: string }> = {
  planned: { variant: "secondary", label: "Запланирована" },
  in_progress: { variant: "warning", label: "В процессе" },
  completed: { variant: "success", label: "Завершена" },
  cancelled: { variant: "muted", label: "Отменена" },
  postponed: { variant: "primary", label: "Отложена" },
};

const tabs = [
  { key: "all", label: "Все" },
  { key: "planned", label: "Запланированные" },
  { key: "in_progress", label: "В процессе" },
  { key: "completed", label: "Завершённые" },
] as const;

function SurgeryPage() {
  const [filter, setFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<Surgery | null>(null);
  const { data: surgeries, isLoading } = useSurgeries(filter);
  const createSurgery = useCreateSurgery();
  const startSurgery = useStartSurgery();
  const completeSurgery = useCompleteSurgery();
  const cancelSurgery = useCancelSurgery();

  const [form, setForm] = useState<CreateSurgeryData>({
    surgery_name: "",
    patient_id: "",
    planned_date: "",
    room: "",
    anesthesia_type: "",
  });

  const handleCreate = () => {
    createSurgery.mutate(form, {
      onSuccess: () => {
        setShowCreate(false);
        setForm({ surgery_name: "", patient_id: "", planned_date: "", room: "", anesthesia_type: "" });
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Протоколы операций</h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">Планирование и ведение хирургических операций</p>
        </div>
        <Button onClick={() => setShowCreate(true)} icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M12 5v14M5 12h14"/></svg>}>
          Запланировать операцию
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[var(--color-muted)] p-1 rounded-xl w-fit">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${filter === key ? "bg-[var(--color-surface)] text-foreground shadow-sm" : "text-[var(--color-text-secondary)] hover:text-foreground"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="text-center py-12 text-[var(--color-text-tertiary)]">Загрузка...</div>
      ) : !surgeries?.length ? (
        <div className="text-center py-12 text-[var(--color-text-tertiary)]">Нет операций</div>
      ) : (
        <div className="grid gap-4">
          {surgeries.map((s: Surgery) => {
            const cfg = statusConfig[s.status] || statusConfig.planned;
            return (
              <div
                key={s.id}
                className="bg-[var(--color-surface)] rounded-xl border border-border shadow-sm p-5 cursor-pointer hover:border-[var(--color-text-tertiary)] transition-colors"
                onClick={() => setSelected(s)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-semibold text-foreground text-lg">{s.surgery_name}</span>
                      <Badge variant={cfg.variant} dot>{cfg.label}</Badge>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                      <div>
                        <span className="text-[var(--color-text-tertiary)]">Пациент</span>
                        <p className="text-foreground font-medium">{s.patient_name}</p>
                      </div>
                      <div>
                        <span className="text-[var(--color-text-tertiary)]">Хирург</span>
                        <p className="text-foreground font-medium">{s.surgeon_name}</p>
                      </div>
                      <div>
                        <span className="text-[var(--color-text-tertiary)]">Дата</span>
                        <p className="text-foreground font-medium">
                          {new Date(s.planned_date).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" })}
                        </p>
                      </div>
                      <div>
                        <span className="text-[var(--color-text-tertiary)]">Палата / Длит.</span>
                        <p className="text-foreground font-medium">
                          {s.room || "—"} {s.duration_minutes ? `/ ${s.duration_minutes} мин` : ""}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    {s.status === "planned" && (
                      <>
                        <Button size="sm" onClick={() => startSurgery.mutate(s.id)} loading={startSurgery.isPending}>Начать</Button>
                        <Button size="sm" variant="outline" onClick={() => cancelSurgery.mutate(s.id)} loading={cancelSurgery.isPending}>Отменить</Button>
                      </>
                    )}
                    {s.status === "in_progress" && (
                      <Button size="sm" onClick={() => completeSurgery.mutate(s.id)} loading={completeSurgery.isPending}>Завершить</Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setSelected(null)}>
          <div className="bg-[var(--color-surface)] rounded-2xl border border-border shadow-xl w-full max-w-2xl p-6 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-foreground">{selected.surgery_name}</h2>
              <Badge variant={statusConfig[selected.status]?.variant || "muted"} dot>
                {statusConfig[selected.status]?.label || selected.status}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm mb-4">
              <div><span className="text-[var(--color-text-tertiary)]">Пациент:</span> <span className="text-foreground">{selected.patient_name}</span></div>
              <div><span className="text-[var(--color-text-tertiary)]">Хирург:</span> <span className="text-foreground">{selected.surgeon_name}</span></div>
              {selected.anesthesiologist_name && <div><span className="text-[var(--color-text-tertiary)]">Анестезиолог:</span> <span className="text-foreground">{selected.anesthesiologist_name}</span></div>}
              {selected.anesthesia_type && <div><span className="text-[var(--color-text-tertiary)]">Анестезия:</span> <span className="text-foreground">{selected.anesthesia_type}</span></div>}
              {selected.room && <div><span className="text-[var(--color-text-tertiary)]">Палата:</span> <span className="text-foreground">{selected.room}</span></div>}
              {selected.duration_minutes && <div><span className="text-[var(--color-text-tertiary)]">Длительность:</span> <span className="text-foreground">{selected.duration_minutes} мин</span></div>}
              {selected.blood_loss_ml != null && <div><span className="text-[var(--color-text-tertiary)]">Кровопотеря:</span> <span className="text-foreground">{selected.blood_loss_ml} мл</span></div>}
            </div>
            {selected.protocol_text && (
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-foreground mb-1">Протокол</h3>
                <p className="text-sm text-[var(--color-text-secondary)] whitespace-pre-wrap bg-[var(--color-muted)] rounded-xl p-3">{selected.protocol_text}</p>
              </div>
            )}
            {selected.complications && (
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-destructive mb-1">Осложнения</h3>
                <p className="text-sm text-[var(--color-text-secondary)]">{selected.complications}</p>
              </div>
            )}
            {selected.implants && (
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-foreground mb-1">Импланты</h3>
                <p className="text-sm text-[var(--color-text-secondary)]">{selected.implants}</p>
              </div>
            )}
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setSelected(null)}>Закрыть</Button>
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowCreate(false)}>
          <div className="bg-[var(--color-surface)] rounded-2xl border border-border shadow-xl w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-foreground mb-4">Запланировать операцию</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Название операции</label>
                <input value={form.surgery_name} onChange={(e) => setForm({ ...form, surgery_name: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="Например: Аппендэктомия" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">ID пациента</label>
                <input value={form.patient_id} onChange={(e) => setForm({ ...form, patient_id: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="Введите ID пациента" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Дата операции</label>
                <input type="datetime-local" value={form.planned_date} onChange={(e) => setForm({ ...form, planned_date: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Операционная</label>
                  <input value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="Опер. 1" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Тип анестезии</label>
                  <input value={form.anesthesia_type} onChange={(e) => setForm({ ...form, anesthesia_type: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="Общая" />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <Button variant="outline" onClick={() => setShowCreate(false)}>Отмена</Button>
              <Button onClick={handleCreate} loading={createSurgery.isPending} disabled={!form.surgery_name || !form.patient_id || !form.planned_date}>
                Запланировать
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  useInfections,
  useActiveCount,
  useQuarantineRooms,
  useReportInfection,
  useResolveInfection,
  type Infection,
  type ReportInfectionData,
} from "@/features/infection-control/api";

export const Route = createFileRoute("/_authenticated/infection-control")({
  component: InfectionControlPage,
});

const statusConfig: Record<string, { variant: "warning" | "destructive" | "secondary" | "success"; label: string }> = {
  suspected: { variant: "warning", label: "Подозрение" },
  confirmed: { variant: "destructive", label: "Подтверждено" },
  monitoring: { variant: "secondary", label: "Мониторинг" },
  resolved: { variant: "success", label: "Разрешено" },
};

const isolationConfig: Record<string, { color: string; label: string }> = {
  contact: { color: "bg-amber-100 text-amber-700", label: "Контактная" },
  droplet: { color: "bg-blue-100 text-blue-700", label: "Капельная" },
  airborne: { color: "bg-red-100 text-red-700", label: "Воздушная" },
  protective: { color: "bg-green-100 text-green-700", label: "Защитная" },
};

const tabs = [
  { key: "all", label: "Все" },
  { key: "suspected", label: "Подозрение" },
  { key: "confirmed", label: "Подтверждено" },
  { key: "monitoring", label: "Мониторинг" },
] as const;

function InfectionControlPage() {
  const [filter, setFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const { data: infections, isLoading } = useInfections(filter);
  const { data: activeCount } = useActiveCount();
  const { data: quarantine } = useQuarantineRooms();
  const reportInfection = useReportInfection();
  const resolveInfection = useResolveInfection();

  const [form, setForm] = useState<ReportInfectionData>({
    patient_id: "",
    infection_type: "",
    isolation_type: "",
    room: "",
    precautions: "",
    notes: "",
  });

  const handleCreate = () => {
    reportInfection.mutate(form, {
      onSuccess: () => {
        setShowCreate(false);
        setForm({ patient_id: "", infection_type: "", isolation_type: "", room: "", precautions: "", notes: "" });
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-red-600">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Контроль инфекций</h1>
            <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">Мониторинг и управление инфекционными случаями</p>
          </div>
        </div>
        <Button onClick={() => setShowCreate(true)} icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M12 5v14M5 12h14"/></svg>}>
          Зарегистрировать
        </Button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-[var(--color-surface)] rounded-xl border border-border shadow-sm p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6 text-destructive">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{activeCount?.count ?? 0}</p>
            <p className="text-sm text-[var(--color-text-secondary)]">Активных инфекций</p>
          </div>
        </div>
        <div className="bg-[var(--color-surface)] rounded-xl border border-border shadow-sm p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-warning/10 flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6 text-warning">
              <rect width="18" height="18" x="3" y="3" rx="2" />
              <path d="M3 9h18M9 3v18" />
            </svg>
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{quarantine?.rooms?.length ?? 0}</p>
            <p className="text-sm text-[var(--color-text-secondary)]">Палат на карантине</p>
          </div>
        </div>
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

      {/* Quarantine rooms */}
      {quarantine?.rooms && quarantine.rooms.length > 0 && (
        <div className="bg-[var(--color-surface)] rounded-xl border border-border shadow-sm p-4">
          <h3 className="text-sm font-semibold text-foreground mb-2">Палаты на карантине</h3>
          <div className="flex flex-wrap gap-2">
            {quarantine.rooms.map((room: string) => (
              <span key={room} className="px-3 py-1 bg-red-100 text-red-700 text-sm font-medium rounded-lg">{room}</span>
            ))}
          </div>
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="text-center py-12 text-[var(--color-text-tertiary)]">Загрузка...</div>
      ) : !infections?.length ? (
        <div className="text-center py-12 text-[var(--color-text-tertiary)]">Нет записей</div>
      ) : (
        <div className="grid gap-4">
          {infections.map((inf: Infection) => {
            const st = statusConfig[inf.status] || statusConfig.suspected;
            const iso = inf.isolation_type ? isolationConfig[inf.isolation_type] : null;
            return (
              <div key={inf.id} className="bg-[var(--color-surface)] rounded-xl border border-border shadow-sm p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-semibold text-foreground">{inf.patient_name}</span>
                      <span className="text-foreground font-bold">- {inf.infection_type}</span>
                    </div>
                    <div className="flex flex-wrap gap-2 mb-2">
                      <Badge variant={st.variant} dot>{st.label}</Badge>
                      {iso && <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${iso.color}`}>{iso.label} изоляция</span>}
                      {inf.room && <Badge variant="muted">Палата: {inf.room}</Badge>}
                    </div>
                    <div className="text-sm text-[var(--color-text-secondary)] space-y-1">
                      <p>Дата обнаружения: {new Date(inf.detected_date).toLocaleDateString("ru-RU")}</p>
                      {inf.precautions && <p>Меры: {inf.precautions}</p>}
                      {inf.notes && <p>Примечания: {inf.notes}</p>}
                    </div>
                  </div>
                  {inf.status !== "resolved" && (
                    <Button size="sm" variant="secondary" onClick={() => resolveInfection.mutate(inf.id)} loading={resolveInfection.isPending}>
                      Разрешить
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowCreate(false)}>
          <div className="bg-[var(--color-surface)] rounded-2xl border border-border shadow-xl w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-foreground mb-4">Зарегистрировать инфекцию</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">ID пациента</label>
                <input value={form.patient_id} onChange={(e) => setForm({ ...form, patient_id: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Тип инфекции</label>
                <input value={form.infection_type} onChange={(e) => setForm({ ...form, infection_type: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="Например: MRSA" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Тип изоляции</label>
                  <select value={form.isolation_type} onChange={(e) => setForm({ ...form, isolation_type: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                    <option value="">Не выбрано</option>
                    <option value="contact">Контактная</option>
                    <option value="droplet">Капельная</option>
                    <option value="airborne">Воздушная</option>
                    <option value="protective">Защитная</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Палата</label>
                  <input value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Меры предосторожности</label>
                <textarea value={form.precautions} onChange={(e) => setForm({ ...form, precautions: e.target.value })} rows={2} className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Примечания</label>
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <Button variant="outline" onClick={() => setShowCreate(false)}>Отмена</Button>
              <Button onClick={handleCreate} loading={reportInfection.isPending} disabled={!form.patient_id || !form.infection_type}>
                Зарегистрировать
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

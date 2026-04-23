import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  useReferrals,
  useCreateReferral,
  useAcceptReferral,
  useDeclineReferral,
  useCompleteReferral,
  type Referral,
  type CreateReferralData,
} from "@/features/referrals/api";

export const Route = createFileRoute("/_authenticated/referrals")({
  component: ReferralsPage,
});

const priorityColors: Record<string, { variant: "muted" | "warning" | "destructive"; label: string }> = {
  routine: { variant: "muted", label: "Плановый" },
  urgent: { variant: "warning", label: "Срочный" },
  emergency: { variant: "destructive", label: "Экстренный" },
};

const statusColors: Record<string, { variant: "muted" | "warning" | "success" | "destructive" | "secondary"; label: string }> = {
  pending: { variant: "warning", label: "Ожидает" },
  accepted: { variant: "success", label: "Принято" },
  declined: { variant: "destructive", label: "Отклонено" },
  completed: { variant: "muted", label: "Завершено" },
};

function ReferralsPage() {
  const [tab, setTab] = useState<"incoming" | "outgoing">("incoming");
  const [showCreate, setShowCreate] = useState(false);
  const { data: referrals, isLoading } = useReferrals(tab);
  const createReferral = useCreateReferral();
  const acceptReferral = useAcceptReferral();
  const declineReferral = useDeclineReferral();
  const completeReferral = useCompleteReferral();

  const [form, setForm] = useState<CreateReferralData>({
    patient_id: "",
    to_specialty: "",
    priority: "routine",
    reason: "",
  });

  const handleCreate = () => {
    createReferral.mutate(form, {
      onSuccess: () => {
        setShowCreate(false);
        setForm({ patient_id: "", to_specialty: "", priority: "routine", reason: "" });
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Направления</h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">Управление направлениями пациентов</p>
        </div>
        <Button onClick={() => setShowCreate(true)} icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M12 5v14M5 12h14"/></svg>}>
          Создать направление
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[var(--color-muted)] p-1 rounded-xl w-fit">
        {([["incoming", "Входящие"], ["outgoing", "Исходящие"]] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${tab === key ? "bg-[var(--color-surface)] text-foreground shadow-sm" : "text-[var(--color-text-secondary)] hover:text-foreground"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="text-center py-12 text-[var(--color-text-tertiary)]">Загрузка...</div>
      ) : !referrals?.length ? (
        <div className="text-center py-12 text-[var(--color-text-tertiary)]">Нет направлений</div>
      ) : (
        <div className="grid gap-4">
          {referrals.map((r: Referral) => {
            const pr = priorityColors[r.priority] || priorityColors.routine;
            const st = statusColors[r.status] || statusColors.pending;
            return (
              <div key={r.id} className="bg-[var(--color-surface)] rounded-xl border border-border shadow-sm p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-semibold text-foreground">{r.patient_name}</span>
                      <Badge variant={pr.variant}>{pr.label}</Badge>
                      <Badge variant={st.variant} dot>{st.label}</Badge>
                    </div>
                    <div className="text-sm text-[var(--color-text-secondary)] space-y-1">
                      <p>От: <span className="text-foreground">{r.from_doctor_name}</span></p>
                      {r.to_doctor_name && <p>Кому: <span className="text-foreground">{r.to_doctor_name}</span></p>}
                      <p>Специальность: <span className="text-foreground">{r.to_specialty}</span></p>
                      <p className="mt-2">{r.reason}</p>
                    </div>
                    <p className="text-xs text-[var(--color-text-tertiary)] mt-2">
                      {new Date(r.created_at).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}
                    </p>
                  </div>
                  {tab === "incoming" && r.status === "pending" && (
                    <div className="flex gap-2 flex-shrink-0">
                      <Button size="sm" onClick={() => acceptReferral.mutate(r.id)} loading={acceptReferral.isPending}>Принять</Button>
                      <Button size="sm" variant="outline" onClick={() => declineReferral.mutate(r.id)} loading={declineReferral.isPending}>Отклонить</Button>
                    </div>
                  )}
                  {r.status === "accepted" && (
                    <Button size="sm" variant="secondary" onClick={() => completeReferral.mutate(r.id)} loading={completeReferral.isPending}>Завершить</Button>
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
            <h2 className="text-lg font-bold text-foreground mb-4">Новое направление</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">ID пациента</label>
                <input
                  value={form.patient_id}
                  onChange={(e) => setForm({ ...form, patient_id: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="Введите ID пациента"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Специальность</label>
                <input
                  value={form.to_specialty}
                  onChange={(e) => setForm({ ...form, to_specialty: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="Например: Кардиолог"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Приоритет</label>
                <select
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="routine">Плановый</option>
                  <option value="urgent">Срочный</option>
                  <option value="emergency">Экстренный</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Причина</label>
                <textarea
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                  placeholder="Опишите причину направления"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <Button variant="outline" onClick={() => setShowCreate(false)}>Отмена</Button>
              <Button onClick={handleCreate} loading={createReferral.isPending} disabled={!form.patient_id || !form.to_specialty || !form.reason}>
                Создать
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

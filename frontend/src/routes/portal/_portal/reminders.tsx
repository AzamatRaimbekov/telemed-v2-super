import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Pill, Plus, Clock, Trash2, Bell } from "lucide-react";
import portalApiClient from "@/lib/portal-api-client";

export const Route = createFileRoute("/portal/_portal/reminders")({
  component: RemindersPage,
});

function RemindersPage() {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [dosage, setDosage] = useState("");
  const [times, setTimes] = useState(["08:00"]);
  const queryClient = useQueryClient();

  const { data: reminders } = useQuery({
    queryKey: ["portal-reminders"],
    queryFn: async () => {
      const { data } = await portalApiClient.get("/portal/reminders");
      return data;
    },
  });

  const { data: todaySchedule } = useQuery({
    queryKey: ["portal-reminders-today"],
    queryFn: async () => {
      const { data } = await portalApiClient.get("/portal/reminders/today");
      return data;
    },
  });

  const createReminder = useMutation({
    mutationFn: async () => {
      await portalApiClient.post("/portal/reminders", {
        medication_name: name, dosage, frequency: `${times.length} раз в день`, times,
        start_date: new Date().toISOString().split("T")[0],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portal-reminders"] });
      setName(""); setDosage(""); setTimes(["08:00"]); setShowForm(false);
    },
  });

  const deleteReminder = useMutation({
    mutationFn: async (id: string) => { await portalApiClient.delete(`/portal/reminders/${id}`); },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["portal-reminders"] }),
  });

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Напоминания о лекарствах</h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">Не забывайте принимать лекарства вовремя</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="h-9 px-4 rounded-xl bg-[var(--color-secondary)] text-white text-sm font-semibold flex items-center gap-2">
          <Plus size={16} /> Добавить
        </button>
      </div>

      {/* Today's schedule */}
      {todaySchedule?.length > 0 && (
        <div className="bg-[var(--color-primary)]/5 rounded-2xl border border-[var(--color-primary)]/20 p-5">
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3 flex items-center gap-2">
            <Bell size={16} className="text-[var(--color-primary-deep)]" /> Сегодня
          </h2>
          <div className="space-y-2">
            {todaySchedule.map((item: any, i: number) => (
              <div key={i} className="flex items-center gap-3 text-sm">
                <span className="font-mono text-[var(--color-primary-deep)] font-semibold">{item.time}</span>
                <span className="text-[var(--color-text-primary)]">{item.medication_name}</span>
                <span className="text-[var(--color-text-tertiary)]">{item.dosage}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {showForm && (
        <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-6 shadow-sm space-y-4">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Название лекарства"
            className="w-full h-11 px-4 rounded-xl border border-[var(--color-border)] text-sm focus:outline-none focus:border-[var(--color-secondary)]/40" />
          <input value={dosage} onChange={(e) => setDosage(e.target.value)} placeholder="Дозировка (напр. 500мг)"
            className="w-full h-11 px-4 rounded-xl border border-[var(--color-border)] text-sm focus:outline-none focus:border-[var(--color-secondary)]/40" />
          <div>
            <label className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Время приёма</label>
            <div className="flex flex-wrap gap-2 mt-2">
              {times.map((t, i) => (
                <input key={i} type="time" value={t} onChange={(e) => { const n = [...times]; n[i] = e.target.value; setTimes(n); }}
                  className="h-9 px-3 rounded-lg border border-[var(--color-border)] text-sm" />
              ))}
              <button onClick={() => setTimes([...times, "12:00"])} className="h-9 px-3 rounded-lg border border-dashed border-[var(--color-border)] text-xs text-[var(--color-text-tertiary)]">+ Время</button>
            </div>
          </div>
          <button onClick={() => createReminder.mutate()} disabled={!name || createReminder.isPending}
            className="h-10 px-6 rounded-xl bg-[var(--color-secondary)] text-white text-sm font-semibold disabled:opacity-50">Создать</button>
        </div>
      )}

      <div className="space-y-3">
        {!reminders?.length ? (
          <div className="text-center py-12">
            <Pill size={40} className="mx-auto text-[var(--color-text-tertiary)] mb-3" />
            <p className="text-sm text-[var(--color-text-tertiary)]">Нет активных напоминаний</p>
          </div>
        ) : (
          reminders.map((r: any) => (
            <div key={r.id} className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[var(--color-secondary)]/10 flex items-center justify-center">
                  <Pill size={18} className="text-[var(--color-secondary)]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">{r.medication_name}</p>
                  <p className="text-xs text-[var(--color-text-tertiary)]">{r.dosage} · {r.frequency}</p>
                  <div className="flex gap-1 mt-1">
                    {(r.times || []).map((t: string, i: number) => (
                      <span key={i} className="px-2 py-0.5 rounded bg-[var(--color-muted)] text-[10px] font-mono text-[var(--color-text-secondary)]">{t}</span>
                    ))}
                  </div>
                </div>
              </div>
              <button onClick={() => deleteReminder.mutate(r.id)} className="p-2 rounded-lg text-[var(--color-text-tertiary)] hover:text-red-500 hover:bg-red-50 transition-colors">
                <Trash2 size={16} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

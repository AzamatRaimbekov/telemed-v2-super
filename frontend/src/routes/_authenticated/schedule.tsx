import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import apiClient from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { InputField } from "@/components/ui/input-field";
import { CustomSelect } from "@/components/ui/select-custom";
import {
  format,
  startOfWeek,
  addDays,
  addWeeks,
  subWeeks,
  parseISO,
  isSameDay,
  startOfDay,
  differenceInMinutes,
  setHours,
  setMinutes,
} from "date-fns";
import { ru } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/schedule")({
  component: SchedulePage,
});

// ── Types ──────────────────────────────────────────────────────────────────────

interface Appointment {
  id: string;
  patient_id: string;
  patient_name: string;
  doctor_id: string;
  doctor_name: string;
  appointment_type: string;
  status: string;
  scheduled_start: string;
  scheduled_end: string | null;
  actual_start: string | null;
  actual_end: string | null;
  reason: string | null;
  notes: string | null;
  is_walk_in: boolean;
  queue_number: number | null;
  created_at: string;
}

interface Patient {
  id: string;
  first_name: string;
  last_name: string;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const HOUR_START = 8;
const HOUR_END = 20;
const SLOT_HEIGHT = 64; // px per hour

const STATUS_COLORS: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  SCHEDULED:  { bg: "bg-blue-50",   border: "border-blue-300",  text: "text-blue-800",  badge: "primary" },
  CONFIRMED:  { bg: "bg-green-50",  border: "border-green-300", text: "text-green-800", badge: "success" },
  CHECKED_IN: { bg: "bg-teal-50",   border: "border-teal-300",  text: "text-teal-800",  badge: "success" },
  IN_PROGRESS:{ bg: "bg-amber-50",  border: "border-amber-300", text: "text-amber-800", badge: "warning" },
  COMPLETED:  { bg: "bg-gray-50",   border: "border-gray-300",  text: "text-gray-600",  badge: "muted" },
  CANCELLED:  { bg: "bg-red-50",    border: "border-red-200",   text: "text-red-500",   badge: "destructive" },
  NO_SHOW:    { bg: "bg-orange-50", border: "border-orange-300",text: "text-orange-700",badge: "warning" },
};

const STATUS_LABELS: Record<string, string> = {
  SCHEDULED: "Запланировано",
  CONFIRMED: "Подтверждено",
  CHECKED_IN: "Пришёл",
  IN_PROGRESS: "В процессе",
  COMPLETED: "Завершено",
  CANCELLED: "Отменено",
  NO_SHOW: "Не пришёл",
};

const TYPE_LABELS: Record<string, string> = {
  CONSULTATION: "Консультация",
  FOLLOW_UP: "Повторный",
  PROCEDURE: "Процедура",
  TELEMEDICINE: "Телемедицина",
};

const TYPE_ICONS: Record<string, React.ReactNode> = {
  CONSULTATION: (
    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
    </svg>
  ),
  FOLLOW_UP: (
    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.5"/>
    </svg>
  ),
  PROCEDURE: (
    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
    </svg>
  ),
  TELEMEDICINE: (
    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5"/><rect x="2" y="6" width="14" height="12" rx="2"/>
    </svg>
  ),
};

const STATUS_FLOW: Record<string, string[]> = {
  SCHEDULED:  ["CONFIRMED", "CANCELLED"],
  CONFIRMED:  ["CHECKED_IN", "CANCELLED"],
  CHECKED_IN: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS:["COMPLETED", "NO_SHOW"],
  COMPLETED:  [],
  CANCELLED:  [],
  NO_SHOW:    [],
};

// ── API ────────────────────────────────────────────────────────────────────────

const scheduleApi = {
  getAll: (date: string, days: number) =>
    apiClient.get(`/schedule/all?date=${date}&days=${days}`).then((r) => r.data as Appointment[]),
  create: (params: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v) q.set(k, v); });
    return apiClient.post(`/schedule?${q}`).then((r) => r.data as Appointment);
  },
  update: (id: string, params: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v) q.set(k, v); });
    return apiClient.patch(`/schedule/${id}?${q}`).then((r) => r.data as Appointment);
  },
  cancel: (id: string) =>
    apiClient.delete(`/schedule/${id}`).then((r) => r.data),
};

// ── Helper ─────────────────────────────────────────────────────────────────────

function topOffset(date: Date): number {
  const h = date.getHours();
  const m = date.getMinutes();
  return ((h - HOUR_START) + m / 60) * SLOT_HEIGHT;
}

function heightPx(start: Date, end: Date): number {
  const mins = differenceInMinutes(end, start);
  return Math.max((mins / 60) * SLOT_HEIGHT, 28);
}

// ── Create Modal ───────────────────────────────────────────────────────────────

function CreateModal({
  onClose,
  defaultDate,
  defaultHour,
  onCreated,
}: {
  onClose: () => void;
  defaultDate: Date;
  defaultHour: number;
  onCreated: () => void;
}) {
  const qc = useQueryClient();
  const [patientSearch, setPatientSearch] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [type, setType] = useState("CONSULTATION");
  const [dateStr, setDateStr] = useState(format(defaultDate, "yyyy-MM-dd"));
  const [timeStr, setTimeStr] = useState(`${String(defaultHour).padStart(2, "0")}:00`);
  const [duration, setDuration] = useState("30");
  const [reason, setReason] = useState("");

  const { data: patients } = useQuery({
    queryKey: ["patients-search", patientSearch],
    queryFn: () =>
      apiClient
        .get(`/patients?search=${patientSearch}&limit=10`)
        .then((r) => r.data.items as Patient[]),
    enabled: patientSearch.length >= 2,
  });

  const mutation = useMutation({
    mutationFn: () => {
      const start = new Date(`${dateStr}T${timeStr}:00`);
      const end = new Date(start.getTime() + parseInt(duration) * 60 * 1000);
      return scheduleApi.create({
        patient_id: selectedPatient!.id,
        appointment_type: type,
        scheduled_start: start.toISOString(),
        scheduled_end: end.toISOString(),
        reason: reason || undefined,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["schedule"] });
      onCreated();
      onClose();
    },
  });

  const typeOptions = [
    { value: "CONSULTATION", label: "Консультация" },
    { value: "FOLLOW_UP", label: "Повторный" },
    { value: "PROCEDURE", label: "Процедура" },
    { value: "TELEMEDICINE", label: "Телемедицина" },
  ];

  const durationOptions = [
    { value: "15", label: "15 минут" },
    { value: "30", label: "30 минут" },
    { value: "45", label: "45 минут" },
    { value: "60", label: "1 час" },
    { value: "90", label: "1.5 часа" },
    { value: "120", label: "2 часа" },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-[var(--color-surface)] rounded-2xl border border-border shadow-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-foreground">Новый приём</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--color-muted)] text-[var(--color-text-tertiary)] transition-colors">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/></svg>
          </button>
        </div>

        <div className="space-y-4">
          {/* Patient search */}
          <div>
            <label className="text-xs font-medium text-[var(--color-text-secondary)] mb-1.5 block">Пациент</label>
            {selectedPatient ? (
              <div className="flex items-center gap-2 p-3 bg-[var(--color-muted)] rounded-xl">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                  {selectedPatient.last_name[0]}
                </div>
                <span className="text-sm font-medium text-foreground flex-1">
                  {selectedPatient.last_name} {selectedPatient.first_name}
                </span>
                <button onClick={() => setSelectedPatient(null)} className="text-[var(--color-text-tertiary)] hover:text-destructive">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/></svg>
                </button>
              </div>
            ) : (
              <div className="relative">
                <InputField
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                  placeholder="Поиск по ФИО..."
                  icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>}
                />
                {patients && patients.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-[var(--color-surface)] border border-border rounded-xl shadow-lg z-10 overflow-hidden">
                    {patients.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => { setSelectedPatient(p); setPatientSearch(""); }}
                        className="w-full text-left px-4 py-2.5 hover:bg-[var(--color-muted)] text-sm text-foreground transition-colors"
                      >
                        {p.last_name} {p.first_name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Type */}
          <div>
            <label className="text-xs font-medium text-[var(--color-text-secondary)] mb-1.5 block">Тип приёма</label>
            <CustomSelect value={type} onChange={setType} options={typeOptions} />
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-[var(--color-text-secondary)] mb-1.5 block">Дата</label>
              <input
                type="date"
                value={dateStr}
                onChange={(e) => setDateStr(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-border bg-[var(--color-surface)] text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-[var(--color-text-secondary)] mb-1.5 block">Время</label>
              <input
                type="time"
                value={timeStr}
                onChange={(e) => setTimeStr(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-border bg-[var(--color-surface)] text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
          </div>

          {/* Duration */}
          <div>
            <label className="text-xs font-medium text-[var(--color-text-secondary)] mb-1.5 block">Длительность</label>
            <CustomSelect value={duration} onChange={setDuration} options={durationOptions} />
          </div>

          {/* Reason */}
          <div>
            <label className="text-xs font-medium text-[var(--color-text-secondary)] mb-1.5 block">Причина визита</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Необязательно..."
              rows={2}
              className="w-full px-3 py-2 rounded-xl border border-border bg-[var(--color-surface)] text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-5">
          <Button variant="outline" onClick={onClose} className="flex-1">Отмена</Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!selectedPatient || mutation.isPending}
            className="flex-1"
          >
            {mutation.isPending ? "Создание..." : "Создать приём"}
          </Button>
        </div>
        {mutation.isError && (
          <p className="mt-2 text-xs text-destructive text-center">Ошибка при создании</p>
        )}
      </div>
    </div>
  );
}

// ── Detail Modal ────────────────────────────────────────────────────────────────

function DetailModal({
  appointment,
  onClose,
  onUpdated,
}: {
  appointment: Appointment;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const qc = useQueryClient();
  const [notes, setNotes] = useState(appointment.notes ?? "");

  const updateMutation = useMutation({
    mutationFn: (status: string) =>
      scheduleApi.update(appointment.id, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["schedule"] });
      onUpdated();
      onClose();
    },
  });

  const saveNotesMutation = useMutation({
    mutationFn: () =>
      scheduleApi.update(appointment.id, { notes }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["schedule"] });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => scheduleApi.cancel(appointment.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["schedule"] });
      onUpdated();
      onClose();
    },
  });

  const colors = STATUS_COLORS[appointment.status] ?? STATUS_COLORS.SCHEDULED;
  const nextStatuses = STATUS_FLOW[appointment.status] ?? [];
  const start = parseISO(appointment.scheduled_start);
  const end = appointment.scheduled_end ? parseISO(appointment.scheduled_end) : null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-[var(--color-surface)] rounded-2xl border border-border shadow-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-lg ${colors.bg} ${colors.text} border ${colors.border}`}>
                {TYPE_ICONS[appointment.appointment_type]}
                {TYPE_LABELS[appointment.appointment_type] ?? appointment.appointment_type}
              </span>
              <Badge variant={colors.badge as never}>{STATUS_LABELS[appointment.status] ?? appointment.status}</Badge>
            </div>
            <h2 className="text-lg font-semibold text-foreground">{appointment.patient_name || "Пациент"}</h2>
            <p className="text-sm text-[var(--color-text-secondary)]">Врач: {appointment.doctor_name || "—"}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--color-muted)] text-[var(--color-text-tertiary)] transition-colors">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/></svg>
          </button>
        </div>

        {/* Time info */}
        <div className="bg-[var(--color-muted)] rounded-xl p-3 mb-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-[var(--color-text-tertiary)] mb-0.5">Начало</p>
            <p className="font-medium text-foreground">{format(start, "d MMM, HH:mm", { locale: ru })}</p>
          </div>
          {end && (
            <div>
              <p className="text-xs text-[var(--color-text-tertiary)] mb-0.5">Конец</p>
              <p className="font-medium text-foreground">{format(end, "HH:mm", { locale: ru })}</p>
            </div>
          )}
          {appointment.is_walk_in && (
            <div className="col-span-2">
              <span className="text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
                Без записи (walk-in)
              </span>
            </div>
          )}
          {appointment.queue_number && (
            <div>
              <p className="text-xs text-[var(--color-text-tertiary)] mb-0.5">Номер в очереди</p>
              <p className="font-medium text-foreground">#{appointment.queue_number}</p>
            </div>
          )}
        </div>

        {/* Reason */}
        {appointment.reason && (
          <div className="mb-4">
            <p className="text-xs text-[var(--color-text-tertiary)] mb-1">Причина визита</p>
            <p className="text-sm text-foreground">{appointment.reason}</p>
          </div>
        )}

        {/* Notes */}
        <div className="mb-4">
          <label className="text-xs font-medium text-[var(--color-text-secondary)] mb-1.5 block">Заметки врача</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Добавить заметки..."
            rows={3}
            className="w-full px-3 py-2 rounded-xl border border-border bg-[var(--color-surface)] text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
          />
          {notes !== (appointment.notes ?? "") && (
            <button
              onClick={() => saveNotesMutation.mutate()}
              className="mt-1.5 text-xs text-primary hover:underline"
            >
              {saveNotesMutation.isPending ? "Сохранение..." : "Сохранить заметки"}
            </button>
          )}
        </div>

        {/* Actions */}
        {nextStatuses.length > 0 && (
          <div className="space-y-2 mb-3">
            <p className="text-xs font-medium text-[var(--color-text-secondary)]">Изменить статус</p>
            <div className="flex flex-wrap gap-2">
              {nextStatuses.map((s) => {
                const c = STATUS_COLORS[s];
                const isCancel = s === "CANCELLED";
                return (
                  <button
                    key={s}
                    onClick={() => updateMutation.mutate(s)}
                    disabled={updateMutation.isPending}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      isCancel
                        ? "bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
                        : `${c.bg} ${c.text} ${c.border} hover:opacity-80`
                    }`}
                  >
                    → {STATUS_LABELS[s]}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {appointment.status !== "CANCELLED" && appointment.status !== "COMPLETED" && nextStatuses.length === 0 && null}

        {/* Cancel button if still active */}
        {!["CANCELLED", "COMPLETED", "NO_SHOW"].includes(appointment.status) && nextStatuses.length === 0 && (
          <Button
            variant="outline"
            onClick={() => cancelMutation.mutate()}
            disabled={cancelMutation.isPending}
            className="w-full mt-2 text-destructive border-destructive/30 hover:bg-destructive/5"
          >
            Отменить приём
          </Button>
        )}

        <Button variant="outline" onClick={onClose} className="w-full mt-2">Закрыть</Button>
      </div>
    </div>
  );
}

// ── AppointmentBlock ───────────────────────────────────────────────────────────

function AppointmentBlock({
  appt,
  onClick,
}: {
  appt: Appointment;
  onClick: () => void;
}) {
  const colors = STATUS_COLORS[appt.status] ?? STATUS_COLORS.SCHEDULED;
  const start = parseISO(appt.scheduled_start);
  const end = appt.scheduled_end ? parseISO(appt.scheduled_end) : new Date(start.getTime() + 30 * 60 * 1000);
  const top = topOffset(start);
  const h = heightPx(start, end);

  return (
    <button
      onClick={onClick}
      style={{ top, height: h }}
      className={`absolute left-1 right-1 rounded-lg border px-1.5 py-1 text-left overflow-hidden hover:brightness-95 active:scale-[0.98] transition-all cursor-pointer z-10 ${colors.bg} ${colors.border} ${colors.text}`}
    >
      <div className="flex items-center gap-1 mb-0.5">
        <span className="flex-shrink-0">{TYPE_ICONS[appt.appointment_type]}</span>
        {h >= 40 && (
          <span className="text-[10px] font-semibold truncate leading-tight">
            {appt.patient_name || "Пациент"}
          </span>
        )}
      </div>
      {h >= 52 && (
        <p className="text-[9px] opacity-75 truncate">{format(start, "HH:mm")}–{format(end, "HH:mm")}</p>
      )}
    </button>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

function SchedulePage() {
  const qc = useQueryClient();
  const [viewMode, setViewMode] = useState<"week" | "day">("week");
  const [currentWeekStart, setCurrentWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [selectedDay, setSelectedDay] = useState(new Date());
  const [createModal, setCreateModal] = useState<{ date: Date; hour: number } | null>(null);
  const [detailAppt, setDetailAppt] = useState<Appointment | null>(null);

  const dateParam = format(
    viewMode === "week" ? currentWeekStart : startOfDay(selectedDay),
    "yyyy-MM-dd"
  );
  const days = viewMode === "week" ? 7 : 1;

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ["schedule", dateParam, days],
    queryFn: () => scheduleApi.getAll(dateParam, days),
    staleTime: 30_000,
  });

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i)),
    [currentWeekStart]
  );

  const hours = useMemo(
    () => Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i),
    []
  );

  const apptsByDay = useMemo(() => {
    const map: Record<string, Appointment[]> = {};
    appointments.forEach((a) => {
      const key = format(parseISO(a.scheduled_start), "yyyy-MM-dd");
      if (!map[key]) map[key] = [];
      map[key].push(a);
    });
    return map;
  }, [appointments]);

  const todayAppts = useMemo(() => {
    const key = format(selectedDay, "yyyy-MM-dd");
    return apptsByDay[key] ?? [];
  }, [apptsByDay, selectedDay]);

  const totalThisWeek = appointments.length;
  const pendingCount = appointments.filter(
    (a) => !["COMPLETED", "CANCELLED", "NO_SHOW"].includes(a.status)
  ).length;

  function handleSlotClick(day: Date, hour: number) {
    setCreateModal({ date: day, hour });
  }

  // Week grid column
  function DayColumn({ day }: { day: Date }) {
    const key = format(day, "yyyy-MM-dd");
    const dayAppts = apptsByDay[key] ?? [];
    const isToday = isSameDay(day, new Date());

    return (
      <div className="flex-1 relative">
        {/* Hover slots */}
        {hours.map((h) => (
          <div
            key={h}
            style={{ height: SLOT_HEIGHT }}
            onClick={() => handleSlotClick(day, h)}
            className="border-b border-border/40 hover:bg-primary/3 cursor-pointer transition-colors group"
          >
            <div className="hidden group-hover:flex items-center justify-center h-full opacity-40">
              <svg className="w-4 h-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/></svg>
            </div>
          </div>
        ))}
        {/* Appointment blocks */}
        {dayAppts.map((a) => (
          <AppointmentBlock key={a.id} appt={a} onClick={() => setDetailAppt(a)} />
        ))}
        {/* Today indicator */}
        {isToday && (() => {
          const now = new Date();
          if (now.getHours() >= HOUR_START && now.getHours() < HOUR_END) {
            return (
              <div
                style={{ top: topOffset(now) }}
                className="absolute left-0 right-0 z-20 pointer-events-none"
              >
                <div className="relative flex items-center">
                  <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                  <div className="flex-1 h-px bg-red-400" />
                </div>
              </div>
            );
          }
          return null;
        })()}
      </div>
    );
  }

  return (
    <div className="max-w-full">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="animate-float-up">
          <h1 className="text-[26px] font-bold text-foreground tracking-tight">Расписание</h1>
          <p className="text-[var(--color-text-secondary)] text-sm mt-1">
            {totalThisWeek} приёмов за период · {pendingCount} активных
          </p>
        </div>
        <div className="flex items-center gap-2 animate-float-up" style={{ animationDelay: "50ms" }}>
          {/* View toggle */}
          <div className="flex bg-[var(--color-muted)] rounded-xl p-1">
            <button
              onClick={() => setViewMode("week")}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                viewMode === "week"
                  ? "bg-[var(--color-surface)] text-foreground shadow-sm"
                  : "text-[var(--color-text-secondary)] hover:text-foreground"
              }`}
            >
              Неделя
            </button>
            <button
              onClick={() => setViewMode("day")}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                viewMode === "day"
                  ? "bg-[var(--color-surface)] text-foreground shadow-sm"
                  : "text-[var(--color-text-secondary)] hover:text-foreground"
              }`}
            >
              День
            </button>
          </div>

          <Button
            onClick={() => setCreateModal({ date: selectedDay, hour: 9 })}
            className="flex items-center gap-2"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/></svg>
            Новый приём
          </Button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3 mb-5 animate-float-up" style={{ animationDelay: "100ms" }}>
        {[
          { label: "Всего за период", value: totalThisWeek, color: "text-foreground" },
          { label: "Активных", value: pendingCount, color: "text-primary" },
          { label: "Завершено", value: appointments.filter((a) => a.status === "COMPLETED").length, color: "text-success" },
          { label: "Отменено", value: appointments.filter((a) => a.status === "CANCELLED").length, color: "text-destructive" },
        ].map((s) => (
          <div key={s.label} className="bg-[var(--color-surface)] border border-border rounded-2xl p-4">
            <p className="text-xs text-[var(--color-text-tertiary)] mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Calendar */}
      <div className="bg-[var(--color-surface)] border border-border rounded-2xl overflow-hidden animate-float-up" style={{ animationDelay: "150ms" }}>
        {/* Navigation */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <button
            onClick={() => {
              if (viewMode === "week") setCurrentWeekStart((w) => subWeeks(w, 1));
              else setSelectedDay((d) => addDays(d, -1));
            }}
            className="p-2 rounded-xl hover:bg-[var(--color-muted)] text-[var(--color-text-secondary)] hover:text-foreground transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
          </button>

          <div className="text-center">
            {viewMode === "week" ? (
              <span className="text-sm font-semibold text-foreground">
                {format(currentWeekStart, "d MMM", { locale: ru })} –{" "}
                {format(addDays(currentWeekStart, 6), "d MMM yyyy", { locale: ru })}
              </span>
            ) : (
              <span className="text-sm font-semibold text-foreground">
                {format(selectedDay, "EEEE, d MMMM yyyy", { locale: ru })}
              </span>
            )}
          </div>

          <button
            onClick={() => {
              if (viewMode === "week") setCurrentWeekStart((w) => addWeeks(w, 1));
              else setSelectedDay((d) => addDays(d, 1));
            }}
            className="p-2 rounded-xl hover:bg-[var(--color-muted)] text-[var(--color-text-secondary)] hover:text-foreground transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>

        {viewMode === "week" ? (
          <>
            {/* Day headers */}
            <div className="flex border-b border-border">
              <div className="w-14 flex-shrink-0" />
              {weekDays.map((day) => {
                const isToday = isSameDay(day, new Date());
                const key = format(day, "yyyy-MM-dd");
                const count = (apptsByDay[key] ?? []).length;
                return (
                  <div
                    key={day.toISOString()}
                    className="flex-1 py-2 text-center border-l border-border/40 cursor-pointer hover:bg-[var(--color-muted)] transition-colors"
                    onClick={() => { setSelectedDay(day); setViewMode("day"); }}
                  >
                    <p className={`text-xs font-medium ${isToday ? "text-primary" : "text-[var(--color-text-secondary)]"}`}>
                      {format(day, "EEE", { locale: ru }).toUpperCase()}
                    </p>
                    <p className={`text-base font-bold mt-0.5 ${isToday ? "text-primary" : "text-foreground"}`}>
                      {format(day, "d")}
                    </p>
                    {count > 0 && (
                      <span className="text-[10px] font-medium text-[var(--color-text-tertiary)]">{count} приём{count > 1 ? "а" : ""}</span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Time grid */}
            <div className="overflow-y-auto" style={{ maxHeight: "calc(100vh - 360px)" }}>
              {isLoading ? (
                <div className="p-6 flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <div className="flex">
                  {/* Time labels */}
                  <div className="w-14 flex-shrink-0">
                    {hours.map((h) => (
                      <div key={h} style={{ height: SLOT_HEIGHT }} className="flex items-start justify-end pr-2 pt-1">
                        <span className="text-[10px] text-[var(--color-text-tertiary)]">{String(h).padStart(2, "0")}:00</span>
                      </div>
                    ))}
                  </div>
                  {/* Day columns */}
                  {weekDays.map((day) => (
                    <DayColumn key={day.toISOString()} day={day} />
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          /* Day view */
          <div className="overflow-y-auto" style={{ maxHeight: "calc(100vh - 340px)" }}>
            {isLoading ? (
              <div className="p-6 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : todayAppts.length === 0 ? (
              <div className="p-12 text-center">
                <svg className="w-12 h-12 text-[var(--color-text-tertiary)] mx-auto mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/>
                  <line x1="16" x2="16" y1="2" y2="6"/>
                  <line x1="8" x2="8" y1="2" y2="6"/>
                  <line x1="3" x2="21" y1="10" y2="10"/>
                </svg>
                <p className="text-[var(--color-text-secondary)] font-medium">Нет приёмов в этот день</p>
                <p className="text-sm text-[var(--color-text-tertiary)] mt-1">Нажмите «Новый приём», чтобы добавить</p>
              </div>
            ) : (
              <div className="flex">
                <div className="w-14 flex-shrink-0">
                  {hours.map((h) => (
                    <div key={h} style={{ height: SLOT_HEIGHT }} className="flex items-start justify-end pr-2 pt-1">
                      <span className="text-[10px] text-[var(--color-text-tertiary)]">{String(h).padStart(2, "0")}:00</span>
                    </div>
                  ))}
                </div>
                <div className="flex-1 relative">
                  {hours.map((h) => (
                    <div
                      key={h}
                      style={{ height: SLOT_HEIGHT }}
                      onClick={() => handleSlotClick(selectedDay, h)}
                      className="border-b border-border/40 hover:bg-primary/3 cursor-pointer transition-colors"
                    />
                  ))}
                  {todayAppts.map((a) => (
                    <AppointmentBlock key={a.id} appt={a} onClick={() => setDetailAppt(a)} />
                  ))}
                  {/* Today line */}
                  {isSameDay(selectedDay, new Date()) && (() => {
                    const now = new Date();
                    if (now.getHours() >= HOUR_START && now.getHours() < HOUR_END) {
                      return (
                        <div style={{ top: topOffset(now) }} className="absolute left-0 right-0 z-20 pointer-events-none">
                          <div className="relative flex items-center">
                            <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                            <div className="flex-1 h-px bg-red-400" />
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-4 animate-float-up" style={{ animationDelay: "200ms" }}>
        {Object.entries(STATUS_LABELS).map(([status, label]) => {
          const c = STATUS_COLORS[status];
          return (
            <span key={status} className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border ${c.bg} ${c.text} ${c.border}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${c.bg.replace("bg-", "bg-").replace("-50", "-400")}`} />
              {label}
            </span>
          );
        })}
      </div>

      {/* Modals */}
      {createModal && (
        <CreateModal
          defaultDate={createModal.date}
          defaultHour={createModal.hour}
          onClose={() => setCreateModal(null)}
          onCreated={() => qc.invalidateQueries({ queryKey: ["schedule"] })}
        />
      )}
      {detailAppt && (
        <DetailModal
          appointment={detailAppt}
          onClose={() => setDetailAppt(null)}
          onUpdated={() => qc.invalidateQueries({ queryKey: ["schedule"] })}
        />
      )}
    </div>
  );
}

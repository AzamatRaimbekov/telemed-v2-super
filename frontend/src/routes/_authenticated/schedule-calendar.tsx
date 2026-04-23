import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, DragEvent } from "react";
import { useCalendarEvents, useCalendarDoctors, useReschedule } from "@/features/schedule/calendar-api";

export const Route = createFileRoute("/_authenticated/schedule-calendar")({
  component: ScheduleCalendarPage,
});

const DAYS_RU = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const TIME_SLOTS: string[] = [];
for (let h = 8; h <= 17; h++) {
  TIME_SLOTS.push(`${String(h).padStart(2, "0")}:00`);
  TIME_SLOTS.push(`${String(h).padStart(2, "0")}:30`);
}

const STATUS_COLORS: Record<string, string> = {
  SCHEDULED: "bg-blue-100 border-blue-300 text-blue-800",
  CONFIRMED: "bg-blue-200 border-blue-400 text-blue-900",
  CHECKED_IN: "bg-indigo-100 border-indigo-300 text-indigo-800",
  IN_PROGRESS: "bg-yellow-100 border-yellow-300 text-yellow-800",
  COMPLETED: "bg-green-100 border-green-300 text-green-800",
  CANCELLED: "bg-gray-100 border-gray-300 text-gray-500",
  NO_SHOW: "bg-red-100 border-red-300 text-red-800",
};

function getMonday(d: Date): Date {
  const copy = new Date(d);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

function ScheduleCalendarPage() {
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const [doctorFilter, setDoctorFilter] = useState<string>("");
  const [mobileDay, setMobileDay] = useState(0);

  const weekDates = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [weekStart]);

  const dateFrom = formatDate(weekDates[0]);
  const dateTo = formatDate(weekDates[6]);

  const { data: events = [] } = useCalendarEvents({
    doctor_id: doctorFilter || undefined,
    date_from: dateFrom,
    date_to: dateTo,
  });

  const { data: doctors = [] } = useCalendarDoctors();
  const reschedule = useReschedule();

  const prevWeek = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() - 7);
    setWeekStart(d);
  };
  const nextWeek = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    setWeekStart(d);
  };
  const thisWeek = () => setWeekStart(getMonday(new Date()));

  const eventMap = useMemo(() => {
    const map: Record<string, typeof events> = {};
    for (const ev of events) {
      if (!ev.start) continue;
      const d = ev.start.split("T")[0];
      const time = ev.start.split("T")[1]?.substring(0, 5);
      const key = `${d}_${time}`;
      if (!map[key]) map[key] = [];
      map[key].push(ev);
    }
    return map;
  }, [events]);

  const handleDragStart = (e: DragEvent, eventId: string) => {
    e.dataTransfer.setData("text/plain", eventId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDrop = (e: DragEvent, date: string, time: string) => {
    e.preventDefault();
    const eventId = e.dataTransfer.getData("text/plain");
    if (!eventId) return;
    reschedule.mutate({ id: eventId, new_date: date, new_time: time });
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Календарь расписания</h1>
        <div className="flex items-center gap-2">
          <select
            value={doctorFilter}
            onChange={(e) => setDoctorFilter(e.target.value)}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm text-[var(--color-text-primary)]"
          >
            <option value="">Все врачи</option>
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Week navigation */}
      <div className="flex items-center justify-between bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] px-4 py-2.5 shadow-sm">
        <button onClick={prevWeek} className="px-3 py-1 rounded-lg hover:bg-[var(--color-hover)] text-sm font-medium text-[var(--color-text-secondary)]">
          &larr; Пред
        </button>
        <button onClick={thisWeek} className="px-3 py-1 rounded-lg hover:bg-[var(--color-hover)] text-sm font-medium text-[var(--color-primary)]">
          Текущая неделя
        </button>
        <button onClick={nextWeek} className="px-3 py-1 rounded-lg hover:bg-[var(--color-hover)] text-sm font-medium text-[var(--color-text-secondary)]">
          След &rarr;
        </button>
      </div>

      {/* Mobile day selector */}
      <div className="flex sm:hidden overflow-x-auto gap-1.5 pb-1">
        {weekDates.map((d, i) => (
          <button
            key={i}
            onClick={() => setMobileDay(i)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              mobileDay === i
                ? "bg-[var(--color-primary)] text-white"
                : "bg-[var(--color-surface)] text-[var(--color-text-secondary)] border border-[var(--color-border)]"
            }`}
          >
            {DAYS_RU[i]} {d.getDate()}
          </button>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] shadow-sm overflow-auto">
        <table className="w-full border-collapse min-w-[700px]">
          <thead>
            <tr>
              <th className="w-16 p-2 text-xs font-medium text-[var(--color-text-tertiary)] border-b border-r border-[var(--color-border)]">Время</th>
              {weekDates.map((d, i) => (
                <th
                  key={i}
                  className={`p-2 text-xs font-medium border-b border-r border-[var(--color-border)] last:border-r-0 ${
                    formatDate(d) === formatDate(new Date()) ? "bg-blue-50 text-blue-700" : "text-[var(--color-text-secondary)]"
                  } ${i !== mobileDay ? "hidden sm:table-cell" : "sm:table-cell"}`}
                >
                  {DAYS_RU[i]} {d.getDate()}.{String(d.getMonth() + 1).padStart(2, "0")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TIME_SLOTS.map((slot) => (
              <tr key={slot} className="hover:bg-[var(--color-hover)] transition-colors">
                <td className="p-1.5 text-[10px] font-mono text-[var(--color-text-tertiary)] border-r border-b border-[var(--color-border)] text-center whitespace-nowrap">
                  {slot}
                </td>
                {weekDates.map((d, i) => {
                  const dateStr = formatDate(d);
                  const key = `${dateStr}_${slot}`;
                  const cellEvents = eventMap[key] || [];
                  return (
                    <td
                      key={i}
                      className={`p-0.5 border-r border-b border-[var(--color-border)] last:border-r-0 h-8 align-top ${
                        i !== mobileDay ? "hidden sm:table-cell" : "sm:table-cell"
                      }`}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, dateStr, slot)}
                    >
                      {cellEvents.map((ev) => (
                        <div
                          key={ev.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, ev.id)}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-medium border cursor-grab active:cursor-grabbing truncate ${STATUS_COLORS[ev.status] || STATUS_COLORS.SCHEDULED}`}
                          title={`${ev.title} (${ev.status})`}
                        >
                          {ev.title}
                        </div>
                      ))}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-[10px]">
        {Object.entries(STATUS_COLORS).map(([status, cls]) => (
          <span key={status} className={`px-2 py-0.5 rounded border ${cls}`}>{status}</span>
        ))}
      </div>
    </div>
  );
}

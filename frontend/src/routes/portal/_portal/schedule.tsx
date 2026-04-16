import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { portalApi } from "@/features/portal/api";
import { useState, useMemo, useEffect } from "react";
import {
  format,
  addDays,
  subDays,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  isSameDay,
  isSameMonth,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  eachDayOfInterval,
  parseISO,
  isToday,
} from "date-fns";
import { ru } from "date-fns/locale";

export const Route = createFileRoute("/portal/_portal/schedule")({
  component: SchedulePage,
});

// ---------- types ----------

interface ScheduleEvent {
  id: string;
  title: string;
  type: string;
  scheduled_at: string; // ISO datetime
  duration_minutes?: number;
  location?: string;
  doctor_name?: string;
  notes?: string;
  status?: string;
}

type ViewMode = "day" | "week" | "month";

// ---------- constants ----------

const EVENT_COLORS: Record<string, string> = {
  medication: "#22C55E",
  procedure: "#3B82F6",
  lab: "#F59E0B",
  exercise: "#7E78D2",
  consultation: "#14B8A6",
  telemedicine: "#8B5CF6",
};

const EVENT_LABELS: Record<string, string> = {
  medication: "Лекарство",
  procedure: "Процедура",
  lab: "Анализ",
  exercise: "Упражнение",
  consultation: "Консультация",
  telemedicine: "Телемедицина",
};

const HOURS = Array.from({ length: 17 }, (_, i) => i + 6); // 6:00 – 22:00
const DAY_NAMES = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

// ---------- helpers ----------

function eventsForDay(events: ScheduleEvent[], date: Date): ScheduleEvent[] {
  return events.filter((e) => e.scheduled_at && isSameDay(parseISO(e.scheduled_at), date));
}

function eventTopPct(event: ScheduleEvent): number {
  if (!event.scheduled_at) return 0;
  const d = parseISO(event.scheduled_at);
  const minutesSince6 = (d.getHours() - 6) * 60 + d.getMinutes();
  return (minutesSince6 / (16 * 60)) * 100;
}

function eventHeightPct(event: ScheduleEvent): number {
  const durationMins = event.duration_minutes ?? 30;
  return (Math.max(durationMins, 20) / (16 * 60)) * 100;
}

function nowTopPct(): number {
  const now = new Date();
  const minutesSince6 = (now.getHours() - 6) * 60 + now.getMinutes();
  return (minutesSince6 / (16 * 60)) * 100;
}

// ---------- event popup ----------

function EventPopup({ event, onClose }: { event: ScheduleEvent; onClose: () => void }) {
  const color = EVENT_COLORS[event.type] || "#7E78D2";

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-[var(--color-surface)] rounded-2xl border border-border w-full max-w-sm p-5 shadow-xl animate-float-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: color }} />
            <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: `${color}18`, color }}>
              {EVENT_LABELS[event.type] || event.type}
            </span>
          </div>
          <button onClick={onClose} className="text-[var(--color-text-tertiary)] hover:text-foreground transition-colors">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <h3 className="text-base font-semibold text-foreground mb-3">{event.title}</h3>
        <div className="space-y-2 text-sm">
          <div className="flex gap-2">
            <svg className="w-4 h-4 text-[var(--color-text-tertiary)] mt-0.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <span className="text-[var(--color-text-secondary)]">
              {event.scheduled_at ? format(parseISO(event.scheduled_at), "HH:mm") : "—"}
              {event.scheduled_at && event.duration_minutes ? ` — ${format(new Date(parseISO(event.scheduled_at).getTime() + event.duration_minutes * 60000), "HH:mm")}` : ""}
            </span>
          </div>
          {event.location && (
            <div className="flex gap-2">
              <svg className="w-4 h-4 text-[var(--color-text-tertiary)] mt-0.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
              <span className="text-[var(--color-text-secondary)]">{event.location}</span>
            </div>
          )}
          {event.doctor_name && (
            <div className="flex gap-2">
              <svg className="w-4 h-4 text-[var(--color-text-tertiary)] mt-0.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              <span className="text-[var(--color-text-secondary)]">{event.doctor_name}</span>
            </div>
          )}
          {event.notes && (
            <p className="text-[var(--color-text-secondary)] pl-6">{event.notes}</p>
          )}
          {event.status && (
            <div className="pt-1">
              <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-muted)] text-[var(--color-text-secondary)]">
                {event.status}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- day view ----------

function DayView({ date, events }: { date: Date; events: ScheduleEvent[] }) {
  const [selectedEvent, setSelectedEvent] = useState<ScheduleEvent | null>(null);
  const dayEvents = eventsForDay(events, date);
  const nowPct = nowTopPct();
  const showNow = isToday(date) && new Date().getHours() >= 6 && new Date().getHours() <= 22;

  return (
    <>
      {selectedEvent && <EventPopup event={selectedEvent} onClose={() => setSelectedEvent(null)} />}
      <div className="relative flex">
        {/* Hour labels */}
        <div className="w-12 flex-shrink-0">
          {HOURS.map((h) => (
            <div key={h} className="h-16 flex items-start justify-end pr-2 pt-0.5">
              <span className="text-xs text-[var(--color-text-tertiary)]">{String(h).padStart(2, "0")}:00</span>
            </div>
          ))}
        </div>

        {/* Timeline */}
        <div className="flex-1 relative border-l border-border">
          {/* Hour lines */}
          {HOURS.map((h) => (
            <div key={h} className="h-16 border-b border-border/50" />
          ))}

          {/* Now line */}
          {showNow && (
            <div
              className="absolute left-0 right-0 flex items-center pointer-events-none z-10"
              style={{ top: `${nowPct}%` }}
            >
              <div className="w-2.5 h-2.5 rounded-full bg-destructive -ml-1.5 flex-shrink-0" />
              <div className="flex-1 h-px bg-destructive" />
            </div>
          )}

          {/* Events */}
          {dayEvents.map((event) => {
            const color = EVENT_COLORS[event.type] || "#7E78D2";
            const top = eventTopPct(event);
            const height = eventHeightPct(event);
            return (
              <button
                key={event.id}
                className="absolute left-1 right-1 rounded-lg px-2 py-1 text-left overflow-hidden hover:brightness-95 transition-all border"
                style={{
                  top: `${top}%`,
                  height: `${height}%`,
                  minHeight: "28px",
                  background: `${color}18`,
                  borderColor: `${color}40`,
                  color,
                }}
                onClick={() => setSelectedEvent(event)}
              >
                <p className="text-xs font-semibold truncate">{event.title}</p>
                <p className="text-[10px] opacity-80">{event.scheduled_at ? format(parseISO(event.scheduled_at), "HH:mm") : ""}</p>
              </button>
            );
          })}

          {dayEvents.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <p className="text-sm text-[var(--color-text-tertiary)]">Нет событий</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ---------- week view ----------

function WeekView({ date, events, onDayClick }: { date: Date; events: ScheduleEvent[]; onDayClick: (d: Date) => void }) {
  const [selectedEvent, setSelectedEvent] = useState<ScheduleEvent | null>(null);
  const weekStart = startOfWeek(date, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <>
      {selectedEvent && <EventPopup event={selectedEvent} onClose={() => setSelectedEvent(null)} />}
      <div className="overflow-x-auto">
        <div className="min-w-[480px]">
          {/* Day headers */}
          <div className="flex border-b border-border">
            <div className="w-12 flex-shrink-0" />
            {weekDays.map((day, i) => (
              <button
                key={i}
                className={`flex-1 py-2 text-center hover:bg-[var(--color-muted)]/50 transition-colors ${isToday(day) ? "bg-secondary/10" : ""}`}
                onClick={() => onDayClick(day)}
              >
                <p className="text-xs text-[var(--color-text-tertiary)]">{DAY_NAMES[i]}</p>
                <p className={`text-sm font-semibold mt-0.5 ${isToday(day) ? "text-secondary" : "text-foreground"}`}>
                  {format(day, "d")}
                </p>
              </button>
            ))}
          </div>

          {/* Hour grid */}
          <div className="relative flex">
            {/* Hour labels */}
            <div className="w-12 flex-shrink-0">
              {HOURS.map((h) => (
                <div key={h} className="h-10 flex items-start justify-end pr-2 pt-0.5">
                  <span className="text-[10px] text-[var(--color-text-tertiary)]">{String(h).padStart(2, "0")}</span>
                </div>
              ))}
            </div>

            {/* Day columns */}
            {weekDays.map((day, dayIdx) => {
              const dayEvents = eventsForDay(events, day);
              const showNow = isToday(day) && new Date().getHours() >= 6;

              return (
                <div key={dayIdx} className={`flex-1 relative border-l border-border ${isToday(day) ? "bg-secondary/5" : ""}`}>
                  {HOURS.map((h) => (
                    <div key={h} className="h-10 border-b border-border/30" />
                  ))}

                  {/* Now line */}
                  {showNow && (
                    <div
                      className="absolute left-0 right-0 h-px bg-destructive pointer-events-none z-10"
                      style={{ top: `${nowTopPct()}%` }}
                    />
                  )}

                  {/* Event dots */}
                  {dayEvents.map((event) => {
                    const color = EVENT_COLORS[event.type] || "#7E78D2";
                    const top = eventTopPct(event);
                    return (
                      <button
                        key={event.id}
                        className="absolute left-0.5 right-0.5 rounded px-1 text-left overflow-hidden"
                        style={{
                          top: `${top}%`,
                          height: "18px",
                          background: `${color}25`,
                          borderLeft: `2px solid ${color}`,
                        }}
                        onClick={() => setSelectedEvent(event)}
                        title={event.title}
                      >
                        <p className="text-[9px] font-medium truncate leading-tight" style={{ color }}>
                          {event.title}
                        </p>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

// ---------- month view ----------

function MonthView({ date, events, onDayClick }: { date: Date; events: ScheduleEvent[]; onDayClick: (d: Date) => void }) {
  const monthStart = startOfMonth(date);
  const monthEnd = endOfMonth(date);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  return (
    <div>
      {/* Day name headers */}
      <div className="grid grid-cols-7 border-b border-border">
        {DAY_NAMES.map((name) => (
          <div key={name} className="py-2 text-center text-xs font-medium text-[var(--color-text-tertiary)]">
            {name}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {days.map((day, idx) => {
          const dayEvents = eventsForDay(events, day);
          const inMonth = isSameMonth(day, date);
          const isCurrentDay = isToday(day);

          return (
            <button
              key={idx}
              className={`min-h-[64px] p-1 border-b border-r border-border text-left hover:bg-[var(--color-muted)]/40 transition-colors ${!inMonth ? "opacity-40" : ""} ${isCurrentDay ? "bg-secondary/10" : ""}`}
              onClick={() => onDayClick(day)}
            >
              <span
                className={`inline-flex w-6 h-6 items-center justify-center rounded-full text-xs font-medium mb-1 ${isCurrentDay ? "bg-secondary text-white" : "text-foreground"}`}
              >
                {format(day, "d")}
              </span>
              {dayEvents.slice(0, 3).map((event) => {
                const color = EVENT_COLORS[event.type] || "#7E78D2";
                return (
                  <div
                    key={event.id}
                    className="text-[9px] rounded px-1 truncate mb-0.5"
                    style={{ background: `${color}20`, color }}
                  >
                    {event.title}
                  </div>
                );
              })}
              {dayEvents.length > 3 && (
                <div className="text-[9px] text-[var(--color-text-tertiary)]">+{dayEvents.length - 3}</div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------- legend ----------

function Legend() {
  return (
    <div className="flex flex-wrap gap-3">
      {Object.entries(EVENT_LABELS).map(([type, label]) => (
        <div key={type} className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: EVENT_COLORS[type] }} />
          <span className="text-xs text-[var(--color-text-secondary)]">{label}</span>
        </div>
      ))}
    </div>
  );
}

// ---------- main component ----------

function SchedulePage() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("day");
  const [, setTick] = useState(0);

  // Re-render every minute so the now-line position stays current
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(id);
  }, []);

  // Compute query date range based on view
  const { from, to } = useMemo(() => {
    if (viewMode === "day") {
      return {
        from: format(selectedDate, "yyyy-MM-dd"),
        to: format(selectedDate, "yyyy-MM-dd"),
      };
    }
    if (viewMode === "week") {
      const ws = startOfWeek(selectedDate, { weekStartsOn: 1 });
      const we = endOfWeek(selectedDate, { weekStartsOn: 1 });
      return { from: format(ws, "yyyy-MM-dd"), to: format(we, "yyyy-MM-dd") };
    }
    // month
    const ms = startOfMonth(selectedDate);
    const me = endOfMonth(selectedDate);
    return { from: format(ms, "yyyy-MM-dd"), to: format(me, "yyyy-MM-dd") };
  }, [selectedDate, viewMode]);

  const { data, isLoading } = useQuery({
    queryKey: ["portal-schedule", from, to],
    queryFn: () => portalApi.getSchedule(from, to),
    retry: false,
  });

  const events: ScheduleEvent[] = (data as ScheduleEvent[] || []);

  function navigate(direction: "prev" | "next") {
    if (viewMode === "day") {
      setSelectedDate((d) => direction === "prev" ? subDays(d, 1) : addDays(d, 1));
    } else if (viewMode === "week") {
      setSelectedDate((d) => direction === "prev" ? subWeeks(d, 1) : addWeeks(d, 1));
    } else {
      setSelectedDate((d) => direction === "prev" ? subMonths(d, 1) : addMonths(d, 1));
    }
  }

  function formatHeaderDate(): string {
    if (viewMode === "day") {
      return format(selectedDate, "d MMMM yyyy", { locale: ru });
    }
    if (viewMode === "week") {
      const ws = startOfWeek(selectedDate, { weekStartsOn: 1 });
      const we = endOfWeek(selectedDate, { weekStartsOn: 1 });
      if (isSameMonth(ws, we)) {
        return `${format(ws, "d")} – ${format(we, "d MMMM yyyy", { locale: ru })}`;
      }
      return `${format(ws, "d MMM", { locale: ru })} – ${format(we, "d MMM yyyy", { locale: ru })}`;
    }
    return format(selectedDate, "LLLL yyyy", { locale: ru });
  }

  return (
    <div className="max-w-4xl space-y-4">
      {/* Header */}
      <div className="animate-float-up" style={{ animationDelay: "0ms" }}>
        <h1 className="text-[24px] font-bold text-foreground tracking-tight">Расписание</h1>
        <p className="text-[var(--color-text-secondary)] mt-1">Ваши события и визиты</p>
      </div>

      {/* Controls */}
      <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-4 animate-float-up" style={{ animationDelay: "60ms" }}>
        <div className="flex flex-wrap items-center gap-3">
          {/* View mode toggle */}
          <div className="flex gap-1 p-1 bg-[var(--color-muted)] rounded-xl">
            {(["day", "week", "month"] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${viewMode === mode ? "bg-[var(--color-surface)] text-foreground shadow-sm" : "text-[var(--color-text-secondary)] hover:text-foreground"}`}
              >
                {mode === "day" ? "День" : mode === "week" ? "Неделя" : "Месяц"}
              </button>
            ))}
          </div>

          {/* Date navigation */}
          <div className="flex items-center gap-2 flex-1">
            <button
              onClick={() => navigate("prev")}
              className="p-2 rounded-xl border border-border hover:bg-[var(--color-muted)] transition-colors"
            >
              <svg className="w-4 h-4 text-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <span className="text-sm font-semibold text-foreground flex-1 text-center capitalize">
              {formatHeaderDate()}
            </span>
            <button
              onClick={() => navigate("next")}
              className="p-2 rounded-xl border border-border hover:bg-[var(--color-muted)] transition-colors"
            >
              <svg className="w-4 h-4 text-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>

          {/* Today button */}
          {!isToday(selectedDate) && (
            <button
              onClick={() => setSelectedDate(new Date())}
              className="px-3 py-1.5 rounded-xl border border-secondary text-secondary text-xs font-medium hover:bg-secondary/10 transition-colors"
            >
              Сегодня
            </button>
          )}
        </div>
      </div>

      {/* Calendar body */}
      <div className="bg-[var(--color-surface)] rounded-2xl border border-border overflow-hidden animate-float-up" style={{ animationDelay: "120ms" }}>
        {isLoading ? (
          <div className="p-8 space-y-3 animate-pulse">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 bg-[var(--color-muted)] rounded-xl" />
            ))}
          </div>
        ) : viewMode === "day" ? (
          <div className="overflow-y-auto max-h-[600px]">
            <DayView date={selectedDate} events={events} />
          </div>
        ) : viewMode === "week" ? (
          <div className="overflow-y-auto max-h-[600px]">
            <WeekView
              date={selectedDate}
              events={events}
              onDayClick={(d) => { setSelectedDate(d); setViewMode("day"); }}
            />
          </div>
        ) : (
          <MonthView
            date={selectedDate}
            events={events}
            onDayClick={(d) => { setSelectedDate(d); setViewMode("day"); }}
          />
        )}
      </div>

      {/* Legend */}
      <div className="animate-float-up" style={{ animationDelay: "180ms" }}>
        <Legend />
      </div>
    </div>
  );
}

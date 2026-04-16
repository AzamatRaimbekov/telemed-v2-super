import { type ReactNode, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { usePortalAuthStore } from "@/stores/portal-auth-store";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { portalApi } from "@/features/portal/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/portal/_portal/dashboard")({
  component: PortalDashboard,
});

// ─── Helpers ────────────────────────────────────────────────────────────────

function greet(): string {
  const h = new Date().getHours();
  if (h < 12) return "Доброе утро";
  if (h < 18) return "Добрый день";
  return "Добрый вечер";
}

function fmtTime(v: string | null | undefined): string {
  if (!v) return "";
  if (/^\d{2}:\d{2}/.test(v)) return v.slice(0, 5);
  const d = new Date(v);
  return isNaN(d.getTime()) ? v : d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

function timeUntil(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return "Сейчас";
  const m = Math.floor(diff / 60000);
  const h = Math.floor(m / 60);
  return h > 0 ? `Через ${h} ч ${m % 60 > 0 ? `${m % 60} мин` : ""}`.trim() : `Через ${m} мин`;
}

// ─── Icons (compact) ────────────────────────────────────────────────────────

function Ic({ d, cls = "w-4 h-4" }: { d: string; cls?: string }) {
  return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>;
}

const PillIc    = () => <Ic d="M10.5 20H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h4l8 8v8a2 2 0 0 1-2 2z" />;
const PulseIc   = () => <Ic d="M22 12h-4l-3 9L9 3l-3 9H2" />;
const ProcIc    = () => <><svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/></svg></>;
const LabIc     = () => <><svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2v6a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V2"/><path d="M10 2v3.3a4 4 0 0 1-1.17 2.83L4 13v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6l-4.83-4.87A4 4 0 0 1 14 5.3V2"/></svg></>;
const CalIc     = () => <><svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="18" height="18" x="3" y="4" rx="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg></>;
const ChkIc     = () => <Ic d="M5 13l4 4L19 7" cls="w-4 h-4" />;
const MsgIc     = () => <Ic d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />;
const DolIc     = () => <><svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></>;
const DocIc     = () => <><svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/><path d="M12 11v4M10 13h4"/></svg></>;
const PlayIc    = () => <><svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg></>;
const TreatIc   = () => <Ic d="M9 11H3v4h6v4h4v-4h6v-4h-6V7H9z" />;

// ─── Constants ──────────────────────────────────────────────────────────────

type Item = Record<string, unknown>;

const TC: Record<string, string> = {
  MEDICATION: "#22C55E", PROCEDURE: "#3B82F6", LAB_TEST: "#F59E0B", EXERCISE: "#14B8A6", THERAPY: "#7E78D2",
};

function tIcon(t: string) {
  if (t === "MEDICATION") return <PillIc />;
  if (t === "EXERCISE") return <PulseIc />;
  if (t === "LAB_TEST") return <LabIc />;
  return <ProcIc />;
}

function iName(i: Item): string { return (i.drug_name ?? i.exercise_name ?? i.title ?? "Задача") as string; }

function iDetail(i: Item): string {
  const t = i.type as string;
  if (t === "MEDICATION") return [i.dosage, i.route].filter(Boolean).join(", ") || "";
  if (t === "EXERCISE") { const s = i.sets as number | undefined; const r = (i.reps ?? i.repetitions) as number | undefined; return s && r ? `${s}×${r}` : ""; }
  if (t === "PROCEDURE" || t === "THERAPY") { const tm = fmtTime(i.scheduled_time as string | undefined); return tm ? `в ${tm}` : ""; }
  return "";
}

// ─── Main ───────────────────────────────────────────────────────────────────

function PortalDashboard() {
  const patient = usePortalAuthStore((s) => s.patient);
  const qc = useQueryClient();
  const [cId, setCId] = useState<string | null>(null);

  const { data: todayRaw, isLoading: l1 } = useQuery({ queryKey: ["portal-today"], queryFn: portalApi.getTodayTreatment, retry: 1 });
  const { data: apptRaw, isLoading: l2 } = useQuery({ queryKey: ["portal-appointments"], queryFn: portalApi.getAppointments, retry: 1 });
  const { data: progRaw } = useQuery({ queryKey: ["portal-progress"], queryFn: portalApi.getProgress, retry: 1 });
  const { data: plansRaw } = useQuery({ queryKey: ["portal-treatment-plans"], queryFn: portalApi.getTreatmentPlans, retry: 1 });

  const cm = useMutation({
    mutationFn: (id: string) => portalApi.confirmPrescription(id),
    onMutate: (id) => setCId(id),
    onSuccess: () => { toast.success("Принято"); qc.invalidateQueries({ queryKey: ["portal-today"] }); },
    onError: () => toast.error("Ошибка"),
    onSettled: () => setCId(null),
  });

  const list: Item[] = (todayRaw as Item[] | undefined) ?? [];
  const pending = list.filter((i) => i.status !== "COMPLETED");
  const next: Item | null = pending[0] ?? null;
  const done = list.length - pending.length;

  const appts: Item[] = (apptRaw as Item[] | undefined) ?? [];
  const todayStr = new Date().toDateString();
  const todayAppt = appts.find((a) => a.scheduled_start && new Date(a.scheduled_start as string).toDateString() === todayStr && (a.status === "SCHEDULED" || a.status === "CONFIRMED")) ?? null;
  const nextAppt = appts.find((a) => a.scheduled_start && new Date(a.scheduled_start as string).getTime() > Date.now() && (a.status === "SCHEDULED" || a.status === "CONFIRMED")) ?? null;

  const plans: Item[] = (plansRaw as Item[] | undefined) ?? [];
  const doctorName = (plans.find((p) => p.status === "ACTIVE")?.doctor_name) as string | undefined;

  const pr = progRaw as Record<string, unknown> | undefined;
  const sess = String((pr?.weekly_sessions ?? pr?.sessions_this_week ?? 0) as number);
  const acc = (pr?.average_accuracy ?? pr?.avg_accuracy ?? 0) as number;
  const strk = String((pr?.streak_days ?? pr?.streak ?? 0) as number);

  const loading = l1 || l2;

  return (
    <div className="space-y-2.5 max-w-2xl mx-auto">
      {/* ROW 1: Greeting */}
      <div className="bg-[var(--color-surface)] rounded-xl border border-border px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-foreground truncate">{greet()}{patient?.first_name ? `, ${patient.first_name}` : ""}</h1>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {patient?.blood_type && <Badge variant="destructive" className="text-[11px] px-1.5 py-0">{patient.blood_type}</Badge>}
              {patient?.status === "ACTIVE" && <Badge variant="success" className="text-[11px] px-1.5 py-0">Стационар</Badge>}
            </div>
          </div>
        </div>
      </div>

      {/* ROW 2: Stats */}
      <div className="grid grid-cols-3 gap-2">
        <Stat icon={<PulseIc />} value={sess} label="тренировок" />
        <Stat icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>} value={acc > 0 ? `${Math.round(acc)}%` : "—"} label="точность" />
        <Stat icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>} value={strk} label="дней подряд" />
      </div>

      {/* ROW 3: Hero action */}
      {loading ? (
        <div className="h-12 bg-[var(--color-surface)] rounded-xl border border-border animate-pulse" />
      ) : next ? (
        <HeroCard item={next} onConfirm={(id) => cm.mutate(id)} confirming={cId === ((next.prescription_id ?? next.id) as string)} />
      ) : todayAppt ? (
        <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-secondary/30 bg-secondary/5">
          <span className="text-secondary"><CalIc /></span>
          <p className="text-sm font-semibold text-foreground flex-1 truncate">
            Приём — {(todayAppt.doctor_name ?? "Врач") as string}{fmtTime(todayAppt.scheduled_start as string) ? ` в ${fmtTime(todayAppt.scheduled_start as string)}` : ""}
          </p>
        </div>
      ) : (
        <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-success/30 bg-success/5">
          <span className="text-success"><ChkIc /></span>
          <p className="text-sm font-semibold text-foreground">На сегодня всё выполнено</p>
        </div>
      )}

      {/* ROW 4: Today checklist */}
      <div className="bg-[var(--color-surface)] rounded-xl border border-border">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">На сегодня</h2>
          {list.length > 0 && <span className="text-xs text-[var(--color-text-secondary)]">{done}/{list.length}</span>}
        </div>
        <div className="max-h-[200px] sm:max-h-[280px] overflow-y-auto">
          {loading ? (
            <div className="p-3 space-y-2">{[0,1,2].map(i => <div key={i} className="h-10 bg-[var(--color-muted)] rounded-lg animate-pulse" />)}</div>
          ) : list.length === 0 ? (
            <div className="py-8 text-center">
              <span className="text-[var(--color-text-tertiary)]"><ChkIc /></span>
              <p className="text-xs text-[var(--color-text-secondary)] mt-2">Нет задач на сегодня</p>
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {list.map((item) => (
                <TaskRow key={item.id as string} item={item} onConfirm={(id) => cm.mutate(id)} confirming={cId === ((item.prescription_id ?? item.id) as string)} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ROW 5: Doctor + Links + Appointment */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
        {/* Doctor */}
        <div className="col-span-2 lg:col-span-1 bg-[var(--color-surface)] rounded-xl border border-border px-3 py-3 flex items-center gap-3">
          <span className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "#7E78D215", color: "#7E78D2" }}><DocIc /></span>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-[var(--color-text-secondary)]">Лечащий врач</p>
            <p className="text-sm font-semibold text-foreground truncate">{doctorName ?? "Не назначен"}</p>
          </div>
          <Link to="/portal/messages">
            <Button variant="outline" size="sm" className="h-7 px-2 text-[11px] gap-1"><MsgIc /> Чат</Button>
          </Link>
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-4 gap-1.5">
          <QLink to="/portal/treatment" icon={<TreatIc />} label="Лечение" />
          <QLink to="/portal/exercises" icon={<PulseIc />} label="Упр." />
          <QLink to="/portal/schedule" icon={<CalIc />} label="Расп." />
          <QLink to="/portal/billing" icon={<DolIc />} label="Счета" />
        </div>

        {/* Appointment */}
        <div className="bg-[var(--color-surface)] rounded-xl border border-border px-4 py-3">
          <p className="text-[11px] text-[var(--color-text-secondary)] mb-1">Ближайший приём</p>
          {nextAppt ? (
            <>
              <p className="text-sm font-semibold text-foreground">{(nextAppt.doctor_name ?? "Врач") as string}</p>
              <p className="text-xs text-[var(--color-text-secondary)]">
                {new Date(nextAppt.scheduled_start as string).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })} {fmtTime(nextAppt.scheduled_start as string)}
              </p>
            </>
          ) : (
            <p className="text-xs text-[var(--color-text-secondary)]">Нет записей</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function Stat({ icon, value, label }: { icon: ReactNode; value: string; label: string }) {
  return (
    <div className="bg-[var(--color-surface)] rounded-xl border border-border py-2 px-2 text-center">
      <span className="text-[var(--color-text-secondary)] flex justify-center mb-0.5">{icon}</span>
      <p className="text-lg font-bold text-foreground leading-none">{value}</p>
      <p className="text-[9px] text-[var(--color-text-secondary)] mt-0.5 leading-tight">{label}</p>
    </div>
  );
}

function QLink({ to, icon, label }: { to: string; icon: ReactNode; label: string }) {
  return (
    <Link to={to} className="flex flex-col items-center justify-center gap-0.5 bg-[var(--color-surface)] rounded-lg border border-border py-1.5 hover:bg-[var(--color-muted)] transition-colors min-w-0">
      <span className="text-[var(--color-text-secondary)]">{icon}</span>
      <span className="text-[9px] font-medium text-foreground truncate max-w-full px-1">{label}</span>
    </Link>
  );
}

function HeroCard({ item, onConfirm, confirming }: { item: Item; onConfirm: (id: string) => void; confirming: boolean }) {
  const type = item.type as string;
  const color = TC[type] ?? "#6B7280";
  const name = iName(item);

  if (type === "MEDICATION") {
    const dose = item.dosage as string | undefined;
    const id = (item.prescription_id ?? item.id) as string;
    return (
      <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border" style={{ borderColor: `${color}40`, background: `${color}08` }}>
        <span style={{ color }} className="flex-shrink-0"><PillIc /></span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{name}{dose ? ` ${dose}` : ""}</p>
          <p className="text-xs text-[var(--color-text-secondary)]">Пора принять</p>
        </div>
        <Button disabled={confirming} onClick={() => onConfirm(id)} size="sm" className="flex-shrink-0 h-8 px-3 text-xs font-bold rounded-lg text-white" style={{ background: color }}>
          {confirming ? "..." : "Принял ✓"}
        </Button>
      </div>
    );
  }

  if (type === "EXERCISE") {
    const eid = (item.exercise_id ?? item.id) as string;
    const s = item.sets as number | undefined; const r = (item.reps ?? item.repetitions) as number | undefined;
    return (
      <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border" style={{ borderColor: `${color}40`, background: `${color}08` }}>
        <span style={{ color }} className="flex-shrink-0"><PulseIc /></span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{name}</p>
          {s && r && <p className="text-xs text-[var(--color-text-secondary)]">{s}×{r} повторений</p>}
        </div>
        <Link to="/portal/exercise-session" search={{ exerciseId: eid }}>
          <Button size="sm" className="flex-shrink-0 h-8 px-3 text-xs font-bold rounded-lg text-white gap-1" style={{ background: color }}>
            <PlayIc /> Начать
          </Button>
        </Link>
      </div>
    );
  }

  const tm = fmtTime(item.scheduled_time as string | undefined);
  return (
    <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border" style={{ borderColor: `${color}40`, background: `${color}08` }}>
      <span style={{ color }} className="flex-shrink-0"><ProcIc /></span>
      <p className="text-sm font-semibold text-foreground flex-1 truncate">{name}{tm ? ` — ${tm}` : ""}</p>
    </div>
  );
}

function TaskRow({ item, onConfirm, confirming }: { item: Item; onConfirm: (id: string) => void; confirming: boolean }) {
  const type = item.type as string;
  const isDone = item.status === "COMPLETED";
  const color = TC[type] ?? "#6B7280";
  const name = iName(item);
  const detail = iDetail(item);

  return (
    <div className={`flex items-center gap-2 py-2 px-3 ${isDone ? "opacity-40" : ""}`}>
      <span className="w-0.5 self-stretch rounded-full flex-shrink-0" style={{ background: color }} />
      <span className="flex-shrink-0" style={{ color: isDone ? "var(--color-text-tertiary)" : color }}>{tIcon(type)}</span>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${isDone ? "line-through text-[var(--color-text-tertiary)]" : "text-foreground"}`}>{name}</p>
        {detail && <p className="text-[11px] text-[var(--color-text-secondary)] truncate">{detail}</p>}
      </div>
      {!isDone && type === "MEDICATION" && (
        <Button disabled={confirming} onClick={() => onConfirm((item.prescription_id ?? item.id) as string)} size="sm" className="h-7 px-2 text-[11px] font-bold rounded-md text-white" style={{ background: "#22C55E" }}>
          {confirming ? "..." : "Принял"}
        </Button>
      )}
      {!isDone && type === "EXERCISE" && (
        <Link to="/portal/exercise-session" search={{ exerciseId: (item.exercise_id ?? item.id) as string }}>
          <Button size="sm" className="h-7 px-2 text-[11px] font-bold rounded-md text-white gap-1" style={{ background: "#14B8A6" }}>
            <PlayIc /> Начать
          </Button>
        </Link>
      )}
      {isDone && <span className="text-success flex-shrink-0"><ChkIc /></span>}
    </div>
  );
}

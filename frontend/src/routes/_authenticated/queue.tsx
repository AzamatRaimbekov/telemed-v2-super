import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  PhoneForwarded,
  Play,
  CheckCircle2,
  SkipForward,
  Clock,
  Users,
  Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  useTodayQueue,
  useCallNext,
  useQueueAction,
} from "@/features/queue/api";
import type { QueueEntry } from "@/features/queue/api";

export const Route = createFileRoute("/_authenticated/queue")({
  component: QueuePage,
});

/* ---------- helpers ---------- */

const statusConfig: Record<
  QueueEntry["status"],
  { label: string; variant: "muted" | "warning" | "primary" | "success" | "destructive" }
> = {
  waiting: { label: "Ожидание", variant: "muted" },
  called: { label: "Вызван", variant: "warning" },
  in_progress: { label: "На приёме", variant: "primary" },
  completed: { label: "Завершён", variant: "success" },
  skipped: { label: "Пропущен", variant: "destructive" },
  cancelled: { label: "Отменён", variant: "destructive" },
};

function formatTime(iso: string | null) {
  if (!iso) return "--:--";
  return new Date(iso).toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* ---------- queue entry row ---------- */

function QueueRow({
  entry,
  index,
}: {
  entry: QueueEntry;
  index: number;
}) {
  const { mutate: doAction, isPending } = useQueueAction();
  const cfg = statusConfig[entry.status];

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25, delay: index * 0.04 }}
      className={`flex items-center gap-4 bg-[var(--color-surface)] rounded-xl border border-border px-5 py-4 hover:shadow-sm transition-shadow ${
        entry.status === "called"
          ? "ring-2 ring-warning/40"
          : entry.status === "in_progress"
            ? "ring-2 ring-primary/40"
            : ""
      }`}
    >
      {/* Queue number */}
      <div
        className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold shrink-0 ${
          entry.status === "called"
            ? "bg-warning/10 text-warning"
            : entry.status === "in_progress"
              ? "bg-primary/10 text-[var(--color-primary-deep)]"
              : "bg-[var(--color-muted)] text-[var(--color-text-secondary)]"
        }`}
      >
        {entry.queue_number}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-foreground truncate">
          {entry.display_name || "Пациент"}
        </p>
        <div className="flex items-center gap-3 text-xs text-[var(--color-text-tertiary)] mt-0.5">
          {entry.room_name && <span>Каб. {entry.room_name}</span>}
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatTime(entry.called_at || entry.created_at)}
          </span>
        </div>
      </div>

      {/* Status badge */}
      <Badge variant={cfg.variant} dot>
        {cfg.label}
      </Badge>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        {entry.status === "called" && (
          <button
            onClick={() => doAction({ id: entry.id, action: "start" })}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#2563eb] text-white hover:bg-[#1d4ed8] transition-colors disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5" />
            Начать
          </button>
        )}
        {entry.status === "in_progress" && (
          <button
            onClick={() => doAction({ id: entry.id, action: "complete" })}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-success text-white hover:bg-success/90 transition-colors disabled:opacity-50"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Завершить
          </button>
        )}
        {(entry.status === "waiting" || entry.status === "called") && (
          <button
            onClick={() => doAction({ id: entry.id, action: "skip" })}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--color-muted)] text-[var(--color-text-secondary)] hover:bg-destructive/10 hover:text-destructive transition-colors disabled:opacity-50"
          >
            <SkipForward className="w-3.5 h-3.5" />
            Пропустить
          </button>
        )}
      </div>
    </motion.div>
  );
}

/* ---------- skeleton ---------- */

function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 bg-[var(--color-surface)] rounded-xl border border-border px-5 py-4 animate-pulse">
      <div className="w-12 h-12 rounded-xl bg-[var(--color-muted)]" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-40 bg-[var(--color-muted)] rounded" />
        <div className="h-3 w-24 bg-[var(--color-muted)] rounded" />
      </div>
      <div className="h-5 w-20 bg-[var(--color-muted)] rounded-full" />
    </div>
  );
}

/* ---------- page ---------- */

function QueuePage() {
  const { data: entries, isLoading, isError } = useTodayQueue();
  const { mutate: callNext, isPending: isCallingNext } = useCallNext();

  /* group by status priority */
  const active = (entries || []).filter(
    (e) => e.status === "called" || e.status === "in_progress"
  );
  const waiting = (entries || []).filter((e) => e.status === "waiting");
  const done = (entries || []).filter(
    (e) =>
      e.status === "completed" ||
      e.status === "skipped" ||
      e.status === "cancelled"
  );

  const waitingCount = waiting.length;
  const activeCount = active.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Очередь приёма
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
            Управление очередью пациентов. Обновляется каждые 5 секунд.
          </p>
        </div>
        <button
          onClick={() => callNext()}
          disabled={isCallingNext || waitingCount === 0}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-[#2563eb] text-white hover:bg-[#1d4ed8] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
        >
          {isCallingNext ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <PhoneForwarded className="w-4 h-4" />
          )}
          Вызвать следующего
        </button>
      </motion.div>

      {/* Stats bar */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="flex gap-4"
      >
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-warning/10 text-warning text-sm font-medium">
          <Users className="w-4 h-4" />
          {waitingCount} в очереди
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 text-[var(--color-primary-deep)] text-sm font-medium">
          <Play className="w-4 h-4" />
          {activeCount} на приёме
        </div>
      </motion.div>

      {/* Error state */}
      {isError && (
        <div className="text-center py-12">
          <p className="text-lg font-semibold text-foreground mb-1">
            Ошибка загрузки
          </p>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Не удалось загрузить очередь
          </p>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonRow key={i} />
          ))}
        </div>
      )}

      {/* Active / Called */}
      {active.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide">
            Текущие
          </h2>
          {active.map((entry, i) => (
            <QueueRow key={entry.id} entry={entry} index={i} />
          ))}
        </div>
      )}

      {/* Waiting */}
      {waiting.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide">
            Ожидают ({waiting.length})
          </h2>
          {waiting.map((entry, i) => (
            <QueueRow
              key={entry.id}
              entry={entry}
              index={i + active.length}
            />
          ))}
        </div>
      )}

      {/* Done (collapsed summary) */}
      {done.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide">
            Завершённые ({done.length})
          </h2>
          {done.map((entry, i) => (
            <QueueRow
              key={entry.id}
              entry={entry}
              index={i + active.length + waiting.length}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && entries && entries.length === 0 && (
        <div className="text-center py-16">
          <Users className="w-12 h-12 text-[var(--color-text-tertiary)] mx-auto mb-3" />
          <p className="text-lg font-semibold text-foreground mb-1">
            Очередь пуста
          </p>
          <p className="text-sm text-[var(--color-text-secondary)]">
            На сегодня нет пациентов в очереди
          </p>
        </div>
      )}
    </div>
  );
}

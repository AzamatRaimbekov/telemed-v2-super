import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, Users } from "lucide-react";
import apiClient from "@/lib/api-client";
import type { QueueEntry } from "@/features/queue/api";

const DEFAULT_CLINIC_ID = "default";

export const Route = createFileRoute("/lobby")({
  validateSearch: (search: Record<string, unknown>) => ({
    clinic_id: (search.clinic_id as string) || DEFAULT_CLINIC_ID,
  }),
  component: LobbyPage,
});

/* ---------- hooks ---------- */

function useLobbyData(clinicId: string) {
  return useQuery<QueueEntry[]>({
    queryKey: ["queue", "lobby", clinicId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/queue/lobby/${clinicId}`);
      return data;
    },
    refetchInterval: 3000,
  });
}

function useCurrentTime() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return time;
}

/* ---------- lobby card ---------- */

function LobbyCard({
  entry,
  index,
}: {
  entry: QueueEntry;
  index: number;
}) {
  const isCalled = entry.status === "called";
  const isInProgress = entry.status === "in_progress";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.4, delay: index * 0.08 }}
      className={`rounded-2xl p-8 ${
        isCalled
          ? "bg-amber-500/20 border-2 border-amber-400/50 animate-pulse"
          : isInProgress
            ? "bg-blue-500/20 border-2 border-blue-400/40"
            : "bg-white/5 border border-white/10"
      }`}
    >
      {/* Queue number */}
      <div className="flex items-start justify-between mb-4">
        <div
          className={`text-7xl font-black leading-none tracking-tighter ${
            isCalled
              ? "text-amber-400"
              : isInProgress
                ? "text-blue-400"
                : "text-white/40"
          }`}
        >
          {entry.queue_number}
        </div>
        <span
          className={`text-sm font-semibold px-3 py-1 rounded-full ${
            isCalled
              ? "bg-amber-400/20 text-amber-300"
              : isInProgress
                ? "bg-blue-400/20 text-blue-300"
                : "bg-white/10 text-white/50"
          }`}
        >
          {isCalled ? "ВЫЗВАН" : isInProgress ? "НА ПРИЁМЕ" : "ОЖИДАНИЕ"}
        </span>
      </div>

      {/* Patient name */}
      <p className="text-2xl font-bold text-white truncate mb-2">
        {entry.display_name || "Пациент"}
      </p>

      {/* Room */}
      {entry.room_name && (
        <p className="text-lg text-white/60">
          Кабинет{" "}
          <span className="text-white font-semibold">{entry.room_name}</span>
        </p>
      )}
    </motion.div>
  );
}

/* ---------- page ---------- */

function LobbyPage() {
  const { clinic_id } = Route.useSearch();
  const { data: entries, isLoading } = useLobbyData(clinic_id);
  const now = useCurrentTime();

  /* Show called + in_progress first, then a few waiting */
  const active = (entries || []).filter(
    (e) => e.status === "called" || e.status === "in_progress"
  );
  const waiting = (entries || []).filter((e) => e.status === "waiting");
  const display = [...active, ...waiting.slice(0, 8)];

  const timeStr = now.toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const dateStr = now.toLocaleDateString("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-10 py-6 border-b border-white/10">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center">
            <span className="text-xl font-black text-white">M</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">MedCore KG</h1>
            <p className="text-sm text-white/50">Электронная очередь</p>
          </div>
        </div>

        <div className="text-right">
          <div className="flex items-center gap-2 text-4xl font-mono font-bold tracking-tight">
            <Clock className="w-8 h-8 text-white/40" />
            {timeStr}
          </div>
          <p className="text-sm text-white/40 mt-0.5 capitalize">{dateStr}</p>
        </div>
      </header>

      {/* Content */}
      <main className="px-10 py-8">
        {/* Waiting count */}
        <div className="flex items-center gap-3 mb-8">
          <Users className="w-6 h-6 text-white/40" />
          <span className="text-lg text-white/60">
            В очереди:{" "}
            <span className="text-white font-bold">{waiting.length}</span>
          </span>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="rounded-2xl bg-white/5 border border-white/10 p-8 animate-pulse"
              >
                <div className="h-16 w-20 bg-white/10 rounded mb-4" />
                <div className="h-6 w-48 bg-white/10 rounded mb-2" />
                <div className="h-5 w-32 bg-white/10 rounded" />
              </div>
            ))}
          </div>
        )}

        {/* Queue grid */}
        {!isLoading && display.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            <AnimatePresence mode="popLayout">
              {display.map((entry, i) => (
                <LobbyCard key={entry.id} entry={entry} index={i} />
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Empty */}
        {!isLoading && display.length === 0 && (
          <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
            <Users className="w-20 h-20 text-white/10 mb-6" />
            <p className="text-3xl font-bold text-white/30">
              Очередь пуста
            </p>
            <p className="text-lg text-white/20 mt-2">
              Нет пациентов в очереди на данный момент
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

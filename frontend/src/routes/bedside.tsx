import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Pill,
  Activity,
  Stethoscope,
  UtensilsCrossed,
  Phone,
  Clock,
  Droplets,
} from "lucide-react";
import apiClient from "@/lib/api-client";

export const Route = createFileRoute("/bedside")({
  component: BedsidePage,
});

/* ---------- types ---------- */

interface ScheduleItem {
  time: string;
  type: string;
  description: string;
}

interface BedsideData {
  patient: {
    first_name: string;
    last_name: string;
    wristband_uid: string;
  };
  today_schedule: ScheduleItem[];
  nurse_call_available: boolean;
  message_from_doctor: string | null;
}

/* ---------- helpers ---------- */

const typeIcons: Record<string, React.ReactNode> = {
  medication: <Pill className="w-8 h-8" />,
  procedure: <Activity className="w-8 h-8" />,
  doctor_visit: <Stethoscope className="w-8 h-8" />,
  meal: <UtensilsCrossed className="w-8 h-8" />,
  iv_drip: <Droplets className="w-8 h-8" />,
};

const typeColors: Record<string, string> = {
  medication: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  procedure: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  doctor_visit: "bg-green-500/20 text-green-400 border-green-500/30",
  meal: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  iv_drip: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
};

function useCurrentTime() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return time;
}

function useAutoTheme() {
  const [isDark, setIsDark] = useState(true);
  useEffect(() => {
    const check = () => {
      const hour = new Date().getHours();
      setIsDark(hour < 7 || hour >= 21);
    };
    check();
    const id = setInterval(check, 60_000);
    return () => clearInterval(id);
  }, []);
  return isDark;
}

/* ---------- main ---------- */

function BedsidePage() {
  // Extract wristband_uid from URL path — /bedside/MC-XXXXXX
  const wristbandUid = useMemo(() => {
    const path = window.location.pathname;
    const parts = path.split("/").filter(Boolean);
    return parts.length > 1 ? parts[parts.length - 1] : null;
  }, []);

  const now = useCurrentTime();
  const isDark = useAutoTheme();
  const [callSent, setCallSent] = useState(false);

  const { data, isLoading, error } = useQuery<BedsideData>({
    queryKey: ["bedside", wristbandUid],
    queryFn: async () => {
      const { data } = await apiClient.get(`/bedside/${wristbandUid}`);
      return data;
    },
    enabled: !!wristbandUid,
    refetchInterval: 30_000,
  });

  const handleNurseCall = () => {
    setCallSent(true);
    setTimeout(() => setCallSent(false), 5000);
  };

  const bgClass = isDark
    ? "bg-gray-950 text-white"
    : "bg-white text-gray-900";

  const cardBg = isDark ? "bg-gray-900/80" : "bg-gray-50";

  if (!wristbandUid) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${bgClass}`}>
        <p className="text-2xl opacity-60">
          Используйте URL: /bedside/MC-XXXXXX
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${bgClass}`}>
        <div className="animate-pulse text-3xl opacity-40">Загрузка...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${bgClass}`}>
        <p className="text-2xl text-red-400">Браслет не найден</p>
      </div>
    );
  }

  const currentTime = now.toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const currentHHMM = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  return (
    <div className={`min-h-screen p-8 ${bgClass} transition-colors duration-1000`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-10">
        <div>
          <h1 className="text-5xl font-bold tracking-tight">
            {data.patient.last_name} {data.patient.first_name}
          </h1>
          <p className="text-2xl opacity-50 mt-2 font-mono">
            {data.patient.wristband_uid}
          </p>
        </div>
        <div className="text-right">
          <div className="text-6xl font-light font-mono tabular-nums flex items-center gap-3">
            <Clock className="w-12 h-12 opacity-40" />
            {currentTime}
          </div>
          <p className="text-xl opacity-40 mt-1">
            {now.toLocaleDateString("ru-RU", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </p>
        </div>
      </div>

      {/* Schedule */}
      <div className="mb-10">
        <h2 className="text-3xl font-semibold mb-6 opacity-70">
          Расписание на сегодня
        </h2>
        <div className="space-y-4">
          {data.today_schedule.map((item, i) => {
            const isPast = item.time < currentHHMM;
            const isCurrent =
              item.time <= currentHHMM &&
              (i + 1 >= data.today_schedule.length ||
                data.today_schedule[i + 1].time > currentHHMM);

            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className={`flex items-center gap-6 p-5 rounded-2xl border transition-all ${
                  isCurrent
                    ? "border-blue-400 bg-blue-500/10 scale-[1.02] shadow-lg shadow-blue-500/10"
                    : isPast
                      ? `${cardBg} border-transparent opacity-40`
                      : `${cardBg} border-transparent`
                }`}
              >
                <span className="text-3xl font-mono font-light w-24 shrink-0">
                  {item.time}
                </span>
                <div
                  className={`p-3 rounded-xl border ${typeColors[item.type] || "bg-gray-500/20 text-gray-400 border-gray-500/30"}`}
                >
                  {typeIcons[item.type] || <Activity className="w-8 h-8" />}
                </div>
                <span className="text-2xl">{item.description}</span>
                {isCurrent && (
                  <span className="ml-auto text-sm uppercase tracking-wider text-blue-400 animate-pulse">
                    Сейчас
                  </span>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Doctor message */}
      {data.message_from_doctor && (
        <div className={`${cardBg} rounded-2xl p-6 mb-10 border border-yellow-500/30`}>
          <p className="text-xl text-yellow-400">
            Сообщение от врача: {data.message_from_doctor}
          </p>
        </div>
      )}

      {/* Nurse call button */}
      {data.nurse_call_available && (
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={handleNurseCall}
          disabled={callSent}
          className={`w-full py-8 rounded-3xl text-4xl font-bold transition-all ${
            callSent
              ? "bg-green-600 text-white cursor-not-allowed"
              : "bg-red-600 hover:bg-red-500 text-white active:bg-red-700 shadow-lg shadow-red-600/30"
          }`}
        >
          <Phone className="w-10 h-10 inline-block mr-4 -mt-1" />
          {callSent ? "Вызов отправлен!" : "Вызвать медсестру"}
        </motion.button>
      )}
    </div>
  );
}

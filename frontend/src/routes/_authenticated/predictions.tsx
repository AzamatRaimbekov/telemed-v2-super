import { createFileRoute } from "@tanstack/react-router";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { motion } from "framer-motion";
import {
  usePredictionsDashboard,
  type ForecastPoint,
  type MedicationAlert,
} from "@/features/predictions/api";

export const Route = createFileRoute("/_authenticated/predictions")({
  component: PredictionsDashboard,
});

const DAYS_RU = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr);
  const day = DAYS_RU[d.getDay()];
  return `${day} ${d.getDate()}`;
}

const tooltipStyle = {
  backgroundColor: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: "10px",
  fontSize: "12px",
  color: "var(--color-text-secondary)",
};

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

function urgencyConfig(urgency: MedicationAlert["urgency"]) {
  switch (urgency) {
    case "critical":
      return {
        bg: "bg-red-500/10",
        text: "text-red-400",
        border: "border-red-500/20",
        label: "Критично",
        dot: "bg-red-500",
      };
    case "warning":
      return {
        bg: "bg-amber-500/10",
        text: "text-amber-400",
        border: "border-amber-500/20",
        label: "Внимание",
        dot: "bg-amber-500",
      };
    case "info":
      return {
        bg: "bg-blue-500/10",
        text: "text-blue-400",
        border: "border-blue-500/20",
        label: "Инфо",
        dot: "bg-blue-500",
      };
  }
}

function PredictionsDashboard() {
  const { data, isLoading, isError } = usePredictionsDashboard();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-[var(--color-text-secondary)]">
            Загрузка прогнозов...
          </p>
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <p className="text-lg font-medium text-foreground">
            Ошибка загрузки
          </p>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
            Не удалось загрузить данные прогнозов
          </p>
        </div>
      </div>
    );
  }

  const bedsData = data.beds.map((p) => ({
    ...p,
    label: formatDateShort(p.date),
  }));

  const admissionsData = data.admissions.map((p) => ({
    ...p,
    label: formatDateShort(p.date),
  }));

  return (
    <motion.div
      className="space-y-6 max-w-[1400px] mx-auto"
      variants={container}
      initial="hidden"
      animate="show"
    >
      {/* Header */}
      <motion.div variants={item}>
        <h1 className="text-2xl font-bold text-foreground">
          Предиктивная аналитика
        </h1>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1">
          Прогнозы на основе исторических данных
        </p>
      </motion.div>

      {/* Bed Occupancy Forecast */}
      <motion.div
        variants={item}
        className="bg-[var(--color-surface)] border border-border rounded-2xl p-6"
      >
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-5 h-5 text-blue-400"
            >
              <path d="M2 4v16" />
              <path d="M2 8h18a2 2 0 0 1 2 2v10" />
              <path d="M2 17h20" />
              <path d="M6 8v9" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Прогноз загрузки палат
            </h2>
            <p className="text-xs text-[var(--color-text-tertiary)]">
              На 7 дней вперед
            </p>
          </div>
        </div>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={bedsData}
              margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
            >
              <defs>
                <linearGradient id="bedGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient
                  id="bedConfGrad"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.1} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--color-border)"
                opacity={0.5}
              />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 12, fill: "var(--color-text-tertiary)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 12, fill: "var(--color-text-tertiary)" }}
                axisLine={false}
                tickLine={false}
                width={40}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                labelFormatter={(v) => `${v}`}
                formatter={(value: number, name: string) => {
                  const labels: Record<string, string> = {
                    predicted: "Прогноз",
                    high: "Верхняя граница",
                    low: "Нижняя граница",
                  };
                  return [value, labels[name] || name];
                }}
              />
              <Area
                type="monotone"
                dataKey="high"
                stroke="none"
                fill="url(#bedConfGrad)"
                fillOpacity={1}
              />
              <Area
                type="monotone"
                dataKey="low"
                stroke="none"
                fill="var(--color-surface)"
                fillOpacity={1}
              />
              <Area
                type="monotone"
                dataKey="predicted"
                stroke="#3b82f6"
                strokeWidth={2.5}
                fill="url(#bedGrad)"
                fillOpacity={1}
                dot={{
                  r: 4,
                  fill: "#3b82f6",
                  stroke: "var(--color-surface)",
                  strokeWidth: 2,
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Admissions Forecast */}
      <motion.div
        variants={item}
        className="bg-[var(--color-surface)] border border-border rounded-2xl p-6"
      >
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-5 h-5 text-purple-400"
            >
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <line x1="19" y1="8" x2="19" y2="14" />
              <line x1="22" y1="11" x2="16" y2="11" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Прогноз приемов
            </h2>
            <p className="text-xs text-[var(--color-text-tertiary)]">
              На 7 дней вперед
            </p>
          </div>
        </div>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={admissionsData}
              margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--color-border)"
                opacity={0.5}
              />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 12, fill: "var(--color-text-tertiary)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 12, fill: "var(--color-text-tertiary)" }}
                axisLine={false}
                tickLine={false}
                width={40}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                labelFormatter={(v) => `${v}`}
                formatter={(value: number, name: string) => {
                  const labels: Record<string, string> = {
                    predicted: "Прогноз",
                    high: "Макс",
                    low: "Мин",
                  };
                  return [value, labels[name] || name];
                }}
              />
              <Bar
                dataKey="predicted"
                fill="#a855f7"
                radius={[6, 6, 0, 0]}
                maxBarSize={48}
              />
              {/* Confidence whiskers rendered as thin bars */}
              <Bar
                dataKey="high"
                fill="none"
                stroke="#a855f7"
                strokeWidth={1}
                strokeDasharray="4 2"
                radius={[2, 2, 0, 0]}
                maxBarSize={2}
                opacity={0.4}
              />
              <Bar
                dataKey="low"
                fill="none"
                stroke="#a855f7"
                strokeWidth={1}
                strokeDasharray="4 2"
                radius={[2, 2, 0, 0]}
                maxBarSize={2}
                opacity={0.4}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Medication Forecast */}
      <motion.div
        variants={item}
        className="bg-[var(--color-surface)] border border-border rounded-2xl p-6"
      >
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-5 h-5 text-emerald-400"
            >
              <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z" />
              <path d="m8.5 8.5 7 7" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Прогноз расхода лекарств
            </h2>
            <p className="text-xs text-[var(--color-text-tertiary)]">
              Препараты, которые могут закончиться в ближайшие 30 дней
            </p>
          </div>
        </div>

        {data.medications.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-3">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className="w-6 h-6 text-emerald-400"
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </div>
            <p className="text-sm text-[var(--color-text-secondary)]">
              Все запасы лекарств в норме
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.medications.map((med, idx) => {
              const cfg = urgencyConfig(med.urgency);
              return (
                <motion.div
                  key={med.item_id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: idx * 0.05, duration: 0.3 }}
                  className={`border ${cfg.border} ${cfg.bg} rounded-xl p-4 space-y-3`}
                >
                  <div className="flex items-start justify-between">
                    <h3 className="text-sm font-semibold text-foreground leading-tight">
                      {med.name}
                    </h3>
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}
                    >
                      {cfg.label}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-[var(--color-text-tertiary)]">
                        Текущий остаток
                      </span>
                      <span className="font-medium text-foreground">
                        {med.current_quantity} шт.
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-[var(--color-text-tertiary)]">
                        Расход в день
                      </span>
                      <span className="font-medium text-foreground">
                        ~{med.daily_consumption} шт.
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-[var(--color-text-tertiary)]">
                        Закончится через
                      </span>
                      <span className={`font-bold ${cfg.text}`}>
                        {med.days_until_empty} дн.
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-[var(--color-text-tertiary)]">
                        Дата заказа до
                      </span>
                      <span className="font-medium text-foreground">
                        {new Date(med.reorder_date).toLocaleDateString("ru-RU", {
                          day: "numeric",
                          month: "short",
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Progress bar showing depletion */}
                  <div className="h-1.5 bg-[var(--color-border)] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        med.urgency === "critical"
                          ? "bg-red-500"
                          : med.urgency === "warning"
                            ? "bg-amber-500"
                            : "bg-blue-500"
                      }`}
                      style={{
                        width: `${Math.max(5, Math.min(100, (med.days_until_empty / 30) * 100))}%`,
                      }}
                    />
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  Users,
  CalendarDays,
  BedDouble,
  Banknote,
  FlaskConical,
  Pill,
  UserCog,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useChiefDashboard } from "@/features/chief-dashboard/api";
import type { ChiefDashboardData } from "@/features/chief-dashboard/api";

export const Route = createFileRoute("/_authenticated/chief-dashboard")({
  component: ChiefDashboardPage,
});

/* ---------- helpers ---------- */

function formatCurrency(n: number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "decimal",
    maximumFractionDigits: 0,
  }).format(n);
}

/* ---------- stat card ---------- */

interface StatCardProps {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  title: string;
  value: string;
  subtitle?: string;
  badge?: { label: string; positive: boolean } | null;
  index: number;
}

function StatCard({
  icon,
  iconBg,
  iconColor,
  title,
  value,
  subtitle,
  badge,
  index,
}: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.07, ease: "easeOut" }}
      className="bg-[var(--color-surface)] rounded-2xl border border-border shadow-sm p-6 hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between mb-4">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center"
          style={{ background: iconBg }}
        >
          <div style={{ color: iconColor }}>{icon}</div>
        </div>
        {badge && (
          <span
            className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg ${
              badge.positive
                ? "text-success bg-success/10"
                : "text-destructive bg-destructive/10"
            }`}
          >
            {badge.positive ? (
              <TrendingUp className="w-3 h-3" />
            ) : (
              <TrendingDown className="w-3 h-3" />
            )}
            {badge.label}
          </span>
        )}
      </div>
      <p className="text-[28px] font-bold text-foreground tracking-tight leading-none mb-1">
        {value}
      </p>
      <p className="text-sm text-[var(--color-text-secondary)] mb-0.5">
        {title}
      </p>
      {subtitle && (
        <p className="text-xs text-[var(--color-text-tertiary)]">{subtitle}</p>
      )}
    </motion.div>
  );
}

/* ---------- skeleton ---------- */

function SkeletonCard() {
  return (
    <div className="bg-[var(--color-surface)] rounded-2xl border border-border shadow-sm p-6 animate-pulse">
      <div className="flex items-start justify-between mb-4">
        <div className="w-11 h-11 rounded-xl bg-[var(--color-muted)]" />
        <div className="w-14 h-5 rounded-lg bg-[var(--color-muted)]" />
      </div>
      <div className="h-8 w-24 bg-[var(--color-muted)] rounded mb-2" />
      <div className="h-4 w-32 bg-[var(--color-muted)] rounded" />
    </div>
  );
}

/* ---------- revenue chart ---------- */

function RevenueChart({ data }: { data: ChiefDashboardData }) {
  const chartData = [
    {
      name: "Прошлый месяц",
      revenue: data.revenue.last_month,
    },
    {
      name: "Текущий месяц",
      revenue: data.revenue.this_month,
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.5, ease: "easeOut" }}
      className="bg-[var(--color-surface)] rounded-2xl border border-border shadow-sm p-6"
    >
      <h3 className="text-base font-semibold text-foreground mb-1">
        Доход (сом)
      </h3>
      <p className="text-xs text-[var(--color-text-tertiary)] mb-4">
        Сравнение текущего и прошлого месяца
      </p>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 12, fill: "var(--color-text-secondary)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 12, fill: "var(--color-text-secondary)" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
            />
            <Tooltip
              contentStyle={{
                borderRadius: "12px",
                border: "1px solid var(--color-border)",
                background: "var(--color-surface)",
                fontSize: 13,
              }}
              formatter={(value: number) => [
                `${formatCurrency(value)} сом`,
                "Доход",
              ]}
            />
            <Bar
              dataKey="revenue"
              fill="#2563eb"
              radius={[8, 8, 0, 0]}
              barSize={56}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}

/* ---------- summary cards row ---------- */

function SummaryRow({ data }: { data: ChiefDashboardData }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.6, ease: "easeOut" }}
      className="bg-[var(--color-surface)] rounded-2xl border border-border shadow-sm p-6"
    >
      <h3 className="text-base font-semibold text-foreground mb-4">
        Сводка приёмов за неделю
      </h3>
      <div className="grid grid-cols-3 gap-4 text-center">
        <div>
          <p className="text-2xl font-bold text-foreground">
            {data.appointments.this_week}
          </p>
          <p className="text-xs text-[var(--color-text-secondary)]">
            Всего за неделю
          </p>
        </div>
        <div>
          <p className="text-2xl font-bold text-success">
            {data.appointments.completed_this_week}
          </p>
          <p className="text-xs text-[var(--color-text-secondary)]">
            Завершённых
          </p>
        </div>
        <div>
          <p className="text-2xl font-bold text-[#2563eb]">
            {data.appointments.completion_rate}%
          </p>
          <p className="text-xs text-[var(--color-text-secondary)]">
            Выполнение
          </p>
        </div>
      </div>
    </motion.div>
  );
}

/* ---------- page ---------- */

function ChiefDashboardPage() {
  const { data, isLoading, isError } = useChiefDashboard();

  if (isError) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <p className="text-lg font-semibold text-foreground mb-1">
            Ошибка загрузки
          </p>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Не удалось загрузить данные панели управления
          </p>
        </div>
      </div>
    );
  }

  const cards: StatCardProps[] = data
    ? [
        {
          icon: <Users className="w-5 h-5" />,
          iconBg: "#2563eb15",
          iconColor: "#2563eb",
          title: "Пациенты",
          value: formatCurrency(data.patients.total),
          subtitle: `+${data.patients.new_this_month} за месяц`,
          badge: {
            label: `+${data.patients.new_this_week} за неделю`,
            positive: true,
          },
          index: 0,
        },
        {
          icon: <CalendarDays className="w-5 h-5" />,
          iconBg: "#7c3aed15",
          iconColor: "#7c3aed",
          title: "Приёмы сегодня",
          value: String(data.appointments.today),
          subtitle: `${data.appointments.this_week} за неделю`,
          badge: null,
          index: 1,
        },
        {
          icon: <BedDouble className="w-5 h-5" />,
          iconBg: "#16a34a15",
          iconColor: "#16a34a",
          title: "Загрузка палат",
          value: `${data.beds.occupancy_rate}%`,
          subtitle: `${data.beds.occupied} из ${data.beds.total} занято`,
          badge:
            data.beds.occupancy_rate > 85
              ? { label: "Высокая", positive: false }
              : null,
          index: 2,
        },
        {
          icon: <Banknote className="w-5 h-5" />,
          iconBg: "#d9770615",
          iconColor: "#d97706",
          title: "Доход за месяц",
          value: `${formatCurrency(data.revenue.this_month)} с`,
          subtitle: `Прошлый: ${formatCurrency(data.revenue.last_month)} с`,
          badge: {
            label: `${data.revenue.growth_percent > 0 ? "+" : ""}${data.revenue.growth_percent}%`,
            positive: data.revenue.growth_percent >= 0,
          },
          index: 3,
        },
        {
          icon: <FlaskConical className="w-5 h-5" />,
          iconBg: "#0d948815",
          iconColor: "#0d9488",
          title: "Лаборатория",
          value: String(data.laboratory.pending_orders),
          subtitle: `Выполнено сегодня: ${data.laboratory.completed_today}`,
          badge:
            data.laboratory.pending_orders > 10
              ? {
                  label: `${data.laboratory.pending_orders} в ожидании`,
                  positive: false,
                }
              : null,
          index: 4,
        },
        {
          icon: <Pill className="w-5 h-5" />,
          iconBg: "#dc262615",
          iconColor: "#dc2626",
          title: "Аптека",
          value: `${data.pharmacy.low_stock_items}`,
          subtitle: `Всего позиций: ${data.pharmacy.total_items}`,
          badge:
            data.pharmacy.low_stock_items > 0
              ? {
                  label: "Низкий запас",
                  positive: false,
                }
              : null,
          index: 5,
        },
        {
          icon: <UserCog className="w-5 h-5" />,
          iconBg: "#2563eb15",
          iconColor: "#2563eb",
          title: "Персонал",
          value: String(data.staff.total),
          subtitle: `${data.staff.doctors} врачей, ${data.staff.nurses} медсестёр`,
          badge: null,
          index: 6,
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="text-2xl font-bold text-foreground">
          Панель руководителя
        </h1>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1">
          Обзор ключевых показателей клиники. Обновляется каждые 30 секунд.
        </p>
      </motion.div>

      {/* KPI Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map((card) => (
            <StatCard key={card.title} {...card} />
          ))}
        </div>
      )}

      {/* Charts row */}
      {data && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <RevenueChart data={data} />
          <SummaryRow data={data} />
        </div>
      )}
    </div>
  );
}

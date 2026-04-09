import { createFileRoute } from "@tanstack/react-router";
import { useAuthStore } from "@/stores/auth-store";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

const roleLabels: Record<string, string> = {
  SUPER_ADMIN: "Суперадмин",
  CLINIC_ADMIN: "Администратор",
  DOCTOR: "Врач",
  NURSE: "Медсестра",
  RECEPTIONIST: "Регистратор",
  PHARMACIST: "Фармацевт",
  LAB_TECHNICIAN: "Лаборант",
};

function StatCard({
  label,
  value,
  change,
  changeType,
  icon,
  accentColor,
  delay,
}: {
  label: string;
  value: string;
  change: string;
  changeType: "up" | "down" | "neutral";
  icon: React.ReactNode;
  accentColor: string;
  delay: number;
}) {
  return (
    <div
      className="stat-card bg-[var(--color-surface)] rounded-2xl border border-border p-6 animate-float-up cursor-default"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between mb-4">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center"
          style={{ background: `${accentColor}15` }}
        >
          <div style={{ color: accentColor }}>{icon}</div>
        </div>
        <div className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg ${
          changeType === "up"
            ? "text-success bg-success/10"
            : changeType === "down"
            ? "text-destructive bg-destructive/10"
            : "text-[var(--color-text-tertiary)] bg-[var(--color-muted)]"
        }`}>
          {changeType === "up" && (
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m18 15-6-6-6 6" />
            </svg>
          )}
          {changeType === "down" && (
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m6 9 6 6 6-6" />
            </svg>
          )}
          {change}
        </div>
      </div>
      <p className="text-[28px] font-bold text-foreground tracking-tight leading-none mb-1">{value}</p>
      <p className="text-sm text-[var(--color-text-secondary)]">{label}</p>
    </div>
  );
}

function QuickAction({
  label,
  description,
  icon,
  color,
  delay,
}: {
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  delay: number;
}) {
  return (
    <button
      className="group flex items-center gap-4 p-4 rounded-xl border border-border bg-[var(--color-surface)] hover:border-[var(--color-text-tertiary)]/30 transition-all duration-300 text-left w-full animate-float-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform duration-300 group-hover:scale-110"
        style={{ background: `${color}15`, color }}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <p className="text-xs text-[var(--color-text-tertiary)] truncate">{description}</p>
      </div>
      <svg className="w-4 h-4 text-[var(--color-text-tertiary)] group-hover:text-[var(--color-text-secondary)] transition-all duration-300 group-hover:translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m9 18 6-6-6-6" />
      </svg>
    </button>
  );
}

function ActivityItem({
  title,
  time,
  type,
  delay,
}: {
  title: string;
  time: string;
  type: "patient" | "lab" | "appointment" | "pharmacy";
  delay: number;
}) {
  const colors = {
    patient: "#10B981",
    lab: "#7E78D2",
    appointment: "#F59E0B",
    pharmacy: "#3B82F6",
  };
  const icons = {
    patient: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
      </svg>
    ),
    lab: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
        <path d="M14 2v6a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V2" />
        <path d="M10 2v3.3a4 4 0 0 1-1.17 2.83L4 13v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6l-4.83-4.87A4 4 0 0 1 14 5.3V2" />
      </svg>
    ),
    appointment: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
    pharmacy: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
        <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z" />
        <path d="m8.5 8.5 7 7" />
      </svg>
    ),
  };

  return (
    <div
      className="flex items-center gap-3 py-3 animate-slide-in-right"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: `${colors[type]}15`, color: colors[type] }}
      >
        {icons[type]}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-foreground truncate">{title}</p>
      </div>
      <span className="text-xs text-[var(--color-text-tertiary)] flex-shrink-0 font-mono">{time}</span>
    </div>
  );
}

function DashboardPage() {
  const user = useAuthStore((s) => s.user);

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Доброе утро";
    if (hour < 18) return "Добрый день";
    return "Добрый вечер";
  })();

  return (
    <div className="max-w-7xl">
      {/* Header */}
      <div className="mb-8 animate-float-up" style={{ animationDelay: '0ms' }}>
        <h1 className="text-[26px] font-bold text-foreground tracking-tight">
          {greeting}{user ? `, ${user.first_name}` : ""} 👋
        </h1>
        <p className="text-[var(--color-text-secondary)] mt-1 text-[15px]">
          {user ? `${roleLabels[user.role] || user.role} — ` : ""}Бишкек Мед Центр
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Пациенты сегодня"
          value="24"
          change="+12%"
          changeType="up"
          accentColor="#10B981"
          delay={100}
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          }
        />
        <StatCard
          label="Активные приёмы"
          value="8"
          change="3 в очереди"
          changeType="neutral"
          accentColor="#7E78D2"
          delay={200}
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          }
        />
        <StatCard
          label="Загрузка коек"
          value="67%"
          change="+5%"
          changeType="up"
          accentColor="#F59E0B"
          delay={300}
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
              <path d="M2 4v16" />
              <path d="M2 8h18a2 2 0 0 1 2 2v10" />
              <path d="M2 17h20" />
              <path d="M6 8v9" />
            </svg>
          }
        />
        <StatCard
          label="Выручка сегодня"
          value="48,200 С"
          change="+8%"
          changeType="up"
          accentColor="#3B82F6"
          delay={400}
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
              <line x1="12" x2="12" y1="2" y2="22" />
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          }
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <div className="xl:col-span-1 space-y-3">
          <h2
            className="text-sm font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)] mb-4 animate-float-up"
            style={{ animationDelay: '400ms' }}
          >
            Быстрые действия
          </h2>
          <QuickAction
            label="Новый пациент"
            description="Регистрация с паспортом и фото"
            color="#10B981"
            delay={500}
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <line x1="19" x2="19" y1="8" y2="14" />
                <line x1="22" x2="16" y1="11" y2="11" />
              </svg>
            }
          />
          <QuickAction
            label="Записать на приём"
            description="Создать запись к врачу"
            color="#7E78D2"
            delay={600}
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
                <line x1="16" x2="16" y1="2" y2="6" />
                <line x1="8" x2="8" y1="2" y2="6" />
                <line x1="3" x2="21" y1="10" y2="10" />
                <line x1="10" x2="10" y1="14" y2="18" />
                <line x1="12" x2="8" y1="16" y2="16" />
              </svg>
            }
          />
          <QuickAction
            label="Заказать анализы"
            description="Направить в лабораторию"
            color="#3B82F6"
            delay={700}
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                <path d="M14 2v6a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V2" />
                <path d="M10 2v3.3a4 4 0 0 1-1.17 2.83L4 13v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6l-4.83-4.87A4 4 0 0 1 14 5.3V2" />
              </svg>
            }
          />
          <QuickAction
            label="Выписать рецепт"
            description="Назначить медикаменты"
            color="#F59E0B"
            delay={800}
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
                <path d="M14 2v4a2 2 0 0 0 2 2h4" />
                <path d="M10 12h4" />
                <path d="M10 16h4" />
                <path d="M10 8h1" />
              </svg>
            }
          />
        </div>

        {/* Activity Feed */}
        <div className="xl:col-span-2">
          <h2
            className="text-sm font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)] mb-4 animate-float-up"
            style={{ animationDelay: '400ms' }}
          >
            Последняя активность
          </h2>
          <div
            className="bg-[var(--color-surface)] rounded-2xl border border-border p-6 animate-scale-in"
            style={{ animationDelay: '450ms' }}
          >
            <div className="divide-y divide-border">
              <ActivityItem title="Пациент Уметов А.Б. — приём завершён" time="10:24" type="patient" delay={550} />
              <ActivityItem title="Анализ крови (CBC) — результат готов" time="10:15" type="lab" delay={650} />
              <ActivityItem title="Сыдыкова Б.К. — запись на 14:00" time="09:50" type="appointment" delay={750} />
              <ActivityItem title="Парацетамол 500мг — выдано 20 шт." time="09:30" type="pharmacy" delay={850} />
              <ActivityItem title="Жээнбеков К.С. — новый пациент" time="09:15" type="patient" delay={950} />
              <ActivityItem title="Рентген грудной клетки — направление" time="09:00" type="lab" delay={1050} />
              <ActivityItem title="Абдыкалыкова Д.Н. — приём у невролога" time="08:45" type="appointment" delay={1150} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

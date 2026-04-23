import { createFileRoute, Link, Outlet, redirect, useRouterState, useNavigate } from "@tanstack/react-router";
import { usePortalAuthStore } from "@/stores/portal-auth-store";
import { useEffect } from "react";
import { VoiceAssistantProvider } from "@/features/voice-assistant";
import { OnboardingTour } from "@/features/portal/onboarding";
import { ThemeToggle } from "@/features/portal/theme-toggle";

export const Route = createFileRoute("/portal/_portal")({
  beforeLoad: () => {
    if (!usePortalAuthStore.getState().isAuthenticated) {
      throw redirect({ to: "/portal/login" });
    }
  },
  component: PortalLayout,
});

// ---------- nav items ----------

const navItems = [
  {
    label: "Главная",
    to: "/portal/dashboard",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
  },
  {
    label: "Лечение",
    to: "/portal/treatment",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
        <rect width="6" height="4" x="9" y="3" rx="1"/><path d="m9 14 2 2 4-4"/>
      </svg>
    ),
  },
  {
    label: "Расписание",
    to: "/portal/schedule",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <rect width="18" height="18" x="3" y="4" rx="2"/><line x1="16" x2="16" y1="2" y2="6"/>
        <line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/>
        <path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/>
      </svg>
    ),
  },
  {
    label: "Мед. карта",
    to: "/portal/medical-card",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/>
        <path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 12h4"/><path d="M10 16h4"/><path d="M10 8h1"/>
      </svg>
    ),
  },
  {
    label: "Анализы",
    to: "/portal/results",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M14 2v6a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V2"/>
        <path d="M10 2v3.3a4 4 0 0 1-1.17 2.83L4 13v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6l-4.83-4.87A4 4 0 0 1 14 5.3V2"/>
      </svg>
    ),
  },
  {
    label: "Счета",
    to: "/portal/billing",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
      </svg>
    ),
  },
  {
    label: "Упражнения",
    to: "/portal/exercises",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
      </svg>
    ),
  },
  {
    label: "Записи",
    to: "/portal/appointments",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/>
        <line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/>
        <path d="m9 16 2 2 4-4"/>
      </svg>
    ),
  },
  {
    label: "История",
    to: "/portal/history",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
        <path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>
      </svg>
    ),
  },
  {
    label: "Сообщения",
    to: "/portal/messages",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    ),
  },
  {
    label: "Динамика",
    to: "/portal/recovery",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/>
      </svg>
    ),
  },
  {
    label: "Профиль",
    to: "/portal/profile",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
      </svg>
    ),
  },
  {
    label: "AI Помощник",
    to: "/portal/ai-chat",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/>
      </svg>
    ),
  },
  {
    label: "Лекарства",
    to: "/portal/reminders",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/>
      </svg>
    ),
  },
  {
    label: "Семья",
    to: "/portal/family",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
  {
    label: "Оценка врачей",
    to: "/portal/ratings",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
    ),
  },
  {
    label: "Бонусы",
    to: "/portal/loyalty",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4"/><path d="M4 6v12c0 1.1.9 2 2 2h14v-4"/><path d="M18 12a2 2 0 0 0-2 2c0 1.1.9 2 2 2h4v-4h-4z"/>
      </svg>
    ),
  },
  {
    label: "О клинике",
    to: "/portal/clinic-info",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/>
      </svg>
    ),
  },
];

// Bottom bar shows: Главная, Лечение, Расписание, Счета, Профиль
const BOTTOM_BAR_INDICES = [0, 1, 2, 5, 10] as const;
const mobileItems = BOTTOM_BAR_INDICES.map((i) => navItems[i]).filter((item): item is typeof navItems[number] => item != null);

// ---------- layout ----------

function PortalLayout() {
  const { patient, isAuthenticated, fetchProfile, logout } = usePortalAuthStore();
  const navigate = useNavigate();
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;

  useEffect(() => {
    if (isAuthenticated && !patient) fetchProfile();
  }, [isAuthenticated, patient, fetchProfile]);

  if (!isAuthenticated) return null;

  return (
    <VoiceAssistantProvider>
    <OnboardingTour />
    <div className="min-h-screen bg-background">
      {/* Top header */}
      <header className="sticky top-0 z-50 h-14 bg-[var(--color-surface)]/80 backdrop-blur-xl border-b border-border flex items-center justify-between px-4 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-[var(--color-primary-deep)] flex items-center justify-center">
            <svg className="w-4 h-4 text-primary-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          </div>
          <span className="text-sm font-bold text-foreground hidden sm:inline">Портал пациента</span>
        </div>
        <div className="flex items-center gap-3">
          {patient && (
            <span className="text-sm text-[var(--color-text-secondary)] hidden sm:inline">
              {patient.first_name} {patient.last_name}
            </span>
          )}
          <ThemeToggle />
          <button
            onClick={async () => { await logout(); navigate({ to: "/portal/login" }); }}
            className="p-2 rounded-lg text-[var(--color-text-tertiary)] hover:text-destructive hover:bg-destructive/10 transition-all"
            aria-label="Выйти"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>
            </svg>
          </button>
        </div>
      </header>

      {/* Desktop sidebar + content */}
      <div className="flex">
        {/* Desktop sidebar */}
        <nav className="hidden lg:flex flex-col w-[220px] border-r border-border bg-[var(--color-surface)] min-h-[calc(100vh-56px)] p-3 gap-1 sticky top-14">
          {navItems.map((item) => {
            const isActive = currentPath.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`nav-item ${isActive ? "active" : ""}`}
              >
                {item.icon}
                <span className="text-sm">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Main content */}
        <main className="flex-1 p-2.5 sm:p-4 lg:p-8 pb-20 lg:pb-8 min-h-[calc(100vh-56px)]">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom tab bar — 5 key items */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-[var(--color-surface)]/95 backdrop-blur-xl border-t border-border">
        <div className="flex justify-around items-center h-16 px-2">
          {mobileItems.map((item) => {
            const isActive = currentPath.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg transition-colors ${isActive ? "text-secondary" : "text-[var(--color-text-tertiary)]"}`}
              >
                {item.icon}
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
    </VoiceAssistantProvider>
  );
}

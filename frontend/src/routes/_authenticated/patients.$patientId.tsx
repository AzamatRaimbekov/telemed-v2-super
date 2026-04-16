import { createFileRoute, Link, Outlet, useMatchRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { patientsApi } from "@/features/patients/api";

export const Route = createFileRoute("/_authenticated/patients/$patientId")({
  component: PatientDetailLayout,
});

const TABS = [
  { path: "overview",    label: "Обзор",           icon: GridIcon },
  { path: "dynamics",   label: "Динамика",         icon: TrendingUpIcon },
  { path: "history",     label: "История болезни",  icon: ClockIcon },
  { path: "diagnoses",   label: "Диагнозы",         icon: StethoscopeIcon },
  { path: "treatment",   label: "План лечения",     icon: ClipboardIcon },
  { path: "labs",        label: "Анализы",           icon: FlaskIcon },
  { path: "procedures",  label: "Процедуры",         icon: ActivityIcon },
  { path: "medications", label: "Препараты",         icon: PillIcon },
  { path: "stroke",      label: "Инсульт",           icon: BrainIcon },
  { path: "rooms",       label: "Палаты",            icon: BedIcon },
  { path: "monitoring",  label: "Мониторинг",        icon: MonitorIcon },
  { path: "documents",   label: "Документы",         icon: FileIcon },
  { path: "billing",     label: "Биллинг",           icon: DollarIcon },
  { path: "ai",          label: "ИИ Ассистент",     icon: SparklesIcon },
] as const;

type TabPath = (typeof TABS)[number]["path"];

function PatientDetailLayout() {
  const { patientId } = Route.useParams();
  const matchRoute = useMatchRoute();

  const { data: patient, isLoading } = useQuery({
    queryKey: ["patient", patientId],
    queryFn: () => patientsApi.get(patientId),
  });

  const activeTab: TabPath | null = (() => {
    for (const tab of TABS) {
      if (matchRoute({ to: `/patients/$patientId/${tab.path}`, params: { patientId }, fuzzy: true })) {
        return tab.path;
      }
    }
    return null;
  })();

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-64 bg-[var(--color-muted)] rounded-lg" />
        <div className="h-20 bg-[var(--color-muted)] rounded-2xl" />
        <div className="h-12 bg-[var(--color-muted)] rounded-xl" />
        <div className="h-48 bg-[var(--color-muted)] rounded-xl" />
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-12 text-center">
        <p className="text-[var(--color-text-secondary)]">Пациент не найден</p>
      </div>
    );
  }

  const statusLabels: Record<string, string> = {
    ACTIVE: "Активен",
    DISCHARGED: "Выписан",
    DECEASED: "Умер",
  };
  const statusColors: Record<string, string> = {
    ACTIVE: "bg-success/10 text-success",
    DISCHARGED: "bg-[var(--color-muted)] text-[var(--color-text-secondary)]",
    DECEASED: "bg-destructive/10 text-destructive",
  };

  return (
    <div className="w-full">
      {/* Back link */}
      <Link
        to="/patients"
        className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-foreground mb-4 transition-colors animate-float-up"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="m12 19-7-7 7-7" />
          <path d="M19 12H5" />
        </svg>
        К списку пациентов
      </Link>

      {/* Patient header */}
      <div className="flex items-center gap-4 mb-4 animate-float-up" style={{ animationDelay: "50ms" }}>
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-[var(--color-primary-deep)] flex items-center justify-center text-lg font-bold text-primary-foreground shadow-sm flex-shrink-0">
          {patient.first_name?.[0]}
          {patient.last_name?.[0]}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-[22px] font-bold text-foreground leading-tight">
            {patient.last_name} {patient.first_name} {patient.middle_name || ""}
          </h1>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            {patient.medical_card && (
              <span className="text-xs font-mono text-[var(--color-text-tertiary)]">
                Карта {patient.medical_card.card_number}
              </span>
            )}
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                statusColors[patient.status] || "bg-[var(--color-muted)] text-[var(--color-text-secondary)]"
              }`}
            >
              {statusLabels[patient.status] || patient.status}
            </span>
            {patient.date_of_birth && (
              <span className="text-xs text-[var(--color-text-tertiary)]">
                {calculateAge(patient.date_of_birth)} лет
              </span>
            )}
            {patient.blood_type && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-secondary/10 text-secondary font-medium">
                {patient.blood_type}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Allergy banner */}
      {patient.allergies && patient.allergies.length > 0 && (
        <div
          className="mb-4 p-3 rounded-xl bg-destructive/10 border border-destructive/20 flex items-center gap-3 animate-float-up"
          style={{ animationDelay: "80ms" }}
        >
          <svg
            className="w-5 h-5 text-destructive flex-shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
          </svg>
          <p className="text-sm text-destructive">
            <strong>Аллергии:</strong> {patient.allergies.join(", ")}
          </p>
        </div>
      )}

      {/* Tab navigation */}
      <div className="relative mb-6 animate-float-up" style={{ animationDelay: "100ms" }}>
        {/* Fade indicators for scroll */}
        <div className="absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none rounded-l-xl opacity-0 transition-opacity" id="tab-fade-left" />
        <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none rounded-r-xl" id="tab-fade-right" />
        <div
          className="flex gap-1 p-1 bg-[var(--color-muted)] rounded-xl overflow-x-auto"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none", WebkitOverflowScrolling: "touch" }}
        >
          {TABS.map((tab) => {
            const isActive = activeTab === tab.path;
            const Icon = tab.icon;
            return (
              <Link
                key={tab.path}
                to={`/patients/$patientId/${tab.path}` as never}
                params={{ patientId } as never}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-medium whitespace-nowrap transition-all flex-shrink-0 ${
                  isActive
                    ? "bg-[var(--color-surface)] text-foreground shadow-sm"
                    : "text-[var(--color-text-secondary)] hover:text-foreground"
                }`}
              >
                <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.label.split(" ")[0]}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Child route content */}
      <div className="animate-float-up" style={{ animationDelay: "150ms" }}>
        <Outlet />
      </div>
    </div>
  );
}

function calculateAge(dateOfBirth: string): number {
  const today = new Date();
  const birth = new Date(dateOfBirth);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

// ─── Tab Icons ────────────────────────────────────────────────────────────────

function GridIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect width="7" height="7" x="3" y="3" rx="1" />
      <rect width="7" height="7" x="14" y="3" rx="1" />
      <rect width="7" height="7" x="14" y="14" rx="1" />
      <rect width="7" height="7" x="3" y="14" rx="1" />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function StethoscopeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6 6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3" />
      <path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4" />
      <circle cx="20" cy="10" r="2" />
    </svg>
  );
}

function ClipboardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="M12 11h4" />
      <path d="M12 16h4" />
      <path d="M8 11h.01" />
      <path d="M8 16h.01" />
    </svg>
  );
}

function FlaskIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2v6a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V2" />
      <path d="M10 2v3.3a4 4 0 0 1-1.17 2.83L4 13v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6l-4.83-4.87A4 4 0 0 1 14 5.3V2" />
    </svg>
  );
}

function ActivityIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

function PillIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z" />
      <path d="m8.5 8.5 7 7" />
    </svg>
  );
}

function BrainIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" />
      <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" />
      <path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4" />
      <path d="M17.599 6.5a3 3 0 0 0 .399-1.375" />
      <path d="M6.003 5.125A3 3 0 0 0 6.401 6.5" />
      <path d="M3.477 10.896a4 4 0 0 1 .585-.396" />
      <path d="M19.938 10.5a4 4 0 0 1 .585.396" />
      <path d="M6 18a4 4 0 0 1-1.967-.516" />
      <path d="M19.967 17.484A4 4 0 0 1 18 18" />
    </svg>
  );
}

function MonitorIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}

function BedIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 4v16" />
      <path d="M2 8h18a2 2 0 0 1 2 2v10" />
      <path d="M2 17h20" />
      <path d="M6 8v9" />
    </svg>
  );
}

function FileIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
    </svg>
  );
}

function DollarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" x2="12" y1="2" y2="22" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}

function TrendingUpIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </svg>
  );
}

function SparklesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
      <path d="M20 3v4" />
      <path d="M22 5h-4" />
      <path d="M4 17v2" />
      <path d="M5 18H3" />
    </svg>
  );
}

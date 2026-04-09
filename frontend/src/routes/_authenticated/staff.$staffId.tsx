import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { staffApi } from "@/features/staff/api";
import { patientsApi } from "@/features/patients/api";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/staff/$staffId")({
  validateSearch: (search: Record<string, unknown>) => ({
    tab: (search.tab as string) || "profile",
  }),
  component: StaffDetailPage,
});

const TABS = [
  { key: "profile", label: "Профиль" },
  { key: "qualifications", label: "Квалификация" },
  { key: "patients", label: "Пациенты" },
  { key: "permissions", label: "Доступ" },
];

const employmentTypeLabels: Record<string, string> = {
  FULL: "Полная занятость",
  PART: "Частичная занятость",
  CONTRACT: "Совместитель",
  INTERN: "Стажёр",
};

// Generate a deterministic hue from a string for the template badge
function templateColorClass(name: string): string {
  const colors = [
    "bg-secondary/10 text-secondary",
    "bg-success/10 text-success",
    "bg-warning/10 text-warning",
    "bg-primary/10 text-[var(--color-primary-deep)]",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) & 0xffff;
  return colors[hash % colors.length];
}

function StaffDetailPage() {
  const { staffId } = Route.useParams();
  const { tab } = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const setTab = (newTab: string) => {
    navigate({ search: { tab: newTab }, replace: true });
  };

  const { data: staff, isLoading } = useQuery({
    queryKey: ["staff", staffId],
    queryFn: () => staffApi.get(staffId),
  });

  const { data: permissionsData } = useQuery({
    queryKey: ["staff-permissions", staffId],
    queryFn: () => staffApi.getPermissions(staffId),
    enabled: tab === "permissions",
  });

  // Load ALL permissions for the matrix
  const { data: allPermsData } = useQuery({
    queryKey: ["all-permissions"],
    queryFn: () => staffApi.listPermissions(),
    enabled: tab === "permissions",
  });

  // Load assigned patients
  const { data: assignedPatients } = useQuery({
    queryKey: ["staff-patients", staff?.user_id],
    queryFn: () => patientsApi.list({ doctor_id: staff!.user_id }),
    enabled: tab === "patients" && !!staff?.user_id,
  });

  const grantMutation = useMutation({
    mutationFn: (code: string) => staffApi.grantPermission(staffId, { permission_code: code }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-permissions", staffId] });
      toast.success("Право добавлено");
    },
    onError: () => toast.error("Ошибка"),
  });

  const revokeMutation = useMutation({
    mutationFn: (code: string) => staffApi.revokePermission(staffId, { permission_code: code }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-permissions", staffId] });
      toast.success("Право отозвано");
    },
    onError: () => toast.error("Ошибка"),
  });

  const deactivateMutation = useMutation({
    mutationFn: () => staffApi.deactivate(staffId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff", staffId] });
      toast.success("Сотрудник деактивирован");
    },
    onError: () => toast.error("Ошибка деактивации"),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: () => staffApi.resetPassword(staffId),
    onSuccess: (data) => {
      if (data?.temp_password) {
        toast.success(`Временный пароль: ${data.temp_password}`, { duration: 10000 });
      } else {
        toast.success("Пароль сброшен, инструкции отправлены");
      }
    },
    onError: () => toast.error("Ошибка сброса пароля"),
  });

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-64 bg-[var(--color-muted)] rounded-lg" />
        <div className="h-48 bg-[var(--color-muted)] rounded-xl" />
      </div>
    );
  }

  if (!staff) return <div className="text-[var(--color-text-secondary)]">Сотрудник не найден</div>;

  const qualifications: Record<string, any>[] = staff.qualifications || [];
  const extraFields: Record<string, any>[] = staff.extra_fields || [];
  // permissionsData = { permissions: ["patients:create", ...] } — array of code strings
  const permCodes: string[] = Array.isArray(permissionsData?.permissions)
    ? permissionsData.permissions
    : Array.isArray(permissionsData) ? permissionsData : [];

  // Group permission codes by prefix (e.g. "patients:create" → group "patients")
  const groupLabels: Record<string, string> = {
    patients: "Пациенты", medical_card: "Мед. карта", treatment: "Лечение",
    pharmacy: "Аптека", lab: "Лаборатория", schedule: "Расписание",
    billing: "Биллинг", staff: "Персонал", reports: "Отчёты",
  };
  const groupedPermissions: Record<string, string[]> = {};
  for (const code of permCodes) {
    const prefix = code.split(":")[0] || "other";
    const group = groupLabels[prefix] || prefix;
    if (!groupedPermissions[group]) groupedPermissions[group] = [];
    groupedPermissions[group].push(code);
  }

  // Check qualification expiry
  const today = new Date();
  const warnThreshold = 90 * 24 * 60 * 60 * 1000; // 90 days in ms

  function expiryStatus(expires: string | null): "ok" | "warn" | "expired" | "none" {
    if (!expires) return "none";
    const exp = new Date(expires);
    const diff = exp.getTime() - today.getTime();
    if (diff < 0) return "expired";
    if (diff < warnThreshold) return "warn";
    return "ok";
  }

  const patientStatusLabels: Record<string, string> = { ACTIVE: "Активен", DISCHARGED: "Выписан" };
  const patientStatusColors: Record<string, string> = { ACTIVE: "bg-success/10 text-success", DISCHARGED: "bg-[var(--color-muted)] text-[var(--color-text-secondary)]" };

  return (
    <div className="max-w-6xl">
      {/* Back */}
      <Link
        to="/staff"
        className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-foreground mb-4 transition-colors animate-float-up"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>
        </svg>
        К списку сотрудников
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-6 animate-float-up" style={{ animationDelay: "50ms" }}>
        <div className="flex items-center gap-4">
          {staff.photo_url ? (
            <img
              src={staff.photo_url}
              alt=""
              className="w-14 h-14 rounded-2xl object-cover shadow-sm"
            />
          ) : (
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-secondary/20 to-secondary/40 flex items-center justify-center text-lg font-bold text-secondary shadow-sm">
              {staff.first_name?.[0]}{staff.last_name?.[0]}
            </div>
          )}
          <div>
            <h1 className="text-[22px] font-bold text-foreground">
              {staff.last_name} {staff.first_name} {staff.middle_name || ""}
            </h1>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              {staff.position && (
                <span className="text-sm text-[var(--color-text-secondary)]">{staff.position}</span>
              )}
              {staff.template_name && (
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${templateColorClass(staff.template_name)}`}>
                  {staff.template_name}
                </span>
              )}
              <Badge variant={staff.is_active !== false ? "success" : "muted"} dot>
                {staff.is_active !== false ? "Активен" : "Деактивирован"}
              </Badge>
            </div>
          </div>
        </div>

        <div className="flex gap-2 flex-shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => resetPasswordMutation.mutate()}
            loading={resetPasswordMutation.isPending}
          >
            Сбросить пароль
          </Button>
          {staff.is_active !== false && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                if (confirm("Деактивировать сотрудника?")) deactivateMutation.mutate();
              }}
              loading={deactivateMutation.isPending}
            >
              Деактивировать
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div
        className="flex gap-1 p-1 bg-[var(--color-muted)] rounded-xl mb-6 overflow-x-auto animate-float-up"
        style={{ animationDelay: "100ms" }}
      >
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
              tab === t.key
                ? "bg-[var(--color-surface)] text-foreground shadow-sm"
                : "text-[var(--color-text-secondary)] hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="animate-float-up" style={{ animationDelay: "150ms" }}>

        {/* ── Tab: Профиль ── */}
        {tab === "profile" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Personal data */}
            <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-6">
              <h3 className="text-sm font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-4">
                Личные данные
              </h3>
              <div className="space-y-3">
                {[
                  { label: "Дата рождения", value: formatDate(staff.date_of_birth) },
                  { label: "Пол", value: staff.gender === "MALE" ? "Мужской" : staff.gender === "FEMALE" ? "Женский" : "Не указан" },
                  { label: "Телефон (личный)", value: staff.phone_personal || "—" },
                  { label: "Email (личный)", value: staff.email_personal || "—" },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between gap-4">
                    <span className="text-sm text-[var(--color-text-secondary)] flex-shrink-0">{label}</span>
                    <span className="text-sm font-medium text-foreground text-right">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Work data */}
            <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-6">
              <h3 className="text-sm font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-4">
                Рабочие данные
              </h3>
              <div className="space-y-3">
                {[
                  { label: "Должность", value: staff.position || "—" },
                  { label: "Уровень", value: staff.position_level || "—" },
                  { label: "Специализация", value: staff.specialization || "—" },
                  { label: "Отдел", value: staff.department_name || staff.department || "—" },
                  { label: "Секция", value: staff.section || "—" },
                  { label: "Тип занятости", value: employmentTypeLabels[staff.employment_type] || staff.employment_type || "—" },
                  { label: "Телефон (рабочий)", value: staff.work_phone || "—" },
                  { label: "Email (рабочий)", value: staff.work_email || "—" },
                  { label: "Кабинет", value: staff.office_room || "—" },
                  { label: "Расписание", value: staff.work_schedule || "—" },
                  { label: "Дата приёма", value: formatDate(staff.employment_start) },
                  { label: "Дата окончания", value: staff.employment_end ? formatDate(staff.employment_end) : "—" },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between gap-4">
                    <span className="text-sm text-[var(--color-text-secondary)] flex-shrink-0">{label}</span>
                    <span className="text-sm font-medium text-foreground text-right">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Dynamic extra fields */}
            {extraFields.length > 0 && (
              <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-6 lg:col-span-2">
                <h3 className="text-sm font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-4">
                  Дополнительные данные
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {extraFields.map((field: Record<string, any>) => (
                    <div key={field.key || field.label} className="flex flex-col gap-0.5">
                      <span className="text-xs text-[var(--color-text-tertiary)] uppercase tracking-wider">
                        {field.label || field.key}
                      </span>
                      <span className="text-sm font-medium text-foreground">
                        {Array.isArray(field.value)
                          ? field.value.join(", ") || "—"
                          : field.value != null
                          ? String(field.value)
                          : "—"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Квалификация ── */}
        {tab === "qualifications" && (
          <div className="space-y-3">
            {qualifications.length === 0 ? (
              <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-8 text-center">
                <svg className="w-10 h-10 mx-auto mb-3 text-[var(--color-text-tertiary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>
                </svg>
                <p className="text-[var(--color-text-secondary)]">Нет документов о квалификации</p>
              </div>
            ) : qualifications.map((q: Record<string, any>, idx: number) => {
              const status = expiryStatus(q.expires);
              return (
                <div key={q.id || idx} className="bg-[var(--color-surface)] rounded-2xl border border-border p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        status === "expired" ? "bg-destructive/10 text-destructive"
                        : status === "warn" ? "bg-warning/10 text-warning"
                        : "bg-success/10 text-success"
                      }`}>
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <path d="M14 2v6a2 2 0 0 0 2 2h0"/><path d="M4 6V4a2 2 0 0 1 2-2h8.5L20 7.5V20a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2"/>
                          <path d="m9 18 2 2 4-4"/>
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{q.label || q.title || "Документ"}</p>
                        <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">
                          {q.type === "LICENSE" ? "Лицензия" : q.type === "CERTIFICATE" ? "Сертификат" : q.type === "DIPLOMA" ? "Диплом" : q.type || "Документ"}
                          {q.value ? ` · ${q.value}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      {q.issued && (
                        <p className="text-xs text-[var(--color-text-tertiary)]">Выдан: {formatDate(q.issued)}</p>
                      )}
                      {q.expires && (
                        <div className="mt-0.5">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            status === "expired" ? "bg-destructive/10 text-destructive"
                            : status === "warn" ? "bg-warning/10 text-warning"
                            : "bg-success/10 text-success"
                          }`}>
                            {status === "expired" ? "Истёк" : status === "warn" ? "Истекает скоро" : "Действителен"}: {formatDate(q.expires)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Tab: Пациенты ── */}
        {tab === "patients" && (
          <div className="bg-[var(--color-surface)] rounded-2xl border border-border overflow-hidden">
            {!assignedPatients ? (
              <div className="p-8 text-center">
                <div className="animate-pulse space-y-2">
                  {[1,2,3].map(i => <div key={i} className="h-12 bg-[var(--color-muted)] rounded-lg" />)}
                </div>
              </div>
            ) : (assignedPatients?.items || assignedPatients || []).length === 0 ? (
              <div className="p-8 text-center">
                <svg className="w-10 h-10 mx-auto mb-3 text-[var(--color-text-tertiary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
                <p className="text-[var(--color-text-secondary)]">Нет прикреплённых пациентов</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      {["Пациент", "Дата рождения", "Статус", ""].map(h => (
                        <th key={h} className="text-left p-3 text-xs font-semibold text-[var(--color-text-tertiary)] uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {((assignedPatients?.items || assignedPatients) as Array<Record<string, any>>).map((p: Record<string, any>) => (
                      <tr key={p.id} className="hover:bg-[var(--color-muted)]/50">
                        <td className="p-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center text-xs font-bold text-[var(--color-primary-deep)] flex-shrink-0">
                              {p.first_name?.[0]}{p.last_name?.[0]}
                            </div>
                            <span className="font-medium text-foreground">{p.last_name} {p.first_name} {p.middle_name || ""}</span>
                          </div>
                        </td>
                        <td className="p-3 text-[var(--color-text-secondary)]">
                          {p.date_of_birth ? formatDate(p.date_of_birth) : "—"}
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${patientStatusColors[p.status] || "bg-[var(--color-muted)] text-[var(--color-text-secondary)]"}`}>
                            {patientStatusLabels[p.status] || p.status}
                          </span>
                        </td>
                        <td className="p-3">
                          <Link
                            to="/patients/$patientId"
                            params={{ patientId: p.id }}
                            search={{ tab: "profile" }}
                            className="text-xs text-secondary hover:text-secondary/80 font-medium transition-colors"
                          >
                            Открыть
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Доступ (интерактивная матрица) ── */}
        {tab === "permissions" && (() => {
          const allGroups: Record<string, any>[] = Array.isArray(allPermsData) ? allPermsData : [];
          const activePerms = new Set(permCodes);
          const totalActive = permCodes.length;
          const totalAll = allGroups.reduce((sum, g) => sum + (g.permissions?.length || 0), 0);

          return (
            <div className="space-y-4">
              {/* Header */}
              <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-foreground mb-1">Матрица доступа</p>
                    <div className="flex items-center gap-2">
                      {staff.template?.name ? (
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium`}
                          style={{ background: `${staff.template.color || '#7E78D2'}15`, color: staff.template.color || '#7E78D2' }}>
                          {staff.template.name}
                        </span>
                      ) : staff.template_name ? (
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${templateColorClass(staff.template_name)}`}>
                          {staff.template_name}
                        </span>
                      ) : (
                        <span className="text-xs text-[var(--color-text-tertiary)]">Шаблон не назначен</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-foreground">{totalActive}<span className="text-sm font-normal text-[var(--color-text-tertiary)]">/{totalAll}</span></p>
                    <p className="text-xs text-[var(--color-text-tertiary)]">прав активно</p>
                  </div>
                </div>
              </div>

              {/* Info */}
              <div className="flex items-center gap-2 px-1 text-xs text-[var(--color-text-tertiary)]">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" />
                </svg>
                Нажмите на переключатель чтобы добавить или отозвать право доступа
              </div>

              {/* Permission matrix by group */}
              {allGroups.length === 0 ? (
                <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-8 text-center">
                  <p className="text-[var(--color-text-secondary)]">Загрузка прав...</p>
                </div>
              ) : allGroups.map((group: Record<string, any>) => {
                const perms: Record<string, any>[] = group.permissions || [];
                const activeInGroup = perms.filter(p => activePerms.has(p.code)).length;
                return (
                  <div key={group.id || group.code} className="bg-[var(--color-surface)] rounded-2xl border border-border overflow-hidden">
                    <div className="px-5 py-3 bg-[var(--color-muted)]/40 border-b border-border flex items-center justify-between">
                      <h4 className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">
                        {group.label_ru || group.code}
                      </h4>
                      <span className="text-xs text-[var(--color-text-tertiary)]">
                        <span className="font-semibold text-foreground">{activeInGroup}</span>/{perms.length}
                      </span>
                    </div>
                    <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {perms.map((perm: Record<string, any>) => {
                        const isActive = activePerms.has(perm.code);
                        const isToggling = grantMutation.isPending || revokeMutation.isPending;
                        return (
                          <label
                            key={perm.code}
                            className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all duration-200 ${
                              isActive
                                ? "bg-secondary/6 hover:bg-secondary/10"
                                : "hover:bg-[var(--color-muted)]/60"
                            } ${isToggling ? "opacity-60 pointer-events-none" : ""}`}
                          >
                            {/* Custom toggle */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                if (isActive) {
                                  revokeMutation.mutate(perm.code);
                                } else {
                                  grantMutation.mutate(perm.code);
                                }
                              }}
                              className={`relative w-9 h-5 rounded-full transition-colors duration-200 flex-shrink-0 ${
                                isActive ? "bg-secondary" : "bg-[var(--color-border)]"
                              }`}
                            >
                              <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                                isActive ? "translate-x-4" : "translate-x-0"
                              }`} />
                            </button>
                            <div className="min-w-0 flex-1">
                              <p className={`text-sm leading-snug ${isActive ? "text-foreground font-medium" : "text-[var(--color-text-secondary)]"}`}>
                                {perm.label_ru || perm.code}
                              </p>
                              {perm.description && (
                                <p className="text-[10px] text-[var(--color-text-tertiary)] truncate mt-0.5">{perm.description}</p>
                              )}
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>
    </div>
  );
}

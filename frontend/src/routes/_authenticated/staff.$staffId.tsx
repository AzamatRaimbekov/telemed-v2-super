import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { staffApi } from "@/features/staff/api";
import { useState } from "react";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/staff/$staffId")({
  component: StaffDetailPage,
});

const TABS = ["Профиль", "Квалификация", "Доступ"];

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
  const [tab, setTab] = useState(0);
  const queryClient = useQueryClient();

  const { data: staff, isLoading } = useQuery({
    queryKey: ["staff", staffId],
    queryFn: () => staffApi.get(staffId),
  });

  const { data: permissionsData } = useQuery({
    queryKey: ["staff-permissions", staffId],
    queryFn: () => staffApi.getPermissions(staffId),
    enabled: tab === 2,
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
  const permissions: Record<string, any>[] = permissionsData?.effective || permissionsData || [];

  // Group permissions by group name
  const groupedPermissions: Record<string, Record<string, any>[]> = {};
  for (const perm of permissions) {
    const group = perm.group_name || perm.group || "Прочее";
    if (!groupedPermissions[group]) groupedPermissions[group] = [];
    groupedPermissions[group].push(perm);
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
        {TABS.map((t, i) => (
          <button
            key={t}
            onClick={() => setTab(i)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
              tab === i
                ? "bg-[var(--color-surface)] text-foreground shadow-sm"
                : "text-[var(--color-text-secondary)] hover:text-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="animate-float-up" style={{ animationDelay: "150ms" }}>

        {/* ── Tab 0: Профиль ── */}
        {tab === 0 && (
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

        {/* ── Tab 1: Квалификация ── */}
        {tab === 1 && (
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

        {/* ── Tab 2: Доступ ── */}
        {tab === 2 && (
          <div className="space-y-4">
            {/* Template info */}
            <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground mb-1">Шаблон доступа</p>
                  {staff.template_name ? (
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${templateColorClass(staff.template_name)}`}>
                      {staff.template_name}
                    </span>
                  ) : (
                    <span className="text-sm text-[var(--color-text-tertiary)]">Шаблон не назначен</span>
                  )}
                </div>
                {permissionsData && (
                  <div className="text-right text-sm text-[var(--color-text-secondary)]">
                    <span className="text-green-600 font-medium">+{permissionsData.added_count ?? 0}</span>
                    {" · "}
                    <span className="text-red-500 font-medium">−{permissionsData.removed_count ?? 0}</span>
                    {" · Итого: "}
                    <span className="font-semibold text-foreground">{permissions.length}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Grouped permissions */}
            {Object.keys(groupedPermissions).length === 0 ? (
              <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-8 text-center">
                <p className="text-[var(--color-text-secondary)]">Нет назначенных прав</p>
              </div>
            ) : Object.entries(groupedPermissions).map(([group, perms]) => (
              <div key={group} className="bg-[var(--color-surface)] rounded-2xl border border-border p-5">
                <h4 className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-3">
                  {group}
                </h4>
                <div className="space-y-2">
                  {perms.map((perm: Record<string, any>) => (
                    <div key={perm.code || perm.permission_code} className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        {perm.is_override_add && (
                          <span className="w-2 h-2 rounded-full bg-success flex-shrink-0" title="Добавлено вручную" />
                        )}
                        {perm.is_override_remove && (
                          <span className="w-2 h-2 rounded-full bg-destructive flex-shrink-0" title="Удалено вручную" />
                        )}
                        {!perm.is_override_add && !perm.is_override_remove && (
                          <span className="w-2 h-2 rounded-full bg-[var(--color-text-tertiary)]/30 flex-shrink-0" />
                        )}
                        <span className="text-sm text-foreground">{perm.name || perm.permission_name || perm.code}</span>
                      </div>
                      <span className="text-xs font-mono text-[var(--color-text-tertiary)]">
                        {perm.code || perm.permission_code}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

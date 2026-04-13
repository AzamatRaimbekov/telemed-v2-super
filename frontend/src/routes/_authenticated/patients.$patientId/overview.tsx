import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { patientsApi } from "@/features/patients/api";
import { formatDate, formatDateTime } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";
import { InputField } from "@/components/ui/input-field";
import { Badge } from "@/components/ui/badge";
import { CustomSelect } from "@/components/ui/select-custom";


export const Route = createFileRoute(
  "/_authenticated/patients/$patientId/overview"
)({
  component: OverviewPage,
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AuditLogEntry {
  id: string;
  action: string;
  user_name: string;
  user_role: string;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  created_at: string;
  ip_address: string | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ACTION_META: Record<string, { label: string; variant: "success" | "secondary" | "destructive" | "warning" | "primary" | "muted" }> = {
  patient_created: { label: "Создание", variant: "success" },
  patient_updated: { label: "Изменение", variant: "secondary" },
  patient_deleted: { label: "Удаление", variant: "destructive" },
  portal_password_reset: { label: "Сброс пароля", variant: "warning" },
  lab_result_approved: { label: "Результат анализа", variant: "primary" },
  room_transfer: { label: "Перевод палаты", variant: "secondary" },
};

const AUDIT_ACTION_OPTIONS = [
  { value: "", label: "Все действия" },
  { value: "patient_created", label: "Создание" },
  { value: "patient_updated", label: "Изменение" },
  { value: "patient_deleted", label: "Удаление" },
  { value: "portal_password_reset", label: "Сброс пароля" },
  { value: "lab_result_approved", label: "Результат анализа" },
  { value: "room_transfer", label: "Перевод палаты" },
];

const AUDIT_PAGE_SIZE = 20;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatAuditChanges(
  action: string,
  oldValues: Record<string, unknown> | null,
  newValues: Record<string, unknown> | null
): React.ReactNode {
  if (action === "portal_password_reset") {
    return (
      <span className="text-sm text-[var(--color-text-secondary)]">
        Пароль портала изменён
      </span>
    );
  }

  if (action === "lab_result_approved" && newValues) {
    const visible = newValues.visible_to_patient;
    return (
      <span className="text-sm text-[var(--color-text-secondary)]">
        Видимость пациенту:{" "}
        <span className="font-medium text-foreground">
          {visible ? "да" : "нет"}
        </span>
      </span>
    );
  }

  if (action === "patient_updated" && oldValues && newValues) {
    const changedKeys = Object.keys(newValues).filter(
      (k) => JSON.stringify(oldValues[k]) !== JSON.stringify(newValues[k])
    );
    if (changedKeys.length === 0) return null;
    return (
      <div className="space-y-1">
        {changedKeys.map((key) => (
          <div key={key} className="flex items-baseline gap-1.5 text-sm flex-wrap">
            <span className="text-[var(--color-text-tertiary)] font-mono text-xs">
              {key}:
            </span>
            <span className="text-[var(--color-text-secondary)] line-through text-xs">
              {String(oldValues[key] ?? "—")}
            </span>
            <span className="text-[var(--color-text-tertiary)] text-xs">→</span>
            <span className="text-foreground font-medium text-xs">
              {String(newValues[key] ?? "—")}
            </span>
          </div>
        ))}
      </div>
    );
  }

  // Fallback: raw JSON summary
  const payload = newValues ?? oldValues;
  if (!payload) return null;
  return (
    <pre className="text-xs text-[var(--color-text-tertiary)] bg-[var(--color-muted)] rounded-lg p-2 overflow-x-auto max-w-full whitespace-pre-wrap break-all">
      {JSON.stringify(payload, null, 2)}
    </pre>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function PortalPasswordSection({ patientId }: { patientId: string }) {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const canReset =
    user && ["SUPER_ADMIN", "CLINIC_ADMIN", "DOCTOR"].includes(user.role);

  const { data: patient } = useQuery({
    queryKey: ["patient", patientId],
    queryFn: () => patientsApi.get(patientId),
  });

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const resetMutation = useMutation({
    mutationFn: (password: string) =>
      patientsApi.resetPortalPassword(patientId, password),
    onSuccess: () => {
      toast.success("Пароль портала обновлён");
      setNewPassword("");
      setConfirmPassword("");
      setValidationError(null);
      queryClient.invalidateQueries({ queryKey: ["patient", patientId] });
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? "Не удалось обновить пароль";
      toast.error(message);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setValidationError(null);

    if (newPassword.length < 6) {
      setValidationError("Минимум 6 символов");
      return;
    }
    if (newPassword !== confirmPassword) {
      setValidationError("Пароли не совпадают");
      return;
    }

    resetMutation.mutate(newPassword);
  }

  const hasPortalPassword = (patient as Record<string, unknown> | undefined)
    ?.has_portal_password as boolean | undefined;
  const lastPortalLogin = (patient as Record<string, unknown> | undefined)
    ?.last_portal_login as string | null | undefined;

  return (
    <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-6 animate-float-up">
      <h3 className="text-sm font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-4">
        Портал пациента
      </h3>

      {/* Status row */}
      <div className="space-y-3 mb-6">
        <div className="flex justify-between items-center gap-4">
          <span className="text-sm text-[var(--color-text-secondary)]">
            Пароль портала
          </span>
          {hasPortalPassword === undefined ? (
            <span className="text-sm text-[var(--color-text-tertiary)]">—</span>
          ) : hasPortalPassword ? (
            <Badge variant="success" dot>
              Установлен
            </Badge>
          ) : (
            <Badge variant="muted" dot>
              Не установлен
            </Badge>
          )}
        </div>
        <div className="flex justify-between items-center gap-4">
          <span className="text-sm text-[var(--color-text-secondary)]">
            Последний вход
          </span>
          <span className="text-sm font-medium text-foreground">
            {lastPortalLogin ? formatDateTime(lastPortalLogin) : "Никогда"}
          </span>
        </div>
      </div>

      {/* Password reset form — privileged roles only */}
      {canReset && (
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="border-t border-border pt-4">
            <p className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-3">
              Сменить пароль
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <InputField
                type="password"
                label="Новый пароль портала"
                placeholder="Минимум 6 символов"
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  setValidationError(null);
                }}
                autoComplete="new-password"
              />
              <InputField
                type="password"
                label="Подтвердите пароль"
                placeholder="Повторите пароль"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setValidationError(null);
                }}
                autoComplete="new-password"
                error={validationError ?? undefined}
              />
            </div>
            <div className="mt-3 flex justify-end">
              <Button
                type="submit"
                variant="primary"
                size="sm"
                loading={resetMutation.isPending}
                disabled={!newPassword || !confirmPassword}
              >
                Сменить пароль
              </Button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}

function AuditLogSection({ patientId }: { patientId: string }) {
  const [actionFilter, setActionFilter] = useState("");
  const [page, setPage] = useState(0);
  const [allEntries, setAllEntries] = useState<AuditLogEntry[]>([]);
  const prevFilterRef = useRef(actionFilter);
  const seenPageKeyRef = useRef("");

  const { data, isFetching, refetch } = useQuery({
    queryKey: ["patient-audit-logs", patientId, actionFilter, page],
    queryFn: async () => {
      const result = await patientsApi.getAuditLogs(patientId, {
        skip: page * AUDIT_PAGE_SIZE,
        limit: AUDIT_PAGE_SIZE,
        action: actionFilter || undefined,
      });
      const items: AuditLogEntry[] = Array.isArray(result)
        ? result
        : ((result as Record<string, unknown>).items as AuditLogEntry[] ?? []);
      return items;
    },
  });

  // Reset when filter changes
  useEffect(() => {
    if (prevFilterRef.current !== actionFilter) {
      prevFilterRef.current = actionFilter;
      setAllEntries([]);
      setPage(0);
    }
  }, [actionFilter]);

  // Merge newly fetched page into accumulated list
  useEffect(() => {
    if (!data) return;
    const pageKey = `${actionFilter}-${page}`;
    if (seenPageKeyRef.current === pageKey) return;
    seenPageKeyRef.current = pageKey;
    setAllEntries((prev) => {
      const existingIds = new Set(prev.map((e) => e.id));
      const fresh = data.filter((e) => !existingIds.has(e.id));
      return fresh.length > 0 ? [...prev, ...fresh] : prev;
    });
  }, [data, actionFilter, page]);

  function handleFilterChange(value: string) {
    setActionFilter(value);
  }

  function handleLoadMore() {
    setPage((p) => p + 1);
  }

  function handleRefresh() {
    setAllEntries([]);
    seenPageKeyRef.current = "";
    setPage(0);
    refetch();
  }

  const hasMore = data?.length === AUDIT_PAGE_SIZE;

  return (
    <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-6 animate-float-up">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <h3 className="text-sm font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">
          Журнал действий
        </h3>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={isFetching}
          className="p-1.5 rounded-lg text-[var(--color-text-tertiary)] hover:text-foreground hover:bg-[var(--color-muted)] transition-colors disabled:opacity-40"
          aria-label="Обновить журнал"
        >
          <svg
            className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
            <path d="M21 3v5h-5" />
            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
            <path d="M8 16H3v5" />
          </svg>
        </button>
      </div>

      {/* Filter */}
      <div className="mb-4 max-w-xs">
        <CustomSelect
          value={actionFilter}
          onChange={handleFilterChange}
          options={AUDIT_ACTION_OPTIONS}
          placeholder="Все действия"
        />
      </div>

      {/* Log entries */}
      {allEntries.length === 0 && !isFetching ? (
        <p className="text-sm text-[var(--color-text-tertiary)] py-6 text-center">
          Записей не найдено
        </p>
      ) : (
        <div className="divide-y divide-border">
          {allEntries.map((entry) => {
            const meta = ACTION_META[entry.action] ?? {
              label: entry.action,
              variant: "muted" as const,
            };
            return (
              <div key={entry.id} className="py-4 first:pt-0 last:pb-0">
                <div className="flex items-start justify-between gap-3 mb-1.5 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={meta.variant}>{meta.label}</Badge>
                    <span className="text-sm font-medium text-foreground">
                      {entry.user_name}
                    </span>
                    <Badge variant="muted">{entry.user_role}</Badge>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-[var(--color-text-secondary)]">
                      {formatDateTime(entry.created_at)}
                    </p>
                    {entry.ip_address && (
                      <p className="text-[10px] text-[var(--color-text-tertiary)] mt-0.5 font-mono">
                        {entry.ip_address}
                      </p>
                    )}
                  </div>
                </div>
                <div className="pl-0.5">
                  {formatAuditChanges(
                    entry.action,
                    entry.old_values,
                    entry.new_values
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {hasMore && (
        <div className="mt-4 flex justify-center">
          <Button
            variant="outline"
            size="sm"
            loading={isFetching}
            onClick={handleLoadMore}
          >
            Показать ещё
          </Button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

function OverviewPage() {
  const { patientId } = Route.useParams();
  const user = useAuthStore((s) => s.user);

  const isAdmin =
    user && ["SUPER_ADMIN", "CLINIC_ADMIN"].includes(user.role);

  const { data: patient } = useQuery({
    queryKey: ["patient", patientId],
    queryFn: () => patientsApi.get(patientId),
  });

  const { data: vitals } = useQuery({
    queryKey: ["patient-vitals", patientId],
    queryFn: () => patientsApi.getVitals(patientId),
  });

  const { data: visits } = useQuery({
    queryKey: ["patient-visits", patientId],
    queryFn: () => patientsApi.getVisits(patientId),
  });

  const { data: doctorData } = useQuery({
    queryKey: ["user", patient?.assigned_doctor_id],
    queryFn: () => patientsApi.getUser(patient!.assigned_doctor_id),
    enabled: !!patient?.assigned_doctor_id,
  });

  const { data: nurseData } = useQuery({
    queryKey: ["user", patient?.assigned_nurse_id],
    queryFn: () => patientsApi.getUser(patient!.assigned_nurse_id),
    enabled: !!patient?.assigned_nurse_id,
  });

  if (!patient) return null;

  const latestVitals = (vitals as Array<Record<string, unknown>> | undefined)?.[0];
  const recentVisits = (visits as Array<Record<string, unknown>> | undefined)?.slice(0, 3) ?? [];

  return (
    <div className="space-y-4">
      {/* Personal + Medical info row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Personal data */}
        <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-6">
          <h3 className="text-sm font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-4">
            Личные данные
          </h3>
          <div className="space-y-3">
            {[
              {
                label: "Дата рождения",
                value: patient.date_of_birth ? formatDate(patient.date_of_birth) : "—",
              },
              {
                label: "Пол",
                value:
                  patient.gender === "MALE"
                    ? "Мужской"
                    : patient.gender === "FEMALE"
                    ? "Женский"
                    : "Не указан",
              },
              { label: "Паспорт", value: patient.passport_number || "—" },
              { label: "ИНН", value: patient.inn || "—" },
              { label: "Адрес", value: patient.address || "—" },
              { label: "Телефон", value: patient.phone || "—" },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between gap-4">
                <span className="text-sm text-[var(--color-text-secondary)] flex-shrink-0">
                  {label}
                </span>
                <span className="text-sm font-medium text-foreground text-right">{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Medical info */}
        <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-6">
          <h3 className="text-sm font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-4">
            Медицинская информация
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between gap-4">
              <span className="text-sm text-[var(--color-text-secondary)]">Группа крови</span>
              <span className="text-sm font-medium text-foreground">
                {patient.blood_type || "—"}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-sm text-[var(--color-text-secondary)]">Страховка</span>
              <span className="text-sm font-medium text-foreground">
                {patient.insurance_provider || "—"}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-sm text-[var(--color-text-secondary)]">Полис</span>
              <span className="text-sm font-medium text-foreground">
                {patient.insurance_number || "—"}
              </span>
            </div>
            <div>
              <span className="text-sm text-[var(--color-text-secondary)]">
                Хронические заболевания
              </span>
              <div className="flex flex-wrap gap-1 mt-1">
                {(patient.chronic_conditions as string[] | undefined)?.length ? (
                  (patient.chronic_conditions as string[]).map((c: string, i: number) => (
                    <span key={i} className="px-2 py-0.5 bg-warning/10 text-warning text-xs rounded-full">
                      {c}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-[var(--color-text-secondary)]">—</span>
                )}
              </div>
            </div>
            <div>
              <span className="text-sm text-[var(--color-text-secondary)]">
                Экстренный контакт
              </span>
              <p className="text-sm font-medium text-foreground mt-0.5">
                {patient.emergency_contact_name || "—"}
                {patient.emergency_contact_phone
                  ? ` · ${patient.emergency_contact_phone}`
                  : ""}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Assigned staff */}
      {(patient.assigned_doctor_id || patient.assigned_nurse_id) && (
        <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-6">
          <h3 className="text-sm font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-4">
            Закреплённый персонал
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {patient.assigned_doctor_id && (
              <Link
                to="/staff/$staffId"
                params={{ staffId: doctorData?.id || patient.assigned_doctor_id }}
                className="flex items-center gap-3 p-3 rounded-xl border border-border hover:border-success/30 hover:bg-success/5 transition-all"
              >
                <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center flex-shrink-0">
                  <svg
                    className="w-5 h-5 text-success"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  >
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                    <path d="M12 11v4M10 13h4" />
                  </svg>
                </div>
                <div className="min-w-0">
                  {doctorData ? (
                    <>
                      <p className="text-sm font-medium text-foreground truncate">
                        {doctorData.last_name} {doctorData.first_name}
                      </p>
                      <p className="text-xs text-[var(--color-text-tertiary)]">
                        {doctorData.specialization || "Врач"}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-medium text-foreground">Лечащий врач</p>
                      <p className="text-xs text-[var(--color-text-tertiary)] font-mono">
                        {patient.assigned_doctor_id}
                      </p>
                    </>
                  )}
                </div>
                <svg
                  className="w-4 h-4 text-[var(--color-text-tertiary)] ml-auto flex-shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </Link>
            )}

            {patient.assigned_nurse_id && (
              <Link
                to="/staff/$staffId"
                params={{ staffId: nurseData?.id || patient.assigned_nurse_id }}
                className="flex items-center gap-3 p-3 rounded-xl border border-border hover:border-secondary/30 hover:bg-secondary/5 transition-all"
              >
                <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center flex-shrink-0">
                  <svg
                    className="w-5 h-5 text-secondary"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  >
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                    <path d="M12 3v4M10 5h4" />
                  </svg>
                </div>
                <div className="min-w-0">
                  {nurseData ? (
                    <>
                      <p className="text-sm font-medium text-foreground truncate">
                        {nurseData.last_name} {nurseData.first_name}
                      </p>
                      <p className="text-xs text-[var(--color-text-tertiary)]">
                        {nurseData.specialization || "Медсестра"}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-medium text-foreground">Медсестра</p>
                      <p className="text-xs text-[var(--color-text-tertiary)] font-mono">
                        {patient.assigned_nurse_id}
                      </p>
                    </>
                  )}
                </div>
                <svg
                  className="w-4 h-4 text-[var(--color-text-tertiary)] ml-auto flex-shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Portal password section */}
      <PortalPasswordSection patientId={patientId} />

      {/* Latest vitals strip */}
      {latestVitals && (
        <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">
              Последние показатели
            </h3>
            <Link
              to="/patients/$patientId/labs"
              params={{ patientId }}
              className="text-xs text-secondary hover:underline"
            >
              Все анализы →
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {[
              {
                label: "АД",
                value:
                  latestVitals.systolic_bp && latestVitals.diastolic_bp
                    ? `${latestVitals.systolic_bp}/${latestVitals.diastolic_bp}`
                    : null,
                unit: "мм рт.ст.",
              },
              { label: "Пульс", value: latestVitals.pulse, unit: "уд/мин" },
              { label: "Темп.", value: latestVitals.temperature, unit: "°C" },
              { label: "SpO₂", value: latestVitals.spo2, unit: "%" },
              { label: "Вес", value: latestVitals.weight, unit: "кг" },
              { label: "ЧДД", value: latestVitals.respiratory_rate, unit: "/мин" },
              { label: "Глюкоза", value: latestVitals.blood_glucose, unit: "ммоль/л" },
            ]
              .filter((v) => v.value != null)
              .map(({ label, value, unit }) => (
                <div
                  key={label}
                  className="bg-[var(--color-muted)] rounded-xl p-3 text-center"
                >
                  <p className="text-xs text-[var(--color-text-tertiary)] mb-1">{label}</p>
                  <p className="text-base font-bold text-foreground">{String(value)}</p>
                  <p className="text-[10px] text-[var(--color-text-tertiary)] mt-0.5">{unit}</p>
                </div>
              ))}
          </div>
          <p className="text-xs text-[var(--color-text-tertiary)] mt-3">
            Зафиксировано:{" "}
            {latestVitals.recorded_at
              ? formatDateTime(latestVitals.recorded_at as string)
              : "—"}
          </p>
        </div>
      )}

      {/* Recent visits */}
      {recentVisits.length > 0 && (
        <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-6">
          <h3 className="text-sm font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-4">
            Последние визиты
          </h3>
          <div className="divide-y divide-border">
            {recentVisits.map((v) => (
              <div key={v.id as string} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between gap-3 mb-0.5">
                  <span className="text-sm font-medium text-foreground">
                    {v.visit_type === "CONSULTATION"
                      ? "Консультация"
                      : v.visit_type === "FOLLOW_UP"
                      ? "Повторный приём"
                      : String(v.visit_type || "Визит")}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${
                      v.status === "COMPLETED"
                        ? "bg-success/10 text-success"
                        : "bg-secondary/10 text-secondary"
                    }`}
                  >
                    {v.status === "COMPLETED" ? "Завершён" : String(v.status)}
                  </span>
                </div>
                {v.chief_complaint && (
                  <p className="text-sm text-[var(--color-text-secondary)] line-clamp-1">
                    {String(v.chief_complaint)}
                  </p>
                )}
                <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">
                  {v.started_at ? formatDateTime(v.started_at as string) : "—"}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Audit log — admins only */}
      {isAdmin && <AuditLogSection patientId={patientId} />}
    </div>
  );
}

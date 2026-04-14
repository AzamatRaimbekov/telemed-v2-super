import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import apiClient from "@/lib/api-client";
import { formatDateTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/audit")({
  component: AuditLogPage,
});

interface AuditEntry {
  id: string;
  user_id: string | null;
  user_name: string | null;
  user_role: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

type BadgeVariant = "success" | "warning" | "destructive" | "secondary" | "muted" | "primary";

const ACTION_COLORS: Record<string, BadgeVariant> = {
  patient_created: "success",
  patient_updated: "secondary",
  patient_deleted: "destructive",
  portal_password_reset: "warning",
  lab_result_approved: "primary",
  room_transfer: "secondary",
  login: "success",
  logout: "muted",
};

const ACTION_LABELS: Record<string, string> = {
  patient_created: "Создание пациента",
  patient_updated: "Изменение пациента",
  patient_deleted: "Удаление пациента",
  portal_password_reset: "Сброс пароля портала",
  lab_result_approved: "Утверждение анализа",
  room_transfer: "Перевод палаты",
  login: "Вход в систему",
  logout: "Выход из системы",
};

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Суперадмин",
  CLINIC_ADMIN: "Админ клиники",
  DOCTOR: "Врач",
  NURSE: "Медсестра",
  RECEPTIONIST: "Регистратор",
  PHARMACIST: "Фармацевт",
  LAB_TECHNICIAN: "Лаборант",
};

const PAGE_SIZE = 30;

function AuditLogPage() {
  const [actionFilter, setActionFilter] = useState("");
  const [page, setPage] = useState(0);

  const { data, isLoading } = useQuery({
    queryKey: ["audit-logs", actionFilter, page],
    queryFn: () =>
      apiClient
        .get("/audit/logs", {
          params: {
            skip: page * PAGE_SIZE,
            limit: PAGE_SIZE,
            ...(actionFilter ? { action: actionFilter } : {}),
          },
        })
        .then((r) => r.data as { items: AuditEntry[]; total: number }),
  });

  const { data: actions } = useQuery({
    queryKey: ["audit-actions"],
    queryFn: () =>
      apiClient
        .get("/audit/logs/actions")
        .then((r) => r.data as { action: string; count: number }[]),
  });

  const entries = data?.items || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[22px] font-bold text-foreground">Журнал действий</h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">
            Все действия пользователей в системе · {total} записей
          </p>
        </div>
      </div>

      {/* Action type filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex bg-[var(--color-muted)] rounded-lg p-0.5 overflow-x-auto">
          <button
            type="button"
            onClick={() => {
              setActionFilter("");
              setPage(0);
            }}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              !actionFilter
                ? "bg-[var(--color-surface)] text-foreground shadow-sm"
                : "text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]"
            }`}
          >
            Все
          </button>
          {(actions || []).slice(0, 8).map((a) => (
            <button
              key={a.action}
              type="button"
              onClick={() => {
                setActionFilter(a.action);
                setPage(0);
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                actionFilter === a.action
                  ? "bg-[var(--color-surface)] text-foreground shadow-sm"
                  : "text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]"
              }`}
            >
              {ACTION_LABELS[a.action] || a.action} ({a.count})
            </button>
          ))}
        </div>
      </div>

      {/* Log entries */}
      {isLoading ? (
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 bg-[var(--color-muted)] rounded-xl" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-12 text-center">
          <h3 className="text-base font-semibold text-foreground mb-1">Нет записей</h3>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Действия будут отображаться здесь
          </p>
        </div>
      ) : (
        <div className="bg-[var(--color-surface)] rounded-2xl border border-border divide-y divide-border">
          {entries.map((entry) => {
            const color: BadgeVariant = ACTION_COLORS[entry.action] || "muted";
            const label = ACTION_LABELS[entry.action] || entry.action;
            return (
              <div key={entry.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3 flex-wrap">
                    <Badge variant={color}>{label}</Badge>
                    {entry.user_name && (
                      <span className="text-sm font-medium text-foreground">
                        {entry.user_name}
                      </span>
                    )}
                    {entry.user_role && (
                      <Badge variant="muted">
                        {ROLE_LABELS[entry.user_role] || entry.user_role}
                      </Badge>
                    )}
                    {entry.resource_type && (
                      <span className="text-xs text-[var(--color-text-tertiary)] font-mono">
                        {entry.resource_type}
                      </span>
                    )}
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
                {/* Changed values diff */}
                {entry.action.includes("updated") &&
                  entry.old_values &&
                  entry.new_values && (
                    <div className="mt-2 space-y-1">
                      {Object.keys(entry.new_values)
                        .filter(
                          (k) =>
                            JSON.stringify(entry.old_values?.[k]) !==
                            JSON.stringify(entry.new_values?.[k])
                        )
                        .slice(0, 5)
                        .map((key) => (
                          <div
                            key={key}
                            className="flex items-baseline gap-1.5 text-xs flex-wrap"
                          >
                            <span className="text-[var(--color-text-tertiary)] font-mono">
                              {key}:
                            </span>
                            <span className="text-[var(--color-text-secondary)] line-through">
                              {String(entry.old_values?.[key] ?? "—")}
                            </span>
                            <span className="text-[var(--color-text-tertiary)]">→</span>
                            <span className="text-foreground font-medium">
                              {String(entry.new_values?.[key] ?? "—")}
                            </span>
                          </div>
                        ))}
                    </div>
                  )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            ← Назад
          </Button>
          <span className="text-sm text-[var(--color-text-secondary)]">
            {page + 1} из {totalPages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
          >
            Вперёд →
          </Button>
        </div>
      )}
    </div>
  );
}

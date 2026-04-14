import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { notificationsApi, type Notification } from "@/lib/notifications-api";

export const Route = createFileRoute("/_authenticated/notifications")({
  component: NotificationsPage,
});

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "только что";
  if (diffMins < 60) return `${diffMins} мин назад`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} ч назад`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "вчера";
  if (diffDays < 7) return `${diffDays} дн назад`;
  return date.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
}

const typeLabels: Record<string, string> = {
  LAB_RESULT_READY: "Результаты анализов",
  APPOINTMENT_REMINDER: "Напоминание",
  TREATMENT_UPDATED: "Лечение",
  MEDICATION_DUE: "Медикаменты",
  ABNORMAL_RESULT: "Отклонение",
  PATIENT_ASSIGNED: "Пациент",
  LOW_STOCK: "Склад",
  ALLERGY_ALERT: "Аллергия",
  SYSTEM: "Система",
};

const severityStyles: Record<string, { dot: string; badge: string }> = {
  INFO: { dot: "bg-blue-500", badge: "bg-blue-50 text-blue-700 border-blue-200" },
  WARNING: { dot: "bg-amber-500", badge: "bg-amber-50 text-amber-700 border-amber-200" },
  CRITICAL: { dot: "bg-red-500", badge: "bg-red-50 text-red-700 border-red-200" },
};

const LIMIT = 20;

function NotificationsPage() {
  const [skip, setSkip] = useState(0);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["notifications", skip],
    queryFn: () => notificationsApi.list(skip, LIMIT),
  });

  const { data: countData } = useQuery({
    queryKey: ["notifications-unread-count"],
    queryFn: notificationsApi.unreadCount,
    refetchInterval: 30_000,
  });

  const markRead = useMutation({
    mutationFn: notificationsApi.markRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications-unread-count"] });
      queryClient.invalidateQueries({ queryKey: ["notifications-preview"] });
    },
  });

  const markAllRead = useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications-unread-count"] });
      queryClient.invalidateQueries({ queryKey: ["notifications-preview"] });
    },
  });

  const total = data?.total ?? 0;
  const items = data?.items ?? [];
  const unreadCount = countData?.count ?? 0;
  const totalPages = Math.ceil(total / LIMIT);
  const currentPage = Math.floor(skip / LIMIT) + 1;

  return (
    <div className="max-w-3xl mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Уведомления</h1>
          {unreadCount > 0 && (
            <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">
              {unreadCount} непрочитанных
            </p>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Прочитать все
          </button>
        )}
      </div>

      {/* Notifications list */}
      <div className="bg-[var(--color-surface)] border border-border rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col gap-0">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="px-5 py-4 flex items-start gap-4 border-b border-border last:border-0 animate-pulse">
                <div className="mt-1 w-2.5 h-2.5 rounded-full bg-muted flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-1/3" />
                  <div className="h-3 bg-muted rounded w-2/3" />
                  <div className="h-3 bg-muted rounded w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-[var(--color-muted)] flex items-center justify-center mx-auto mb-4">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7 text-[var(--color-text-tertiary)]">
                <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
              </svg>
            </div>
            <p className="text-[var(--color-text-secondary)] font-medium">Нет уведомлений</p>
            <p className="text-sm text-[var(--color-text-tertiary)] mt-1">Вы будете уведомлены о важных событиях</p>
          </div>
        ) : (
          items.map((n: Notification) => {
            const styles = severityStyles[n.severity] ?? severityStyles.INFO;
            return (
              <button
                key={n.id}
                onClick={() => { if (!n.is_read) markRead.mutate(n.id); }}
                className={`w-full text-left px-5 py-4 flex items-start gap-4 border-b border-border last:border-0 hover:bg-[var(--color-muted)] transition-colors group ${!n.is_read ? "bg-primary/[0.02]" : ""}`}
              >
                {/* Unread dot */}
                <span
                  className={`mt-1.5 flex-shrink-0 w-2.5 h-2.5 rounded-full transition-all ${!n.is_read ? styles.dot : "bg-transparent border border-border group-hover:border-[var(--color-text-tertiary)]"}`}
                />

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3 mb-1">
                    <p className={`text-sm leading-snug ${!n.is_read ? "font-semibold text-foreground" : "font-medium text-[var(--color-text-secondary)]"}`}>
                      {n.title}
                    </p>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${styles.badge}`}>
                        {typeLabels[n.type] ?? n.type}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-[var(--color-text-tertiary)] leading-relaxed line-clamp-2">
                    {n.message}
                  </p>
                  <p className="text-[10px] text-[var(--color-text-tertiary)] mt-1.5">
                    {timeAgo(n.created_at)}
                    {n.is_read && n.read_at && (
                      <span className="ml-2 text-[var(--color-text-tertiary)]/60">
                        · прочитано
                      </span>
                    )}
                  </p>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-sm text-[var(--color-text-secondary)]">
            Страница {currentPage} из {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSkip(Math.max(0, skip - LIMIT))}
              disabled={skip === 0}
              className="px-3 py-1.5 text-sm rounded-lg border border-border hover:bg-[var(--color-muted)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Назад
            </button>
            <button
              onClick={() => setSkip(skip + LIMIT)}
              disabled={skip + LIMIT >= total}
              className="px-3 py-1.5 text-sm rounded-lg border border-border hover:bg-[var(--color-muted)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Вперёд
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

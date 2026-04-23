import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { useNotificationLogs, useNotificationStats, type NotificationLog } from "@/features/notifications/api";
import { MessageSquare, Mail, Phone, Send, Loader2, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/notification-logs")({
  component: NotificationLogsPage,
});

const channels = [
  { key: undefined, label: "Все" },
  { key: "sms", label: "SMS" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "telegram", label: "Telegram" },
  { key: "email", label: "Email" },
] as const;

const channelIcons: Record<string, { icon: typeof Mail; color: string }> = {
  sms: { icon: Phone, color: "#10b981" },
  whatsapp: { icon: MessageSquare, color: "#25d366" },
  telegram: { icon: Send, color: "#0088cc" },
  email: { icon: Mail, color: "#6366f1" },
};

const statusConfig: Record<string, { label: string; variant: "success" | "destructive" | "warning" | "primary" }> = {
  sent: { label: "Отправлено", variant: "success" },
  delivered: { label: "Доставлено", variant: "primary" },
  failed: { label: "Ошибка", variant: "destructive" },
  pending: { label: "В очереди", variant: "warning" },
};

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit" }) +
    " " +
    d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

function NotificationLogsPage() {
  const [activeChannel, setActiveChannel] = useState<string | undefined>(undefined);
  const { data: logs, isLoading } = useNotificationLogs(
    activeChannel ? { channel: activeChannel } : undefined
  );
  const { data: stats } = useNotificationStats();

  return (
    <div className="p-6">
      <PageHeader
        title="Журнал уведомлений"
        description="История отправленных уведомлений пациентам"
      />

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { label: "Всего", value: stats.total ?? 0, color: "var(--color-secondary)" },
            { label: "Отправлено", value: stats.sent ?? 0, color: "var(--color-success)" },
            { label: "Ошибки", value: stats.failed ?? 0, color: "var(--color-destructive)" },
            { label: "В очереди", value: stats.pending ?? 0, color: "var(--color-warning)" },
          ].map((s) => (
            <div key={s.label} className="bg-[var(--color-surface)] rounded-xl border border-border shadow-sm p-4">
              <p className="text-xs text-[var(--color-text-secondary)] mb-1">{s.label}</p>
              <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Channel Tabs */}
      <div className="flex items-center gap-1 bg-[var(--color-muted)] rounded-xl p-1 mb-6 w-fit">
        {channels.map((ch) => (
          <button
            key={ch.label}
            onClick={() => setActiveChannel(ch.key)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
              activeChannel === ch.key
                ? "bg-[var(--color-surface)] text-foreground shadow-sm"
                : "text-[var(--color-text-secondary)] hover:text-foreground"
            }`}
          >
            {ch.label}
          </button>
        ))}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--color-text-tertiary)]" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && logs?.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <AlertCircle className="w-16 h-16 text-[var(--color-text-tertiary)] mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-1">Уведомлений нет</h3>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Записи появятся после отправки уведомлений
          </p>
        </div>
      )}

      {/* Desktop Table */}
      {logs && logs.length > 0 && (
        <>
          <div className="hidden md:block bg-[var(--color-surface)] rounded-xl border border-border shadow-sm overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-5 py-3 text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider">Канал</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider">Получатель</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider">Сообщение</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider">Статус</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider">Время</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log: NotificationLog, i: number) => {
                  const ch = channelIcons[log.channel] || { icon: Mail, color: "#888" };
                  const ChannelIcon = ch.icon;
                  const st = statusConfig[log.status] || { label: log.status, variant: "muted" as const };
                  return (
                    <tr
                      key={log.id}
                      className="border-b border-border last:border-0 hover:bg-[var(--color-muted)]/50 transition-colors animate-float-up"
                      style={{ animationDelay: `${i * 30}ms` }}
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center"
                            style={{ background: `${ch.color}15` }}
                          >
                            <ChannelIcon className="w-4 h-4" style={{ color: ch.color }} />
                          </div>
                          <span className="text-sm font-medium text-foreground capitalize">{log.channel}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-foreground">{log.recipient}</td>
                      <td className="px-5 py-3.5 text-sm text-[var(--color-text-secondary)] max-w-xs truncate">{log.body}</td>
                      <td className="px-5 py-3.5">
                        <Badge variant={st.variant} dot>{st.label}</Badge>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-[var(--color-text-tertiary)]">
                        {formatTime(log.sent_at || log.created_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {logs.map((log: NotificationLog, i: number) => {
              const ch = channelIcons[log.channel] || { icon: Mail, color: "#888" };
              const ChannelIcon = ch.icon;
              const st = statusConfig[log.status] || { label: log.status, variant: "muted" as const };
              return (
                <div
                  key={log.id}
                  className="bg-[var(--color-surface)] rounded-xl border border-border shadow-sm p-4 animate-float-up"
                  style={{ animationDelay: `${i * 30}ms` }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ background: `${ch.color}15` }}
                      >
                        <ChannelIcon className="w-4 h-4" style={{ color: ch.color }} />
                      </div>
                      <span className="text-sm font-medium text-foreground capitalize">{log.channel}</span>
                    </div>
                    <Badge variant={st.variant} dot>{st.label}</Badge>
                  </div>
                  <p className="text-sm text-[var(--color-text-secondary)] mb-2 line-clamp-2">{log.body}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-foreground">{log.recipient}</span>
                    <span className="text-xs text-[var(--color-text-tertiary)]">
                      {formatTime(log.sent_at || log.created_at)}
                    </span>
                  </div>
                  {log.error_message && (
                    <p className="text-xs text-destructive mt-2 bg-destructive/5 rounded-lg px-3 py-1.5">
                      {log.error_message}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

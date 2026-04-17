import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { infrastructureApi } from "@/features/infrastructure/api";
import { useBmsWS } from "@/features/infrastructure/use-bms-ws";
import { BMS_SENSOR_META, EQUIPMENT_TYPE_LABELS } from "@/features/infrastructure/thresholds";
import { Badge } from "@/components/ui/badge";
import type { BmsDashboard, BmsAlert, AutomationRule, FloorStatus, BmsAlertSeverity, BmsSensorType, ConditionOperator } from "@/features/infrastructure/types";

export const Route = createFileRoute("/_authenticated/infrastructure/dashboard")({
  component: BmsDashboardPage,
});

/* ── helpers ── */

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "только что";
  if (minutes < 60) return `${minutes} мин назад`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ч назад`;
  const days = Math.floor(hours / 24);
  return `${days} дн назад`;
}

function severityBadgeVariant(severity: string): "muted" | "warning" | "destructive" {
  if (severity === "CRITICAL" || severity === "EMERGENCY") return "destructive";
  if (severity === "WARNING") return "warning";
  return "muted";
}

function worstSeverityDot(severity: string): string {
  if (severity === "CRITICAL" || severity === "EMERGENCY") return "bg-destructive";
  if (severity === "WARNING") return "bg-warning";
  return "bg-success";
}

const OPERATOR_LABELS: Record<ConditionOperator, string> = {
  GT: ">",
  LT: "<",
  EQ: "=",
  GTE: ">=",
  LTE: "<=",
};

const COMMAND_LABELS: Record<string, string> = {
  TURN_ON: "Включить",
  TURN_OFF: "Выключить",
  SET_PARAMETER: "Установить параметр",
  RESTART: "Перезапуск",
};

/* ── main component ── */

function BmsDashboardPage() {
  useBmsWS();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: dashboard, isLoading: dashLoading } = useQuery<BmsDashboard>({
    queryKey: ["bms-dashboard"],
    queryFn: infrastructureApi.getDashboard,
  });

  const { data: alerts, isLoading: alertsLoading } = useQuery<BmsAlert[]>({
    queryKey: ["bms-alerts", "active"],
    queryFn: () => infrastructureApi.getAlerts({ status: "ACTIVE", limit: 20 }),
  });

  const { data: rules, isLoading: rulesLoading } = useQuery<AutomationRule[]>({
    queryKey: ["bms-rules"],
    queryFn: infrastructureApi.getRules,
  });

  const ackMutation = useMutation({
    mutationFn: (alertId: string) => infrastructureApi.acknowledgeAlert(alertId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bms-alerts"] });
      queryClient.invalidateQueries({ queryKey: ["bms-dashboard"] });
      toast.success("Тревога подтверждена");
    },
    onError: () => toast.error("Не удалось подтвердить тревогу"),
  });

  const toggleRuleMutation = useMutation({
    mutationFn: (ruleId: string) => infrastructureApi.toggleRule(ruleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bms-rules"] });
      toast.success("Правило обновлено");
    },
    onError: () => toast.error("Не удалось обновить правило"),
  });

  return (
    <div className="space-y-8 pb-8">
      {/* ── KPI Cards ── */}
      <section>
        <h2 className="text-sm font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-4">
          Обзор системы
        </h2>
        {dashLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse bg-[var(--color-muted)] rounded-2xl h-28" />
            ))}
          </div>
        ) : dashboard ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Sensors */}
            <div
              className="bg-[var(--color-surface)] rounded-2xl border border-border p-4 animate-float-up"
              style={{ animationDelay: "0ms" }}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-primary/10">
                  <svg className="w-5 h-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2a4 4 0 0 0-4 4v6a4 4 0 0 0 8 0V6a4 4 0 0 0-4-4z" />
                    <path d="M18 12a6 6 0 0 1-12 0" />
                    <path d="M12 18v4" />
                  </svg>
                </div>
                <span className="text-xs text-[var(--color-text-tertiary)]">Датчики</span>
              </div>
              <div className="text-2xl font-bold">{dashboard.sensor_count}</div>
              <div className="text-xs text-[var(--color-text-secondary)]">
                {dashboard.active_sensors} активных
              </div>
            </div>

            {/* Alerts */}
            <div
              className={`bg-[var(--color-surface)] rounded-2xl border border-border p-4 animate-float-up ${
                dashboard.active_alerts > 0 && dashboard.alerts_by_severity?.EMERGENCY
                  ? "animate-pulse bg-destructive/20 border-destructive"
                  : ""
              }`}
              style={{ animationDelay: "50ms" }}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                  dashboard.active_alerts > 0 ? "bg-destructive/10" : "bg-success/10"
                }`}>
                  <svg className={`w-5 h-5 ${dashboard.active_alerts > 0 ? "text-destructive" : "text-success"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                    <path d="M12 9v4" />
                    <path d="M12 17h.01" />
                  </svg>
                </div>
                <span className="text-xs text-[var(--color-text-tertiary)]">Алерты</span>
              </div>
              <div className={`text-2xl font-bold ${dashboard.active_alerts > 0 ? "text-destructive" : ""}`}>
                {dashboard.active_alerts}
              </div>
              <div className="flex gap-1 mt-1 flex-wrap">
                {(dashboard.alerts_by_severity?.WARNING ?? 0) > 0 && (
                  <Badge variant="warning">{dashboard.alerts_by_severity.WARNING} WARNING</Badge>
                )}
                {(dashboard.alerts_by_severity?.CRITICAL ?? 0) > 0 && (
                  <Badge variant="destructive">{dashboard.alerts_by_severity.CRITICAL} CRITICAL</Badge>
                )}
                {(dashboard.alerts_by_severity?.EMERGENCY ?? 0) > 0 && (
                  <Badge variant="destructive" className="animate-pulse">{dashboard.alerts_by_severity.EMERGENCY} EMERGENCY</Badge>
                )}
              </div>
            </div>

            {/* Temperature */}
            <div
              className="bg-[var(--color-surface)] rounded-2xl border border-border p-4 animate-float-up"
              style={{ animationDelay: "100ms" }}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-warning/10">
                  <svg className="w-5 h-5 text-warning" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z" />
                  </svg>
                </div>
                <span className="text-xs text-[var(--color-text-tertiary)]">Температура</span>
              </div>
              <div className="text-2xl font-bold">
                {dashboard.avg_temperature != null
                  ? `${dashboard.avg_temperature.toFixed(1)}°C`
                  : "—"}
              </div>
              <div className="text-xs text-[var(--color-text-secondary)]">средняя</div>
            </div>

            {/* Energy */}
            <div
              className="bg-[var(--color-surface)] rounded-2xl border border-border p-4 animate-float-up"
              style={{ animationDelay: "150ms" }}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[#f59e0b]/10">
                  <svg className="w-5 h-5 text-[#f59e0b]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
                  </svg>
                </div>
                <span className="text-xs text-[var(--color-text-tertiary)]">Энергия</span>
              </div>
              <div className="text-2xl font-bold">
                {dashboard.energy_consumption != null
                  ? `${Math.round(dashboard.energy_consumption)} kWh`
                  : "—"}
              </div>
              <div className="text-xs text-[var(--color-text-secondary)]">потребление</div>
            </div>
          </div>
        ) : null}
      </section>

      {/* ── Floor Status ── */}
      <section>
        <h2 className="text-sm font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-4">
          Статус этажей
        </h2>
        {dashLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="animate-pulse bg-[var(--color-muted)] rounded-2xl h-16" />
            ))}
          </div>
        ) : dashboard?.floor_statuses?.length ? (
          <div className="space-y-3">
            {dashboard.floor_statuses.map((floor: FloorStatus) => (
              <div
                key={floor.floor_id}
                className="bg-[var(--color-surface)] rounded-2xl border border-border p-4 flex items-center gap-4 cursor-pointer hover:border-primary/40 transition-colors"
                onClick={() =>
                  navigate({
                    to: "/infrastructure/map",
                    search: { floor: floor.floor_id },
                  })
                }
              >
                {/* Left: floor info */}
                <div className="min-w-[100px]">
                  <div className="font-semibold text-sm">{floor.floor_name}</div>
                  <div className="text-xs text-[var(--color-text-tertiary)]">
                    Этаж {floor.floor_number}
                  </div>
                </div>

                {/* Center: sensor indicators */}
                <div className="flex gap-2 flex-wrap flex-1">
                  {floor.avg_temperature != null && (
                    <Badge variant="muted">
                      🌡 {floor.avg_temperature.toFixed(1)}°C
                    </Badge>
                  )}
                  {floor.avg_humidity != null && (
                    <Badge variant="muted">
                      💧 {Math.round(floor.avg_humidity)}%
                    </Badge>
                  )}
                  {floor.avg_co2 != null && (
                    <Badge variant="muted">
                      🌬 {Math.round(floor.avg_co2)} ppm
                    </Badge>
                  )}
                </div>

                {/* Right: alerts + status dot */}
                <div className="flex items-center gap-3">
                  {floor.active_alerts > 0 && (
                    <Badge variant={severityBadgeVariant(floor.worst_severity)}>
                      {floor.active_alerts} алерт{floor.active_alerts > 1 ? (floor.active_alerts < 5 ? "а" : "ов") : ""}
                    </Badge>
                  )}
                  <span
                    className={`w-3 h-3 rounded-full shrink-0 ${worstSeverityDot(floor.worst_severity)}`}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-[var(--color-text-secondary)] py-8">
            Нет данных по этажам
          </p>
        )}
      </section>

      {/* ── Active Alerts ── */}
      <section>
        <h2 className="text-sm font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-4">
          Активные тревоги
        </h2>
        {alertsLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="animate-pulse bg-[var(--color-muted)] rounded-2xl h-20" />
            ))}
          </div>
        ) : alerts?.length ? (
          <div className="space-y-3">
            {alerts.map((alert: BmsAlert) => (
              <div
                key={alert.id}
                className={`bg-[var(--color-surface)] rounded-2xl border border-border p-4 flex items-center gap-4 ${
                  alert.severity === "EMERGENCY"
                    ? "animate-pulse bg-destructive/20 border-destructive"
                    : ""
                }`}
              >
                {/* Severity badge */}
                <Badge variant={severityBadgeVariant(alert.severity)}>
                  {alert.severity}
                </Badge>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">{alert.title}</div>
                  <div className="text-xs text-[var(--color-text-secondary)] truncate">
                    {alert.message}
                  </div>
                  <div className="flex gap-2 mt-1 text-xs text-[var(--color-text-tertiary)]">
                    {alert.room_name && <span>{alert.room_name}</span>}
                    <span>{timeAgo(alert.created_at)}</span>
                  </div>
                </div>

                {/* Action */}
                <button
                  className="shrink-0 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
                  disabled={ackMutation.isPending}
                  onClick={() => ackMutation.mutate(alert.id)}
                >
                  Подтвердить
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-[var(--color-text-secondary)] py-8">
            Нет активных тревог
          </p>
        )}
      </section>

      {/* ── Automation Rules ── */}
      <section>
        <h2 className="text-sm font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-4">
          Правила автоматизации
        </h2>
        {rulesLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="animate-pulse bg-[var(--color-muted)] rounded-2xl h-16" />
            ))}
          </div>
        ) : rules?.length ? (
          <div className="space-y-3">
            {rules.map((rule: AutomationRule) => {
              const sensorMeta = BMS_SENSOR_META[rule.condition_sensor_type];
              const operatorLabel = OPERATOR_LABELS[rule.condition_operator];
              const commandLabel = COMMAND_LABELS[rule.action_command] ?? rule.action_command;
              const equipLabel = rule.action_equipment_type
                ? EQUIPMENT_TYPE_LABELS[rule.action_equipment_type]
                : "";

              return (
                <div
                  key={rule.id}
                  className="bg-[var(--color-surface)] rounded-2xl border border-border p-4 flex items-center gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm">{rule.name}</div>
                    <div className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                      Если {sensorMeta?.label ?? rule.condition_sensor_type}{" "}
                      {operatorLabel} {rule.condition_value}
                      {sensorMeta?.unit ? ` ${sensorMeta.unit}` : ""}
                    </div>
                    <div className="text-xs text-[var(--color-text-tertiary)] mt-0.5">
                      {commandLabel}
                      {equipLabel ? ` ${equipLabel}` : ""}
                    </div>
                    {rule.schedule_description && (
                      <div className="text-xs text-[var(--color-text-tertiary)] mt-0.5">
                        Расписание: {rule.schedule_description}
                      </div>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-2 shrink-0">
                    {rule.trigger_count > 0 && (
                      <Badge variant="muted">{rule.trigger_count}x</Badge>
                    )}
                    {rule.last_triggered_at && (
                      <span className="text-xs text-[var(--color-text-tertiary)]">
                        {timeAgo(rule.last_triggered_at)}
                      </span>
                    )}
                  </div>

                  {/* Toggle */}
                  <button
                    className={`relative w-10 h-5 rounded-full shrink-0 transition-colors ${
                      rule.is_active ? "bg-success" : "bg-[var(--color-muted)]"
                    }`}
                    onClick={() => toggleRuleMutation.mutate(rule.id)}
                    disabled={toggleRuleMutation.isPending}
                    title={rule.is_active ? "Деактивировать" : "Активировать"}
                  >
                    <span
                      className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                        rule.is_active ? "translate-x-5" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-center text-[var(--color-text-secondary)] py-8">
            Нет правил автоматизации
          </p>
        )}
      </section>
    </div>
  );
}

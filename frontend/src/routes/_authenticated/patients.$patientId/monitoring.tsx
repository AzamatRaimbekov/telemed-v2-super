import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useEffect } from "react";
import { toast } from "sonner";
import { monitoringApi } from "@/features/monitoring/api";
import { useMonitoringWS } from "@/features/monitoring/use-monitoring-ws";
import { SENSOR_META, getSeverityColor } from "@/features/monitoring/thresholds";
import type {
  Camera,
  SensorReading,
  Alert,
  NurseCall,
  AlertSeverity,
  NurseCallStatus,
  DeviceType,
  ReadingPoint,
} from "@/features/monitoring/types";
import { Badge } from "@/components/ui/badge";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export const Route = createFileRoute(
  "/_authenticated/patients/$patientId/monitoring"
)({
  component: MonitoringPage,
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function elapsedSince(iso: string | null | undefined): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs} сек`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins} мин`;
  const hrs = Math.floor(mins / 60);
  return `${hrs} ч ${mins % 60} мин`;
}

const WEARABLE_ORDER: DeviceType[] = [
  "HEART_RATE",
  "SPO2",
  "BODY_TEMPERATURE",
  "BLOOD_PRESSURE",
  "FALL_DETECTOR",
];

const STATIONARY_TYPES: DeviceType[] = [
  "ROOM_TEMPERATURE",
  "HUMIDITY",
  "MOTION",
  "DOOR",
];

const NURSE_STEPS: NurseCallStatus[] = [
  "CALLED",
  "ACCEPTED",
  "EN_ROUTE",
  "ON_SITE",
  "RESOLVED",
];

const NURSE_STEP_LABELS: Record<NurseCallStatus, string> = {
  CALLED: "Вызов",
  ACCEPTED: "Принят",
  EN_ROUTE: "В пути",
  ON_SITE: "На месте",
  RESOLVED: "Решено",
};

const PERIOD_OPTIONS = [
  { hours: 1, label: "1ч" },
  { hours: 6, label: "6ч" },
  { hours: 24, label: "24ч" },
  { hours: 168, label: "7д" },
];

// ─── Main Page ────────────────────────────────────────────────────────────────

function MonitoringPage() {
  const { patientId } = Route.useParams();
  const queryClient = useQueryClient();

  const { data: cameras, isLoading: camerasLoading } = useQuery<Camera[]>({
    queryKey: ["monitoring-cameras", patientId],
    queryFn: () => monitoringApi.getCameras(patientId),
  });

  const { data: readings, isLoading: readingsLoading } = useQuery<SensorReading[]>({
    queryKey: ["monitoring-readings", patientId],
    queryFn: () => monitoringApi.getCurrentReadings(patientId),
    refetchInterval: 15000,
  });

  const { data: alerts, isLoading: alertsLoading } = useQuery<Alert[]>({
    queryKey: ["monitoring-alerts", patientId],
    queryFn: () => monitoringApi.getAlerts(patientId, { limit: 50 }),
  });

  const { data: nurseCalls } = useQuery<NurseCall[]>({
    queryKey: ["monitoring-nurse-calls", patientId],
    queryFn: () => monitoringApi.getNurseCalls(patientId, { limit: 10 }),
  });

  useMonitoringWS(patientId);

  const [activeCamera, setActiveCamera] = useState<string>("");
  const [alertFilter, setAlertFilter] = useState<AlertSeverity | "ALL">("ALL");
  const [trendPeriod, setTrendPeriod] = useState(24);
  const [trendSensorId, setTrendSensorId] = useState<string>("");

  // Set default active camera
  useEffect(() => {
    if (!activeCamera && cameras?.length) {
      setActiveCamera(cameras[0].id);
    }
  }, [cameras, activeCamera]);

  // Set default trend sensor
  useEffect(() => {
    if (!trendSensorId && readings?.length) {
      const wearable = readings.find((r) => r.device_category === "WEARABLE");
      if (wearable) setTrendSensorId(wearable.sensor_id);
    }
  }, [readings, trendSensorId]);

  const isLoading = camerasLoading || readingsLoading || alertsLoading;

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-16 bg-[var(--color-muted)] rounded-2xl" />
        <div className="grid grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-28 bg-[var(--color-muted)] rounded-2xl" />
          ))}
        </div>
        <div className="h-64 bg-[var(--color-muted)] rounded-2xl" />
        <div className="h-48 bg-[var(--color-muted)] rounded-2xl" />
      </div>
    );
  }

  const wearableReadings = (readings ?? []).filter(
    (r) => r.device_category === "WEARABLE"
  );
  const stationaryReadings = (readings ?? []).filter(
    (r) => r.device_category === "STATIONARY"
  );
  const criticalAlert = (alerts ?? []).find(
    (a) => a.status === "ACTIVE" && a.severity === "CRITICAL"
  );

  return (
    <div className="space-y-4">
      {/* Critical Alert Banner */}
      {criticalAlert && (
        <AlertBanner
          alert={criticalAlert}
          patientId={patientId}
          queryClient={queryClient}
        />
      )}

      {/* Wearable sensors */}
      <div>
        <h3 className="text-sm font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-3">
          Носимые датчики
        </h3>
        <WearableSensorsRow readings={wearableReadings} />
      </div>

      {/* Camera grid */}
      <div>
        <h3 className="text-sm font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-3">
          Камеры
        </h3>
        <CameraGrid
          cameras={cameras ?? []}
          activeCamera={activeCamera}
          onSelect={setActiveCamera}
        />
      </div>

      {/* Room sensors */}
      {stationaryReadings.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-3">
            Датчики палаты
          </h3>
          <RoomSensorsRow readings={stationaryReadings} />
        </div>
      )}

      {/* Nurse call */}
      <NurseCallCard
        nurseCalls={nurseCalls ?? []}
        patientId={patientId}
        queryClient={queryClient}
      />

      {/* Alert log */}
      <AlertLog
        alerts={alerts ?? []}
        filter={alertFilter}
        onFilterChange={setAlertFilter}
        patientId={patientId}
        queryClient={queryClient}
      />

      {/* Trend charts */}
      <TrendCharts
        patientId={patientId}
        readings={wearableReadings}
        trendPeriod={trendPeriod}
        onPeriodChange={setTrendPeriod}
        trendSensorId={trendSensorId}
        onSensorChange={setTrendSensorId}
      />
    </div>
  );
}

// ─── AlertBanner ──────────────────────────────────────────────────────────────

function AlertBanner({
  alert,
  patientId,
  queryClient,
}: {
  alert: Alert;
  patientId: string;
  queryClient: ReturnType<typeof useQueryClient>;
}) {
  const ackMutation = useMutation({
    mutationFn: () => monitoringApi.acknowledgeAlert(alert.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["monitoring-alerts", patientId] });
      toast.success("Тревога подтверждена");
    },
    onError: () => toast.error("Не удалось подтвердить тревогу"),
  });

  return (
    <div className="bg-destructive/10 border border-destructive/20 rounded-2xl p-4 flex items-center gap-4 animate-float-up">
      <div className="flex-shrink-0">
        <div className="w-10 h-10 rounded-xl bg-destructive/20 flex items-center justify-center">
          <svg
            className="w-5 h-5 text-destructive animate-pulse"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
          </svg>
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-destructive">{alert.title}</p>
        <p className="text-xs text-destructive/80 mt-0.5">{alert.message}</p>
      </div>
      <button
        onClick={() => ackMutation.mutate()}
        disabled={ackMutation.isPending}
        className="flex-shrink-0 bg-destructive text-white rounded-xl px-4 py-2 text-sm font-medium hover:bg-destructive/90 transition-colors disabled:opacity-50"
      >
        {ackMutation.isPending ? "..." : "Подтвердить"}
      </button>
    </div>
  );
}

// ─── WearableSensorsRow ───────────────────────────────────────────────────────

function WearableSensorsRow({ readings }: { readings: SensorReading[] }) {
  const sorted = useMemo(() => {
    const map = new Map(readings.map((r) => [r.device_type, r]));
    return WEARABLE_ORDER.map((dt) => map.get(dt)).filter(Boolean) as SensorReading[];
  }, [readings]);

  if (sorted.length === 0) {
    return (
      <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-6 text-center">
        <p className="text-sm text-[var(--color-text-secondary)]">Нет данных с носимых датчиков</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {sorted.map((r, i) => {
        const meta = SENSOR_META[r.device_type];
        if (!meta) return null;
        const colorClass = getSeverityColor(r.severity, meta);
        const isFall = r.device_type === "FALL_DETECTOR";
        const fallDetected = isFall && r.value_text === "FALL";

        return (
          <div
            key={r.sensor_id}
            className="bg-[var(--color-surface)] rounded-2xl border border-border p-4 animate-float-up"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-base">{meta.icon}</span>
              <span className="text-xs text-[var(--color-text-tertiary)] font-medium">
                {meta.label}
              </span>
            </div>
            {isFall ? (
              <p
                className={`text-lg font-bold ${
                  fallDetected
                    ? "text-destructive animate-pulse"
                    : "text-success"
                }`}
              >
                {fallDetected ? "ПАДЕНИЕ!" : "Норма"}
              </p>
            ) : (
              <div>
                <p className={`text-xl font-bold ${colorClass}`}>
                  {meta.format(r.value, r.value_secondary)}
                </p>
                {meta.unit && (
                  <p className="text-[10px] text-[var(--color-text-tertiary)] mt-0.5">
                    {meta.unit}
                  </p>
                )}
              </div>
            )}
            {r.recorded_at && (
              <p className="text-[10px] text-[var(--color-text-tertiary)] mt-2">
                {fmtTime(r.recorded_at)}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── CameraGrid ───────────────────────────────────────────────────────────────

function CameraGrid({
  cameras,
  activeCamera,
  onSelect,
}: {
  cameras: Camera[];
  activeCamera: string;
  onSelect: (id: string) => void;
}) {
  if (cameras.length === 0) {
    return (
      <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-6 text-center">
        <p className="text-sm text-[var(--color-text-secondary)]">Камеры не подключены</p>
      </div>
    );
  }

  const mainCam = cameras.find((c) => c.id === activeCamera) ?? cameras[0];
  const thumbnails = cameras.filter((c) => c.id !== mainCam.id);

  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: thumbnails.length > 0 ? "1.5fr 1fr" : "1fr" }}>
      {/* Main camera */}
      <div
        className="bg-[#0d0d1a] rounded-2xl overflow-hidden row-span-2"
      >
        <div className="relative aspect-video flex items-center justify-center">
          <div className="absolute top-3 left-3 flex items-center gap-1.5 z-10">
            <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <span className="text-xs font-medium text-white/80">LIVE</span>
          </div>
          <div className="absolute top-3 right-3 z-10">
            <span className="text-xs text-white/50 bg-black/30 rounded-lg px-2 py-1">
              {mainCam.name}
            </span>
          </div>
          <div className="flex flex-col items-center gap-2 text-white/20">
            <svg
              className="w-12 h-12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="m22 8-6 4 6 4V8Z" />
              <rect width="14" height="12" x="2" y="6" rx="2" ry="2" />
            </svg>
            <span className="text-xs">Видеопоток</span>
          </div>
        </div>
      </div>

      {/* Thumbnails */}
      {thumbnails.map((cam) => (
        <button
          key={cam.id}
          onClick={() => onSelect(cam.id)}
          className="bg-[var(--color-muted)] rounded-2xl overflow-hidden text-left hover:ring-2 hover:ring-secondary/30 transition-all"
        >
          <div className="relative aspect-video flex items-center justify-center">
            <div className="absolute top-2 left-2 flex items-center gap-1 z-10">
              <span className="w-1.5 h-1.5 rounded-full bg-success" />
              <span className="text-[10px] font-medium text-foreground/60">LIVE</span>
            </div>
            <div className="absolute top-2 right-2 z-10">
              <span className="text-[10px] text-[var(--color-text-tertiary)] bg-[var(--color-surface)]/50 rounded px-1.5 py-0.5">
                {cam.name}
              </span>
            </div>
            <div className="flex flex-col items-center gap-1 text-[var(--color-text-tertiary)]/30">
              <svg
                className="w-8 h-8"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="m22 8-6 4 6 4V8Z" />
                <rect width="14" height="12" x="2" y="6" rx="2" ry="2" />
              </svg>
              <span className="text-[10px]">Видеопоток</span>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

// ─── RoomSensorsRow ───────────────────────────────────────────────────────────

function RoomSensorsRow({ readings }: { readings: SensorReading[] }) {
  const sorted = useMemo(() => {
    const map = new Map(readings.map((r) => [r.device_type, r]));
    return STATIONARY_TYPES.map((dt) => map.get(dt)).filter(Boolean) as SensorReading[];
  }, [readings]);

  return (
    <div className="flex gap-3 flex-wrap">
      {sorted.map((r, i) => {
        const meta = SENSOR_META[r.device_type];
        if (!meta) return null;

        let displayValue: string;
        if (r.device_type === "MOTION") {
          displayValue = r.value && r.value > 0 ? "Есть" : "Нет";
        } else if (r.device_type === "DOOR") {
          displayValue = r.value && r.value > 0 ? "Открыта" : "Закрыта";
        } else {
          displayValue = meta.format(r.value, r.value_secondary);
        }

        return (
          <div
            key={r.sensor_id}
            className="bg-[var(--color-surface)] rounded-xl border border-border px-4 py-2.5 flex items-center gap-3 animate-float-up"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <span className="text-sm">{meta.icon}</span>
            <span className="text-xs text-[var(--color-text-tertiary)]">{meta.label}</span>
            <span className="text-sm font-semibold text-foreground">{displayValue}</span>
            {meta.unit && (
              <span className="text-[10px] text-[var(--color-text-tertiary)]">{meta.unit}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── NurseCallCard ────────────────────────────────────────────────────────────

function NurseCallCard({
  nurseCalls,
  patientId,
  queryClient,
}: {
  nurseCalls: NurseCall[];
  patientId: string;
  queryClient: ReturnType<typeof useQueryClient>;
}) {
  const [elapsed, setElapsed] = useState("");
  const activeCall = nurseCalls.find((c) => c.status !== "RESOLVED");

  useEffect(() => {
    if (!activeCall) return;
    const update = () => setElapsed(elapsedSince(activeCall.called_at));
    update();
    const id = setInterval(update, 5000);
    return () => clearInterval(id);
  }, [activeCall?.called_at, activeCall]);

  const acceptMutation = useMutation({
    mutationFn: () => monitoringApi.acceptNurseCall(activeCall!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["monitoring-nurse-calls", patientId] });
      toast.success("Вызов принят");
    },
    onError: () => toast.error("Ошибка"),
  });

  const enRouteMutation = useMutation({
    mutationFn: () => monitoringApi.enRouteNurseCall(activeCall!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["monitoring-nurse-calls", patientId] });
      toast.success("Статус обновлён");
    },
    onError: () => toast.error("Ошибка"),
  });

  const onSiteMutation = useMutation({
    mutationFn: () => monitoringApi.onSiteNurseCall(activeCall!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["monitoring-nurse-calls", patientId] });
      toast.success("Статус обновлён");
    },
    onError: () => toast.error("Ошибка"),
  });

  const resolveMutation = useMutation({
    mutationFn: () => monitoringApi.resolveNurseCall(activeCall!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["monitoring-nurse-calls", patientId] });
      toast.success("Вызов завершён");
    },
    onError: () => toast.error("Ошибка"),
  });

  const currentStepIdx = activeCall
    ? NURSE_STEPS.indexOf(activeCall.status)
    : -1;

  return (
    <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-5 animate-float-up">
      <h3 className="text-sm font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-4">
        Вызов медсестры
      </h3>

      {!activeCall ? (
        <p className="text-sm text-[var(--color-text-secondary)] text-center py-4">
          Нет активных вызовов
        </p>
      ) : (
        <div className="space-y-4">
          {/* Timeline */}
          <div className="flex items-center gap-0">
            {NURSE_STEPS.map((step, i) => {
              const isPast = i < currentStepIdx;
              const isCurrent = i === currentStepIdx;
              const isFuture = i > currentStepIdx;

              return (
                <div key={step} className="flex items-center flex-1">
                  <div className="flex flex-col items-center gap-1">
                    <div
                      className={`w-4 h-4 rounded-full border-2 transition-all ${
                        isCurrent
                          ? "border-secondary bg-secondary scale-125"
                          : isPast
                          ? "border-success bg-success"
                          : "border-[var(--color-text-tertiary)]/30 bg-transparent"
                      }`}
                    />
                    <span
                      className={`text-[10px] ${
                        isCurrent
                          ? "text-secondary font-semibold"
                          : isPast
                          ? "text-success"
                          : "text-[var(--color-text-tertiary)]"
                      }`}
                    >
                      {NURSE_STEP_LABELS[step]}
                    </span>
                  </div>
                  {i < NURSE_STEPS.length - 1 && (
                    <div
                      className={`flex-1 h-0.5 mx-1 ${
                        i < currentStepIdx
                          ? "bg-success"
                          : "bg-[var(--color-text-tertiary)]/20"
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Info row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xs text-[var(--color-text-tertiary)]">
                Вызов: {fmtTime(activeCall.called_at)}
              </span>
              {activeCall.accepted_by_name && (
                <span className="text-xs text-[var(--color-text-secondary)]">
                  Принял: {activeCall.accepted_by_name}
                </span>
              )}
            </div>
            <span className="text-sm font-mono font-semibold text-foreground">
              {elapsed}
            </span>
          </div>

          {/* Action button */}
          <div className="flex justify-end">
            {activeCall.status === "CALLED" && (
              <button
                onClick={() => acceptMutation.mutate()}
                disabled={acceptMutation.isPending}
                className="bg-secondary text-white rounded-xl px-4 py-2 text-sm font-medium hover:bg-secondary/90 transition-colors disabled:opacity-50"
              >
                Принять
              </button>
            )}
            {activeCall.status === "ACCEPTED" && (
              <button
                onClick={() => enRouteMutation.mutate()}
                disabled={enRouteMutation.isPending}
                className="bg-secondary text-white rounded-xl px-4 py-2 text-sm font-medium hover:bg-secondary/90 transition-colors disabled:opacity-50"
              >
                В пути
              </button>
            )}
            {activeCall.status === "EN_ROUTE" && (
              <button
                onClick={() => onSiteMutation.mutate()}
                disabled={onSiteMutation.isPending}
                className="bg-secondary text-white rounded-xl px-4 py-2 text-sm font-medium hover:bg-secondary/90 transition-colors disabled:opacity-50"
              >
                На месте
              </button>
            )}
            {activeCall.status === "ON_SITE" && (
              <button
                onClick={() => resolveMutation.mutate()}
                disabled={resolveMutation.isPending}
                className="bg-success text-white rounded-xl px-4 py-2 text-sm font-medium hover:bg-success/90 transition-colors disabled:opacity-50"
              >
                Решено
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── AlertLog ─────────────────────────────────────────────────────────────────

function AlertLog({
  alerts,
  filter,
  onFilterChange,
  patientId,
  queryClient,
}: {
  alerts: Alert[];
  filter: AlertSeverity | "ALL";
  onFilterChange: (f: AlertSeverity | "ALL") => void;
  patientId: string;
  queryClient: ReturnType<typeof useQueryClient>;
}) {
  const filtered = useMemo(
    () =>
      filter === "ALL"
        ? alerts
        : alerts.filter((a) => a.severity === filter),
    [alerts, filter]
  );

  const ackMutation = useMutation({
    mutationFn: (alertId: string) => monitoringApi.acknowledgeAlert(alertId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["monitoring-alerts", patientId] });
      toast.success("Тревога подтверждена");
    },
    onError: () => toast.error("Ошибка"),
  });

  const resolveMutation = useMutation({
    mutationFn: (alertId: string) => monitoringApi.resolveAlert(alertId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["monitoring-alerts", patientId] });
      toast.success("Тревога закрыта");
    },
    onError: () => toast.error("Ошибка"),
  });

  const severityBadgeVariant = (s: AlertSeverity): "warning" | "destructive" | "muted" => {
    if (s === "CRITICAL") return "destructive";
    if (s === "WARNING") return "warning";
    return "muted";
  };

  const statusBadgeVariant = (
    s: string
  ): "destructive" | "warning" | "success" | "muted" => {
    if (s === "ACTIVE") return "destructive";
    if (s === "ACKNOWLEDGED") return "warning";
    if (s === "RESOLVED") return "success";
    return "muted";
  };

  const statusLabels: Record<string, string> = {
    ACTIVE: "Активна",
    ACKNOWLEDGED: "Подтверждена",
    RESOLVED: "Закрыта",
  };

  return (
    <div className="bg-[var(--color-surface)] rounded-2xl border border-border overflow-hidden animate-float-up">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h3 className="text-sm font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">
          Журнал тревог
        </h3>
        <div className="flex gap-1">
          {(["ALL", "WARNING", "CRITICAL"] as const).map((f) => (
            <button
              key={f}
              onClick={() => onFilterChange(f)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                filter === f
                  ? "bg-secondary/10 text-secondary"
                  : "text-[var(--color-text-tertiary)] hover:text-foreground"
              }`}
            >
              {f === "ALL" ? "Все" : f}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="p-8 text-center">
          <p className="text-sm text-[var(--color-text-secondary)]">Нет тревог</p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {filtered.map((a) => (
            <div key={a.id} className="px-4 py-3 flex items-center gap-3">
              <span className="text-xs font-mono text-[var(--color-text-tertiary)] flex-shrink-0 w-24">
                {fmtDateTime(a.created_at)}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground truncate">{a.title}</p>
              </div>
              <Badge variant={severityBadgeVariant(a.severity)}>{a.severity}</Badge>
              <Badge variant={statusBadgeVariant(a.status)} dot>
                {statusLabels[a.status] ?? a.status}
              </Badge>
              <div className="flex gap-1.5 flex-shrink-0">
                {a.status === "ACTIVE" && (
                  <button
                    onClick={() => ackMutation.mutate(a.id)}
                    disabled={ackMutation.isPending}
                    className="text-xs font-medium text-secondary hover:underline disabled:opacity-50"
                  >
                    Подтвердить
                  </button>
                )}
                {a.status === "ACKNOWLEDGED" && (
                  <button
                    onClick={() => resolveMutation.mutate(a.id)}
                    disabled={resolveMutation.isPending}
                    className="text-xs font-medium text-success hover:underline disabled:opacity-50"
                  >
                    Закрыть
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── TrendCharts ──────────────────────────────────────────────────────────────

function TrendChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}) {
  if (!active || !payload?.length || !label) return null;
  return (
    <div className="bg-[var(--color-surface)] border border-border rounded-lg px-3 py-2 shadow-lg">
      <p className="text-xs text-[var(--color-text-tertiary)] mb-1">{label}</p>
      <p className="text-sm font-semibold text-foreground">
        {typeof payload[0].value === "number" ? payload[0].value.toFixed(1) : "—"}
      </p>
    </div>
  );
}

function TrendCharts({
  patientId,
  readings,
  trendPeriod,
  onPeriodChange,
  trendSensorId,
  onSensorChange,
}: {
  patientId: string;
  readings: SensorReading[];
  trendPeriod: number;
  onPeriodChange: (h: number) => void;
  trendSensorId: string;
  onSensorChange: (id: string) => void;
}) {
  const { data: trendData, isLoading } = useQuery<ReadingPoint[]>({
    queryKey: ["monitoring-trend", patientId, trendSensorId, trendPeriod],
    queryFn: () =>
      monitoringApi.getSensorReadings(patientId, trendSensorId, trendPeriod),
    enabled: !!trendSensorId,
  });

  const chartData = useMemo(() => {
    if (!trendData) return [];
    return trendData.map((p) => ({
      time: fmtTime(p.recorded_at),
      value: p.value,
    }));
  }, [trendData]);

  const currentSensor = readings.find((r) => r.sensor_id === trendSensorId);
  const sensorMeta = currentSensor
    ? SENSOR_META[currentSensor.device_type]
    : undefined;

  return (
    <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-5 animate-float-up">
      <h3 className="text-sm font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-4">
        Тренды
      </h3>

      {/* Period selector */}
      <div className="flex items-center gap-4 mb-4 flex-wrap">
        <div className="flex bg-[var(--color-muted)] rounded-lg p-0.5">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.hours}
              onClick={() => onPeriodChange(opt.hours)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                trendPeriod === opt.hours
                  ? "bg-[var(--color-surface)] text-foreground shadow-sm"
                  : "text-[var(--color-text-tertiary)] hover:text-foreground"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Sensor selector */}
        <div className="flex gap-1 flex-wrap">
          {readings.map((r) => {
            const meta = SENSOR_META[r.device_type];
            if (!meta || r.device_type === "FALL_DETECTOR") return null;
            return (
              <button
                key={r.sensor_id}
                onClick={() => onSensorChange(r.sensor_id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  trendSensorId === r.sensor_id
                    ? "bg-secondary/10 text-secondary"
                    : "text-[var(--color-text-tertiary)] hover:text-foreground bg-[var(--color-muted)]"
                }`}
              >
                {meta.icon} {meta.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Chart */}
      {isLoading ? (
        <div className="h-[250px] bg-[var(--color-muted)] rounded-xl animate-pulse" />
      ) : chartData.length === 0 ? (
        <div className="h-[250px] flex items-center justify-center">
          <p className="text-sm text-[var(--color-text-secondary)]">Нет данных за выбранный период</p>
        </div>
      ) : (
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 5, right: 5, bottom: 0, left: -20 }}
            >
              <defs>
                <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--secondary))" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="hsl(var(--secondary))" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--color-border)"
                strokeOpacity={0.5}
                vertical={false}
              />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 10, fill: "var(--color-text-tertiary)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "var(--color-text-tertiary)" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<TrendChartTooltip />} />
              <Area
                type="monotone"
                dataKey="value"
                stroke="hsl(var(--secondary))"
                strokeWidth={2}
                fill="url(#trendGrad)"
                dot={false}
                activeDot={{
                  r: 4,
                  fill: "hsl(var(--secondary))",
                  stroke: "var(--color-surface)",
                  strokeWidth: 2,
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {sensorMeta && (
        <p className="text-[10px] text-[var(--color-text-tertiary)] mt-2 text-right">
          {sensorMeta.label} ({sensorMeta.unit})
        </p>
      )}
    </div>
  );
}

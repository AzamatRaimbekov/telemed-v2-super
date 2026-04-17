import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { infrastructureApi } from "@/features/infrastructure/api";
import {
  EQUIPMENT_TYPE_LABELS,
  EQUIPMENT_STATUS_META,
} from "@/features/infrastructure/thresholds";
import { Badge } from "@/components/ui/badge";
import type {
  Building,
  Floor,
  Equipment,
  EquipmentCommand,
  EquipmentType,
  EquipmentStatus,
  EquipmentCommandType,
} from "@/features/infrastructure/types";

export const Route = createFileRoute("/_authenticated/infrastructure/equipment")({
  component: EquipmentPage,
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

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const STATUS_BADGE_VARIANT: Record<EquipmentStatus, "success" | "muted" | "destructive" | "warning" | "secondary"> = {
  ON: "success",
  OFF: "muted",
  ERROR: "destructive",
  MAINTENANCE: "warning",
  STANDBY: "secondary",
};

const COMMAND_STATUS_VARIANT: Record<string, "muted" | "success" | "destructive"> = {
  PENDING: "muted",
  EXECUTED: "success",
  FAILED: "destructive",
};

const COMMAND_STATUS_LABEL: Record<string, string> = {
  PENDING: "Ожидание",
  EXECUTED: "Выполнено",
  FAILED: "Ошибка",
};

const COMMAND_LABELS: Record<string, string> = {
  TURN_ON: "Включить",
  TURN_OFF: "Выключить",
  SET_PARAMETER: "Установить параметр",
  RESTART: "Перезапуск",
};

const EQUIPMENT_TYPES: EquipmentType[] = [
  "AC", "HEATER", "LIGHT", "VENTILATION", "DOOR_LOCK",
  "ELEVATOR", "PUMP", "GENERATOR", "UPS", "OTHER",
];

const ALL_STATUSES: EquipmentStatus[] = ["ON", "OFF", "ERROR", "MAINTENANCE", "STANDBY"];

/* ── extended equipment type with joined fields ── */

type EquipmentWithRoom = Equipment & {
  room_name?: string;
  floor_name?: string;
  floor_id?: string;
};

/* ── main component ── */

function EquipmentPage() {
  const queryClient = useQueryClient();

  const [filterFloor, setFilterFloor] = useState<string>("");
  const [filterType, setFilterType] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [paramModalEquipment, setParamModalEquipment] = useState<EquipmentWithRoom | null>(null);
  const [expandedHistory, setExpandedHistory] = useState<string | null>(null);

  // Get buildings and floors
  const { data: buildings } = useQuery<Building[]>({
    queryKey: ["bms-buildings"],
    queryFn: infrastructureApi.getBuildings,
  });

  const buildingId = buildings?.[0]?.id ?? "";

  const { data: floors, isLoading: floorsLoading } = useQuery<Floor[]>({
    queryKey: ["bms-floors", buildingId],
    queryFn: () => infrastructureApi.getFloors(buildingId),
    enabled: !!buildingId,
  });

  // Get equipment for each floor
  const floorIds = floors?.map((f) => f.id) ?? [];

  const equipmentQueries = floorIds.map((floorId) => ({
    queryKey: ["bms-floor-equipment", floorId],
    queryFn: () => infrastructureApi.getFloorEquipment(floorId),
    enabled: !!floorId,
  }));

  // We'll use a single query that fetches all floors' equipment
  const { data: allEquipmentByFloor, isLoading: equipLoading } = useQuery<EquipmentWithRoom[]>({
    queryKey: ["bms-all-equipment", ...floorIds],
    queryFn: async () => {
      if (!floorIds.length) return [];
      const results = await Promise.all(
        floors!.map(async (floor) => {
          const equipment: Equipment[] = await infrastructureApi.getFloorEquipment(floor.id);
          return equipment.map((eq) => ({
            ...eq,
            floor_name: floor.name,
            floor_id: floor.id,
          }));
        }),
      );
      return results.flat();
    },
    enabled: floorIds.length > 0,
  });

  const allEquipment = allEquipmentByFloor ?? [];

  // Apply filters
  const filteredEquipment = allEquipment.filter((eq) => {
    if (filterFloor && eq.floor_id !== filterFloor) return false;
    if (filterType && eq.equipment_type !== filterType) return false;
    if (filterStatus && eq.status !== filterStatus) return false;
    return true;
  });

  // Command mutation
  const commandMutation = useMutation({
    mutationFn: ({ equipmentId, command, parameters }: { equipmentId: string; command: string; parameters?: Record<string, unknown> }) =>
      infrastructureApi.sendCommand(equipmentId, { command, parameters }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bms-all-equipment"] });
      queryClient.invalidateQueries({ queryKey: ["bms-equipment-commands"] });
      toast.success("Команда отправлена");
    },
    onError: () => toast.error("Не удалось отправить команду"),
  });

  return (
    <div className="space-y-8 pb-8">
      {/* ── Filters ── */}
      <section>
        <h2 className="text-sm font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-4">
          Управление оборудованием
        </h2>
        <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-4 flex flex-wrap gap-3">
          <select
            className="bg-[var(--color-muted)] rounded-lg px-3 py-2 text-sm min-w-[160px]"
            value={filterFloor}
            onChange={(e) => setFilterFloor(e.target.value)}
          >
            <option value="">Все этажи</option>
            {floors?.map((floor) => (
              <option key={floor.id} value={floor.id}>
                {floor.name}
              </option>
            ))}
          </select>
          <select
            className="bg-[var(--color-muted)] rounded-lg px-3 py-2 text-sm min-w-[160px]"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="">Все типы</option>
            {EQUIPMENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {EQUIPMENT_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
          <select
            className="bg-[var(--color-muted)] rounded-lg px-3 py-2 text-sm min-w-[160px]"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">Все статусы</option>
            {ALL_STATUSES.map((s) => (
              <option key={s} value={s}>
                {EQUIPMENT_STATUS_META[s].label}
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* ── Equipment List ── */}
      <section>
        <h2 className="text-sm font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-4">
          Оборудование ({filteredEquipment.length})
        </h2>
        {floorsLoading || equipLoading ? (
          <div className="space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse bg-[var(--color-muted)] rounded-2xl h-28" />
            ))}
          </div>
        ) : filteredEquipment.length === 0 ? (
          <p className="text-center text-[var(--color-text-secondary)] py-8">
            Оборудование не найдено
          </p>
        ) : (
          <div className="space-y-3">
            {filteredEquipment.map((eq) => {
              const statusMeta = EQUIPMENT_STATUS_META[eq.status];
              const isExpanded = expandedHistory === eq.id;
              return (
                <div key={eq.id}>
                  <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-5">
                    <div className="flex items-start gap-4">
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-sm">{eq.name}</span>
                          <Badge variant={STATUS_BADGE_VARIANT[eq.status]}>
                            {statusMeta.label}
                          </Badge>
                        </div>
                        <div className="text-xs text-[var(--color-text-secondary)] space-y-0.5">
                          <div>Тип: {EQUIPMENT_TYPE_LABELS[eq.equipment_type]}</div>
                          {eq.room_name && <div>Помещение: {eq.room_name}</div>}
                          {eq.floor_name && <div>Этаж: {eq.floor_name}</div>}
                          {eq.model && <div>Модель: {eq.model}</div>}
                        </div>

                        {/* Parameters */}
                        {eq.parameters && Object.keys(eq.parameters).length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {Object.entries(eq.parameters).map(([key, value]) => (
                              <Badge key={key} variant="muted">
                                {key}: {String(value)}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Controls */}
                      {eq.is_controllable && (
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            className={`px-4 py-2 text-sm font-medium rounded-xl transition-colors ${
                              eq.status === "ON"
                                ? "bg-destructive/10 text-destructive hover:bg-destructive/20"
                                : "bg-success/10 text-success hover:bg-success/20"
                            }`}
                            disabled={commandMutation.isPending}
                            onClick={() =>
                              commandMutation.mutate({
                                equipmentId: eq.id,
                                command: eq.status === "ON" ? "TURN_OFF" : "TURN_ON",
                              })
                            }
                          >
                            {eq.status === "ON" ? "Выкл" : "Вкл"}
                          </button>
                          <button
                            className="bg-secondary text-white rounded-xl px-4 py-2 text-sm font-medium hover:bg-secondary/90 transition-colors"
                            onClick={() => setParamModalEquipment(eq)}
                          >
                            Параметры
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Command History Toggle */}
                    <button
                      className="mt-3 text-xs text-primary hover:underline"
                      onClick={() => setExpandedHistory(isExpanded ? null : eq.id)}
                    >
                      {isExpanded ? "Скрыть историю команд" : "История команд"}
                    </button>
                  </div>

                  {/* Command History (expandable) */}
                  {isExpanded && <CommandHistory equipmentId={eq.id} />}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Parameter Modal ── */}
      {paramModalEquipment && (
        <ParameterModal
          equipment={paramModalEquipment}
          onClose={() => setParamModalEquipment(null)}
          onSend={(params) => {
            commandMutation.mutate(
              {
                equipmentId: paramModalEquipment.id,
                command: "SET_PARAMETER",
                parameters: params,
              },
              {
                onSuccess: () => setParamModalEquipment(null),
              },
            );
          }}
          isPending={commandMutation.isPending}
        />
      )}
    </div>
  );
}

/* ── Command History Component ── */

function CommandHistory({ equipmentId }: { equipmentId: string }) {
  const { data: commands, isLoading } = useQuery<EquipmentCommand[]>({
    queryKey: ["bms-equipment-commands", equipmentId],
    queryFn: () => infrastructureApi.getEquipmentCommands(equipmentId),
  });

  if (isLoading) {
    return (
      <div className="mt-1 bg-[var(--color-surface)] rounded-b-2xl border border-t-0 border-border p-4">
        <div className="animate-pulse bg-[var(--color-muted)] rounded-lg h-16" />
      </div>
    );
  }

  if (!commands?.length) {
    return (
      <div className="mt-1 bg-[var(--color-surface)] rounded-b-2xl border border-t-0 border-border p-4">
        <p className="text-xs text-[var(--color-text-tertiary)] text-center py-2">
          Нет истории команд
        </p>
      </div>
    );
  }

  return (
    <div className="mt-1 bg-[var(--color-surface)] rounded-b-2xl border border-t-0 border-border p-4">
      <div className="divide-y divide-border">
        {commands.map((cmd) => (
          <div key={cmd.id} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
            <span className="text-xs text-[var(--color-text-tertiary)] min-w-[120px]">
              {formatDateTime(cmd.issued_at)}
            </span>
            <span className="text-xs font-medium min-w-[120px]">
              {COMMAND_LABELS[cmd.command] ?? cmd.command}
            </span>
            {cmd.parameters && Object.keys(cmd.parameters).length > 0 && (
              <span className="text-xs text-[var(--color-text-secondary)]">
                {JSON.stringify(cmd.parameters)}
              </span>
            )}
            <div className="flex-1" />
            <Badge variant={COMMAND_STATUS_VARIANT[cmd.status] ?? "muted"}>
              {COMMAND_STATUS_LABEL[cmd.status] ?? cmd.status}
            </Badge>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Parameter Modal ── */

function ParameterModal({
  equipment,
  onClose,
  onSend,
  isPending,
}: {
  equipment: EquipmentWithRoom;
  onClose: () => void;
  onSend: (params: Record<string, unknown>) => void;
  isPending: boolean;
}) {
  const [temperature, setTemperature] = useState(22);
  const [brightness, setBrightness] = useState(50);
  const [jsonInput, setJsonInput] = useState("{}");

  const isAC = equipment.equipment_type === "AC";
  const isLight = equipment.equipment_type === "LIGHT";

  const handleSend = () => {
    if (isAC) {
      onSend({ temperature });
    } else if (isLight) {
      onSend({ brightness });
    } else {
      try {
        const parsed = JSON.parse(jsonInput);
        onSend(parsed);
      } catch {
        toast.error("Некорректный JSON");
      }
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-6 w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-sm">Параметры: {equipment.name}</h3>
          <button
            className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] text-lg"
            onClick={onClose}
          >
            &times;
          </button>
        </div>

        {isAC && (
          <div className="space-y-3">
            <label className="text-xs text-[var(--color-text-secondary)]">
              Температура: {temperature}°C
            </label>
            <input
              type="range"
              min={16}
              max={30}
              value={temperature}
              onChange={(e) => setTemperature(Number(e.target.value))}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-xs text-[var(--color-text-tertiary)]">
              <span>16°C</span>
              <span>30°C</span>
            </div>
          </div>
        )}

        {isLight && (
          <div className="space-y-3">
            <label className="text-xs text-[var(--color-text-secondary)]">
              Яркость: {brightness}%
            </label>
            <input
              type="range"
              min={0}
              max={100}
              value={brightness}
              onChange={(e) => setBrightness(Number(e.target.value))}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-xs text-[var(--color-text-tertiary)]">
              <span>0%</span>
              <span>100%</span>
            </div>
          </div>
        )}

        {!isAC && !isLight && (
          <div className="space-y-2">
            <label className="text-xs text-[var(--color-text-secondary)]">
              Параметры (JSON)
            </label>
            <textarea
              className="w-full bg-[var(--color-muted)] rounded-lg px-3 py-2 text-sm font-mono min-h-[100px] resize-y"
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
            />
          </div>
        )}

        <div className="flex justify-end gap-2 mt-5">
          <button
            className="px-4 py-2 text-sm rounded-xl bg-[var(--color-muted)] hover:bg-[var(--color-muted)]/80 transition-colors"
            onClick={onClose}
          >
            Отмена
          </button>
          <button
            className="bg-secondary text-white rounded-xl px-4 py-2 text-sm font-medium hover:bg-secondary/90 transition-colors disabled:opacity-50"
            disabled={isPending}
            onClick={handleSend}
          >
            Отправить
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

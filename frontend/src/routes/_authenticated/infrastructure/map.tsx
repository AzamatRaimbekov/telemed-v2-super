import { useState, useEffect, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { infrastructureApi } from "@/features/infrastructure/api";
import { useBmsWS } from "@/features/infrastructure/use-bms-ws";
import {
  BMS_SENSOR_META,
  EQUIPMENT_TYPE_LABELS,
  EQUIPMENT_STATUS_META,
  ROOM_TYPE_LABELS,
} from "@/features/infrastructure/thresholds";
import { Badge } from "@/components/ui/badge";
import type {
  Building,
  Floor,
  BmsRoom,
  BmsSensor,
  Equipment,
  BmsSensorSeverity,
} from "@/features/infrastructure/types";

export const Route = createFileRoute("/_authenticated/infrastructure/map")({
  component: FloorMapPage,
});

/* ── helpers ── */

const SEVERITY_ORDER: Record<string, number> = {
  NORMAL: 0,
  WARNING: 1,
  CRITICAL: 2,
  EMERGENCY: 3,
};

function getWorstSeverity(sensors: BmsSensor[]): BmsSensorSeverity {
  if (!sensors.length) return "NORMAL";

  // We don't have severity on sensors directly from the API list,
  // so we'll just return NORMAL — real severity comes from sensor data thresholds.
  // The floor sensors endpoint may include severity info.
  return "NORMAL";
}

function getSensorSeverity(sensor: BmsSensor & { severity?: BmsSensorSeverity }): BmsSensorSeverity {
  return (sensor as any).severity ?? "NORMAL";
}

function roomWorstSeverity(
  roomId: string,
  sensors: (BmsSensor & { severity?: BmsSensorSeverity })[],
): BmsSensorSeverity {
  const roomSensors = sensors.filter((s) => s.bms_room_id === roomId);
  if (!roomSensors.length) return "NORMAL";

  let worst = 0;
  for (const s of roomSensors) {
    const sev = getSensorSeverity(s);
    const order = SEVERITY_ORDER[sev] ?? 0;
    if (order > worst) worst = order;
  }
  const names: BmsSensorSeverity[] = ["NORMAL", "WARNING", "CRITICAL", "EMERGENCY"];
  return names[worst];
}

function severityDotColor(severity: BmsSensorSeverity): string {
  switch (severity) {
    case "EMERGENCY":
      return "bg-destructive animate-pulse";
    case "CRITICAL":
      return "bg-destructive";
    case "WARNING":
      return "bg-warning";
    default:
      return "bg-success";
  }
}

function severityBgOpacity(severity: BmsSensorSeverity): string {
  switch (severity) {
    case "EMERGENCY":
      return "opacity-50 animate-pulse";
    case "CRITICAL":
      return "opacity-50";
    case "WARNING":
      return "opacity-30";
    default:
      return "opacity-15";
  }
}

/* ── main component ── */

function FloorMapPage() {
  useBmsWS();
  const queryClient = useQueryClient();

  const [selectedFloorId, setSelectedFloorId] = useState<string>("");
  const [selectedRoom, setSelectedRoom] = useState<BmsRoom | null>(null);

  // Get buildings, pick first
  const { data: buildings } = useQuery<Building[]>({
    queryKey: ["bms-buildings"],
    queryFn: infrastructureApi.getBuildings,
  });

  const buildingId = buildings?.[0]?.id ?? "";

  // Get floors for the building
  const { data: floors, isLoading: floorsLoading } = useQuery<Floor[]>({
    queryKey: ["bms-floors", buildingId],
    queryFn: () => infrastructureApi.getFloors(buildingId),
    enabled: !!buildingId,
  });

  // Auto-select first floor
  useEffect(() => {
    if (floors?.length && !selectedFloorId) {
      setSelectedFloorId(floors[0].id);
    }
  }, [floors, selectedFloorId]);

  const selectedFloor = floors?.find((f) => f.id === selectedFloorId);

  // Get rooms for floor
  const { data: rooms, isLoading: roomsLoading } = useQuery<BmsRoom[]>({
    queryKey: ["bms-floor-rooms", selectedFloorId],
    queryFn: () => infrastructureApi.getRooms(selectedFloorId),
    enabled: !!selectedFloorId,
  });

  // Get sensors for floor
  const { data: sensors } = useQuery<(BmsSensor & { severity?: BmsSensorSeverity })[]>({
    queryKey: ["bms-floor-sensors", selectedFloorId],
    queryFn: () => infrastructureApi.getFloorSensors(selectedFloorId),
    enabled: !!selectedFloorId,
    refetchInterval: 30_000,
  });

  // Get equipment for selected room
  const { data: roomEquipment, isLoading: equipmentLoading } = useQuery<Equipment[]>({
    queryKey: ["bms-room-equipment", selectedRoom?.id],
    queryFn: () => infrastructureApi.getRoomEquipment(selectedRoom!.id),
    enabled: !!selectedRoom?.id,
  });

  // Command mutation
  const commandMutation = useMutation({
    mutationFn: ({
      equipmentId,
      command,
    }: {
      equipmentId: string;
      command: string;
    }) => infrastructureApi.sendCommand(equipmentId, { command }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bms-room-equipment", selectedRoom?.id] });
      toast.success("Команда отправлена");
    },
    onError: () => toast.error("Не удалось отправить команду"),
  });

  const isLoading = floorsLoading || roomsLoading;

  return (
    <div className="flex gap-4 h-[calc(100vh-8rem)]">
      {/* ── Main Area ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Floor Selector */}
        <div className="flex gap-1 p-1 bg-[var(--color-muted)] rounded-xl mb-4 w-fit">
          {floorsLoading ? (
            <>
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="animate-pulse bg-[var(--color-surface)]/50 rounded-lg h-8 w-20"
                />
              ))}
            </>
          ) : (
            floors?.map((floor) => (
              <button
                key={floor.id}
                className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all ${
                  floor.id === selectedFloorId
                    ? "bg-[var(--color-surface)] shadow-sm text-[var(--color-text)]"
                    : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
                }`}
                onClick={() => {
                  setSelectedFloorId(floor.id);
                  setSelectedRoom(null);
                }}
              >
                {floor.name}
              </button>
            ))
          )}
        </div>

        {/* Floor Grid */}
        <div className="flex-1 bg-[var(--color-surface)] rounded-2xl border border-border p-4 flex flex-col">
          {isLoading ? (
            <div className="flex-1 grid grid-cols-6 grid-rows-4 gap-1">
              {Array.from({ length: 12 }).map((_, i) => (
                <div
                  key={i}
                  className="animate-pulse bg-[var(--color-muted)] rounded-lg"
                />
              ))}
            </div>
          ) : selectedFloor && rooms ? (
            <>
              <FloorGrid
                floor={selectedFloor}
                rooms={rooms}
                sensors={sensors ?? []}
                selectedRoom={selectedRoom}
                onSelectRoom={setSelectedRoom}
              />
              {/* Legend */}
              <Legend />
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-[var(--color-text-secondary)]">
              Выберите этаж для отображения плана
            </div>
          )}
        </div>
      </div>

      {/* ── Side Panel ── */}
      <div
        className={`shrink-0 transition-all duration-300 overflow-hidden ${
          selectedRoom ? "w-[380px]" : "w-0"
        }`}
      >
        {selectedRoom && (
          <SidePanel
            room={selectedRoom}
            sensors={(sensors ?? []).filter(
              (s) => s.bms_room_id === selectedRoom.id,
            )}
            equipment={roomEquipment ?? []}
            equipmentLoading={equipmentLoading}
            onClose={() => setSelectedRoom(null)}
            onCommand={(equipmentId, command) =>
              commandMutation.mutate({ equipmentId, command })
            }
            commandPending={commandMutation.isPending}
          />
        )}
      </div>
    </div>
  );
}

/* ── FloorGrid ── */

function FloorGrid({
  floor,
  rooms,
  sensors,
  selectedRoom,
  onSelectRoom,
}: {
  floor: Floor;
  rooms: BmsRoom[];
  sensors: (BmsSensor & { severity?: BmsSensorSeverity })[];
  selectedRoom: BmsRoom | null;
  onSelectRoom: (room: BmsRoom) => void;
}) {
  return (
    <div
      className="flex-1"
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${floor.grid_cols}, 1fr)`,
        gridTemplateRows: `repeat(${floor.grid_rows}, 1fr)`,
        gap: "4px",
        aspectRatio: `${floor.grid_cols} / ${floor.grid_rows}`,
        maxHeight: "100%",
      }}
    >
      {rooms.map((room) => (
        <RoomCell
          key={room.id}
          room={room}
          sensors={sensors.filter((s) => s.bms_room_id === room.id)}
          isSelected={selectedRoom?.id === room.id}
          onClick={() => onSelectRoom(room)}
        />
      ))}
    </div>
  );
}

/* ── RoomCell ── */

function RoomCell({
  room,
  sensors,
  isSelected,
  onClick,
}: {
  room: BmsRoom;
  sensors: (BmsSensor & { severity?: BmsSensorSeverity })[];
  isSelected: boolean;
  onClick: () => void;
}) {
  const worst = useMemo(() => {
    if (!sensors.length) return "NORMAL" as BmsSensorSeverity;
    let max = 0;
    for (const s of sensors) {
      const sev = getSensorSeverity(s);
      const order = SEVERITY_ORDER[sev] ?? 0;
      if (order > max) max = order;
    }
    return (["NORMAL", "WARNING", "CRITICAL", "EMERGENCY"] as BmsSensorSeverity[])[max];
  }, [sensors]);

  const zoneColor = room.zone?.color ?? "#6b7280";

  return (
    <div
      className={`relative rounded-lg cursor-pointer transition-all overflow-hidden flex flex-col items-center justify-center ${
        isSelected
          ? "ring-2 ring-primary ring-offset-1"
          : "hover:brightness-110"
      }`}
      style={{
        gridColumn: `${room.grid_x + 1} / span ${room.grid_w}`,
        gridRow: `${room.grid_y + 1} / span ${room.grid_h}`,
        border: `1px solid ${zoneColor}30`,
      }}
      onClick={onClick}
    >
      {/* Background with zone color + severity opacity */}
      <div
        className={`absolute inset-0 ${severityBgOpacity(worst)}`}
        style={{ backgroundColor: zoneColor }}
      />

      {/* Room content */}
      <div className="relative z-10 text-center px-1">
        <div className="text-[10px] font-medium leading-tight truncate max-w-full">
          {room.name}
        </div>
        <div className="text-[8px] text-[var(--color-text-tertiary)] leading-tight truncate">
          {ROOM_TYPE_LABELS[room.room_type] ?? room.room_type}
        </div>
      </div>

      {/* Sensor dots */}
      {sensors.map((sensor) => (
        <div
          key={sensor.id}
          className={`absolute w-2.5 h-2.5 rounded-full z-20 ${severityDotColor(getSensorSeverity(sensor))}`}
          style={{
            left: `${sensor.grid_x_offset * 100}%`,
            top: `${sensor.grid_y_offset * 100}%`,
            transform: "translate(-50%, -50%)",
          }}
          title={`${sensor.name}: ${formatSensorValue(sensor)} ${BMS_SENSOR_META[sensor.sensor_type]?.unit ?? ""}`}
        />
      ))}
    </div>
  );
}

function formatSensorValue(sensor: BmsSensor): string {
  const meta = BMS_SENSOR_META[sensor.sensor_type];
  if (!meta) return sensor.last_value != null ? String(sensor.last_value) : "—";
  return meta.format(sensor.last_value, sensor.last_value_text);
}

/* ── SidePanel ── */

function SidePanel({
  room,
  sensors,
  equipment,
  equipmentLoading,
  onClose,
  onCommand,
  commandPending,
}: {
  room: BmsRoom;
  sensors: (BmsSensor & { severity?: BmsSensorSeverity })[];
  equipment: Equipment[];
  equipmentLoading: boolean;
  onClose: () => void;
  onCommand: (equipmentId: string, command: string) => void;
  commandPending: boolean;
}) {
  return (
    <div className="h-full bg-[var(--color-surface)] border-l border-border shadow-lg flex flex-col rounded-r-2xl">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-semibold text-sm truncate">{room.name}</h3>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="muted">
                {ROOM_TYPE_LABELS[room.room_type] ?? room.room_type}
              </Badge>
              {room.zone && (
                <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)]">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: room.zone.color }}
                  />
                  {room.zone.name}
                </div>
              )}
            </div>
          </div>
          <button
            className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[var(--color-muted)] transition-colors text-[var(--color-text-secondary)]"
            onClick={onClose}
          >
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Sensors Section */}
        <section>
          <h4 className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-3">
            Датчики
          </h4>
          {sensors.length === 0 ? (
            <p className="text-xs text-[var(--color-text-secondary)]">
              Нет датчиков в помещении
            </p>
          ) : (
            <div className="space-y-2">
              {sensors.map((sensor) => {
                const meta = BMS_SENSOR_META[sensor.sensor_type];
                const sev = getSensorSeverity(sensor);
                return (
                  <div
                    key={sensor.id}
                    className="flex items-center gap-3 bg-[var(--color-muted)]/50 rounded-xl p-3"
                  >
                    <span
                      className={`w-2.5 h-2.5 rounded-full shrink-0 ${severityDotColor(sev)}`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate">
                        {sensor.name}
                      </div>
                      <div className="text-[10px] text-[var(--color-text-tertiary)]">
                        {meta?.label ?? sensor.sensor_type}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-semibold">
                        {formatSensorValue(sensor)}
                      </div>
                      {meta?.unit && (
                        <div className="text-[10px] text-[var(--color-text-tertiary)]">
                          {meta.unit}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Equipment Section */}
        <section>
          <h4 className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-3">
            Оборудование
          </h4>
          {equipmentLoading ? (
            <div className="space-y-2">
              {[0, 1].map((i) => (
                <div
                  key={i}
                  className="animate-pulse bg-[var(--color-muted)] rounded-xl h-16"
                />
              ))}
            </div>
          ) : equipment.length === 0 ? (
            <p className="text-xs text-[var(--color-text-secondary)]">
              Нет оборудования в помещении
            </p>
          ) : (
            <div className="space-y-2">
              {equipment.map((eq) => {
                const statusMeta = EQUIPMENT_STATUS_META[eq.status];
                return (
                  <div
                    key={eq.id}
                    className="bg-[var(--color-muted)]/50 rounded-xl p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium truncate">
                          {eq.name}
                        </div>
                        <div className="text-[10px] text-[var(--color-text-tertiary)]">
                          {EQUIPMENT_TYPE_LABELS[eq.equipment_type] ??
                            eq.equipment_type}
                        </div>
                      </div>
                      <Badge
                        variant={
                          statusMeta?.variant === "destructive"
                            ? "destructive"
                            : statusMeta?.variant === "default"
                              ? "success"
                              : "muted"
                        }
                      >
                        {statusMeta?.label ?? eq.status}
                      </Badge>
                    </div>

                    {/* Toggle button for controllable equipment */}
                    {eq.is_controllable && (
                      <div className="mt-2 flex gap-2">
                        <button
                          className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-50 ${
                            eq.status === "ON"
                              ? "bg-[var(--color-muted)] text-[var(--color-text-secondary)]"
                              : "bg-success/10 text-success hover:bg-success/20"
                          }`}
                          disabled={commandPending || eq.status === "ON"}
                          onClick={() => onCommand(eq.id, "TURN_ON")}
                        >
                          Вкл
                        </button>
                        <button
                          className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-50 ${
                            eq.status === "OFF"
                              ? "bg-[var(--color-muted)] text-[var(--color-text-secondary)]"
                              : "bg-destructive/10 text-destructive hover:bg-destructive/20"
                          }`}
                          disabled={commandPending || eq.status === "OFF"}
                          onClick={() => onCommand(eq.id, "TURN_OFF")}
                        >
                          Выкл
                        </button>
                      </div>
                    )}

                    {/* Parameters */}
                    {eq.parameters &&
                      Object.keys(eq.parameters).length > 0 && (
                        <div className="mt-2 pt-2 border-t border-border/50">
                          {Object.entries(eq.parameters).map(([key, val]) => (
                            <div
                              key={key}
                              className="flex justify-between text-[10px] py-0.5"
                            >
                              <span className="text-[var(--color-text-tertiary)]">
                                {key}
                              </span>
                              <span className="font-medium">{String(val)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

/* ── Legend ── */

function Legend() {
  return (
    <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/50 flex-wrap">
      <div className="flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-full bg-success" />
        <span className="text-[10px] text-[var(--color-text-tertiary)]">
          Норма
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-full bg-warning" />
        <span className="text-[10px] text-[var(--color-text-tertiary)]">
          Внимание
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-full bg-destructive" />
        <span className="text-[10px] text-[var(--color-text-tertiary)]">
          Критично
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-full bg-destructive animate-pulse" />
        <span className="text-[10px] text-[var(--color-text-tertiary)]">
          Авария
        </span>
      </div>
    </div>
  );
}

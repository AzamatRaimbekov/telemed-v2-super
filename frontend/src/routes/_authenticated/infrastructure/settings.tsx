import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { infrastructureApi } from "@/features/infrastructure/api";
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
  Zone,
  BmsRoom,
  BmsSensor,
  Equipment,
  BmsRoomType,
  BmsSensorType,
  EquipmentType,
  EquipmentStatus,
} from "@/features/infrastructure/types";

export const Route = createFileRoute("/_authenticated/infrastructure/settings")({
  component: SettingsPage,
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

const TABS = ["Этажи", "Зоны", "Помещения", "Датчики", "Оборудование"] as const;

const ROOM_TYPES: BmsRoomType[] = [
  "WARD", "CORRIDOR", "SERVER", "TECHNICAL", "OFFICE",
  "OPERATING", "LAB", "RECEPTION", "PHARMACY", "STORAGE",
  "BATHROOM", "KITCHEN", "OTHER",
];

const SENSOR_TYPES: BmsSensorType[] = [
  "TEMPERATURE", "HUMIDITY", "CO2", "LIGHT", "SMOKE",
  "WATER_LEAK", "MOTION", "DOOR_SENSOR", "POWER_METER", "PIPE_TEMPERATURE",
];

const EQUIPMENT_TYPES: EquipmentType[] = [
  "AC", "HEATER", "LIGHT", "VENTILATION", "DOOR_LOCK",
  "ELEVATOR", "PUMP", "GENERATOR", "UPS", "OTHER",
];

const ZONE_PRESET_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444",
  "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16",
];

const STATUS_BADGE_VARIANT: Record<EquipmentStatus, "success" | "muted" | "destructive" | "warning" | "secondary"> = {
  ON: "success",
  OFF: "muted",
  ERROR: "destructive",
  MAINTENANCE: "warning",
  STANDBY: "secondary",
};

const inputCls = "bg-[var(--color-muted)] rounded-lg px-3 py-2 text-sm";
const labelCls = "text-xs font-medium text-[var(--color-text-secondary)] mb-1 block";

/* ── main component ── */

function SettingsPage() {
  const [tab, setTab] = useState(0);
  const queryClient = useQueryClient();

  // Building + floors
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

  return (
    <div className="space-y-6 pb-8">
      <h2 className="text-sm font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">
        Настройки инфраструктуры
      </h2>

      {/* Tab bar */}
      <div className="bg-[var(--color-muted)] rounded-xl p-1 flex gap-1">
        {TABS.map((label, idx) => (
          <button
            key={label}
            className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
              tab === idx
                ? "bg-[var(--color-surface)] shadow-sm"
                : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            }`}
            onClick={() => setTab(idx)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 0 && (
        <FloorsTab
          buildingId={buildingId}
          floors={floors ?? []}
          isLoading={floorsLoading}
        />
      )}
      {tab === 1 && (
        <ZonesTab
          buildingId={buildingId}
          floors={floors ?? []}
        />
      )}
      {tab === 2 && (
        <RoomsTab
          buildingId={buildingId}
          floors={floors ?? []}
        />
      )}
      {tab === 3 && (
        <SensorsTab
          buildingId={buildingId}
          floors={floors ?? []}
        />
      )}
      {tab === 4 && (
        <EquipmentTab
          buildingId={buildingId}
          floors={floors ?? []}
        />
      )}
    </div>
  );
}

/* ════════════════════════════════════════════
   TAB 0: Floors
   ════════════════════════════════════════════ */

function FloorsTab({
  buildingId,
  floors,
  isLoading,
}: {
  buildingId: string;
  floors: Floor[];
  isLoading: boolean;
}) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editFloor, setEditFloor] = useState<Floor | null>(null);
  const [formData, setFormData] = useState({ floor_number: 1, name: "", grid_cols: 10, grid_rows: 8 });

  const createMutation = useMutation({
    mutationFn: (data: { building_id: string; floor_number: number; name: string; grid_cols: number; grid_rows: number }) =>
      infrastructureApi.createFloor(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bms-floors"] });
      toast.success("Этаж создан");
      setShowForm(false);
      setFormData({ floor_number: 1, name: "", grid_cols: 10, grid_rows: 8 });
    },
    onError: () => toast.error("Не удалось создать этаж"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      infrastructureApi.updateFloor(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bms-floors"] });
      toast.success("Этаж обновлён");
      setEditFloor(null);
    },
    onError: () => toast.error("Не удалось обновить этаж"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => infrastructureApi.deleteFloor(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bms-floors"] });
      toast.success("Этаж удалён");
    },
    onError: () => toast.error("Не удалось удалить этаж"),
  });

  const handleCreate = () => {
    if (!formData.name.trim()) { toast.error("Укажите название"); return; }
    createMutation.mutate({ building_id: buildingId, ...formData });
  };

  const handleDelete = (floor: Floor) => {
    if (confirm(`Удалить этаж "${floor.name}"?`)) deleteMutation.mutate(floor.id);
  };

  return (
    <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold">Этажи</h3>
        <button
          className="bg-secondary text-white rounded-xl px-4 py-2 text-sm font-medium hover:bg-secondary/90 transition-colors"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? "Отмена" : "Добавить этаж"}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-[var(--color-muted)] rounded-xl p-4 mb-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Номер этажа</label>
              <input type="number" className={`${inputCls} w-full`} value={formData.floor_number}
                onChange={(e) => setFormData((p) => ({ ...p, floor_number: Number(e.target.value) }))} />
            </div>
            <div>
              <label className={labelCls}>Название</label>
              <input className={`${inputCls} w-full`} value={formData.name}
                onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))} placeholder="Этаж 1" />
            </div>
            <div>
              <label className={labelCls}>Столбцы сетки</label>
              <input type="number" className={`${inputCls} w-full`} value={formData.grid_cols}
                onChange={(e) => setFormData((p) => ({ ...p, grid_cols: Number(e.target.value) }))} />
            </div>
            <div>
              <label className={labelCls}>Строки сетки</label>
              <input type="number" className={`${inputCls} w-full`} value={formData.grid_rows}
                onChange={(e) => setFormData((p) => ({ ...p, grid_rows: Number(e.target.value) }))} />
            </div>
          </div>
          <button
            className="bg-secondary text-white rounded-xl px-4 py-2 text-sm font-medium hover:bg-secondary/90 transition-colors disabled:opacity-50"
            disabled={createMutation.isPending}
            onClick={handleCreate}
          >
            Создать
          </button>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="animate-pulse bg-[var(--color-muted)] rounded-lg h-32" />
      ) : !floors.length ? (
        <p className="text-center text-[var(--color-text-secondary)] py-8">Нет этажей</p>
      ) : (
        <div className="divide-y divide-border">
          {floors.map((floor) => (
            <div key={floor.id} className="flex items-center gap-4 py-3">
              {editFloor?.id === floor.id ? (
                <FloorEditRow
                  floor={floor}
                  onCancel={() => setEditFloor(null)}
                  onSave={(data) => updateMutation.mutate({ id: floor.id, data })}
                  isPending={updateMutation.isPending}
                />
              ) : (
                <>
                  <span className="text-sm font-medium w-12">#{floor.floor_number}</span>
                  <span className="text-sm flex-1">{floor.name}</span>
                  <span className="text-xs text-[var(--color-text-tertiary)]">
                    {floor.grid_cols}&times;{floor.grid_rows}
                  </span>
                  <div className="flex gap-2 shrink-0">
                    <button
                      className="px-3 py-1.5 text-xs font-medium rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                      onClick={() => setEditFloor(floor)}
                    >
                      Изменить
                    </button>
                    <button
                      className="px-3 py-1.5 text-xs font-medium rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
                      onClick={() => handleDelete(floor)}
                      disabled={deleteMutation.isPending}
                    >
                      Удалить
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FloorEditRow({
  floor,
  onCancel,
  onSave,
  isPending,
}: {
  floor: Floor;
  onCancel: () => void;
  onSave: (data: Record<string, unknown>) => void;
  isPending: boolean;
}) {
  const [data, setData] = useState({
    floor_number: floor.floor_number,
    name: floor.name,
    grid_cols: floor.grid_cols,
    grid_rows: floor.grid_rows,
  });

  return (
    <div className="flex items-center gap-2 flex-1 flex-wrap">
      <input type="number" className={`${inputCls} w-16`} value={data.floor_number}
        onChange={(e) => setData((p) => ({ ...p, floor_number: Number(e.target.value) }))} />
      <input className={`${inputCls} flex-1 min-w-[120px]`} value={data.name}
        onChange={(e) => setData((p) => ({ ...p, name: e.target.value }))} />
      <input type="number" className={`${inputCls} w-16`} value={data.grid_cols}
        onChange={(e) => setData((p) => ({ ...p, grid_cols: Number(e.target.value) }))} />
      <input type="number" className={`${inputCls} w-16`} value={data.grid_rows}
        onChange={(e) => setData((p) => ({ ...p, grid_rows: Number(e.target.value) }))} />
      <button
        className="bg-secondary text-white rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-50"
        disabled={isPending}
        onClick={() => onSave(data)}
      >
        Сохранить
      </button>
      <button className="px-3 py-1.5 text-xs rounded-lg bg-[var(--color-muted)]" onClick={onCancel}>
        Отмена
      </button>
    </div>
  );
}

/* ════════════════════════════════════════════
   TAB 1: Zones
   ════════════════════════════════════════════ */

function ZonesTab({ buildingId, floors }: { buildingId: string; floors: Floor[] }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editZone, setEditZone] = useState<(Zone & { floor_name?: string }) | null>(null);
  const [formData, setFormData] = useState({ floor_id: "", name: "", color: ZONE_PRESET_COLORS[0] });

  // Get rooms for all floors to extract zones
  const { data: allRoomsByFloor, isLoading } = useQuery<{ floor: Floor; rooms: BmsRoom[] }[]>({
    queryKey: ["bms-all-rooms-with-zones", ...floors.map((f) => f.id)],
    queryFn: async () => {
      return Promise.all(
        floors.map(async (floor) => {
          const rooms: BmsRoom[] = await infrastructureApi.getRooms(floor.id);
          return { floor, rooms };
        }),
      );
    },
    enabled: floors.length > 0,
  });

  // Extract unique zones grouped by floor
  const zonesByFloor = new Map<string, { floor: Floor; zones: Zone[] }>();
  if (allRoomsByFloor) {
    for (const { floor, rooms } of allRoomsByFloor) {
      const zonesMap = new Map<string, Zone>();
      for (const room of rooms) {
        if (room.zone) {
          zonesMap.set(room.zone.id, room.zone);
        }
      }
      if (zonesMap.size > 0) {
        zonesByFloor.set(floor.id, { floor, zones: Array.from(zonesMap.values()) });
      }
    }
  }

  const createMutation = useMutation({
    mutationFn: (data: { floor_id: string; name: string; color: string }) =>
      infrastructureApi.createZone(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bms-all-rooms-with-zones"] });
      toast.success("Зона создана");
      setShowForm(false);
      setFormData({ floor_id: "", name: "", color: ZONE_PRESET_COLORS[0] });
    },
    onError: () => toast.error("Не удалось создать зону"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      infrastructureApi.updateZone(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bms-all-rooms-with-zones"] });
      toast.success("Зона обновлена");
      setEditZone(null);
    },
    onError: () => toast.error("Не удалось обновить зону"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => infrastructureApi.deleteZone(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bms-all-rooms-with-zones"] });
      toast.success("Зона удалена");
    },
    onError: () => toast.error("Не удалось удалить зону"),
  });

  const handleCreate = () => {
    if (!formData.name.trim()) { toast.error("Укажите название"); return; }
    if (!formData.floor_id) { toast.error("Выберите этаж"); return; }
    createMutation.mutate(formData);
  };

  return (
    <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold">Зоны</h3>
        <button
          className="bg-secondary text-white rounded-xl px-4 py-2 text-sm font-medium hover:bg-secondary/90 transition-colors"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? "Отмена" : "Добавить зону"}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-[var(--color-muted)] rounded-xl p-4 mb-4 space-y-3">
          <div>
            <label className={labelCls}>Этаж</label>
            <select className={`${inputCls} w-full`} value={formData.floor_id}
              onChange={(e) => setFormData((p) => ({ ...p, floor_id: e.target.value }))}>
              <option value="">Выберите этаж</option>
              {floors.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Название</label>
            <input className={`${inputCls} w-full`} value={formData.name}
              onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))} placeholder="Зона A" />
          </div>
          <div>
            <label className={labelCls}>Цвет</label>
            <div className="flex items-center gap-2">
              {ZONE_PRESET_COLORS.map((c) => (
                <button key={c}
                  className={`w-7 h-7 rounded-full border-2 transition-all ${formData.color === c ? "border-white scale-110 shadow-md" : "border-transparent"}`}
                  style={{ backgroundColor: c }}
                  onClick={() => setFormData((p) => ({ ...p, color: c }))}
                />
              ))}
              <input type="text" className={`${inputCls} w-24`} value={formData.color}
                onChange={(e) => setFormData((p) => ({ ...p, color: e.target.value }))} placeholder="#hex" />
            </div>
          </div>
          <button
            className="bg-secondary text-white rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-50"
            disabled={createMutation.isPending}
            onClick={handleCreate}
          >
            Создать
          </button>
        </div>
      )}

      {/* Zone list grouped by floor */}
      {isLoading ? (
        <div className="animate-pulse bg-[var(--color-muted)] rounded-lg h-32" />
      ) : zonesByFloor.size === 0 ? (
        <p className="text-center text-[var(--color-text-secondary)] py-8">Нет зон</p>
      ) : (
        <div className="space-y-4">
          {Array.from(zonesByFloor.values()).map(({ floor, zones }) => (
            <div key={floor.id}>
              <div className="text-xs font-medium text-[var(--color-text-tertiary)] uppercase mb-2">
                {floor.name}
              </div>
              <div className="divide-y divide-border">
                {zones.map((zone) => (
                  <div key={zone.id} className="flex items-center gap-3 py-2">
                    {editZone?.id === zone.id ? (
                      <ZoneEditRow
                        zone={zone}
                        onCancel={() => setEditZone(null)}
                        onSave={(data) => updateMutation.mutate({ id: zone.id, data })}
                        isPending={updateMutation.isPending}
                      />
                    ) : (
                      <>
                        <span
                          className="w-5 h-5 rounded-full shrink-0 border border-border"
                          style={{ backgroundColor: zone.color }}
                        />
                        <span className="text-sm flex-1">{zone.name}</span>
                        <div className="flex gap-2 shrink-0">
                          <button
                            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                            onClick={() => setEditZone(zone)}
                          >
                            Изменить
                          </button>
                          <button
                            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
                            onClick={() => {
                              if (confirm(`Удалить зону "${zone.name}"?`)) deleteMutation.mutate(zone.id);
                            }}
                            disabled={deleteMutation.isPending}
                          >
                            Удалить
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ZoneEditRow({
  zone,
  onCancel,
  onSave,
  isPending,
}: {
  zone: Zone;
  onCancel: () => void;
  onSave: (data: Record<string, unknown>) => void;
  isPending: boolean;
}) {
  const [data, setData] = useState({ name: zone.name, color: zone.color });

  return (
    <div className="flex items-center gap-2 flex-1 flex-wrap">
      <input className={`${inputCls} flex-1 min-w-[120px]`} value={data.name}
        onChange={(e) => setData((p) => ({ ...p, name: e.target.value }))} />
      <div className="flex items-center gap-1">
        {ZONE_PRESET_COLORS.map((c) => (
          <button key={c}
            className={`w-5 h-5 rounded-full border ${data.color === c ? "border-white scale-110" : "border-transparent"}`}
            style={{ backgroundColor: c }}
            onClick={() => setData((p) => ({ ...p, color: c }))}
          />
        ))}
        <input type="text" className={`${inputCls} w-20`} value={data.color}
          onChange={(e) => setData((p) => ({ ...p, color: e.target.value }))} />
      </div>
      <button
        className="bg-secondary text-white rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-50"
        disabled={isPending}
        onClick={() => onSave(data)}
      >
        Сохранить
      </button>
      <button className="px-3 py-1.5 text-xs rounded-lg bg-[var(--color-muted)]" onClick={onCancel}>
        Отмена
      </button>
    </div>
  );
}

/* ════════════════════════════════════════════
   TAB 2: Rooms
   ════════════════════════════════════════════ */

function RoomsTab({ buildingId, floors }: { buildingId: string; floors: Floor[] }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editRoom, setEditRoom] = useState<BmsRoom | null>(null);
  const [formData, setFormData] = useState({
    floor_id: "", zone_id: "", name: "", room_type: "WARD" as BmsRoomType,
    grid_x: 0, grid_y: 0, grid_w: 1, grid_h: 1,
  });

  const { data: allRoomsByFloor, isLoading } = useQuery<{ floor: Floor; rooms: BmsRoom[] }[]>({
    queryKey: ["bms-all-rooms", ...floors.map((f) => f.id)],
    queryFn: async () =>
      Promise.all(floors.map(async (floor) => ({
        floor,
        rooms: await infrastructureApi.getRooms(floor.id),
      }))),
    enabled: floors.length > 0,
  });

  // Zones for selected floor in form
  const selectedFloorRooms = allRoomsByFloor?.find((d) => d.floor.id === formData.floor_id);
  const zonesForFloor = (() => {
    const map = new Map<string, Zone>();
    if (selectedFloorRooms) {
      for (const room of selectedFloorRooms.rooms) {
        if (room.zone) map.set(room.zone.id, room.zone);
      }
    }
    return Array.from(map.values());
  })();

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => infrastructureApi.createRoom(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bms-all-rooms"] });
      queryClient.invalidateQueries({ queryKey: ["bms-floor-rooms"] });
      toast.success("Помещение создано");
      setShowForm(false);
    },
    onError: () => toast.error("Не удалось создать помещение"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      infrastructureApi.updateRoom(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bms-all-rooms"] });
      queryClient.invalidateQueries({ queryKey: ["bms-floor-rooms"] });
      toast.success("Помещение обновлено");
      setEditRoom(null);
    },
    onError: () => toast.error("Не удалось обновить помещение"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => infrastructureApi.deleteRoom(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bms-all-rooms"] });
      queryClient.invalidateQueries({ queryKey: ["bms-floor-rooms"] });
      toast.success("Помещение удалено");
    },
    onError: () => toast.error("Не удалось удалить помещение"),
  });

  const handleCreate = () => {
    if (!formData.name.trim()) { toast.error("Укажите название"); return; }
    if (!formData.floor_id) { toast.error("Выберите этаж"); return; }
    createMutation.mutate({
      floor_id: formData.floor_id,
      zone_id: formData.zone_id || null,
      name: formData.name,
      room_type: formData.room_type,
      grid_x: formData.grid_x,
      grid_y: formData.grid_y,
      grid_w: formData.grid_w,
      grid_h: formData.grid_h,
    });
  };

  return (
    <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold">Помещения</h3>
        <button
          className="bg-secondary text-white rounded-xl px-4 py-2 text-sm font-medium hover:bg-secondary/90 transition-colors"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? "Отмена" : "Добавить помещение"}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-[var(--color-muted)] rounded-xl p-4 mb-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Этаж</label>
              <select className={`${inputCls} w-full`} value={formData.floor_id}
                onChange={(e) => setFormData((p) => ({ ...p, floor_id: e.target.value, zone_id: "" }))}>
                <option value="">Выберите этаж</option>
                {floors.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Зона (необязательно)</label>
              <select className={`${inputCls} w-full`} value={formData.zone_id}
                onChange={(e) => setFormData((p) => ({ ...p, zone_id: e.target.value }))}
                disabled={!formData.floor_id}>
                <option value="">Без зоны</option>
                {zonesForFloor.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Название</label>
              <input className={`${inputCls} w-full`} value={formData.name}
                onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))} placeholder="Палата 101" />
            </div>
            <div>
              <label className={labelCls}>Тип помещения</label>
              <select className={`${inputCls} w-full`} value={formData.room_type}
                onChange={(e) => setFormData((p) => ({ ...p, room_type: e.target.value as BmsRoomType }))}>
                {ROOM_TYPES.map((t) => <option key={t} value={t}>{ROOM_TYPE_LABELS[t]}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className={labelCls}>X</label>
              <input type="number" className={`${inputCls} w-full`} value={formData.grid_x}
                onChange={(e) => setFormData((p) => ({ ...p, grid_x: Number(e.target.value) }))} />
            </div>
            <div>
              <label className={labelCls}>Y</label>
              <input type="number" className={`${inputCls} w-full`} value={formData.grid_y}
                onChange={(e) => setFormData((p) => ({ ...p, grid_y: Number(e.target.value) }))} />
            </div>
            <div>
              <label className={labelCls}>W</label>
              <input type="number" className={`${inputCls} w-full`} value={formData.grid_w}
                onChange={(e) => setFormData((p) => ({ ...p, grid_w: Number(e.target.value) }))} />
            </div>
            <div>
              <label className={labelCls}>H</label>
              <input type="number" className={`${inputCls} w-full`} value={formData.grid_h}
                onChange={(e) => setFormData((p) => ({ ...p, grid_h: Number(e.target.value) }))} />
            </div>
          </div>
          <button
            className="bg-secondary text-white rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-50"
            disabled={createMutation.isPending}
            onClick={handleCreate}
          >
            Создать
          </button>
        </div>
      )}

      {/* Room list grouped by floor */}
      {isLoading ? (
        <div className="animate-pulse bg-[var(--color-muted)] rounded-lg h-32" />
      ) : !allRoomsByFloor?.some((d) => d.rooms.length > 0) ? (
        <p className="text-center text-[var(--color-text-secondary)] py-8">Нет помещений</p>
      ) : (
        <div className="space-y-4">
          {allRoomsByFloor?.filter((d) => d.rooms.length > 0).map(({ floor, rooms }) => (
            <div key={floor.id}>
              <div className="text-xs font-medium text-[var(--color-text-tertiary)] uppercase mb-2">
                {floor.name}
              </div>
              <div className="divide-y divide-border">
                {rooms.map((room) => (
                  <div key={room.id} className="flex items-center gap-3 py-2">
                    {editRoom?.id === room.id ? (
                      <RoomEditRow
                        room={room}
                        onCancel={() => setEditRoom(null)}
                        onSave={(data) => updateMutation.mutate({ id: room.id, data })}
                        isPending={updateMutation.isPending}
                      />
                    ) : (
                      <>
                        <span className="text-sm font-medium flex-1">{room.name}</span>
                        <Badge variant="muted">{ROOM_TYPE_LABELS[room.room_type]}</Badge>
                        {room.zone && (
                          <span className="text-xs text-[var(--color-text-tertiary)]">{room.zone.name}</span>
                        )}
                        <span className="text-xs text-[var(--color-text-tertiary)]">
                          ({room.grid_x},{room.grid_y}) {room.grid_w}&times;{room.grid_h}
                        </span>
                        <div className="flex gap-2 shrink-0">
                          <button
                            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                            onClick={() => setEditRoom(room)}
                          >
                            Изменить
                          </button>
                          <button
                            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
                            onClick={() => {
                              if (confirm(`Удалить помещение "${room.name}"?`)) deleteMutation.mutate(room.id);
                            }}
                            disabled={deleteMutation.isPending}
                          >
                            Удалить
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RoomEditRow({
  room,
  onCancel,
  onSave,
  isPending,
}: {
  room: BmsRoom;
  onCancel: () => void;
  onSave: (data: Record<string, unknown>) => void;
  isPending: boolean;
}) {
  const [data, setData] = useState({
    name: room.name,
    room_type: room.room_type,
    grid_x: room.grid_x,
    grid_y: room.grid_y,
    grid_w: room.grid_w,
    grid_h: room.grid_h,
  });

  return (
    <div className="flex items-center gap-2 flex-1 flex-wrap">
      <input className={`${inputCls} flex-1 min-w-[100px]`} value={data.name}
        onChange={(e) => setData((p) => ({ ...p, name: e.target.value }))} />
      <select className={`${inputCls} w-28`} value={data.room_type}
        onChange={(e) => setData((p) => ({ ...p, room_type: e.target.value as BmsRoomType }))}>
        {ROOM_TYPES.map((t) => <option key={t} value={t}>{ROOM_TYPE_LABELS[t]}</option>)}
      </select>
      <input type="number" className={`${inputCls} w-14`} value={data.grid_x} placeholder="X"
        onChange={(e) => setData((p) => ({ ...p, grid_x: Number(e.target.value) }))} />
      <input type="number" className={`${inputCls} w-14`} value={data.grid_y} placeholder="Y"
        onChange={(e) => setData((p) => ({ ...p, grid_y: Number(e.target.value) }))} />
      <input type="number" className={`${inputCls} w-14`} value={data.grid_w} placeholder="W"
        onChange={(e) => setData((p) => ({ ...p, grid_w: Number(e.target.value) }))} />
      <input type="number" className={`${inputCls} w-14`} value={data.grid_h} placeholder="H"
        onChange={(e) => setData((p) => ({ ...p, grid_h: Number(e.target.value) }))} />
      <button
        className="bg-secondary text-white rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-50"
        disabled={isPending}
        onClick={() => onSave(data)}
      >
        Сохранить
      </button>
      <button className="px-3 py-1.5 text-xs rounded-lg bg-[var(--color-muted)]" onClick={onCancel}>
        Отмена
      </button>
    </div>
  );
}

/* ════════════════════════════════════════════
   TAB 3: Sensors
   ════════════════════════════════════════════ */

function SensorsTab({ buildingId, floors }: { buildingId: string; floors: Floor[] }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    floor_id: "", bms_room_id: "", sensor_type: "TEMPERATURE" as BmsSensorType, name: "",
  });

  // Load all rooms
  const { data: allRoomsByFloor } = useQuery<{ floor: Floor; rooms: BmsRoom[] }[]>({
    queryKey: ["bms-all-rooms", ...floors.map((f) => f.id)],
    queryFn: async () =>
      Promise.all(floors.map(async (floor) => ({
        floor,
        rooms: await infrastructureApi.getRooms(floor.id),
      }))),
    enabled: floors.length > 0,
  });

  // Load all sensors by floor
  const { data: allSensorsByFloor, isLoading } = useQuery<{ floor: Floor; sensors: BmsSensor[] }[]>({
    queryKey: ["bms-all-sensors", ...floors.map((f) => f.id)],
    queryFn: async () =>
      Promise.all(floors.map(async (floor) => ({
        floor,
        sensors: await infrastructureApi.getFloorSensors(floor.id),
      }))),
    enabled: floors.length > 0,
  });

  // Build room name map
  const roomNameMap = new Map<string, string>();
  if (allRoomsByFloor) {
    for (const { rooms } of allRoomsByFloor) {
      for (const room of rooms) {
        roomNameMap.set(room.id, room.name);
      }
    }
  }

  // Rooms for the form's selected floor
  const formFloorRooms = allRoomsByFloor?.find((d) => d.floor.id === formData.floor_id)?.rooms ?? [];

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => infrastructureApi.createSensor(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bms-all-sensors"] });
      queryClient.invalidateQueries({ queryKey: ["bms-floor-sensors"] });
      toast.success("Датчик создан");
      setShowForm(false);
    },
    onError: () => toast.error("Не удалось создать датчик"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      infrastructureApi.updateSensor(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bms-all-sensors"] });
      queryClient.invalidateQueries({ queryKey: ["bms-floor-sensors"] });
      toast.success("Датчик обновлён");
    },
    onError: () => toast.error("Не удалось обновить датчик"),
  });

  const handleCreate = () => {
    if (!formData.name.trim()) { toast.error("Укажите название"); return; }
    if (!formData.bms_room_id) { toast.error("Выберите помещение"); return; }
    createMutation.mutate({
      bms_room_id: formData.bms_room_id,
      sensor_type: formData.sensor_type,
      name: formData.name,
    });
  };

  // Group sensors by room
  const sensorsByRoom = new Map<string, BmsSensor[]>();
  if (allSensorsByFloor) {
    for (const { sensors } of allSensorsByFloor) {
      for (const sensor of sensors) {
        const list = sensorsByRoom.get(sensor.bms_room_id) ?? [];
        list.push(sensor);
        sensorsByRoom.set(sensor.bms_room_id, list);
      }
    }
  }

  return (
    <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold">Датчики</h3>
        <button
          className="bg-secondary text-white rounded-xl px-4 py-2 text-sm font-medium hover:bg-secondary/90 transition-colors"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? "Отмена" : "Добавить датчик"}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-[var(--color-muted)] rounded-xl p-4 mb-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Этаж</label>
              <select className={`${inputCls} w-full`} value={formData.floor_id}
                onChange={(e) => setFormData((p) => ({ ...p, floor_id: e.target.value, bms_room_id: "" }))}>
                <option value="">Выберите этаж</option>
                {floors.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Помещение</label>
              <select className={`${inputCls} w-full`} value={formData.bms_room_id}
                onChange={(e) => setFormData((p) => ({ ...p, bms_room_id: e.target.value }))}
                disabled={!formData.floor_id}>
                <option value="">Выберите помещение</option>
                {formFloorRooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Тип датчика</label>
              <select className={`${inputCls} w-full`} value={formData.sensor_type}
                onChange={(e) => setFormData((p) => ({ ...p, sensor_type: e.target.value as BmsSensorType }))}>
                {SENSOR_TYPES.map((t) => <option key={t} value={t}>{BMS_SENSOR_META[t].label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Название</label>
              <input className={`${inputCls} w-full`} value={formData.name}
                onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))} placeholder="Датчик температуры 1" />
            </div>
          </div>
          <button
            className="bg-secondary text-white rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-50"
            disabled={createMutation.isPending}
            onClick={handleCreate}
          >
            Создать
          </button>
        </div>
      )}

      {/* Sensor list grouped by room */}
      {isLoading ? (
        <div className="animate-pulse bg-[var(--color-muted)] rounded-lg h-32" />
      ) : sensorsByRoom.size === 0 ? (
        <p className="text-center text-[var(--color-text-secondary)] py-8">Нет датчиков</p>
      ) : (
        <div className="space-y-4">
          {Array.from(sensorsByRoom.entries()).map(([roomId, sensors]) => (
            <div key={roomId}>
              <div className="text-xs font-medium text-[var(--color-text-tertiary)] uppercase mb-2">
                {roomNameMap.get(roomId) ?? "Помещение"}
              </div>
              <div className="divide-y divide-border">
                {sensors.map((sensor) => {
                  const meta = BMS_SENSOR_META[sensor.sensor_type];
                  return (
                    <div key={sensor.id} className="flex items-center gap-3 py-2">
                      <span className="text-sm font-medium flex-1">{sensor.name}</span>
                      <Badge variant="muted">{meta.label}</Badge>
                      {sensor.last_value != null && (
                        <span className="text-xs text-[var(--color-text-secondary)]">
                          {meta.format(sensor.last_value, sensor.last_value_text)} {meta.unit}
                        </span>
                      )}
                      {sensor.last_reading_at && (
                        <span className="text-xs text-[var(--color-text-tertiary)]">
                          {timeAgo(sensor.last_reading_at)}
                        </span>
                      )}
                      {/* Active toggle */}
                      <button
                        className={`relative w-10 h-5 rounded-full transition-colors ${
                          sensor.is_active ? "bg-success" : "bg-[var(--color-muted)]"
                        }`}
                        onClick={() =>
                          updateMutation.mutate({
                            id: sensor.id,
                            data: { is_active: !sensor.is_active },
                          })
                        }
                        disabled={updateMutation.isPending}
                        title={sensor.is_active ? "Деактивировать" : "Активировать"}
                      >
                        <span
                          className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                            sensor.is_active ? "translate-x-5" : "translate-x-0.5"
                          }`}
                        />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════
   TAB 4: Equipment
   ════════════════════════════════════════════ */

function EquipmentTab({ buildingId, floors }: { buildingId: string; floors: Floor[] }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editEquip, setEditEquip] = useState<Equipment | null>(null);
  const [formData, setFormData] = useState({
    floor_id: "", bms_room_id: "", equipment_type: "AC" as EquipmentType, name: "",
    model: "", is_controllable: true,
  });

  // Load all rooms
  const { data: allRoomsByFloor } = useQuery<{ floor: Floor; rooms: BmsRoom[] }[]>({
    queryKey: ["bms-all-rooms", ...floors.map((f) => f.id)],
    queryFn: async () =>
      Promise.all(floors.map(async (floor) => ({
        floor,
        rooms: await infrastructureApi.getRooms(floor.id),
      }))),
    enabled: floors.length > 0,
  });

  // Load all equipment by floor
  const { data: allEquipByFloor, isLoading } = useQuery<{ floor: Floor; equipment: Equipment[] }[]>({
    queryKey: ["bms-all-equipment-settings", ...floors.map((f) => f.id)],
    queryFn: async () =>
      Promise.all(floors.map(async (floor) => ({
        floor,
        equipment: await infrastructureApi.getFloorEquipment(floor.id),
      }))),
    enabled: floors.length > 0,
  });

  const roomNameMap = new Map<string, string>();
  if (allRoomsByFloor) {
    for (const { rooms } of allRoomsByFloor) {
      for (const room of rooms) roomNameMap.set(room.id, room.name);
    }
  }

  const formFloorRooms = allRoomsByFloor?.find((d) => d.floor.id === formData.floor_id)?.rooms ?? [];

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => infrastructureApi.createEquipment(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bms-all-equipment-settings"] });
      queryClient.invalidateQueries({ queryKey: ["bms-all-equipment"] });
      toast.success("Оборудование создано");
      setShowForm(false);
    },
    onError: () => toast.error("Не удалось создать оборудование"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      infrastructureApi.updateEquipment(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bms-all-equipment-settings"] });
      queryClient.invalidateQueries({ queryKey: ["bms-all-equipment"] });
      toast.success("Оборудование обновлено");
      setEditEquip(null);
    },
    onError: () => toast.error("Не удалось обновить оборудование"),
  });

  const handleCreate = () => {
    if (!formData.name.trim()) { toast.error("Укажите название"); return; }
    if (!formData.bms_room_id) { toast.error("Выберите помещение"); return; }
    createMutation.mutate({
      bms_room_id: formData.bms_room_id,
      equipment_type: formData.equipment_type,
      name: formData.name,
      model: formData.model || null,
      is_controllable: formData.is_controllable,
    });
  };

  // Group equipment by room
  const equipByRoom = new Map<string, Equipment[]>();
  if (allEquipByFloor) {
    for (const { equipment } of allEquipByFloor) {
      for (const eq of equipment) {
        const list = equipByRoom.get(eq.bms_room_id) ?? [];
        list.push(eq);
        equipByRoom.set(eq.bms_room_id, list);
      }
    }
  }

  return (
    <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold">Оборудование</h3>
        <button
          className="bg-secondary text-white rounded-xl px-4 py-2 text-sm font-medium hover:bg-secondary/90 transition-colors"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? "Отмена" : "Добавить оборудование"}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-[var(--color-muted)] rounded-xl p-4 mb-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Этаж</label>
              <select className={`${inputCls} w-full`} value={formData.floor_id}
                onChange={(e) => setFormData((p) => ({ ...p, floor_id: e.target.value, bms_room_id: "" }))}>
                <option value="">Выберите этаж</option>
                {floors.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Помещение</label>
              <select className={`${inputCls} w-full`} value={formData.bms_room_id}
                onChange={(e) => setFormData((p) => ({ ...p, bms_room_id: e.target.value }))}
                disabled={!formData.floor_id}>
                <option value="">Выберите помещение</option>
                {formFloorRooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Тип оборудования</label>
              <select className={`${inputCls} w-full`} value={formData.equipment_type}
                onChange={(e) => setFormData((p) => ({ ...p, equipment_type: e.target.value as EquipmentType }))}>
                {EQUIPMENT_TYPES.map((t) => <option key={t} value={t}>{EQUIPMENT_TYPE_LABELS[t]}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Название</label>
              <input className={`${inputCls} w-full`} value={formData.name}
                onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))} placeholder="Кондиционер 1" />
            </div>
            <div>
              <label className={labelCls}>Модель</label>
              <input className={`${inputCls} w-full`} value={formData.model}
                onChange={(e) => setFormData((p) => ({ ...p, model: e.target.value }))} placeholder="Модель (необязательно)" />
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={formData.is_controllable}
                  onChange={(e) => setFormData((p) => ({ ...p, is_controllable: e.target.checked }))}
                  className="w-4 h-4 accent-primary rounded" />
                <span className="text-sm">Управляемое</span>
              </label>
            </div>
          </div>
          <button
            className="bg-secondary text-white rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-50"
            disabled={createMutation.isPending}
            onClick={handleCreate}
          >
            Создать
          </button>
        </div>
      )}

      {/* Equipment list grouped by room */}
      {isLoading ? (
        <div className="animate-pulse bg-[var(--color-muted)] rounded-lg h-32" />
      ) : equipByRoom.size === 0 ? (
        <p className="text-center text-[var(--color-text-secondary)] py-8">Нет оборудования</p>
      ) : (
        <div className="space-y-4">
          {Array.from(equipByRoom.entries()).map(([roomId, equipment]) => (
            <div key={roomId}>
              <div className="text-xs font-medium text-[var(--color-text-tertiary)] uppercase mb-2">
                {roomNameMap.get(roomId) ?? "Помещение"}
              </div>
              <div className="divide-y divide-border">
                {equipment.map((eq) => {
                  const statusMeta = EQUIPMENT_STATUS_META[eq.status];
                  return (
                    <div key={eq.id} className="flex items-center gap-3 py-2">
                      {editEquip?.id === eq.id ? (
                        <EquipmentEditRow
                          equipment={eq}
                          onCancel={() => setEditEquip(null)}
                          onSave={(data) => updateMutation.mutate({ id: eq.id, data })}
                          isPending={updateMutation.isPending}
                        />
                      ) : (
                        <>
                          <span className="text-sm font-medium flex-1">{eq.name}</span>
                          <Badge variant="muted">{EQUIPMENT_TYPE_LABELS[eq.equipment_type]}</Badge>
                          {eq.model && (
                            <span className="text-xs text-[var(--color-text-tertiary)]">{eq.model}</span>
                          )}
                          <Badge variant={STATUS_BADGE_VARIANT[eq.status]}>
                            {statusMeta.label}
                          </Badge>
                          {/* Controllable toggle */}
                          <button
                            className={`relative w-10 h-5 rounded-full transition-colors ${
                              eq.is_controllable ? "bg-success" : "bg-[var(--color-muted)]"
                            }`}
                            onClick={() =>
                              updateMutation.mutate({
                                id: eq.id,
                                data: { is_controllable: !eq.is_controllable },
                              })
                            }
                            disabled={updateMutation.isPending}
                            title={eq.is_controllable ? "Отключить управление" : "Включить управление"}
                          >
                            <span
                              className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                                eq.is_controllable ? "translate-x-5" : "translate-x-0.5"
                              }`}
                            />
                          </button>
                          <div className="flex gap-2 shrink-0">
                            <button
                              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                              onClick={() => setEditEquip(eq)}
                            >
                              Изменить
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EquipmentEditRow({
  equipment,
  onCancel,
  onSave,
  isPending,
}: {
  equipment: Equipment;
  onCancel: () => void;
  onSave: (data: Record<string, unknown>) => void;
  isPending: boolean;
}) {
  const [data, setData] = useState({
    name: equipment.name,
    model: equipment.model ?? "",
    equipment_type: equipment.equipment_type,
    is_controllable: equipment.is_controllable,
  });

  return (
    <div className="flex items-center gap-2 flex-1 flex-wrap">
      <input className={`${inputCls} flex-1 min-w-[100px]`} value={data.name}
        onChange={(e) => setData((p) => ({ ...p, name: e.target.value }))} />
      <select className={`${inputCls} w-32`} value={data.equipment_type}
        onChange={(e) => setData((p) => ({ ...p, equipment_type: e.target.value as EquipmentType }))}>
        {EQUIPMENT_TYPES.map((t) => <option key={t} value={t}>{EQUIPMENT_TYPE_LABELS[t]}</option>)}
      </select>
      <input className={`${inputCls} w-28`} value={data.model} placeholder="Модель"
        onChange={(e) => setData((p) => ({ ...p, model: e.target.value }))} />
      <label className="flex items-center gap-1 text-xs cursor-pointer">
        <input type="checkbox" checked={data.is_controllable}
          onChange={(e) => setData((p) => ({ ...p, is_controllable: e.target.checked }))}
          className="w-3.5 h-3.5 accent-primary" />
        Управл.
      </label>
      <button
        className="bg-secondary text-white rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-50"
        disabled={isPending}
        onClick={() => onSave({ ...data, model: data.model || null })}
      >
        Сохранить
      </button>
      <button className="px-3 py-1.5 text-xs rounded-lg bg-[var(--color-muted)]" onClick={onCancel}>
        Отмена
      </button>
    </div>
  );
}

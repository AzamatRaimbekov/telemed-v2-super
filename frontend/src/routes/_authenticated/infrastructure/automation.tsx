import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { infrastructureApi } from "@/features/infrastructure/api";
import {
  BMS_SENSOR_META,
  EQUIPMENT_TYPE_LABELS,
} from "@/features/infrastructure/thresholds";
import { Badge } from "@/components/ui/badge";
import type {
  AutomationRule,
  AutomationLog,
  Building,
  Floor,
  BmsRoom,
  BmsSensorType,
  ConditionOperator,
  EquipmentType,
  EquipmentCommandType,
} from "@/features/infrastructure/types";

export const Route = createFileRoute("/_authenticated/infrastructure/automation")({
  component: AutomationPage,
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

const OPERATOR_SYMBOLS: Record<ConditionOperator, string> = {
  GT: ">",
  LT: "<",
  EQ: "=",
  GTE: "\u2265",
  LTE: "\u2264",
};

const OPERATOR_OPTIONS: ConditionOperator[] = ["GT", "LT", "EQ", "GTE", "LTE"];

const COMMAND_LABELS: Record<string, string> = {
  TURN_ON: "Включить",
  TURN_OFF: "Выключить",
  SET_PARAMETER: "Установить параметр",
  RESTART: "Перезапуск",
};

const COMMAND_OPTIONS: EquipmentCommandType[] = ["TURN_ON", "TURN_OFF", "SET_PARAMETER", "RESTART"];

const SENSOR_TYPES: BmsSensorType[] = [
  "TEMPERATURE", "HUMIDITY", "CO2", "LIGHT", "SMOKE",
  "WATER_LEAK", "MOTION", "DOOR_SENSOR", "POWER_METER", "PIPE_TEMPERATURE",
];

const EQUIPMENT_TYPES: EquipmentType[] = [
  "AC", "HEATER", "LIGHT", "VENTILATION", "DOOR_LOCK",
  "ELEVATOR", "PUMP", "GENERATOR", "UPS", "OTHER",
];

const SCHEDULE_PRESETS = [
  { label: "Всегда", cron: null, description: "Всегда активно" },
  { label: "Рабочие дни 8-20", cron: "0 8-20 * * 1-5", description: "Рабочие дни с 8:00 до 20:00" },
  { label: "Ночь 22-6", cron: "0 22-6 * * *", description: "Ночное время с 22:00 до 6:00" },
];

/* ── types for form ── */

type RuleFormData = {
  name: string;
  description: string;
  condition_sensor_type: BmsSensorType;
  condition_operator: ConditionOperator;
  condition_value: number;
  condition_floor_id: string;
  condition_room_id: string;
  action_equipment_type: EquipmentType;
  action_command: EquipmentCommandType;
  action_parameters: string;
  schedule_preset: number;
  schedule_cron: string;
  schedule_description: string;
};

const EMPTY_FORM: RuleFormData = {
  name: "",
  description: "",
  condition_sensor_type: "TEMPERATURE",
  condition_operator: "GT",
  condition_value: 26,
  condition_floor_id: "",
  condition_room_id: "",
  action_equipment_type: "AC",
  action_command: "TURN_ON",
  action_parameters: "{}",
  schedule_preset: 0,
  schedule_cron: "",
  schedule_description: "Всегда активно",
};

/* ── main component ── */

function AutomationPage() {
  const queryClient = useQueryClient();
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  // Data queries
  const { data: rules, isLoading: rulesLoading } = useQuery<AutomationRule[]>({
    queryKey: ["bms-rules"],
    queryFn: infrastructureApi.getRules,
  });

  const { data: buildings } = useQuery<Building[]>({
    queryKey: ["bms-buildings"],
    queryFn: infrastructureApi.getBuildings,
  });

  const buildingId = buildings?.[0]?.id ?? "";

  const { data: floors } = useQuery<Floor[]>({
    queryKey: ["bms-floors", buildingId],
    queryFn: () => infrastructureApi.getFloors(buildingId),
    enabled: !!buildingId,
  });

  // Mutations
  const toggleRuleMutation = useMutation({
    mutationFn: (ruleId: string) => infrastructureApi.toggleRule(ruleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bms-rules"] });
      toast.success("Правило обновлено");
    },
    onError: () => toast.error("Не удалось обновить правило"),
  });

  const deleteRuleMutation = useMutation({
    mutationFn: (ruleId: string) => infrastructureApi.deleteRule(ruleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bms-rules"] });
      toast.success("Правило удалено");
    },
    onError: () => toast.error("Не удалось удалить правило"),
  });

  const createRuleMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => infrastructureApi.createRule(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bms-rules"] });
      toast.success("Правило создано");
      setModalMode(null);
    },
    onError: () => toast.error("Не удалось создать правило"),
  });

  const updateRuleMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      infrastructureApi.updateRule(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bms-rules"] });
      toast.success("Правило обновлено");
      setModalMode(null);
      setEditingRule(null);
    },
    onError: () => toast.error("Не удалось обновить правило"),
  });

  const handleOpenCreate = () => {
    setEditingRule(null);
    setModalMode("create");
  };

  const handleOpenEdit = (rule: AutomationRule) => {
    setEditingRule(rule);
    setModalMode("edit");
  };

  const handleDelete = (rule: AutomationRule) => {
    if (confirm(`Удалить правило "${rule.name}"?`)) {
      deleteRuleMutation.mutate(rule.id);
    }
  };

  return (
    <div className="space-y-8 pb-8">
      {/* ── Header ── */}
      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">
            Правила автоматизации
          </h2>
          <button
            className="bg-secondary text-white rounded-xl px-4 py-2 text-sm font-medium hover:bg-secondary/90 transition-colors"
            onClick={handleOpenCreate}
          >
            Добавить правило
          </button>
        </div>
      </section>

      {/* ── Rules List ── */}
      <section>
        {rulesLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="animate-pulse bg-[var(--color-muted)] rounded-2xl h-24" />
            ))}
          </div>
        ) : !rules?.length ? (
          <p className="text-center text-[var(--color-text-secondary)] py-8">
            Нет правил автоматизации
          </p>
        ) : (
          <div className="space-y-3">
            {rules.map((rule) => {
              const sensorMeta = BMS_SENSOR_META[rule.condition_sensor_type];
              const operatorSymbol = OPERATOR_SYMBOLS[rule.condition_operator];
              const commandLabel = COMMAND_LABELS[rule.action_command] ?? rule.action_command;
              const equipLabel = rule.action_equipment_type
                ? EQUIPMENT_TYPE_LABELS[rule.action_equipment_type]
                : "";
              const isLogExpanded = expandedLog === rule.id;

              // Determine scope label
              let scopeLabel = "во всём здании";
              const matchFloor = floors?.find((f) => f.id === rule.condition_floor_id);
              if (rule.condition_room_id) {
                scopeLabel = `в помещении`;
              } else if (matchFloor) {
                scopeLabel = `на ${matchFloor.name}`;
              }

              return (
                <div key={rule.id}>
                  <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-5">
                    <div className="flex items-start gap-4">
                      <div className="flex-1 min-w-0">
                        {/* Name + description */}
                        <div className="font-semibold text-sm">{rule.name}</div>
                        {rule.description && (
                          <div className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                            {rule.description}
                          </div>
                        )}

                        {/* Condition */}
                        <div className="text-xs text-[var(--color-text-secondary)] mt-2">
                          Если {sensorMeta?.label ?? rule.condition_sensor_type}{" "}
                          {operatorSymbol} {rule.condition_value}
                          {sensorMeta?.unit ? ` ${sensorMeta.unit}` : ""}
                        </div>

                        {/* Scope */}
                        <div className="text-xs text-[var(--color-text-tertiary)] mt-0.5">
                          Область: {scopeLabel}
                        </div>

                        {/* Action */}
                        <div className="text-xs text-[var(--color-text-tertiary)] mt-0.5">
                          Действие: {commandLabel}
                          {equipLabel ? ` ${equipLabel}` : ""}
                          {rule.action_parameters && Object.keys(rule.action_parameters).length > 0
                            ? ` (${JSON.stringify(rule.action_parameters)})`
                            : ""}
                        </div>

                        {/* Schedule */}
                        <div className="text-xs text-[var(--color-text-tertiary)] mt-0.5">
                          Расписание: {rule.schedule_description ?? "Всегда активно"}
                        </div>

                        {/* Stats */}
                        <div className="flex items-center gap-2 mt-2">
                          {rule.trigger_count > 0 && (
                            <Badge variant="muted">{rule.trigger_count} срабатываний</Badge>
                          )}
                          {rule.last_triggered_at && (
                            <span className="text-xs text-[var(--color-text-tertiary)]">
                              Последнее: {timeAgo(rule.last_triggered_at)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Right controls */}
                      <div className="flex items-center gap-3 shrink-0">
                        {/* Toggle */}
                        <button
                          className={`relative w-10 h-5 rounded-full transition-colors ${
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

                        {/* Edit */}
                        <button
                          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                          onClick={() => handleOpenEdit(rule)}
                        >
                          Изменить
                        </button>

                        {/* Delete */}
                        <button
                          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
                          onClick={() => handleDelete(rule)}
                          disabled={deleteRuleMutation.isPending}
                        >
                          Удалить
                        </button>
                      </div>
                    </div>

                    {/* Trigger log toggle */}
                    <button
                      className="mt-3 text-xs text-primary hover:underline"
                      onClick={() => setExpandedLog(isLogExpanded ? null : rule.id)}
                    >
                      {isLogExpanded ? "Скрыть журнал срабатываний" : "Журнал срабатываний"}
                    </button>
                  </div>

                  {/* Trigger Log */}
                  {isLogExpanded && <TriggerLog ruleId={rule.id} />}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Create/Edit Modal ── */}
      {modalMode && (
        <RuleModal
          mode={modalMode}
          rule={editingRule}
          floors={floors ?? []}
          buildingId={buildingId}
          onClose={() => {
            setModalMode(null);
            setEditingRule(null);
          }}
          onSave={(data) => {
            if (modalMode === "edit" && editingRule) {
              updateRuleMutation.mutate({ id: editingRule.id, data });
            } else {
              createRuleMutation.mutate(data);
            }
          }}
          isPending={createRuleMutation.isPending || updateRuleMutation.isPending}
        />
      )}
    </div>
  );
}

/* ── Trigger Log Component ── */

function TriggerLog({ ruleId }: { ruleId: string }) {
  const { data: logs, isLoading } = useQuery<AutomationLog[]>({
    queryKey: ["bms-rule-logs", ruleId],
    queryFn: () => infrastructureApi.getRuleLogs(ruleId),
  });

  if (isLoading) {
    return (
      <div className="mt-1 bg-[var(--color-surface)] rounded-b-2xl border border-t-0 border-border p-4">
        <div className="animate-pulse bg-[var(--color-muted)] rounded-lg h-16" />
      </div>
    );
  }

  if (!logs?.length) {
    return (
      <div className="mt-1 bg-[var(--color-surface)] rounded-b-2xl border border-t-0 border-border p-4">
        <p className="text-xs text-[var(--color-text-tertiary)] text-center py-2">
          Нет записей в журнале
        </p>
      </div>
    );
  }

  return (
    <div className="mt-1 bg-[var(--color-surface)] rounded-b-2xl border border-t-0 border-border p-4">
      <div className="divide-y divide-border">
        {logs.map((log) => (
          <div key={log.id} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
            <span className="text-xs text-[var(--color-text-tertiary)] min-w-[120px]">
              {formatDateTime(log.triggered_at)}
            </span>
            {log.sensor_value != null && (
              <span className="text-xs text-[var(--color-text-secondary)]">
                Значение: {log.sensor_value}
              </span>
            )}
            <span className="text-xs text-[var(--color-text-secondary)] flex-1">
              {log.action_taken}
            </span>
            <Badge variant={log.success ? "success" : "destructive"}>
              {log.success ? "Успешно" : "Ошибка"}
            </Badge>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Rule Modal ── */

function RuleModal({
  mode,
  rule,
  floors,
  buildingId,
  onClose,
  onSave,
  isPending,
}: {
  mode: "create" | "edit";
  rule: AutomationRule | null;
  floors: Floor[];
  buildingId: string;
  onClose: () => void;
  onSave: (data: Record<string, unknown>) => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState<RuleFormData>(() => {
    if (rule) {
      const presetIdx = SCHEDULE_PRESETS.findIndex((p) => p.cron === rule.schedule_cron);
      return {
        name: rule.name,
        description: rule.description ?? "",
        condition_sensor_type: rule.condition_sensor_type,
        condition_operator: rule.condition_operator,
        condition_value: rule.condition_value,
        condition_floor_id: rule.condition_floor_id ?? "",
        condition_room_id: rule.condition_room_id ?? "",
        action_equipment_type: (rule.action_equipment_type ?? "AC") as EquipmentType,
        action_command: (rule.action_command ?? "TURN_ON") as EquipmentCommandType,
        action_parameters: rule.action_parameters ? JSON.stringify(rule.action_parameters) : "{}",
        schedule_preset: presetIdx >= 0 ? presetIdx : -1,
        schedule_cron: rule.schedule_cron ?? "",
        schedule_description: rule.schedule_description ?? "Всегда активно",
      };
    }
    return { ...EMPTY_FORM };
  });

  // Load rooms for selected floor
  const { data: rooms } = useQuery<BmsRoom[]>({
    queryKey: ["bms-floor-rooms", form.condition_floor_id],
    queryFn: () => infrastructureApi.getRooms(form.condition_floor_id),
    enabled: !!form.condition_floor_id,
  });

  const update = (patch: Partial<RuleFormData>) => setForm((prev) => ({ ...prev, ...patch }));

  const handleSchedulePreset = (idx: number) => {
    const preset = SCHEDULE_PRESETS[idx];
    update({
      schedule_preset: idx,
      schedule_cron: preset.cron ?? "",
      schedule_description: preset.description,
    });
  };

  const handleSubmit = () => {
    if (!form.name.trim()) {
      toast.error("Укажите название правила");
      return;
    }

    let actionParams: Record<string, unknown> | null = null;
    if (form.action_parameters && form.action_parameters !== "{}") {
      try {
        actionParams = JSON.parse(form.action_parameters);
      } catch {
        toast.error("Некорректный JSON параметров действия");
        return;
      }
    }

    onSave({
      name: form.name.trim(),
      description: form.description.trim() || null,
      condition_sensor_type: form.condition_sensor_type,
      condition_operator: form.condition_operator,
      condition_value: form.condition_value,
      condition_floor_id: form.condition_floor_id || null,
      condition_room_id: form.condition_room_id || null,
      action_equipment_type: form.action_equipment_type,
      action_command: form.action_command,
      action_parameters: actionParams,
      schedule_cron: form.schedule_cron || null,
      schedule_description: form.schedule_description || null,
    });
  };

  const inputCls = "w-full bg-[var(--color-muted)] rounded-lg px-3 py-2 text-sm";
  const labelCls = "text-xs font-medium text-[var(--color-text-secondary)] mb-1 block";

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm overflow-y-auto p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-6 w-full max-w-lg shadow-xl my-8">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-sm">
            {mode === "create" ? "Новое правило" : "Редактирование правила"}
          </h3>
          <button
            className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] text-lg"
            onClick={onClose}
          >
            &times;
          </button>
        </div>

        <div className="space-y-4">
          {/* Name */}
          <div>
            <label className={labelCls}>Название</label>
            <input
              className={inputCls}
              value={form.name}
              onChange={(e) => update({ name: e.target.value })}
              placeholder="Название правила"
            />
          </div>

          {/* Description */}
          <div>
            <label className={labelCls}>Описание (необязательно)</label>
            <textarea
              className={`${inputCls} min-h-[60px] resize-y`}
              value={form.description}
              onChange={(e) => update({ description: e.target.value })}
              placeholder="Описание правила"
            />
          </div>

          {/* Condition */}
          <div>
            <label className={labelCls}>Условие</label>
            <div className="flex gap-2">
              <select
                className={`${inputCls} flex-1`}
                value={form.condition_sensor_type}
                onChange={(e) => update({ condition_sensor_type: e.target.value as BmsSensorType })}
              >
                {SENSOR_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {BMS_SENSOR_META[t].label}
                  </option>
                ))}
              </select>
              <select
                className={`${inputCls} w-16`}
                value={form.condition_operator}
                onChange={(e) => update({ condition_operator: e.target.value as ConditionOperator })}
              >
                {OPERATOR_OPTIONS.map((op) => (
                  <option key={op} value={op}>
                    {OPERATOR_SYMBOLS[op]}
                  </option>
                ))}
              </select>
              <input
                type="number"
                className={`${inputCls} w-24`}
                value={form.condition_value}
                onChange={(e) => update({ condition_value: Number(e.target.value) })}
              />
            </div>
          </div>

          {/* Scope */}
          <div>
            <label className={labelCls}>Область</label>
            <div className="flex gap-2">
              <select
                className={`${inputCls} flex-1`}
                value={form.condition_floor_id}
                onChange={(e) => update({ condition_floor_id: e.target.value, condition_room_id: "" })}
              >
                <option value="">Все этажи</option>
                {floors.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
              <select
                className={`${inputCls} flex-1`}
                value={form.condition_room_id}
                onChange={(e) => update({ condition_room_id: e.target.value })}
                disabled={!form.condition_floor_id}
              >
                <option value="">Все помещения</option>
                {rooms?.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Action */}
          <div>
            <label className={labelCls}>Действие</label>
            <div className="flex gap-2">
              <select
                className={`${inputCls} flex-1`}
                value={form.action_equipment_type}
                onChange={(e) => update({ action_equipment_type: e.target.value as EquipmentType })}
              >
                {EQUIPMENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {EQUIPMENT_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
              <select
                className={`${inputCls} flex-1`}
                value={form.action_command}
                onChange={(e) => update({ action_command: e.target.value as EquipmentCommandType })}
              >
                {COMMAND_OPTIONS.map((cmd) => (
                  <option key={cmd} value={cmd}>
                    {COMMAND_LABELS[cmd]}
                  </option>
                ))}
              </select>
            </div>
            {form.action_command === "SET_PARAMETER" && (
              <div className="mt-2">
                <label className={labelCls}>Параметры (JSON)</label>
                <input
                  className={inputCls}
                  value={form.action_parameters}
                  onChange={(e) => update({ action_parameters: e.target.value })}
                  placeholder='{"temperature": 22}'
                />
              </div>
            )}
          </div>

          {/* Schedule */}
          <div>
            <label className={labelCls}>Расписание</label>
            <div className="flex gap-2 flex-wrap mb-2">
              {SCHEDULE_PRESETS.map((preset, idx) => (
                <button
                  key={idx}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    form.schedule_preset === idx
                      ? "bg-primary/10 text-primary"
                      : "bg-[var(--color-muted)] text-[var(--color-text-secondary)] hover:bg-[var(--color-muted)]/80"
                  }`}
                  onClick={() => handleSchedulePreset(idx)}
                >
                  {preset.label}
                </button>
              ))}
              <button
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  form.schedule_preset === -1
                    ? "bg-primary/10 text-primary"
                    : "bg-[var(--color-muted)] text-[var(--color-text-secondary)] hover:bg-[var(--color-muted)]/80"
                }`}
                onClick={() => update({ schedule_preset: -1 })}
              >
                Свой cron
              </button>
            </div>
            {form.schedule_preset === -1 && (
              <div className="space-y-2">
                <input
                  className={inputCls}
                  value={form.schedule_cron}
                  onChange={(e) => update({ schedule_cron: e.target.value })}
                  placeholder="Cron выражение (например: 0 8-20 * * 1-5)"
                />
                <input
                  className={inputCls}
                  value={form.schedule_description}
                  onChange={(e) => update({ schedule_description: e.target.value })}
                  placeholder="Описание расписания"
                />
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 mt-6">
          <button
            className="px-4 py-2 text-sm rounded-xl bg-[var(--color-muted)] hover:bg-[var(--color-muted)]/80 transition-colors"
            onClick={onClose}
          >
            Отмена
          </button>
          <button
            className="bg-secondary text-white rounded-xl px-4 py-2 text-sm font-medium hover:bg-secondary/90 transition-colors disabled:opacity-50"
            disabled={isPending}
            onClick={handleSubmit}
          >
            {mode === "create" ? "Создать" : "Сохранить"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

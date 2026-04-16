import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { patientsApi } from "@/features/patients/api";
import { formatDateTime } from "@/lib/utils";
import { toast } from "sonner";
import { CustomSelect } from "@/components/ui/select-custom";
import { InputField } from "@/components/ui/input-field";
import { TextareaField } from "@/components/ui/textarea-field";
import { Button } from "@/components/ui/button";

type RoomsSearch = {
  show_all_hospitalizations?: boolean;
};

export const Route = createFileRoute(
  "/_authenticated/patients/$patientId/rooms"
)({
  validateSearch: (search: Record<string, unknown>): RoomsSearch => ({
    show_all_hospitalizations:
      search.show_all_hospitalizations === true ||
      search.show_all_hospitalizations === "true",
  }),
  component: RoomsPage,
});

interface RoomAssignment {
  id: string;
  room_name?: string;
  room_number?: string;
  bed_number?: string;
  department_name?: string;
  assigned_at: string;
  discharged_at?: string | null;
  transfer_reason?: string;
  condition_on_transfer?: string;
  placement_type?: string;
  capacity?: number;
  occupied?: number;
}

interface CurrentRoom extends RoomAssignment {
  is_current: true;
}

function RoomsPage() {
  const { patientId } = Route.useParams();
  const { show_all_hospitalizations } = Route.useSearch();
  const queryClient = useQueryClient();
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [elapsed, setElapsed] = useState("");

  const { data: currentRoom, isLoading: currentLoading } = useQuery<CurrentRoom>({
    queryKey: ["patient-current-room", patientId],
    queryFn: () => patientsApi.getCurrentRoom(patientId),
  });

  const { data: roomHistory, isLoading: historyLoading } = useQuery({
    queryKey: ["patient-room-history", patientId, show_all_hospitalizations],
    queryFn: () => patientsApi.getRoomHistory(patientId, show_all_hospitalizations),
  });

  // Live elapsed counter
  useEffect(() => {
    if (!currentRoom?.assigned_at) return;
    const update = () => {
      const diff = Date.now() - new Date(currentRoom.assigned_at).getTime();
      const days = Math.floor(diff / 86400000);
      const hours = Math.floor((diff % 86400000) / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      if (days > 0) setElapsed(`${days} д ${hours} ч`);
      else if (hours > 0) setElapsed(`${hours} ч ${mins} мин`);
      else setElapsed(`${mins} мин`);
    };
    update();
    const id = setInterval(update, 60000);
    return () => clearInterval(id);
  }, [currentRoom?.assigned_at]);

  const transferMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      patientsApi.transferRoom(patientId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patient-current-room", patientId] });
      queryClient.invalidateQueries({ queryKey: ["patient-room-history", patientId] });
      setShowTransferModal(false);
      toast.success("Перевод выполнен");
    },
    onError: () => toast.error("Не удалось выполнить перевод"),
  });

  const assignments =
    (roomHistory as Array<RoomAssignment> | undefined) ?? [];

  const conditionLabels: Record<string, string> = {
    stable: "Стабильное",
    improved: "Улучшение",
    deteriorated: "Ухудшение",
    critical: "Критическое",
  };
  const conditionColors: Record<string, string> = {
    stable: "bg-success/10 text-success",
    improved: "bg-primary/10 text-[var(--color-primary-deep)]",
    deteriorated: "bg-warning/10 text-warning",
    critical: "bg-destructive/10 text-destructive",
  };

  return (
    <div className="space-y-4">
      {/* Current location */}
      {currentLoading ? (
        <div className="h-32 bg-[var(--color-muted)] rounded-2xl animate-pulse" />
      ) : currentRoom ? (
        <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h3 className="text-sm font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-2">
                Текущее местонахождение
              </h3>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                <p className="text-[22px] font-bold text-foreground">
                  {currentRoom.room_name ||
                    `Палата ${currentRoom.room_number || "—"}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowTransferModal(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-secondary/10 text-secondary text-sm font-medium hover:bg-secondary/20 transition-colors"
              >
                <svg
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="m15 18 6-6-6-6" />
                  <path d="M9 18l-6-6 6-6" />
                </svg>
                Перевести
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Отделение", value: currentRoom.department_name || "—" },
              { label: "Кровать", value: currentRoom.bed_number || "—" },
              {
                label: "В палате",
                value: elapsed || "—",
                sub: currentRoom.assigned_at
                  ? `с ${formatDateTime(currentRoom.assigned_at)}`
                  : undefined,
              },
              currentRoom.capacity
                ? {
                    label: "Заполненность",
                    value: `${currentRoom.occupied ?? "?"} / ${currentRoom.capacity}`,
                    sub: "коек занято",
                  }
                : null,
            ]
              .filter(Boolean)
              .map((item) => (
                <div key={item!.label} className="bg-[var(--color-muted)] rounded-xl p-3">
                  <p className="text-xs text-[var(--color-text-tertiary)] mb-1">
                    {item!.label}
                  </p>
                  <p className="text-sm font-semibold text-foreground">
                    {item!.value}
                  </p>
                  {item!.sub && (
                    <p className="text-[10px] text-[var(--color-text-tertiary)] mt-0.5">
                      {item!.sub}
                    </p>
                  )}
                </div>
              ))}
          </div>
        </div>
      ) : (
        <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-8 text-center">
          <p className="text-[var(--color-text-secondary)]">
            Пациент не размещён в палате
          </p>
        </div>
      )}

      {/* History */}
      <div className="bg-[var(--color-surface)] rounded-2xl border border-border overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="text-sm font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">
            История размещения
          </h3>
        </div>

        {historyLoading ? (
          <div className="p-4 space-y-3 animate-pulse">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 bg-[var(--color-muted)] rounded-xl" />
            ))}
          </div>
        ) : assignments.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-[var(--color-text-secondary)]">
              История перемещений не найдена
            </p>
          </div>
        ) : (
          <div className="relative pl-10 pr-4 py-4">
            <div className="absolute left-7 top-0 bottom-0 w-px bg-border" />
            <div className="space-y-4">
              {assignments.map((a, i) => {
                const isCurrent = !a.discharged_at;
                const condition = a.condition_on_transfer;
                return (
                  <div key={a.id || i} className="relative">
                    <div
                      className={`absolute -left-[13px] top-3 w-3 h-3 rounded-full border-2 border-background ${
                        isCurrent ? "bg-success" : "bg-[var(--color-text-tertiary)]"
                      }`}
                    />
                    <div
                      className={`rounded-xl border p-3 ${
                        isCurrent
                          ? "border-success/30 bg-success/5"
                          : "border-border"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold text-foreground">
                              {a.room_name ||
                                `Палата ${a.room_number || "—"}`}
                              {a.bed_number && `, кровать ${a.bed_number}`}
                            </p>
                            {isCurrent && (
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-success/10 text-success">
                                Сейчас
                              </span>
                            )}
                            {condition && (
                              <span
                                className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                  conditionColors[condition] ||
                                  "bg-[var(--color-muted)] text-[var(--color-text-secondary)]"
                                }`}
                              >
                                {conditionLabels[condition] || condition}
                              </span>
                            )}
                          </div>
                          {a.department_name && (
                            <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">
                              {a.department_name}
                            </p>
                          )}
                          {a.transfer_reason && (
                            <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                              {a.transfer_reason}
                            </p>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-xs font-mono text-[var(--color-text-tertiary)]">
                            {formatDateTime(a.assigned_at)}
                          </p>
                          {a.discharged_at && (
                            <p className="text-xs font-mono text-[var(--color-text-tertiary)] mt-0.5">
                              → {formatDateTime(a.discharged_at)}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Transfer modal */}
      {showTransferModal && (
        <TransferModal
          patientId={patientId}
          onClose={() => setShowTransferModal(false)}
          onConfirm={(data) => transferMutation.mutate(data)}
          isPending={transferMutation.isPending}
        />
      )}
    </div>
  );
}

// ─── Transfer Modal ───────────────────────────────────────────────────────────

function TransferModal({
  patientId,
  onClose,
  onConfirm,
  isPending,
}: {
  patientId: string;
  onClose: () => void;
  onConfirm: (data: Record<string, unknown>) => void;
  isPending: boolean;
}) {
  const [departmentId, setDepartmentId] = useState("");
  const [roomId, setRoomId] = useState("");
  const [bedId, setBedId] = useState("");
  const [transferReason, setTransferReason] = useState("");
  const [conditionOnTransfer, setConditionOnTransfer] = useState("stable");
  const [placementType, setPlacementType] = useState("regular");
  const [notes, setNotes] = useState("");

  const { data: departments } = useQuery({
    queryKey: ["departments"],
    queryFn: () => patientsApi.getDepartments(),
  });

  const { data: rooms } = useQuery({
    queryKey: ["rooms", departmentId],
    queryFn: () => patientsApi.getRooms(departmentId),
    enabled: !!departmentId,
  });

  const { data: beds } = useQuery({
    queryKey: ["beds", roomId],
    queryFn: () => patientsApi.getBeds(roomId),
    enabled: !!roomId,
  });

  const departmentList =
    (departments as Array<Record<string, unknown>> | undefined) ?? [];
  const roomList =
    (rooms as Array<Record<string, unknown>> | undefined) ?? [];
  const bedList =
    (beds as Array<Record<string, unknown>> | undefined) ?? [];

  const handleConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bedId) {
      toast.error("Выберите кровать");
      return;
    }
    onConfirm({
      bed_id: bedId,
      room_id: roomId,
      department_id: departmentId,
      transfer_reason: transferReason,
      condition_on_transfer: conditionOnTransfer,
      placement_type: placementType,
      notes: notes || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-[var(--color-surface)] rounded-2xl border border-border shadow-2xl w-full max-w-lg animate-float-up">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h3 className="text-base font-semibold text-foreground">
            Перевод пациента
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--color-text-tertiary)] hover:text-foreground hover:bg-[var(--color-muted)] transition-all"
          >
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="18" x2="6" y1="6" y2="18" />
              <line x1="6" x2="18" y1="6" y2="18" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleConfirm} className="p-5 space-y-4">
          {/* Department */}
          <CustomSelect
            label="Отделение"
            value={departmentId}
            onChange={(val) => {
              setDepartmentId(val);
              setRoomId("");
              setBedId("");
            }}
            placeholder="Выберите отделение"
            options={departmentList.map((d) => ({
              value: d.id as string,
              label: String(d.name || d.title || d.id),
            }))}
          />

          {/* Room */}
          <CustomSelect
            label="Палата"
            value={roomId}
            onChange={(val) => {
              setRoomId(val);
              setBedId("");
            }}
            placeholder="Выберите палату"
            disabled={!departmentId}
            options={roomList.map((r) => ({
              value: r.id as string,
              label:
                String(r.name || r.room_number || r.id) +
                (r.available_beds != null
                  ? ` (${String(r.available_beds)} свободно)`
                  : ""),
            }))}
          />

          {/* Bed */}
          <CustomSelect
            label="Кровать"
            value={bedId}
            onChange={(val) => setBedId(val)}
            placeholder="Выберите кровать"
            disabled={!roomId}
            options={bedList.map((b) => ({
              value: b.id as string,
              label: String(b.bed_number || b.number || b.id),
            }))}
          />

          {/* Placement type + Condition */}
          <div className="grid grid-cols-2 gap-4">
            <CustomSelect
              label="Тип размещения"
              value={placementType}
              onChange={(val) => setPlacementType(val)}
              options={[
                { value: "regular", label: "Плановое" },
                { value: "emergency", label: "Экстренное" },
                { value: "icu", label: "Реанимация" },
                { value: "observation", label: "Наблюдение" },
              ]}
            />
            <CustomSelect
              label="Состояние при переводе"
              value={conditionOnTransfer}
              onChange={(val) => setConditionOnTransfer(val)}
              options={[
                { value: "stable", label: "Стабильное" },
                { value: "improved", label: "Улучшение" },
                { value: "deteriorated", label: "Ухудшение" },
                { value: "critical", label: "Критическое" },
              ]}
            />
          </div>

          {/* Transfer reason */}
          <InputField
            label="Причина перевода"
            type="text"
            value={transferReason}
            onChange={(e) => setTransferReason(e.target.value)}
            placeholder="Укажите причину перевода"
            required
          />

          {/* Notes */}
          <TextareaField
            label="Примечания (необязательно)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
          />

          <div className="flex gap-3 pt-1">
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={onClose}
            >
              Отмена
            </Button>
            <Button
              type="submit"
              variant="primary"
              className="flex-1"
              disabled={isPending}
              loading={isPending}
            >
              {isPending ? "Перевод..." : "Подтвердить перевод"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

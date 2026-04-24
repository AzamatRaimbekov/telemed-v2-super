import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  useDentalChart,
  useAddTreatment,
  useToothHistory,
  useDentalProcedures,
  type ToothTreatment,
  type TreatmentCreateData,
} from "@/features/dental/api";

export const Route = createFileRoute("/_authenticated/dental-chart")({
  component: DentalChartPage,
});

const statusColors: Record<string, { bg: string; border: string; label: string }> = {
  healthy: { bg: "bg-white", border: "border-gray-300", label: "Здоров" },
  caries: { bg: "bg-red-200", border: "border-red-400", label: "Кариес" },
  filled: { bg: "bg-blue-200", border: "border-blue-400", label: "Пломба" },
  crown: { bg: "bg-yellow-300", border: "border-yellow-500", label: "Коронка" },
  implant: { bg: "bg-purple-200", border: "border-purple-400", label: "Имплант" },
  missing: { bg: "bg-gray-300", border: "border-gray-500", label: "Отсутствует" },
  root_canal: { bg: "bg-orange-200", border: "border-orange-400", label: "Канал" },
  bridge: { bg: "bg-amber-200", border: "border-amber-400", label: "Мост" },
  veneer: { bg: "bg-cyan-200", border: "border-cyan-400", label: "Винир" },
  temporary: { bg: "bg-lime-200", border: "border-lime-400", label: "Временная" },
  planned: { bg: "bg-pink-200", border: "border-pink-400", label: "Планируется" },
};

const upperRight = [18, 17, 16, 15, 14, 13, 12, 11];
const upperLeft = [21, 22, 23, 24, 25, 26, 27, 28];
const lowerLeft = [31, 32, 33, 34, 35, 36, 37, 38];
const lowerRight = [48, 47, 46, 45, 44, 43, 42, 41];

function DentalChartPage() {
  const [patientId, setPatientId] = useState("");
  const [selectedTooth, setSelectedTooth] = useState<number | null>(null);
  const [showTreatmentForm, setShowTreatmentForm] = useState(false);

  const { data: chart, isLoading } = useDentalChart(patientId || undefined);
  const { data: history } = useToothHistory(
    patientId || undefined,
    selectedTooth ?? undefined
  );
  const { data: procedures } = useDentalProcedures();
  const addTreatment = useAddTreatment();

  const [form, setForm] = useState<TreatmentCreateData & { toothNumber: number }>({
    procedure_name: "",
    diagnosis: "",
    tooth_status_after: "filled",
    materials_used: "",
    price: undefined,
    notes: "",
    toothNumber: 0,
  });

  const handleAddTreatment = () => {
    if (!patientId || !selectedTooth) return;
    addTreatment.mutate(
      {
        patientId,
        toothNumber: selectedTooth,
        procedure_name: form.procedure_name,
        diagnosis: form.diagnosis || undefined,
        tooth_status_after: form.tooth_status_after || "filled",
        materials_used: form.materials_used || undefined,
        price: form.price,
        notes: form.notes || undefined,
      },
      {
        onSuccess: () => {
          setShowTreatmentForm(false);
          setForm({ procedure_name: "", diagnosis: "", tooth_status_after: "filled", materials_used: "", price: undefined, notes: "", toothNumber: 0 });
        },
      }
    );
  };

  const getToothStatus = (num: number): string => {
    if (!chart?.teeth) return "healthy";
    const t = chart.teeth[String(num)];
    return t?.status || "healthy";
  };

  const renderTooth = (num: number) => {
    const status = getToothStatus(num);
    const cfg = statusColors[status] || statusColors.healthy;
    const isSelected = selectedTooth === num;

    return (
      <button
        key={num}
        onClick={() => setSelectedTooth(num)}
        className={`
          w-10 h-12 rounded-lg border-2 flex flex-col items-center justify-center text-xs font-semibold cursor-pointer transition-all duration-150
          ${cfg.bg} ${cfg.border}
          ${isSelected ? "ring-2 ring-primary ring-offset-1 scale-110 shadow-lg" : "hover:scale-105 hover:shadow-md"}
          ${status === "missing" ? "opacity-50" : ""}
        `}
        title={`${num} - ${cfg.label}`}
      >
        <span className="text-[10px] text-gray-500 leading-none">{num}</span>
        <span className="text-[8px] mt-0.5 leading-none truncate">{cfg.label}</span>
      </button>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Зубная карта</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Интерактивная зубная формула пациента (FDI)
          </p>
        </div>
      </div>

      {/* Patient selector */}
      <div className="bg-[var(--color-surface)] border border-border rounded-2xl p-4">
        <label className="text-sm font-medium text-foreground">ID пациента</label>
        <div className="flex gap-2 mt-1">
          <input
            type="text"
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
            placeholder="Введите UUID пациента..."
            className="flex-1 px-3 py-2 border border-border rounded-xl bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
          {patientId && (
            <Button variant="outline" size="sm" onClick={() => { setPatientId(""); setSelectedTooth(null); }}>
              Очистить
            </Button>
          )}
        </div>
      </div>

      {patientId && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Dental chart diagram */}
          <div className="xl:col-span-2 bg-[var(--color-surface)] border border-border rounded-2xl p-6">
            <h2 className="text-lg font-semibold mb-4">Зубная формула</h2>

            {isLoading ? (
              <div className="flex items-center justify-center h-48 text-muted-foreground">Загрузка...</div>
            ) : (
              <div className="space-y-6">
                {/* Upper arch */}
                <div>
                  <div className="text-xs text-muted-foreground text-center mb-2">Верхняя челюсть</div>
                  <div className="flex justify-center gap-1">
                    <div className="flex gap-1">
                      {upperRight.map(renderTooth)}
                    </div>
                    <div className="w-px bg-border mx-2" />
                    <div className="flex gap-1">
                      {upperLeft.map(renderTooth)}
                    </div>
                  </div>
                </div>

                {/* Divider */}
                <div className="border-t border-dashed border-border" />

                {/* Lower arch */}
                <div>
                  <div className="flex justify-center gap-1">
                    <div className="flex gap-1">
                      {lowerRight.map(renderTooth)}
                    </div>
                    <div className="w-px bg-border mx-2" />
                    <div className="flex gap-1">
                      {lowerLeft.map(renderTooth)}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground text-center mt-2">Нижняя челюсть</div>
                </div>

                {/* Legend */}
                <div className="border-t border-border pt-4">
                  <div className="text-xs font-medium text-muted-foreground mb-2">Обозначения:</div>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(statusColors).map(([key, cfg]) => (
                      <div key={key} className="flex items-center gap-1">
                        <div className={`w-3 h-3 rounded border ${cfg.bg} ${cfg.border}`} />
                        <span className="text-xs text-muted-foreground">{cfg.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Side panel */}
          <div className="space-y-4">
            {/* Selected tooth info */}
            {selectedTooth !== null && (
              <div className="bg-[var(--color-surface)] border border-border rounded-2xl p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">
                    Зуб #{selectedTooth}
                  </h3>
                  <Badge variant={getToothStatus(selectedTooth) === "healthy" ? "success" : "warning"}>
                    {statusColors[getToothStatus(selectedTooth)]?.label || "Неизвестно"}
                  </Badge>
                </div>

                <Button
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    setShowTreatmentForm(!showTreatmentForm);
                    setForm((f) => ({ ...f, toothNumber: selectedTooth }));
                  }}
                >
                  {showTreatmentForm ? "Отмена" : "Добавить лечение"}
                </Button>

                {/* Treatment form */}
                {showTreatmentForm && (
                  <div className="space-y-3 border-t border-border pt-3">
                    <div>
                      <label className="text-xs font-medium">Процедура</label>
                      <select
                        value={form.procedure_name}
                        onChange={(e) => {
                          const proc = procedures?.find((p) => p.name === e.target.value);
                          setForm((f) => ({
                            ...f,
                            procedure_name: e.target.value,
                            price: proc?.base_price,
                          }));
                        }}
                        className="w-full px-2 py-1.5 border border-border rounded-lg bg-background text-sm mt-1"
                      >
                        <option value="">Выберите процедуру...</option>
                        {procedures?.map((p) => (
                          <option key={p.id} value={p.name}>
                            {p.name} ({p.base_price} сом)
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium">Диагноз</label>
                      <input
                        type="text"
                        value={form.diagnosis || ""}
                        onChange={(e) => setForm((f) => ({ ...f, diagnosis: e.target.value }))}
                        className="w-full px-2 py-1.5 border border-border rounded-lg bg-background text-sm mt-1"
                        placeholder="K02.1 Кариес дентина"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium">Статус после лечения</label>
                      <select
                        value={form.tooth_status_after}
                        onChange={(e) => setForm((f) => ({ ...f, tooth_status_after: e.target.value }))}
                        className="w-full px-2 py-1.5 border border-border rounded-lg bg-background text-sm mt-1"
                      >
                        {Object.entries(statusColors).map(([key, cfg]) => (
                          <option key={key} value={key}>{cfg.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium">Материалы</label>
                      <input
                        type="text"
                        value={form.materials_used || ""}
                        onChange={(e) => setForm((f) => ({ ...f, materials_used: e.target.value }))}
                        className="w-full px-2 py-1.5 border border-border rounded-lg bg-background text-sm mt-1"
                        placeholder="Композит Filtek Z250"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs font-medium">Цена (сом)</label>
                        <input
                          type="number"
                          value={form.price ?? ""}
                          onChange={(e) => setForm((f) => ({ ...f, price: e.target.value ? Number(e.target.value) : undefined }))}
                          className="w-full px-2 py-1.5 border border-border rounded-lg bg-background text-sm mt-1"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium">Заметки</label>
                      <textarea
                        value={form.notes || ""}
                        onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                        rows={2}
                        className="w-full px-2 py-1.5 border border-border rounded-lg bg-background text-sm mt-1 resize-none"
                      />
                    </div>
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={handleAddTreatment}
                      disabled={!form.procedure_name || addTreatment.isPending}
                    >
                      {addTreatment.isPending ? "Сохранение..." : "Сохранить лечение"}
                    </Button>
                  </div>
                )}

                {/* Treatment history */}
                <div className="border-t border-border pt-3">
                  <h4 className="text-sm font-semibold mb-2">История лечения</h4>
                  {!history || history.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Нет записей</p>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {history.map((t: ToothTreatment) => (
                        <div
                          key={t.id}
                          className="p-2 bg-[var(--color-muted)] rounded-lg text-xs space-y-1"
                        >
                          <div className="font-medium">{t.procedure_name}</div>
                          {t.diagnosis && (
                            <div className="text-muted-foreground">{t.diagnosis}</div>
                          )}
                          <div className="flex items-center justify-between">
                            <span>
                              {statusColors[t.tooth_status_before || ""]?.label || t.tooth_status_before}
                              {" -> "}
                              {statusColors[t.tooth_status_after]?.label || t.tooth_status_after}
                            </span>
                            {t.price && (
                              <span className="font-semibold">{t.price} сом</span>
                            )}
                          </div>
                          <div className="text-muted-foreground">
                            {new Date(t.created_at).toLocaleDateString("ru-RU")}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {!selectedTooth && patientId && (
              <div className="bg-[var(--color-surface)] border border-border rounded-2xl p-6 text-center text-sm text-muted-foreground">
                Нажмите на зуб для просмотра информации
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

import { useState } from "react";
import { motion } from "framer-motion";
import { Settings, Eye, EyeOff } from "lucide-react";

interface Widget {
  id: string;
  title: string;
  enabled: boolean;
}

const DEFAULT_WIDGETS: Widget[] = [
  { id: "patients", title: "Пациенты", enabled: true },
  { id: "appointments", title: "Приёмы", enabled: true },
  { id: "beds", title: "Палаты", enabled: true },
  { id: "revenue", title: "Доход", enabled: true },
  { id: "lab", title: "Лаборатория", enabled: true },
  { id: "pharmacy", title: "Аптека", enabled: true },
  { id: "tasks", title: "Задачи", enabled: true },
  { id: "infections", title: "Инфекции", enabled: false },
  { id: "queue", title: "Очередь", enabled: false },
  { id: "predictions", title: "Прогнозы", enabled: false },
];

function getWidgets(): Widget[] {
  const saved = localStorage.getItem("dashboard_widgets");
  if (saved) return JSON.parse(saved);
  return DEFAULT_WIDGETS;
}

function saveWidgets(widgets: Widget[]) {
  localStorage.setItem("dashboard_widgets", JSON.stringify(widgets));
}

export function useWidgets() {
  const [widgets, setWidgets] = useState(getWidgets);
  const toggle = (id: string) => {
    const updated = widgets.map((w) => w.id === id ? { ...w, enabled: !w.enabled } : w);
    setWidgets(updated);
    saveWidgets(updated);
  };
  const isEnabled = (id: string) => widgets.find((w) => w.id === id)?.enabled ?? false;
  return { widgets, toggle, isEnabled };
}

export function WidgetConfigurator({ widgets, toggle }: { widgets: Widget[]; toggle: (id: string) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="p-2 rounded-xl text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-muted)] transition-all"
        title="Настроить виджеты"
      >
        <Settings size={18} />
      </button>

      {open && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute right-0 top-full mt-2 w-64 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-xl z-50 overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-[var(--color-border)]">
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">Виджеты дашборда</p>
            <p className="text-xs text-[var(--color-text-tertiary)]">Выберите что показывать</p>
          </div>
          <div className="py-2 max-h-[300px] overflow-y-auto">
            {widgets.map((w) => (
              <button
                key={w.id}
                onClick={() => toggle(w.id)}
                className="w-full flex items-center justify-between px-4 py-2 hover:bg-[var(--color-muted)] transition-colors"
              >
                <span className="text-sm text-[var(--color-text-primary)]">{w.title}</span>
                {w.enabled ? (
                  <Eye size={16} className="text-[var(--color-success)]" />
                ) : (
                  <EyeOff size={16} className="text-[var(--color-text-tertiary)]" />
                )}
              </button>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}

import { useState, useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Users, CalendarDays, FileText, Pill, FlaskConical, Settings, BarChart3, Shield, MessageSquare } from "lucide-react";
import apiClient from "@/lib/api-client";

interface SearchResult {
  type: "page" | "patient" | "action";
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  action: () => void;
}

const pages: Omit<SearchResult, "action">[] = [
  { type: "page", title: "Панель управления", subtitle: "/dashboard", icon: <BarChart3 size={16} /> },
  { type: "page", title: "KPI Дашборд", subtitle: "/chief-dashboard", icon: <BarChart3 size={16} /> },
  { type: "page", title: "Пациенты", subtitle: "/patients", icon: <Users size={16} /> },
  { type: "page", title: "Расписание", subtitle: "/schedule", icon: <CalendarDays size={16} /> },
  { type: "page", title: "Аптека", subtitle: "/pharmacy", icon: <Pill size={16} /> },
  { type: "page", title: "Лаборатория", subtitle: "/laboratory", icon: <FlaskConical size={16} /> },
  { type: "page", title: "Направления", subtitle: "/referrals", icon: <FileText size={16} /> },
  { type: "page", title: "Задачи", subtitle: "/tasks", icon: <FileText size={16} /> },
  { type: "page", title: "Чат", subtitle: "/chat", icon: <MessageSquare size={16} /> },
  { type: "page", title: "Роли и права", subtitle: "/rbac", icon: <Shield size={16} /> },
  { type: "page", title: "Отчёты", subtitle: "/reports", icon: <BarChart3 size={16} /> },
  { type: "page", title: "Настройки", subtitle: "/medicine-settings", icon: <Settings size={16} /> },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [patientResults, setPatientResults] = useState<SearchResult[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // Cmd+K listener
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  // Search patients when query > 2 chars
  useEffect(() => {
    if (query.length < 2) { setPatientResults([]); return; }
    const timeout = setTimeout(async () => {
      try {
        const { data } = await apiClient.get("/patients/", { params: { search: query, limit: 5 } });
        const patients = (data.items || data || []).map((p: any) => ({
          type: "patient" as const,
          title: `${p.last_name} ${p.first_name}`,
          subtitle: p.phone || p.inn || "",
          icon: <Users size={16} />,
          action: () => { navigate({ to: `/patients/${p.id}` }); setOpen(false); },
        }));
        setPatientResults(patients);
      } catch { setPatientResults([]); }
    }, 300);
    return () => clearTimeout(timeout);
  }, [query, navigate]);

  const filteredPages = pages.filter((p) =>
    p.title.toLowerCase().includes(query.toLowerCase()) ||
    (p.subtitle || "").toLowerCase().includes(query.toLowerCase())
  ).map((p) => ({
    ...p,
    action: () => { navigate({ to: p.subtitle as any }); setOpen(false); },
  }));

  const allResults: SearchResult[] = [...filteredPages, ...patientResults];

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIndex((i) => Math.min(i + 1, allResults.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setSelectedIndex((i) => Math.max(i - 1, 0)); }
    if (e.key === "Enter" && allResults[selectedIndex]) { allResults[selectedIndex].action(); }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-sm flex items-start justify-center pt-[20vh]"
        onClick={() => setOpen(false)}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-lg bg-[var(--color-surface)] rounded-2xl shadow-2xl border border-[var(--color-border)] overflow-hidden"
        >
          {/* Search input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border)]">
            <Search size={18} className="text-[var(--color-text-tertiary)]" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
              onKeyDown={handleKeyDown}
              placeholder="Поиск по системе..."
              className="flex-1 bg-transparent text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none"
            />
            <kbd className="px-2 py-0.5 rounded bg-[var(--color-muted)] text-[10px] text-[var(--color-text-tertiary)] font-mono">ESC</kbd>
          </div>

          {/* Results */}
          <div className="max-h-[300px] overflow-y-auto py-2">
            {allResults.length === 0 && query.length > 0 && (
              <div className="px-4 py-8 text-center text-sm text-[var(--color-text-tertiary)]">Ничего не найдено</div>
            )}
            {allResults.map((result, i) => (
              <button
                key={`${result.type}-${result.title}-${i}`}
                onClick={result.action}
                onMouseEnter={() => setSelectedIndex(i)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                  i === selectedIndex ? "bg-[var(--color-muted)]" : ""
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-[var(--color-muted)] flex items-center justify-center text-[var(--color-text-secondary)]">
                  {result.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">{result.title}</p>
                  {result.subtitle && <p className="text-xs text-[var(--color-text-tertiary)] truncate">{result.subtitle}</p>}
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-muted)] text-[var(--color-text-tertiary)]">
                  {result.type === "patient" ? "Пациент" : "Страница"}
                </span>
              </button>
            ))}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-[var(--color-border)] flex items-center gap-4 text-[10px] text-[var(--color-text-tertiary)]">
            <span>&#8593;&#8595; навигация</span>
            <span>&#8629; открыть</span>
            <span>esc закрыть</span>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

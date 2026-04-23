import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { staffApi } from "@/features/staff/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/rbac")({
  component: RBACPage,
});

/* ────────── constants ────────── */

const GROUP_COLORS: Record<string, string> = {
  patients: "#2563eb",
  medical_card: "#10b981",
  treatment: "#7c3aed",
  pharmacy: "#f59e0b",
  lab: "#0891b2",
  schedule: "#ec4899",
  billing: "#d97706",
  staff: "#6366f1",
  reports: "#14b8a6",
};

const GROUP_LABELS: Record<string, string> = {
  patients: "Пациенты",
  medical_card: "Мед. карта",
  treatment: "Лечение",
  pharmacy: "Аптека",
  lab: "Лаборатория",
  schedule: "Расписание",
  billing: "Биллинг",
  staff: "Персонал",
  reports: "Отчёты",
};

/* ────────── types ────────── */

interface Permission {
  code: string;
  label: string;
  group: string;
}

interface PermissionGroup {
  group: string;
  permissions: Permission[];
}

interface Template {
  id: string;
  name: string;
  description?: string;
  color?: string;
  permissions: string[];
  is_system?: boolean;
}

/* ────────── page ────────── */

function RBACPage() {
  const [activeTab, setActiveTab] = useState<"matrix" | "templates">("matrix");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Управление ролями</h1>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1">Настройка прав доступа для каждой роли</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[var(--color-muted)] rounded-xl p-1 w-fit">
        {([
          { key: "matrix" as const, label: "Матрица прав" },
          { key: "templates" as const, label: "Шаблоны ролей" },
        ]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-5 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
              activeTab === tab.key
                ? "bg-[var(--color-surface)] text-foreground shadow-sm"
                : "text-[var(--color-text-tertiary)] hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "matrix" ? <PermissionMatrix /> : <TemplateCards />}
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   TAB 1 — Permission Matrix
   ════════════════════════════════════════════════════════ */

function PermissionMatrix() {
  const queryClient = useQueryClient();

  const { data: permData, isLoading: loadingPerms } = useQuery({
    queryKey: ["permissions"],
    queryFn: staffApi.listPermissions,
  });

  const { data: templateList, isLoading: loadingTemplates } = useQuery({
    queryKey: ["permission-templates"],
    queryFn: staffApi.listTemplates,
  });

  // Fetch each template's details (they contain the permission list)
  const templates: Template[] = useMemo(() => {
    if (!templateList) return [];
    // The list endpoint may already include permissions; normalise
    return (Array.isArray(templateList) ? templateList : templateList.items ?? templateList.templates ?? []) as Template[];
  }, [templateList]);

  const groups: PermissionGroup[] = useMemo(() => {
    if (!permData) return [];
    if (Array.isArray(permData)) {
      // Flat list — group by .group field
      const map: Record<string, Permission[]> = {};
      (permData as Permission[]).forEach((p) => {
        (map[p.group] ??= []).push(p);
      });
      return Object.entries(map).map(([group, permissions]) => ({ group, permissions }));
    }
    // Already grouped
    if (permData.groups) return permData.groups as PermissionGroup[];
    // Object keyed by group
    return Object.entries(permData as Record<string, Permission[]>).map(([group, permissions]) => ({
      group,
      permissions: permissions as Permission[],
    }));
  }, [permData]);

  /* ── local state for toggling ── */
  const [dirty, setDirty] = useState<Record<string, Set<string>>>({});
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    Object.keys(GROUP_LABELS).forEach((g) => (init[g] = true));
    return init;
  });

  const getEffectivePerms = useCallback(
    (template: Template): Set<string> => {
      const base = new Set(template.permissions ?? []);
      const overrides = dirty[template.id];
      if (!overrides) return base;
      overrides.forEach((code) => {
        if (base.has(code)) base.delete(code);
        else base.add(code);
      });
      return base;
    },
    [dirty],
  );

  const hasChanges = Object.values(dirty).some((s) => s.size > 0);

  const toggle = (templateId: string, code: string) => {
    setDirty((prev) => {
      const copy = { ...prev };
      const set = new Set(copy[templateId] ?? []);
      if (set.has(code)) set.delete(code);
      else set.add(code);
      copy[templateId] = set;
      return copy;
    });
  };

  /* ── save mutation ── */
  const saveMutation = useMutation({
    mutationFn: async () => {
      const promises = templates
        .filter((t) => dirty[t.id]?.size)
        .map((t) => {
          const perms = Array.from(getEffectivePerms(t));
          return staffApi.updateTemplate(t.id, { permissions: perms });
        });
      await Promise.all(promises);
    },
    onSuccess: () => {
      setDirty({});
      queryClient.invalidateQueries({ queryKey: ["permission-templates"] });
      toast.success("Права сохранены");
    },
    onError: () => toast.error("Не удалось сохранить изменения"),
  });

  const toggleGroup = (group: string) =>
    setExpandedGroups((prev) => ({ ...prev, [group]: !prev[group] }));

  /* ── loading skeleton ── */
  if (loadingPerms || loadingTemplates) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-12 rounded-xl bg-[var(--color-muted)] animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        {/* Color legend */}
        <div className="flex flex-wrap gap-2">
          {groups.map((g) => (
            <span
              key={g.group}
              className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)]"
            >
              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: GROUP_COLORS[g.group] }} />
              {GROUP_LABELS[g.group] ?? g.group}
            </span>
          ))}
        </div>

        {/* Save / Discard */}
        <div className="flex items-center gap-2">
          <AnimatePresence>
            {hasChanges && (
              <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="flex items-center gap-2"
              >
                <Badge variant="warning" dot>Несохранённые изменения</Badge>
                <Button variant="ghost" size="sm" onClick={() => setDirty({})}>
                  Отменить
                </Button>
                <Button size="sm" loading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
                  Сохранить
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Desktop table ── */}
      <div className="hidden lg:block border border-border rounded-xl overflow-hidden bg-[var(--color-surface)]">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--color-muted)]">
                <th className="text-left px-4 py-3 font-semibold text-[var(--color-text-secondary)] w-[280px] sticky left-0 bg-[var(--color-muted)] z-10">
                  Право
                </th>
                {templates.map((t) => (
                  <th key={t.id} className="px-3 py-3 text-center font-semibold text-[var(--color-text-secondary)] min-w-[100px]">
                    <span className="text-xs">{t.name}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => {
                const expanded = expandedGroups[g.group] !== false;
                return (
                  <GroupSection
                    key={g.group}
                    group={g}
                    expanded={expanded}
                    templates={templates}
                    getEffectivePerms={getEffectivePerms}
                    onToggleGroup={() => toggleGroup(g.group)}
                    onTogglePerm={toggle}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Mobile cards ── */}
      <div className="lg:hidden space-y-3">
        {groups.map((g) => {
          const expanded = expandedGroups[g.group] !== false;
          return (
            <div key={g.group} className="border border-border rounded-xl overflow-hidden bg-[var(--color-surface)]">
              <button
                onClick={() => toggleGroup(g.group)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[var(--color-muted)] transition-colors"
              >
                <span className="w-1 h-6 rounded-full" style={{ background: GROUP_COLORS[g.group] }} />
                <span className="font-semibold text-foreground text-sm flex-1 text-left">
                  {GROUP_LABELS[g.group] ?? g.group}
                </span>
                <Badge variant="muted">{g.permissions.length}</Badge>
                <ChevronIcon expanded={expanded} />
              </button>
              <AnimatePresence initial={false}>
                {expanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-3 space-y-3">
                      {g.permissions.map((p) => (
                        <div key={p.code} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-sm font-medium text-foreground">{p.label}</span>
                              <span className="ml-2 text-[10px] text-[var(--color-text-tertiary)] font-mono">{p.code}</span>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {templates.map((t) => {
                              const checked = getEffectivePerms(t).has(p.code);
                              return (
                                <button
                                  key={t.id}
                                  onClick={() => toggle(t.id, p.code)}
                                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all duration-150 border ${
                                    checked
                                      ? "bg-secondary/10 border-secondary/30 text-secondary"
                                      : "bg-transparent border-border text-[var(--color-text-tertiary)]"
                                  }`}
                                >
                                  {t.name}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Table group section ── */

function GroupSection({
  group,
  expanded,
  templates,
  getEffectivePerms,
  onToggleGroup,
  onTogglePerm,
}: {
  group: PermissionGroup;
  expanded: boolean;
  templates: Template[];
  getEffectivePerms: (t: Template) => Set<string>;
  onToggleGroup: () => void;
  onTogglePerm: (templateId: string, code: string) => void;
}) {
  const color = GROUP_COLORS[group.group];
  return (
    <>
      {/* Group header row */}
      <tr
        className="cursor-pointer hover:bg-[var(--color-muted)] transition-colors"
        onClick={onToggleGroup}
      >
        <td
          className="px-4 py-2.5 font-semibold text-foreground sticky left-0 bg-[var(--color-surface)] z-10"
          colSpan={templates.length + 1}
        >
          <div className="flex items-center gap-3">
            <span className="w-1 h-5 rounded-full" style={{ background: color }} />
            <span>{GROUP_LABELS[group.group] ?? group.group}</span>
            <Badge variant="muted">{group.permissions.length}</Badge>
            <ChevronIcon expanded={expanded} />
          </div>
        </td>
      </tr>

      {/* Permission rows */}
      <AnimatePresence initial={false}>
        {expanded &&
          group.permissions.map((p) => (
            <motion.tr
              key={p.code}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.15 }}
              className="border-t border-border/50 hover:bg-[var(--color-muted)]/50 transition-colors"
            >
              <td className="px-4 py-2 sticky left-0 bg-[var(--color-surface)] z-10">
                <div className="flex items-center gap-2 pl-5">
                  <span className="w-1 h-4 rounded-full opacity-40" style={{ background: color }} />
                  <div>
                    <span className="text-sm text-foreground">{p.label}</span>
                    <span className="ml-2 text-[10px] text-[var(--color-text-tertiary)] font-mono">{p.code}</span>
                  </div>
                </div>
              </td>
              {templates.map((t) => {
                const checked = getEffectivePerms(t).has(p.code);
                return (
                  <td key={t.id} className="px-3 py-2 text-center">
                    <button
                      onClick={() => onTogglePerm(t.id, p.code)}
                      className="mx-auto flex items-center justify-center"
                    >
                      <span
                        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-150 ${
                          checked
                            ? "bg-secondary border-secondary"
                            : "border-border hover:border-[var(--color-text-tertiary)]"
                        }`}
                      >
                        {checked && (
                          <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </span>
                    </button>
                  </td>
                );
              })}
            </motion.tr>
          ))}
      </AnimatePresence>
    </>
  );
}

/* ════════════════════════════════════════════════════════
   TAB 2 — Template Cards
   ════════════════════════════════════════════════════════ */

function TemplateCards() {
  const queryClient = useQueryClient();
  const { data: templateList, isLoading } = useQuery({
    queryKey: ["permission-templates"],
    queryFn: staffApi.listTemplates,
  });

  const templates: Template[] = useMemo(() => {
    if (!templateList) return [];
    return (Array.isArray(templateList) ? templateList : templateList.items ?? templateList.templates ?? []) as Template[];
  }, [templateList]);

  const duplicateMut = useMutation({
    mutationFn: (id: string) => staffApi.duplicateTemplate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["permission-templates"] });
      toast.success("Шаблон дублирован");
    },
    onError: () => toast.error("Ошибка дублирования"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => staffApi.deleteTemplate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["permission-templates"] });
      toast.success("Шаблон удалён");
    },
    onError: () => toast.error("Ошибка удаления"),
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-44 rounded-xl bg-[var(--color-muted)] animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--color-text-secondary)]">{templates.length} шаблонов</p>
        <Button
          size="sm"
          icon={
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" x2="12" y1="5" y2="19" /><line x1="5" x2="19" y1="12" y2="12" />
            </svg>
          }
          onClick={() => toast.info("Создание шаблонов будет доступно в следующем обновлении")}
        >
          Создать шаблон
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {templates.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="border border-border rounded-xl bg-[var(--color-surface)] p-5 flex flex-col gap-3 hover:shadow-md transition-shadow duration-200"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm"
                  style={{ background: t.color || "var(--color-secondary)" }}
                >
                  {t.name.charAt(0)}
                </div>
                <div>
                  <h3 className="font-semibold text-foreground text-sm">{t.name}</h3>
                  {t.description && (
                    <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5 line-clamp-1">{t.description}</p>
                  )}
                </div>
              </div>
              {t.is_system && <Badge variant="secondary">Системный</Badge>}
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="primary">{t.permissions?.length ?? 0} прав</Badge>
            </div>

            <div className="flex items-center gap-2 mt-auto pt-2 border-t border-border">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toast.info("Редактирование откроется в матрице прав")}
                icon={
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                  </svg>
                }
              >
                Изменить
              </Button>
              <Button
                variant="ghost"
                size="sm"
                loading={duplicateMut.isPending}
                onClick={() => duplicateMut.mutate(t.id)}
                icon={
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="14" height="14" x="8" y="8" rx="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                  </svg>
                }
              >
                Копировать
              </Button>
              {!t.is_system && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  loading={deleteMut.isPending}
                  onClick={() => {
                    if (confirm(`Удалить шаблон "${t.name}"?`)) deleteMut.mutate(t.id);
                  }}
                  icon={
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                    </svg>
                  }
                >
                  Удалить
                </Button>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* ── Shared tiny component ── */

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <motion.svg
      animate={{ rotate: expanded ? 180 : 0 }}
      transition={{ duration: 0.2 }}
      className="w-4 h-4 text-[var(--color-text-tertiary)]"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="6 9 12 15 18 9" />
    </motion.svg>
  );
}

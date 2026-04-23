import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowLeft, Shield, ShieldPlus, ShieldMinus, Check, X, Search, User, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { staffApi } from "@/features/staff/api";

export const Route = createFileRoute("/_authenticated/rbac-user")({
  validateSearch: (search: Record<string, unknown>) => ({
    userId: (search.userId as string) || "",
  }),
  component: RBACUserPage,
});

interface PermissionGroup {
  id: string;
  name: string;
  code: string;
  items: { id: string; code: string; label: string; description: string }[];
}

interface UserPermData {
  user: { id: string; first_name: string; last_name: string; role: string; email: string };
  template: { id: string; name: string } | null;
  template_permissions: string[];
  overrides: { code: string; type: "grant" | "revoke"; reason: string; created_at: string }[];
  effective_permissions: string[];
}

const groupColors: Record<string, string> = {
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

function RBACUserPage() {
  const { userId } = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [overrideReason, setOverrideReason] = useState("");

  const { data: groups } = useQuery<PermissionGroup[]>({
    queryKey: ["permission-groups"],
    queryFn: staffApi.listPermissions,
  });

  const { data: permData, isLoading } = useQuery<UserPermData>({
    queryKey: ["user-permissions", userId],
    queryFn: () => staffApi.getPermissions(userId),
    enabled: !!userId,
  });

  const grantMutation = useMutation({
    mutationFn: ({ code, reason }: { code: string; reason: string }) =>
      staffApi.grantPermission(userId, { permission_code: code, reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-permissions", userId] });
      toast.success("Право добавлено");
    },
    onError: () => toast.error("Ошибка при добавлении права"),
  });

  const revokeMutation = useMutation({
    mutationFn: ({ code, reason }: { code: string; reason: string }) =>
      staffApi.revokePermission(userId, { permission_code: code, reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-permissions", userId] });
      toast.success("Право отозвано");
    },
    onError: () => toast.error("Ошибка при отзыве права"),
  });

  if (!userId) {
    return (
      <div className="text-center py-20">
        <Shield size={48} className="mx-auto text-[var(--color-text-tertiary)] mb-4" />
        <p className="text-[var(--color-text-secondary)]">Выберите сотрудника для управления правами</p>
        <button onClick={() => navigate({ to: "/staff" })} className="mt-4 text-sm text-[var(--color-secondary)] hover:underline">
          Перейти к списку персонала
        </button>
      </div>
    );
  }

  const toggleGroup = (code: string) => {
    const next = new Set(expandedGroups);
    next.has(code) ? next.delete(code) : next.add(code);
    setExpandedGroups(next);
  };

  const templatePerms = new Set(permData?.template_permissions || []);
  const effectivePerms = new Set(permData?.effective_permissions || []);
  const overrideMap = new Map(permData?.overrides?.map((o) => [o.code, o]) || []);

  const filteredGroups = groups?.map((g) => ({
    ...g,
    items: g.items.filter((item) =>
      !search || item.label.toLowerCase().includes(search.toLowerCase()) || item.code.toLowerCase().includes(search.toLowerCase())
    ),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate({ to: "/rbac" })} className="p-2 rounded-xl hover:bg-[var(--color-muted)] transition-colors">
          <ArrowLeft size={20} className="text-[var(--color-text-tertiary)]" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Права сотрудника</h1>
          {permData?.user && (
            <p className="text-sm text-[var(--color-text-secondary)]">
              {permData.user.first_name} {permData.user.last_name} · {permData.user.email}
              {permData.template && (
                <span className="ml-2 px-2 py-0.5 rounded-full bg-[var(--color-secondary)]/10 text-[var(--color-secondary)] text-xs font-medium">
                  {permData.template.name}
                </span>
              )}
            </p>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-[var(--color-text-tertiary)]">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-[var(--color-secondary)]/15 flex items-center justify-center"><Check size={10} className="text-[var(--color-secondary)]" /></div>
          Из шаблона
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-green-100 flex items-center justify-center"><ShieldPlus size={10} className="text-green-600" /></div>
          Добавлено вручную
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-red-100 flex items-center justify-center"><ShieldMinus size={10} className="text-red-500" /></div>
          Отозвано
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск по правам..."
          className="w-full h-10 pl-9 pr-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-sm focus:outline-none focus:border-[var(--color-secondary)]/40"
        />
      </div>

      {/* Override reason */}
      <div className="flex gap-2">
        <input
          value={overrideReason}
          onChange={(e) => setOverrideReason(e.target.value)}
          placeholder="Причина изменения прав (необязательно)"
          className="flex-1 h-9 px-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-xs focus:outline-none focus:border-[var(--color-secondary)]/40"
        />
      </div>

      {/* Permission groups */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 rounded-xl bg-[var(--color-muted)] animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredGroups?.map((group) => {
            const color = groupColors[group.code] || "#6b7280";
            const isExpanded = expandedGroups.has(group.code);
            const groupPermCount = group.items.filter((item) => effectivePerms.has(item.code)).length;

            return (
              <div key={group.code} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
                {/* Group header */}
                <button
                  onClick={() => toggleGroup(group.code)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-[var(--color-muted)]/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-1 h-8 rounded-full" style={{ background: color }} />
                    <span className="text-sm font-semibold text-[var(--color-text-primary)]">{group.name}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: `${color}15`, color }}>
                      {groupPermCount}/{group.items.length}
                    </span>
                  </div>
                  <motion.svg
                    animate={{ rotate: isExpanded ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                    viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-[var(--color-text-tertiary)]"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </motion.svg>
                </button>

                {/* Permission items */}
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: "auto" }}
                    exit={{ height: 0 }}
                    className="border-t border-[var(--color-border)]"
                  >
                    {group.items.map((item) => {
                      const fromTemplate = templatePerms.has(item.code);
                      const isEffective = effectivePerms.has(item.code);
                      const override = overrideMap.get(item.code);
                      const isGrantOverride = override?.type === "grant";
                      const isRevokeOverride = override?.type === "revoke";

                      return (
                        <div key={item.code} className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--color-border)]/50 last:border-0 hover:bg-[var(--color-muted)]/30">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-[var(--color-text-primary)]">{item.label}</span>
                              <code className="text-[10px] text-[var(--color-text-tertiary)] font-mono bg-[var(--color-muted)] px-1.5 py-0.5 rounded">{item.code}</code>
                              {isGrantOverride && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-green-100 text-green-700">+добавлено</span>
                              )}
                              {isRevokeOverride && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-red-100 text-red-600">−отозвано</span>
                              )}
                            </div>
                            {item.description && (
                              <p className="text-[11px] text-[var(--color-text-tertiary)] mt-0.5">{item.description}</p>
                            )}
                            {override?.reason && (
                              <p className="text-[10px] text-[var(--color-text-tertiary)] italic mt-0.5">Причина: {override.reason}</p>
                            )}
                          </div>

                          <div className="flex items-center gap-1 ml-3">
                            {/* Grant button */}
                            {!isEffective && (
                              <button
                                onClick={() => grantMutation.mutate({ code: item.code, reason: overrideReason })}
                                disabled={grantMutation.isPending}
                                className="p-1.5 rounded-lg text-green-500 hover:bg-green-50 transition-colors"
                                title="Дать право"
                              >
                                <ShieldPlus size={16} />
                              </button>
                            )}
                            {/* Revoke button */}
                            {isEffective && (
                              <button
                                onClick={() => revokeMutation.mutate({ code: item.code, reason: overrideReason })}
                                disabled={revokeMutation.isPending}
                                className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 transition-colors"
                                title="Отозвать право"
                              >
                                <ShieldMinus size={16} />
                              </button>
                            )}
                            {/* Status indicator */}
                            <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${
                              isEffective
                                ? isGrantOverride
                                  ? "bg-green-100"
                                  : "bg-[var(--color-secondary)]/10"
                                : isRevokeOverride
                                  ? "bg-red-100"
                                  : "bg-[var(--color-muted)]"
                            }`}>
                              {isEffective ? (
                                <Check size={12} className={isGrantOverride ? "text-green-600" : "text-[var(--color-secondary)]"} />
                              ) : (
                                <X size={12} className={isRevokeOverride ? "text-red-500" : "text-[var(--color-text-tertiary)]"} />
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </motion.div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

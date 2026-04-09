import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { staffApi } from "@/features/staff/api";
import { useState } from "react";
import { InputField } from "@/components/ui/input-field";
import { CustomSelect } from "@/components/ui/select-custom";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/staff/")({
  component: StaffPage,
});

const employmentTypeLabels: Record<string, string> = {
  FULL: "Полная",
  PART: "Частичная",
  CONTRACT: "Совместитель",
  INTERN: "Стажёр",
};

const searchIcon = (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
  </svg>
);

// Generate a deterministic color class from a string
function templateColor(name: string): string {
  const colors = [
    "bg-secondary/10 text-secondary",
    "bg-success/10 text-success",
    "bg-warning/10 text-warning",
    "bg-primary/10 text-[var(--color-primary-deep)]",
    "bg-destructive/10 text-destructive",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) & 0xffff;
  return colors[hash % colors.length];
}

function StaffPage() {
  const [search, setSearch] = useState("");
  const [templateFilter, setTemplateFilter] = useState("");
  const [page, setPage] = useState(0);
  const limit = 20;

  const { data: staffData, isLoading } = useQuery({
    queryKey: ["staff", search, templateFilter, page],
    queryFn: () => staffApi.list({
      skip: page * limit,
      limit,
      search: search || undefined,
      template_id: templateFilter || undefined,
    }),
  });

  const { data: templatesData } = useQuery({
    queryKey: ["staff-templates"],
    queryFn: () => staffApi.listTemplates(),
  });

  const staffList: Record<string, any>[] = staffData?.items || [];
  const total: number = staffData?.total || 0;
  const templates: Record<string, any>[] = templatesData?.items || templatesData || [];

  const templateOptions = [
    { value: "", label: "Все шаблоны" },
    ...templates.map((t: Record<string, any>) => ({ value: t.id, label: t.name })),
  ];

  return (
    <div className="max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="animate-float-up">
          <h1 className="text-[26px] font-bold text-foreground tracking-tight">Сотрудники</h1>
          <p className="text-[var(--color-text-secondary)] text-sm mt-1">{total} сотрудников</p>
        </div>
        <Link
          to="/staff/new"
          className="px-5 py-2.5 rounded-xl bg-secondary text-white text-sm font-semibold hover:bg-secondary/90 transition-colors flex items-center gap-2 animate-float-up"
          style={{ animationDelay: "50ms" }}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/>
          </svg>
          Новый сотрудник
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4 animate-float-up" style={{ animationDelay: "100ms" }}>
        <InputField
          icon={searchIcon}
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          placeholder="Поиск по имени, должности, телефону..."
          className="flex-1 max-w-md"
        />
        <CustomSelect
          value={templateFilter}
          onChange={(v) => { setTemplateFilter(v); setPage(0); }}
          options={templateOptions}
          placeholder="Все шаблоны"
          className="w-52"
        />
      </div>

      {/* Table */}
      <div className="bg-[var(--color-surface)] rounded-2xl border border-border overflow-hidden animate-float-up" style={{ animationDelay: "150ms" }}>
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-14 bg-[var(--color-muted)] rounded-xl animate-pulse" />
            ))}
          </div>
        ) : staffList.length === 0 ? (
          <div className="p-12 text-center">
            <svg className="w-12 h-12 mx-auto mb-3 text-[var(--color-text-tertiary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
              <path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            <p className="text-[var(--color-text-secondary)]">{search ? "Сотрудники не найдены" : "Нет сотрудников"}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-4 text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Сотрудник</th>
                  <th className="text-left p-4 text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Должность</th>
                  <th className="text-left p-4 text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Шаблон</th>
                  <th className="text-left p-4 text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Отдел</th>
                  <th className="text-left p-4 text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Тип</th>
                  <th className="text-left p-4 text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {staffList.map((s: Record<string, any>) => (
                  <tr
                    key={s.id}
                    className="hover:bg-[var(--color-muted)]/50 transition-colors"
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        {s.photo_url ? (
                          <img
                            src={s.photo_url}
                            alt=""
                            className="w-9 h-9 rounded-xl object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-xl bg-secondary/10 flex items-center justify-center text-xs font-bold text-secondary flex-shrink-0">
                            {s.first_name?.[0]}{s.last_name?.[0]}
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {s.last_name} {s.first_name} {s.middle_name || ""}
                          </p>
                          {s.work_phone && (
                            <p className="text-xs text-[var(--color-text-tertiary)]">{s.work_phone}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-sm text-[var(--color-text-secondary)]">
                      {s.position || "—"}
                    </td>
                    <td className="p-4">
                      {s.template_name ? (
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${templateColor(s.template_name)}`}>
                          {s.template_name}
                        </span>
                      ) : (
                        <span className="text-[var(--color-text-tertiary)] text-sm">—</span>
                      )}
                    </td>
                    <td className="p-4 text-sm text-[var(--color-text-secondary)]">
                      {s.department_name || s.department || "—"}
                    </td>
                    <td className="p-4 text-sm text-[var(--color-text-secondary)]">
                      {employmentTypeLabels[s.employment_type] || s.employment_type || "—"}
                    </td>
                    <td className="p-4">
                      <Link
                        to="/staff/$staffId"
                        params={{ staffId: s.id }}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--color-muted)] text-[var(--color-text-secondary)] hover:text-foreground hover:bg-[var(--color-border)] transition-colors"
                      >
                        Открыть
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {total > limit && (
          <div className="flex items-center justify-between p-4 border-t border-border">
            <p className="text-sm text-[var(--color-text-tertiary)]">
              Стр. {page + 1} из {Math.ceil(total / limit)}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(Math.max(0, page - 1))}
                disabled={page === 0}
              >
                Назад
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(page + 1)}
                disabled={(page + 1) * limit >= total}
              >
                Далее
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { patientsApi } from "@/features/patients/api";
import { useState } from "react";
import { formatDate } from "@/lib/utils";
import { InputField } from "@/components/ui/input-field";
import { CustomSelect } from "@/components/ui/select-custom";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/patients")({
  component: PatientsPage,
});

const statusLabels: Record<string, string> = { ACTIVE: "Активен", DISCHARGED: "Выписан", DECEASED: "Умер", TRANSFERRED: "Переведён" };
const statusColors: Record<string, string> = { ACTIVE: "bg-success/10 text-success", DISCHARGED: "bg-[var(--color-muted)] text-[var(--color-text-secondary)]", TRANSFERRED: "bg-warning/10 text-warning" };
const genderLabels: Record<string, string> = { MALE: "М", FEMALE: "Ж", OTHER: "—" };

const statusOptions = [
  { value: "", label: "Все статусы" },
  { value: "ACTIVE", label: "Активен" },
  { value: "DISCHARGED", label: "Выписан" },
  { value: "TRANSFERRED", label: "Переведён" },
];

const searchIcon = (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
  </svg>
);

function PatientsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [page, setPage] = useState(0);
  const limit = 20;

  const { data, isLoading } = useQuery({
    queryKey: ["patients", search, statusFilter, page],
    queryFn: () => patientsApi.list({ skip: page * limit, limit, search: search || undefined, status: statusFilter || undefined }),
  });

  const patients = data?.items || [];
  const total = data?.total || 0;

  return (
    <div className="max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="animate-float-up" style={{ opacity: 0 }}>
          <h1 className="text-[26px] font-bold text-foreground tracking-tight">Пациенты</h1>
          <p className="text-[var(--color-text-secondary)] text-sm mt-1">{total} пациентов</p>
        </div>
        <Link to="/patients/new" className="px-5 py-2.5 rounded-xl bg-secondary text-white text-sm font-semibold hover:bg-secondary/90 transition-colors flex items-center gap-2 animate-float-up" style={{ animationDelay: '50ms', opacity: 0 }}>
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/></svg>
          Новый пациент
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4 animate-float-up" style={{ animationDelay: '100ms', opacity: 0 }}>
        <InputField
          icon={searchIcon}
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          placeholder="Поиск по ФИО, ИНН, паспорту, телефону..."
          className="flex-1 max-w-md"
        />
        <CustomSelect
          value={statusFilter}
          onChange={(v) => { setStatusFilter(v); setPage(0); }}
          options={statusOptions}
          placeholder="Все статусы"
          className="w-44"
        />
      </div>

      {/* Table */}
      <div className="bg-[var(--color-surface)] rounded-2xl border border-border overflow-hidden animate-float-up" style={{ animationDelay: '150ms', opacity: 0 }}>
        {isLoading ? (
          <div className="p-6 space-y-3">{[1,2,3,4,5].map(i => <div key={i} className="h-14 bg-[var(--color-muted)] rounded-xl animate-pulse" />)}</div>
        ) : patients.length === 0 ? (
          <div className="p-12 text-center">
            <svg className="w-12 h-12 mx-auto mb-3 text-[var(--color-text-tertiary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
            <p className="text-[var(--color-text-secondary)]">{search ? "Пациенты не найдены" : "Нет пациентов"}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-4 text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Пациент</th>
                  <th className="text-left p-4 text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Пол</th>
                  <th className="text-left p-4 text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Дата рождения</th>
                  <th className="text-left p-4 text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Телефон</th>
                  <th className="text-left p-4 text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Группа крови</th>
                  <th className="text-left p-4 text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Статус</th>
                  <th className="text-left p-4 text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Дата</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {patients.map((p: Record<string, any>) => (
                  <tr key={p.id} className="hover:bg-[var(--color-muted)]/50 transition-colors cursor-pointer" onClick={() => window.location.href = `/patients/${p.id}`}>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-xs font-bold text-[var(--color-primary-deep)]">
                          {p.first_name?.[0]}{p.last_name?.[0]}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{p.last_name} {p.first_name} {p.middle_name || ""}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-sm text-[var(--color-text-secondary)]">{genderLabels[p.gender] || "—"}</td>
                    <td className="p-4 text-sm text-[var(--color-text-secondary)] font-mono">{formatDate(p.date_of_birth)}</td>
                    <td className="p-4 text-sm text-[var(--color-text-secondary)]">{p.phone || "—"}</td>
                    <td className="p-4 text-sm text-[var(--color-text-secondary)]">{p.blood_type}</td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[p.status] || "bg-[var(--color-muted)]"}`}>
                        {statusLabels[p.status] || p.status}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-[var(--color-text-tertiary)] font-mono">{formatDate(p.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {total > limit && (
          <div className="flex items-center justify-between p-4 border-t border-border">
            <p className="text-sm text-[var(--color-text-tertiary)]">Стр. {page + 1} из {Math.ceil(total / limit)}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}>Назад</Button>
              <Button variant="outline" size="sm" onClick={() => setPage(page + 1)} disabled={(page + 1) * limit >= total}>Далее</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

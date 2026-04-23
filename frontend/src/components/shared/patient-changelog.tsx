import { useState } from "react";
import { usePatientChangelog, type ChangelogEntry } from "@/features/changelog/api";

const entityIcons: Record<string, JSX.Element> = {
  patient: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
    </svg>
  ),
  visit: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
      <path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6 6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3" />
      <path d="M8 15v1a6 6 0 0 0 6 6 6 6 0 0 0 6-6v-4" />
      <circle cx="20" cy="10" r="2" />
    </svg>
  ),
  prescription: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
      <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z" />
      <path d="m8.5 8.5 7 7" />
    </svg>
  ),
  lab_result: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
      <path d="M14 2v6a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V2" />
      <path d="M10 2v3.3a4 4 0 0 1-1.17 2.83L4 13v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6l-4.83-4.87A4 4 0 0 1 14 5.3V2" />
    </svg>
  ),
};

const actionColors: Record<string, string> = {
  create: "bg-emerald-100 text-emerald-700",
  update: "bg-blue-100 text-blue-700",
  delete: "bg-red-100 text-red-700",
};

const actionLabels: Record<string, string> = {
  create: "Создание",
  update: "Изменение",
  delete: "Удаление",
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface PatientChangelogProps {
  patientId: string;
  entityType?: string;
}

export function PatientChangelog({ patientId, entityType }: PatientChangelogProps) {
  const { data: entries, isLoading } = usePatientChangelog(patientId, entityType);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!entries || entries.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-[var(--color-text-tertiary)]">
        Нет записей в журнале изменений
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <h3 className="text-sm font-semibold text-foreground mb-3">Журнал изменений</h3>
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-[15px] top-0 bottom-0 w-px bg-border" />

        {entries.map((entry) => {
          const isExpanded = expandedId === entry.id;
          const hasChanges = entry.changes && Object.keys(entry.changes).length > 0;

          return (
            <div key={entry.id} className="relative pl-10 pb-4">
              {/* Timeline dot */}
              <div className="absolute left-[10px] top-1 w-[11px] h-[11px] rounded-full border-2 border-[var(--color-surface)] bg-primary/60 z-10" />

              <div
                className={`rounded-xl border border-border p-3 transition-colors ${hasChanges ? "cursor-pointer hover:bg-[var(--color-muted)]" : ""}`}
                onClick={() => hasChanges && setExpandedId(isExpanded ? null : entry.id)}
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[var(--color-text-secondary)]">
                    {entityIcons[entry.entity_type] || entityIcons.patient}
                  </span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${actionColors[entry.action] || "bg-gray-100 text-gray-600"}`}>
                    {actionLabels[entry.action] || entry.action}
                  </span>
                  <span className="text-xs text-[var(--color-text-tertiary)]">
                    {formatDateTime(entry.created_at)}
                  </span>
                  {hasChanges && (
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className={`w-3 h-3 text-[var(--color-text-tertiary)] transition-transform ${isExpanded ? "rotate-180" : ""}`}
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  )}
                </div>

                <div className="mt-1">
                  <span className="text-xs font-medium text-foreground">{entry.changed_by_name}</span>
                  {entry.summary && (
                    <span className="text-xs text-[var(--color-text-secondary)] ml-1">— {entry.summary}</span>
                  )}
                </div>

                {/* Diff view */}
                {isExpanded && entry.changes && (
                  <div className="mt-3 space-y-1.5 border-t border-border pt-2">
                    {Object.entries(entry.changes).map(([field, diff]) => (
                      <div key={field} className="flex items-start gap-2 text-xs">
                        <span className="font-medium text-[var(--color-text-secondary)] min-w-[80px]">
                          {field}:
                        </span>
                        <span className="bg-red-50 text-red-600 line-through px-1.5 py-0.5 rounded">
                          {String(diff.old || "—")}
                        </span>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3 text-[var(--color-text-tertiary)] flex-shrink-0 mt-0.5">
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                        <span className="bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded">
                          {String(diff.new || "—")}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

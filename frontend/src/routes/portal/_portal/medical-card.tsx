import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { portalApi } from "@/features/portal/api";
import { useState } from "react";

export const Route = createFileRoute("/portal/_portal/medical-card")({
  component: MedicalCardPage,
});

const TABS = ["Обзор", "Показатели", "Диагнозы", "Документы"];

function MedicalCardPage() {
  const [tab, setTab] = useState(0);
  const { data: card } = useQuery({ queryKey: ["portal-card"], queryFn: portalApi.getMedicalCard });
  const { data: vitals } = useQuery({ queryKey: ["portal-vitals"], queryFn: () => portalApi.getVitals(30) });
  const { data: diagnoses } = useQuery({ queryKey: ["portal-diagnoses"], queryFn: portalApi.getDiagnoses });

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="mb-6 animate-float-up">
        <h1 className="text-[24px] font-bold text-foreground tracking-tight">Медицинская карта</h1>
        {card && <p className="text-sm text-[var(--color-text-secondary)] mt-1">Карта №{(card as Record<string, any>).card_number}</p>}
      </div>

      {/* Allergy banner */}
      {(card as Record<string, any>)?.allergies && (card as Record<string, any>).allergies.length > 0 && (
        <div className="mb-4 p-4 rounded-xl bg-destructive/10 border border-destructive/20 flex items-center gap-3 animate-float-up" style={{ animationDelay: '50ms' }}>
          <svg className="w-5 h-5 text-destructive flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>
          </svg>
          <div>
            <p className="text-sm font-semibold text-destructive">Аллергии</p>
            <p className="text-sm text-destructive/80">{(card as Record<string, any>).allergies.join(", ")}</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-[var(--color-muted)] rounded-xl mb-6 animate-float-up" style={{ animationDelay: '100ms' }}>
        {TABS.map((t, i) => (
          <button key={t} onClick={() => setTab(i)}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${tab === i ? "bg-[var(--color-surface)] text-foreground shadow-sm" : "text-[var(--color-text-secondary)] hover:text-foreground"}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="animate-float-up" style={{ animationDelay: '150ms' }}>
        {tab === 0 && <OverviewTab vitals={vitals} diagnoses={diagnoses} card={card} />}
        {tab === 1 && <VitalsTab vitals={vitals} />}
        {tab === 2 && <DiagnosesTab diagnoses={diagnoses} />}
        {tab === 3 && <DocumentsTab />}
      </div>
    </div>
  );
}

function OverviewTab({ vitals, diagnoses, card }: { vitals: any; diagnoses: any; card: any }) {
  const latest = vitals?.[0];
  return (
    <div className="space-y-4">
      {/* Latest vitals */}
      <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-6">
        <h3 className="text-sm font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-4">Последние показатели</h3>
        {latest ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "АД", value: latest.systolic_bp && latest.diastolic_bp ? `${latest.systolic_bp}/${latest.diastolic_bp}` : "—", unit: "мм рт.ст." },
              { label: "Пульс", value: latest.pulse ?? "—", unit: "уд/мин" },
              { label: "Температура", value: latest.temperature ?? "—", unit: "°C" },
              { label: "SpO2", value: latest.spo2 ?? "—", unit: "%" },
              { label: "Вес", value: latest.weight ?? "—", unit: "кг" },
              { label: "ЧДД", value: latest.respiratory_rate ?? "—", unit: "/мин" },
              { label: "Глюкоза", value: latest.blood_glucose ?? "—", unit: "ммоль/л" },
              { label: "Дата", value: latest.recorded_at ? new Date(latest.recorded_at).toLocaleDateString("ru-RU") : "—", unit: "" },
            ].map((v) => (
              <div key={v.label} className="text-center p-3 rounded-xl bg-[var(--color-muted)]/50">
                <p className="text-xs text-[var(--color-text-tertiary)] mb-1">{v.label}</p>
                <p className="text-lg font-bold text-foreground">{v.value}</p>
                {v.unit && <p className="text-[10px] text-[var(--color-text-tertiary)]">{v.unit}</p>}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--color-text-secondary)]">Нет данных</p>
        )}
      </div>

      {/* Active diagnoses */}
      <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-6">
        <h3 className="text-sm font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-4">Активные диагнозы</h3>
        {(diagnoses || []).length > 0 ? (
          <div className="space-y-2">
            {(diagnoses as Array<Record<string, any>>).slice(0, 5).map((d: Record<string, any>, i: number) => (
              <div key={i} className="flex items-center gap-3 py-2">
                <span className="px-2 py-0.5 bg-secondary/10 text-secondary text-xs font-mono rounded">{d.code}</span>
                <span className="text-sm text-foreground">{d.text || "Без описания"}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--color-text-secondary)]">Диагнозы не указаны</p>
        )}
      </div>

      {/* Chronic conditions */}
      {card?.chronic_conditions && card.chronic_conditions.length > 0 && (
        <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-6">
          <h3 className="text-sm font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-4">Хронические заболевания</h3>
          <div className="flex flex-wrap gap-2">
            {card.chronic_conditions.map((c: string, i: number) => (
              <span key={i} className="px-3 py-1 bg-warning/10 text-warning text-sm rounded-full">{c}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function VitalsTab({ vitals }: { vitals: any }) {
  if (!vitals || vitals.length === 0) {
    return (
      <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-8 text-center">
        <p className="text-[var(--color-text-secondary)]">Нет данных о показателях</p>
      </div>
    );
  }

  const sorted = [...(vitals as Array<Record<string, any>>)].reverse();

  return (
    <div className="space-y-4">
      <div className="bg-[var(--color-surface)] rounded-2xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-3 text-xs font-semibold text-[var(--color-text-tertiary)] uppercase">Дата</th>
                <th className="text-center p-3 text-xs font-semibold text-[var(--color-text-tertiary)] uppercase">АД</th>
                <th className="text-center p-3 text-xs font-semibold text-[var(--color-text-tertiary)] uppercase">Пульс</th>
                <th className="text-center p-3 text-xs font-semibold text-[var(--color-text-tertiary)] uppercase">Темп.</th>
                <th className="text-center p-3 text-xs font-semibold text-[var(--color-text-tertiary)] uppercase">SpO2</th>
                <th className="text-center p-3 text-xs font-semibold text-[var(--color-text-tertiary)] uppercase">Вес</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sorted.map((v: Record<string, any>, i: number) => (
                <tr key={i} className="hover:bg-[var(--color-muted)]/50 transition-colors">
                  <td className="p-3 font-mono text-xs">{new Date(v.recorded_at).toLocaleDateString("ru-RU")}</td>
                  <td className="p-3 text-center">{v.systolic_bp && v.diastolic_bp ? `${v.systolic_bp}/${v.diastolic_bp}` : "—"}</td>
                  <td className="p-3 text-center">{v.pulse ?? "—"}</td>
                  <td className="p-3 text-center">{v.temperature ?? "—"}</td>
                  <td className="p-3 text-center">{v.spo2 ?? "—"}</td>
                  <td className="p-3 text-center">{v.weight ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function DiagnosesTab({ diagnoses }: { diagnoses: any }) {
  if (!diagnoses || diagnoses.length === 0) {
    return (
      <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-8 text-center">
        <p className="text-[var(--color-text-secondary)]">Диагнозы не указаны</p>
      </div>
    );
  }

  return (
    <div className="bg-[var(--color-surface)] rounded-2xl border border-border divide-y divide-border">
      {(diagnoses as Array<Record<string, any>>).map((d: Record<string, any>, i: number) => (
        <div key={i} className="p-4 flex items-center gap-4">
          <span className="px-2.5 py-1 bg-secondary/10 text-secondary text-xs font-mono rounded-lg flex-shrink-0">{d.code}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">{d.text || "—"}</p>
            <p className="text-xs text-[var(--color-text-tertiary)]">
              {d.date ? new Date(d.date).toLocaleDateString("ru-RU") : ""}
              {d.doctor_name ? ` · ${d.doctor_name}` : ""}
            </p>
          </div>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${d.status === "active" ? "bg-success/10 text-success" : "bg-[var(--color-muted)] text-[var(--color-text-tertiary)]"}`}>
            {d.status === "active" ? "Активный" : "Снят"}
          </span>
        </div>
      ))}
    </div>
  );
}

const ENTRY_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  initial_exam: { label: "Осмотр", color: "bg-blue-500/10 text-blue-600" },
  daily_note: { label: "Дневник", color: "bg-slate-500/10 text-slate-600" },
  specialist_consult: { label: "Консультация", color: "bg-violet-500/10 text-violet-600" },
  procedure_note: { label: "Процедура", color: "bg-teal-500/10 text-teal-600" },
  discharge_summary: { label: "Выписка", color: "bg-emerald-500/10 text-emerald-600" },
  anamnesis: { label: "Анамнез", color: "bg-amber-500/10 text-amber-600" },
  surgery_note: { label: "Операция", color: "bg-red-500/10 text-red-600" },
  lab_interpretation: { label: "Анализ", color: "bg-cyan-500/10 text-cyan-600" },
  imaging_description: { label: "Снимок", color: "bg-indigo-500/10 text-indigo-600" },
  ai_generated: { label: "AI-заключение", color: "bg-yellow-500/10 text-yellow-600" },
  manual: { label: "Заключение", color: "bg-gray-500/10 text-gray-600" },
};

function DocumentsTab() {
  const { data: documents, isLoading } = useQuery({
    queryKey: ["portal-documents"],
    queryFn: portalApi.getDocuments,
  });

  if (isLoading) {
    return (
      <div className="bg-[var(--color-surface)] rounded-2xl border border-border divide-y divide-border">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="p-4 flex items-center gap-4 animate-pulse">
            <div className="w-24 h-6 bg-[var(--color-muted)] rounded-lg" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-[var(--color-muted)] rounded w-3/4" />
              <div className="h-3 bg-[var(--color-muted)] rounded w-1/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!documents || (documents as any[]).length === 0) {
    return (
      <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-8 text-center">
        <svg className="w-12 h-12 mx-auto mb-3 text-[var(--color-text-tertiary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/>
        </svg>
        <p className="text-[var(--color-text-secondary)]">Документы не найдены</p>
        <p className="text-xs text-[var(--color-text-tertiary)] mt-1">Здесь будут отображаться снимки, результаты и другие файлы</p>
      </div>
    );
  }

  return (
    <div className="bg-[var(--color-surface)] rounded-2xl border border-border divide-y divide-border">
      {(documents as Array<Record<string, any>>).map((doc) => {
        const typeInfo = ENTRY_TYPE_LABELS[doc.entry_type] || { label: doc.entry_type, color: "bg-gray-500/10 text-gray-600" };
        return (
          <div key={doc.id} className="p-4 flex items-center gap-4">
            <span className={`px-2.5 py-1 text-xs font-medium rounded-lg flex-shrink-0 ${typeInfo.color}`}>
              {typeInfo.label}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{doc.title}</p>
              <p className="text-xs text-[var(--color-text-tertiary)]">
                {doc.recorded_at ? new Date(doc.recorded_at).toLocaleDateString("ru-RU") : ""}
                {doc.author_name ? ` · ${doc.author_name}` : ""}
              </p>
            </div>
            {doc.source_document_url && (
              <a href={doc.source_document_url} target="_blank" rel="noreferrer" aria-label="Открыть документ"
                className="p-2 rounded-lg hover:bg-[var(--color-muted)] transition-colors text-[var(--color-text-tertiary)] hover:text-foreground">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
              </a>
            )}
          </div>
        );
      })}
    </div>
  );
}

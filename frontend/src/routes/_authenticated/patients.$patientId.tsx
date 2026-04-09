import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { patientsApi } from "@/features/patients/api";
import { formatDate, formatDateTime } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/patients/$patientId")({
  validateSearch: (search: Record<string, unknown>) => ({
    tab: (search.tab as string) || "profile",
  }),
  component: PatientDetailPage,
});

const TABS = [
  { key: "profile", label: "Профиль" },
  { key: "vitals", label: "Показатели" },
  { key: "results", label: "Анализы" },
  { key: "treatment", label: "Лечение" },
  { key: "exercises", label: "Упражнения" },
  { key: "visits", label: "Визиты" },
];

function PatientDetailPage() {
  const { patientId } = Route.useParams();
  const { tab } = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const setTab = (newTab: string) => {
    navigate({ search: { tab: newTab }, replace: true });
  };

  const { data: patient, isLoading } = useQuery({ queryKey: ["patient", patientId], queryFn: () => patientsApi.get(patientId) });
  const { data: vitals } = useQuery({ queryKey: ["patient-vitals", patientId], queryFn: () => patientsApi.getVitals(patientId), enabled: tab === "vitals" });
  const { data: labResults } = useQuery({ queryKey: ["patient-results", patientId], queryFn: () => patientsApi.getLabResults(patientId), enabled: tab === "results" });
  const { data: plans } = useQuery({ queryKey: ["patient-plans", patientId], queryFn: () => patientsApi.getTreatmentPlans(patientId), enabled: tab === "treatment" });
  const { data: exerciseSessions } = useQuery({ queryKey: ["patient-exercises", patientId], queryFn: () => patientsApi.getExerciseSessions(patientId), enabled: tab === "exercises" });
  const { data: visits } = useQuery({ queryKey: ["patient-visits", patientId], queryFn: () => patientsApi.getVisits(patientId), enabled: tab === "visits" });

  // Doctor and nurse data for profile tab
  const { data: doctorData } = useQuery({
    queryKey: ["user", patient?.assigned_doctor_id],
    queryFn: () => patientsApi.getUser(patient!.assigned_doctor_id),
    enabled: tab === "profile" && !!patient?.assigned_doctor_id,
  });
  const { data: nurseData } = useQuery({
    queryKey: ["user", patient?.assigned_nurse_id],
    queryFn: () => patientsApi.getUser(patient!.assigned_nurse_id),
    enabled: tab === "profile" && !!patient?.assigned_nurse_id,
  });

  const approveMutation = useMutation({
    mutationFn: ({ resultId, visible }: { resultId: string; visible: boolean }) => patientsApi.approveResult(resultId, visible),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["patient-results", patientId] }); toast.success("Результат обновлён"); },
  });

  if (isLoading) {
    return <div className="space-y-4 animate-pulse"><div className="h-8 w-64 bg-[var(--color-muted)] rounded-lg" /><div className="h-48 bg-[var(--color-muted)] rounded-xl" /></div>;
  }
  if (!patient) return <div>Пациент не найден</div>;

  const statusLabels: Record<string, string> = { ACTIVE: "Активен", DISCHARGED: "Выписан" };
  const statusColors: Record<string, string> = { ACTIVE: "bg-success/10 text-success", DISCHARGED: "bg-[var(--color-muted)] text-[var(--color-text-secondary)]" };

  return (
    <div className="max-w-6xl">
      {/* Back + header */}
      <Link to="/patients" className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-foreground mb-4 transition-colors animate-float-up">
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
        К списку пациентов
      </Link>

      <div className="flex items-center gap-4 mb-6 animate-float-up" style={{ animationDelay: '50ms' }}>
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-[var(--color-primary-deep)] flex items-center justify-center text-lg font-bold text-primary-foreground shadow-sm">
          {patient.first_name?.[0]}{patient.last_name?.[0]}
        </div>
        <div>
          <h1 className="text-[22px] font-bold text-foreground">{patient.last_name} {patient.first_name} {patient.middle_name || ""}</h1>
          <div className="flex items-center gap-3 mt-1">
            {patient.medical_card && <span className="text-xs font-mono text-[var(--color-text-tertiary)]">Карта {patient.medical_card.card_number}</span>}
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[patient.status] || ""}`}>{statusLabels[patient.status] || patient.status}</span>
          </div>
        </div>
      </div>

      {/* Allergy banner */}
      {patient.allergies && patient.allergies.length > 0 && (
        <div className="mb-4 p-3 rounded-xl bg-destructive/10 border border-destructive/20 flex items-center gap-3 animate-float-up" style={{ animationDelay: '80ms' }}>
          <svg className="w-5 h-5 text-destructive flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
          <p className="text-sm text-destructive"><strong>Аллергии:</strong> {patient.allergies.join(", ")}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-[var(--color-muted)] rounded-xl mb-6 overflow-x-auto animate-float-up" style={{ animationDelay: '100ms' }}>
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
              tab === t.key ? "bg-[var(--color-surface)] text-foreground shadow-sm" : "text-[var(--color-text-secondary)] hover:text-foreground"
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="animate-float-up" style={{ animationDelay: '150ms' }}>
        {/* Profile tab */}
        {tab === "profile" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-6">
              <h3 className="text-sm font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-4">Личные данные</h3>
              <div className="space-y-3">
                {[
                  { label: "Дата рождения", value: formatDate(patient.date_of_birth) },
                  { label: "Пол", value: patient.gender === "MALE" ? "Мужской" : patient.gender === "FEMALE" ? "Женский" : "Не указан" },
                  { label: "Паспорт", value: patient.passport_number || "—" },
                  { label: "ИНН", value: patient.inn || "—" },
                  { label: "Адрес", value: patient.address || "—" },
                  { label: "Телефон", value: patient.phone || "—" },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between">
                    <span className="text-sm text-[var(--color-text-secondary)]">{label}</span>
                    <span className="text-sm font-medium text-foreground">{value}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-6">
              <h3 className="text-sm font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-4">Медицинская информация</h3>
              <div className="space-y-3">
                <div className="flex justify-between"><span className="text-sm text-[var(--color-text-secondary)]">Группа крови</span><span className="text-sm font-medium text-foreground">{patient.blood_type}</span></div>
                <div className="flex justify-between"><span className="text-sm text-[var(--color-text-secondary)]">Страховка</span><span className="text-sm font-medium text-foreground">{patient.insurance_provider || "—"}</span></div>
                <div className="flex justify-between"><span className="text-sm text-[var(--color-text-secondary)]">Полис</span><span className="text-sm font-medium text-foreground">{patient.insurance_number || "—"}</span></div>
                <div><span className="text-sm text-[var(--color-text-secondary)]">Хронические заболевания</span>
                  <div className="flex flex-wrap gap-1 mt-1">{(patient.chronic_conditions || []).map((c: string, i: number) => <span key={i} className="px-2 py-0.5 bg-warning/10 text-warning text-xs rounded-full">{c}</span>)}</div>
                </div>
                <div><span className="text-sm text-[var(--color-text-secondary)]">Экстренный контакт</span>
                  <p className="text-sm font-medium text-foreground mt-0.5">{patient.emergency_contact_name || "—"} {patient.emergency_contact_phone ? `· ${patient.emergency_contact_phone}` : ""}</p>
                </div>
              </div>
            </div>

            {/* Assigned staff section */}
            {(patient.assigned_doctor_id || patient.assigned_nurse_id) && (
              <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-6 lg:col-span-2">
                <h3 className="text-sm font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-4">Закреплённый персонал</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Doctor card */}
                  {patient.assigned_doctor_id && (
                    <Link
                      to="/staff/$staffId"
                      params={{ staffId: doctorData?.id || patient.assigned_doctor_id }}
                      search={{ tab: "profile" }}
                      className="flex items-center gap-3 p-3 rounded-xl border border-border hover:border-secondary/30 transition-all"
                    >
                      <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-success" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                          <circle cx="12" cy="7" r="4"/>
                          <path d="M12 11v4M10 13h4"/>
                        </svg>
                      </div>
                      <div className="min-w-0">
                        {doctorData ? (
                          <>
                            <p className="text-sm font-medium text-foreground truncate">{doctorData.last_name} {doctorData.first_name}</p>
                            <p className="text-xs text-[var(--color-text-tertiary)]">{doctorData.specialization || "Врач"}</p>
                          </>
                        ) : (
                          <>
                            <p className="text-sm font-medium text-foreground">Лечащий врач</p>
                            <p className="text-xs text-[var(--color-text-tertiary)] font-mono">{patient.assigned_doctor_id}</p>
                          </>
                        )}
                      </div>
                    </Link>
                  )}

                  {/* Nurse card */}
                  {patient.assigned_nurse_id && (
                    <Link
                      to="/staff/$staffId"
                      params={{ staffId: nurseData?.id || patient.assigned_nurse_id }}
                      search={{ tab: "profile" }}
                      className="flex items-center gap-3 p-3 rounded-xl border border-border hover:border-secondary/30 transition-all"
                    >
                      <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                          <circle cx="12" cy="7" r="4"/>
                          <path d="M12 3v4M10 5h4"/>
                        </svg>
                      </div>
                      <div className="min-w-0">
                        {nurseData ? (
                          <>
                            <p className="text-sm font-medium text-foreground truncate">{nurseData.last_name} {nurseData.first_name}</p>
                            <p className="text-xs text-[var(--color-text-tertiary)]">{nurseData.specialization || "Медсестра"}</p>
                          </>
                        ) : (
                          <>
                            <p className="text-sm font-medium text-foreground">Медсестра</p>
                            <p className="text-xs text-[var(--color-text-tertiary)] font-mono">{patient.assigned_nurse_id}</p>
                          </>
                        )}
                      </div>
                    </Link>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Vitals tab */}
        {tab === "vitals" && (
          <div className="bg-[var(--color-surface)] rounded-2xl border border-border overflow-hidden">
            {(vitals || []).length === 0 ? (
              <div className="p-8 text-center"><p className="text-[var(--color-text-secondary)]">Нет записей показателей</p></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border">
                    {["Дата", "АД", "Пульс", "Темп.", "SpO2", "Вес", "ЧДД", "Глюкоза"].map(h => <th key={h} className="text-left p-3 text-xs font-semibold text-[var(--color-text-tertiary)] uppercase">{h}</th>)}
                  </tr></thead>
                  <tbody className="divide-y divide-border">
                    {(vitals as Array<Record<string, any>>).map((v: Record<string, any>, i: number) => (
                      <tr key={i} className="hover:bg-[var(--color-muted)]/50">
                        <td className="p-3 font-mono text-xs">{formatDateTime(v.recorded_at)}</td>
                        <td className="p-3">{v.systolic_bp && v.diastolic_bp ? `${v.systolic_bp}/${v.diastolic_bp}` : "—"}</td>
                        <td className="p-3">{v.pulse ?? "—"}</td>
                        <td className="p-3">{v.temperature ?? "—"}</td>
                        <td className="p-3">{v.spo2 ?? "—"}</td>
                        <td className="p-3">{v.weight ?? "—"}</td>
                        <td className="p-3">{v.respiratory_rate ?? "—"}</td>
                        <td className="p-3">{v.blood_glucose ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Lab Results tab with approve button */}
        {tab === "results" && (
          <div className="bg-[var(--color-surface)] rounded-2xl border border-border divide-y divide-border">
            {(labResults || []).length === 0 ? (
              <div className="p-8 text-center"><p className="text-[var(--color-text-secondary)]">Нет результатов анализов</p></div>
            ) : (labResults as Array<Record<string, any>>).map((r: Record<string, any>) => (
              <div key={r.id} className="flex items-center gap-4 p-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${r.is_abnormal ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-[var(--color-primary-deep)]"}`}>
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14 2v6a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V2"/><path d="M10 2v3.3a4 4 0 0 1-1.17 2.83L4 13v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6l-4.83-4.87A4 4 0 0 1 14 5.3V2"/></svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{r.test_name}</p>
                  <p className="text-xs text-[var(--color-text-tertiary)]">{r.test_code} · {formatDateTime(r.resulted_at)}</p>
                </div>
                <div className="text-right mr-4">
                  <p className={`text-sm font-bold ${r.is_abnormal ? "text-destructive" : "text-foreground"}`}>{r.value} {r.unit || ""}</p>
                  {r.reference_range && <p className="text-[10px] text-[var(--color-text-tertiary)]">Норма: {r.reference_range}</p>}
                </div>
                {/* Approve/hide button */}
                <button
                  onClick={() => approveMutation.mutate({ resultId: r.id, visible: !r.visible_to_patient })}
                  disabled={approveMutation.isPending}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${r.visible_to_patient ? "bg-success/10 text-success hover:bg-destructive/10 hover:text-destructive" : "bg-secondary/10 text-secondary hover:bg-secondary/20"}`}>
                  {r.visible_to_patient ? "Скрыть" : "Открыть пациенту"}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Treatment Plans tab */}
        {tab === "treatment" && (
          <div className="space-y-4">
            {(plans || []).length === 0 ? (
              <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-8 text-center"><p className="text-[var(--color-text-secondary)]">Нет планов лечения</p></div>
            ) : (plans as Array<Record<string, any>>).map((p: Record<string, any>) => (
              <div key={p.id} className="bg-[var(--color-surface)] rounded-2xl border border-border p-5">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-foreground">{p.title}</h3>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.status === "ACTIVE" ? "bg-success/10 text-success" : p.status === "DRAFT" ? "bg-warning/10 text-warning" : "bg-[var(--color-muted)] text-[var(--color-text-secondary)]"}`}>
                    {p.status === "ACTIVE" ? "Активный" : p.status === "DRAFT" ? "Черновик" : p.status === "COMPLETED" ? "Завершён" : p.status}
                  </span>
                </div>
                {p.description && <p className="text-xs text-[var(--color-text-tertiary)] mb-2">{p.description}</p>}
                <p className="text-xs text-[var(--color-text-tertiary)]">{formatDate(p.start_date)} {p.end_date ? `→ ${formatDate(p.end_date)}` : ""}</p>
              </div>
            ))}
          </div>
        )}

        {/* Exercise Sessions tab */}
        {tab === "exercises" && (
          <div className="bg-[var(--color-surface)] rounded-2xl border border-border overflow-hidden">
            {(exerciseSessions || []).length === 0 ? (
              <div className="p-8 text-center"><p className="text-[var(--color-text-secondary)]">Пациент ещё не выполнял упражнения</p></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border">
                    {["Дата", "Повторения", "Подходы", "Точность", "Длительность"].map(h => <th key={h} className="text-left p-3 text-xs font-semibold text-[var(--color-text-tertiary)] uppercase">{h}</th>)}
                  </tr></thead>
                  <tbody className="divide-y divide-border">
                    {(exerciseSessions as Array<Record<string, any>>).map((s: Record<string, any>) => (
                      <tr key={s.id} className="hover:bg-[var(--color-muted)]/50">
                        <td className="p-3 font-mono text-xs">{formatDateTime(s.started_at)}</td>
                        <td className="p-3">{s.reps_completed}</td>
                        <td className="p-3">{s.sets_completed}</td>
                        <td className="p-3"><span className={`font-medium ${s.accuracy_score >= 0.8 ? "text-success" : s.accuracy_score >= 0.5 ? "text-warning" : "text-destructive"}`}>{Math.round(s.accuracy_score * 100)}%</span></td>
                        <td className="p-3">{Math.floor(s.duration_seconds / 60)} мин {s.duration_seconds % 60} сек</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Visits tab */}
        {tab === "visits" && (
          <div className="bg-[var(--color-surface)] rounded-2xl border border-border divide-y divide-border">
            {(visits || []).length === 0 ? (
              <div className="p-8 text-center"><p className="text-[var(--color-text-secondary)]">Нет визитов</p></div>
            ) : (visits as Array<Record<string, any>>).map((v: Record<string, any>) => (
              <div key={v.id} className="p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-foreground">{v.visit_type === "CONSULTATION" ? "Консультация" : v.visit_type === "FOLLOW_UP" ? "Повторный" : v.visit_type}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs ${v.status === "COMPLETED" ? "bg-success/10 text-success" : "bg-secondary/10 text-secondary"}`}>{v.status === "COMPLETED" ? "Завершён" : v.status}</span>
                </div>
                {v.chief_complaint && <p className="text-sm text-[var(--color-text-secondary)]">{v.chief_complaint}</p>}
                {v.diagnosis_text && <p className="text-xs text-[var(--color-text-tertiary)] mt-1">Диагноз: {v.diagnosis_text}</p>}
                <p className="text-xs text-[var(--color-text-tertiary)] mt-1">{v.started_at ? formatDateTime(v.started_at) : "—"}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

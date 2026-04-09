import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { patientsApi } from "@/features/patients/api";
import { toast } from "sonner";
import { InputField } from "@/components/ui/input-field";
import { CustomSelect } from "@/components/ui/select-custom";
import { TextareaField } from "@/components/ui/textarea-field";
import { TagInput } from "@/components/ui/tag-input";
import { DatePicker } from "@/components/ui/date-picker";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/patients/new")({
  component: NewPatientPage,
});

// ─── Static option lists ────────────────────────────────────────────────────

const genderOptions = [
  { value: "MALE", label: "Мужской" },
  { value: "FEMALE", label: "Женский" },
  { value: "OTHER", label: "Не указан" },
];

const citizenshipOptions = [
  { value: "KG", label: "Кыргызстан" },
  { value: "RU", label: "Россия" },
  { value: "KZ", label: "Казахстан" },
  { value: "UZ", label: "Узбекистан" },
  { value: "TJ", label: "Таджикистан" },
  { value: "UA", label: "Украина" },
  { value: "BY", label: "Беларусь" },
  { value: "AZ", label: "Азербайджан" },
  { value: "GE", label: "Грузия" },
  { value: "TR", label: "Турция" },
  { value: "CN", label: "Китай" },
];

const bloodTypeOptions = [
  { value: "UNKNOWN", label: "Не указана" },
  { value: "A_POS", label: "A+" },
  { value: "A_NEG", label: "A−" },
  { value: "B_POS", label: "B+" },
  { value: "B_NEG", label: "B−" },
  { value: "AB_POS", label: "AB+" },
  { value: "AB_NEG", label: "AB−" },
  { value: "O_POS", label: "O+" },
  { value: "O_NEG", label: "O−" },
];

const disabilityOptions = [
  { value: "NONE", label: "Нет" },
  { value: "GROUP_1", label: "I группа" },
  { value: "GROUP_2", label: "II группа" },
  { value: "GROUP_3", label: "III группа" },
];

const emergencyRelationOptions = [
  { value: "SPOUSE", label: "Супруг/а" },
  { value: "PARENT", label: "Родитель" },
  { value: "CHILD", label: "Ребёнок" },
  { value: "SIBLING", label: "Брат/сестра" },
  { value: "OTHER", label: "Другое" },
];

const referralSourceOptions = [
  { value: "AMBULANCE", label: "Скорая помощь" },
  { value: "CLINIC", label: "Поликлиника" },
  { value: "SELF", label: "Самообращение" },
  { value: "TRANSFER", label: "Перевод" },
];

const today = new Date().toISOString().split("T")[0];

// ─── Section header component ────────────────────────────────────────────────

function SectionHeader({ num, title, completed }: { num: number; title: string; completed?: boolean }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div
        className={cn(
          "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all",
          completed
            ? "bg-[var(--color-primary-deep)] text-white"
            : "bg-secondary/10 text-secondary",
        )}
      >
        {completed ? (
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 13l4 4L19 7" />
          </svg>
        ) : num}
      </div>
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
    </div>
  );
}

// ─── Progress indicator ───────────────────────────────────────────────────────

const SECTION_LABELS = [
  "Паспорт",
  "Личные данные",
  "Контакты",
  "Медицина",
  "Страховка",
  "Госпитализация",
  "Персонал",
];

function ProgressIndicator({ current, completed }: { current: number; completed: number[] }) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {SECTION_LABELS.map((label, i) => {
        const idx = i + 1;
        const isDone = completed.includes(idx);
        const isCurrent = current === idx;
        return (
          <div key={idx} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all duration-300",
                  isDone
                    ? "bg-[var(--color-primary-deep)] border-[var(--color-primary-deep)] text-white"
                    : isCurrent
                    ? "bg-secondary border-secondary text-white shadow-[0_0_0_4px_rgba(126,120,210,0.2)]"
                    : "bg-[var(--color-surface)] border-border text-[var(--color-text-tertiary)]",
                )}
              >
                {isDone ? (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                ) : idx}
              </div>
              <span className={cn(
                "text-[10px] font-medium whitespace-nowrap hidden sm:block",
                isCurrent ? "text-secondary" : isDone ? "text-[var(--color-primary-deep)]" : "text-[var(--color-text-tertiary)]",
              )}>
                {label}
              </span>
            </div>
            {i < SECTION_LABELS.length - 1 && (
              <div className={cn(
                "flex-1 h-0.5 mx-1 transition-all duration-500",
                isDone ? "bg-[var(--color-primary-deep)]" : "bg-border",
              )} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Emergency registration modal ────────────────────────────────────────────

function EmergencyModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: (id: string) => void }) {
  const [data, setData] = useState({ last_name: "", first_name: "", phone: "", initial_diagnosis: "" });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await patientsApi.emergencyRegistration(data as unknown as Record<string, unknown>);
      toast.success("Экстренная регистрация выполнена");
      onSuccess(result.id || result.patient_id || "");
    } catch {
      toast.error("Ошибка экстренной регистрации");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[var(--color-surface)] rounded-2xl border border-border p-6 w-full max-w-md shadow-2xl animate-scale-in">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-xl bg-destructive/10 flex items-center justify-center">
            <svg className="w-5 h-5 text-destructive" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Экстренная регистрация</h3>
            <p className="text-xs text-[var(--color-text-tertiary)]">Минимальные данные для срочного приёма</p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <InputField label="Фамилия *" required value={data.last_name} onChange={e => setData(d => ({ ...d, last_name: e.target.value }))} />
            <InputField label="Имя *" required value={data.first_name} onChange={e => setData(d => ({ ...d, first_name: e.target.value }))} />
          </div>
          <InputField label="Телефон" type="tel" value={data.phone} onChange={e => setData(d => ({ ...d, phone: e.target.value }))} placeholder="+996" />
          <InputField label="Предварительный диагноз" value={data.initial_diagnosis} onChange={e => setData(d => ({ ...d, initial_diagnosis: e.target.value }))} placeholder="Код МКБ-10 или описание" />
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Отмена</Button>
            <Button type="submit" variant="destructive" className="flex-1" loading={loading}>
              Зарегистрировать
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Duplicate warning banner ─────────────────────────────────────────────────

function DuplicateWarning({ patientId, field }: { patientId: string; field: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-warning/8 border border-warning/20 mt-2">
      <svg className="w-4 h-4 text-warning flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
      <p className="text-xs text-warning flex-1">
        Пациент с таким {field} уже существует.{" "}
        <a href={`/patients/${patientId}`} className="underline font-semibold hover:opacity-80">
          Открыть карту пациента →
        </a>
      </p>
    </div>
  );
}

// ─── AI Camera Panel ──────────────────────────────────────────────────────────

interface DetectedFace {
  id: string;
  thumbnail_url: string;
  detected_at: string;
}

function AICameraPanel({
  selectedFaceId,
  onSelectFace,
}: {
  selectedFaceId: string | null;
  onSelectFace: (id: string | null) => void;
}) {
  const { data: faces = [] } = useQuery<DetectedFace[]>({
    queryKey: ["detected-faces"],
    queryFn: () => patientsApi.getDetectedFaces("current"),
    refetchInterval: 10000,
    retry: false,
  });

  const formatTimeAgo = (iso: string) => {
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (diff < 60) return `${diff}с назад`;
    if (diff < 3600) return `${Math.floor(diff / 60)}м назад`;
    return `${Math.floor(diff / 3600)}ч назад`;
  };

  return (
    <div className="sticky top-6 flex flex-col gap-4">
      {/* Camera panel card */}
      <div className="bg-[var(--color-surface)] rounded-2xl border border-border overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-secondary/10 flex items-center justify-center">
              <svg className="w-4 h-4 text-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Обнаружены в клинике</p>
              <p className="text-[11px] text-[var(--color-text-tertiary)]">AI-камера входа</p>
            </div>
          </div>
          {faces.length > 0 && (
            <Badge variant="secondary">{faces.length}</Badge>
          )}
        </div>

        {/* Face grid */}
        <div className="p-4">
          {faces.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <div className="w-14 h-14 rounded-2xl bg-[var(--color-muted)] flex items-center justify-center">
                <svg className="w-7 h-7 text-[var(--color-text-tertiary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 1 0-16 0"/>
                  <line x1="4" y1="4" x2="20" y2="20" strokeWidth="2"/>
                </svg>
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-[var(--color-text-secondary)]">Камера не подключена</p>
                <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">Нет обнаруженных лиц</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {faces.map(face => (
                <button
                  key={face.id}
                  type="button"
                  onClick={() => onSelectFace(selectedFaceId === face.id ? null : face.id)}
                  className={cn(
                    "relative group rounded-xl overflow-hidden aspect-square border-2 transition-all",
                    selectedFaceId === face.id
                      ? "border-[var(--color-primary-deep)] shadow-[0_0_0_2px_var(--color-primary-deep)]"
                      : "border-transparent hover:border-secondary/40",
                  )}
                >
                  <img src={face.thumbnail_url} alt="Detected" className="w-full h-full object-cover" />
                  {selectedFaceId === face.id && (
                    <div className="absolute inset-0 bg-[var(--color-primary-deep)]/20 flex items-center justify-center">
                      <div className="w-5 h-5 rounded-full bg-[var(--color-primary-deep)] flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                          <path d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    </div>
                  )}
                  <div className="absolute bottom-0 inset-x-0 bg-black/50 text-white text-[9px] px-1 py-0.5 text-center opacity-0 group-hover:opacity-100 transition-opacity">
                    {formatTimeAgo(face.detected_at)}
                  </div>
                </button>
              ))}
            </div>
          )}

          {selectedFaceId && (
            <div className="mt-3 px-3 py-2 rounded-lg bg-[var(--color-primary-deep)]/8 border border-[var(--color-primary-deep)]/20 flex items-center gap-2">
              <svg className="w-3.5 h-3.5 text-[var(--color-primary-deep)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-xs font-medium text-[var(--color-primary-deep)]">Фото привязано</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-4 pb-4 flex flex-col gap-2">
          <Button type="button" variant="outline" size="sm" className="w-full justify-center gap-2">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3"/><path d="M20.94 11A9 9 0 1 0 12 21v-2.1"/>
              <circle cx="19" cy="19" r="3"/><path d="M19 16v3h3"/>
            </svg>
            Сделать снимок вручную
          </Button>
          <Button type="button" variant="ghost" size="sm" className="w-full justify-center text-[var(--color-text-tertiary)]">
            Пропустить
          </Button>
        </div>
      </div>

      {/* Quick stats */}
      <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)] mb-3">Советы</p>
        <ul className="space-y-2.5">
          {[
            "Загрузите скан паспорта для автозаполнения",
            "Добавьте аллергии через TagInput",
            "Выберите койку после отделения",
          ].map((tip, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-[var(--color-text-secondary)]">
              <span className="w-4 h-4 rounded-full bg-secondary/10 text-secondary flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">{i + 1}</span>
              {tip}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

function NewPatientPage() {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showEmergency, setShowEmergency] = useState(false);
  const [selectedFaceId, setSelectedFaceId] = useState<string | null>(null);

  // ── OCR state ──────────────────────────────────────────────────────────────
  const [passportFile, setPassportFile] = useState<File | null>(null);
  const [passportPreview, setPassportPreview] = useState<string | null>(null);
  const [ocrStatus, setOcrStatus] = useState<"idle" | "processing" | "success" | "error">("idle");
  const [ocrConfidence, setOcrConfidence] = useState<number>(0);
  const [ocrError, setOcrError] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  // ── Duplicate validation ───────────────────────────────────────────────────
  const [innDuplicate, setInnDuplicate] = useState<string | null>(null);
  const [passportDuplicate, setPassportDuplicate] = useState<string | null>(null);

  // ── Cascading select state ─────────────────────────────────────────────────
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [selectedRoom, setSelectedRoom] = useState("");

  // ── API queries ────────────────────────────────────────────────────────────
  const { data: doctors = [] } = useQuery({
    queryKey: ["doctors-with-load"],
    queryFn: () => patientsApi.getDoctorsWithLoad(),
    retry: false,
  });

  const { data: nurses = [] } = useQuery({
    queryKey: ["nurses"],
    queryFn: () => patientsApi.getNurses(),
    retry: false,
  });

  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: () => patientsApi.getDepartments(),
    retry: false,
  });

  const { data: rooms = [] } = useQuery({
    queryKey: ["rooms", selectedDepartment],
    queryFn: () => patientsApi.getRooms(selectedDepartment),
    enabled: !!selectedDepartment,
    retry: false,
  });

  const { data: beds = [] } = useQuery({
    queryKey: ["beds", selectedRoom],
    queryFn: () => patientsApi.getBeds(selectedRoom),
    enabled: !!selectedRoom,
    retry: false,
  });

  // ── Form state ─────────────────────────────────────────────────────────────
  const [form, setForm] = useState({
    // Section 2
    last_name: "", first_name: "", middle_name: "",
    date_of_birth: "", gender: "MALE", citizenship: "KG",
    passport_series: "", passport_number: "",
    inn: "", address_registered: "", address_actual: "",
    address_same: false,
    // Section 3
    phone: "", phone_secondary: "", email: "",
    emergency_contact_name: "", emergency_contact_phone: "", emergency_contact_relation: "",
    // Section 4
    blood_type: "UNKNOWN",
    allergies: [] as string[],
    chronic_conditions: [] as string[],
    current_medications: [] as string[],
    disability_group: "NONE",
    previous_surgeries: "",
    // Section 5
    foms_series: "", foms_number: "", foms_valid_until: "",
    insurance_company: "", insurance_policy_number: "",
    // Section 6
    admission_type: "PLANNED",
    treatment_form: "INPATIENT",
    admission_date: today,
    referral_source: "",
    department_id: "", room_id: "", bed_id: "",
    initial_diagnosis: "", admission_notes: "",
    // Section 7
    doctor_id: "", nurse_id: "",
  });

  const set = (field: string, value: unknown) => setForm(f => ({ ...f, [field]: value }));
  const upd = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(field, e.target.value);

  // ── OCR handlers ───────────────────────────────────────────────────────────
  const handlePassportFile = useCallback(async (file: File) => {
    setPassportFile(file);
    setPassportPreview(URL.createObjectURL(file));
    setOcrStatus("processing");
    setOcrError("");
    try {
      const result = await patientsApi.ocrPassport(file);
      if (result) {
        if (result.last_name) set("last_name", result.last_name);
        if (result.first_name) set("first_name", result.first_name);
        if (result.middle_name) set("middle_name", result.middle_name);
        if (result.date_of_birth) set("date_of_birth", result.date_of_birth);
        if (result.passport_series) set("passport_series", result.passport_series);
        if (result.passport_number) set("passport_number", result.passport_number);
        if (result.inn) set("inn", result.inn);
        if (result.address) set("address_registered", result.address);
        setOcrConfidence(result.confidence ?? 95);
        setOcrStatus("success");
        toast.success("Данные паспорта распознаны");
      }
    } catch {
      setOcrStatus("error");
      setOcrError("Не удалось распознать паспорт. Попробуйте другое фото.");
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) handlePassportFile(file);
  }, [handlePassportFile]);

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);

  // ── Duplicate validation ───────────────────────────────────────────────────
  const validateInn = async () => {
    if (!form.inn || form.inn.length < 14) return;
    try {
      const result = await patientsApi.validatePatient({ inn: form.inn });
      if (result?.exists) setInnDuplicate(result.patient_id);
      else setInnDuplicate(null);
    } catch { setInnDuplicate(null); }
  };

  const validatePassport = async () => {
    if (!form.passport_number) return;
    try {
      const result = await patientsApi.validatePatient({ passport_number: form.passport_number });
      if (result?.exists) setPassportDuplicate(result.patient_id);
      else setPassportDuplicate(null);
    } catch { setPassportDuplicate(null); }
  };

  // ── Completion checks ──────────────────────────────────────────────────────
  const completedSections: number[] = [];
  if (ocrStatus === "success" || passportFile) completedSections.push(1);
  if (form.last_name && form.first_name && form.date_of_birth) completedSections.push(2);
  if (form.phone) completedSections.push(3);
  if (form.blood_type) completedSections.push(4);
  if (form.foms_number || form.insurance_policy_number) completedSections.push(5);
  if (form.admission_type && form.treatment_form && form.department_id) completedSections.push(6);
  if (form.doctor_id) completedSections.push(7);

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.last_name || !form.first_name) {
      toast.error("Фамилия и имя обязательны");
      return;
    }
    setIsSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        ...form,
        address_actual: form.address_same ? form.address_registered : form.address_actual,
        face_id: selectedFaceId,
      };
      delete (payload as Record<string, unknown>).address_same;
      const result = await patientsApi.create(payload);
      toast.success(`Пациент зарегистрирован. Карта: ${result.card_number}`);
      navigate({ to: "/patients/$patientId", params: { patientId: result.id } });
    } catch {
      toast.error("Ошибка при регистрации пациента");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Doctor options ─────────────────────────────────────────────────────────
  const doctorOptions = (doctors as Array<{ id: string; last_name: string; first_name: string; middle_name?: string; specialization?: string; patient_count?: number }>).map(d => ({
    value: d.id,
    label: `${d.last_name} ${d.first_name[0]}.${d.middle_name ? d.middle_name[0] + "." : ""} — ${d.specialization ?? ""}`,
    description: d.patient_count != null ? `${d.patient_count} пациентов` : undefined,
  }));

  const nurseOptions = (nurses as Array<{ id: string; last_name: string; first_name: string; middle_name?: string }>).map(n => ({
    value: n.id,
    label: `${n.last_name} ${n.first_name[0]}.${n.middle_name ? n.middle_name[0] + "." : ""}`,
  }));

  const departmentOptions = (departments as Array<{ id: string; name: string }>).map(d => ({ value: d.id, label: d.name }));
  const roomOptions = (rooms as Array<{ id: string; number: string; name?: string }>).map(r => ({ value: r.id, label: r.name ?? `Палата ${r.number}` }));
  const bedOptions = (beds as Array<{ id: string; number: string }>).map(b => ({ value: b.id, label: `Койка ${b.number}` }));

  // ── Admission / treatment radio cards ─────────────────────────────────────
  const admissionTypes = [
    { value: "PLANNED", label: "Плановое", icon: "🗓️", desc: "По направлению" },
    { value: "EMERGENCY", label: "Экстренное", icon: "🚨", desc: "Срочная помощь" },
    { value: "TRANSFER", label: "Переводом", icon: "🔄", desc: "Из другого учреждения" },
  ];

  const treatmentForms = [
    { value: "INPATIENT", label: "Стационар", icon: "🏥", desc: "Круглосуточно" },
    { value: "OUTPATIENT", label: "Амбулатория", icon: "🩺", desc: "Без госпитализации" },
    { value: "DAY", label: "Дневной стационар", icon: "☀️", desc: "Дневное пребывание" },
  ];

  return (
    <div>
      {/* Emergency modal */}
      {showEmergency && (
        <EmergencyModal
          onClose={() => setShowEmergency(false)}
          onSuccess={(id) => { setShowEmergency(false); if (id) navigate({ to: "/patients/$patientId", params: { patientId: id } }); }}
        />
      )}

      {/* Top bar */}
      <div className="flex items-center justify-between mb-6 animate-float-up" style={{ opacity: 0 }}>
        <div className="flex items-center gap-3">
          <a href="/patients" className="flex items-center gap-1.5 text-sm text-[var(--color-text-secondary)] hover:text-foreground transition-colors">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
            К списку
          </a>
          <span className="text-[var(--color-text-tertiary)]">/</span>
          <h1 className="text-lg font-bold text-foreground tracking-tight">Регистрация пациента</h1>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-destructive/30 text-destructive hover:bg-destructive/5 hover:border-destructive/50"
          onClick={() => setShowEmergency(true)}
          icon={
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
            </svg>
          }
        >
          Экстренная регистрация
        </Button>
      </div>

      {/* Progress */}
      <div className="animate-float-up" style={{ animationDelay: "50ms", opacity: 0 }}>
        <ProgressIndicator current={completedSections.length + 1} completed={completedSections} />
      </div>

      {/* Two-column layout */}
      <form onSubmit={handleSubmit}>
        <div className="flex gap-6 items-start">
          {/* Left column — 70% */}
          <div className="flex-1 min-w-0 space-y-5">

            {/* ── Section 1: Паспорт и OCR ─────────────────────────────── */}
            <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-6 animate-float-up" style={{ animationDelay: "100ms", opacity: 0 }}>
              <SectionHeader num={1} title="Паспорт и OCR" completed={completedSections.includes(1)} />

              {!passportFile ? (
                <div
                  ref={dropRef}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  className={cn(
                    "border-2 border-dashed rounded-xl p-10 text-center transition-all duration-200 cursor-pointer select-none",
                    isDragging
                      ? "border-secondary bg-secondary/5 scale-[1.01]"
                      : "border-border hover:border-secondary/40 hover:bg-[var(--color-muted)]/30",
                  )}
                  onClick={() => {
                    const input = document.createElement("input");
                    input.type = "file";
                    input.accept = "image/*";
                    input.onchange = (e) => {
                      const file = (e.target as HTMLInputElement).files?.[0];
                      if (file) handlePassportFile(file);
                    };
                    input.click();
                  }}
                >
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-14 h-14 rounded-2xl bg-secondary/10 flex items-center justify-center">
                      <svg className="w-7 h-7 text-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <rect x="3" y="4" width="18" height="16" rx="2"/><line x1="7" y1="9" x2="17" y2="9"/>
                        <line x1="7" y1="13" x2="13" y2="13"/><circle cx="17" cy="15" r="2"/>
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">Перетащите скан паспорта</p>
                      <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">или нажмите для выбора файла · JPG, PNG, PDF</p>
                    </div>
                    <Badge variant="secondary">AI автозаполнение</Badge>
                  </div>
                </div>
              ) : (
                <div className="flex gap-5">
                  {/* Preview */}
                  <div className="w-40 flex-shrink-0">
                    <img
                      src={passportPreview!}
                      alt="Паспорт"
                      className="w-full rounded-xl border border-border object-cover aspect-[3/4]"
                    />
                  </div>
                  {/* Status */}
                  <div className="flex-1 flex flex-col gap-3">
                    {ocrStatus === "processing" && (
                      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-secondary/8 border border-secondary/20">
                        <svg className="w-4 h-4 text-secondary animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                        </svg>
                        <span className="text-sm font-medium text-secondary">Распознавание данных...</span>
                      </div>
                    )}
                    {ocrStatus === "success" && (
                      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-success/8 border border-success/20">
                        <svg className="w-4 h-4 text-success" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                          <path d="M5 13l4 4L19 7"/>
                        </svg>
                        <span className="text-sm font-medium text-success">
                          Распознано успешно · точность {ocrConfidence}%
                        </span>
                      </div>
                    )}
                    {ocrStatus === "error" && (
                      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-destructive/8 border border-destructive/20">
                        <svg className="w-4 h-4 text-destructive" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                        </svg>
                        <span className="text-sm text-destructive">{ocrError}</span>
                      </div>
                    )}
                    <p className="text-xs text-[var(--color-text-tertiary)]">
                      Файл: <span className="font-medium text-[var(--color-text-secondary)]">{passportFile.name}</span>
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-fit"
                      onClick={() => {
                        setPassportFile(null);
                        setPassportPreview(null);
                        setOcrStatus("idle");
                        setOcrError("");
                      }}
                    >
                      Очистить и загрузить снова
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* ── Section 2: Личные данные ──────────────────────────────── */}
            <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-6 animate-float-up" style={{ animationDelay: "150ms", opacity: 0 }}>
              <SectionHeader num={2} title="Личные данные" completed={completedSections.includes(2)} />

              <div className="grid grid-cols-3 gap-4">
                <InputField label="Фамилия *" required value={form.last_name} onChange={upd("last_name")} />
                <InputField label="Имя *" required value={form.first_name} onChange={upd("first_name")} />
                <InputField label="Отчество" value={form.middle_name} onChange={upd("middle_name")} />
              </div>

              <div className="grid grid-cols-3 gap-4 mt-4">
                <DatePicker label="Дата рождения *" required value={form.date_of_birth} onChange={v => set("date_of_birth", v)} />
                <CustomSelect label="Пол" value={form.gender} onChange={v => set("gender", v)} options={genderOptions} />
                <CustomSelect label="Гражданство" value={form.citizenship} onChange={v => set("citizenship", v)} options={citizenshipOptions} />
              </div>

              <div className="grid grid-cols-2 gap-4 mt-4">
                <InputField
                  label="Серия паспорта"
                  value={form.passport_series}
                  onChange={upd("passport_series")}
                  placeholder="AN"
                  maxLength={4}
                />
                <InputField
                  label="Номер паспорта"
                  value={form.passport_number}
                  onChange={upd("passport_number")}
                  onBlur={validatePassport}
                  placeholder="1234567"
                  maxLength={10}
                />
              </div>
              {passportDuplicate && <DuplicateWarning patientId={passportDuplicate} field="номером паспорта" />}

              <div className="mt-4">
                <InputField
                  label="ИНН"
                  value={form.inn}
                  onChange={upd("inn")}
                  onBlur={validateInn}
                  placeholder="14 цифр"
                  maxLength={14}
                />
                {innDuplicate && <DuplicateWarning patientId={innDuplicate} field="ИНН" />}
              </div>

              <div className="mt-4">
                <TextareaField
                  label="Адрес регистрации"
                  value={form.address_registered}
                  onChange={upd("address_registered")}
                  rows={2}
                  placeholder="Область, город, улица, дом, квартира"
                />
              </div>

              <div className="mt-4">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[13px] font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                    Адрес фактического проживания
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={form.address_same}
                      onChange={e => set("address_same", e.target.checked)}
                      className="w-3.5 h-3.5 accent-[var(--color-secondary)] cursor-pointer"
                    />
                    <span className="text-xs text-[var(--color-text-secondary)]">Совпадает с адресом регистрации</span>
                  </label>
                </div>
                <TextareaField
                  value={form.address_same ? form.address_registered : form.address_actual}
                  onChange={upd("address_actual")}
                  rows={2}
                  placeholder="Оставьте пустым если совпадает"
                  disabled={form.address_same}
                />
              </div>
            </div>

            {/* ── Section 3: Контакты ───────────────────────────────────── */}
            <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-6 animate-float-up" style={{ animationDelay: "200ms", opacity: 0 }}>
              <SectionHeader num={3} title="Контакты" completed={completedSections.includes(3)} />

              <div className="grid grid-cols-2 gap-4">
                <InputField label="Телефон *" type="tel" value={form.phone} onChange={upd("phone")} placeholder="+996 555 000 000" />
                <InputField label="Доп. телефон" type="tel" value={form.phone_secondary} onChange={upd("phone_secondary")} placeholder="+996" />
              </div>
              <div className="mt-4">
                <InputField label="Email" type="email" value={form.email} onChange={upd("email")} placeholder="patient@example.com" />
              </div>

              <div className="mt-5 pt-5 border-t border-border">
                <p className="text-[13px] font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)] mb-3">Экстренный контакт</p>
                <div className="grid grid-cols-3 gap-4">
                  <InputField label="ФИО контакта" value={form.emergency_contact_name} onChange={upd("emergency_contact_name")} />
                  <InputField label="Телефон" type="tel" value={form.emergency_contact_phone} onChange={upd("emergency_contact_phone")} placeholder="+996" />
                  <CustomSelect label="Степень родства" value={form.emergency_contact_relation} onChange={v => set("emergency_contact_relation", v)} options={emergencyRelationOptions} />
                </div>
              </div>
            </div>

            {/* ── Section 4: Медицинская информация ────────────────────── */}
            <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-6 animate-float-up" style={{ animationDelay: "250ms", opacity: 0 }}>
              <SectionHeader num={4} title="Медицинская информация" completed={completedSections.includes(4)} />

              <div className="grid grid-cols-2 gap-4">
                <CustomSelect label="Группа крови" value={form.blood_type} onChange={v => set("blood_type", v)} options={bloodTypeOptions} />
                <CustomSelect label="Группа инвалидности" value={form.disability_group} onChange={v => set("disability_group", v)} options={disabilityOptions} />
              </div>

              <div className="mt-4 space-y-4">
                <TagInput
                  label="Аллергии"
                  tags={form.allergies}
                  onAdd={tag => set("allergies", [...form.allergies, tag])}
                  onRemove={i => set("allergies", form.allergies.filter((_, j) => j !== i))}
                  placeholder="Добавить аллергию"
                  tagColor="destructive"
                />
                <TagInput
                  label="Хронические заболевания"
                  tags={form.chronic_conditions}
                  onAdd={tag => set("chronic_conditions", [...form.chronic_conditions, tag])}
                  onRemove={i => set("chronic_conditions", form.chronic_conditions.filter((_, j) => j !== i))}
                  placeholder="Добавить заболевание"
                  tagColor="warning"
                />
                <TagInput
                  label="Текущие препараты"
                  tags={form.current_medications}
                  onAdd={tag => set("current_medications", [...form.current_medications, tag])}
                  onRemove={i => set("current_medications", form.current_medications.filter((_, j) => j !== i))}
                  placeholder="Добавить препарат"
                  tagColor="secondary"
                />
              </div>

              <div className="mt-4">
                <TextareaField
                  label="Перенесённые операции"
                  value={form.previous_surgeries}
                  onChange={upd("previous_surgeries")}
                  rows={3}
                  placeholder="Опишите перенесённые хирургические вмешательства..."
                />
              </div>
            </div>

            {/* ── Section 5: Страховка ──────────────────────────────────── */}
            <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-6 animate-float-up" style={{ animationDelay: "300ms", opacity: 0 }}>
              <SectionHeader num={5} title="Страховка" completed={completedSections.includes(5)} />

              <div className="mb-4">
                <p className="text-[13px] font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)] mb-3">Полис ФОМС</p>
                <div className="grid grid-cols-3 gap-4">
                  <InputField label="Серия ФОМС" value={form.foms_series} onChange={upd("foms_series")} placeholder="Серия" />
                  <InputField label="Номер ФОМС" value={form.foms_number} onChange={upd("foms_number")} placeholder="Номер полиса" />
                  <DatePicker label="Действителен до" value={form.foms_valid_until} onChange={v => set("foms_valid_until", v)} />
                </div>
              </div>

              <div className="pt-4 border-t border-border">
                <p className="text-[13px] font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)] mb-3">Коммерческая страховка</p>
                <div className="grid grid-cols-2 gap-4">
                  <InputField label="Страховая компания" value={form.insurance_company} onChange={upd("insurance_company")} />
                  <InputField label="Номер полиса" value={form.insurance_policy_number} onChange={upd("insurance_policy_number")} />
                </div>
              </div>
            </div>

            {/* ── Section 6: Госпитализация ─────────────────────────────── */}
            <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-6 animate-float-up" style={{ animationDelay: "350ms", opacity: 0 }}>
              <SectionHeader num={6} title="Госпитализация" completed={completedSections.includes(6)} />

              {/* Admission type radio cards */}
              <div className="mb-5">
                <p className="text-[13px] font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)] mb-2.5">Тип поступления</p>
                <div className="grid grid-cols-3 gap-3">
                  {admissionTypes.map(at => (
                    <button
                      key={at.value}
                      type="button"
                      onClick={() => set("admission_type", at.value)}
                      className={cn(
                        "flex flex-col items-center gap-1.5 p-3.5 rounded-xl border-2 transition-all text-center",
                        form.admission_type === at.value
                          ? "border-secondary bg-secondary/8 shadow-[0_0_0_3px_rgba(126,120,210,0.12)]"
                          : "border-border hover:border-secondary/30 hover:bg-[var(--color-muted)]/30",
                      )}
                    >
                      <span className="text-2xl">{at.icon}</span>
                      <p className={cn("text-sm font-semibold", form.admission_type === at.value ? "text-secondary" : "text-foreground")}>{at.label}</p>
                      <p className="text-[11px] text-[var(--color-text-tertiary)]">{at.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Treatment form radio cards */}
              <div className="mb-5">
                <p className="text-[13px] font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)] mb-2.5">Форма лечения</p>
                <div className="grid grid-cols-3 gap-3">
                  {treatmentForms.map(tf => (
                    <button
                      key={tf.value}
                      type="button"
                      onClick={() => set("treatment_form", tf.value)}
                      className={cn(
                        "flex flex-col items-center gap-1.5 p-3.5 rounded-xl border-2 transition-all text-center",
                        form.treatment_form === tf.value
                          ? "border-[var(--color-primary-deep)] bg-[var(--color-primary-deep)]/8 shadow-[0_0_0_3px_rgba(126,205,184,0.15)]"
                          : "border-border hover:border-[var(--color-primary-deep)]/30 hover:bg-[var(--color-muted)]/30",
                      )}
                    >
                      <span className="text-2xl">{tf.icon}</span>
                      <p className={cn("text-sm font-semibold", form.treatment_form === tf.value ? "text-[var(--color-primary-deep)]" : "text-foreground")}>{tf.label}</p>
                      <p className="text-[11px] text-[var(--color-text-tertiary)]">{tf.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <DatePicker label="Дата поступления" value={form.admission_date} onChange={v => set("admission_date", v)} />
                <CustomSelect label="Источник направления" value={form.referral_source} onChange={v => set("referral_source", v)} options={referralSourceOptions} />
              </div>

              <div className="grid grid-cols-3 gap-4 mt-4">
                <CustomSelect
                  label="Отделение *"
                  value={form.department_id}
                  onChange={v => {
                    set("department_id", v);
                    setSelectedDepartment(v);
                    set("room_id", "");
                    set("bed_id", "");
                    setSelectedRoom("");
                  }}
                  options={departmentOptions}
                  placeholder="Выберите отделение"
                />
                <CustomSelect
                  label="Палата"
                  value={form.room_id}
                  onChange={v => {
                    set("room_id", v);
                    setSelectedRoom(v);
                    set("bed_id", "");
                  }}
                  options={roomOptions}
                  placeholder={selectedDepartment ? "Выберите палату" : "Сначала выберите отделение"}
                  disabled={!selectedDepartment}
                />
                <CustomSelect
                  label="Койка"
                  value={form.bed_id}
                  onChange={v => set("bed_id", v)}
                  options={bedOptions}
                  placeholder={selectedRoom ? "Выберите койку" : "Сначала выберите палату"}
                  disabled={!selectedRoom}
                />
              </div>

              <div className="mt-4">
                <InputField
                  label="Предварительный диагноз"
                  value={form.initial_diagnosis}
                  onChange={upd("initial_diagnosis")}
                  placeholder="Код МКБ-10 или название"
                />
              </div>

              <div className="mt-4">
                <TextareaField
                  label="Примечания к поступлению"
                  value={form.admission_notes}
                  onChange={upd("admission_notes")}
                  rows={3}
                  placeholder="Дополнительная информация о поступлении..."
                />
              </div>
            </div>

            {/* ── Section 7: Назначение персонала ──────────────────────── */}
            <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-6 animate-float-up" style={{ animationDelay: "400ms", opacity: 0 }}>
              <SectionHeader num={7} title="Назначение персонала" completed={completedSections.includes(7)} />

              <div className="grid grid-cols-2 gap-4">
                <CustomSelect
                  label="Лечащий врач *"
                  value={form.doctor_id}
                  onChange={v => set("doctor_id", v)}
                  options={doctorOptions}
                  placeholder="Выберите врача"
                />
                <CustomSelect
                  label="Медсестра"
                  value={form.nurse_id}
                  onChange={v => set("nurse_id", v)}
                  options={nurseOptions}
                  placeholder="Выберите медсестру"
                />
              </div>
            </div>

            {/* ── Bottom actions ─────────────────────────────────────────── */}
            <div className="flex items-center justify-between py-4 animate-float-up" style={{ animationDelay: "450ms", opacity: 0 }}>
              <Button type="button" variant="outline" size="lg" onClick={() => navigate({ to: "/patients" })}>
                Отмена
              </Button>
              <Button
                type="submit"
                size="lg"
                loading={isSubmitting}
                className="px-10"
              >
                {isSubmitting ? "Регистрация..." : "Зарегистрировать пациента"}
              </Button>
            </div>
          </div>

          {/* Right column — AI Camera panel (30%) */}
          <div className="w-[280px] flex-shrink-0 animate-float-up" style={{ animationDelay: "200ms", opacity: 0 }}>
            <AICameraPanel selectedFaceId={selectedFaceId} onSelectFace={setSelectedFaceId} />
          </div>
        </div>
      </form>
    </div>
  );
}

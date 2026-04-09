import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { staffApi } from "@/features/staff/api";
import { patientsApi } from "@/features/patients/api";
import { toast } from "sonner";
import { InputField } from "@/components/ui/input-field";
import { CustomSelect } from "@/components/ui/select-custom";
import { DatePicker } from "@/components/ui/date-picker";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/staff/new")({
  component: NewStaffPage,
});

// ─── Constants ────────────────────────────────────────────────────────────────

const STEPS = [
  "Шаблон",
  "Личные данные",
  "Рабочие данные",
  "Квалификация",
  "Аккаунт",
  "Права доступа",
  "Подтверждение",
];

const genderOptions = [
  { value: "MALE", label: "Мужской" },
  { value: "FEMALE", label: "Женский" },
  { value: "OTHER", label: "Не указан" },
];

const employmentTypeOptions = [
  { value: "FULL", label: "Полная занятость" },
  { value: "PART", label: "Частичная занятость" },
  { value: "CONTRACT", label: "Совместитель" },
  { value: "INTERN", label: "Стажёр" },
];

const qualificationTypeOptions = [
  { value: "LICENSE", label: "Лицензия" },
  { value: "CERTIFICATE", label: "Сертификат" },
  { value: "DIPLOMA", label: "Диплом" },
  { value: "OTHER", label: "Другое" },
];

const deliveryMethodOptions = [
  { value: "SMS", label: "SMS" },
  { value: "EMAIL", label: "Email" },
  { value: "SCREEN", label: "На экране" },
];

const today = new Date().toISOString().split("T")[0];
const warnThreshold = 90 * 24 * 60 * 60 * 1000;

// ─── Template color helper ────────────────────────────────────────────────────

function templateBorderColor(name: string): string {
  const colors = [
    "border-secondary",
    "border-success",
    "border-warning",
    "border-primary",
    "border-destructive",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) & 0xffff;
  return colors[hash % colors.length];
}

function templateBgColor(name: string): string {
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

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8 flex-wrap">
      {STEPS.map((label, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <div className="flex flex-col items-center gap-1">
            <div
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all",
                idx < current
                  ? "bg-success text-white"
                  : idx === current
                  ? "bg-secondary text-white shadow-[0_0_0_4px_rgba(126,120,210,0.2)]"
                  : "bg-[var(--color-muted)] text-[var(--color-text-tertiary)]"
              )}
            >
              {idx < current ? (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M5 13l4 4L19 7"/>
                </svg>
              ) : (
                idx + 1
              )}
            </div>
            <span className={cn(
              "text-[10px] font-medium hidden sm:block",
              idx === current ? "text-secondary" : "text-[var(--color-text-tertiary)]"
            )}>
              {label}
            </span>
          </div>
          {idx < STEPS.length - 1 && (
            <div className={cn(
              "w-8 h-0.5 rounded-full mb-4 transition-all",
              idx < current ? "bg-success" : "bg-[var(--color-muted)]"
            )} />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Dynamic extra field renderer ────────────────────────────────────────────

function ExtraFieldInput({
  field,
  value,
  onChange,
}: {
  field: Record<string, any>;
  value: any;
  onChange: (v: any) => void;
}) {
  if (field.type === "select") {
    const options = (field.options || []).map((o: string) => ({ value: o, label: o }));
    return (
      <CustomSelect
        label={field.label}
        value={value || ""}
        onChange={onChange}
        options={options}
        placeholder="Выберите..."
      />
    );
  }

  if (field.type === "multiselect") {
    const options: string[] = field.options || [];
    const selected: string[] = Array.isArray(value) ? value : [];
    return (
      <div>
        {field.label && (
          <label className="block text-[13px] font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)] mb-2">
            {field.label}
          </label>
        )}
        <div className="space-y-1.5">
          {options.map((opt: string) => (
            <label key={opt} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selected.includes(opt)}
                onChange={(e) => {
                  const next = e.target.checked
                    ? [...selected, opt]
                    : selected.filter((s) => s !== opt);
                  onChange(next);
                }}
                className="w-4 h-4 rounded border-border accent-secondary"
              />
              <span className="text-sm text-foreground">{opt}</span>
            </label>
          ))}
        </div>
      </div>
    );
  }

  if (field.type === "boolean") {
    return (
      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={!!value}
          onChange={(e) => onChange(e.target.checked)}
          className="w-4 h-4 rounded border-border accent-secondary"
        />
        {field.label && (
          <span className="text-sm font-medium text-foreground">{field.label}</span>
        )}
      </label>
    );
  }

  if (field.type === "date") {
    return (
      <DatePicker
        label={field.label}
        value={value || ""}
        onChange={onChange}
      />
    );
  }

  return (
    <InputField
      label={field.label}
      type={field.type === "number" ? "number" : "text"}
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder={field.placeholder || ""}
    />
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

function NewStaffPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);

  // Step 1: Template
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [templateDetail, setTemplateDetail] = useState<Record<string, any> | null>(null);

  // Step 2: Personal data
  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState("OTHER");
  const [phonePersonal, setPhonePersonal] = useState("");
  const [emailPersonal, setEmailPersonal] = useState("");

  // Step 3: Work data
  const [position, setPosition] = useState("");
  const [positionLevel, setPositionLevel] = useState("");
  const [specialization, setSpecialization] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [section, setSection] = useState("");
  const [workPhone, setWorkPhone] = useState("");
  const [workEmail, setWorkEmail] = useState("");
  const [officeRoom, setOfficeRoom] = useState("");
  const [workSchedule, setWorkSchedule] = useState("");
  const [employmentType, setEmploymentType] = useState("FULL");
  const [employmentStart, setEmploymentStart] = useState(today);
  const [employmentEnd, setEmploymentEnd] = useState("");
  const [extraFieldValues, setExtraFieldValues] = useState<Record<string, any>>({});

  // Step 4: Qualifications
  const [qualifications, setQualifications] = useState<Array<{
    type: string; label: string; value: string; issued: string; expires: string;
  }>>([]);

  // Step 5: Account
  const [loginType, setLoginType] = useState<"email" | "phone">("email");
  const [loginValue, setLoginValue] = useState("");
  const [autoPassword, setAutoPassword] = useState(true);
  const [mustChangePassword, setMustChangePassword] = useState(true);
  const [activeFrom, setActiveFrom] = useState(today);
  const [activeUntil, setActiveUntil] = useState("");
  const [deliveryMethod, setDeliveryMethod] = useState("SCREEN");

  // Step 6: Permissions
  const [permOverrides, setPermOverrides] = useState<Record<string, boolean>>({});
  const [templatePerms, setTemplatePerms] = useState<Set<string>>(new Set());

  // ─── Queries ──────────────────────────────────────────────────────────────

  const { data: templatesData } = useQuery({
    queryKey: ["staff-templates"],
    queryFn: () => staffApi.listTemplates(),
  });

  const { data: departmentsData } = useQuery({
    queryKey: ["departments"],
    queryFn: () => patientsApi.getDepartments(),
  });

  const { data: permGroupsData } = useQuery({
    queryKey: ["permission-groups"],
    queryFn: () => staffApi.listPermissionGroups(),
    enabled: step === 5,
  });

  const templates: Record<string, any>[] = templatesData?.items || templatesData || [];
  const departments: Record<string, any>[] = departmentsData?.items || departmentsData || [];
  const permGroups: Record<string, any>[] = permGroupsData?.items || permGroupsData || [];

  const departmentOptions = [
    { value: "", label: "Не указан" },
    ...departments.map((d: Record<string, any>) => ({ value: d.id, label: d.name })),
  ];

  // ─── Template selection handler ───────────────────────────────────────────

  const handleSelectTemplate = useCallback(async (tpl: Record<string, any>) => {
    setSelectedTemplateId(tpl.id);
    try {
      const detail = await staffApi.getTemplate(tpl.id);
      setTemplateDetail(detail);
      // Pre-fill permissions from template
      const perms: string[] = detail.permissions?.map((p: Record<string, any>) => p.code || p.permission_code) || [];
      setTemplatePerms(new Set(perms));
      // Reset overrides
      setPermOverrides({});
    } catch {
      setTemplateDetail(tpl);
    }
  }, []);

  // ─── Permission toggle ────────────────────────────────────────────────────

  const togglePerm = useCallback((code: string, fromTemplate: boolean) => {
    setPermOverrides((prev) => {
      const next = { ...prev };
      if (fromTemplate) {
        // Template has it; override to remove or restore
        if (next[code] === false) {
          delete next[code];
        } else {
          next[code] = false;
        }
      } else {
        // Not in template; add or remove override
        if (next[code] === true) {
          delete next[code];
        } else {
          next[code] = true;
        }
      }
      return next;
    });
  }, []);

  function isPermActive(code: string): boolean {
    if (permOverrides[code] === true) return true;
    if (permOverrides[code] === false) return false;
    return templatePerms.has(code);
  }

  function permDotClass(code: string): string {
    if (permOverrides[code] === true) return "bg-success";
    if (permOverrides[code] === false) return "bg-destructive";
    return "";
  }

  // ─── Qualification helpers ────────────────────────────────────────────────

  function addQualification() {
    setQualifications((prev) => [
      ...prev,
      { type: "CERTIFICATE", label: "", value: "", issued: "", expires: "" },
    ]);
  }

  function updateQual(idx: number, field: string, val: string) {
    setQualifications((prev) => prev.map((q, i) => (i === idx ? { ...q, [field]: val } : q)));
  }

  function removeQual(idx: number) {
    setQualifications((prev) => prev.filter((_, i) => i !== idx));
  }

  function expiryWarning(expires: string): boolean {
    if (!expires) return false;
    const diff = new Date(expires).getTime() - Date.now();
    return diff > 0 && diff < warnThreshold;
  }

  // ─── Mutation ─────────────────────────────────────────────────────────────

  const [createdTempPassword, setCreatedTempPassword] = useState("");

  const createMutation = useMutation({
    mutationFn: () => {
      const effectivePerms = [...permGroups].flatMap((g: Record<string, any>) =>
        (g.permissions || []).map((p: Record<string, any>) => p.code || p.permission_code)
      ).filter((code: string) => {
        if (permOverrides[code] === true) return true;
        if (permOverrides[code] === false) return false;
        return templatePerms.has(code);
      });

      const payload: Record<string, any> = {
        template_id: selectedTemplateId || undefined,
        last_name: lastName,
        first_name: firstName,
        middle_name: middleName || undefined,
        date_of_birth: dateOfBirth || undefined,
        gender,
        phone_personal: phonePersonal || undefined,
        email_personal: emailPersonal || undefined,
        position: position || undefined,
        position_level: positionLevel || undefined,
        specialization: specialization || undefined,
        department_id: departmentId || undefined,
        section: section || undefined,
        work_phone: workPhone || undefined,
        work_email: workEmail || undefined,
        office_room: officeRoom || undefined,
        work_schedule: workSchedule || undefined,
        employment_type: employmentType,
        employment_start: employmentStart || undefined,
        employment_end: employmentEnd || undefined,
        extra_fields: Object.keys(extraFieldValues).length ? extraFieldValues : undefined,
        qualifications: qualifications.filter((q) => q.label),
        login: loginValue || workEmail || emailPersonal || undefined,
        work_email: loginValue || workEmail || emailPersonal || undefined,
        login_type: "email",
        auto_password: autoPassword,
        must_change_password: mustChangePassword,
        active_from: activeFrom || undefined,
        active_until: activeUntil || undefined,
        delivery_method: deliveryMethod,
        permission_overrides: permOverrides,
        effective_permissions: effectivePerms,
      };

      return staffApi.create(payload);
    },
    onSuccess: (data) => {
      if (deliveryMethod === "SCREEN" && data?.temp_password) {
        setCreatedTempPassword(data.temp_password);
      } else {
        toast.success("Сотрудник создан");
        navigate({ to: "/staff" });
      }
    },
    onError: () => toast.error("Ошибка создания сотрудника"),
  });

  // ─── Navigation ───────────────────────────────────────────────────────────

  function canNext(): boolean {
    if (step === 0 && !selectedTemplateId) return false;
    if (step === 1 && (!lastName || !firstName)) return false;
    return true;
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="max-w-3xl mx-auto pb-16">
      {/* Page header */}
      <div className="mb-6 animate-float-up">
        <h1 className="text-[26px] font-bold text-foreground tracking-tight">Новый сотрудник</h1>
        <p className="text-[var(--color-text-secondary)] text-sm mt-1">Заполните данные для регистрации сотрудника</p>
      </div>

      {/* Step indicator */}
      <div className="animate-float-up" style={{ animationDelay: "50ms" }}>
        <StepIndicator current={step} />
      </div>

      {/* Step content card */}
      <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-6 animate-float-up" style={{ animationDelay: "100ms" }}>

        {/* ── Step 0: Template ── */}
        {step === 0 && (
          <div>
            <h2 className="text-base font-semibold text-foreground mb-1">Выберите шаблон доступа</h2>
            <p className="text-sm text-[var(--color-text-secondary)] mb-5">
              Шаблон определяет набор прав и дополнительные поля для сотрудника
            </p>

            {templates.length === 0 ? (
              <div className="text-center py-8 text-[var(--color-text-secondary)]">
                Нет доступных шаблонов
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {templates.map((tpl: Record<string, any>) => {
                  const isSelected = tpl.id === selectedTemplateId;
                  const initials = tpl.name
                    .split(" ")
                    .slice(0, 2)
                    .map((w: string) => w[0])
                    .join("")
                    .toUpperCase();
                  return (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => handleSelectTemplate(tpl)}
                      className={cn(
                        "text-left p-4 rounded-xl border-2 transition-all",
                        "border-l-4",
                        templateBorderColor(tpl.name),
                        isSelected
                          ? "border-secondary bg-secondary/5 shadow-[0_0_0_2px_rgba(126,120,210,0.2)]"
                          : "border-border bg-[var(--color-surface)] hover:border-[var(--color-text-tertiary)]/40"
                      )}
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <span className={cn(
                          "w-8 h-8 rounded-lg text-xs font-bold flex items-center justify-center flex-shrink-0",
                          templateBgColor(tpl.name)
                        )}>
                          {initials}
                        </span>
                        <span className="text-sm font-semibold text-foreground">{tpl.name}</span>
                        {isSelected && (
                          <svg className="w-4 h-4 text-secondary ml-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M5 13l4 4L19 7"/>
                          </svg>
                        )}
                      </div>
                      {tpl.description && (
                        <p className="text-xs text-[var(--color-text-tertiary)] mb-2 line-clamp-2">{tpl.description}</p>
                      )}
                      <div className="flex items-center gap-3 text-xs text-[var(--color-text-tertiary)]">
                        {tpl.permissions_count != null && (
                          <span>{tpl.permissions_count} прав</span>
                        )}
                        {tpl.staff_count != null && (
                          <span>{tpl.staff_count} сотрудников</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Step 1: Personal data ── */}
        {step === 1 && (
          <div>
            <h2 className="text-base font-semibold text-foreground mb-5">Личные данные</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputField
                label="Фамилия *"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Иванов"
                className="sm:col-span-1"
              />
              <InputField
                label="Имя *"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Иван"
              />
              <InputField
                label="Отчество"
                value={middleName}
                onChange={(e) => setMiddleName(e.target.value)}
                placeholder="Иванович"
                className="sm:col-span-2"
              />
              <DatePicker
                label="Дата рождения"
                value={dateOfBirth}
                onChange={setDateOfBirth}
              />
              <CustomSelect
                label="Пол"
                value={gender}
                onChange={setGender}
                options={genderOptions}
              />
              <InputField
                label="Телефон (личный)"
                value={phonePersonal}
                onChange={(e) => setPhonePersonal(e.target.value)}
                placeholder="+996 XXX XXX XXX"
                type="tel"
              />
              <InputField
                label="Email (личный)"
                value={emailPersonal}
                onChange={(e) => setEmailPersonal(e.target.value)}
                placeholder="ivan@example.com"
                type="email"
              />
            </div>
          </div>
        )}

        {/* ── Step 2: Work data + extra fields ── */}
        {step === 2 && (
          <div>
            <h2 className="text-base font-semibold text-foreground mb-5">Рабочие данные</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputField
                label="Должность"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                placeholder={templateDetail?.name || "Врач-терапевт"}
                className="sm:col-span-2"
              />
              <InputField
                label="Уровень должности"
                value={positionLevel}
                onChange={(e) => setPositionLevel(e.target.value)}
                placeholder="Старший, Junior, и т.д."
              />
              <InputField
                label="Специализация"
                value={specialization}
                onChange={(e) => setSpecialization(e.target.value)}
                placeholder="Кардиология"
              />
              <CustomSelect
                label="Отдел"
                value={departmentId}
                onChange={setDepartmentId}
                options={departmentOptions}
                className="sm:col-span-2"
              />
              <InputField
                label="Секция / Подразделение"
                value={section}
                onChange={(e) => setSection(e.target.value)}
                placeholder="Отделение интенсивной терапии"
              />
              <InputField
                label="Телефон (рабочий)"
                value={workPhone}
                onChange={(e) => setWorkPhone(e.target.value)}
                placeholder="+996 XXX XXX XXX"
                type="tel"
              />
              <InputField
                label="Email (рабочий)"
                value={workEmail}
                onChange={(e) => setWorkEmail(e.target.value)}
                placeholder="ivan@medcore.kg"
                type="email"
              />
              <InputField
                label="Кабинет"
                value={officeRoom}
                onChange={(e) => setOfficeRoom(e.target.value)}
                placeholder="Каб. 215"
              />
              <InputField
                label="Расписание работы"
                value={workSchedule}
                onChange={(e) => setWorkSchedule(e.target.value)}
                placeholder="Пн–Пт 9:00–18:00"
                className="sm:col-span-2"
              />
              <CustomSelect
                label="Тип занятости"
                value={employmentType}
                onChange={setEmploymentType}
                options={employmentTypeOptions}
              />
              <div />
              <DatePicker
                label="Дата приёма"
                value={employmentStart}
                onChange={setEmploymentStart}
              />
              <DatePicker
                label="Дата окончания"
                value={employmentEnd}
                onChange={setEmploymentEnd}
              />
            </div>

            {/* Dynamic extra fields from template */}
            {templateDetail?.extra_fields && templateDetail.extra_fields.length > 0 && (
              <div className="mt-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider px-2">
                    Дополнительные поля шаблона
                  </span>
                  <div className="h-px flex-1 bg-border" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {templateDetail.extra_fields.map((field: Record<string, any>) => (
                    <div key={field.key} className={field.type === "multiselect" || field.type === "boolean" ? "sm:col-span-2" : ""}>
                      <ExtraFieldInput
                        field={field}
                        value={extraFieldValues[field.key]}
                        onChange={(v) => setExtraFieldValues((prev) => ({ ...prev, [field.key]: v }))}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Step 3: Qualifications ── */}
        {step === 3 && (
          <div>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-foreground">Квалификация</h2>
              <Button
                variant="secondary"
                size="sm"
                onClick={addQualification}
                icon={
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/>
                  </svg>
                }
              >
                Добавить документ
              </Button>
            </div>

            {qualifications.length === 0 ? (
              <div className="text-center py-8 text-[var(--color-text-secondary)] border-2 border-dashed border-border rounded-xl">
                <svg className="w-10 h-10 mx-auto mb-2 text-[var(--color-text-tertiary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>
                </svg>
                <p className="text-sm">Нет документов. Нажмите «Добавить документ»</p>
              </div>
            ) : (
              <div className="space-y-4">
                {qualifications.map((q, idx) => {
                  const warn = expiryWarning(q.expires);
                  return (
                    <div key={idx} className="border border-border rounded-xl p-4 relative">
                      <button
                        type="button"
                        onClick={() => removeQual(idx)}
                        className="absolute top-3 right-3 w-6 h-6 flex items-center justify-center rounded-lg text-[var(--color-text-tertiary)] hover:text-destructive hover:bg-destructive/10 transition-colors"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <path d="M18 6 6 18M6 6l12 12"/>
                        </svg>
                      </button>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pr-8">
                        <CustomSelect
                          label="Тип документа"
                          value={q.type}
                          onChange={(v) => updateQual(idx, "type", v)}
                          options={qualificationTypeOptions}
                        />
                        <InputField
                          label="Название"
                          value={q.label}
                          onChange={(e) => updateQual(idx, "label", e.target.value)}
                          placeholder="Сертификат терапевта"
                        />
                        <InputField
                          label="Номер / значение"
                          value={q.value}
                          onChange={(e) => updateQual(idx, "value", e.target.value)}
                          placeholder="№ 12345"
                        />
                        <div />
                        <DatePicker
                          label="Дата выдачи"
                          value={q.issued}
                          onChange={(v) => updateQual(idx, "issued", v)}
                        />
                        <div>
                          <DatePicker
                            label="Дата истечения"
                            value={q.expires}
                            onChange={(v) => updateQual(idx, "expires", v)}
                          />
                          {warn && (
                            <p className="text-xs text-warning mt-1 flex items-center gap-1">
                              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
                                <path d="M12 9v4"/><path d="M12 17h.01"/>
                              </svg>
                              Истекает менее чем через 90 дней
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Step 4: Account ── */}
        {step === 4 && (
          <div>
            <h2 className="text-base font-semibold text-foreground mb-5">Аккаунт</h2>

            {/* Login = work email */}
            <div className="p-4 rounded-xl bg-secondary/5 border border-secondary/15 mb-4">
              <div className="flex items-center gap-2 mb-1">
                <svg className="w-4 h-4 text-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                </svg>
                <span className="text-sm font-medium text-secondary">Вход только через email</span>
              </div>
              <p className="text-xs text-[var(--color-text-tertiary)]">Рабочий email сотрудника является логином для входа в систему</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputField
                label="Рабочий email (логин для входа) *"
                value={loginValue || workEmail || emailPersonal}
                onChange={(e) => setLoginValue(e.target.value)}
                placeholder="ivan@medcore.kg"
                type="email"
                className="sm:col-span-2"
                hint="Этот email будет использоваться для входа в систему и получения пароля"
              />

              <div className="sm:col-span-2 space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoPassword}
                    onChange={(e) => setAutoPassword(e.target.checked)}
                    className="w-4 h-4 rounded border-border accent-secondary"
                  />
                  <span className="text-sm font-medium text-foreground">Авто-генерация пароля</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={mustChangePassword}
                    onChange={(e) => setMustChangePassword(e.target.checked)}
                    className="w-4 h-4 rounded border-border accent-secondary"
                  />
                  <span className="text-sm font-medium text-foreground">Требовать смену пароля при входе</span>
                </label>
              </div>

              <DatePicker
                label="Активен с"
                value={activeFrom}
                onChange={setActiveFrom}
              />
              <DatePicker
                label="Активен до"
                value={activeUntil}
                onChange={setActiveUntil}
              />

              <CustomSelect
                label="Способ доставки пароля"
                value={deliveryMethod}
                onChange={setDeliveryMethod}
                options={deliveryMethodOptions}
                className="sm:col-span-2"
              />
            </div>
          </div>
        )}

        {/* ── Step 5: Permissions ── */}
        {step === 5 && (
          <div>
            <h2 className="text-base font-semibold text-foreground mb-1">Матрица прав доступа</h2>
            <p className="text-sm text-[var(--color-text-secondary)] mb-4">
              Шаблон: <strong>{templateDetail?.name || "не выбран"}</strong>
              {templatePerms.size > 0 && (
                <span className="ml-2">
                  <span className="text-success font-medium">
                    +{Object.values(permOverrides).filter(v => v === true).length}
                  </span>
                  {" · "}
                  <span className="text-destructive font-medium">
                    −{Object.values(permOverrides).filter(v => v === false).length}
                  </span>
                  {" · Итого: "}
                  <span className="font-semibold">{
                    permGroups.flatMap((g: Record<string, any>) =>
                      (g.permissions || []).map((p: Record<string, any>) => p.code || p.permission_code)
                    ).filter((code: string) => isPermActive(code)).length
                  }</span>
                </span>
              )}
            </p>

            {/* Legend */}
            <div className="flex items-center gap-4 mb-4 text-xs text-[var(--color-text-tertiary)]">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-success" />
                Добавлено вручную
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-destructive" />
                Удалено вручную
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[var(--color-text-tertiary)]/30" />
                Из шаблона
              </span>
            </div>

            {permGroups.length === 0 ? (
              <div className="text-center py-8 text-[var(--color-text-secondary)]">Загрузка прав...</div>
            ) : (
              <div className="space-y-4">
                {permGroups.map((group: Record<string, any>) => (
                  <div key={group.id || group.name} className="border border-border rounded-xl overflow-hidden">
                    <div className="px-4 py-2.5 bg-[var(--color-muted)]/50 border-b border-border">
                      <h4 className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">
                        {group.name}
                      </h4>
                    </div>
                    <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {(group.permissions || []).map((perm: Record<string, any>) => {
                        const code = perm.code || perm.permission_code;
                        const active = isPermActive(code);
                        const dotClass = permDotClass(code);
                        const inTemplate = templatePerms.has(code);
                        return (
                          <label
                            key={code}
                            className={cn(
                              "flex items-center gap-2.5 p-2 rounded-lg cursor-pointer transition-colors",
                              active ? "bg-secondary/5 hover:bg-secondary/10" : "hover:bg-[var(--color-muted)]/50"
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={active}
                              onChange={() => togglePerm(code, inTemplate)}
                              className="w-4 h-4 rounded border-border accent-secondary flex-shrink-0"
                            />
                            {dotClass && (
                              <span className={cn("w-2 h-2 rounded-full flex-shrink-0", dotClass)} />
                            )}
                            <div className="min-w-0">
                              <p className="text-sm text-foreground leading-snug">{perm.name || code}</p>
                              {perm.description && (
                                <p className="text-[10px] text-[var(--color-text-tertiary)] truncate">{perm.description}</p>
                              )}
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Step 6: Confirmation ── */}
        {step === 6 && (
          <div>
            <h2 className="text-base font-semibold text-foreground mb-5">Подтверждение данных</h2>

            {/* Temp password after success */}
            {createdTempPassword ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 rounded-2xl bg-success/10 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-success" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 13l4 4L19 7"/>
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-foreground mb-1">Сотрудник создан!</h3>
                <p className="text-[var(--color-text-secondary)] text-sm mb-4">Временный пароль для входа:</p>
                <div className="inline-block px-6 py-3 bg-[var(--color-muted)] rounded-xl font-mono text-xl font-bold text-foreground tracking-widest mb-6">
                  {createdTempPassword}
                </div>
                <br />
                <Button onClick={() => navigate({ to: "/staff" })}>
                  К списку сотрудников
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Summary cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="border border-border rounded-xl p-4">
                    <h4 className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-3">Личные данные</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-[var(--color-text-secondary)]">ФИО</span>
                        <span className="font-medium text-foreground">{[lastName, firstName, middleName].filter(Boolean).join(" ") || "—"}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-[var(--color-text-secondary)]">Дата рождения</span>
                        <span className="font-medium text-foreground">{dateOfBirth || "—"}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-[var(--color-text-secondary)]">Пол</span>
                        <span className="font-medium text-foreground">
                          {gender === "MALE" ? "Мужской" : gender === "FEMALE" ? "Женский" : "Не указан"}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-[var(--color-text-secondary)]">Телефон</span>
                        <span className="font-medium text-foreground">{phonePersonal || "—"}</span>
                      </div>
                    </div>
                  </div>

                  <div className="border border-border rounded-xl p-4">
                    <h4 className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-3">Рабочие данные</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-[var(--color-text-secondary)]">Должность</span>
                        <span className="font-medium text-foreground">{position || "—"}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-[var(--color-text-secondary)]">Тип занятости</span>
                        <span className="font-medium text-foreground">
                          {employmentTypeOptions.find(o => o.value === employmentType)?.label || "—"}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-[var(--color-text-secondary)]">Дата приёма</span>
                        <span className="font-medium text-foreground">{employmentStart || "—"}</span>
                      </div>
                    </div>
                  </div>

                  <div className="border border-border rounded-xl p-4">
                    <h4 className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-3">Шаблон доступа</h4>
                    {templateDetail ? (
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "w-7 h-7 rounded-lg text-xs font-bold flex items-center justify-center",
                          templateBgColor(templateDetail.name)
                        )}>
                          {templateDetail.name.split(" ").slice(0, 2).map((w: string) => w[0]).join("").toUpperCase()}
                        </span>
                        <span className="text-sm font-medium text-foreground">{templateDetail.name}</span>
                      </div>
                    ) : (
                      <span className="text-sm text-[var(--color-text-tertiary)]">Не выбран</span>
                    )}
                    <div className="mt-2 flex gap-3 text-xs">
                      <span className="text-success">+{Object.values(permOverrides).filter(v => v === true).length} добавлено</span>
                      <span className="text-destructive">−{Object.values(permOverrides).filter(v => v === false).length} удалено</span>
                    </div>
                  </div>

                  <div className="border border-border rounded-xl p-4">
                    <h4 className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-3">Аккаунт</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-[var(--color-text-secondary)]">Логин</span>
                        <span className="font-medium text-foreground">{loginValue || "—"}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-[var(--color-text-secondary)]">Тип</span>
                        <span className="font-medium text-foreground">{loginType === "email" ? "Email" : "Телефон"}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-[var(--color-text-secondary)]">Доставка пароля</span>
                        <span className="font-medium text-foreground">
                          {deliveryMethodOptions.find(o => o.value === deliveryMethod)?.label || "—"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {qualifications.length > 0 && (
                  <div className="border border-border rounded-xl p-4">
                    <h4 className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-3">
                      Квалификация ({qualifications.length} документов)
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {qualifications.map((q, idx) => (
                        <span key={idx} className="px-2.5 py-1 bg-[var(--color-muted)] rounded-lg text-xs text-[var(--color-text-secondary)]">
                          {q.label || "(без названия)"}
                          {expiryWarning(q.expires) && (
                            <span className="ml-1 text-warning">⚠</span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Navigation buttons */}
      {!createdTempPassword && (
        <div className="flex items-center justify-between mt-4 animate-float-up" style={{ animationDelay: "150ms" }}>
          <Button
            variant="outline"
            onClick={() => setStep(Math.max(0, step - 1))}
            disabled={step === 0}
          >
            Назад
          </Button>

          {step < STEPS.length - 1 ? (
            <Button
              variant="primary"
              onClick={() => setStep(step + 1)}
              disabled={!canNext()}
            >
              Далее
            </Button>
          ) : (
            <Button
              variant="primary"
              onClick={() => createMutation.mutate()}
              loading={createMutation.isPending}
              disabled={createMutation.isPending}
            >
              Создать сотрудника
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

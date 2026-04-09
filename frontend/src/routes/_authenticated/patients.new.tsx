import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { patientsApi } from "@/features/patients/api";
import { toast } from "sonner";
import { InputField } from "@/components/ui/input-field";
import { CustomSelect } from "@/components/ui/select-custom";
import { TextareaField } from "@/components/ui/textarea-field";
import { TagInput } from "@/components/ui/tag-input";
import { DatePicker } from "@/components/ui/date-picker";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/patients/new")({
  component: NewPatientPage,
});

const genderOptions = [
  { value: "MALE", label: "Мужской" },
  { value: "FEMALE", label: "Женский" },
  { value: "OTHER", label: "Не указан" },
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

function NewPatientPage() {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    first_name: "", last_name: "", middle_name: "",
    date_of_birth: "", gender: "MALE",
    passport_number: "", inn: "", address: "", phone: "",
    emergency_contact_name: "", emergency_contact_phone: "",
    blood_type: "UNKNOWN", allergies: [] as string[], chronic_conditions: [] as string[],
    insurance_provider: "", insurance_number: "",
    portal_password: "",
  });

  const updateField = (field: string, value: string) => setForm(f => ({ ...f, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const result = await patientsApi.create(form);
      toast.success(`Пациент создан. Карта: ${result.card_number}`);
      navigate({ to: "/patients" });
    } catch {
      toast.error("Ошибка при создании пациента");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl">
      <a href="/patients" className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-foreground mb-4 transition-colors">
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
        К списку
      </a>

      <h1 className="text-[24px] font-bold text-foreground tracking-tight mb-6 animate-float-up" style={{ opacity: 0 }}>Новый пациент</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Personal */}
        <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-6 animate-float-up" style={{ animationDelay: '100ms', opacity: 0 }}>
          <h2 className="text-sm font-semibold text-foreground mb-4">Личные данные</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <InputField label="Фамилия *" required value={form.last_name} onChange={e => updateField("last_name", e.target.value)} />
            <InputField label="Имя *" required value={form.first_name} onChange={e => updateField("first_name", e.target.value)} />
            <InputField label="Отчество" value={form.middle_name} onChange={e => updateField("middle_name", e.target.value)} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
            <DatePicker label="Дата рождения *" required value={form.date_of_birth} onChange={v => updateField("date_of_birth", v)} />
            <CustomSelect label="Пол *" value={form.gender} onChange={v => updateField("gender", v)} options={genderOptions} />
            <CustomSelect label="Группа крови" value={form.blood_type} onChange={v => updateField("blood_type", v)} options={bloodTypeOptions} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <InputField label="Паспорт" value={form.passport_number} onChange={e => updateField("passport_number", e.target.value)} placeholder="AN1234567" />
            <InputField label="ИНН" value={form.inn} onChange={e => updateField("inn", e.target.value)} placeholder="14 цифр" maxLength={14} />
          </div>
          <div className="mt-4">
            <TextareaField label="Адрес" value={form.address} onChange={e => updateField("address", e.target.value)} rows={2} />
          </div>
        </div>

        {/* Section 2: Contacts */}
        <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-6 animate-float-up" style={{ animationDelay: '200ms', opacity: 0 }}>
          <h2 className="text-sm font-semibold text-foreground mb-4">Контакты</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InputField label="Телефон" type="tel" value={form.phone} onChange={e => updateField("phone", e.target.value)} placeholder="+996 555 123 456" />
            <InputField label="Пароль для портала" type="password" value={form.portal_password} onChange={e => updateField("portal_password", e.target.value)} placeholder="Для входа в портал пациента" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <InputField label="Экстренный контакт (ФИО)" value={form.emergency_contact_name} onChange={e => updateField("emergency_contact_name", e.target.value)} />
            <InputField label="Телефон экстр. контакта" type="tel" value={form.emergency_contact_phone} onChange={e => updateField("emergency_contact_phone", e.target.value)} />
          </div>
        </div>

        {/* Section 3: Medical */}
        <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-6 animate-float-up" style={{ animationDelay: '300ms', opacity: 0 }}>
          <h2 className="text-sm font-semibold text-foreground mb-4">Медицинская информация</h2>
          <TagInput
            label="Аллергии"
            tags={form.allergies}
            onAdd={tag => setForm(f => ({ ...f, allergies: [...f.allergies, tag] }))}
            onRemove={i => setForm(f => ({ ...f, allergies: f.allergies.filter((_, j) => j !== i) }))}
            placeholder="Добавить аллергию"
            tagColor="destructive"
          />
          <div className="mt-4">
            <TagInput
              label="Хронические заболевания"
              tags={form.chronic_conditions}
              onAdd={tag => setForm(f => ({ ...f, chronic_conditions: [...f.chronic_conditions, tag] }))}
              onRemove={i => setForm(f => ({ ...f, chronic_conditions: f.chronic_conditions.filter((_, j) => j !== i) }))}
              placeholder="Добавить заболевание"
              tagColor="warning"
            />
          </div>
        </div>

        {/* Section 4: Insurance */}
        <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-6 animate-float-up" style={{ animationDelay: '400ms', opacity: 0 }}>
          <h2 className="text-sm font-semibold text-foreground mb-4">Страховка</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InputField label="Страховая компания" value={form.insurance_provider} onChange={e => updateField("insurance_provider", e.target.value)} />
            <InputField label="Номер полиса" value={form.insurance_number} onChange={e => updateField("insurance_number", e.target.value)} />
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end gap-3 animate-float-up" style={{ animationDelay: '500ms', opacity: 0 }}>
          <Button type="button" variant="outline" size="lg" onClick={() => navigate({ to: "/patients" })}>
            Отмена
          </Button>
          <Button type="submit" variant="primary" size="lg" loading={isSubmitting}>
            {isSubmitting ? "Создание..." : "Зарегистрировать пациента"}
          </Button>
        </div>
      </form>
    </div>
  );
}

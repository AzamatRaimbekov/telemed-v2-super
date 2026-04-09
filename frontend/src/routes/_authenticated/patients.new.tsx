import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { patientsApi } from "@/features/patients/api";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/patients/new")({
  component: NewPatientPage,
});

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
  const [allergyInput, setAllergyInput] = useState("");
  const [conditionInput, setConditionInput] = useState("");

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

  const addAllergy = () => { if (allergyInput.trim()) { setForm(f => ({ ...f, allergies: [...f.allergies, allergyInput.trim()] })); setAllergyInput(""); } };
  const addCondition = () => { if (conditionInput.trim()) { setForm(f => ({ ...f, chronic_conditions: [...f.chronic_conditions, conditionInput.trim()] })); setConditionInput(""); } };

  const inputClass = "w-full px-4 py-2.5 rounded-xl border border-border bg-[var(--color-surface)] text-foreground text-sm placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-secondary/40 input-glow transition-all";
  const labelClass = "block text-[13px] font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)] mb-1.5";

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
            <div><label className={labelClass}>Фамилия *</label><input required value={form.last_name} onChange={e => updateField("last_name", e.target.value)} className={inputClass} /></div>
            <div><label className={labelClass}>Имя *</label><input required value={form.first_name} onChange={e => updateField("first_name", e.target.value)} className={inputClass} /></div>
            <div><label className={labelClass}>Отчество</label><input value={form.middle_name} onChange={e => updateField("middle_name", e.target.value)} className={inputClass} /></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
            <div><label className={labelClass}>Дата рождения *</label><input type="date" required value={form.date_of_birth} onChange={e => updateField("date_of_birth", e.target.value)} className={inputClass} /></div>
            <div><label className={labelClass}>Пол *</label>
              <select value={form.gender} onChange={e => updateField("gender", e.target.value)} className={inputClass}>
                <option value="MALE">Мужской</option><option value="FEMALE">Женский</option><option value="OTHER">Не указан</option>
              </select>
            </div>
            <div><label className={labelClass}>Группа крови</label>
              <select value={form.blood_type} onChange={e => updateField("blood_type", e.target.value)} className={inputClass}>
                {["UNKNOWN","A_POS","A_NEG","B_POS","B_NEG","AB_POS","AB_NEG","O_POS","O_NEG"].map(bt => <option key={bt} value={bt}>{bt.replace("_", "+").replace("NEG", "-").replace("POS", "+").replace("UNKNOWN", "Не указана")}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <div><label className={labelClass}>Паспорт</label><input value={form.passport_number} onChange={e => updateField("passport_number", e.target.value)} placeholder="AN1234567" className={inputClass} /></div>
            <div><label className={labelClass}>ИНН</label><input value={form.inn} onChange={e => updateField("inn", e.target.value)} placeholder="14 цифр" maxLength={14} className={inputClass} /></div>
          </div>
          <div className="mt-4"><label className={labelClass}>Адрес</label><textarea value={form.address} onChange={e => updateField("address", e.target.value)} rows={2} className={inputClass + " resize-none"} /></div>
        </div>

        {/* Section 2: Contacts */}
        <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-6 animate-float-up" style={{ animationDelay: '200ms', opacity: 0 }}>
          <h2 className="text-sm font-semibold text-foreground mb-4">Контакты</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className={labelClass}>Телефон</label><input type="tel" value={form.phone} onChange={e => updateField("phone", e.target.value)} placeholder="+996 555 123 456" className={inputClass} /></div>
            <div><label className={labelClass}>Пароль для портала</label><input type="password" value={form.portal_password} onChange={e => updateField("portal_password", e.target.value)} placeholder="Для входа в портал пациента" className={inputClass} /></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <div><label className={labelClass}>Экстренный контакт (ФИО)</label><input value={form.emergency_contact_name} onChange={e => updateField("emergency_contact_name", e.target.value)} className={inputClass} /></div>
            <div><label className={labelClass}>Телефон экстр. контакта</label><input type="tel" value={form.emergency_contact_phone} onChange={e => updateField("emergency_contact_phone", e.target.value)} className={inputClass} /></div>
          </div>
        </div>

        {/* Section 3: Medical */}
        <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-6 animate-float-up" style={{ animationDelay: '300ms', opacity: 0 }}>
          <h2 className="text-sm font-semibold text-foreground mb-4">Медицинская информация</h2>
          <div>
            <label className={labelClass}>Аллергии</label>
            <div className="flex gap-2 mb-2">
              <input value={allergyInput} onChange={e => setAllergyInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addAllergy(); } }} placeholder="Добавить аллергию" className={inputClass} />
              <button type="button" onClick={addAllergy} className="px-4 py-2 rounded-xl bg-destructive/10 text-destructive text-sm font-medium hover:bg-destructive/20 transition-colors whitespace-nowrap">+</button>
            </div>
            <div className="flex flex-wrap gap-1">{form.allergies.map((a, i) => (
              <span key={i} className="px-2.5 py-1 bg-destructive/10 text-destructive text-xs rounded-full flex items-center gap-1">{a}
                <button type="button" onClick={() => setForm(f => ({ ...f, allergies: f.allergies.filter((_, j) => j !== i) }))} className="hover:text-destructive/70">&times;</button>
              </span>
            ))}</div>
          </div>
          <div className="mt-4">
            <label className={labelClass}>Хронические заболевания</label>
            <div className="flex gap-2 mb-2">
              <input value={conditionInput} onChange={e => setConditionInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addCondition(); } }} placeholder="Добавить заболевание" className={inputClass} />
              <button type="button" onClick={addCondition} className="px-4 py-2 rounded-xl bg-warning/10 text-warning text-sm font-medium hover:bg-warning/20 transition-colors whitespace-nowrap">+</button>
            </div>
            <div className="flex flex-wrap gap-1">{form.chronic_conditions.map((c, i) => (
              <span key={i} className="px-2.5 py-1 bg-warning/10 text-warning text-xs rounded-full flex items-center gap-1">{c}
                <button type="button" onClick={() => setForm(f => ({ ...f, chronic_conditions: f.chronic_conditions.filter((_, j) => j !== i) }))} className="hover:text-warning/70">&times;</button>
              </span>
            ))}</div>
          </div>
        </div>

        {/* Section 4: Insurance */}
        <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-6 animate-float-up" style={{ animationDelay: '400ms', opacity: 0 }}>
          <h2 className="text-sm font-semibold text-foreground mb-4">Страховка</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className={labelClass}>Страховая компания</label><input value={form.insurance_provider} onChange={e => updateField("insurance_provider", e.target.value)} className={inputClass} /></div>
            <div><label className={labelClass}>Номер полиса</label><input value={form.insurance_number} onChange={e => updateField("insurance_number", e.target.value)} className={inputClass} /></div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end gap-3 animate-float-up" style={{ animationDelay: '500ms', opacity: 0 }}>
          <a href="/patients" className="px-6 py-3 rounded-xl border border-border text-sm font-medium text-[var(--color-text-secondary)] hover:text-foreground hover:border-[var(--color-text-tertiary)] transition-all">Отмена</a>
          <button type="submit" disabled={isSubmitting}
            className="px-8 py-3 rounded-xl bg-secondary text-white text-sm font-semibold hover:bg-secondary/90 disabled:opacity-50 transition-all"
            style={{ background: 'linear-gradient(135deg, var(--color-secondary) 0%, var(--color-secondary-deep) 100%)' }}>
            {isSubmitting ? "Создание..." : "Зарегистрировать пациента"}
          </button>
        </div>
      </form>
    </div>
  );
}

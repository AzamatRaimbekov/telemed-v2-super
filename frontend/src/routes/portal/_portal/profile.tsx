import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { portalApi } from "@/features/portal/api";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { usePortalAuthStore } from "@/stores/portal-auth-store";
import { useVoiceAssistant } from "@/features/voice-assistant";
import { Mic } from "lucide-react";

export const Route = createFileRoute("/portal/_portal/profile")({
  component: ProfilePage,
});

// ---------- types ----------

interface FullProfile {
  id: string;
  first_name: string;
  last_name: string;
  middle_name?: string;
  birth_date?: string;
  date_of_birth?: string;
  gender?: string;
  phone?: string;
  address?: string;
  medical_card_number?: string;
  blood_type?: string;
  allergies?: string[];
  chronic_conditions?: string[];
  status?: string;
  photo_url?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  insurance_provider?: string;
  insurance_number?: string;
  notification_preferences?: NotificationPrefs | null;
  assigned_doctor?: {
    id: string;
    first_name: string;
    last_name: string;
    specialization?: string;
  };
}

interface NotificationPrefs {
  medication_reminders: boolean;
  appointment_reminders: boolean;
  lab_results: boolean;
  messages: boolean;
}

const NOTIF_LABELS: Record<keyof NotificationPrefs, string> = {
  medication_reminders: "Напоминания о лекарствах",
  appointment_reminders: "Напоминания о записях",
  lab_results: "Результаты анализов",
  messages: "Сообщения от врачей",
};

const DEFAULT_NOTIF_PREFS: NotificationPrefs = {
  medication_reminders: true,
  appointment_reminders: true,
  lab_results: true,
  messages: true,
};

// ---------- helpers ----------

function calcAge(birthDate: string | null | undefined): number | null {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

function initials(first: string, last: string): string {
  return `${first?.[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase();
}

// ---------- toggle switch ----------

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary ${disabled ? "opacity-40 cursor-not-allowed" : ""} ${checked ? "bg-secondary" : "bg-[var(--color-muted)]"}`}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-6" : "translate-x-1"}`}
      />
    </button>
  );
}

// ---------- editable field ----------

interface EditableFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}

function EditableField({ label, value, onChange, placeholder, type = "text" }: EditableFieldProps) {
  return (
    <div>
      <label className="block text-xs font-medium text-[var(--color-text-tertiary)] mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-xl border border-border bg-[var(--color-muted)]/50 text-sm text-foreground placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-secondary/40 focus:border-secondary transition-colors"
      />
    </div>
  );
}

// ---------- read-only field ----------

function ReadOnlyField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium text-[var(--color-text-tertiary)] mb-0.5">{label}</p>
      <p className="text-sm text-foreground">{value || <span className="text-[var(--color-text-tertiary)]">—</span>}</p>
    </div>
  );
}

// ---------- skeleton ----------

function ProfileSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-6">
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-2xl bg-[var(--color-muted)]" />
          <div className="space-y-2 flex-1">
            <div className="h-6 bg-[var(--color-muted)] rounded w-48" />
            <div className="h-4 bg-[var(--color-muted)] rounded w-32" />
          </div>
        </div>
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-[var(--color-surface)] rounded-2xl border border-border p-6 space-y-3">
          <div className="h-4 bg-[var(--color-muted)] rounded w-1/4" />
          <div className="h-10 bg-[var(--color-muted)] rounded" />
          <div className="h-10 bg-[var(--color-muted)] rounded" />
        </div>
      ))}
    </div>
  );
}

// ---------- main component ----------

function ProfilePage() {
  const patientFromStore = usePortalAuthStore((s) => s.patient);
  const queryClient = useQueryClient();

  const { data: profileData, isLoading } = useQuery({
    queryKey: ["portal-full-profile"],
    queryFn: portalApi.getFullProfile,
    retry: false,
  });

  const profile = profileData as FullProfile | undefined;

  // Personal info form state
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [formDirty, setFormDirty] = useState(false);

  // Notification preferences — initialize from server data, fall back to localStorage, then defaults
  const [notifPrefs, setNotifPrefs] = useState<NotificationPrefs>(() => {
    try {
      const saved = localStorage.getItem("portal_notif_prefs");
      if (saved) return JSON.parse(saved);
    } catch { /* noop */ }
    return { ...DEFAULT_NOTIF_PREFS };
  });

  // When profile loads, sync notification_preferences from server (source of truth)
  useEffect(() => {
    if (profile) {
      setPhone(profile.phone || "");
      setAddress(profile.address || "");
      setEmergencyName(profile.emergency_contact_name || "");
      setEmergencyPhone(profile.emergency_contact_phone || "");
      setFormDirty(false);

      // Sync notification prefs from server if available
      if (profile.notification_preferences) {
        const serverPrefs = { ...DEFAULT_NOTIF_PREFS, ...profile.notification_preferences };
        setNotifPrefs(serverPrefs);
        localStorage.setItem("portal_notif_prefs", JSON.stringify(serverPrefs));
      }
    }
  }, [profile]);

  const updateMutation = useMutation({
    mutationFn: portalApi.updateProfile,
    onSuccess: () => {
      toast.success("Профиль сохранён");
      queryClient.invalidateQueries({ queryKey: ["portal-full-profile"] });
      setFormDirty(false);
    },
    onError: () => toast.error("Не удалось сохранить профиль"),
  });

  const prefsMutation = useMutation({
    mutationFn: portalApi.updatePreferences,
    onError: () => toast.error("Не удалось сохранить настройки уведомлений"),
  });

  function handleSave() {
    updateMutation.mutate({
      phone: phone || undefined,
      address: address || undefined,
      emergency_contact_name: emergencyName || undefined,
      emergency_contact_phone: emergencyPhone || undefined,
    });
  }

  function handleNotifChange(key: keyof NotificationPrefs, value: boolean) {
    const updated = { ...notifPrefs, [key]: value };
    setNotifPrefs(updated);
    localStorage.setItem("portal_notif_prefs", JSON.stringify(updated));
    // Sync to backend
    prefsMutation.mutate({ notification_preferences: updated });
  }

  const { settings: voiceSettings, updateSettings: updateVoiceSettings } = useVoiceAssistant();

  const displayProfile = profile || (patientFromStore as unknown as FullProfile | null);
  const birthDate = displayProfile?.date_of_birth || displayProfile?.birth_date;
  const age = calcAge(birthDate);

  if (isLoading) return <ProfileSkeleton />;

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header section */}
      <div className="animate-float-up" style={{ animationDelay: "0ms" }}>
        <h1 className="text-[24px] font-bold text-foreground tracking-tight">Мой профиль</h1>
      </div>

      {/* Profile header card */}
      <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-6 animate-float-up" style={{ animationDelay: "60ms" }}>
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center text-white font-bold text-2xl flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #BDEDE0 0%, #7E78D2 100%)" }}
          >
            {displayProfile ? initials(displayProfile.first_name, displayProfile.last_name) : "??"}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-foreground">
              {displayProfile?.last_name} {displayProfile?.first_name}
              {displayProfile?.middle_name && ` ${displayProfile.middle_name}`}
            </h2>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              {age !== null && (
                <span className="text-sm text-[var(--color-text-secondary)]">{age} лет</span>
              )}
              {displayProfile?.medical_card_number && (
                <span className="text-xs text-[var(--color-text-tertiary)] bg-[var(--color-muted)] px-2 py-0.5 rounded-full">
                  № {displayProfile.medical_card_number}
                </span>
              )}
              {displayProfile?.blood_type && (
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-destructive/10 text-destructive">
                  {displayProfile.blood_type}
                </span>
              )}
              {displayProfile?.status && (
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${displayProfile.status === "ACTIVE" ? "bg-success/10 text-success" : "bg-[var(--color-muted)] text-[var(--color-text-secondary)]"}`}>
                  {displayProfile.status === "ACTIVE" ? "Стационар" : displayProfile.status === "DISCHARGED" ? "Выписан" : displayProfile.status}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Personal info (editable) */}
      <div className="bg-[var(--color-surface)] rounded-2xl border border-border overflow-hidden animate-float-up" style={{ animationDelay: "120ms" }}>
        <div className="px-6 py-4 border-b border-border">
          <h3 className="text-base font-semibold text-foreground">Личная информация</h3>
          <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">Можно редактировать</p>
        </div>
        <div className="p-6 space-y-4">
          <EditableField
            label="Телефон"
            value={phone}
            onChange={(v) => { setPhone(v); setFormDirty(true); }}
            placeholder="+996 XXX XXXXXX"
            type="tel"
          />
          <EditableField
            label="Адрес"
            value={address}
            onChange={(v) => { setAddress(v); setFormDirty(true); }}
            placeholder="Город, улица, дом"
          />
          <div className="pt-2 border-t border-border">
            <p className="text-xs font-semibold text-[var(--color-text-tertiary)] mb-3 uppercase tracking-wider">Экстренный контакт</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <EditableField
                label="Имя"
                value={emergencyName}
                onChange={(v) => { setEmergencyName(v); setFormDirty(true); }}
                placeholder="Иванов Иван"
              />
              <EditableField
                label="Телефон"
                value={emergencyPhone}
                onChange={(v) => { setEmergencyPhone(v); setFormDirty(true); }}
                placeholder="+996 XXX XXXXXX"
                type="tel"
              />
            </div>
          </div>
          {formDirty && (
            <div className="pt-2">
              <button
                onClick={handleSave}
                disabled={updateMutation.isPending}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-secondary text-white text-sm font-semibold hover:bg-secondary/90 disabled:opacity-60 transition-all"
              >
                {updateMutation.isPending ? "Сохранение…" : "Сохранить изменения"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Medical info (read-only) */}
      <div className="bg-[var(--color-surface)] rounded-2xl border border-border overflow-hidden animate-float-up" style={{ animationDelay: "180ms" }}>
        <div className="px-6 py-4 border-b border-border">
          <h3 className="text-base font-semibold text-foreground">Медицинская информация</h3>
          <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">Только просмотр</p>
        </div>
        <div className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <ReadOnlyField label="Группа крови" value={displayProfile?.blood_type} />
            <ReadOnlyField label="Дата рождения" value={birthDate ? new Date(birthDate).toLocaleDateString("ru-RU") : undefined} />
          </div>

          {/* Allergies */}
          <div>
            <p className="text-xs font-medium text-[var(--color-text-tertiary)] mb-2">Аллергии</p>
            {(displayProfile?.allergies || []).length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {(displayProfile?.allergies || []).map((a) => (
                  <span key={a} className="text-xs px-2.5 py-1 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 font-medium">
                    {a}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[var(--color-text-tertiary)]">Не указаны</p>
            )}
          </div>

          {/* Chronic conditions */}
          <div>
            <p className="text-xs font-medium text-[var(--color-text-tertiary)] mb-2">Хронические заболевания</p>
            {(displayProfile?.chronic_conditions || []).length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {(displayProfile?.chronic_conditions || []).map((c) => (
                  <span key={c} className="text-xs px-2.5 py-1 rounded-full bg-warning/10 text-warning font-medium">
                    {c}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[var(--color-text-tertiary)]">Не указаны</p>
            )}
          </div>

          {/* Assigned doctor */}
          {displayProfile?.assigned_doctor && (
            <div className="pt-2 border-t border-border">
              <p className="text-xs font-medium text-[var(--color-text-tertiary)] mb-2">Лечащий врач</p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {displayProfile.assigned_doctor.last_name} {displayProfile.assigned_doctor.first_name}
                  </p>
                  {displayProfile.assigned_doctor.specialization && (
                    <p className="text-xs text-[var(--color-text-tertiary)]">{displayProfile.assigned_doctor.specialization}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Insurance */}
          {(displayProfile?.insurance_provider || displayProfile?.insurance_number) && (
            <div className="pt-2 border-t border-border">
              <p className="text-xs font-medium text-[var(--color-text-tertiary)] mb-3">Страховка</p>
              <div className="grid grid-cols-2 gap-4">
                <ReadOnlyField label="Страховщик" value={displayProfile.insurance_provider} />
                <ReadOnlyField label="Номер полиса" value={displayProfile.insurance_number} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Settings section */}
      <div className="bg-[var(--color-surface)] rounded-2xl border border-border overflow-hidden animate-float-up" style={{ animationDelay: "240ms" }}>
        <div className="px-6 py-4 border-b border-border">
          <h3 className="text-base font-semibold text-foreground">Настройки</h3>
        </div>
        <div className="p-6 space-y-6">
          {/* Language */}
          <div>
            <p className="text-sm font-medium text-foreground mb-1">Язык интерфейса</p>
            <p className="text-sm text-[var(--color-text-secondary)]">
              Русский — активный язык. Кыргызский язык будет добавлен позже.
            </p>
          </div>

          {/* Notification preferences */}
          <div>
            <p className="text-sm font-medium text-foreground mb-3">Уведомления</p>
            <div className="space-y-4">
              {(Object.keys(NOTIF_LABELS) as Array<keyof NotificationPrefs>).map((key) => (
                <div key={key} className="flex items-center justify-between gap-3">
                  <label className="text-sm text-[var(--color-text-secondary)] cursor-pointer flex-1" onClick={() => handleNotifChange(key, !notifPrefs[key])}>
                    {NOTIF_LABELS[key]}
                  </label>
                  <Toggle
                    checked={notifPrefs[key]}
                    onChange={(v) => handleNotifChange(key, v)}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Voice assistant settings */}
      <div className="bg-[var(--color-surface)] rounded-2xl border border-border overflow-hidden animate-float-up" style={{ animationDelay: "300ms" }}>
        <div className="px-6 py-4 border-b border-border flex items-center gap-2">
          <Mic className="w-5 h-5 text-secondary" />
          <h3 className="text-base font-semibold text-foreground">Голосовой ассистент</h3>
        </div>
        <div className="p-6 space-y-4">
          {/* Voice enabled */}
          <div className="flex items-center justify-between gap-3">
            <label
              className="text-sm text-[var(--color-text-secondary)] cursor-pointer flex-1"
              onClick={() => updateVoiceSettings({ voice_enabled: !voiceSettings.voice_enabled })}
            >
              Голосовое управление
            </label>
            <Toggle
              checked={voiceSettings.voice_enabled}
              onChange={(v) => updateVoiceSettings({ voice_enabled: v })}
            />
          </div>

          {/* Wake word */}
          <div className="flex items-center justify-between gap-3">
            <label
              className={`text-sm flex-1 ${voiceSettings.voice_enabled ? "text-[var(--color-text-secondary)] cursor-pointer" : "text-[var(--color-text-tertiary)] cursor-not-allowed"}`}
              onClick={() => voiceSettings.voice_enabled && updateVoiceSettings({ wake_word_enabled: !voiceSettings.wake_word_enabled })}
            >
              Активация голосом (&laquo;Эй, Медкор&raquo;)
            </label>
            <Toggle
              checked={voiceSettings.wake_word_enabled}
              onChange={(v) => updateVoiceSettings({ wake_word_enabled: v })}
              disabled={!voiceSettings.voice_enabled}
            />
          </div>

          {/* TTS enabled */}
          <div className="flex items-center justify-between gap-3">
            <label
              className={`text-sm flex-1 ${voiceSettings.voice_enabled ? "text-[var(--color-text-secondary)] cursor-pointer" : "text-[var(--color-text-tertiary)] cursor-not-allowed"}`}
              onClick={() => voiceSettings.voice_enabled && updateVoiceSettings({ tts_enabled: !voiceSettings.tts_enabled })}
            >
              Озвучка ответов
            </label>
            <Toggle
              checked={voiceSettings.tts_enabled}
              onChange={(v) => updateVoiceSettings({ tts_enabled: v })}
              disabled={!voiceSettings.voice_enabled}
            />
          </div>

          {/* Language select */}
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-tertiary)] mb-1">
              Язык распознавания
            </label>
            <select
              value={voiceSettings.language}
              onChange={(e) => updateVoiceSettings({ language: e.target.value as "ru" | "ky" | "en" })}
              className="w-full px-3 py-2 rounded-xl border border-border bg-[var(--color-muted)]/50 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-secondary/40 focus:border-secondary transition-colors"
            >
              <option value="ru">Русский</option>
              <option value="ky">Кыргызча</option>
              <option value="en">English</option>
            </select>
          </div>

          {/* TTS speed — shown only if TTS on */}
          {voiceSettings.tts_enabled && (
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-tertiary)] mb-1">
                Скорость озвучки — {voiceSettings.tts_speed.toFixed(1)}x
              </label>
              <input
                type="range"
                min={0.5}
                max={2.0}
                step={0.1}
                value={voiceSettings.tts_speed}
                onChange={(e) => updateVoiceSettings({ tts_speed: parseFloat(e.target.value) })}
                className="w-full accent-secondary"
              />
              <div className="flex justify-between text-xs text-[var(--color-text-tertiary)] mt-0.5">
                <span>0.5x</span>
                <span>2.0x</span>
              </div>
            </div>
          )}

          {/* Hint size — shown only if voice on */}
          {voiceSettings.voice_enabled && (
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-tertiary)] mb-2">
                Размер подсказок
              </label>
              <div className="flex gap-2">
                {([
                  { value: "sm" as const, label: "S" },
                  { value: "md" as const, label: "M" },
                  { value: "lg" as const, label: "L" },
                ]).map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => updateVoiceSettings({ hint_size: opt.value })}
                    className={`px-4 py-1.5 rounded-xl text-sm font-semibold transition-colors ${
                      voiceSettings.hint_size === opt.value
                        ? "bg-secondary text-white"
                        : "bg-[var(--color-muted)] text-[var(--color-text-secondary)] hover:bg-[var(--color-muted)]/80"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

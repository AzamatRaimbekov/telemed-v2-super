// frontend/src/routes/portal/_portal/appointments.tsx
// Patient portal — appointments list with booking modal and cancellation

import { createFileRoute } from "@tanstack/react-router"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { portalApi } from "@/features/portal/api"
import { useState, useMemo, useCallback, useEffect, useRef } from "react"

export const Route = createFileRoute("/portal/_portal/appointments")({
  component: AppointmentsPage,
})

// ─── Types ────────────────────────────────────────────────────────────────────

type Appointment = {
  /** Unique appointment ID (UUID) */
  id: string
  /** Type: CONSULTATION, FOLLOW_UP, etc. */
  appointment_type: string
  /** Current status: SCHEDULED, CONFIRMED, COMPLETED, CANCELLED, etc. */
  status: string
  /** ISO datetime — start of the appointment */
  scheduled_start: string
  /** ISO datetime — end of the appointment */
  scheduled_end: string
  /** Patient-provided reason for the visit */
  reason: string | null
  /** Doctor's display name (may be absent) */
  doctor_name?: string
}

type Slot = {
  /** ISO datetime — slot start */
  start: string
  /** ISO datetime — slot end */
  end: string
  /** Whether the slot is bookable */
  available: boolean
}

type Doctor = {
  /** Doctor user ID (UUID) */
  id: string
  /** Display name */
  name: string
  /** Medical specialization */
  specialization: string
}

type BookingStep = "doctor" | "date" | "slots" | "reason" | "confirm"

// ─── Constants ────────────────────────────────────────────────────────────────

const statusLabels: Record<string, string> = {
  SCHEDULED: "Запланирован",
  CONFIRMED: "Подтверждён",
  CHECKED_IN: "Вы на месте",
  IN_PROGRESS: "Идёт приём",
  COMPLETED: "Завершён",
  CANCELLED: "Отменён",
  NO_SHOW: "Не явился",
}

const statusColors: Record<string, string> = {
  SCHEDULED: "bg-secondary/10 text-secondary",
  CONFIRMED: "bg-primary/10 text-[var(--color-primary-deep)]",
  IN_PROGRESS: "bg-success/10 text-success",
  COMPLETED: "bg-[var(--color-muted)] text-[var(--color-text-secondary)]",
  CANCELLED: "bg-destructive/10 text-destructive",
}

const appointmentTypeLabels: Record<string, string> = {
  CONSULTATION: "Консультация",
  FOLLOW_UP: "Повторный приём",
  CHECKUP: "Осмотр",
  PROCEDURE: "Процедура",
}

/** Step ordering for the booking wizard */
const STEPS: BookingStep[] = ["doctor", "date", "slots", "reason", "confirm"]

/** Step labels for the progress indicator */
const STEP_LABELS: Record<BookingStep, string> = {
  doctor: "Врач",
  date: "Дата",
  slots: "Время",
  reason: "Причина",
  confirm: "Подтверждение",
}

// ─── Fallback doctors when no API endpoint is available ──────────────────────
// These map to real staff UUIDs seeded in the database.
// When a dedicated /portal/doctors endpoint is added, remove this list.
const FALLBACK_DOCTORS: Doctor[] = [
  { id: "d0000000-0000-0000-0000-000000000001", name: "Иванов А. П.", specialization: "Невролог" },
  { id: "d0000000-0000-0000-0000-000000000002", name: "Сергеева М. В.", specialization: "Терапевт" },
  { id: "d0000000-0000-0000-0000-000000000003", name: "Ким Д. С.", specialization: "Реабилитолог" },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  })
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  })
}

function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

/** Returns today's date as YYYY-MM-DD */
function todayISO(): string {
  const d = new Date()
  return d.toISOString().slice(0, 10)
}

// ─── Modal backdrop ──────────────────────────────────────────────────────────

function ModalBackdrop({
  isOpen,
  onClose,
  children,
}: {
  isOpen: boolean
  onClose: () => void
  children: React.ReactNode
}) {
  const backdropRef = useRef<HTMLDivElement>(null)

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === backdropRef.current) onClose()
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Запись на приём"
    >
      <div className="bg-[var(--color-surface)] rounded-2xl border border-border shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        {children}
      </div>
    </div>
  )
}

// ─── Step indicator ──────────────────────────────────────────────────────────

function StepIndicator({ currentStep }: { currentStep: BookingStep }) {
  const currentIndex = STEPS.indexOf(currentStep)

  return (
    <div className="flex items-center gap-1 px-6 pt-4">
      {STEPS.map((step, i) => (
        <div
          key={step}
          className="flex items-center gap-1 flex-1"
        >
          <div
            className={`h-1.5 rounded-full flex-1 transition-colors ${
              i <= currentIndex
                ? "bg-secondary"
                : "bg-[var(--color-muted)]"
            }`}
          />
        </div>
      ))}
    </div>
  )
}

// ─── Booking modal ───────────────────────────────────────────────────────────

function BookingModal({
  isOpen,
  onClose,
  onSuccess,
}: {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}) {
  const [step, setStep] = useState<BookingStep>("doctor")
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null)
  const [selectedDate, setSelectedDate] = useState("")
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null)
  const [reason, setReason] = useState("")
  const [appointmentType, setAppointmentType] = useState("CONSULTATION")
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Fetch available slots when doctor and date are selected
  const {
    data: slots,
    isLoading: slotsLoading,
    error: slotsError,
    refetch: refetchSlots,
  } = useQuery({
    queryKey: ["portal-slots", selectedDoctor?.id, selectedDate],
    queryFn: () => portalApi.getSlots(selectedDoctor!.id, selectedDate),
    enabled: !!selectedDoctor && !!selectedDate && step === "slots",
    staleTime: 60_000,
  })

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => portalApi.createAppointment(data),
    onSuccess: () => {
      onSuccess()
      handleClose()
    },
    onError: () => {
      setSubmitError("Не удалось создать запись. Попробуйте ещё раз.")
    },
  })

  /** Reset all state and close */
  const handleClose = useCallback(() => {
    setStep("doctor")
    setSelectedDoctor(null)
    setSelectedDate("")
    setSelectedSlot(null)
    setReason("")
    setAppointmentType("CONSULTATION")
    setSubmitError(null)
    onClose()
  }, [onClose])

  const handleNext = useCallback(() => {
    const i = STEPS.indexOf(step)
    if (i < STEPS.length - 1) {
      setStep(STEPS[i + 1])
    }
  }, [step])

  const handleBack = useCallback(() => {
    const i = STEPS.indexOf(step)
    if (i > 0) {
      setStep(STEPS[i - 1])
    }
  }, [step])

  const handleSubmit = useCallback(() => {
    if (!selectedDoctor || !selectedSlot) return

    setSubmitError(null)
    createMutation.mutate({
      doctor_id: selectedDoctor.id,
      appointment_type: appointmentType,
      scheduled_start: selectedSlot.start,
      scheduled_end: selectedSlot.end,
      reason: reason || null,
    })
  }, [selectedDoctor, selectedSlot, appointmentType, reason, createMutation])

  /** Whether "Next" button should be enabled for the current step */
  const canProceed = useMemo(() => {
    switch (step) {
      case "doctor":
        return selectedDoctor !== null
      case "date":
        return selectedDate !== ""
      case "slots":
        return selectedSlot !== null
      case "reason":
        // Reason is optional, always can proceed
        return true
      case "confirm":
        return true
      default:
        return false
    }
  }, [step, selectedDoctor, selectedDate, selectedSlot])

  const availableSlots = useMemo(() => {
    if (!Array.isArray(slots)) return []
    return (slots as Slot[]).filter((s) => s.available)
  }, [slots])

  return (
    <ModalBackdrop
      isOpen={isOpen}
      onClose={handleClose}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-6 pb-2">
        <h2 className="text-lg font-bold text-foreground">Записаться на приём</h2>
        <button
          type="button"
          onClick={handleClose}
          className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[var(--color-muted)] transition-colors"
          aria-label="Закрыть"
        >
          <svg
            className="w-5 h-5 text-[var(--color-text-secondary)]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <StepIndicator currentStep={step} />

      <div className="p-6">
        <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-tertiary)] mb-4">
          {STEP_LABELS[step]}
        </p>

        {/* Step 1: Select doctor */}
        {step === "doctor" && (
          <div className="space-y-2">
            <p className="text-sm text-[var(--color-text-secondary)] mb-3">
              Выберите врача для записи
            </p>
            {FALLBACK_DOCTORS.map((doc) => (
              <button
                key={doc.id}
                type="button"
                onClick={() => setSelectedDoctor(doc)}
                className={`w-full text-left p-4 rounded-xl border transition-colors ${
                  selectedDoctor?.id === doc.id
                    ? "border-secondary bg-secondary/5"
                    : "border-border hover:border-secondary/40 bg-transparent"
                }`}
              >
                <p className="text-sm font-semibold text-foreground">{doc.name}</p>
                <p className="text-xs text-[var(--color-text-secondary)]">{doc.specialization}</p>
              </button>
            ))}
          </div>
        )}

        {/* Step 2: Select date */}
        {step === "date" && (
          <div>
            <p className="text-sm text-[var(--color-text-secondary)] mb-3">
              Выберите дату приёма
            </p>
            <input
              type="date"
              value={selectedDate}
              min={todayISO()}
              onChange={(e) => {
                setSelectedDate(e.target.value)
                // Reset slot when date changes
                setSelectedSlot(null)
              }}
              className="w-full px-4 py-3 rounded-xl border border-border bg-[var(--color-surface)] text-foreground text-sm focus:outline-none focus:border-secondary transition-colors"
              aria-label="Дата приёма"
            />
            {selectedDate && (
              <p className="text-xs text-[var(--color-text-tertiary)] mt-2">
                {formatDate(selectedDate + "T00:00:00")}
              </p>
            )}
          </div>
        )}

        {/* Step 3: Select time slot */}
        {step === "slots" && (
          <div>
            <p className="text-sm text-[var(--color-text-secondary)] mb-3">
              Доступные слоты на {formatDate(selectedDate + "T00:00:00")}
            </p>

            {slotsLoading && (
              <div className="space-y-2">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="h-12 rounded-xl bg-[var(--color-muted)] animate-pulse"
                  />
                ))}
              </div>
            )}

            {slotsError && (
              <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-center">
                <p className="text-sm text-destructive mb-2">Не удалось загрузить слоты</p>
                <button
                  type="button"
                  onClick={() => refetchSlots()}
                  className="text-xs font-medium text-secondary hover:underline"
                >
                  Попробовать снова
                </button>
              </div>
            )}

            {!slotsLoading && !slotsError && availableSlots.length === 0 && (
              <div className="rounded-xl border border-border bg-[var(--color-muted)]/30 p-6 text-center">
                <svg
                  className="w-8 h-8 mx-auto text-[var(--color-text-tertiary)] mb-2"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <rect
                    width="18"
                    height="18"
                    x="3"
                    y="4"
                    rx="2"
                  />
                  <line
                    x1="16"
                    x2="16"
                    y1="2"
                    y2="6"
                  />
                  <line
                    x1="8"
                    x2="8"
                    y1="2"
                    y2="6"
                  />
                  <line
                    x1="3"
                    x2="21"
                    y1="10"
                    y2="10"
                  />
                </svg>
                <p className="text-sm text-[var(--color-text-secondary)]">
                  Нет доступных слотов на эту дату
                </p>
                <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
                  Попробуйте выбрать другой день
                </p>
              </div>
            )}

            {!slotsLoading && !slotsError && availableSlots.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {availableSlots.map((slot) => {
                  const isSelected =
                    selectedSlot?.start === slot.start && selectedSlot?.end === slot.end

                  return (
                    <button
                      key={slot.start}
                      type="button"
                      onClick={() => setSelectedSlot(slot)}
                      className={`px-3 py-3 rounded-xl border text-sm font-medium transition-colors ${
                        isSelected
                          ? "border-secondary bg-secondary/10 text-secondary"
                          : "border-border hover:border-secondary/40 text-foreground"
                      }`}
                    >
                      {formatTime(slot.start)}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Step 4: Reason and type */}
        {step === "reason" && (
          <div className="space-y-4">
            <div>
              <label
                htmlFor="appointment-type"
                className="text-sm font-medium text-foreground mb-1.5 block"
              >
                Тип приёма
              </label>
              <select
                id="appointment-type"
                value={appointmentType}
                onChange={(e) => setAppointmentType(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-border bg-[var(--color-surface)] text-foreground text-sm focus:outline-none focus:border-secondary transition-colors"
              >
                <option value="CONSULTATION">Консультация</option>
                <option value="FOLLOW_UP">Повторный приём</option>
                <option value="CHECKUP">Осмотр</option>
                <option value="PROCEDURE">Процедура</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="appointment-reason"
                className="text-sm font-medium text-foreground mb-1.5 block"
              >
                Причина обращения{" "}
                <span className="text-[var(--color-text-tertiary)] font-normal">(необязательно)</span>
              </label>
              <textarea
                id="appointment-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Опишите причину визита..."
                rows={3}
                className="w-full px-4 py-3 rounded-xl border border-border bg-[var(--color-surface)] text-foreground text-sm focus:outline-none focus:border-secondary transition-colors resize-none"
              />
            </div>
          </div>
        )}

        {/* Step 5: Confirmation */}
        {step === "confirm" && (
          <div className="space-y-3">
            <div className="rounded-xl border border-border p-4 space-y-3">
              <div className="flex justify-between">
                <span className="text-xs text-[var(--color-text-tertiary)]">Врач</span>
                <span className="text-sm font-medium text-foreground">{selectedDoctor?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-[var(--color-text-tertiary)]">Специализация</span>
                <span className="text-sm text-foreground">{selectedDoctor?.specialization}</span>
              </div>
              <div className="border-t border-border" />
              <div className="flex justify-between">
                <span className="text-xs text-[var(--color-text-tertiary)]">Дата</span>
                <span className="text-sm font-medium text-foreground">
                  {formatDate(selectedDate + "T00:00:00")}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-[var(--color-text-tertiary)]">Время</span>
                <span className="text-sm font-medium text-foreground">
                  {selectedSlot ? `${formatTime(selectedSlot.start)} — ${formatTime(selectedSlot.end)}` : "—"}
                </span>
              </div>
              <div className="border-t border-border" />
              <div className="flex justify-between">
                <span className="text-xs text-[var(--color-text-tertiary)]">Тип приёма</span>
                <span className="text-sm text-foreground">
                  {appointmentTypeLabels[appointmentType] ?? appointmentType}
                </span>
              </div>
              {reason && (
                <div>
                  <span className="text-xs text-[var(--color-text-tertiary)]">Причина</span>
                  <p className="text-sm text-foreground mt-0.5">{reason}</p>
                </div>
              )}
            </div>

            {submitError && (
              <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3">
                <p className="text-sm text-destructive">{submitError}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer buttons */}
      <div className="flex items-center justify-between px-6 pb-6 gap-3">
        {step === "doctor" ? (
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2.5 rounded-xl border border-border text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-muted)] transition-colors"
          >
            Отмена
          </button>
        ) : (
          <button
            type="button"
            onClick={handleBack}
            className="px-4 py-2.5 rounded-xl border border-border text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-muted)] transition-colors"
          >
            Назад
          </button>
        )}

        {step === "confirm" ? (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={createMutation.isPending}
            className="px-6 py-2.5 rounded-xl bg-secondary text-white text-sm font-medium hover:bg-secondary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {createMutation.isPending && (
              <svg
                className="w-4 h-4 animate-spin"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="3"
                  className="opacity-25"
                />
                <path
                  d="M4 12a8 8 0 018-8"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  className="opacity-75"
                />
              </svg>
            )}
            Подтвердить запись
          </button>
        ) : (
          <button
            type="button"
            onClick={handleNext}
            disabled={!canProceed}
            className="px-6 py-2.5 rounded-xl bg-secondary text-white text-sm font-medium hover:bg-secondary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Далее
          </button>
        )}
      </div>
    </ModalBackdrop>
  )
}

// ─── Cancel confirmation dialog ──────────────────────────────────────────────

function CancelDialog({
  isOpen,
  onClose,
  onConfirm,
  isPending,
  appointment,
}: {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  isPending: boolean
  appointment: Appointment | null
}) {
  return (
    <ModalBackdrop
      isOpen={isOpen}
      onClose={onClose}
    >
      <div className="p-6">
        <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-6 h-6 text-destructive"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </div>
        <h3 className="text-lg font-bold text-foreground text-center mb-2">Отменить запись?</h3>
        <p className="text-sm text-[var(--color-text-secondary)] text-center mb-1">
          Вы уверены, что хотите отменить запись?
        </p>
        {appointment && (
          <p className="text-sm text-[var(--color-text-tertiary)] text-center mb-6">
            {formatDate(appointment.scheduled_start)},{" "}
            {formatTime(appointment.scheduled_start)} — {formatTime(appointment.scheduled_end)}
          </p>
        )}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="flex-1 px-4 py-2.5 rounded-xl border border-border text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-muted)] transition-colors disabled:opacity-50"
          >
            Нет, оставить
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="flex-1 px-4 py-2.5 rounded-xl bg-destructive text-white text-sm font-medium hover:bg-destructive/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isPending && (
              <svg
                className="w-4 h-4 animate-spin"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="3"
                  className="opacity-25"
                />
                <path
                  d="M4 12a8 8 0 018-8"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  className="opacity-75"
                />
              </svg>
            )}
            Отменить запись
          </button>
        </div>
      </div>
    </ModalBackdrop>
  )
}

// ─── Main page ───────────────────────────────────────────────────────────────

function AppointmentsPage() {
  const queryClient = useQueryClient()
  const [isBookingOpen, setIsBookingOpen] = useState(false)
  const [cancelTarget, setCancelTarget] = useState<Appointment | null>(null)

  const {
    data: appointments,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["portal-appointments"],
    queryFn: portalApi.getAppointments,
  })

  const cancelMutation = useMutation({
    mutationFn: (id: string) => portalApi.cancelAppointment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portal-appointments"] })
      setCancelTarget(null)
    },
  })

  const typedAppointments = (appointments ?? []) as Appointment[]

  const upcoming = useMemo(
    () => typedAppointments.filter((a) => ["SCHEDULED", "CONFIRMED"].includes(a.status)),
    [typedAppointments],
  )

  const past = useMemo(
    () => typedAppointments.filter((a) => ["COMPLETED", "CANCELLED", "NO_SHOW"].includes(a.status)),
    [typedAppointments],
  )

  const handleBookingSuccess = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["portal-appointments"] })
  }, [queryClient])

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[24px] font-bold text-foreground tracking-tight animate-float-up">
          Записи на приём
        </h1>
        <button
          type="button"
          onClick={() => setIsBookingOpen(true)}
          className="px-4 py-2 rounded-xl bg-secondary text-white text-sm font-medium hover:bg-secondary/90 transition-colors animate-float-up"
          style={{ animationDelay: "50ms" }}
        >
          + Записаться
        </button>
      </div>

      {/* Loading state — skeletons */}
      {isLoading && (
        <div className="space-y-3 animate-float-up" style={{ animationDelay: "100ms" }}>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-[var(--color-surface)] rounded-xl border border-border p-5"
            >
              <div className="h-4 w-24 rounded bg-[var(--color-muted)] animate-pulse mb-3" />
              <div className="h-5 w-48 rounded bg-[var(--color-muted)] animate-pulse mb-2" />
              <div className="h-4 w-32 rounded bg-[var(--color-muted)] animate-pulse" />
            </div>
          ))}
        </div>
      )}

      {/* Error state */}
      {error && !isLoading && (
        <div className="bg-[var(--color-surface)] rounded-2xl border border-destructive/20 p-8 text-center animate-float-up" style={{ animationDelay: "100ms" }}>
          <svg
            className="w-10 h-10 mx-auto text-destructive/60 mb-3"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <circle
              cx="12"
              cy="12"
              r="10"
            />
            <path d="M12 8v4M12 16h.01" />
          </svg>
          <p className="text-sm text-[var(--color-text-secondary)] mb-3">Не удалось загрузить записи</p>
          <button
            type="button"
            onClick={() => refetch()}
            className="text-sm font-medium text-secondary hover:underline"
          >
            Попробовать снова
          </button>
        </div>
      )}

      {/* Data loaded */}
      {!isLoading && !error && (
        <>
          {/* Upcoming */}
          {upcoming.length > 0 && (
            <div
              className="mb-6 animate-float-up"
              style={{ animationDelay: "100ms" }}
            >
              <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)] mb-3">
                Предстоящие
              </h2>
              <div className="space-y-3">
                {upcoming.map((a) => (
                  <div
                    key={a.id}
                    className="bg-[var(--color-surface)] rounded-xl border border-border p-5"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[a.status] ?? ""}`}
                      >
                        {statusLabels[a.status] ?? a.status}
                      </span>
                      <span className="text-xs text-[var(--color-text-tertiary)]">
                        {appointmentTypeLabels[a.appointment_type] ?? a.appointment_type}
                      </span>
                    </div>
                    <p className="text-lg font-bold text-foreground">
                      {formatDate(a.scheduled_start)}
                    </p>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      {formatTime(a.scheduled_start)} — {formatTime(a.scheduled_end)}
                    </p>
                    {a.reason && (
                      <p className="text-sm text-[var(--color-text-tertiary)] mt-2">{a.reason}</p>
                    )}

                    {/* Cancel button */}
                    <div className="mt-3 pt-3 border-t border-border">
                      <button
                        type="button"
                        onClick={() => setCancelTarget(a)}
                        className="text-xs font-medium text-destructive/80 hover:text-destructive transition-colors"
                      >
                        Отменить запись
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty state — no upcoming */}
          {upcoming.length === 0 && past.length === 0 && (
            <div
              className="bg-[var(--color-surface)] rounded-2xl border border-border p-8 text-center mb-6 animate-float-up"
              style={{ animationDelay: "100ms" }}
            >
              <svg
                className="w-12 h-12 mx-auto text-[var(--color-text-tertiary)]/40 mb-3"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.2"
              >
                <rect
                  width="18"
                  height="18"
                  x="3"
                  y="4"
                  rx="2"
                />
                <line
                  x1="16"
                  x2="16"
                  y1="2"
                  y2="6"
                />
                <line
                  x1="8"
                  x2="8"
                  y1="2"
                  y2="6"
                />
                <line
                  x1="3"
                  x2="21"
                  y1="10"
                  y2="10"
                />
              </svg>
              <p className="text-foreground font-medium mb-1">Нет записей на приём</p>
              <p className="text-sm text-[var(--color-text-secondary)]">
                Нажмите «Записаться», чтобы выбрать врача и время
              </p>
            </div>
          )}

          {/* Past */}
          <div
            className="animate-float-up"
            style={{ animationDelay: "200ms" }}
          >
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)] mb-3">
              История
            </h2>
            {past.length === 0 ? (
              <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-8 text-center">
                <p className="text-[var(--color-text-secondary)]">Нет записей</p>
              </div>
            ) : (
              <div className="bg-[var(--color-surface)] rounded-2xl border border-border divide-y divide-border">
                {past.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center gap-4 p-4"
                  >
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        a.status === "COMPLETED"
                          ? "bg-success/10 text-success"
                          : "bg-destructive/10 text-destructive"
                      }`}
                    >
                      <svg
                        className="w-5 h-5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                      >
                        {a.status === "COMPLETED" ? (
                          <path d="M5 13l4 4L19 7" />
                        ) : (
                          <path d="M18 6 6 18M6 6l12 12" />
                        )}
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-foreground">
                        {formatDateShort(a.scheduled_start)}
                      </p>
                      <p className="text-xs text-[var(--color-text-tertiary)]">
                        {a.reason ?? "Консультация"}
                      </p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs ${statusColors[a.status] ?? ""}`}>
                      {statusLabels[a.status] ?? a.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Booking modal */}
      <BookingModal
        isOpen={isBookingOpen}
        onClose={() => setIsBookingOpen(false)}
        onSuccess={handleBookingSuccess}
      />

      {/* Cancel confirmation dialog */}
      <CancelDialog
        isOpen={cancelTarget !== null}
        onClose={() => setCancelTarget(null)}
        onConfirm={() => {
          if (cancelTarget) cancelMutation.mutate(cancelTarget.id)
        }}
        isPending={cancelMutation.isPending}
        appointment={cancelTarget}
      />
    </div>
  )
}

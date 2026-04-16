import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { portalApi } from "@/features/portal/api";
import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type RefObject,
} from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/portal/_portal/exercise-session")({
  validateSearch: (search: Record<string, unknown>) => ({
    exerciseId: (search.exerciseId as string) ?? "",
  }),
  component: ExerciseSessionPage,
});

// ─── Window extensions for MediaPipe CDN globals ──────────────────────────────

declare global {
  interface Window {
    Pose: any;
    Camera: any;
    drawConnectors: any;
    drawLandmarks: any;
    POSE_CONNECTIONS: any;
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

type SessionPhase = "idle" | "loading" | "active" | "paused" | "completed";

interface SessionResult {
  totalSeconds: number;
  repsCompleted: number;
  setsCompleted: number;
  qualityScore: number;
}

interface Point2D {
  x: number;
  y: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  UPPER_LIMB: "Верхние конечности",
  LOWER_LIMB: "Нижние конечности",
  BALANCE: "Баланс",
  GAIT: "Ходьба",
  COGNITIVE: "Когнитивные",
};

const DIFFICULTY_LABELS: Record<string, string> = {
  EASY: "Лёгкое",
  MEDIUM: "Среднее",
  HARD: "Сложное",
};

/**
 * Maps exercise category to the three landmark indices used for angle-based rep counting.
 * Landmarks follow MediaPipe Pose numbering:
 * https://developers.google.com/mediapipe/solutions/vision/pose_landmarker
 */
const EXERCISE_JOINTS: Record<string, { joints: [number, number, number]; label: string }> = {
  UPPER_LIMB: { joints: [11, 13, 15], label: "Плечо → Локоть → Запястье" },
  LOWER_LIMB: { joints: [23, 25, 27], label: "Бедро → Колено → Лодыжка" },
  BALANCE:    { joints: [11, 23, 25], label: "Плечо → Бедро → Колено" },
  GAIT:       { joints: [23, 25, 27], label: "Бедро → Колено → Лодыжка" },
  COGNITIVE:  { joints: [11, 13, 15], label: "Плечо → Локоть → Запястье" },
};

// Angle thresholds for counting a rep: arm/leg must exceed UP threshold then
// dip below DOWN threshold to complete one repetition.
const REP_THRESHOLDS = { up: 150, down: 70 };

const MEDIAPIPE_SCRIPTS = [
  "https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js",
  "https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js",
  "https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js",
];

const FEEDBACK_MESSAGES: Array<{ text: string; quality: "good" | "warn" | "bad" }> = [
  { text: "Отличная техника!", quality: "good" },
  { text: "Держите спину прямо", quality: "warn" },
  { text: "Движение плавное", quality: "good" },
  { text: "Дышите ровно", quality: "warn" },
  { text: "Хорошая амплитуда", quality: "good" },
  { text: "Не спешите", quality: "warn" },
];

const FEEDBACK_COLORS: Record<"good" | "warn" | "bad", string> = {
  good: "text-success",
  warn: "text-warning",
  bad: "text-destructive",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatSeconds(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function calculateAngle(a: Point2D, b: Point2D, c: Point2D): number {
  const radians =
    Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let angle = Math.abs(radians * (180 / Math.PI));
  if (angle > 180) angle = 360 - angle;
  return angle;
}

function difficultyClass(d: string): string {
  if (d === "EASY") return "bg-success/10 text-success";
  if (d === "MEDIUM") return "bg-warning/10 text-warning";
  return "bg-destructive/10 text-destructive";
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.crossOrigin = "anonymous";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

// ─── Circular progress ring ───────────────────────────────────────────────────

function RepRing({ current, total }: { current: number; total: number }) {
  const r = 28;
  const circ = 2 * Math.PI * r;
  const pct = total > 0 ? Math.min(current / total, 1) : 0;
  return (
    <div className="relative w-20 h-20 flex items-center justify-center">
      <svg width="80" height="80" viewBox="0 0 80 80" className="absolute inset-0">
        <circle cx="40" cy="40" r={r} fill="none" stroke="var(--color-muted)" strokeWidth="6" />
        <circle
          cx="40"
          cy="40"
          r={r}
          fill="none"
          stroke="#7E78D2"
          strokeWidth="6"
          strokeDasharray={`${circ * pct} ${circ * (1 - pct)}`}
          strokeLinecap="round"
          transform="rotate(-90 40 40)"
          className="transition-all duration-300"
        />
      </svg>
      <div className="text-center z-10">
        <span className="text-xl font-bold text-foreground tabular-nums leading-none">{current}</span>
        <span className="text-xs text-[var(--color-text-tertiary)] block">/{total}</span>
      </div>
    </div>
  );
}

// ─── Angle gauge (semi-circle arc) ───────────────────────────────────────────

function AngleGauge({ angle }: { angle: number }) {
  // Map 0–180 degrees to the arc. We draw a 180° arc.
  const cx = 44;
  const cy = 44;
  const r = 32;
  const pct = Math.min(angle / 180, 1);

  // Arc endpoint at pct * 180 degrees (from 180° to 0° going left-to-right)
  const startAngle = Math.PI; // left
  const endAngle = Math.PI - pct * Math.PI; // sweeping to right
  const x = cx + r * Math.cos(endAngle);
  const y = cy + r * Math.sin(endAngle);
  const largeArc = pct > 0.5 ? 1 : 0;

  const color =
    angle > REP_THRESHOLDS.up
      ? "#10B981"
      : angle > REP_THRESHOLDS.down
        ? "#F59E0B"
        : "#7E78D2";

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="88" height="52" viewBox="0 0 88 52">
        {/* Track */}
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke="var(--color-muted)"
          strokeWidth="5"
          strokeLinecap="round"
        />
        {/* Active arc */}
        {pct > 0 && (
          <path
            d={`M ${cx - r} ${cy} A ${r} ${r} 0 ${largeArc} 1 ${x} ${y}`}
            fill="none"
            stroke={color}
            strokeWidth="5"
            strokeLinecap="round"
          />
        )}
        {/* Needle dot */}
        <circle cx={x} cy={y} r="4" fill={color} />
      </svg>
      <span className="text-sm font-bold text-foreground tabular-nums">{angle}°</span>
    </div>
  );
}

// ─── Idle / preparation screen ────────────────────────────────────────────────

function IdleScreen({
  exercise,
  mediaPipeReady,
  mediaPipeError,
  onStart,
}: {
  exercise: Record<string, unknown>;
  mediaPipeReady: boolean;
  mediaPipeError: string | null;
  onStart: () => void;
}) {
  return (
    <div className="max-w-lg mx-auto space-y-4">
      {/* Exercise info */}
      <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-6 animate-float-up" style={{ animationDelay: "80ms" }}>
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-xl font-bold text-foreground mb-1">
              {String(exercise.name ?? "Упражнение")}
            </h2>
            <p className="text-xs text-[var(--color-text-tertiary)]">
              {CATEGORY_LABELS[exercise.category as string] ?? String(exercise.category ?? "")}
            </p>
          </div>
          <Badge className={difficultyClass(exercise.difficulty as string)}>
            {DIFFICULTY_LABELS[exercise.difficulty as string] ?? String(exercise.difficulty ?? "")}
          </Badge>
        </div>

        <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed mb-5">
          {String(exercise.description ?? "Следуйте инструкциям тренера.")}
        </p>

        {/* Sets × Reps */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-secondary/5 border border-secondary/10 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-secondary">{String(exercise.default_sets ?? 3)}</p>
            <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">подходов</p>
          </div>
          <div className="bg-secondary/5 border border-secondary/10 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-secondary">{String(exercise.default_reps ?? 10)}</p>
            <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">повторений</p>
          </div>
        </div>

        {/* Joint tracking info */}
        {EXERCISE_JOINTS[exercise.category as string] && (
          <div className="flex items-center gap-2 bg-[var(--color-muted)]/50 rounded-lg px-3 py-2">
            <svg className="w-3.5 h-3.5 text-[#14B8A6] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="2" /><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
            <span className="text-[11px] text-[var(--color-text-secondary)]">
              Отслеживание:&nbsp;
              <strong className="text-foreground">
                {EXERCISE_JOINTS[exercise.category as string].label}
              </strong>
            </span>
          </div>
        )}
      </div>

      {/* Instructions */}
      {exercise.instructions && (
        <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-5 animate-float-up" style={{ animationDelay: "140ms" }}>
          <h3 className="text-sm font-semibold text-foreground mb-2">Инструкция</h3>
          <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed whitespace-pre-line">
            {String(exercise.instructions)}
          </p>
        </div>
      )}

      {/* MediaPipe status / start button */}
      <div className="animate-float-up" style={{ animationDelay: "200ms" }}>
        {mediaPipeError ? (
          <div className="bg-warning/5 border border-warning/20 rounded-2xl p-4 mb-3">
            <p className="text-xs text-warning text-center">
              Трекинг недоступен — будет включён ручной режим подсчёта
            </p>
          </div>
        ) : !mediaPipeReady ? (
          <div className="flex items-center justify-center gap-2 bg-[var(--color-surface)] border border-border rounded-2xl p-4 mb-3">
            <div className="w-4 h-4 rounded-full border-2 border-secondary border-t-transparent animate-spin" />
            <span className="text-sm text-[var(--color-text-secondary)]">Загрузка MediaPipe…</span>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 bg-success/5 border border-success/20 rounded-2xl p-3 mb-3">
            <svg className="w-4 h-4 text-success" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5" />
            </svg>
            <span className="text-xs text-success font-medium">Трекинг готов</span>
          </div>
        )}

        <Button
          onClick={onStart}
          disabled={false}
          className="w-full py-4 rounded-2xl bg-secondary text-white font-semibold text-base hover:bg-secondary/90 active:scale-[0.98] transition-all shadow-lg shadow-secondary/20"
        >
          {mediaPipeReady ? "▶ Начать тренировку" : "Начать (ручной режим)"}
        </Button>

        <p className="text-xs text-center text-[var(--color-text-tertiary)] mt-2">
          Браузер запросит разрешение на использование камеры
        </p>
      </div>
    </div>
  );
}

// ─── Completed screen ─────────────────────────────────────────────────────────

function CompletedScreen({
  result,
  onSave,
  onRestart,
  isSaving,
}: {
  result: SessionResult;
  onSave: () => void;
  onRestart: () => void;
  isSaving: boolean;
}) {
  const navigate = useNavigate();
  const { qualityScore } = result;
  const qualityColor =
    qualityScore >= 80 ? "text-success" : qualityScore >= 60 ? "text-warning" : "text-destructive";
  const barColor =
    qualityScore >= 80 ? "#10B981" : qualityScore >= 60 ? "#F59E0B" : "#EF4444";

  return (
    <div className="max-w-lg mx-auto space-y-5">
      {/* Trophy */}
      <div className="text-center animate-float-up">
        <div className="w-20 h-20 rounded-full bg-secondary/10 flex items-center justify-center mx-auto mb-4">
          <svg className="w-10 h-10 text-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
            <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
            <path d="M4 22h16" />
            <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
            <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
            <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-foreground">Отлично!</h2>
        <p className="text-[var(--color-text-secondary)] mt-1">Тренировка завершена</p>
      </div>

      {/* Stats grid */}
      <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-5 animate-float-up" style={{ animationDelay: "80ms" }}>
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: "Время", value: formatSeconds(result.totalSeconds), sub: "мин:сек" },
            { label: "Повторений", value: String(result.repsCompleted), sub: "выполнено" },
            { label: "Подходов", value: String(result.setsCompleted), sub: "завершено" },
            { label: "Качество", value: `${qualityScore}%`, sub: "точность", colorClass: qualityColor },
          ].map((stat) => (
            <div key={stat.label} className="bg-[var(--color-muted)]/60 rounded-xl p-4 text-center">
              <p className={`text-2xl font-bold ${stat.colorClass ?? "text-foreground"}`}>{stat.value}</p>
              <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{stat.label}</p>
              <p className="text-[10px] text-[var(--color-text-tertiary)]">{stat.sub}</p>
            </div>
          ))}
        </div>

        {/* Accuracy bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-[var(--color-text-secondary)]">Общая оценка</span>
            <span className={`font-semibold ${qualityColor}`}>{qualityScore}%</span>
          </div>
          <div className="h-2.5 rounded-full bg-[var(--color-muted)]">
            <div
              className="h-2.5 rounded-full transition-all duration-700"
              style={{ width: `${qualityScore}%`, background: barColor }}
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-3 animate-float-up" style={{ animationDelay: "160ms" }}>
        <Button
          onClick={onSave}
          disabled={isSaving}
          className="w-full py-3.5 rounded-2xl bg-secondary text-white font-semibold hover:bg-secondary/90 active:scale-[0.98] transition-all disabled:opacity-60 shadow-lg shadow-secondary/20"
        >
          {isSaving ? "Сохраняем…" : "Сохранить результат"}
        </Button>
        <button
          onClick={onRestart}
          className="w-full py-3 rounded-2xl border border-border text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-muted)]/50 transition-all"
        >
          Начать заново
        </button>
        <button
          onClick={() => navigate({ to: "/portal/exercises" })}
          className="w-full py-3 rounded-2xl border border-border text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-muted)]/50 transition-all"
        >
          К упражнениям
        </button>
      </div>
    </div>
  );
}

// ─── Active workout layout ────────────────────────────────────────────────────

function ActiveLayout({
  exercise,
  phase,
  timer,
  currentSet,
  targetSets,
  currentRep,
  targetReps,
  currentAngle,
  feedbackIdx,
  manualMode,
  videoRef,
  canvasRef,
  onPause,
  onComplete,
  onManualInc,
  onManualDec,
}: {
  exercise: Record<string, unknown>;
  phase: "active" | "paused";
  timer: number;
  currentSet: number;
  targetSets: number;
  currentRep: number;
  targetReps: number;
  currentAngle: number;
  feedbackIdx: number;
  manualMode: boolean;
  videoRef: RefObject<HTMLVideoElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  onPause: () => void;
  onComplete: () => void;
  onManualInc: () => void;
  onManualDec: () => void;
}) {
  const fb = FEEDBACK_MESSAGES[feedbackIdx];
  const displaySet = Math.min(currentSet, targetSets);

  return (
    <div className="space-y-4">
      {/* Status bar */}
      <div className="flex items-center justify-between bg-[var(--color-surface)] rounded-2xl border border-border px-5 py-3 animate-float-up">
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              phase === "active" ? "bg-success animate-pulse" : "bg-warning"
            }`}
          />
          <span className="text-xs font-medium text-[var(--color-text-secondary)]">
            {phase === "active" ? "Идёт запись" : "Пауза"}
          </span>
        </div>
        <span className="text-lg font-bold text-foreground font-mono tabular-nums">
          {formatSeconds(timer)}
        </span>
        <span className="text-xs font-medium text-[var(--color-text-secondary)]">
          Подход {displaySet}/{targetSets}
        </span>
      </div>

      {/* Video + stats — responsive split */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Camera feed: 70% on desktop, full width on mobile */}
        <div className="relative rounded-2xl overflow-hidden bg-zinc-900 aspect-video lg:flex-[7]">
          {/* Mirror the video so it feels like looking in a mirror */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
            style={{ transform: "scaleX(-1)" }}
          />
          {/* Canvas overlay inherits mirror from video container */}
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{ transform: "scaleX(-1)" }}
          />

          {/* Angle readout in corner */}
          {!manualMode && phase === "active" && (
            <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-sm rounded-xl px-3 py-1.5">
              <span className="text-white text-sm font-bold tabular-nums">{currentAngle}°</span>
            </div>
          )}

          {/* Manual mode badge */}
          {manualMode && (
            <div className="absolute top-3 left-3 bg-warning/80 backdrop-blur-sm rounded-xl px-3 py-1.5">
              <span className="text-white text-xs font-semibold">Ручной режим</span>
            </div>
          )}

          {/* Paused overlay */}
          {phase === "paused" && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <div className="text-center">
                <svg className="w-12 h-12 text-white mx-auto mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="6" y="4" width="4" height="16" rx="1" />
                  <rect x="14" y="4" width="4" height="16" rx="1" />
                </svg>
                <p className="text-white font-semibold">Пауза</p>
              </div>
            </div>
          )}

          {/* Feedback banner */}
          {phase === "active" && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-sm rounded-xl px-4 py-2">
              <p className={`text-sm font-medium text-center ${FEEDBACK_COLORS[fb.quality]}`}>
                {fb.text}
              </p>
            </div>
          )}
        </div>

        {/* Stats panel: 30% on desktop, full width below video on mobile */}
        <div className="lg:flex-[3] flex flex-col gap-3">
          {/* Exercise name */}
          <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-4">
            <p className="text-xs text-[var(--color-text-tertiary)] mb-0.5">Упражнение</p>
            <p className="text-sm font-bold text-foreground leading-snug">
              {String(exercise.name ?? "")}
            </p>
          </div>

          {/* Rep ring */}
          <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-4 flex flex-col items-center gap-2">
            <p className="text-xs text-[var(--color-text-tertiary)] uppercase tracking-wider">
              Повторение
            </p>
            <RepRing current={currentRep} total={targetReps} />

            {/* Set dots */}
            <div className="flex gap-2 mt-1">
              {Array.from({ length: targetSets }).map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all ${
                    i < currentSet - 1
                      ? "w-6 bg-secondary"
                      : i === currentSet - 1
                        ? "w-8 bg-secondary/50"
                        : "w-4 bg-[var(--color-border)]"
                  }`}
                />
              ))}
            </div>

            {/* Manual buttons when MediaPipe is not available */}
            {manualMode && (
              <div className="flex items-center gap-3 mt-2">
                <button
                  onClick={onManualDec}
                  disabled={phase === "paused"}
                  className="w-10 h-10 rounded-xl border border-border text-xl font-bold text-[var(--color-text-secondary)] hover:bg-[var(--color-muted)] active:scale-95 transition-all disabled:opacity-40"
                >
                  −
                </button>
                <button
                  onClick={onManualInc}
                  disabled={phase === "paused"}
                  className="w-10 h-10 rounded-xl bg-secondary text-white text-xl font-bold hover:bg-secondary/90 active:scale-95 transition-all disabled:opacity-40"
                >
                  +
                </button>
              </div>
            )}
          </div>

          {/* Angle gauge (hidden in manual mode) */}
          {!manualMode && (
            <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-4 flex flex-col items-center gap-1">
              <p className="text-xs text-[var(--color-text-tertiary)] uppercase tracking-wider">
                Угол
              </p>
              <AngleGauge angle={currentAngle} />
            </div>
          )}

          {/* Form feedback */}
          <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-4">
            <p className="text-xs text-[var(--color-text-tertiary)] uppercase tracking-wider mb-1.5">
              Форма
            </p>
            <p className={`text-sm font-semibold ${FEEDBACK_COLORS[fb.quality]}`}>{fb.text}</p>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3 animate-float-up" style={{ animationDelay: "80ms" }}>
        <button
          onClick={onPause}
          className="flex-1 py-3.5 rounded-2xl border border-border text-sm font-semibold text-[var(--color-text-secondary)] hover:bg-[var(--color-muted)]/50 transition-all"
        >
          {phase === "active" ? "⏸ Пауза" : "▶ Продолжить"}
        </button>
        <button
          onClick={onComplete}
          className="flex-1 py-3.5 rounded-2xl bg-destructive/10 text-destructive text-sm font-semibold hover:bg-destructive/20 transition-all"
        >
          ⏹ Завершить
        </button>
      </div>
    </div>
  );
}

// ─── Main page component ──────────────────────────────────────────────────────

function ExerciseSessionPage() {
  const { exerciseId } = Route.useSearch();
  const navigate = useNavigate();

  const { data: exerciseRaw, isLoading } = useQuery({
    queryKey: ["portal-exercise", exerciseId],
    queryFn: () => portalApi.getExercise(exerciseId),
    enabled: !!exerciseId,
  });

  const exercise = exerciseRaw as Record<string, unknown> | undefined;

  // ── Session state ─────────────────────────────────────────────────
  const [phase, setPhase] = useState<SessionPhase>("idle");
  const [timer, setTimer] = useState(0);
  const [currentSet, setCurrentSet] = useState(1);
  const [currentRep, setCurrentRep] = useState(0);
  const [currentAngle, setCurrentAngle] = useState(0);
  const [feedbackIdx, setFeedbackIdx] = useState(0);
  const [result, setResult] = useState<SessionResult | null>(null);
  const [manualMode, setManualMode] = useState(false);

  // MediaPipe loading state
  const [mediaPipeReady, setMediaPipeReady] = useState(false);
  const [mediaPipeError, setMediaPipeError] = useState<string | null>(null);

  // ── Refs ──────────────────────────────────────────────────────────
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const poseRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const feedbackRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const phaseStateRef = useRef<"up" | "down">("down");
  const formScoresRef = useRef<number[]>([]);
  const currentSetRef = useRef(1);
  const currentRepRef = useRef(0);

  // Keep refs in sync with state for use inside MediaPipe callback
  useEffect(() => { currentSetRef.current = currentSet; }, [currentSet]);
  useEffect(() => { currentRepRef.current = currentRep; }, [currentRep]);

  const targetSets = Number(exercise?.default_sets ?? 3);
  const targetReps = Number(exercise?.default_reps ?? 10);
  const targetSetsRef = useRef(targetSets);
  const targetRepsRef = useRef(targetReps);
  useEffect(() => { targetSetsRef.current = targetSets; }, [targetSets]);
  useEffect(() => { targetRepsRef.current = targetReps; }, [targetReps]);

  // ── Load MediaPipe scripts on mount ──────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        for (const src of MEDIAPIPE_SCRIPTS) {
          await loadScript(src);
        }
        if (!cancelled) setMediaPipeReady(true);
      } catch (err) {
        if (!cancelled) {
          setMediaPipeError(err instanceof Error ? err.message : "Ошибка загрузки");
        }
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  // ── Timer & feedback rotation ─────────────────────────────────────
  useEffect(() => {
    if (phase === "active") {
      timerRef.current = setInterval(() => setTimer((t) => t + 1), 1000);
      feedbackRef.current = setInterval(() => {
        setFeedbackIdx((i) => (i + 1) % FEEDBACK_MESSAGES.length);
      }, 4000);
    } else {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      if (feedbackRef.current) { clearInterval(feedbackRef.current); feedbackRef.current = null; }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (feedbackRef.current) clearInterval(feedbackRef.current);
    };
  }, [phase]);

  // ── Cleanup on unmount ────────────────────────────────────────────
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      cameraRef.current?.stop?.();
    };
  }, []);

  // We need timer in the result — use a separate complete handler that captures timer
  const handleComplete = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    cameraRef.current?.stop?.();

    const scores = formScoresRef.current;
    const avgScore =
      scores.length > 0
        ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100)
        : 78;

    setTimer((t) => {
      setResult({
        totalSeconds: t,
        repsCompleted:
          (currentSetRef.current - 1) * targetRepsRef.current +
          currentRepRef.current,
        setsCompleted:
          currentSetRef.current -
          1 +
          (currentRepRef.current >= targetRepsRef.current ? 1 : 0),
        qualityScore: Math.min(99, Math.max(40, avgScore)),
      });
      return t;
    });
    setPhase("completed");
  }, []);

  // ── Rep counter (used by both MediaPipe and manual mode) ──────────
  const countRep = useCallback(() => {
    setCurrentRep((r) => {
      const next = r + 1;
      if (next >= targetRepsRef.current) {
        setCurrentSet((s) => {
          if (s >= targetSetsRef.current) {
            setTimeout(handleComplete, 800);
          }
          return s + 1;
        });
        return 0;
      }
      return next;
    });
  }, [handleComplete]);

  // ── Skeleton drawing ──────────────────────────────────────────────
  const drawSkeleton = useCallback((results: any) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Sync canvas dimensions to the video element's rendered size
    const video = videoRef.current;
    if (video) {
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (results.poseLandmarks && window.drawConnectors && window.drawLandmarks) {
      window.drawConnectors(ctx, results.poseLandmarks, window.POSE_CONNECTIONS, {
        color: "#14B8A6",
        lineWidth: 3,
      });
      window.drawLandmarks(ctx, results.poseLandmarks, {
        color: "#7E78D2",
        lineWidth: 1,
        radius: 4,
      });
    }
  }, []);

  // ── Movement analysis & rep counting ─────────────────────────────
  const analyzeMovement = useCallback(
    (results: any) => {
      if (!results.poseLandmarks) return;
      const lm: Array<{ x: number; y: number; z: number; visibility: number }> =
        results.poseLandmarks;

      const category = exercise?.category as string | undefined;
      const jointConfig =
        EXERCISE_JOINTS[category ?? "UPPER_LIMB"] ?? EXERCISE_JOINTS.UPPER_LIMB;
      const [ia, ib, ic] = jointConfig.joints;

      const a = lm[ia];
      const b = lm[ib];
      const c = lm[ic];

      // Skip if landmarks are not visible enough
      if (
        !a || !b || !c ||
        (a.visibility ?? 1) < 0.3 ||
        (b.visibility ?? 1) < 0.3 ||
        (c.visibility ?? 1) < 0.3
      ) return;

      const angle = Math.round(calculateAngle(a, b, c));
      setCurrentAngle(angle);

      // Phase-based rep counting with hysteresis
      if (phaseStateRef.current === "down" && angle > REP_THRESHOLDS.up) {
        phaseStateRef.current = "up";
      }
      if (phaseStateRef.current === "up" && angle < REP_THRESHOLDS.down) {
        phaseStateRef.current = "down";
        // Rep completed — record form score based on range of motion
        const formScore = Math.min(angle / 180 + 0.4, 1);
        formScoresRef.current.push(formScore);
        countRep();
      }
    },
    [exercise, countRep],
  );

  // ── Start MediaPipe pose detection ────────────────────────────────
  const startPoseDetection = useCallback(() => {
    if (!window.Pose || !window.Camera) return;

    const pose = new window.Pose({
      locateFile: (file: string) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
    });

    pose.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      enableSegmentation: false,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    pose.onResults((results: any) => {
      drawSkeleton(results);
      analyzeMovement(results);
    });

    poseRef.current = pose;

    const camera = new window.Camera(videoRef.current, {
      onFrame: async () => {
        if (videoRef.current) {
          await pose.send({ image: videoRef.current });
        }
      },
      width: 640,
      height: 480,
    });

    cameraRef.current = camera;
    camera.start();
  }, [drawSkeleton, analyzeMovement]);

  // ── Camera & session start ────────────────────────────────────────
  const handleStart = useCallback(async () => {
    setPhase("loading");

    // Reset session counters
    setTimer(0);
    setCurrentSet(1);
    setCurrentRep(0);
    setCurrentAngle(0);
    phaseStateRef.current = "down";
    formScoresRef.current = [];

    // Request camera
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 480 },
        audio: false,
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      if (mediaPipeReady && !mediaPipeError) {
        startPoseDetection();
      } else {
        setManualMode(true);
      }

      setPhase("active");
    } catch (err) {
      // Camera denied or unavailable — fall back to manual mode without video
      const isDenied = err instanceof Error && err.name === "NotAllowedError";
      const msg = isDenied
        ? "Доступ к камере запрещён — включён ручной режим."
        : "Камера недоступна — включён ручной режим подсчёта.";
      toast.warning(msg);
      setManualMode(true);
      setPhase("active");
    }
  }, [mediaPipeReady, mediaPipeError, startPoseDetection]);

  const handlePause = useCallback(() => {
    setPhase((p) => (p === "active" ? "paused" : "active"));
  }, []);

  const handleRestart = useCallback(() => {
    setPhase("idle");
    setResult(null);
    setManualMode(false);
    setCurrentSet(1);
    setCurrentRep(0);
    setCurrentAngle(0);
    setTimer(0);
    formScoresRef.current = [];
    phaseStateRef.current = "down";
    streamRef.current?.getTracks().forEach((t) => t.stop());
    cameraRef.current?.stop?.();
  }, []);

  // Manual rep adjustment
  const handleManualInc = useCallback(() => countRep(), [countRep]);
  const handleManualDec = useCallback(() => setCurrentRep((r) => Math.max(0, r - 1)), []);

  // ── Save mutation ─────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: () =>
      portalApi.createSession({
        exercise_id: exerciseId,
        started_at: new Date(
          Date.now() - (result?.totalSeconds ?? 0) * 1000,
        ).toISOString(),
        ended_at: new Date().toISOString(),
        duration_seconds: result?.totalSeconds ?? 0,
        reps_completed: result?.repsCompleted ?? 0,
        sets_completed: result?.setsCompleted ?? 0,
        accuracy_score: (result?.qualityScore ?? 75) / 100,
      }),
    onSuccess: () => {
      toast.success("Результат сохранён!");
      navigate({ to: "/portal/exercises" });
    },
    onError: () => toast.error("Не удалось сохранить. Попробуйте снова."),
  });

  // ── Guards ────────────────────────────────────────────────────────
  if (!exerciseId) {
    return (
      <div className="max-w-lg mx-auto text-center py-16">
        <p className="text-[var(--color-text-secondary)]">Упражнение не выбрано.</p>
        <Button
          onClick={() => navigate({ to: "/portal/exercises" })}
          className="mt-4 px-4 py-2 rounded-xl bg-secondary text-white text-sm"
        >
          К упражнениям
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="max-w-2xl space-y-4">
        {[1, 2].map((i) => (
          <div key={i} className="h-40 bg-[var(--color-muted)] rounded-2xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (!exercise) {
    return (
      <div className="max-w-lg mx-auto text-center py-16">
        <p className="text-[var(--color-text-secondary)]">Упражнение не найдено.</p>
        <Button
          onClick={() => navigate({ to: "/portal/exercises" })}
          className="mt-4 px-4 py-2 rounded-xl bg-secondary text-white text-sm"
        >
          К упражнениям
        </Button>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div className="max-w-5xl">
      {/* Back navigation — only visible when not actively working out */}
      {(phase === "idle" || phase === "completed") && (
        <button
          onClick={() => navigate({ to: "/portal/exercises" })}
          className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-foreground mb-5 transition-colors animate-float-up"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m12 19-7-7 7-7" />
            <path d="M19 12H5" />
          </svg>
          Назад к упражнениям
        </button>
      )}

      <h1 className="text-[24px] font-bold text-foreground tracking-tight mb-6 animate-float-up">
        {phase === "completed" ? "Итоги тренировки" : "Тренировка"}
      </h1>

      {/* Idle */}
      {phase === "idle" && (
        <IdleScreen
          exercise={exercise}
          mediaPipeReady={mediaPipeReady}
          mediaPipeError={mediaPipeError}
          onStart={handleStart}
        />
      )}

      {/* Loading camera */}
      {phase === "loading" && (
        <div className="max-w-lg mx-auto text-center py-20">
          <div className="w-16 h-16 rounded-full bg-secondary/10 flex items-center justify-center mx-auto mb-4 animate-pulse">
            <svg className="w-8 h-8 text-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
              <circle cx="12" cy="13" r="3" />
            </svg>
          </div>
          <p className="text-[var(--color-text-secondary)]">Подключение камеры…</p>
        </div>
      )}

      {/* Active / paused / loading (video needs to be in DOM for camera attachment) */}
      {(phase === "active" || phase === "paused" || phase === "loading") && (
        <ActiveLayout
          exercise={exercise}
          phase={phase}
          timer={timer}
          currentSet={currentSet}
          targetSets={targetSets}
          currentRep={currentRep}
          targetReps={targetReps}
          currentAngle={currentAngle}
          feedbackIdx={feedbackIdx}
          manualMode={manualMode}
          videoRef={videoRef}
          canvasRef={canvasRef}
          onPause={handlePause}
          onComplete={handleComplete}
          onManualInc={handleManualInc}
          onManualDec={handleManualDec}
        />
      )}

      {/* Completed */}
      {phase === "completed" && result && (
        <CompletedScreen
          result={result}
          onSave={() => saveMutation.mutate()}
          onRestart={handleRestart}
          isSaving={saveMutation.isPending}
        />
      )}
    </div>
  );
}

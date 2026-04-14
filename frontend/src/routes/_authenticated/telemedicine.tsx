import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useRef, useEffect, useCallback } from "react";
import apiClient from "@/lib/api-client";

export const Route = createFileRoute("/_authenticated/telemedicine")({
  component: TelemedicinePage,
});

// ── Types ──────────────────────────────────────────────────────────────────────

interface TeleSession {
  id: string;
  patient_id: string;
  patient_name: string;
  doctor_id: string;
  doctor_name: string;
  room_id: string;
  status: "WAITING" | "ACTIVE" | "COMPLETED" | "CANCELLED";
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  doctor_notes: string | null;
  created_at: string;
}

interface ChatMessage {
  id: string;
  sender_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

interface Patient {
  id: string;
  first_name: string;
  last_name: string;
}

// ── API helpers ────────────────────────────────────────────────────────────────

const teleApi = {
  listSessions: (status?: string) => {
    const q = status ? `?status=${status}` : "";
    return apiClient.get<TeleSession[]>(`/telemedicine/sessions${q}`).then((r) => r.data);
  },
  createSession: (patientId: string) =>
    apiClient
      .post<TeleSession>(`/telemedicine/sessions?patient_id=${patientId}`)
      .then((r) => r.data),
  updateSession: (id: string, params: { status?: string; doctor_notes?: string }) => {
    const q = new URLSearchParams();
    if (params.status) q.set("status", params.status);
    if (params.doctor_notes !== undefined) q.set("doctor_notes", params.doctor_notes);
    return apiClient.patch<TeleSession>(`/telemedicine/sessions/${id}?${q}`).then((r) => r.data);
  },
  listMessages: (sessionId: string) =>
    apiClient.get<ChatMessage[]>(`/telemedicine/sessions/${sessionId}/messages`).then((r) => r.data),
  sendMessage: (sessionId: string, content: string) =>
    apiClient
      .post(`/telemedicine/sessions/${sessionId}/messages?content=${encodeURIComponent(content)}`)
      .then((r) => r.data),
};

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  WAITING: "Ожидание",
  ACTIVE: "Активна",
  COMPLETED: "Завершена",
  CANCELLED: "Отменена",
};

const STATUS_COLOR: Record<string, string> = {
  WAITING: "bg-amber-100 text-amber-800 border-amber-200",
  ACTIVE: "bg-green-100 text-green-800 border-green-200",
  COMPLETED: "bg-gray-100 text-gray-600 border-gray-200",
  CANCELLED: "bg-red-100 text-red-600 border-red-200",
};

const STATUS_DOT: Record<string, string> = {
  WAITING: "bg-amber-500",
  ACTIVE: "bg-green-500",
  COMPLETED: "bg-gray-400",
  CANCELLED: "bg-red-400",
};

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}м ${s}с`;
}

function formatDateTime(str: string): string {
  return new Date(str).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTime(str: string): string {
  return new Date(str).toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── Camera Preview Component ───────────────────────────────────────────────────

function CameraPreview({ active }: { active: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState(false);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setHasPermission(true);
      setError(null);
    } catch (err) {
      setError("Нет доступа к камере или микрофону");
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setHasPermission(false);
  }, []);

  useEffect(() => {
    if (active) {
      startCamera();
    }
    return () => {
      stopCamera();
    };
  }, [active, startCamera, stopCamera]);

  const toggleMute = () => {
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach((t) => {
        t.enabled = muted;
      });
      setMuted(!muted);
    }
  };

  const toggleCamera = () => {
    if (streamRef.current) {
      streamRef.current.getVideoTracks().forEach((t) => {
        t.enabled = cameraOff;
      });
      setCameraOff(!cameraOff);
    }
  };

  if (!active) return null;

  return (
    <div className="flex flex-col gap-3">
      {/* Notice */}
      <div className="flex items-start gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-700">
        <svg className="w-4 h-4 mt-0.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4M12 8h.01" />
        </svg>
        <span>
          Предпросмотр локальной камеры. Для полноценного видеозвонка необходима интеграция WebRTC с TURN/STUN-сервером.
        </span>
      </div>

      {/* Video grid */}
      <div className="grid grid-cols-2 gap-2">
        {/* Local camera */}
        <div className="relative aspect-video bg-gray-900 rounded-xl overflow-hidden">
          {error ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-gray-400">
              <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="m16 16-4-4-4 4" />
                <path d="M12 12V3" />
                <rect width="20" height="14" x="2" y="7" rx="2" />
              </svg>
              <p className="text-xs text-center px-2">{error}</p>
              <button
                onClick={startCamera}
                className="mt-1 px-3 py-1 bg-primary/80 text-white text-xs rounded-lg hover:bg-primary transition-colors"
              >
                Повторить
              </button>
            </div>
          ) : (
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className={`w-full h-full object-cover ${cameraOff ? "opacity-0" : ""}`}
            />
          )}
          {cameraOff && !error && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
              <div className="w-16 h-16 rounded-full bg-gray-700 flex items-center justify-center">
                <svg className="w-8 h-8 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
            </div>
          )}
          <div className="absolute bottom-2 left-2 text-[10px] bg-black/60 text-white px-2 py-0.5 rounded-full">
            Вы (Врач)
          </div>
          {hasPermission && (
            <div className="absolute top-2 right-2 flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-[10px] text-white bg-black/50 px-1.5 py-0.5 rounded-full">LIVE</span>
            </div>
          )}
        </div>

        {/* Remote placeholder */}
        <div className="relative aspect-video bg-gray-800 rounded-xl overflow-hidden flex items-center justify-center">
          <div className="flex flex-col items-center gap-2 text-gray-500">
            <div className="w-16 h-16 rounded-full bg-gray-700 flex items-center justify-center">
              <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <p className="text-xs">Ожидание пациента...</p>
          </div>
          <div className="absolute bottom-2 left-2 text-[10px] bg-black/60 text-white px-2 py-0.5 rounded-full">
            Пациент
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={toggleMute}
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
            muted ? "bg-red-500 text-white" : "bg-[var(--color-muted)] text-foreground hover:bg-[var(--color-muted)]/80"
          }`}
          title={muted ? "Включить микрофон" : "Выключить микрофон"}
        >
          {muted ? (
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="1" x2="23" y1="1" y2="23" />
              <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
              <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
              <line x1="12" x2="12" y1="19" y2="22" />
            </svg>
          ) : (
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" x2="12" y1="19" y2="22" />
            </svg>
          )}
        </button>

        <button
          onClick={toggleCamera}
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
            cameraOff ? "bg-red-500 text-white" : "bg-[var(--color-muted)] text-foreground hover:bg-[var(--color-muted)]/80"
          }`}
          title={cameraOff ? "Включить камеру" : "Выключить камеру"}
        >
          {cameraOff ? (
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m16 16-4-4-4 4" />
              <line x1="1" x2="23" y1="1" y2="23" />
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h11" />
            </svg>
          ) : (
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="23 7 16 12 23 17 23 7" />
              <rect width="15" height="14" x="1" y="5" rx="2" ry="2" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}

// ── Chat Panel ─────────────────────────────────────────────────────────────────

function ChatPanel({
  sessionId,
  currentUserId,
}: {
  sessionId: string;
  currentUserId: string;
}) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data: messages = [] } = useQuery({
    queryKey: ["tele-messages", sessionId],
    queryFn: () => teleApi.listMessages(sessionId),
    refetchInterval: 3000,
  });

  const sendMutation = useMutation({
    mutationFn: (content: string) => teleApi.sendMessage(sessionId, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tele-messages", sessionId] });
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || sendMutation.isPending) return;
    setInput("");
    sendMutation.mutate(trimmed);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
        {messages.length === 0 ? (
          <div className="text-center text-xs text-[var(--color-text-tertiary)] py-6">
            Нет сообщений
          </div>
        ) : (
          messages.map((m) => {
            const isOwn = m.sender_id === currentUserId;
            return (
              <div
                key={m.id}
                className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm leading-snug ${
                    isOwn
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-[var(--color-muted)] text-foreground rounded-bl-sm"
                  }`}
                >
                  <p>{m.content}</p>
                  <p className={`text-[10px] mt-0.5 ${isOwn ? "text-primary-foreground/60" : "text-[var(--color-text-tertiary)]"}`}>
                    {formatTime(m.created_at)}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
      <div className="border-t border-border p-2 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
          placeholder="Сообщение..."
          className="flex-1 px-3 py-2 text-sm bg-[var(--color-muted)] rounded-xl border border-border focus:outline-none focus:border-primary/50 transition-colors"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || sendMutation.isPending}
          className="w-9 h-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors disabled:opacity-40"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m22 2-7 20-4-9-9-4 20-7z" />
            <path d="M22 2 11 13" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ── Active Session View ────────────────────────────────────────────────────────

function ActiveSessionView({
  session,
  currentUserId,
  onClose,
}: {
  session: TeleSession;
  currentUserId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState(session.doctor_notes ?? "");
  const [notesSaved, setNotesSaved] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [activeTab, setActiveTab] = useState<"video" | "chat">("video");

  const startedAt = session.started_at ? new Date(session.started_at).getTime() : Date.now();

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  const updateMutation = useMutation({
    mutationFn: (params: { status?: string; doctor_notes?: string }) =>
      teleApi.updateSession(session.id, params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tele-sessions"] });
    },
  });

  const handleSaveNotes = () => {
    updateMutation.mutate({ doctor_notes: notes });
    setNotesSaved(true);
    setTimeout(() => setNotesSaved(false), 2000);
  };

  const handleEnd = () => {
    updateMutation.mutate({ status: "COMPLETED", doctor_notes: notes });
    onClose();
  };

  const handleCancel = () => {
    updateMutation.mutate({ status: "CANCELLED" });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col">
      {/* Top bar */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-border bg-[var(--color-surface)] flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${STATUS_DOT[session.status]} animate-pulse`} />
          <span className="font-semibold text-sm">{session.patient_name || "Пациент"}</span>
          <span className="text-xs text-[var(--color-text-tertiary)] font-mono bg-[var(--color-muted)] px-2 py-0.5 rounded-full">
            {formatDuration(elapsed)}
          </span>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${STATUS_COLOR[session.status]}`}>
            {STATUS_LABEL[session.status]}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleEnd}
            disabled={updateMutation.isPending}
            className="px-4 py-1.5 bg-destructive text-destructive-foreground text-sm font-medium rounded-xl hover:bg-destructive/90 transition-colors disabled:opacity-50"
          >
            Завершить
          </button>
          <button
            onClick={handleCancel}
            disabled={updateMutation.isPending}
            className="px-3 py-1.5 text-sm text-[var(--color-text-secondary)] hover:text-foreground border border-border rounded-xl hover:bg-[var(--color-muted)] transition-colors"
          >
            Отменить
          </button>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--color-text-tertiary)] hover:text-foreground hover:bg-[var(--color-muted)] transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left: video / chat tabs */}
        <div className="flex-1 flex flex-col min-w-0 border-r border-border">
          {/* Tab switcher */}
          <div className="flex border-b border-border px-4 pt-3 gap-1 bg-[var(--color-surface)] flex-shrink-0">
            {(["video", "chat"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-medium rounded-t-xl transition-colors ${
                  activeTab === tab
                    ? "bg-background text-foreground border border-b-background border-border -mb-px"
                    : "text-[var(--color-text-secondary)] hover:text-foreground"
                }`}
              >
                {tab === "video" ? "Видео" : "Чат"}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-auto p-4">
            {activeTab === "video" ? (
              <CameraPreview active={true} />
            ) : (
              <div className="h-full flex flex-col" style={{ minHeight: "400px" }}>
                <ChatPanel sessionId={session.id} currentUserId={currentUserId} />
              </div>
            )}
          </div>
        </div>

        {/* Right: notes + info panel */}
        <div className="w-72 flex-shrink-0 flex flex-col bg-[var(--color-surface)]">
          {/* Session info */}
          <div className="p-4 border-b border-border space-y-2">
            <h3 className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wide">
              Информация о сессии
            </h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-[var(--color-text-secondary)]">Пациент</span>
                <span className="font-medium text-right">{session.patient_name || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-text-secondary)]">Врач</span>
                <span className="font-medium text-right">{session.doctor_name || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-text-secondary)]">Комната</span>
                <span className="font-mono text-xs font-medium">{session.room_id}</span>
              </div>
              {session.started_at && (
                <div className="flex justify-between">
                  <span className="text-[var(--color-text-secondary)]">Начало</span>
                  <span className="font-medium">{formatDateTime(session.started_at)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          <div className="flex-1 flex flex-col p-4 gap-3">
            <h3 className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wide">
              Заметки врача
            </h3>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Введите заметки о консультации..."
              className="flex-1 w-full px-3 py-2 text-sm bg-[var(--color-muted)] border border-border rounded-xl resize-none focus:outline-none focus:border-primary/50 transition-colors min-h-[200px]"
            />
            <button
              onClick={handleSaveNotes}
              disabled={updateMutation.isPending}
              className="w-full py-2 text-sm font-medium bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {notesSaved ? "Сохранено!" : "Сохранить заметки"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Create Session Dialog ──────────────────────────────────────────────────────

function CreateSessionDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (s: TeleSession) => void;
}) {
  const [search, setSearch] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const queryClient = useQueryClient();

  const { data: patients = [] } = useQuery({
    queryKey: ["patients-search-tele", search],
    queryFn: () =>
      apiClient
        .get<{ items: Patient[] }>(`/patients?search=${encodeURIComponent(search)}&limit=20`)
        .then((r) => r.data.items ?? r.data),
    enabled: search.length >= 1,
  });

  const createMutation = useMutation({
    mutationFn: (patientId: string) => teleApi.createSession(patientId),
    onSuccess: (newSession) => {
      queryClient.invalidateQueries({ queryKey: ["tele-sessions"] });
      onCreated(newSession);
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-[var(--color-surface)] rounded-2xl border border-border shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Новая сессия</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--color-text-tertiary)] hover:text-foreground hover:bg-[var(--color-muted)] transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-[var(--color-text-secondary)] mb-1.5 block">
              Поиск пациента
            </label>
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setSelectedPatient(null); }}
              placeholder="Введите имя или фамилию..."
              className="w-full px-3 py-2 text-sm bg-[var(--color-muted)] border border-border rounded-xl focus:outline-none focus:border-primary/50 transition-colors"
              autoFocus
            />
          </div>

          {search.length >= 1 && (
            <div className="border border-border rounded-xl overflow-hidden max-h-48 overflow-y-auto">
              {patients.length === 0 ? (
                <div className="py-4 text-center text-sm text-[var(--color-text-tertiary)]">
                  Пациенты не найдены
                </div>
              ) : (
                patients.map((p: Patient) => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPatient(p)}
                    className={`w-full text-left px-4 py-2.5 text-sm hover:bg-[var(--color-muted)] transition-colors border-b border-border/50 last:border-0 ${
                      selectedPatient?.id === p.id ? "bg-primary/10 text-primary font-medium" : ""
                    }`}
                  >
                    {p.last_name} {p.first_name}
                  </button>
                ))
              )}
            </div>
          )}

          {selectedPatient && (
            <div className="flex items-center gap-2 px-3 py-2 bg-primary/10 border border-primary/20 rounded-xl">
              <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold">
                {selectedPatient.last_name[0]}
              </div>
              <span className="text-sm font-medium text-primary">
                {selectedPatient.last_name} {selectedPatient.first_name}
              </span>
            </div>
          )}

          <button
            onClick={() => selectedPatient && createMutation.mutate(selectedPatient.id)}
            disabled={!selectedPatient || createMutation.isPending}
            className="w-full py-2.5 bg-primary text-primary-foreground font-medium rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-40"
          >
            {createMutation.isPending ? "Создание..." : "Начать сессию"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Session Card ───────────────────────────────────────────────────────────────

function SessionCard({
  session,
  onOpen,
  onActivate,
}: {
  session: TeleSession;
  onOpen: () => void;
  onActivate: () => void;
}) {
  return (
    <div className="bg-[var(--color-surface)] border border-border rounded-2xl p-4 hover:border-[var(--color-text-tertiary)] transition-all duration-200 group">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className={`mt-0.5 w-2.5 h-2.5 rounded-full flex-shrink-0 ${STATUS_DOT[session.status]} ${session.status === "ACTIVE" ? "animate-pulse" : ""}`} />
          <div className="min-w-0">
            <p className="font-semibold text-sm text-foreground truncate">
              {session.patient_name || "Пациент"}
            </p>
            <p className="text-xs text-[var(--color-text-tertiary)] truncate mt-0.5">
              Врач: {session.doctor_name || "—"}
            </p>
          </div>
        </div>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border flex-shrink-0 ${STATUS_COLOR[session.status]}`}>
          {STATUS_LABEL[session.status]}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-[var(--color-text-secondary)]">
        <div>
          <span className="text-[var(--color-text-tertiary)]">Комната:</span>{" "}
          <span className="font-mono">{session.room_id}</span>
        </div>
        <div>
          <span className="text-[var(--color-text-tertiary)]">Создана:</span>{" "}
          {formatDateTime(session.created_at)}
        </div>
        {session.duration_seconds !== null && (
          <div>
            <span className="text-[var(--color-text-tertiary)]">Длительность:</span>{" "}
            {formatDuration(session.duration_seconds)}
          </div>
        )}
        {session.started_at && (
          <div>
            <span className="text-[var(--color-text-tertiary)]">Начало:</span>{" "}
            {formatDateTime(session.started_at)}
          </div>
        )}
      </div>

      {session.doctor_notes && (
        <p className="mt-2 text-xs text-[var(--color-text-secondary)] bg-[var(--color-muted)] rounded-lg px-2 py-1.5 line-clamp-2">
          {session.doctor_notes}
        </p>
      )}

      {(session.status === "WAITING" || session.status === "ACTIVE") && (
        <div className="mt-3 flex gap-2">
          {session.status === "WAITING" && (
            <button
              onClick={onActivate}
              className="flex-1 py-1.5 text-xs font-medium bg-green-500 text-white rounded-xl hover:bg-green-600 transition-colors"
            >
              Начать звонок
            </button>
          )}
          <button
            onClick={onOpen}
            className="flex-1 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors"
          >
            Открыть
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

function TelemedicinePage() {
  const [showCreate, setShowCreate] = useState(false);
  const [activeSession, setActiveSession] = useState<TeleSession | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const queryClient = useQueryClient();

  // Get current user from localStorage/store
  const currentUserId = (() => {
    try {
      const u = localStorage.getItem("user");
      if (u) return JSON.parse(u).id ?? "";
    } catch {}
    return "";
  })();

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ["tele-sessions"],
    queryFn: () => teleApi.listSessions(),
    refetchInterval: 10000,
  });

  const activateMutation = useMutation({
    mutationFn: (id: string) => teleApi.updateSession(id, { status: "ACTIVE" }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["tele-sessions"] });
      setActiveSession(updated);
    },
  });

  const filteredSessions = sessions.filter((s) => {
    if (filterStatus === "all") return true;
    if (filterStatus === "active") return s.status === "ACTIVE" || s.status === "WAITING";
    if (filterStatus === "past") return s.status === "COMPLETED" || s.status === "CANCELLED";
    return true;
  });

  const activeSessions = sessions.filter(
    (s) => s.status === "ACTIVE" || s.status === "WAITING"
  );
  const pastSessions = sessions.filter(
    (s) => s.status === "COMPLETED" || s.status === "CANCELLED"
  );

  const handleCreated = (newSession: TeleSession) => {
    setShowCreate(false);
    setActiveSession(newSession);
  };

  const handleOpenSession = (s: TeleSession) => {
    setActiveSession(s);
  };

  const handleActivateSession = (s: TeleSession) => {
    activateMutation.mutate(s.id);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Телемедицина</h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">
            Управление видеоконсультациями
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground font-medium rounded-xl hover:bg-primary/90 transition-colors shadow-sm shadow-primary/20"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Новая сессия
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Всего", value: sessions.length, color: "text-foreground" },
          { label: "Активных", value: activeSessions.length, color: "text-green-600" },
          { label: "Завершённых", value: sessions.filter((s) => s.status === "COMPLETED").length, color: "text-[var(--color-text-secondary)]" },
          { label: "Отменённых", value: sessions.filter((s) => s.status === "CANCELLED").length, color: "text-red-500" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-[var(--color-surface)] border border-border rounded-2xl p-4"
          >
            <p className="text-xs text-[var(--color-text-tertiary)] mb-1">{stat.label}</p>
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        {[
          { id: "all", label: "Все" },
          { id: "active", label: "Активные / Ожидающие" },
          { id: "past", label: "Завершённые / Отменённые" },
        ].map((f) => (
          <button
            key={f.id}
            onClick={() => setFilterStatus(f.id)}
            className={`px-3 py-1.5 text-sm font-medium rounded-xl transition-colors ${
              filterStatus === f.id
                ? "bg-primary text-primary-foreground"
                : "text-[var(--color-text-secondary)] hover:text-foreground hover:bg-[var(--color-muted)]"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Session list */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-36 bg-[var(--color-muted)] rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : filteredSessions.length === 0 ? (
        <div className="bg-[var(--color-surface)] border border-border rounded-2xl p-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[var(--color-muted)] flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-[var(--color-text-tertiary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <polygon points="23 7 16 12 23 17 23 7" />
              <rect width="15" height="14" x="1" y="5" rx="2" ry="2" />
            </svg>
          </div>
          <p className="text-[var(--color-text-secondary)] font-medium">Нет сессий</p>
          <p className="text-sm text-[var(--color-text-tertiary)] mt-1">
            Создайте новую сессию для начала консультации
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="mt-4 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-xl hover:bg-primary/90 transition-colors"
          >
            Создать сессию
          </button>
        </div>
      ) : (
        <div>
          {/* Active / Waiting group */}
          {filterStatus !== "past" && activeSessions.length > 0 && (
            <div className="mb-6">
              <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide mb-3">
                Активные и ожидающие
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeSessions
                  .filter(() => filterStatus === "all" || filterStatus === "active")
                  .map((s) => (
                    <SessionCard
                      key={s.id}
                      session={s}
                      onOpen={() => handleOpenSession(s)}
                      onActivate={() => handleActivateSession(s)}
                    />
                  ))}
              </div>
            </div>
          )}

          {/* Past group */}
          {filterStatus !== "active" && pastSessions.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide mb-3">
                Завершённые и отменённые
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {pastSessions
                  .filter(() => filterStatus === "all" || filterStatus === "past")
                  .map((s) => (
                    <SessionCard
                      key={s.id}
                      session={s}
                      onOpen={() => handleOpenSession(s)}
                      onActivate={() => handleActivateSession(s)}
                    />
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {showCreate && (
        <CreateSessionDialog onClose={() => setShowCreate(false)} onCreated={handleCreated} />
      )}

      {activeSession && (
        <ActiveSessionView
          session={activeSession}
          currentUserId={currentUserId}
          onClose={() => setActiveSession(null)}
        />
      )}
    </div>
  );
}

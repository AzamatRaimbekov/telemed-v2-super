import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useRef, useEffect } from "react";
import { patientsApi } from "@/features/patients/api";

export const Route = createFileRoute(
  "/_authenticated/patients/$patientId/ai"
)({
  component: AiAssistantPage,
});

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
}

interface AiAnalysis {
  summary: string;
  recommendations: string[];
  risks: string[];
  trends: string[];
  source: string;
  medications_count?: number;
  diagnoses_count?: number;
  abnormal_labs_count?: number;
}

const QUICK_ACTIONS = [
  { label: "Сводка", query: "Дай краткую сводку по пациенту" },
  { label: "Анализы", query: "Расскажи про результаты анализов" },
  { label: "Риски", query: "Какие есть риски у этого пациента?" },
  { label: "Рекомендации", query: "Какие рекомендации по лечению?" },
  { label: "Препараты", query: "Какие препараты сейчас принимает пациент?" },
  { label: "Дневник", query: "Сгенерируй дневниковую запись на сегодня" },
];

function AiAssistantPage() {
  const { patientId } = Route.useParams();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load initial summary
  const { data: summary } = useQuery({
    queryKey: ["patient-ai-summary", patientId],
    queryFn: () => patientsApi.getAiSummary(patientId),
  });

  // Set initial greeting when summary loads
  useEffect(() => {
    if (summary && messages.length === 0) {
      const ai = summary as AiAnalysis;
      const greeting: ChatMessage = {
        id: "init",
        role: "assistant",
        content: buildGreeting(ai),
        timestamp: new Date(),
      };
      setMessages([greeting]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summary]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const chatMutation = useMutation({
    mutationFn: (message: string) => patientsApi.sendAiChat(patientId, message),
    onSuccess: (data: { response: string; source: string }) => {
      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: "assistant",
        content: data.response,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMsg]);
    },
    onError: () => {
      const errMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: "assistant",
        content: "Извините, произошла ошибка. Попробуйте ещё раз.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errMsg]);
    },
  });

  const handleSend = (text?: string) => {
    const msg = (text || input).trim();
    if (!msg) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: msg,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    chatMutation.mutate(msg);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-280px)] min-h-[500px]">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4 flex-shrink-0">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-blue-500/20 flex items-center justify-center">
          <svg
            className="w-5 h-5 text-violet-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
          </svg>
        </div>
        <div>
          <h2 className="text-lg font-bold text-foreground">ИИ Ассистент</h2>
          <p className="text-xs text-[var(--color-text-tertiary)]">
            Задайте вопрос о пациенте — ИИ проанализирует все данные
          </p>
        </div>
      </div>

      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-1">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                msg.role === "user"
                  ? "bg-secondary text-white rounded-br-md"
                  : "bg-[var(--color-surface)] border border-border text-foreground rounded-bl-md"
              }`}
            >
              {msg.role === "assistant" && (
                <div className="flex items-center gap-1.5 mb-1.5">
                  <svg
                    className="w-3.5 h-3.5 text-violet-400"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
                  </svg>
                  <span className="text-[10px] font-medium text-violet-400">
                    ИИ Ассистент
                  </span>
                </div>
              )}
              <div className="text-sm leading-relaxed whitespace-pre-wrap">
                {formatAiMessage(msg.content)}
              </div>
              <p
                className={`text-[10px] mt-1.5 ${
                  msg.role === "user"
                    ? "text-white/50"
                    : "text-[var(--color-text-tertiary)]"
                }`}
              >
                {msg.timestamp.toLocaleTimeString("ru-RU", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {chatMutation.isPending && (
          <div className="flex justify-start">
            <div className="bg-[var(--color-surface)] border border-border rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex items-center gap-1.5 mb-1">
                <svg
                  className="w-3.5 h-3.5 text-violet-400"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
                </svg>
                <span className="text-[10px] font-medium text-violet-400">
                  ИИ Ассистент
                </span>
              </div>
              <div className="flex gap-1">
                <div
                  className="w-2 h-2 rounded-full bg-[var(--color-text-tertiary)] animate-bounce"
                  style={{ animationDelay: "0ms" }}
                />
                <div
                  className="w-2 h-2 rounded-full bg-[var(--color-text-tertiary)] animate-bounce"
                  style={{ animationDelay: "150ms" }}
                />
                <div
                  className="w-2 h-2 rounded-full bg-[var(--color-text-tertiary)] animate-bounce"
                  style={{ animationDelay: "300ms" }}
                />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick actions */}
      <div className="flex gap-2 mb-3 flex-wrap flex-shrink-0">
        {QUICK_ACTIONS.map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={() => handleSend(action.query)}
            disabled={chatMutation.isPending}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--color-muted)] text-[var(--color-text-secondary)] hover:text-foreground hover:bg-[var(--color-surface)] border border-transparent hover:border-border transition-all disabled:opacity-40"
          >
            {action.label}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="flex gap-2 flex-shrink-0">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Задайте вопрос о пациенте..."
          disabled={chatMutation.isPending}
          className="flex-1 px-4 py-3 text-sm rounded-xl border border-border bg-[var(--color-surface)] text-foreground placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-secondary/30 disabled:opacity-50"
        />
        <button
          type="button"
          onClick={() => handleSend()}
          disabled={!input.trim() || chatMutation.isPending}
          className="px-4 py-3 rounded-xl bg-secondary text-white font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-40 flex-shrink-0"
        >
          <svg
            className="w-5 h-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <line x1="22" x2="11" y1="2" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// Format AI messages — handle bullet points, bold, etc.
function formatAiMessage(text: string): React.ReactNode {
  const lines = text.split("\n");
  return lines.map((line, i) => {
    // Bold text **text**
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    const formatted = parts.map((part, j) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={j} className="font-semibold">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return part;
    });

    // Bullet points
    if (line.trimStart().startsWith("• ") || line.trimStart().startsWith("- ")) {
      return (
        <div key={i} className="flex gap-2 ml-1">
          <span className="text-[var(--color-text-tertiary)] flex-shrink-0">•</span>
          <span>{formatted}</span>
        </div>
      );
    }

    // Numbered items
    const numMatch = line.match(/^(\d+)\.\s/);
    if (numMatch) {
      return (
        <div key={i} className="flex gap-2 ml-1">
          <span className="text-secondary font-semibold flex-shrink-0 w-4">
            {numMatch[1]}.
          </span>
          <span>{line.slice(numMatch[0].length)}</span>
        </div>
      );
    }

    // Empty line = paragraph break
    if (!line.trim()) return <div key={i} className="h-2" />;

    return <div key={i}>{formatted}</div>;
  });
}

function buildGreeting(ai: AiAnalysis): string {
  let greeting = "Здравствуйте! Я ваш клинический ИИ-ассистент.\n\n";

  if (ai.summary) {
    greeting += `**Текущее состояние пациента:**\n${ai.summary}\n\n`;
  }

  if (ai.risks && ai.risks.length > 0) {
    greeting += `**Обнаружено рисков:** ${ai.risks.length}\n`;
    ai.risks.slice(0, 3).forEach((r) => {
      greeting += `• ${r}\n`;
    });
    greeting += "\n";
  }

  if (ai.trends && ai.trends.length > 0) {
    greeting += `**Динамика:**\n`;
    ai.trends.forEach((t) => {
      greeting += `• ${t}\n`;
    });
    greeting += "\n";
  }

  greeting += "Задайте мне вопрос о пациенте или используйте быстрые кнопки ниже.";
  return greeting;
}

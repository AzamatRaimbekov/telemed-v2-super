import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Send, Bot, User, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import portalApiClient from "@/lib/portal-api-client";

export const Route = createFileRoute("/portal/_portal/ai-chat")({
  component: AIChatPage,
});

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

function AIChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Здравствуйте! Я медицинский ассистент MedCore. Задайте вопрос о ваших анализах, назначениях или здоровье. Я объясню простым языком.\n\nВажно: я не ставлю диагнозы и не назначаю лечение. По всем медицинским вопросам обращайтесь к врачу.", timestamp: new Date() },
  ]);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = useMutation({
    mutationFn: async (message: string) => {
      const { data } = await portalApiClient.post("/portal/ai-chat", { message });
      return data;
    },
    onSuccess: (data) => {
      setMessages((prev) => [...prev, { role: "assistant", content: data.response || data.answer || "Извините, не удалось получить ответ.", timestamp: new Date() }]);
    },
    onError: () => {
      setMessages((prev) => [...prev, { role: "assistant", content: "Произошла ошибка. Попробуйте позже.", timestamp: new Date() }]);
    },
  });

  const handleSend = () => {
    if (!input.trim() || sendMessage.isPending) return;
    const userMessage = input.trim();
    setMessages((prev) => [...prev, { role: "user", content: userMessage, timestamp: new Date() }]);
    setInput("");
    sendMessage.mutate(userMessage);
  };

  return (
    <div className="max-w-2xl mx-auto flex flex-col" style={{ height: "calc(100vh - 200px)" }}>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-[var(--color-secondary)]/10 flex items-center justify-center">
          <Sparkles size={20} className="text-[var(--color-secondary)]" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-[var(--color-text-primary)]">AI Помощник</h1>
          <p className="text-xs text-[var(--color-text-tertiary)]">Спросите о ваших анализах и здоровье</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        {messages.map((msg, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
              msg.role === "user" ? "bg-[var(--color-primary)]/10" : "bg-[var(--color-secondary)]/10"
            }`}>
              {msg.role === "user" ? <User size={14} className="text-[var(--color-primary-deep)]" /> : <Bot size={14} className="text-[var(--color-secondary)]" />}
            </div>
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
              msg.role === "user"
                ? "bg-[var(--color-primary)]/10 text-[var(--color-text-primary)]"
                : "bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-secondary)]"
            }`}>
              {msg.content.split("\n").map((line, j) => (
                <p key={j} className={j > 0 ? "mt-2" : ""}>{line}</p>
              ))}
            </div>
          </motion.div>
        ))}
        {sendMessage.isPending && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-lg bg-[var(--color-secondary)]/10 flex items-center justify-center">
              <Bot size={14} className="text-[var(--color-secondary)]" />
            </div>
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl px-4 py-3">
              <div className="flex gap-1">
                <div className="w-2 h-2 rounded-full bg-[var(--color-text-tertiary)] animate-bounce" />
                <div className="w-2 h-2 rounded-full bg-[var(--color-text-tertiary)] animate-bounce" style={{ animationDelay: "0.1s" }} />
                <div className="w-2 h-2 rounded-full bg-[var(--color-text-tertiary)] animate-bounce" style={{ animationDelay: "0.2s" }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2 pt-4 border-t border-[var(--color-border)]">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Спросите о ваших анализах..."
          className="flex-1 h-11 px-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-sm focus:outline-none focus:border-[var(--color-secondary)]/40"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || sendMessage.isPending}
          className="h-11 w-11 rounded-xl bg-[var(--color-secondary)] text-white flex items-center justify-center disabled:opacity-50"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}

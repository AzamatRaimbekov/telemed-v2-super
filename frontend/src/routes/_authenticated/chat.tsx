import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import {
  useChannels,
  useMessages,
  useSendMessage,
  useUnreadCount,
  type ChatChannel,
  type ChatMessage,
} from "@/features/chat/api";
import { useAuthStore } from "@/stores/auth-store";

export const Route = createFileRoute("/_authenticated/chat")({
  component: ChatPage,
});

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

function ChatPage() {
  const { user } = useAuthStore();
  const [activeChannel, setActiveChannel] = useState("general");
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: channels } = useChannels();
  const { data: messages } = useMessages(activeChannel);
  const sendMessage = useSendMessage();
  const { data: unreadData } = useUnreadCount();

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;
    sendMessage.mutate({ channel: activeChannel, body: text });
    setInput("");
  };

  const channelLabel = (ch: ChatChannel) => {
    if (ch.type === "dm") return ch.name;
    const icons: Record<string, string> = { general: "Общий", doctors: "Врачи", nurses: "Медсёстры" };
    return icons[ch.id] || ch.name;
  };

  const groupChannels = (channels || []).filter((c) => c.type === "group");
  const dmChannels = (channels || []).filter((c) => c.type === "dm");
  const activeLabel = channels?.find((c) => c.id === activeChannel);

  // Group messages by date
  const groupedMessages: { date: string; msgs: ChatMessage[] }[] = [];
  let lastDate = "";
  for (const msg of messages || []) {
    const d = msg.created_at.split("T")[0];
    if (d !== lastDate) {
      groupedMessages.push({ date: d, msgs: [] });
      lastDate = d;
    }
    groupedMessages[groupedMessages.length - 1].msgs.push(msg);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Чат</h1>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1">
          Внутренний мессенджер персонала
        </p>
      </div>

      <div className="flex gap-4 h-[calc(100vh-220px)] min-h-[500px]">
        {/* Channel sidebar */}
        <div className="w-64 flex-shrink-0 bg-[var(--color-surface)] border border-border rounded-2xl flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <span className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">
              Каналы
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {groupChannels.map((ch) => (
              <button
                key={ch.id}
                onClick={() => setActiveChannel(ch.id)}
                className={`w-full text-left px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                  activeChannel === ch.id
                    ? "bg-primary/10 text-primary"
                    : "text-[var(--color-text-secondary)] hover:bg-[var(--color-muted)]"
                }`}
              >
                <span className="mr-2">#</span>
                {channelLabel(ch)}
              </button>
            ))}

            {dmChannels.length > 0 && (
              <>
                <div className="px-3 pt-4 pb-1">
                  <span className="text-[10px] font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">
                    Личные сообщения
                  </span>
                </div>
                {dmChannels.map((ch) => (
                  <button
                    key={ch.id}
                    onClick={() => setActiveChannel(ch.id)}
                    className={`w-full text-left px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                      activeChannel === ch.id
                        ? "bg-primary/10 text-primary"
                        : "text-[var(--color-text-secondary)] hover:bg-[var(--color-muted)]"
                    }`}
                  >
                    {ch.name}
                  </button>
                ))}
              </>
            )}
          </div>

          {unreadData && unreadData.count > 0 && (
            <div className="px-4 py-2 border-t border-border text-xs text-[var(--color-text-tertiary)]">
              {unreadData.count} непрочитанных
            </div>
          )}
        </div>

        {/* Message area */}
        <div className="flex-1 bg-[var(--color-surface)] border border-border rounded-2xl flex flex-col overflow-hidden">
          {/* Channel header */}
          <div className="px-5 py-3 border-b border-border flex items-center gap-2">
            <span className="text-lg font-semibold text-foreground">
              {activeLabel ? channelLabel(activeLabel) : activeChannel}
            </span>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {groupedMessages.map((group) => (
              <div key={group.date}>
                <div className="flex items-center gap-3 my-3">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-[11px] text-[var(--color-text-tertiary)] font-medium">
                    {formatDate(group.msgs[0].created_at)}
                  </span>
                  <div className="flex-1 h-px bg-border" />
                </div>
                {group.msgs.map((msg) => {
                  const isMe = msg.sender_id === user?.id;
                  return (
                    <div key={msg.id} className={`flex gap-3 mb-3 ${isMe ? "flex-row-reverse" : ""}`}>
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                        {(msg.sender_name || "?")
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .slice(0, 2)}
                      </div>
                      <div className={`max-w-[70%] ${isMe ? "text-right" : ""}`}>
                        <div className="flex items-baseline gap-2 mb-0.5">
                          <span className={`text-xs font-semibold ${isMe ? "text-primary" : "text-foreground"}`}>
                            {msg.sender_name || "Неизвестный"}
                          </span>
                          <span className="text-[10px] text-[var(--color-text-tertiary)]">
                            {formatTime(msg.created_at)}
                          </span>
                        </div>
                        <div
                          className={`inline-block px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                            isMe
                              ? "bg-primary text-primary-foreground rounded-tr-md"
                              : "bg-[var(--color-muted)] text-foreground rounded-tl-md"
                          }`}
                        >
                          {msg.body}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="px-4 py-3 border-t border-border">
            <div className="flex items-center gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Написать сообщение..."
                className="flex-1 px-4 py-2.5 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || sendMessage.isPending}
                className="px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { portalApi } from "@/features/portal/api";
import { useState, useRef, useEffect, useCallback } from "react";
import { usePortalAuthStore } from "@/stores/portal-auth-store";

export const Route = createFileRoute("/portal/_portal/messages")({
  component: MessagesPage,
});

function formatMessageTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const isToday = date.getDate() === now.getDate() && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  if (isToday) return date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  return date.toLocaleDateString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function isImageUrl(url: string): boolean {
  return /\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i.test(url);
}

function getFileName(url: string): string {
  try { return decodeURIComponent(new URL(url, window.location.origin).pathname.split("/").pop() ?? "Файл"); }
  catch { return "Файл"; }
}

function MessagesPage() {
  const patientId = usePortalAuthStore((s) => s.patient?.id);
  const { data: messages, isLoading: isLoadingMessages } = useQuery({ queryKey: ["portal-messages"], queryFn: portalApi.getMessages });
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const queryClient = useQueryClient();
  const chatEndRef = useRef<HTMLDivElement>(null);
  const markedReadRef = useRef<Set<string>>(new Set());

  const { data: conversation, isLoading: isLoadingConversation } = useQuery({
    queryKey: ["portal-conversation", selectedUserId],
    queryFn: () => portalApi.getConversation(selectedUserId!),
    enabled: !!selectedUserId,
    refetchInterval: 5000,
  });

  const sendMutation = useMutation({
    mutationFn: (content: string) => portalApi.sendMessage({ recipient_id: selectedUserId!, content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portal-conversation", selectedUserId] });
      queryClient.invalidateQueries({ queryKey: ["portal-messages"] });
      setNewMessage("");
    },
  });

  const markReadMutation = useMutation({
    mutationFn: (messageId: string) => portalApi.markMessageRead(messageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portal-messages"] });
      queryClient.invalidateQueries({ queryKey: ["portal-conversation", selectedUserId] });
    },
  });

  // Mark unread messages from the other person as read
  useEffect(() => {
    if (!conversation || !patientId) return;
    const msgs = conversation as Array<Record<string, any>>;
    msgs.forEach((msg) => {
      if (msg.sender_id !== patientId && !msg.is_read && !markedReadRef.current.has(msg.id)) {
        markedReadRef.current.add(msg.id);
        markReadMutation.mutate(msg.id);
      }
    });
  }, [conversation, patientId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation]);

  // Group messages by unique conversation partner with unread count
  const conversations = ((messages as Array<Record<string, any>>) ?? []).reduce((acc: Record<string, Record<string, any>>, msg: Record<string, any>) => {
    const partnerId = msg.sender_id === patientId ? msg.recipient_id : msg.sender_id;
    if (!acc[partnerId]) {
      acc[partnerId] = { partnerId, partnerName: msg.partner_name ?? msg.partnerName, lastMessage: msg.content, lastTime: msg.created_at, unreadCount: 0 };
    }
    if (msg.sender_id !== patientId && !msg.is_read) {
      acc[partnerId].unreadCount = (acc[partnerId].unreadCount ?? 0) + 1;
    }
    const existingTime = new Date(acc[partnerId].lastTime).getTime();
    const msgTime = new Date(msg.created_at).getTime();
    if (msgTime > existingTime) {
      acc[partnerId].lastMessage = msg.content;
      acc[partnerId].lastTime = msg.created_at;
    }
    return acc;
  }, {});

  const sortedConversations = Object.values(conversations).sort(
    (a, b) => new Date(b.lastTime).getTime() - new Date(a.lastTime).getTime()
  );

  const handleSelectConversation = useCallback((partnerId: string) => {
    markedReadRef.current.clear();
    setSelectedUserId(partnerId);
  }, []);

  return (
    <div className="max-w-4xl">
      <h1 className="text-[24px] font-bold text-foreground tracking-tight mb-6 animate-float-up">Сообщения</h1>

      {selectedUserId ? (
        <div className="animate-scale-in">
          <button onClick={() => setSelectedUserId(null)} className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-foreground mb-4 transition-colors">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
            Назад
          </button>

          <div className="bg-[var(--color-surface)] rounded-2xl border border-border">
            <div className="h-[400px] overflow-y-auto p-4 space-y-3">
              {isLoadingConversation ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className={`flex ${i % 2 === 0 ? "justify-end" : "justify-start"}`}>
                      <div className="max-w-[75%] h-12 rounded-2xl bg-[var(--color-muted)] animate-pulse" style={{ width: `${40 + i * 15}%` }} />
                    </div>
                  ))}
                </div>
              ) : ((conversation as Array<Record<string, any>>) ?? []).length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <svg className="w-10 h-10 mb-3 text-[var(--color-text-tertiary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                  <p className="text-sm text-[var(--color-text-tertiary)]">Начните диалог</p>
                </div>
              ) : (
                ((conversation as Array<Record<string, any>>)).map((msg: Record<string, any>) => {
                  const isSelf = msg.sender_id === patientId;
                  const attachmentUrl = msg.attachment_url as string | undefined;
                  return (
                    <div key={msg.id} className={`flex ${isSelf ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm ${isSelf ? "bg-secondary text-white rounded-br-md" : "bg-[var(--color-muted)] text-foreground rounded-bl-md"}`}>
                        <p>{msg.content}</p>

                        {attachmentUrl && (
                          <div className="mt-2">
                            {isImageUrl(attachmentUrl) ? (
                              <a href={attachmentUrl} target="_blank" rel="noreferrer">
                                <img src={attachmentUrl} alt="Вложение" className="max-w-full max-h-48 rounded-lg object-cover" />
                              </a>
                            ) : (
                              <a href={attachmentUrl} target="_blank" rel="noreferrer"
                                className={`inline-flex items-center gap-1.5 text-xs underline ${isSelf ? "text-white/80 hover:text-white" : "text-secondary hover:text-secondary/80"} transition-colors`}>
                                <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                                </svg>
                                {getFileName(attachmentUrl)}
                              </a>
                            )}
                          </div>
                        )}

                        <div className={`flex items-center gap-1 mt-1 ${isSelf ? "justify-end" : ""}`}>
                          <span className={`text-[10px] ${isSelf ? "text-white/60" : "text-[var(--color-text-tertiary)]"}`}>
                            {formatMessageTime(msg.created_at)}
                          </span>
                          {isSelf && (
                            <span className={`text-[10px] ml-0.5 ${msg.is_read ? "text-white/80" : "text-white/40"}`}
                              title={msg.is_read ? "Прочитано" : "Отправлено"}>
                              {msg.is_read ? "✓✓" : "✓"}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={chatEndRef} />
            </div>

            <div className="border-t border-border p-3 flex gap-2">
              <input value={newMessage} onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && newMessage.trim()) sendMutation.mutate(newMessage.trim()); }}
                placeholder="Введите сообщение..."
                className="flex-1 px-4 py-2.5 rounded-xl border border-border bg-[var(--color-muted)]/50 text-foreground text-sm placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-secondary/40 transition-all" />
              <button onClick={() => { if (newMessage.trim()) sendMutation.mutate(newMessage.trim()); }}
                disabled={!newMessage.trim() || sendMutation.isPending}
                className="px-4 py-2.5 rounded-xl bg-secondary text-white text-sm font-medium disabled:opacity-50 hover:bg-secondary/90 transition-colors">
                {sendMutation.isPending ? (
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                ) : (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" x2="11" y1="2" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                )}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="animate-float-up" style={{ animationDelay: '100ms' }}>
          {isLoadingMessages ? (
            <div className="bg-[var(--color-surface)] rounded-2xl border border-border divide-y divide-border">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 p-4">
                  <div className="w-10 h-10 rounded-xl bg-[var(--color-muted)] animate-pulse flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-32 bg-[var(--color-muted)] animate-pulse rounded" />
                    <div className="h-3 w-48 bg-[var(--color-muted)] animate-pulse rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : sortedConversations.length === 0 ? (
            <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-8 text-center">
              <svg className="w-12 h-12 mx-auto mb-3 text-[var(--color-text-tertiary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              <p className="text-[var(--color-text-secondary)] font-medium">У вас пока нет сообщений</p>
              <p className="text-xs text-[var(--color-text-tertiary)] mt-1">Ваш лечащий врач свяжется с вами здесь.</p>
            </div>
          ) : (
            <div className="bg-[var(--color-surface)] rounded-2xl border border-border divide-y divide-border">
              {sortedConversations.map((conv: Record<string, any>) => (
                <button key={conv.partnerId} onClick={() => handleSelectConversation(conv.partnerId)}
                  className="w-full flex items-center gap-3 p-4 hover:bg-[var(--color-muted)]/50 transition-colors text-left">
                  <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-sm truncate ${conv.unreadCount > 0 ? "font-bold text-foreground" : "font-semibold text-foreground"}`}>
                        {conv.partnerName ?? "Собеседник"}
                      </p>
                      <span className="text-[10px] text-[var(--color-text-tertiary)] flex-shrink-0">
                        {formatMessageTime(conv.lastTime)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <p className={`text-xs truncate ${conv.unreadCount > 0 ? "text-foreground" : "text-[var(--color-text-tertiary)]"}`}>
                        {conv.lastMessage}
                      </p>
                      {conv.unreadCount > 0 && (
                        <span className="flex-shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-secondary text-white text-[10px] font-bold flex items-center justify-center">
                          {conv.unreadCount > 99 ? "99+" : conv.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

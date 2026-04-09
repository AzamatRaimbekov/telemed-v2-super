import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { portalApi } from "@/features/portal/api";
import { useState } from "react";

export const Route = createFileRoute("/portal/_portal/messages")({
  component: MessagesPage,
});

function MessagesPage() {
  const { data: messages } = useQuery({ queryKey: ["portal-messages"], queryFn: portalApi.getMessages });
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const queryClient = useQueryClient();

  const { data: conversation } = useQuery({
    queryKey: ["portal-conversation", selectedUserId],
    queryFn: () => portalApi.getConversation(selectedUserId!),
    enabled: !!selectedUserId,
    refetchInterval: 5000,
  });

  const sendMutation = useMutation({
    mutationFn: (content: string) => portalApi.sendMessage({ recipient_id: selectedUserId!, content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portal-conversation", selectedUserId] });
      setNewMessage("");
    },
  });

  // Group messages by unique conversation partner
  const conversations = (messages as Array<Record<string, any>> || []).reduce((acc: Record<string, Record<string, any>>, msg: Record<string, any>) => {
    const partnerId = msg.sender_id === msg.recipient_id ? msg.recipient_id : (msg.sender_id !== "self" ? msg.sender_id : msg.recipient_id);
    if (!acc[partnerId]) {
      acc[partnerId] = { partnerId, lastMessage: msg.content, lastTime: msg.created_at, unread: !msg.is_read };
    }
    return acc;
  }, {});

  return (
    <div className="max-w-4xl">
      <h1 className="text-[24px] font-bold text-foreground tracking-tight mb-6 animate-float-up" style={{ opacity: 0 }}>Сообщения</h1>

      {selectedUserId ? (
        <div className="animate-scale-in" style={{ opacity: 0 }}>
          <button onClick={() => setSelectedUserId(null)} className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-foreground mb-4 transition-colors">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
            Назад
          </button>

          {/* Chat messages */}
          <div className="bg-[var(--color-surface)] rounded-2xl border border-border">
            <div className="h-[400px] overflow-y-auto p-4 space-y-3">
              {(conversation as Array<Record<string, any>> || []).map((msg: Record<string, any>) => {
                const isSelf = msg.sender_id !== selectedUserId;
                return (
                  <div key={msg.id} className={`flex ${isSelf ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm ${isSelf ? "bg-secondary text-white rounded-br-md" : "bg-[var(--color-muted)] text-foreground rounded-bl-md"}`}>
                      <p>{msg.content}</p>
                      <p className={`text-[10px] mt-1 ${isSelf ? "text-white/60" : "text-[var(--color-text-tertiary)]"}`}>
                        {new Date(msg.created_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                );
              })}
              {(conversation as Array<Record<string, any>> || []).length === 0 && (
                <div className="text-center py-12 text-[var(--color-text-tertiary)] text-sm">Начните диалог</div>
              )}
            </div>

            {/* Input */}
            <div className="border-t border-border p-3 flex gap-2">
              <input value={newMessage} onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && newMessage.trim()) sendMutation.mutate(newMessage.trim()); }}
                placeholder="Введите сообщение..."
                className="flex-1 px-4 py-2.5 rounded-xl border border-border bg-[var(--color-muted)]/50 text-foreground text-sm placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-secondary/40 transition-all" />
              <button onClick={() => { if (newMessage.trim()) sendMutation.mutate(newMessage.trim()); }}
                disabled={!newMessage.trim() || sendMutation.isPending}
                className="px-4 py-2.5 rounded-xl bg-secondary text-white text-sm font-medium disabled:opacity-50 hover:bg-secondary/90 transition-colors">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" x2="11" y1="2" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="animate-float-up" style={{ animationDelay: '100ms', opacity: 0 }}>
          {Object.keys(conversations).length === 0 ? (
            <div className="bg-[var(--color-surface)] rounded-2xl border border-border p-8 text-center">
              <svg className="w-12 h-12 mx-auto mb-3 text-[var(--color-text-tertiary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              <p className="text-[var(--color-text-secondary)]">Нет сообщений</p>
              <p className="text-xs text-[var(--color-text-tertiary)] mt-1">Напишите вашему врачу из профиля</p>
            </div>
          ) : (
            <div className="bg-[var(--color-surface)] rounded-2xl border border-border divide-y divide-border">
              {Object.values(conversations).map((conv: Record<string, any>) => (
                <button key={conv.partnerId} onClick={() => setSelectedUserId(conv.partnerId)} className="w-full flex items-center gap-3 p-4 hover:bg-[var(--color-muted)]/50 transition-colors text-left">
                  <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{conv.lastMessage}</p>
                    <p className="text-xs text-[var(--color-text-tertiary)]">{new Date(conv.lastTime).toLocaleDateString("ru-RU")}</p>
                  </div>
                  {conv.unread && <div className="w-2.5 h-2.5 rounded-full bg-secondary flex-shrink-0" />}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

import apiClient from "@/lib/api-client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface ChatChannel {
  id: string;
  name: string;
  type: "group" | "dm";
}

export interface ChatMessage {
  id: string;
  sender_id: string;
  sender_name: string | null;
  recipient_id: string | null;
  channel: string;
  body: string;
  is_read: boolean;
  created_at: string;
}

export const useChannels = () =>
  useQuery<ChatChannel[]>({
    queryKey: ["chat", "channels"],
    queryFn: async () => {
      const { data } = await apiClient.get("/chat/channels");
      return data;
    },
  });

export const useMessages = (channel: string) =>
  useQuery<ChatMessage[]>({
    queryKey: ["chat", "messages", channel],
    queryFn: async () => {
      const { data } = await apiClient.get(`/chat/messages?channel=${encodeURIComponent(channel)}`);
      return data;
    },
    refetchInterval: 5000,
  });

export const useSendMessage = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { channel: string; body: string; recipient_id?: string }) => {
      const { data } = await apiClient.post("/chat/messages", body);
      return data;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["chat", "messages", variables.channel] });
      qc.invalidateQueries({ queryKey: ["chat", "unread"] });
    },
  });
};

export const useMarkRead = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.patch(`/chat/messages/${id}/read`);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chat", "unread"] });
    },
  });
};

export const useUnreadCount = () =>
  useQuery<{ count: number }>({
    queryKey: ["chat", "unread"],
    queryFn: async () => {
      const { data } = await apiClient.get("/chat/unread-count");
      return data;
    },
    refetchInterval: 15000,
  });

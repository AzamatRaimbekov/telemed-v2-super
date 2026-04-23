import apiClient from "@/lib/api-client";
import { useQuery } from "@tanstack/react-query";

export interface NotificationLog {
  id: string;
  channel: string;
  recipient: string;
  body: string;
  status: string;
  error_message: string | null;
  related_type: string | null;
  sent_at: string | null;
  created_at: string;
}

export const useNotificationLogs = (params?: { channel?: string; status?: string }) =>
  useQuery<NotificationLog[]>({
    queryKey: ["notification-logs", params],
    queryFn: async () => {
      const { data } = await apiClient.get("/notification-logs/", { params });
      return data;
    },
  });

export const useNotificationStats = () =>
  useQuery({
    queryKey: ["notification-logs", "stats"],
    queryFn: async () => {
      const { data } = await apiClient.get("/notification-logs/stats");
      return data;
    },
  });

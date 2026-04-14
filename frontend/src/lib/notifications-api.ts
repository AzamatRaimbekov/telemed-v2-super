import apiClient from "@/lib/api-client";

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  is_read: boolean;
  read_at: string | null;
  reference_type: string | null;
  reference_id: string | null;
  data: Record<string, unknown> | null;
  created_at: string;
}

export interface NotificationsResponse {
  items: Notification[];
  total: number;
  skip: number;
  limit: number;
}

export const notificationsApi = {
  list: (skip = 0, limit = 20): Promise<NotificationsResponse> =>
    apiClient.get(`/notifications?skip=${skip}&limit=${limit}`).then((r) => r.data),

  unreadCount: (): Promise<{ count: number }> =>
    apiClient.get("/notifications/unread-count").then((r) => r.data),

  markRead: (id: string): Promise<{ id: string; is_read: boolean }> =>
    apiClient.patch(`/notifications/${id}/read`).then((r) => r.data),

  markAllRead: (): Promise<{ success: boolean }> =>
    apiClient.post("/notifications/read-all").then((r) => r.data),
};

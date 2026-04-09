import apiClient from "@/lib/api-client";
import type { LoginRequest, TokenResponse, User } from "@/types/auth";

export const authApi = {
  login: async (data: LoginRequest): Promise<TokenResponse> => {
    const response = await apiClient.post<TokenResponse>("/auth/login", data);
    return response.data;
  },
  refresh: async (refreshToken: string): Promise<TokenResponse> => {
    const response = await apiClient.post<TokenResponse>("/auth/refresh", { refresh_token: refreshToken });
    return response.data;
  },
  logout: async (): Promise<void> => { await apiClient.post("/auth/logout"); },
  me: async (): Promise<User> => {
    const response = await apiClient.get<User>("/auth/me");
    return response.data;
  },
};

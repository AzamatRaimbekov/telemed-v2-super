import { create } from "zustand";
import { User } from "@/types/auth";
import apiClient from "@/lib/api-client";

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  fetchUser: () => Promise<void>;
  initialize: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: localStorage.getItem("access_token"),
  refreshToken: localStorage.getItem("refresh_token"),
  isAuthenticated: !!localStorage.getItem("access_token"),
  isLoading: false,

  login: async (email: string, password: string) => {
    const { data } = await apiClient.post("/auth/login", { email, password });
    localStorage.setItem("access_token", data.access_token);
    localStorage.setItem("refresh_token", data.refresh_token);
    set({ accessToken: data.access_token, refreshToken: data.refresh_token, isAuthenticated: true });
    await get().fetchUser();
  },

  logout: async () => {
    try { await apiClient.post("/auth/logout"); } catch { /* ignore */ }
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false });
  },

  fetchUser: async () => {
    try {
      set({ isLoading: true });
      const { data } = await apiClient.get("/auth/me");
      set({ user: data, isAuthenticated: true });
    } catch {
      set({ user: null, isAuthenticated: false });
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
    } finally {
      set({ isLoading: false });
    }
  },

  initialize: () => {
    const token = localStorage.getItem("access_token");
    if (token) { get().fetchUser(); }
  },
}));

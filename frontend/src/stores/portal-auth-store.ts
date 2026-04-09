import { create } from "zustand";
import apiClient from "@/lib/api-client";

interface PortalUser {
  id: string;
  first_name: string;
  last_name: string;
  middle_name: string | null;
  phone: string | null;
  gender: string;
  status: string;
  photo_url: string | null;
  blood_type: string;
  allergies: string[] | null;
}

interface PortalAuthState {
  patient: PortalUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (phone: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  fetchProfile: () => Promise<void>;
  initialize: () => void;
}

export const usePortalAuthStore = create<PortalAuthState>((set, get) => ({
  patient: null,
  isAuthenticated: !!localStorage.getItem("portal_access_token"),
  isLoading: false,

  login: async (phone: string, password: string) => {
    const { data } = await apiClient.post("/portal/auth/login", { phone, password });
    localStorage.setItem("portal_access_token", data.access_token);
    localStorage.setItem("portal_refresh_token", data.refresh_token);
    set({ isAuthenticated: true });
    await get().fetchProfile();
  },

  logout: async () => {
    try {
      await apiClient.post("/portal/auth/logout");
    } catch { /* ignore */ }
    localStorage.removeItem("portal_access_token");
    localStorage.removeItem("portal_refresh_token");
    set({ patient: null, isAuthenticated: false });
  },

  fetchProfile: async () => {
    try {
      set({ isLoading: true });
      const token = localStorage.getItem("portal_access_token");
      const { data } = await apiClient.get("/portal/profile", {
        headers: { Authorization: `Bearer ${token}` },
      });
      set({ patient: data, isAuthenticated: true });
    } catch {
      set({ patient: null, isAuthenticated: false });
      localStorage.removeItem("portal_access_token");
      localStorage.removeItem("portal_refresh_token");
    } finally {
      set({ isLoading: false });
    }
  },

  initialize: () => {
    if (localStorage.getItem("portal_access_token")) {
      get().fetchProfile();
    }
  },
}));

import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";

const portalClient = axios.create({
  baseURL: "/api/v1",
  headers: { "Content-Type": "application/json" },
});

// Inject portal token (NOT staff token)
portalClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem("portal_access_token");
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let failedQueue: Array<{ resolve: (value: unknown) => void; reject: (reason: unknown) => void }> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token);
  });
  failedQueue = [];
};

portalClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${token}`;
          }
          return portalClient(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = localStorage.getItem("portal_refresh_token");
      if (!refreshToken) {
        localStorage.removeItem("portal_access_token");
        localStorage.removeItem("portal_refresh_token");
        window.location.href = "/portal/login";
        return Promise.reject(error);
      }

      try {
        const { data } = await axios.post("/api/v1/portal/auth/refresh", { refresh_token: refreshToken });
        localStorage.setItem("portal_access_token", data.access_token);
        localStorage.setItem("portal_refresh_token", data.refresh_token);
        processQueue(null, data.access_token);
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${data.access_token}`;
        }
        return portalClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        localStorage.removeItem("portal_access_token");
        localStorage.removeItem("portal_refresh_token");
        window.location.href = "/portal/login";
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    throw error;
  }
);

export default portalClient;

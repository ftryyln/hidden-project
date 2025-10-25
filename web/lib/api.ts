import axios, { type AxiosError, type AxiosRequestConfig } from "axios";
import { env } from "./env";
import { getAccessToken, getRefreshToken } from "./auth";

interface RetryableRequestConfig extends AxiosRequestConfig {
  _retry?: boolean;
}

const api = axios.create({
  baseURL: env.public.NEXT_PUBLIC_API_URL,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
const pendingRequests: Array<{
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
  config: RetryableRequestConfig;
}> = [];

const unauthorizedHandlers = new Set<() => void>();

function notifyUnauthorized() {
  unauthorizedHandlers.forEach((handler) => {
    try {
      handler();
    } catch {
      // ignore handler failure
    }
  });
}

async function triggerRefresh(): Promise<void> {
  if (typeof window === "undefined") {
    throw new Error("Unable to refresh session on server-side render.");
  }
  const response = await fetch("/api/auth/refresh", {
    method: "POST",
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error("Session refresh failed");
  }
  // cookies are rotated server-side; no body required
  await response.text().catch(() => undefined);
}

function processQueue(error?: unknown) {
  pendingRequests.splice(0).forEach(({ resolve, reject, config }) => {
    if (error) {
      reject(error);
      return;
    }
    resolve(api(config));
  });
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const { response, config } = error;
    const originalConfig = (config ?? {}) as RetryableRequestConfig;

    if (!response || response.status !== 401 || originalConfig._retry) {
      return Promise.reject(error);
    }

    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      notifyUnauthorized();
      return Promise.reject(error);
    }

    if (typeof window === "undefined") {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        pendingRequests.push({ resolve, reject, config: originalConfig });
      });
    }

    originalConfig._retry = true;
    isRefreshing = true;

    try {
      await triggerRefresh();
      processQueue();
      return api(originalConfig);
    } catch (refreshError) {
      processQueue(refreshError);
      notifyUnauthorized();
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);

export function onUnauthorized(handler: () => void): () => void {
  unauthorizedHandlers.add(handler);
  return () => unauthorizedHandlers.delete(handler);
}

export { api };

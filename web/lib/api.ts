import axios, { AxiosError } from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api/v1";
const STORAGE_KEY = "guild-manager:token";

let accessToken: string | null =
  typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
let unauthorizedHandler: (() => void) | null = null;

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (
      error.response?.status === 401 &&
      typeof window !== "undefined" &&
      unauthorizedHandler
    ) {
      unauthorizedHandler();
    }
    return Promise.reject(error);
  },
);

export function setAccessToken(token: string | null) {
  accessToken = token;
  if (typeof window !== "undefined") {
    if (token) {
      window.localStorage.setItem(STORAGE_KEY, token);
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }
}

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(STORAGE_KEY);
}

export function onUnauthorized(handler: () => void) {
  unauthorizedHandler = handler;
}

export interface ApiError {
  message: string;
  errors?: Record<string, string>;
}

export function toApiError(error: unknown): ApiError {
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as Record<string, unknown>).message === "string"
  ) {
    return error as ApiError;
  }
  if (axios.isAxiosError(error)) {
    const data = (error.response?.data ?? {}) as Record<string, unknown>;
    return {
      message:
        (typeof data.message === "string" && data.message) ||
        error.message ||
        "Unexpected error",
      errors: data.errors as Record<string, string> | undefined,
    };
  }
  if (error instanceof Error) {
    return { message: error.message };
  }
  return { message: "Unexpected error" };
}

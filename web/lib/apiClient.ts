import { env } from "@/lib/env";
import { getAccessToken, getRefreshToken } from "@/lib/auth";

export interface ApiClientOptions extends RequestInit {
  query?: Record<string, string | number | boolean | undefined | null>;
}

async function refreshSession(): Promise<void> {
  if (typeof window === "undefined") {
    throw new Error("Unable to refresh session on the server");
  }
  const response = await fetch("/api/auth/refresh", {
    method: "POST",
    credentials: "include",
  });
  if (!response.ok) {
    throw response;
  }
}

function buildUrl(path: string, query?: ApiClientOptions["query"]): URL {
  const base = env.public.NEXT_PUBLIC_API_URL ?? "";
  const normalizedBase = base.endsWith("/") ? base : `${base}/`;
  const url = new URL(path.replace(/^\//, ""), normalizedBase);
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") return;
      url.searchParams.set(key, String(value));
    });
  }
  return url;
}

async function executeRequest<T>(
  path: string,
  options: ApiClientOptions = {},
  retrying = false,
): Promise<T> {
  const url = buildUrl(path, options.query);
  const headers = new Headers(options.headers as HeadersInit | undefined);
  const token = getAccessToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const body = options.body;
  if (body && !(body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: "include",
  });

  if (response.status === 401 && !retrying && getRefreshToken()) {
    try {
      await refreshSession();
      return executeRequest<T>(path, options, true);
    } catch {
      throw response;
    }
  }

  if (!response.ok) {
    throw response;
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  if (!text) {
    return {} as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    return {} as T;
  }
}

export async function apiClient<T>(path: string, options?: ApiClientOptions): Promise<T> {
  return executeRequest<T>(path, options);
}

import axios from "axios";
import type { ApiErrorResponse } from "@/lib/types";

export class ApiClientError extends Error {
  status: number;
  details?: Record<string, string | string[]>;

  constructor(status: number, message: string, details?: Record<string, string | string[]>) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export async function toApiError(source: Response | unknown): Promise<ApiClientError> {
  if (source instanceof Response) {
    let payload: ApiErrorResponse | undefined;
    try {
      payload = (await source.clone().json()) as ApiErrorResponse;
    } catch {
      // ignore
    }
    const message = payload?.message ?? source.statusText ?? "Unexpected error";
    return new ApiClientError(source.status, message, payload?.errors);
  }

  if (axios.isAxiosError(source)) {
    const isNetworkError = !source.response;
    const status = source.response?.status ?? (isNetworkError ? 0 : 500);
    const payload = source.response?.data as ApiErrorResponse | undefined;
    const fallbackMessage = isNetworkError ? "Network error" : "Unexpected error";
    const message = payload?.message ?? source.message ?? fallbackMessage;
    return new ApiClientError(status, message, payload?.errors);
  }

  if (source instanceof Error) {
    const message = source.message ?? "Unexpected error";
    const lowerMessage = message.toLowerCase();
    const isNetworkFailure =
      lowerMessage.includes("network") || lowerMessage.includes("fetch failed") || lowerMessage.includes("failed to fetch");
    return new ApiClientError(isNetworkFailure ? 0 : 500, message);
  }

  return new ApiClientError(500, "Unexpected error");
}

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
    const status = source.response?.status ?? 500;
    const payload = source.response?.data as ApiErrorResponse | undefined;
    const message = payload?.message ?? source.message ?? "Unexpected error";
    return new ApiClientError(status, message, payload?.errors);
  }

  if (source instanceof Error) {
    return new ApiClientError(500, source.message);
  }

  return new ApiClientError(500, "Unexpected error");
}

import { STATUS_TEXT } from "https://deno.land/std@0.203.0/http/status.ts";

interface ErrorPayload {
  status: "error";
  message: string;
  errors?: Record<string, unknown>;
}

interface SuccessPayload<T> {
  status: "success";
  data: T;
}

const jsonHeaders = {
  "Content-Type": "application/json",
};

export function errorResponse(
  status: number,
  message?: string,
  errors?: Record<string, unknown>,
): Response {
  const body: ErrorPayload = {
    status: "error",
    message: message ?? STATUS_TEXT.get(status) ?? "error",
    errors,
  };
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

export function successResponse<T>(status: number, data: T): Response {
  const body: SuccessPayload<T> = {
    status: "success",
    data,
  };
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

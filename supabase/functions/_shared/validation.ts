import { errorResponse } from "./response.ts";

export async function readJsonBody<T>(
  req: Request,
): Promise<{ data: T } | Response> {
  try {
    const body = await req.json();
    return { data: body as T };
  } catch (_err) {
    return errorResponse(400, "Invalid JSON payload");
  }
}

export function ensureUuid(value: unknown, field: string): string | Response {
  if (typeof value !== "string" || !/^[0-9a-fA-F-]{36}$/.test(value)) {
    return errorResponse(400, "validation error", {
      [field]: "must be a valid uuid",
    });
  }
  return value;
}

export function ensureEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  field: string,
): T | Response {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    return errorResponse(400, "validation error", {
      [field]: `must be one of: ${allowed.join(", ")}`,
    });
  }
  return value as T;
}

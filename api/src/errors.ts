import type { ZodError } from "zod";

export class ApiError extends Error {
  public readonly status: number;
  public readonly details?: Record<string, unknown>;

  constructor(status: number, message: string, details?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function fromZodError(error: ZodError, status = 400): ApiError {
  const issues = error.issues.reduce<Record<string, string>>((acc, issue) => {
    const path = issue.path.join(".") || "root";
    acc[path] = issue.message;
    return acc;
  }, {});
  return new ApiError(status, "validation error", issues);
}

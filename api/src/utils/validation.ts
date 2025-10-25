import { z } from "zod";
import { fromZodError } from "../errors.js";

export function ensureUuid(value: unknown, field: string): string {
  const schema = z
    .string({ required_error: `${field} is required` })
    .uuid(`${field} must be a valid UUID`);
  const result = schema.safeParse(value);
  if (!result.success) {
    throw fromZodError(result.error);
  }
  return result.data;
}

export function ensureEnum<T extends readonly [string, ...string[]]>(
  value: unknown,
  options: T,
  field: string,
): T[number] {
  const schema = z.enum(options, { required_error: `${field} is required` });
  const result = schema.safeParse(value);
  if (!result.success) {
    throw fromZodError(result.error);
  }
  return result.data;
}

export function ensureBoolean(value: unknown, field: string): boolean {
  const schema = z.coerce.boolean({ required_error: `${field} is required` });
  const result = schema.safeParse(value);
  if (!result.success) {
    throw fromZodError(result.error);
  }
  return result.data;
}

export function ensureNumber(
  value: unknown,
  field: string,
  options?: { min?: number; max?: number },
): number {
  let schema = z
    .number({ required_error: `${field} is required`, invalid_type_error: `${field} must be a number` });
  if (options?.min !== undefined) {
    schema = schema.min(options.min, `${field} must be >= ${options.min}`);
  }
  if (options?.max !== undefined) {
    schema = schema.max(options.max, `${field} must be <= ${options.max}`);
  }
  const result = schema.safeParse(value);
  if (!result.success) {
    throw fromZodError(result.error);
  }
  return result.data;
}

export function ensureOptionalString(value: unknown, field: string): string | undefined {
  const schema = z
    .string({ invalid_type_error: `${field} must be a string` })
    .optional()
    .transform((val) => (val ? val.trim() : undefined));
  const result = schema.safeParse(value);
  if (!result.success) {
    throw fromZodError(result.error);
  }
  return result.data;
}

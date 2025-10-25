import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../errors.js";

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof ApiError) {
    res.status(err.status).json({
      message: err.message,
      errors: err.details,
    });
    return;
  }

  console.error(err);
  res.status(500).json({
    message: "Unexpected error",
  });
}

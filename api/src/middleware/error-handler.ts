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
      data: null,
      error: {
        code: err.status,
        message: err.message,
      },
      details: err.details,
      message: err.message,
      errors: err.details,
    });
    return;
  }

  console.error(err);
  res.status(500).json({
    data: null,
    error: {
      code: 500,
      message: "Unexpected error",
    },
    message: "Unexpected error",
  });
}

import type { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/apiError.js";

export function globalErrorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction,
) {
  console.error(`[Error]: ${err.message}`);

  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      details: err.details,
    });
  }

  // Handle generic / Prisma errors safely
  return res.status(500).json({
    success: false,
    message: "Internal Server Error",
  });
}

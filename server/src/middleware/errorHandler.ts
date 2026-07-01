import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";

type HttpError = Error & { status?: number };

export const errorHandler: ErrorRequestHandler = (error: HttpError, _req, res, _next) => {
  console.error(error);
  if (error instanceof ZodError) {
    return res.status(400).json({
      message: "Validation failed",
      details: error.errors
    });
  }

  res.status(error.status || 500).json({
    message: error.message || "Something went wrong"
  });
};

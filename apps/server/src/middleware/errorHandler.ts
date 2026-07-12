import type { ErrorRequestHandler } from "express";
import { Prisma } from "@prisma/client";
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

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") return res.status(409).json({ message: "A record with that unique value already exists" });
    if (error.code === "P2025") return res.status(404).json({ message: "The requested record was not found" });
    if (error.code === "P2003") return res.status(400).json({ message: "A related record is invalid" });
  }

  if (error.message === "Invalid date" || error.message.startsWith("Expected a YYYY-MM-DD")) {
    return res.status(400).json({ message: error.message });
  }

  res.status(error.status || 500).json({
    message: error.message || "Something went wrong"
  });
};

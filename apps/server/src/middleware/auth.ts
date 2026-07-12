import type { RequestHandler } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../auth/auth.js";

export const requireAuth: RequestHandler = async (req, res, next) => {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers)
    });
    if (!session || (session.user.role !== "ADMIN" && session.user.role !== "SALES")) {
      return res.status(401).json({ message: "Authentication required" });
    }
    req.user = {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      role: session.user.role
    };
    next();
  } catch {
    res.status(401).json({ message: "Invalid auth token" });
  }
};

export function requireRole(...roles: Express.User["role"][]): RequestHandler {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: "You do not have access to this resource" });
    }
    next();
  };
}

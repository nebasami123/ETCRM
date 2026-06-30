import jwt from "jsonwebtoken";
import type { JwtPayload } from "jsonwebtoken";
import type { RequestHandler } from "express";
import { prisma } from "../config/db.js";

function hasSubject(payload: string | JwtPayload): payload is JwtPayload & { sub: string } {
  return typeof payload !== "string" && typeof payload.sub === "string";
}

export const requireAuth: RequestHandler = async (req, res, next) => {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ message: "Missing auth token" });

    const payload = jwt.verify(token, process.env.JWT_SECRET || "");
    if (!hasSubject(payload)) return res.status(401).json({ message: "Invalid auth token" });

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, name: true, email: true, role: true }
    });

    if (!user) return res.status(401).json({ message: "Invalid auth token" });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ message: "Invalid auth token" });
  }
};

export function requireRole(...roles: Array<Express.User["role"]>): RequestHandler {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: "You do not have access to this resource" });
    }
    next();
  };
}

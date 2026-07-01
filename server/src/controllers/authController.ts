import type { RequestHandler } from "express";
import { z } from "zod";
import { changePasswordCommand, loginCommand } from "../features/auth/authCommands.js";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, "New password must be at least 8 characters")
});

export const login: RequestHandler = async (req, res, next) => {
  try {
    const data = loginSchema.parse(req.body);
    const result = await loginCommand(data);

    if (!result) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const me: RequestHandler = (req, res) => {
  res.json({ user: req.user });
};

export const changePassword: RequestHandler = async (req, res, next) => {
  try {
    const data = changePasswordSchema.parse(req.body);
    const changed = await changePasswordCommand({ userId: req.user.id, ...data });

    if (!changed) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    res.json({ message: "Password updated" });
  } catch (error) {
    next(error);
  }
};

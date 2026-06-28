import { Router } from "express";
import {
  addCallNote,
  dashboard,
  getLead,
  listMyLeads,
  updateLeadPhase
} from "../controllers/salesController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const salesRoutes = Router();

salesRoutes.use(requireAuth, requireRole("SALES"));
salesRoutes.get("/dashboard", dashboard);
salesRoutes.get("/leads", listMyLeads);
salesRoutes.get("/leads/:id", getLead);
salesRoutes.patch("/leads/:id/phase", updateLeadPhase);
salesRoutes.post("/leads/:id/notes", addCallNote);

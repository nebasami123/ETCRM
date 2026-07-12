import { Router } from "express";
import {
  addCallNote,
  createLead,
  claimLead,
  dashboard,
  getLead,
  getLeaderboard,
  listMyLeads,
  updateAppointment,
  updateFollowUp,
  updateLeadPhase,
  requestTransfer,
  uploadLeads
} from "../controllers/salesController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { leadUpload } from "../middleware/upload.js";

export const salesRoutes = Router();

salesRoutes.use(requireAuth, requireRole("SALES"));
salesRoutes.get("/dashboard", dashboard);
salesRoutes.get("/leaderboard", getLeaderboard);
salesRoutes.get("/leads", listMyLeads);
salesRoutes.post("/leads", createLead);
salesRoutes.post("/leads/upload", leadUpload.single("file"), uploadLeads);
salesRoutes.get("/leads/:id", getLead);
salesRoutes.patch("/leads/:id/phase", updateLeadPhase);
salesRoutes.patch("/leads/:id/appointment", updateAppointment);
salesRoutes.patch("/leads/:id/follow-up", updateFollowUp);
salesRoutes.post("/leads/:id/claim", claimLead);
salesRoutes.post("/leads/:id/claim-transfer-requests", requestTransfer);
salesRoutes.post("/leads/:id/notes", addCallNote);

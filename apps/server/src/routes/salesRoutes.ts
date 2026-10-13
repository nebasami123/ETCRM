import { Router } from "express";
import {
  addCallNote,
  createLead,
  claimLead,
  dashboard,
  getTasks,
  addReminder,
  setReminderComplete,
  getLead,
  getLeaderboard,
  listMyCampaigns,
  listMyLeads,
  localLeadFilterOptions,
  updateAppointment,
  updateFollowUp,
  updateLeadPhase,
  updateLeadDetails,
  updateLeadLog,
  requestTransfer,
  uploadLeads
} from "../controllers/salesController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { leadUpload } from "../middleware/upload.js";

export const salesRoutes = Router();

salesRoutes.use(requireAuth, requireRole("SALES"));
const requireInternalSales: import("express").RequestHandler = (req, res, next) => {
  if (req.user.salesType === "EXTERNAL") {
    return res.status(403).json({ message: "This page is not available to external sales accounts" });
  }
  next();
};

salesRoutes.get("/dashboard", requireInternalSales, dashboard);
salesRoutes.get("/tasks", requireInternalSales, getTasks);
salesRoutes.post("/reminders", requireInternalSales, addReminder);
salesRoutes.patch("/reminders/:id", requireInternalSales, setReminderComplete);
salesRoutes.get("/leaderboard", requireInternalSales, getLeaderboard);
salesRoutes.get("/leads", listMyLeads);
salesRoutes.get("/leads/filter-options", localLeadFilterOptions);
salesRoutes.get("/campaigns", requireInternalSales, listMyCampaigns);
salesRoutes.post("/leads", createLead);
salesRoutes.post("/leads/upload", requireInternalSales, leadUpload.single("file"), uploadLeads);
salesRoutes.get("/leads/:id", getLead);
salesRoutes.patch("/leads/:id", updateLeadDetails);
salesRoutes.patch("/leads/:id/phase", updateLeadPhase);
salesRoutes.patch("/leads/:id/log", updateLeadLog);
salesRoutes.patch("/leads/:id/appointment", updateAppointment);
salesRoutes.patch("/leads/:id/follow-up", updateFollowUp);
salesRoutes.post("/leads/:id/claim", requireInternalSales, claimLead);
salesRoutes.post("/leads/:id/claim-transfer-requests", requireInternalSales, requestTransfer);
salesRoutes.post("/leads/:id/notes", addCallNote);

import { Router } from "express";
import {
  adminSummary,
  assignLead,
  createLead,
  createSalesUser,
  exportReport,
  getLeaderboard,
  listActivity,
  listLeads,
  listQuotas,
  listSalesUsers,
  listTransferRequests,
  resolveTransferRequest,
  resetSalesUserPassword,
  updateAdminLeadPhase,
  uploadLeads,
  upsertQuota,
  updateLead
} from "../controllers/adminController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { leadUpload } from "../middleware/upload.js";

export const adminRoutes = Router();

adminRoutes.use(requireAuth, requireRole("ADMIN"));
adminRoutes.get("/summary", adminSummary);
adminRoutes.get("/leaderboard", getLeaderboard);
adminRoutes.get("/sales-users", listSalesUsers);
adminRoutes.post("/sales-users", createSalesUser);
adminRoutes.post("/sales-users/:id/password", resetSalesUserPassword);
adminRoutes.get("/activity", listActivity);
adminRoutes.get("/leads", listLeads);
adminRoutes.post("/leads", createLead);
adminRoutes.patch("/leads/:id", updateLead);
adminRoutes.post("/leads/upload", leadUpload.single("file"), uploadLeads);
adminRoutes.patch("/leads/:id/assign", assignLead);
adminRoutes.patch("/leads/:id/phase", updateAdminLeadPhase);
adminRoutes.get("/claim-transfer-requests", listTransferRequests);
adminRoutes.post("/claim-transfer-requests/:id/resolve", resolveTransferRequest);
adminRoutes.get("/quotas", listQuotas);
adminRoutes.post("/quotas", upsertQuota);
adminRoutes.get("/reports/export", exportReport);

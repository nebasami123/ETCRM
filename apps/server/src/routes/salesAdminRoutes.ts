import { Router } from "express";
import {
  salesAdminActivity,
  salesAdminAssignLead,
  salesAdminCreateRep,
  salesAdminDashboard,
  salesAdminLeads,
  salesAdminQuotas,
  salesAdminResetPassword,
  salesAdminSaveQuota,
  salesAdminSetStatus,
  salesAdminSetType,
  salesAdminTeam
} from "../controllers/salesAdminController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const salesAdminRoutes = Router();
salesAdminRoutes.use(requireAuth, requireRole("SALES_ADMIN"));
salesAdminRoutes.get("/dashboard", salesAdminDashboard);
salesAdminRoutes.get("/team", salesAdminTeam);
salesAdminRoutes.post("/team", salesAdminCreateRep);
salesAdminRoutes.post("/team/:id/password", salesAdminResetPassword);
salesAdminRoutes.patch("/team/:id/status", salesAdminSetStatus);
salesAdminRoutes.patch("/team/:id/type", salesAdminSetType);
salesAdminRoutes.get("/leads", salesAdminLeads);
salesAdminRoutes.patch("/leads/:id/assign", salesAdminAssignLead);
salesAdminRoutes.get("/activity", salesAdminActivity);
salesAdminRoutes.get("/quotas", salesAdminQuotas);
salesAdminRoutes.post("/quotas", salesAdminSaveQuota);
